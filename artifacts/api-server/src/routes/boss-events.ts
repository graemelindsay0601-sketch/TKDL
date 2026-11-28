import { Router } from "express";
import { authedWriteRateLimit, bossBattleRateLimit } from "../middleware/writeRateLimit";
import { eventsFor, recordEventRun, raidState, createCustom, customFor, getCustom, finishCustom } from "../lib/boss-events-db";

const router = Router();
const me = (req: any): number | null => (req.session as any)?.playerId ?? null;
const secs = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 && n <= 3600 ? Math.round(n) : null; };

// Daily / Weekly Boss and the raid, for the Boss Battle page (playerId: whose "mine" to show).
router.get("/boss-battles/events", async (req, res): Promise<void> => {
  const pid = Number(req.query.playerId) || me(req);
  res.json(await eventsFor(pid || null));
});
router.post("/boss-battles/events/run", bossBattleRateLimit, async (req, res): Promise<void> => {
  const pid = Number(req.body?.playerId);
  if (!Number.isInteger(pid) || pid <= 0) { res.status(400).json({ error: "A player is required" }); return; }
  const r = await recordEventRun(String(req.body?.kind), pid, req.body?.won === true, secs(req.body?.elapsedSeconds));
  if ("error" in r) { res.status(400).json(r); return; }
  res.json(r);
});
router.get("/boss-battles/raid", async (req, res): Promise<void> => {
  res.json(await raidState(me(req)).catch(() => null));
});

// Be the Boss
router.get("/boss-battles/custom/mine", async (req, res): Promise<void> => {
  const id = me(req); if (!id) { res.status(401).json({ error: "Login required" }); return; }
  res.json(await customFor(id));
});
router.post("/boss-battles/custom", authedWriteRateLimit, async (req, res): Promise<void> => {
  const id = me(req); if (!id) { res.status(401).json({ error: "Login required" }); return; }
  const r = await createCustom(id, Number(req.body?.targetId), req.body?.curses, req.body?.message);
  if ("error" in r) { res.status(400).json(r); return; }
  res.status(201).json(r);
});
router.get("/boss-battles/custom/:id", async (req, res): Promise<void> => {
  const c = await getCustom(Number(req.params.id));
  if (!c) { res.status(404).json({ error: "Not found" }); return; }
  res.json(c);
});
router.post("/boss-battles/custom/:id/result", authedWriteRateLimit, async (req, res): Promise<void> => {
  const id = me(req); if (!id) { res.status(401).json({ error: "Login required" }); return; }
  const r = await finishCustom(Number(req.params.id), id, req.body?.won === true, secs(req.body?.elapsedSeconds));
  if ("error" in r) { res.status(400).json(r); return; }
  res.json(r);
});

export default router;
