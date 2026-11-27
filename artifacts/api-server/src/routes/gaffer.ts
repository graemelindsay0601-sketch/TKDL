import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";
import { isFeatureAvailable } from "../services/feature-flags-service";
import { monthKey, shiftMonth } from "../lib/league-target";
import { CHALLENGES, CHALLENGE_ORDER, GAFFER_LADDER, LEVELS, SQUAD_LADDER, nextStep, type ChallengeKey, type LadderStep } from "../lib/gaffer";
import {
  GAFFER_FLAG, candidatesFor, challengeReady, challengeProgress, currentGaffer, gafferHits, gameOptions, optionsFor, pickChallenge, pickDeadlineFor, adminSetGaffer, adminVoidGaffer,
  settleGaffer, squadHits, voteOpens, type GafferRow,
} from "../lib/gaffer-db";

const router = Router();
const sess = (req: any) => (req.session ?? {}) as { playerId?: number; isAdmin?: boolean };

async function names(ids: (number | null)[]): Promise<Map<number, string>> {
  const list = [...new Set(ids.filter((i): i is number => i != null))];
  if (!list.length) return new Map();
  const r = await db.execute(sql`SELECT id, name FROM players WHERE id IN (${sql.join(list.map(i => sql`${i}`), sql`, `)})`);
  return new Map((r.rows as any[]).map(x => [Number(x.id), String(x.name)]));
}

const ladderView = (ladder: LadderStep[], hits: number, owned: Set<string>) =>
  ladder.map(s => ({ hits: s.hits, id: s.cosmetic.id, name: s.cosmetic.name, category: s.cosmetic.category, rarity: s.cosmetic.rarity, owned: owned.has(s.cosmetic.id) }));

async function snapshot(playerId: number | null) {
  const now = new Date();
  const g = await currentGaffer(now);
  const month = g.month, next = shiftMonth(month, 1);
  const live = await isFeatureAvailable(GAFFER_FLAG, false);
  const nm = await names([g.gaffer_id]);
  const picking = !g.voided && !!g.gaffer_id && !g.challenge && now < pickDeadlineFor(g);

  let challenge = null;
  let me: any = null;
  if (g.challenge && g.target != null) {
    const def = CHALLENGES[g.challenge];
    const prog = await challengeProgress(g.challenge, month, g.target, g.param);
    const games = g.challenge === "gotm" ? await gameOptions(month) : [];
    challenge = { key: g.challenge, label: def.label, unit: def.unit, blurb: def.blurb, contributes: def.contributes, level: g.level, levelName: LEVELS[(g.level ?? 1) - 1].name,
      target: g.target, value: prog.value, param: g.param, paramLabel: games.find(x => x.key === g.param)?.label ?? g.param, contributors: prog.contributors.length };
    if (playerId) me = { contributing: prog.contributors.includes(playerId), value: prog.perPlayer.get(playerId) ?? 0 };
  }

  // Gaffer's pick options
  let options = null;
  if (picking && playerId === g.gaffer_id) {
    const games = await gameOptions(month);
    options = [];
    for (const key of CHALLENGE_ORDER) {
      const def = CHALLENGES[key];
      if (key === "gotm") {
        const perGame = [];
        for (const game of games) perGame.push({ param: game.key, label: game.label, targets: await optionsFor(key, month, game.key) });
        options.push({ key, label: def.label, blurb: def.blurb, unit: def.unit, games: perGame });
      } else if (!(await challengeReady(key, month))) {
        options.push({ key, label: def.label, blurb: def.blurb, unit: def.unit, locked: "Needs more league matches on the app's scorer" });
      } else options.push({ key, label: def.label, blurb: def.blurb, unit: def.unit, targets: await optionsFor(key, month, null) });
    }
  }

  // Next month's vote, in the last days of this month
  let vote = null;
  if (now >= voteOpens(month)) {
    const cands = await candidatesFor(month);
    const mine = playerId ? (await db.execute(sql`SELECT candidate_id FROM gaffer_votes WHERE month = ${next} AND voter_id = ${playerId}`)).rows[0] as any : null;
    const total = Number(((await db.execute(sql`SELECT COUNT(*)::int n FROM gaffer_votes WHERE month = ${next}`)).rows[0] as any).n);
    vote = { forMonth: next, closes: shiftMonth(month, 1), candidates: cands.filter(c => c.id !== playerId), myVote: mine ? Number(mine.candidate_id) : null, votesCast: total };
  }

  let ladders = null;
  if (playerId) {
    const owned = new Set(((await db.execute(sql`SELECT cosmetic_id FROM player_cosmetics WHERE player_id = ${playerId} AND cosmetic_id LIKE '%-gf-%'`)).rows as any[]).map(r => r.cosmetic_id));
    const gh = (await gafferHits([playerId])).get(playerId) ?? 0, sh = (await squadHits([playerId])).get(playerId) ?? 0;
    ladders = { gaffer: { hits: gh, steps: ladderView(GAFFER_LADDER, gh, owned), next: nextStep(GAFFER_LADDER, gh)?.hits ?? null },
      squad: { hits: sh, steps: ladderView(SQUAD_LADDER, sh, owned), next: nextStep(SQUAD_LADDER, sh)?.hits ?? null } };
  }

  const past = (await db.execute(sql`SELECT * FROM gaffer_months WHERE settled_at IS NOT NULL ORDER BY month DESC LIMIT 6`)).rows as GafferRow[];
  const pastNames = await names(past.map(p => p.gaffer_id));
  const history = past.filter(h => !live || h.live).map(h => ({ month: h.month, gaffer: h.gaffer_id ? pastNames.get(h.gaffer_id) ?? null : null,
    label: h.challenge ? CHALLENGES[h.challenge].label : null, target: h.target, value: h.final_value, hit: h.hit }));

  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1));
  return {
    live, month, gaffer: g.gaffer_id ? { id: g.gaffer_id, name: nm.get(g.gaffer_id) ?? "?" } : null, chosenBy: g.chosen_by,
    youAreGaffer: !!playerId && playerId === g.gaffer_id, picking, pickBy: pickDeadlineFor(g).toISOString(), voided: !!g.voided, options,
    challenge, me, vote, ladders, history, daysLeft: Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 86400000)),
  };
}

const gate = async (req: any) => isFeatureAvailable(GAFFER_FLAG, sess(req).isAdmin === true);

router.get("/gaffer", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  if (!(await gate(req))) { res.json({ available: false }); return; }
  try { res.json({ available: true, ...(await snapshot(sess(req).playerId ?? null)) }); }
  catch (err) { logger.error({ err }, "Gaffer snapshot failed"); res.status(500).json({ error: "The Gaffer is unavailable" }); }
});

/** Who's wearing the armband right now (for Standings and profiles). Null while the feature isn't visible to this viewer. */
router.get("/gaffer/current", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  if (!(await gate(req))) { res.json({ id: null }); return; }
  try { const g = await currentGaffer(); res.json({ id: g.voided ? null : g.gaffer_id, month: g.month }); }
  catch { res.json({ id: null }); }
});

router.post("/gaffer/vote", async (req, res): Promise<void> => {
  const me = sess(req).playerId;
  if (!me) { res.status(401).json({ error: "Sign in to vote" }); return; }
  if (!(await gate(req))) { res.status(404).json({ error: "Not available" }); return; }
  const now = new Date(), month = monthKey(now);
  if (now < voteOpens(month)) { res.status(400).json({ error: "The vote isn't open yet" }); return; }
  const candidate = Number(req.body?.candidateId);
  if (candidate === me) { res.status(400).json({ error: "You can't vote for yourself" }); return; }
  if (!(await candidatesFor(month)).some(c => c.id === candidate)) { res.status(400).json({ error: "That player can't stand this month" }); return; }
  await db.execute(sql`INSERT INTO gaffer_votes (month, voter_id, candidate_id) VALUES (${shiftMonth(month, 1)}, ${me}, ${candidate})
    ON CONFLICT (month, voter_id) DO UPDATE SET candidate_id = EXCLUDED.candidate_id, updated_at = NOW()`);
  res.json({ ok: true });
});

router.post("/gaffer/pick", async (req, res): Promise<void> => {
  const me = sess(req).playerId;
  if (!me || !(await gate(req))) { res.status(404).json({ error: "Not available" }); return; }
  const g = await currentGaffer();
  if (g.gaffer_id !== me) { res.status(403).json({ error: "Only the Gaffer can pick" }); return; }
  if (g.challenge) { res.status(400).json({ error: "This month's challenge is already set" }); return; }
  const key = String(req.body?.challenge) as ChallengeKey, level = Number(req.body?.level);
  if (!CHALLENGE_ORDER.includes(key) || ![1, 2, 3].includes(level)) { res.status(400).json({ error: "Pick a challenge and a level" }); return; }
  if (!(await challengeReady(key, g.month))) { res.status(400).json({ error: "That challenge needs more league matches on the app's scorer" }); return; }
  let param: string | null = null;
  if (key === "gotm") {
    param = String(req.body?.param ?? "");
    if (!(await gameOptions(g.month)).some(o => o.key === param)) { res.status(400).json({ error: "Pick a game" }); return; }
  }
  if (!(await pickChallenge(g.month, key, level, param))) { res.status(409).json({ error: "Too late — the challenge is set" }); return; }
  res.json({ ok: true });
});

/** Admin: the full picture whatever the flag says. */
router.get("/admin/gaffer", async (req, res): Promise<void> => {
  if (sess(req).isAdmin !== true) { res.status(403).json({ error: "Admin only" }); return; }
  try {
    await settleGaffer();
    const months = (await db.execute(sql`SELECT * FROM gaffer_months ORDER BY month DESC LIMIT 12`)).rows;
    res.json({ ...(await snapshot(sess(req).playerId ?? null)), months });
  } catch (err) { logger.error({ err }, "Gaffer admin view failed"); res.status(500).json({ error: "The Gaffer is unavailable" }); }
});

router.post("/admin/gaffer/set", async (req, res): Promise<void> => {
  if (sess(req).isAdmin !== true) { res.status(403).json({ error: "Admin only" }); return; }
  const pid = Number(req.body?.playerId);
  const exists = (await db.execute(sql`SELECT 1 FROM players WHERE id = ${pid}`)).rows.length;
  if (!exists) { res.status(400).json({ error: "Pick a player" }); return; }
  const g = await currentGaffer();
  await adminSetGaffer(g.month, pid);
  logger.info({ month: g.month, playerId: pid, by: sess(req).playerId }, "Admin changed the Gaffer");
  res.json({ ok: true });
});

router.post("/admin/gaffer/void", async (req, res): Promise<void> => {
  if (sess(req).isAdmin !== true) { res.status(403).json({ error: "Admin only" }); return; }
  const g = await currentGaffer();
  await adminVoidGaffer(g.month);
  logger.info({ month: g.month, by: sess(req).playerId }, "Admin voided the Gaffer month");
  res.json({ ok: true });
});

export default router;
