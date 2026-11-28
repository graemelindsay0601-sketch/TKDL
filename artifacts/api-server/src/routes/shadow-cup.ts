import { Router } from "express";
import { authedWriteRateLimit } from "../middleware/writeRateLimit";
import { currentCup, cupMatch } from "../lib/shadow-cup-db";
import { shadowSlayers } from "../lib/shadow-duels";
import { ladderTable, ladderMatch } from "../lib/shadow-ladder-db";
import { createHaunt, hauntsFor, hauntRecord, legendsList, currentPossession, exorcise } from "../lib/shadow-extras-db";

const router = Router();
const me = (req: any): number | null => (req.session as any)?.playerId ?? null;

router.get("/shadow-cup", async (_req, res): Promise<void> => {
  res.json(await currentCup().catch(() => null));
});

router.get("/shadow-cup/matches/:id", async (req, res): Promise<void> => {
  const m = await cupMatch(Number(req.params.id)).catch(() => null);
  if (!m) { res.status(404).json({ error: "Not available yet" }); return; }
  res.json(m);
});

router.get("/shadow-bot/slayers", async (_req, res): Promise<void> => {
  res.json(await shadowSlayers().catch(() => []));
});

// ── Shadow Ladder ──
router.get("/shadow-ladder", async (_req, res): Promise<void> => {
  res.json(await ladderTable().catch(() => ({ night: null, rows: [] })));
});
router.get("/shadow-ladder/matches/:id", async (req, res): Promise<void> => {
  const m = await ladderMatch(Number(req.params.id)).catch(() => null);
  if (!m) { res.status(404).json({ error: "Not found" }); return; }
  res.json(m);
});

// ── Haunt a friend ──
router.get("/shadow-haunts", async (req, res): Promise<void> => {
  const id = me(req); if (!id) { res.status(401).json({ error: "Login required" }); return; }
  res.json(await hauntsFor(id));
});
router.post("/shadow-haunts", authedWriteRateLimit, async (req, res): Promise<void> => {
  const id = me(req); if (!id) { res.status(401).json({ error: "Login required" }); return; }
  const r = await createHaunt(id, Number(req.body?.targetId));
  if (r.error) { res.status(400).json({ error: r.error }); return; }
  res.status(201).json(r);
});
router.get("/players/:id/haunt-record", async (req, res): Promise<void> => {
  res.json(await hauntRecord(Number(req.params.id)).catch(() => ({ won: 0, lost: 0, victims: [] })));
});

// ── Legend shadows ──
router.get("/shadow-legends", async (req, res): Promise<void> => {
  res.json(await legendsList(me(req)).catch(() => []));
});

// ── Possession ──
router.get("/shadow-possession", async (_req, res): Promise<void> => {
  res.json(await currentPossession().catch(() => null));
});
router.post("/shadow-possession/exorcise", authedWriteRateLimit, async (req, res): Promise<void> => {
  const id = me(req); if (!id) { res.status(401).json({ error: "Login required" }); return; }
  const r = await exorcise(id, String(req.body?.week ?? ""), String(req.body?.boss ?? "a boss"));
  if ("error" in r) { res.status(400).json(r); return; }
  res.json(r);
});

export default router;
