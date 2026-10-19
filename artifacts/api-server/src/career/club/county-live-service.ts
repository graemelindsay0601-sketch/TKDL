import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { replay, type X01Format } from "../../shared/darts-rules/x01.ts";
import { stableUuid } from "../world/random.ts";

type Config = { avg: number; sd: number; checkoutPct: number; hitAcc: number };
type HumanRubber = { id: string; status: "LIVE" | "PLAYED"; homeSide: boolean; opponentName: string; bot: Config; seed: string;
  bestOf: number; darts: unknown[]; won?: boolean };
type MatchSummary = Record<string, unknown> & { homeSets: number; awaySets: number; homeLegs: number; awayLegs: number; humanMatch?: HumanRubber };
type Fixture = Record<string, unknown> & { status: string; matches: MatchSummary[]; season: number; round: number; week: number; home_key: string; away_key: string };
type Root = { id: string; world_seed: string };
export type CountySession = { id: string; status: "LIVE" | "PLAYED"; you: string; opponent: { name: string; bot: { config: Config; seed: string } };
  format: X01Format; firstThrower: 0; darts: unknown[]; won: boolean | null };

export function createCareerCountyLiveService(database: CareerDatabase) {
  const format = (m: HumanRubber): X01Format => ({ startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: m.bestOf });
  async function fixtureFor(tx: CareerExecutor, root: Root, matchId: string): Promise<Fixture> {
    const rows = (await tx.execute(sql`SELECT * FROM career_county_fixtures WHERE career_save_id=${root.id} AND status IN ('IN_PROGRESS','COMPLETED')`)).rows;
    for (const row of rows) {
      const fixture = row as unknown as Fixture;
      if (fixture.matches?.some(m => m.humanMatch?.id === matchId)) return fixture;
    }
    throw new CareerError(404, "County match not found");
  }
  async function sessionFor(tx: CareerExecutor, root: Root, fixture: Fixture, matchId: string): Promise<CountySession> {
    const m = fixture.matches.find(x => x.humanMatch?.id === matchId)?.humanMatch;
    if (!m) throw new CareerError(404, "County match not found");
    const nameRow = (await tx.execute(sql`SELECT COALESCE(p.display_name,s.career_name,'You') AS name FROM career_saves s
      LEFT JOIN career_profiles p ON p.career_save_id=s.id WHERE s.id=${root.id}`)).rows[0];
    return { id: m.id, status: m.status, you: String(nameRow?.name ?? "You"),
      opponent: { name: m.opponentName, bot: { config: m.bot, seed: m.seed } }, format: format(m), firstThrower: 0,
      darts: m.darts, won: m.status === "PLAYED" ? !!m.won : null };
  }
  return {
    async read(actor: CareerActor, saveId: string, matchId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        const fixture = await fixtureFor(tx, root, matchId);
        return sessionFor(tx, root, fixture, matchId);
      });
    },
    async darts(actor: CareerActor, saveId: string, matchId: string, body: unknown) {
      const { darts } = z.object({ darts: z.array(z.unknown()).max(400) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const fixture = await fixtureFor(tx, root, matchId);
        const stateMatch = fixture.matches.find(m => m.humanMatch?.id === matchId)!;
        const m = stateMatch.humanMatch!;
        if (m.status === "LIVE") {
          let state;
          try { state = replay(format(m), 0, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
          m.darts = darts;
          if (state.complete) {
            m.status = "PLAYED"; m.won = state.winner === 0;
            if (m.homeSide) { stateMatch.homeSets += m.won ? 1 : 0; stateMatch.awaySets += m.won ? 0 : 1; }
            else { stateMatch.awaySets += m.won ? 1 : 0; stateMatch.homeSets += m.won ? 0 : 1; }
            stateMatch.homeLegs += state.totalLegs[0]; stateMatch.awayLegs += state.totalLegs[1];
            stateMatch.youWon = m.won;
          }
          const remaining = fixture.matches.some(x => x.humanMatch?.status === "LIVE");
          await tx.execute(sql`UPDATE career_county_fixtures SET matches=${JSON.stringify(fixture.matches)}::jsonb,
            status=${remaining ? "IN_PROGRESS" : "COMPLETED"}
            WHERE career_save_id=${root.id} AND season=${fixture.season} AND round=${fixture.round} AND home_key=${fixture.home_key}`);
        }
        const updated = await fixtureFor(tx, root, matchId);
        return sessionFor(tx, root, updated, matchId);
      });
    },
  };
}
