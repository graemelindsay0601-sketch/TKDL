import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { generateKOBracket, generatePLBracket, advanceKOBracket, advancePLBracket, type KOBracket, type PLBracket } from "../lib/bracketEngine";
import { TROPHY_GAMERSCORE, TOUR_ACHIEVEMENT_DEFS } from "../lib/tourSeed";

const router = Router();

// ── Unlock logic ──────────────────────────────────────────────────────────────

const Q_SCHOOL_SLUGS = ["qschool_day1", "qschool_day2", "qschool_day3", "qschool_day4"];

async function getPlayerUnlockStatus(playerId: number) {
  const trophies = await db.execute(sql`
    SELECT td.slug, td.tier
    FROM tour_trophies tt
    JOIN tour_definitions td ON td.id = tt.tour_id
    WHERE tt.player_id = ${playerId}
  `);

  const wonByTier = new Map<number, Set<string>>();
  const wonSlugs = new Set<string>();

  for (const row of trophies.rows as { slug: string; tier: number }[]) {
    wonSlugs.add(row.slug);
    if (!wonByTier.has(row.tier)) wonByTier.set(row.tier, new Set());
    wonByTier.get(row.tier)!.add(row.slug);
  }

  const hasTourCard = Q_SCHOOL_SLUGS.some(s => wonSlugs.has(s));
  return { wonByTier, wonSlugs, hasTourCard };
}

function isTourUnlocked(tour: {
  unlock_type: string; unlock_value: string | null; tier: number;
}, status: Awaited<ReturnType<typeof getPlayerUnlockStatus>>): boolean {
  const { wonByTier, wonSlugs, hasTourCard } = status;
  switch (tour.unlock_type) {
    case "none":          return true;
    case "any_tier": {
      const tier = parseInt(tour.unlock_value ?? "1");
      return (wonByTier.get(tier)?.size ?? 0) > 0;
    }
    case "tier_count": {
      const [tierStr, countStr] = (tour.unlock_value ?? "1:1").split(":");
      const tier = parseInt(tierStr);
      const needed = parseInt(countStr);
      return (wonByTier.get(tier)?.size ?? 0) >= needed;
    }
    case "specific_tour": return wonSlugs.has(tour.unlock_value ?? "");
    case "any_of": {
      const slugs = (tour.unlock_value ?? "").split(",");
      return slugs.some(s => wonSlugs.has(s));
    }
    case "achievement":   return tour.unlock_value === "pdc_tour_card" ? hasTourCard : false;
    default:              return false;
  }
}

// ── Achievement checking ──────────────────────────────────────────────────────

async function checkAndAwardTourAchievements(playerId: number, tourSlug: string, difficulty: string) {
  const status = await getPlayerUnlockStatus(playerId);

  const toAward: string[] = [];

  const won = status.wonSlugs;
  const wonByTier = status.wonByTier;
  const hasTourCard = status.hasTourCard;

  // Career
  if (won.size === 1) toAward.push("first_blood");
  if ((wonByTier.get(2)?.size ?? 0) >= 1) toAward.push("county_bound");
  if ((wonByTier.get(3)?.size ?? 0) >= 1) toAward.push("regional_player");
  if (hasTourCard) toAward.push("tour_card_holder");
  if ((wonByTier.get(5)?.size ?? 0) >= 1) toAward.push("on_the_circuit");
  if (won.has("pdc_world_championship")) toAward.push("world_champion");
  if (won.has("modus_ss_finals")) toAward.push("modus_champion");

  const modusSlugs = ["modus_ss_leg1", "modus_ss_leg2", "modus_ss_leg3"];
  if (modusSlugs.every(s => won.has(s))) toAward.push("modus_sweep");
  if (Q_SCHOOL_SLUGS.every(s => won.has(s))) toAward.push("qschool_legend");

  // Format explorer
  const cricketSlugs = ["pub_cricket_night", "county_cricket_open", "national_cricket_champ"];
  if (cricketSlugs.some(s => won.has(s))) toAward.push("cricket_ace");
  if (won.has("cutthroat_championship")) toAward.push("cutthroat_tactician");
  const tacticsSlugs = ["tactics_night", "tactics_trophy"];
  if (tacticsSlugs.some(s => won.has(s))) toAward.push("mickey_mouse_master");
  const longSlugs = ["amateur_1001", "national_1001", "marathon_2001"];
  if (longSlugs.some(s => won.has(s))) toAward.push("marathon_runner");
  const didoSlugs = ["county_classic_dido", "modus_ss_leg3", "grand_prix", "world_grand_prix"];
  if (didoSlugs.some(s => won.has(s))) toAward.push("dido_devotee");
  const masterOutSlugs = ["modus_masters", "grand_slam"];
  if (masterOutSlugs.some(s => won.has(s))) toAward.push("master_finish");
  if (won.has("treble_out_masters")) toAward.push("treble_trouble");
  const golfSlugs = ["golf_night_9", "golf_classic_18"];
  if (golfSlugs.some(s => won.has(s))) toAward.push("golf_pro");
  if (won.has("three_in_bed_classic")) toAward.push("three_in_bed_winner");
  if (won.has("chase_dragon_open")) toAward.push("dragon_slayer");

  const tier1Slugs = ["friday_night_501","pub_doubles_night","sunday_league","pub_cricket_night","count_up_challenge","halve_it_night","killer_league","football_darts_cup","golf_night_9","sudden_death_friday","tactics_night","gotcha_cup"];
  const wonTier1Count = tier1Slugs.filter(s => won.has(s)).length;
  if (wonTier1Count >= 5) toAward.push("pub_legend");
  if (wonTier1Count === 12) toAward.push("tier1_sweep");

  const tier2Slugs = ["county_501_open","county_championship","county_classic_dido","county_cricket_open","cutthroat_championship","tactics_trophy","701_county_open","301_county_sprint","amateur_1001","national_halve_it","shanghai_showdown","bobs_27_open","scram_cup","baseball_open","fives_championship"];
  if (tier2Slugs.every(s => won.has(s))) toAward.push("tier2_sweep");

  // Count format categories won
  const formatCategories = [
    ["friday_night_501","pub_doubles_night","sunday_league","county_501_open","county_championship","county_classic_dido","modus_ss_leg1","modus_ss_leg2","modus_ss_leg3","modus_ss_finals","challenge_tour_open","players_championship","european_tour","uk_open","world_series_of_darts","grand_prix","world_matchplay","grand_slam","world_grand_prix","pdc_premier_league","pdc_world_championship"],
    ["pub_cricket_night","county_cricket_open","cutthroat_championship","national_cricket_champ"],
    ["amateur_1001","national_1001","marathon_2001"],
    ["halve_it_night","national_halve_it"],
    ["count_up_challenge"],
    ["tactics_night","tactics_trophy"],
    ["killer_league"],
    ["golf_night_9","golf_classic_18"],
  ];
  const categoriesWon = formatCategories.filter(cat => cat.some(s => won.has(s))).length;
  if (categoriesWon >= 5) toAward.push("all_rounder");
  if (categoriesWon >= 8) toAward.push("format_explorer");
  const setsFormatSlugs = ["world_grand_prix", "pdc_world_championship"];
  if (setsFormatSlugs.some(s => won.has(s))) toAward.push("sets_format_winner");

  // Difficulty
  const trophyRows = (await db.execute(sql`
    SELECT difficulty FROM tour_trophies WHERE player_id = ${playerId}
  `)).rows as { difficulty: string }[];
  const difficulties = new Set(trophyRows.map(r => r.difficulty));
  if (difficulties.has("amateur")) toAward.push("amateur_graduate");
  if (difficulties.has("club")) toAward.push("club_standard");
  if (difficulties.has("county")) toAward.push("county_class");
  if (difficulties.has("pro")) toAward.push("pro_standard");
  if (difficulties.has("elite")) toAward.push("elite_status");

  // Check difficulty king (same tour won at all 5 difficulties)
  const diffKingCheck = await db.execute(sql`
    SELECT td.slug, COUNT(DISTINCT tt.difficulty) as dc
    FROM tour_trophies tt
    JOIN tour_definitions td ON td.id = tt.tour_id
    WHERE tt.player_id = ${playerId}
    GROUP BY td.slug
    HAVING COUNT(DISTINCT tt.difficulty) >= 5
  `);
  if ((diffKingCheck.rows as any[]).length > 0) toAward.push("difficulty_king");

  // Elite world champ
  const eliteWCCheck = await db.execute(sql`
    SELECT 1 FROM tour_trophies tt
    JOIN tour_definitions td ON td.id = tt.tour_id
    WHERE tt.player_id = ${playerId} AND td.slug = 'pdc_world_championship' AND tt.difficulty = 'elite'
  `);
  if ((eliteWCCheck.rows as any[]).length > 0) toAward.push("elite_world_champ");

  // Specific
  if (won.has("grand_prix")) toAward.push("grand_prix_winner");
  if (won.has("world_matchplay")) toAward.push("matchplay_winner");
  if (won.has("uk_open")) toAward.push("uk_open_winner");
  if (won.has("grand_slam")) toAward.push("grand_slam_winner");
  if (won.has("world_grand_prix")) toAward.push("world_grand_prix_winner");
  if (won.has("pdc_premier_league") || won.has("regional_pl")) toAward.push("premier_league_winner");
  if (won.has("world_series_of_darts")) toAward.push("world_series_winner");

  // Award any that aren't already awarded
  const existing = (await db.execute(sql`
    SELECT achievement_key FROM player_tour_achievements WHERE player_id = ${playerId}
  `)).rows as { achievement_key: string }[];
  const existingKeys = new Set(existing.map(r => r.achievement_key));

  for (const key of [...new Set(toAward)]) {
    if (!existingKeys.has(key)) {
      await db.execute(sql`
        INSERT INTO player_tour_achievements (player_id, achievement_key)
        VALUES (${playerId}, ${key})
        ON CONFLICT DO NOTHING
      `).catch(() => {});
    }
  }
}

// ── GET /api/tour/definitions ─────────────────────────────────────────────────

router.get("/tour/definitions", async (req, res): Promise<void> => {
  try {
    const playerId = req.query.playerId ? parseInt(req.query.playerId as string, 10) : null;

    const tours = (await db.execute(sql`
      SELECT * FROM tour_definitions ORDER BY sort_order
    `)).rows as any[];

    if (!playerId) {
      res.json(tours.map(t => ({ ...t, unlocked: t.unlock_type === "none", activeRunId: null, won: false })));
      return;
    }

    const [status, runs, trophies] = await Promise.all([
      getPlayerUnlockStatus(playerId),
      db.execute(sql`
        SELECT ptr.id, ptr.tour_id, ptr.difficulty, ptr.status, ptr.updated_at
        FROM player_tour_runs ptr
        WHERE ptr.player_id = ${playerId}
        ORDER BY ptr.updated_at DESC
      `),
      db.execute(sql`
        SELECT tour_id, difficulty FROM tour_trophies WHERE player_id = ${playerId}
      `),
    ]);

    const activeRuns = new Map<number, number>(); // tour_id → run_id
    for (const run of runs.rows as { id: number; tour_id: number; difficulty: string; status: string }[]) {
      if (run.status === "active" && !activeRuns.has(run.tour_id)) {
        activeRuns.set(run.tour_id, run.id);
      }
    }

    const wonSet = new Set<string>();
    for (const t of trophies.rows as { tour_id: number; difficulty: string }[]) {
      wonSet.add(`${t.tour_id}:${t.difficulty}`);
    }

    res.json(tours.map(t => ({
      ...t,
      unlocked: isTourUnlocked(t, status),
      activeRunId: activeRuns.get(t.id) ?? null,
      wonDifficulties: (trophies.rows as any[]).filter(tr => tr.tour_id === t.id).map(tr => tr.difficulty),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get tour definitions");
    res.status(500).json({ error: "Failed to get tour definitions" });
  }
});

// ── GET /api/tour/runs/:playerId ──────────────────────────────────────────────

router.get("/tour/runs/:playerId", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    const rows = (await db.execute(sql`
      SELECT ptr.*, td.name as tour_name, td.emoji, td.tier, td.game_type_key, td.format, td.slug
      FROM player_tour_runs ptr
      JOIN tour_definitions td ON td.id = ptr.tour_id
      WHERE ptr.player_id = ${playerId}
      ORDER BY ptr.updated_at DESC
    `)).rows;
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get tour runs");
    res.status(500).json({ error: "Failed to get tour runs" });
  }
});

// ── GET /api/tour/runs/run/:runId ─────────────────────────────────────────────

router.get("/tour/runs/run/:runId", async (req, res): Promise<void> => {
  try {
    const runId = parseInt(req.params.runId, 10);
    const rows = (await db.execute(sql`
      SELECT ptr.*, td.name as tour_name, td.emoji, td.tier, td.game_type_key, td.format, td.slug, td.legs_per_match, td.sets_per_match, td.legs_per_set
      FROM player_tour_runs ptr
      JOIN tour_definitions td ON td.id = ptr.tour_id
      WHERE ptr.id = ${runId}
    `)).rows;
    if (rows.length === 0) { res.status(404).json({ error: "Run not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to get run");
    res.status(500).json({ error: "Failed to get run" });
  }
});

// ── POST /api/tour/runs — start a new run ─────────────────────────────────────

const StartRunBody = z.object({
  playerId:   z.number().int().positive(),
  tourSlug:   z.string(),
  difficulty: z.enum(["amateur", "club", "county", "pro", "elite"]),
  playerName: z.string(),
});

router.post("/tour/runs", async (req, res): Promise<void> => {
  try {
    const body = StartRunBody.parse(req.body);
    const { playerId, tourSlug, difficulty, playerName } = body;

    // Resolve tour
    const tourRows = (await db.execute(sql`
      SELECT * FROM tour_definitions WHERE slug = ${tourSlug}
    `)).rows as any[];
    if (tourRows.length === 0) { res.status(404).json({ error: "Tour not found" }); return; }
    const tour = tourRows[0];

    // Check unlock
    const status = await getPlayerUnlockStatus(playerId);
    if (!isTourUnlocked(tour, status)) {
      res.status(403).json({ error: "Tour is locked" });
      return;
    }

    // Abandon any existing active run for this tour+player
    await db.execute(sql`
      UPDATE player_tour_runs SET status = 'abandoned'
      WHERE player_id = ${playerId} AND tour_id = ${tour.id} AND status = 'active'
    `);

    // Generate bracket
    let bracket;
    if (tour.format === "premier_league") {
      bracket = generatePLBracket(playerName, difficulty, tour.legs_per_match);
    } else {
      bracket = generateKOBracket(
        playerName, difficulty,
        tour.bracket_size as 8 | 16,
        tour.legs_per_match,
        tour.sets_per_match ?? null,
        tour.legs_per_set ?? null,
      );
    }

    const inserted = (await db.execute(sql`
      INSERT INTO player_tour_runs (player_id, tour_id, difficulty, bracket, status)
      VALUES (${playerId}, ${tour.id}, ${difficulty}, ${JSON.stringify(bracket)}::jsonb, 'active')
      RETURNING id
    `)).rows[0] as { id: number };

    res.json({ runId: inserted.id, bracket });
  } catch (err) {
    req.log.error({ err }, "Failed to start tour run");
    res.status(500).json({ error: "Failed to start tour run" });
  }
});

// ── PATCH /api/tour/runs/:runId — advance bracket after match ─────────────────

const AdvanceRunBody = z.object({
  playerId:   z.number().int().positive(),
  playerWon:  z.boolean(),
});

router.patch("/tour/runs/:runId", async (req, res): Promise<void> => {
  try {
    const runId = parseInt(req.params.runId, 10);
    const body = AdvanceRunBody.parse(req.body);
    const { playerId, playerWon } = body;

    const runRows = (await db.execute(sql`
      SELECT ptr.*, td.slug, td.tier, td.legs_per_match, td.sets_per_match, td.legs_per_set, td.name as tour_name, td.id as tour_id_num
      FROM player_tour_runs ptr
      JOIN tour_definitions td ON td.id = ptr.tour_id
      WHERE ptr.id = ${runId} AND ptr.player_id = ${playerId}
    `)).rows as any[];
    if (runRows.length === 0) { res.status(404).json({ error: "Run not found" }); return; }
    const run = runRows[0];
    if (run.status !== "active") { res.status(400).json({ error: "Run is not active" }); return; }

    const bracket = run.bracket as any;
    let result: { bracket: any; won: boolean; eliminated: boolean };

    if (bracket.format === "premier_league") {
      result = advancePLBracket(bracket as PLBracket, playerWon);
    } else {
      result = advanceKOBracket(bracket as KOBracket, playerWon);
    }

    // Check if Q-School — award tour card achievement
    if (result.won && Q_SCHOOL_SLUGS.includes(run.slug)) {
      await db.execute(sql`
        INSERT INTO player_tour_achievements (player_id, achievement_key)
        VALUES (${playerId}, 'tour_card_holder')
        ON CONFLICT DO NOTHING
      `).catch(() => {});
    }

    // Check Q-School survivor (reached final = last 2)
    if (!result.won && !result.eliminated && bracket.format === "knockout") {
      const ko = result.bracket as KOBracket;
      if (Q_SCHOOL_SLUGS.includes(run.slug) && ko.currentRound === ko.rounds.length) {
        await db.execute(sql`
          INSERT INTO player_tour_achievements (player_id, achievement_key)
          VALUES (${playerId}, 'q_school_survivor')
          ON CONFLICT DO NOTHING
        `).catch(() => {});
      }
    }

    const newStatus = result.won ? "completed" : result.eliminated ? "eliminated" : "active";

    await db.execute(sql`
      UPDATE player_tour_runs
      SET bracket = ${JSON.stringify(result.bracket)}::jsonb, status = ${newStatus}, updated_at = NOW()
      WHERE id = ${runId}
    `);

    // Award trophy if won
    if (result.won) {
      const gsValue = TROPHY_GAMERSCORE[run.difficulty] ?? 25;
      await db.execute(sql`
        INSERT INTO tour_trophies (player_id, tour_id, difficulty, gamerscore)
        VALUES (${playerId}, ${run.tour_id}, ${run.difficulty}, ${gsValue})
        ON CONFLICT (player_id, tour_id, difficulty) DO NOTHING
      `);

      // Award per-tour-difficulty achievement
      const trophyAchKey = `tour_win_${run.slug}_${run.difficulty}`;
      await db.execute(sql`
        INSERT INTO player_tour_achievements (player_id, achievement_key)
        VALUES (${playerId}, ${trophyAchKey})
        ON CONFLICT DO NOTHING
      `).catch(() => {});

      // Check broader achievements after awarding trophy
      await checkAndAwardTourAchievements(playerId, run.slug, run.difficulty).catch(() => {});

      // Fire-and-forget: Award tour round completion coins + update challenges
      void (async () => {
        try {
          const { addCoinsToPlayer } = await import("../services/card-shop-service");
          const { challengeManager } = await import("../services/challenge-manager");
          
          // Award 10 coins per win
          if (playerWon) {
            await addCoinsToPlayer(playerId, 10);
          }
          
          // Update challenges for each match/round result
          await challengeManager.updateProgressFromGameResult(playerId, {
            gameMode: "TOUR",
            won: playerWon,
          });
        } catch (err) {
          console.error("Tour coin/challenge award error:", err);
        }
      })();
    }

    res.json({ bracket: result.bracket, won: result.won, eliminated: result.eliminated, status: newStatus });
  } catch (err) {
    req.log.error({ err }, "Failed to advance tour run");
    res.status(500).json({ error: "Failed to advance tour run" });
  }
});

// ── GET /api/tour/trophies/:playerId ─────────────────────────────────────────

router.get("/tour/trophies/:playerId", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    const rows = (await db.execute(sql`
      SELECT tt.*, td.name as tour_name, td.emoji, td.tier, td.slug
      FROM tour_trophies tt
      JOIN tour_definitions td ON td.id = tt.tour_id
      WHERE tt.player_id = ${playerId}
      ORDER BY td.tier, td.sort_order, tt.difficulty
    `)).rows;
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get trophies");
    res.status(500).json({ error: "Failed to get trophies" });
  }
});

// ── GET /api/tour/achievements/:playerId ──────────────────────────────────────

router.get("/tour/achievements/:playerId", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    const unlocked = (await db.execute(sql`
      SELECT achievement_key, awarded_at FROM player_tour_achievements WHERE player_id = ${playerId}
    `)).rows as { achievement_key: string; awarded_at: string }[];
    const unlockedKeys = new Set(unlocked.map(r => r.achievement_key));
    const all = (await db.execute(sql`SELECT * FROM tour_achievement_definitions ORDER BY category, gamerscore`)).rows as any[];

    res.json(all.map(def => ({
      ...def,
      unlocked: unlockedKeys.has(def.key),
      awardedAt: unlocked.find(u => u.achievement_key === def.key)?.awarded_at ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get tour achievements");
    res.status(500).json({ error: "Failed to get tour achievements" });
  }
});

// ── GET /api/tour/summary ─────────────────────────────────────────────────────

router.get("/tour/summary", async (req, res): Promise<void> => {
  try {
    const [trophyRow, runRows] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS count FROM tour_trophies`),
      db.execute(sql`SELECT status, COUNT(*)::int AS count FROM player_tour_runs GROUP BY status`),
    ]);
    const totalTrophies = Number((trophyRow.rows[0] as any)?.count ?? 0);
    const runMap: Record<string, number> = {};
    for (const r of runRows.rows as any[]) runMap[r.status] = Number(r.count);
    res.json({
      totalTrophies,
      activeRuns: runMap["active"] ?? 0,
      completedRuns: runMap["completed"] ?? 0,
      eliminatedRuns: runMap["eliminated"] ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get tour summary");
    res.status(500).json({ error: "Failed to get tour summary" });
  }
});

// ── GET /api/tour/all-trophies ────────────────────────────────────────────────

router.get("/tour/all-trophies", async (req, res): Promise<void> => {
  try {
    const rows = (await db.execute(sql`
      SELECT tt.id, tt.player_id, tt.tour_id, tt.difficulty, tt.awarded_at,
             p.name  AS player_name,
             td.name AS tour_name, td.tier, td.emoji, td.slug
      FROM tour_trophies tt
      JOIN players p         ON p.id  = tt.player_id
      JOIN tour_definitions td ON td.id = tt.tour_id
      ORDER BY tt.awarded_at DESC
    `)).rows;
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get all trophies");
    res.status(500).json({ error: "Failed to get all trophies" });
  }
});

// ── DELETE /api/tour/runs/:runId — admin delete a single tour run ────────────

router.delete("/tour/runs/:runId", async (req, res): Promise<void> => {
  try {
    const runId = parseInt(req.params.runId, 10);
    if (isNaN(runId)) { res.status(400).json({ error: "Invalid run id" }); return; }
    const result = await db.execute(sql`DELETE FROM player_tour_runs WHERE id = ${runId} RETURNING id`);
    if (result.rows.length === 0) { res.status(404).json({ error: "Run not found" }); return; }
    res.json({ deleted: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete tour run");
    res.status(500).json({ error: "Failed to delete tour run" });
  }
});

// ── DELETE /api/tour/trophies/:trophyId — admin delete a single trophy ────────

router.delete("/tour/trophies/:trophyId", async (req, res): Promise<void> => {
  try {
    const trophyId = parseInt(req.params.trophyId, 10);
    if (isNaN(trophyId)) { res.status(400).json({ error: "Invalid trophy id" }); return; }
    const result = await db.execute(sql`DELETE FROM tour_trophies WHERE id = ${trophyId} RETURNING id`);
    if (result.rows.length === 0) { res.status(404).json({ error: "Trophy not found" }); return; }
    res.json({ deleted: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete trophy");
    res.status(500).json({ error: "Failed to delete trophy" });
  }
});

// ── DELETE /api/tour/player/:playerId — admin wipe all tour data for a player ──

router.delete("/tour/player/:playerId", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player id" }); return; }

    const [trophies, achievements, runs] = await Promise.all([
      db.execute(sql`DELETE FROM tour_trophies WHERE player_id = ${playerId} RETURNING id`),
      db.execute(sql`DELETE FROM player_tour_achievements WHERE player_id = ${playerId} RETURNING id`),
      db.execute(sql`DELETE FROM player_tour_runs WHERE player_id = ${playerId} RETURNING id`),
    ]);

    res.json({
      trophiesDeleted:      trophies.rows.length,
      achievementsDeleted:  achievements.rows.length,
      runsDeleted:          runs.rows.length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to delete player tour data");
    res.status(500).json({ error: "Failed to delete player tour data" });
  }
});

// ── GET /api/tour/achievement-definitions ─────────────────────────────────────

router.get("/tour/achievement-definitions", async (req, res): Promise<void> => {
  try {
    const rows = (await db.execute(sql`
      SELECT tad.*,
             COUNT(pta.id)::int AS unlocked_count
      FROM tour_achievement_definitions tad
      LEFT JOIN player_tour_achievements pta ON pta.achievement_key = tad.key
      GROUP BY tad.id
      ORDER BY tad.category, tad.gamerscore DESC
    `)).rows;
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get tour achievement definitions");
    res.status(500).json({ error: "Failed to get tour achievement definitions" });
  }
});

export default router;

