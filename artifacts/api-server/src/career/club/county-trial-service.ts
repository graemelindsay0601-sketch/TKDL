import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { loadNpcs } from "../world/repository.ts";
import { createPerformance } from "../world/performance.ts";
import { toCareerBotConfig } from "../world/bot-adapter.ts";
import { scopedRandom, stableUuid } from "../world/random.ts";
import { SIMULATION_VERSION } from "../world/config.ts";
import { LOCALITIES, localityByRegion } from "../calendar/geography.ts";
import { replay, type X01Format } from "../../shared/darts-rules/x01.ts";
import { ensureCountyTrialInvitation, type CountyTrialView } from "./county-trials.ts";
import type { CountyCategory } from "./county-squads.ts";

type Root = { id: string; world_seed: string; world_generation_version: number | string; difficulty: string;
  current_season: number | string; current_week: number | string };
type Bot = { avg: number; sd: number; checkoutPct: number; hitAcc: number };
type TrialRow = Record<string, unknown> & { status: string; darts: unknown[] };
export type CountyTrialSession = {
  id: string; status: "LIVE" | "PLAYED"; season: number; category: CountyCategory; you: string;
  opponent: { name: string; bot: { config: Bot; seed: string } };
  format: X01Format; firstThrower: 0; darts: unknown[]; won: boolean | null;
};
const FORMAT: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: 5 };
const BOT_CONTEXT = { category: "floor" as const, roundImportance: 0.65, elimination: false };

export function createCareerCountyTrialService(database: CareerDatabase) {
  async function trialForMatch(tx: CareerExecutor, root: Root, matchId: string): Promise<TrialRow> {
    const row = (await tx.execute(sql`SELECT * FROM career_county_trials
      WHERE career_save_id=${root.id} AND match_id=${matchId}`)).rows[0] as TrialRow | undefined;
    if (!row) throw new CareerError(404, "County trial not found");
    return row;
  }
  async function sessionFor(tx: CareerExecutor, root: Root, row: TrialRow): Promise<CountyTrialSession> {
    const player = (await tx.execute(sql`SELECT COALESCE(p.display_name,s.career_name,'You') AS name FROM career_saves s
      LEFT JOIN career_profiles p ON p.career_save_id=s.id WHERE s.id=${root.id}`)).rows[0];
    const category = row.category === "WOMEN" ? "WOMEN" : "MEN";
    return { id: String(row.match_id), status: row.status === "LIVE" ? "LIVE" : "PLAYED", season: Number(row.season), category,
      you: String(player?.name ?? "You"),
      opponent: { name: String(row.opponent_name ?? "County reserve"), bot: { config: row.bot as Bot, seed: String(row.seed) } },
      format: FORMAT, firstThrower: 0, darts: Array.isArray(row.darts) ? row.darts : [],
      won: row.status === "WON" || row.status === "LOST" ? row.won === true : null };
  }
  return {
    async read(actor: CareerActor, saveId: string): Promise<CountyTrialView> {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        return ensureCountyTrialInvitation(tx, root.id, Number(root.current_season));
      });
    },
    async start(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const invitation = await ensureCountyTrialInvitation(tx, root.id, Number(root.current_season));
        const existing = (await tx.execute(sql`SELECT * FROM career_county_trials
          WHERE career_save_id=${root.id} AND season=${Number(root.current_season)}`)).rows[0] as TrialRow | undefined;
        if (existing?.status === "LIVE") return sessionFor(tx, root, existing);
        if (invitation.status !== "INVITED" || !existing) throw new CareerError(409, "There is no available county trial invitation");
        const eligibility = (await tx.execute(sql`SELECT category FROM career_county_eligibility WHERE career_save_id=${root.id}`)).rows[0];
        const category: CountyCategory | null = eligibility?.category === "MEN" || eligibility?.category === "WOMEN" ? eligibility.category : null;
        if (!category) throw new CareerError(409, "Choose your county squad category before starting the trial");
        const profile = (await tx.execute(sql`SELECT home_locality FROM career_profiles WHERE career_save_id=${root.id}`)).rows[0];
        const home = LOCALITIES.find(l => l.key === String(profile?.home_locality ?? ""));
        if (!home) throw new CareerError(409, "A home county is required for a county trial");
        const npcs = await loadNpcs(tx, root.id, { activeOnly: true, nationality: home.country });
        const candidates = npcs.filter(n => localityByRegion(n.homeRegion)?.key === home.key &&
          (category === "WOMEN" ? n.worldKey.startsWith("women:") : !n.worldKey.startsWith("women:")))
          .sort((a, b) => (a.ability.scoring + a.ability.finishing) - (b.ability.scoring + b.ability.finishing) || a.id.localeCompare(b.id));
        const opponent = candidates[0];
        if (!opponent) throw new CareerError(409, "No active county trial opponent is available in your category");
        const matchId = stableUuid(root.world_seed, SIMULATION_VERSION, "county-trial", root.id, Number(root.current_season));
        const seed = stableUuid(root.world_seed, SIMULATION_VERSION, "county-trial-bot", root.id, Number(root.current_season));
        const bot = toCareerBotConfig(createPerformance(opponent, BOT_CONTEXT, root.difficulty as never,
          scopedRandom(root.world_seed, Number(root.world_generation_version), "performance", SIMULATION_VERSION, "county-trial", opponent.id, Number(root.current_season))));
        const opponentName = `County reserve · ${opponent.firstName} ${opponent.surname}`;
        await tx.execute(sql`UPDATE career_county_trials SET status='LIVE',category=${category},match_id=${matchId}::uuid,
          opponent_key=${opponent.id}::uuid,opponent_name=${opponentName},bot=${JSON.stringify({avg:bot.avg,sd:bot.sd,checkoutPct:bot.checkoutPct,hitAcc:bot.hitAcc})}::jsonb,
          seed=${seed},darts='[]'::jsonb
          WHERE career_save_id=${root.id} AND season=${Number(root.current_season)} AND status='INVITED'`);
        const live = await trialForMatch(tx, root, matchId);
        return sessionFor(tx, root, live);
      });
    },
    async session(actor: CareerActor, saveId: string, matchId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        return sessionFor(tx, root, await trialForMatch(tx, root, matchId));
      });
    },
    async darts(actor: CareerActor, saveId: string, matchId: string, body: unknown) {
      const { darts } = z.object({ darts: z.array(z.unknown()).max(400) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const row = await trialForMatch(tx, root, matchId);
        if (row.status === "LIVE") {
          let state;
          try { state = replay(FORMAT, 0, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
          const won = state.complete ? state.winner === 0 : null;
          await tx.execute(sql`UPDATE career_county_trials SET darts=${JSON.stringify(darts)}::jsonb,
            status=${state.complete ? won ? "WON" : "LOST" : "LIVE"}, won=${won},
            completed_at=${state.complete ? sql`NOW()` : null}
            WHERE career_save_id=${root.id} AND season=${Number(row.season)} AND status='LIVE'`);
        }
        return sessionFor(tx, root, await trialForMatch(tx, root, matchId));
      });
    },
  };
}
