/**
 * /api/dart-scorer — spawns scorer_daemon.py as a persistent child process.
 *
 * In dev (Replit): Python + venv are available, so the daemon starts automatically.
 * In production (Render): set DART_SCORER_URL to the deployed Python service URL
 *   (e.g. https://tkdl-scorer.onrender.com) and this route proxies to it instead.
 *
 * Protocol (dev spawn mode):
 *   stdin/stdout JSON lines — send {"image":"<base64>"}, receive {"darts":[...],...}
 */
import { Router }       from "express";
import { spawn, ChildProcess } from "child_process";
import path             from "path";
import fs               from "fs";

const router = Router();

// ── Decide mode ───────────────────────────────────────────────────────────────

const SCORER_URL = (process.env.DART_SCORER_URL ?? "").replace(/\/$/, "");
const USE_PROXY  = SCORER_URL.length > 0;

// ── Spawn mode ────────────────────────────────────────────────────────────────

// Resolve scorer directory — cwd differs between Replit dev and Render production.
// Try multiple candidates and use the first that contains scorer_daemon.py.
function findScorerDir(): string {
  const candidates = [
    // Render production: start command runs from repo root
    path.join(process.cwd(), "artifacts/dart-scorer"),
    // Replit dev: pnpm filter sets cwd to artifacts/api-server/
    path.resolve(process.cwd(), "../../artifacts/dart-scorer"),
    // Absolute fallback based on this file's location at build time
    path.resolve(__dirname, "../../../artifacts/dart-scorer"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "scorer_daemon.py"))) return c;
  }
  return candidates[0]; // return first anyway so error message is meaningful
}

const SCORER_DIR  = process.env.DART_SCORER_DIR ?? findScorerDir();
const VENV_PYTHON = path.join(SCORER_DIR, ".venv", "bin", "python3");
const DAEMON_PY   = path.join(SCORER_DIR, "scorer_daemon.py");

let daemonProc:   ChildProcess | null = null;
let daemonReady   = false;
let daemonError:  string | null = null;
let spawnCount    = 0;

type PendingReq = { resolve: (v: string) => void; reject: (e: Error) => void };
let pending: PendingReq | null = null;
let lineBuffer = "";

function startDaemon() {
  if (USE_PROXY) return;
  if (!fs.existsSync(DAEMON_PY)) {
    daemonError = `scorer_daemon.py not found at ${DAEMON_PY}`;
    return;
  }
  const python = fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : "python3";

  spawnCount++;
  daemonReady = false;
  daemonError = null;
  lineBuffer  = "";

  daemonProc = spawn(python, [DAEMON_PY], {
    cwd:   SCORER_DIR,
    stdio: ["pipe", "pipe", "pipe"],
  });

  daemonProc.stdout!.on("data", (chunk: Buffer) => {
    lineBuffer += chunk.toString();
    const lines = lineBuffer.split("\n");
    lineBuffer  = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as Record<string, unknown>;
        if ("ready" in msg) {
          if (msg.ready) {
            daemonReady = true;
            daemonError = null;
          } else {
            daemonError = String(msg.error ?? "Daemon failed to start");
          }
          continue;
        }
        if (pending) {
          const p = pending;
          pending = null;
          p.resolve(line);
        }
      } catch {
        if (pending) {
          const p = pending;
          pending = null;
          p.reject(new Error(`Bad JSON from daemon: ${line.slice(0, 200)}`));
        }
      }
    }
  });

  daemonProc.stderr!.on("data", (chunk: Buffer) => {
    const txt = chunk.toString().trim();
    if (txt) process.stderr.write(`[dart-scorer] ${txt}\n`);
  });

  daemonProc.on("exit", (code) => {
    daemonReady = false;
    daemonProc  = null;
    if (pending) {
      const p = pending;
      pending = null;
      p.reject(new Error(`Scorer process exited with code ${code}`));
    }
    // Auto-restart after 3 s if it crashes
    if (code !== 0) {
      setTimeout(startDaemon, 3000);
    }
  });
}

// Start daemon on load (dev mode only)
if (!USE_PROXY) startDaemon();

// ── Helper: send request to daemon ────────────────────────────────────────────

function sendToDaemon(image: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!daemonProc || !daemonReady) {
      reject(new Error(daemonError ?? "Scorer not ready yet — model loading"));
      return;
    }
    if (pending) {
      reject(new Error("Scorer busy with another request"));
      return;
    }
    pending = { resolve, reject };
    daemonProc.stdin!.write(JSON.stringify({ image }) + "\n");
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/dart-scorer/health", async (_req, res) => {
  if (USE_PROXY) {
    try {
      const r = await fetch(`${SCORER_URL}/dart-scorer/health`, { signal: AbortSignal.timeout(8000) });
      const d = await r.json() as { ready?: boolean; starting?: boolean; ok?: boolean; modelLoaded?: boolean };
      res.json({ ok: true, ready: d.ready === true || d.modelLoaded === true, starting: d.starting === true, error: null });
    } catch (err: unknown) {
      res.json({ ok: true, ready: false, starting: false, error: `Scorer unreachable: ${err instanceof Error ? err.message : String(err)}` });
    }
    return;
  }

  res.json({
    ok:         true,
    ready:      daemonReady,
    starting:   !daemonReady && !daemonError,
    error:      daemonError,
    python:     fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : "python3 (system)",
    scorerDir:  SCORER_DIR,
    spawnCount,
  });
});

router.post("/dart-scorer/restart", (_req, res) => {
  if (USE_PROXY) {
    res.json({ ok: true, message: "Scorer runs as a separate service — restart it via Render dashboard" });
    return;
  }
  if (daemonProc) {
    daemonProc.kill();
  } else {
    startDaemon();
  }
  res.json({ ok: true, message: "Scorer restarting…" });
});

router.post("/dart-scorer/analyze", async (req, res) => {
  const { image } = req.body as { image?: string };
  if (typeof image !== "string" || !image) {
    res.status(400).json({ error: "Body must be JSON { image: '<base64 JPEG>' }", darts: [], total: 0 });
    return;
  }

  if (USE_PROXY) {
    try {
      const r = await fetch(`${SCORER_URL}/dart-scorer/analyze`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ image }),
        signal:  AbortSignal.timeout(20_000),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        res.status(r.status).json({ error: `Scorer returned ${r.status}: ${text.slice(0, 200)}`, darts: [], total: 0 });
        return;
      }
      res.json(await r.json());
    } catch (err: unknown) {
      res.status(503).json({ error: err instanceof Error ? err.message : String(err), darts: [], total: 0 });
    }
    return;
  }

  // Spawn mode
  if (!daemonReady) {
    res.status(503).json({
      error: daemonError ?? "Model still loading — wait a moment then retry",
      darts: [], total: 0, calibrationPoints: 0,
    });
    return;
  }

  try {
    const raw    = await sendToDaemon(image);
    const result = JSON.parse(raw);
    res.json(result);
  } catch (err: unknown) {
    res.status(503).json({ error: err instanceof Error ? err.message : String(err), darts: [], total: 0, calibrationPoints: 0 });
  }
});

// Webcam snapshot proxy (server-side fetch so CORS isn't an issue)
router.get("/dart-scorer/webcam-snap", async (req, res) => {
  const url = req.query.url as string;
  if (!url) { res.status(400).send("Missing url param"); return; }
  try {
    const full = url.startsWith("http") ? url : `http://${url}/shot.jpg`;
    const r    = await fetch(full, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) { res.status(502).send("Webcam returned " + r.status); return; }
    const buf  = Buffer.from(await r.arrayBuffer());
    res.set("Content-Type", "image/jpeg").send(buf);
  } catch (err: unknown) {
    res.status(502).send(err instanceof Error ? err.message : String(err));
  }
});

export default router;
