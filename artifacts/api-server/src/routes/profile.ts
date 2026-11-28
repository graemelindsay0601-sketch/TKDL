// Profile 2.0 routes.
import { Router } from "express";
import { playerCards, allPlayerCards } from "../lib/player-card-db";

const router = Router();

router.get("/players/:id/card", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const c = await playerCards(id);
    if (!c) { res.status(404).json({ error: "Player not found" }); return; }
    res.json(c);
  } catch (err) { req.log?.error({ err }, "Player card failed"); res.status(500).json({ error: "Failed to load the player card" }); }
});

router.get("/player-cards", async (req, res): Promise<void> => {
  try { res.json(await allPlayerCards()); }
  catch (err) { req.log?.error({ err }, "Player cards failed"); res.status(500).json({ error: "Failed to load player cards" }); }
});

export default router;
