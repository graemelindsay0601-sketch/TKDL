import { Router } from "express";
import { logger } from "../lib/logger";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { isFeatureAvailable } from "../services/feature-flags-service";
import { LADDER, KIND_INFO, MIN_MATCHES, monthKey, nextStep } from "../lib/league-target";
import { LEAGUE_TARGET_FLAG, adminVoidTarget, currentTarget, hitsByPlayer, monthStats, settleLeagueTargets, type TargetRow } from "../lib/league-target-db";

const router = Router();

const daysLeft = (now: Date) => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const y = Number(p.find(x => x.type === "year")!.value), m = Number(p.find(x => x.type === "month")!.value), d = Number(p.find(x => x.type === "day")!.value);
  return new Date(Date.UTC(y, m, 0)).getUTCDate() - d + 1; // including today
};

async function snapshot(playerId: number | null) {
  const now = new Date();
  const t = await currentTarget(now);
  const stats = await monthStats(t.month);
  const info = KIND_INFO[t.kind];
  const history = (await db.execute(sql`SELECT * FROM league_targets WHERE settled_at IS NOT NULL ORDER BY month DESC LIMIT 6`)).rows as TargetRow[];
  const live = await isFeatureAvailable(LEAGUE_TARGET_FLAG, false);
  let me = null;
  if (playerId) {
    const hits = (await hitsByPlayer([playerId])).get(playerId) ?? 0;
    const owned = new Set(((await db.execute(sql`SELECT cosmetic_id FROM player_cosmetics WHERE player_id = ${playerId} AND cosmetic_id LIKE '%-lt-%'`)).rows as any[]).map(r => r.cosmetic_id));
    const matches = stats.perPlayer.get(playerId) ?? 0;
    const next = nextStep(hits);
    me = { matches, qualifies: matches >= MIN_MATCHES, hits, next: next && { hits: next.hits, name: next.cosmetic.name, category: next.cosmetic.category },
      ladder: LADDER.map(s => ({ hits: s.hits, id: s.cosmetic.id, name: s.cosmetic.name, category: s.cosmetic.category, rarity: s.cosmetic.rarity, owned: owned.has(s.cosmetic.id) })) };
  }
  return {
    live, month: t.month, kind: t.kind, label: info.label, unit: info.unit, blurb: info.blurb, target: t.target, value: stats[t.kind],
    daysLeft: daysLeft(now), voided: !!t.voided, minMatches: MIN_MATCHES, sharing: [...stats.perPlayer.values()].filter(n => n >= MIN_MATCHES).length,
    history: history.filter(h => !live || h.live).map(h => ({ month: h.month, label: KIND_INFO[h.kind].label, target: h.target, value: h.final_value, hit: h.hit, live: h.live })),
    me,
  };
}

/** The Hub card. Players only see it once the flag is on; admins can preview it while it runs in the background. */
router.get("/league-target", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const s = req.session as any;
  if (!(await isFeatureAvailable(LEAGUE_TARGET_FLAG, s?.isAdmin === true))) { res.json({ available: false }); return; }
  try { res.json({ available: true, ...(await snapshot(s?.playerId ?? null)) }); }
  catch (err) { logger.error({ err }, "League Target snapshot failed"); res.status(500).json({ error: "League Target unavailable" }); }
});

/** Admin: the full background picture, whatever the flag says. */
router.get("/admin/league-target", async (req, res): Promise<void> => {
  if ((req.session as any)?.isAdmin !== true) { res.status(403).json({ error: "Admin only" }); return; }
  try {
  await settleLeagueTargets();
  const snap = await snapshot((req.session as any)?.playerId ?? null);
  const all = (await db.execute(sql`SELECT t.*, (SELECT COUNT(*)::int FROM league_target_shares s WHERE s.month = t.month) AS sharers
    FROM league_targets t ORDER BY month DESC LIMIT 12`)).rows;
  res.json({ ...snap, months: all, thisMonth: monthKey(new Date()) });
  } catch (err) { logger.error({ err }, "League Target admin view failed"); res.status(500).json({ error: "League Target unavailable" }); }
});

/** Months a player helped hit a League Target or a Gaffer challenge (live months only): pennants in their Clubhouse. */
router.get("/players/:id/challenge-honours", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const q = async (query: ReturnType<typeof sql>) => { try { return (await db.execute(query)).rows as any[]; } catch { return []; } };
  const rows = [
    ...(await q(sql`SELECT 'target' kind, t.month FROM league_target_shares s JOIN league_targets t ON t.month = s.month WHERE s.player_id = ${id} AND t.hit AND t.live`)),
    ...(await q(sql`SELECT 'gaffer' kind, month FROM gaffer_months WHERE gaffer_id = ${id} AND hit AND live`)),
    ...(await q(sql`SELECT 'squad' kind, g.month FROM gaffer_contributors c JOIN gaffer_months g ON g.month = c.month WHERE c.player_id = ${id} AND g.hit AND g.live AND g.gaffer_id IS DISTINCT FROM ${id}`)),
  ];
  res.json(rows.map(r => ({ kind: r.kind, month: r.month })).sort((a, b) => b.month.localeCompare(a.month)));
});

router.post("/admin/league-target/void", async (req, res): Promise<void> => {
  if ((req.session as any)?.isAdmin !== true) { res.status(403).json({ error: "Admin only" }); return; }
  const t = await currentTarget();
  await adminVoidTarget(t.month);
  logger.info({ month: t.month, by: (req.session as any)?.playerId }, "Admin voided the League Target month");
  res.json({ ok: true });
});

export default router;
