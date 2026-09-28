import { Router } from "express";

const router = Router();
const LIVE_MAX_AGE_MS = 15_000;
const FINISHED_MAX_AGE_MS = 12_000;

type LiveMatch = {
  sessionId: string;
  format: string;
  game: string;
  sides: [string[], string[]];
  status: "live" | "finished";
  winnerSide?: 0 | 1;
  winnerName?: string;
  score: null | { mode: "x01" | "cricket"; scores: [number, number]; turn: 0 | 1; detail?: [string, string]; currentPlayer?: string; lastVisit?: string; checkout?: string };
  updatedAt: string;
  ownerPlayerId: number;
};

let active: LiveMatch | null = null;

router.get("/live-match", (_req, res) => {
  if (active) {
    const maxAge = active.status === "finished" ? FINISHED_MAX_AGE_MS : LIVE_MAX_AGE_MS;
    if (Date.now() - Date.parse(active.updatedAt) > maxAge) active = null;
  }
  res.set("Cache-Control", "no-store");
  res.json({ active: active ? { ...active, ownerPlayerId: undefined } : null });
});

router.put("/live-match", (req, res): void => {
  const ownerPlayerId = Number((req.session as any)?.playerId);
  if (!Number.isInteger(ownerPlayerId) || ownerPlayerId < 1) { res.status(401).json({ error: "Login required" }); return; }
  const body = req.body as Partial<LiveMatch>;
  if (typeof body.sessionId !== "string" || body.sessionId.length < 8 || body.sessionId.length > 100 ||
      typeof body.format !== "string" || typeof body.game !== "string" ||
      !Array.isArray(body.sides) || body.sides.length !== 2 ||
      !body.sides.every(side => Array.isArray(side) && side.length > 0 && side.length <= 12 && side.every(name => typeof name === "string" && name.length <= 80))) {
    res.status(400).json({ error: "Invalid live match update" });
    return;
  }
  const score = body.score;
  if (score != null && (typeof score !== "object" || !["x01", "cricket"].includes(score.mode) ||
      !Array.isArray(score.scores) || score.scores.length !== 2 || score.scores.some(value => !Number.isFinite(value)) ||
      (score.turn !== 0 && score.turn !== 1) ||
      (score.lastVisit !== undefined && (typeof score.lastVisit !== "string" || score.lastVisit.length > 120)) ||
      (score.checkout !== undefined && (typeof score.checkout !== "string" || score.checkout.length > 120)))) {
    res.status(400).json({ error: "Invalid live score" });
    return;
  }
  active = {
    sessionId: body.sessionId,
    format: body.format.slice(0, 80),
    game: body.game.slice(0, 80),
    sides: body.sides.map(side => side.map(name => name.trim()).filter(Boolean)) as [string[], string[]],
    score: score ?? null,
    status: body.status === "finished" ? "finished" : "live",
    ...(body.status === "finished" && (body.winnerSide === 0 || body.winnerSide === 1)
      ? { winnerSide: body.winnerSide, winnerName: typeof body.winnerName === "string" ? body.winnerName.slice(0, 160) : body.sides[body.winnerSide].join(" & ") }
      : {}),
    updatedAt: new Date().toISOString(),
    ownerPlayerId,
  };
  res.json({ ok: true });
});

router.delete("/live-match/:sessionId", (req, res) => {
  const ownerPlayerId = Number((req.session as any)?.playerId);
  if (active?.sessionId === req.params.sessionId && active.ownerPlayerId === ownerPlayerId) active = null;
  res.sendStatus(204);
});

export default router;
