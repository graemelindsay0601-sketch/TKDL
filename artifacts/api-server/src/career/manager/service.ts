import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { MANAGERS, managerByKey, unmet, type ManagerFacts } from "./model.ts";

type Root = { id: string; current_season: number; current_week: number; has_tour_card?: boolean };

export type ManagerView = {
  season: number; careerPrizePence: number; tourCard: boolean;
  current: { key: string; name: string; kind: string; commission: number; signedSeason: number; signedWeek: number;
    commissionThisSeasonPence: number; commissionTotalPence: number; extraSigningBonusPence: number } | null;
  firms: { key: string; name: string; kind: string; blurb: string; commission: number; signingBonusBoost: number; appearanceBoost: number; extraOffers: number;
    available: boolean; unmet: string[]; leftThisSeason: boolean; current: boolean }[];
};

async function facts(tx: CareerExecutor, root: Root): Promise<ManagerFacts> {
  const prize = Number((await tx.execute(sql`SELECT COALESCE(SUM(amount_pence),0)::bigint AS n FROM career_finance_entries
    WHERE career_save_id=${root.id} AND category='PRIZE'`)).rows[0].n);
  return { careerPrizePence: prize, tourCard: root.has_tour_card === true };
}

/** Managers: who will sign you, who you have, and what they have taken and brought in. Sign one, or leave. */
export function createCareerManagerService(database: CareerDatabase) {
  async function view(tx: CareerExecutor, root: Root): Promise<ManagerView> {
    const season = Number(root.current_season);
    const f = await facts(tx, root);
    const contracts = (await tx.execute(sql`SELECT * FROM career_manager_contracts WHERE career_save_id=${root.id} ORDER BY created_at`)).rows;
    const active = contracts.find(c => c.status === "ACTIVE");
    const def = active ? managerByKey(String(active.manager_key)) : null;
    let current: ManagerView["current"] = null;
    if (active && def) {
      const money = (await tx.execute(sql`SELECT
          COALESCE(-SUM(amount_pence) FILTER (WHERE category='MANAGER_COMMISSION' AND season=${season}),0)::bigint AS season_cut,
          COALESCE(-SUM(amount_pence) FILTER (WHERE category='MANAGER_COMMISSION'),0)::bigint AS total_cut
        FROM career_finance_entries WHERE career_save_id=${root.id} AND detail->>'contractId'=${String(active.id)}`)).rows[0];
      // What they negotiated on signing bonuses (offers you accepted while they were your manager).
      const bonus = Number((await tx.execute(sql`SELECT COALESCE(SUM((terms->>'signingBonusPence')::bigint - (source->'managerPremium'->>'beforePence')::bigint),0)::bigint AS n
        FROM career_sponsor_offers WHERE career_save_id=${root.id} AND status='ACCEPTED' AND source->'managerPremium'->>'managerKey'=${def.key}
          AND (offered_season > ${Number(active.signed_season)} OR (offered_season=${Number(active.signed_season)} AND offered_week >= ${Number(active.signed_week)}))`)).rows[0].n);
      current = { key: def.key, name: def.name, kind: def.kind, commission: def.commission, signedSeason: Number(active.signed_season), signedWeek: Number(active.signed_week),
        commissionThisSeasonPence: Number(money.season_cut), commissionTotalPence: Number(money.total_cut), extraSigningBonusPence: bonus };
    }
    const leftThisSeason = new Set(contracts.filter(c => c.status === "ENDED" && Number(c.ended_season) === season).map(c => String(c.manager_key)));
    return { season, careerPrizePence: f.careerPrizePence, tourCard: f.tourCard, current,
      firms: MANAGERS.map(m => { const why = unmet(m, f); return { key: m.key, name: m.name, kind: m.kind, blurb: m.blurb, commission: m.commission,
        signingBonusBoost: m.signingBonusBoost, appearanceBoost: m.appearanceBoost, extraOffers: m.extraOffers,
        available: !why.length && !leftThisSeason.has(m.key) && current?.key !== m.key, unmet: why, leftThisSeason: leftThisSeason.has(m.key), current: current?.key === m.key }; }) };
  }

  async function end(tx: CareerExecutor, root: Root) {
    await tx.execute(sql`UPDATE career_manager_contracts SET status='ENDED', ended_season=${Number(root.current_season)}, ended_week=${Number(root.current_week)}
      WHERE career_save_id=${root.id} AND status='ACTIVE'`);
  }

  return {
    async read(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => view(tx, await lockRoot(tx, actor, saveId, false) as unknown as Root));
    },
    /** Sign a firm that will have you (replacing any manager you have). A firm you left this season will not take you back until next season. */
    async sign(actor: CareerActor, saveId: string, body: unknown) {
      const { managerKey } = z.object({ managerKey: z.string().min(1).max(40) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const before = await view(tx, root);
        const firm = before.firms.find(f => f.key === managerKey);
        if (!firm) throw new CareerError(404, "No such management firm");
        if (firm.current) return before;
        if (firm.unmet.length) throw new CareerError(409, `${firm.name} will not sign you yet: ${firm.unmet.join("; ")}`);
        if (firm.leftThisSeason) throw new CareerError(409, `You left ${firm.name} this season; they will talk again next season`);
        await end(tx, root);
        await tx.execute(sql`INSERT INTO career_manager_contracts (career_save_id,manager_key,status,signed_season,signed_week)
          VALUES (${root.id},${managerKey},'ACTIVE',${Number(root.current_season)},${Number(root.current_week)})`);
        return view(tx, root);
      });
    },
    /** Part company with your manager (free; their cut stops at once). */
    async leave(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        await end(tx, root);
        return view(tx, root);
      });
    },
  };
}
