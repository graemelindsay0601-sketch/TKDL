import { Router } from "express";
import { currentCup, cupMatch } from "../lib/shadow-cup-db";
import { shadowSlayers } from "../lib/shadow-duels";

const router = Router();

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

export default router;
