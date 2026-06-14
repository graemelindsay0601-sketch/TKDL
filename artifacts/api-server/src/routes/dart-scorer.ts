/**
 * /api/dart-scorer — proxies to the tkdl-scorer Python microservice.
 *
 * GET  /api/dart-scorer/health   → forwards health from Python service
 * POST /api/dart-scorer/analyze  → forwards { image: "<base64 JPEG>" } to Python service
 * POST /api/dart-scorer/restart  → no-op (Python service manages itself)
 *
 * Set DART_SCORER_URL to the deployed scorer URL, e.g.
 *   https://tkdl-scorer.onrender.com
 * If unset, all requests return a clear "not configured" error.
 */
import { Router } from "express";

const router = Router();

const SCORER_URL = (process.env.DART_SCORER_URL ?? "").replace(/\/$/, "");

type PythonHealth = {
  ok?: boolean;
  ready?: boolean;
  starting?: boolean;
  modelLoaded?: boolean;
};

router.get("/dart-scorer/health", async (_req, res) => {
  if (!SCORER_URL) {
    res.json({ ok: true, ready: false, starting: false, error: "DART_SCORER_URL env var not set" });
    return;
  }
  try {
    const r = await fetch(`${SCORER_URL}/dart-scorer/health`, {
      signal: AbortSignal.timeout(8000),
    });
    const d = (await r.json()) as PythonHealth;
    res.json({
      ok:       true,
      ready:    d.ready === true || d.modelLoaded === true,
      starting: d.starting === true || (d.ok === true && !d.modelLoaded),
      error:    null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ ok: true, ready: false, starting: false, error: `Scorer unreachable: ${msg}` });
  }
});

router.post("/dart-scorer/restart", (_req, res) => {
  res.json({ ok: true, message: "Scorer runs as a separate service — restart it via Render dashboard" });
});

router.post("/dart-scorer/analyze", async (req, res) => {
  const { image } = req.body as { image?: string };

  if (typeof image !== "string" || !image) {
    res.status(400).json({ error: "Body must be JSON { image: '<base64 JPEG>' }", darts: [], total: 0 });
    return;
  }

  if (!SCORER_URL) {
    res.status(503).json({ error: "DART_SCORER_URL env var not set", darts: [], total: 0 });
    return;
  }

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

    const result = await r.json();
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg, darts: [], total: 0, calibrationPoints: 0 });
  }
});

export default router;
