import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { scopedRandom } from "../world/random.ts";
import { STREAM, activeStreamers, streamerFollowers } from "./model.ts";

/**
 * The DartCast Creator Awards, held at the end of every season. Eight categories, each judged on a real stat from your
 * season against the scene's creators (theirs drawn from their size and a little luck). Make the shortlist of five and
 * you're nominated; top it and you win: a trophy, followers and fans for your darts. Nobody else's wins cost you anything.
 */
export type AwardKey = "STREAMER" | "BREAKTHROUGH" | "CLIP" | "CHARITY" | "CUP_KING" | "COLLAB" | "COMMUNITY" | "ROOKIE";
export const AWARDS: { key: AwardKey; name: string; what: string; scale: number }[] = [
  { key: "STREAMER", name: "Streamer of the Year", what: "followers gained this season", scale: 1 },
  { key: "BREAKTHROUGH", name: "Breakthrough Creator", what: "growth this season compared with where you started", scale: 1 },
  { key: "CLIP", name: "Clip of the Year", what: "views on your best clip", scale: 1 },
  { key: "CHARITY", name: "Community Champion", what: "raised for charity", scale: 1 },
  { key: "CUP_KING", name: "Cup King", what: "Creator Cup wins and deep runs", scale: 1 },
  { key: "COLLAB", name: "Best Collab Partner", what: "collabs and raids with the scene", scale: 1 },
  { key: "COMMUNITY", name: "Best Community", what: "loyal regulars", scale: 1 },
  { key: "ROOKIE", name: "Rookie of the Year", what: "followers gained in your first season", scale: 1 },
];
export const AWARD_REWARD = Object.freeze({ followersShare: 0.04, minFollowers: 15, fans: 80, nomineeFollowers: 5 });

export type AwardResult = { key: AwardKey; name: string; winner: string; youNominated: boolean; youWon: boolean; yourScore: number; nominees: string[] };

/** Each creator's season in a category: a rough figure from their size, with season-to-season luck. */
function creatorScore(seed: string, season: number, key: AwardKey, creator: { key: string; followers: number; debut: number }) {
  const r = scopedRandom(seed, STREAM.version, "creator-awards", season, key, creator.key)();
  const f = creator.followers, luck = 0.5 + r;
  switch (key) {
    case "STREAMER": return Math.round(f * 0.12 * luck);
    case "BREAKTHROUGH": return Math.round(100 * 0.25 * luck * (f < 5000 ? 1.4 : 0.6));
    case "CLIP": return Math.round(Math.sqrt(f) * 60 * luck);
    case "CHARITY": return Math.round(f * 0.05 * luck);
    case "CUP_KING": return Math.round(r * 9);
    case "COLLAB": return Math.round(r * 10);
    case "COMMUNITY": return Math.round(Math.min(30, f / 1500) * luck);
    case "ROOKIE": return creator.debut === season ? Math.round(f * 0.4 * luck) : -1;
  }
}

export type YourSeason = Record<AwardKey, number>;

/** The season's results, judged against the scene. Deterministic per save and season. */
export function judgeAwards(seed: string, season: number, you: YourSeason, handle: string): AwardResult[] {
  const scene = activeStreamers(season).map(s => ({ key: s.key, handle: s.handle, debut: s.debut, followers: streamerFollowers(s.followers, season, 52) }));
  return AWARDS.map(a => {
    const field = scene.map(c => ({ name: c.handle, score: creatorScore(seed, season, a.key, c) })).filter(c => c.score >= 0);
    const yours = you[a.key];
    const all = [...field, ...(yours > 0 ? [{ name: handle, score: yours, you: true }] : [])].sort((x, y) => y.score - x.score || x.name.localeCompare(y.name));
    const nominees = all.slice(0, 5);
    const youNominated = nominees.some(n => "you" in n);
    return { key: a.key, name: a.name, winner: nominees[0]?.name ?? "—", youNominated, youWon: youNominated && "you" in nominees[0], yourScore: yours, nominees: nominees.map(n => n.name) };
  });
}

/** Your season in numbers, for the judges. */
export async function yourSeason(tx: CareerExecutor, saveId: string, season: number): Promise<YourSeason> {
  const n = async (q: ReturnType<typeof sql>) => Number((await tx.execute(q)).rows[0]?.n ?? 0);
  const gained = await n(sql`SELECT COALESCE(SUM(followers_gained),0)::int AS n FROM career_streams WHERE career_save_id=${saveId} AND season=${season} AND status='ENDED'`);
  const followers = await n(sql`SELECT followers AS n FROM career_stream_channels WHERE career_save_id=${saveId}`);
  const firstSeason = await n(sql`SELECT COALESCE(MIN(season), ${season})::int AS n FROM career_streams WHERE career_save_id=${saveId} AND status='ENDED'`);
  const start = Math.max(1, followers - gained);
  return {
    STREAMER: gained,
    BREAKTHROUGH: gained > 0 ? Math.round(gained / start * 100) : 0,
    CLIP: await n(sql`SELECT COALESCE(MAX(views),0)::int AS n FROM career_stream_clips WHERE career_save_id=${saveId} AND season=${season}`),
    CHARITY: await n(sql`SELECT COALESCE(SUM(COALESCE((tally->>'raisedPence')::int,0)),0)::int AS n FROM career_streams WHERE career_save_id=${saveId} AND season=${season} AND status='ENDED'`) / 100,
    CUP_KING: await n(sql`SELECT COALESCE(SUM(wins + CASE WHEN won THEN 3 ELSE 0 END),0)::int AS n FROM career_stream_cups WHERE career_save_id=${saveId} AND season=${season}`),
    COLLAB: await n(sql`SELECT (SELECT COUNT(*) FROM career_streams WHERE career_save_id=${saveId} AND season=${season} AND format='COLLAB' AND status='ENDED')
      + (SELECT COUNT(*) FROM career_stream_raids WHERE career_save_id=${saveId} AND season=${season})::int AS n`),
    COMMUNITY: await n(sql`SELECT COUNT(*)::int AS n FROM career_stream_regulars WHERE career_save_id=${saveId} AND status='ACTIVE' AND loyalty >= 60`),
    ROOKIE: firstSeason === season ? gained : 0,
  };
}

/** Hold the season's awards once (at the end of week 52): record them, and reward your wins and nominations. */
export async function holdAwards(tx: CareerExecutor, root: { id: string; world_seed: string }, season: number) {
  if ((await tx.execute(sql`SELECT 1 FROM career_stream_awards WHERE career_save_id=${root.id} AND season=${season} LIMIT 1`)).rows.length) return;
  const ch = (await tx.execute(sql`SELECT handle, followers FROM career_stream_channels WHERE career_save_id=${root.id}`)).rows[0];
  if (!ch) return;
  const streamed = (await tx.execute(sql`SELECT 1 FROM career_streams WHERE career_save_id=${root.id} AND season=${season} AND status='ENDED' LIMIT 1`)).rows.length > 0;
  if (!streamed) return;
  const results = judgeAwards(root.world_seed, season, await yourSeason(tx, root.id, season), String(ch.handle));
  let followers = 0;
  for (const r of results) {
    const f = r.youWon ? Math.max(AWARD_REWARD.minFollowers, Math.round(Number(ch.followers) * AWARD_REWARD.followersShare)) : r.youNominated ? AWARD_REWARD.nomineeFollowers : 0;
    followers += f;
    await tx.execute(sql`INSERT INTO career_stream_awards (career_save_id, season, award, name, winner, nominees, you_nominated, you_won, followers, fans)
      VALUES (${root.id}, ${season}, ${r.key}, ${r.name}, ${r.winner}, ${JSON.stringify(r.nominees)}::jsonb, ${r.youNominated}, ${r.youWon}, ${f}, ${r.youWon ? AWARD_REWARD.fans : 0})
      ON CONFLICT DO NOTHING`);
  }
  if (followers) await tx.execute(sql`UPDATE career_stream_channels SET followers = followers + ${followers}::int WHERE career_save_id=${root.id}`);
}
