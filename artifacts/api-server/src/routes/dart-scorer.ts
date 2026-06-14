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

function findPython(): string {
  // Prefer the venv we created for this service (has ultralytics/cv2 installed)
  const venvPython = path.resolve("../../artifacts/dart-scorer/.venv/bin/python3");
  try {
    execSync(`${venvPython} --version`, { timeout: 3000 });
    return venvPython;
  } catch { /* fall through */ }
  try {
    return execSync("which python3", { timeout: 5000 }).toString().trim();
  } catch {
    return "python3";
  }
}

const PYTHON = findPython();

// Process runs from artifacts/api-server, so go up two levels to workspace root
const DART_SCORER_DIR = path.resolve(process.cwd(), "../../artifacts/dart-scorer");

// ── Daemon state ──────────────────────────────────────────────────────────────

type Waiter = {
  resolve: (v: unknown) => void;
  reject:  (e: Error)   => void;
  image:   string;
};

let proc:     ChildProcessWithoutNullStreams | null = null;
let ready     = false;
let starting  = false;
let startErr: string | null = null;
const waiters: Waiter[] = [];
let lineBuf   = "";

function rejectAll(msg: string) {
  const err = new Error(msg);
  let w: Waiter | undefined;
  while ((w = waiters.shift())) w.reject(err);
}

function spawnDaemon() {
  if (proc || starting) return;
  starting = true;
  startErr = null;

  const script = path.join(DART_SCORER_DIR, "scorer_daemon.py");

  try {
    proc = spawn(PYTHON, [script], {
      cwd: DART_SCORER_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
  } catch (e: unknown) {
    starting = false;
    startErr = `Failed to spawn Python: ${e instanceof Error ? e.message : String(e)}`;
    rejectAll(startErr);
    return;
  }

  // Catch spawn errors (ENOENT, permission denied, etc.)
  proc.on("error", (err: Error) => {
    starting = false;
    ready    = false;
    startErr = `Python spawn error: ${err.message}`;
    proc     = null;
    rejectAll(startErr);
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
        starting = false;
        if (msg.ready) {
          ready = true;
          // Flush buffered requests
          for (const w of waiters) {
            proc!.stdin.write(JSON.stringify({ image: w.image }) + "\n");
          }
        } else {
          startErr = (msg.error as string) ?? "Scorer process failed to start";
          proc = null;
          rejectAll(startErr);
        }
      } else {
        const w = waiters.shift();
        if (w) w.resolve(msg);
      }
    }
  });

  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (d: string) => {
    if (process.env.NODE_ENV !== "production") process.stderr.write(`[dart-scorer] ${d}`);
  });

  proc.on("close", () => {
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
  if (!proc && !starting) spawnDaemon(); // pre-warm
  res.json({ ok: true, ready, starting, error: startErr, python: PYTHON, scorerDir: DART_SCORER_DIR });
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
