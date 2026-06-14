/**
 * /api/dart-scorer — manages the Python YOLOv8 scoring daemon as a child process.
 * Spawned once at first request; kept alive to avoid reloading the model each call.
 *
 * GET  /api/dart-scorer/health
 * POST /api/dart-scorer/analyze   body: { image: "<base64 JPEG>" }
 */
import { Router } from "express";
import { spawn, execSync, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";

const router = Router();

// ── Find Python binary once at startup ───────────────────────────────────────
// We rely on the shell (shell: true in spawn) to resolve the binary, so we only
// need to know which *name* to call — not the absolute path. This avoids the
// ENOENT that occurs when Node does a direct execvp on a symlink chain.

function findPython(): string {
  // 1. Prefer the venv we created for this service (has ultralytics/cv2 installed)
  const venvPython = path.resolve(process.cwd(), "../../artifacts/dart-scorer/.venv/bin/python3");
  try {
    execSync(`"${venvPython}" --version`, { stdio: "pipe", timeout: 3000 });
    return venvPython;
  } catch { /* fall through */ }
  // 2. Fall back to whatever the shell resolves — do NOT use `which` since the
  //    returned absolute path may be a broken symlink when Node calls execvp directly.
  //    Just return the bare name; spawn will use shell: true.
  return "python3";
}

const PYTHON = findPython();

// DART_SCORER_DIR env var is set explicitly in Docker/Render (= /app/artifacts/dart-scorer).
// In Replit dev, pnpm runs from the package dir so ../../ resolves correctly.
const DART_SCORER_DIR =
  process.env.DART_SCORER_DIR ??
  path.resolve(process.cwd(), "../../artifacts/dart-scorer");

// ── Daemon state ──────────────────────────────────────────────────────────────

type Waiter = {
  resolve: (v: unknown) => void;
  reject:  (e: Error)   => void;
  image:   string;
};

let proc:       ChildProcessWithoutNullStreams | null = null;
let ready       = false;
let starting    = false;
let startErr: string | null = null;
let startTimer: ReturnType<typeof setTimeout> | null = null;
let spawnCount  = 0;
const MAX_SPAWN = 3;           // give up after 3 consecutive failures
const START_TIMEOUT_MS = 120_000; // 2 min max for model load (pip install may run first)
const waiters: Waiter[] = [];
let lineBuf   = "";

function rejectAll(msg: string) {
  const err = new Error(msg);
  let w: Waiter | undefined;
  while ((w = waiters.shift())) w.reject(err);
}

function clearStartTimer() {
  if (startTimer) { clearTimeout(startTimer); startTimer = null; }
}

function failDaemon(msg: string) {
  clearStartTimer();
  starting = false;
  ready    = false;
  startErr = msg;
  proc     = null;
  rejectAll(msg);
}

function spawnDaemon() {
  if (proc || starting) return;
  if (spawnCount >= MAX_SPAWN) return; // give up — show error, don't loop
  starting  = true;
  startErr  = null;
  spawnCount++;

  const script = path.join(DART_SCORER_DIR, "scorer_daemon.py");

  try {
    // shell: true — lets the shell resolve 'python3' via PATH, handles symlinks
    // correctly. Without it, Node calls execvp directly which can ENOENT on Render
    // even when 'which python3' succeeds (broken symlink chain).
    proc = spawn(PYTHON, [script], {
      cwd: DART_SCORER_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      shell: true,
    }) as ChildProcessWithoutNullStreams;
  } catch (e: unknown) {
    failDaemon(`Failed to spawn Python: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  // Startup timeout — pip install + model load can take a while; give it 2 min
  startTimer = setTimeout(() => {
    failDaemon(`Scorer timed out after ${START_TIMEOUT_MS / 1000}s (Python: ${PYTHON}, dir: ${DART_SCORER_DIR})`);
    proc?.kill();
    proc = null;
  }, START_TIMEOUT_MS);

  proc.on("error", (err: Error) => {
    failDaemon(`Python spawn error: ${err.message}`);
  });

  proc.stdout.setEncoding("utf8");
  proc.stdout.on("data", (chunk: string) => {
    lineBuf += chunk;
    const lines = lineBuf.split("\n");
    lineBuf = lines.pop() ?? "";

    for (const line of lines) {
      const s = line.trim();
      if (!s) continue;
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(s); } catch { continue; }

      if (!ready) {
        // Status messages from pip install etc — keep starting, don't resolve yet
        if (msg.status) continue;

        clearStartTimer();
        starting = false;
        if (msg.ready) {
          ready      = true;
          spawnCount = 0; // reset on success
          for (const w of waiters) {
            proc!.stdin.write(JSON.stringify({ image: w.image }) + "\n");
          }
        } else {
          const errMsg = [(msg.error as string), (msg.trace as string)].filter(Boolean).join("\n").slice(0, 400);
          failDaemon(errMsg || "Scorer process failed to start");
        }
      } else {
        const w = waiters.shift();
        if (w) w.resolve(msg);
      }
    }
  });

  // Always log stderr — essential for diagnosing production failures
  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (d: string) => {
    process.stderr.write(`[dart-scorer] ${d}`);
  });

  proc.on("close", () => {
    clearStartTimer();
    proc     = null;
    ready    = false;
    starting = false;
    if (waiters.length > 0) rejectAll("Scorer process exited unexpectedly");
  });
}

function callDaemon(imageBase64: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (startErr && !proc) { reject(new Error(startErr)); return; }

    const waiter: Waiter = { resolve, reject, image: imageBase64 };
    waiters.push(waiter);

    if (!proc) {
      spawnDaemon();
      // waiters flushed when daemon signals ready
    } else if (ready) {
      proc.stdin.write(JSON.stringify({ image: imageBase64 }) + "\n");
    }
    // else still starting — request queued, sent when ready fires
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/dart-scorer/health", (_req, res) => {
  // Pre-warm only if never started or explicitly retried — don't loop after failures
  if (!proc && !starting && !startErr) spawnDaemon();
  res.json({ ok: true, ready, starting, error: startErr, python: PYTHON, scorerDir: DART_SCORER_DIR, spawnCount });
});

// Manual retry — resets failure state and tries again
router.post("/dart-scorer/restart", (_req, res) => {
  if (proc) { proc.kill(); proc = null; }
  clearStartTimer();
  ready = false; starting = false; startErr = null; spawnCount = 0;
  spawnDaemon();
  res.json({ ok: true, message: "Restarting scorer daemon" });
});

router.post("/dart-scorer/analyze", async (req, res) => {
  const { image } = req.body as { image?: string };
  if (typeof image !== "string" || !image) {
    res.status(400).json({ error: "Body must be JSON with { image: '<base64 JPEG>' }", darts: [], total: 0 });
    return;
  }

  if (!proc && !starting) spawnDaemon();

  try {
    const result = await callDaemon(image);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg, darts: [], total: 0, calibrationPoints: 0 });
  }
});

export default router;
