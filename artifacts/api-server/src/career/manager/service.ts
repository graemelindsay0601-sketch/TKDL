import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { MANAGERS, REACH_LABEL, managerByKey, unmet, type ManagerFacts } from "./model.ts";

type Root = { id: string; current_season: number; current_week: number; has_tour_card?: boolean };

export type ManagerView = {
  season: number; careerPrizePence: number; tourCard: boolean;
  current: { key: string; name: string; kind: string; commission: number; signedSeason: number; signedWeek: number; doors: string[] } | null;
  /** What every manager you have had brought in, and what they took for it (owed for as long as those deals and events run). */
  earned: { fromDealsPence: number; fromInvitationsPence: number; thisSeasonPence: number; totalPence: number; extraSigningBonusPence: number;
    deals: { sponsor: string; managerName: string; active: boolean }[];
    invitations: { eventId: string; name: string; season: number; managerName: string; prizePence: number; cutPence: number }[] };
  firms: { key: string; name: string; kind: string; blurb: string; commission: number; signingBonusBoost: number; extraOffers: number; doors: string[];
    available: boolean; unmet: string[]; leftThisSeason: boolean; current: boolean }[];
};

async function facts(tx: CareerExecutor, root: Root): Promise<ManagerFacts> {
  const prize = Number((await tx.execute(sql`SELECT COALESCE(SUM(amount_pence),0)::bigint AS n FROM career_finance_entries
    WHERE career_save_id=${root.id} AND category='PRIZE'`)).rows[0].n);
  return { careerPrizePence: prize, tourCard: root.has_tour_card === true };
}

/** Managers: who will sign you, who you have, what they brought in and what they took for it. Sign one, or leave. */
export function createCareerManagerService(database: CareerDatabase) {
  async function view(tx: CareerExecutor, root: Root): Promise<ManagerView> {
    const season = Number(root.current_season);
    const f = await facts(tx, root);
    const contracts = (await tx.execute(sql`SELECT * FROM career_manager_contracts WHERE career_save_id=${root.id} ORDER BY created_at`)).rows;
    const active = contracts.find(c => c.status === "ACTIVE");
    const def = active ? managerByKey(String(active.manager_key)) : null;
    const doorsOf = (circuits: readonly string[]) => circuits.map(c => REACH_LABEL[c] ?? c);
    const current: ManagerView["current"] = active && def ? { key: def.key, name: def.name, kind: def.kind, commission: def.commission,
      signedSeason: Number(active.signed_season), signedWeek: Number(active.signed_week), doors: doorsOf(def.reach.circuits) } : null;
    const nameOf = (key: unknown) => managerByKey(String(key))?.name ?? "Your former manager";
    const cut = (await tx.execute(sql`SELECT
        COALESCE(-SUM(amount_pence) FILTER (WHERE detail->>'source'='SPONSOR_DEAL'),0)::bigint AS deals,
        COALESCE(-SUM(amount_pence) FILTER (WHERE detail->>'source'='INVITATION'),0)::bigint AS invites,
        COALESCE(-SUM(amount_pence) FILTER (WHERE season=${season}),0)::bigint AS season_cut,
        COALESCE(-SUM(amount_pence),0)::bigint AS total
      FROM career_finance_entries WHERE career_save_id=${root.id} AND category='MANAGER_COMMISSION'`)).rows[0];
    const deals = (await tx.execute(sql`SELECT c.terms->>'displayName' AS sponsor, c.status, o.source->'manager'->>'key' AS manager_key,
        (o.terms->>'signingBonusPence')::bigint - COALESCE((o.source->'managerPremium'->>'beforePence')::bigint, (o.terms->>'signingBonusPence')::bigint) AS extra
      FROM career_sponsor_contracts c JOIN career_sponsor_offers o ON o.career_save_id=c.career_save_id AND o.id=c.offer_id
      WHERE c.career_save_id=${root.id} AND o.source ? 'manager' ORDER BY c.start_season DESC, c.start_week DESC`)).rows;
    const invites = (await tx.execute(sql`SELECT v.event_id, v.manager_key, i.name, i.season,
        COALESCE((SELECT SUM(amount_pence) FROM career_finance_entries f WHERE f.career_save_id=v.career_save_id AND f.event_id=v.event_id AND f.category='PRIZE'),0)::bigint AS prize,
        COALESCE((SELECT -SUM(amount_pence) FROM career_finance_entries f WHERE f.career_save_id=v.career_save_id AND f.event_id=v.event_id AND f.category='MANAGER_COMMISSION'),0)::bigint AS cut
      FROM career_manager_invites v JOIN career_event_instances i ON i.career_save_id=v.career_save_id AND i.id=v.event_id
      WHERE v.career_save_id=${root.id} ORDER BY i.season DESC, i.start_day DESC LIMIT 20`)).rows;
    const earned: ManagerView["earned"] = { fromDealsPence: Number(cut.deals), fromInvitationsPence: Number(cut.invites), thisSeasonPence: Number(cut.season_cut), totalPence: Number(cut.total),
      extraSigningBonusPence: deals.reduce((n, d) => n + Math.max(0, Number(d.extra ?? 0)), 0),
      deals: deals.map(d => ({ sponsor: String(d.sponsor ?? "Sponsor"), managerName: nameOf(d.manager_key), active: d.status === "ACTIVE" })),
      invitations: invites.map(v => ({ eventId: String(v.event_id), name: String(v.name), season: Number(v.season), managerName: nameOf(v.manager_key), prizePence: Number(v.prize), cutPence: Number(v.cut) })) };
    const leftThisSeason = new Set(contracts.filter(c => c.status === "ENDED" && Number(c.ended_season) === season).map(c => String(c.manager_key)));
    return { season, careerPrizePence: f.careerPrizePence, tourCard: f.tourCard, current, earned,
      firms: MANAGERS.map(m => { const why = unmet(m, f); return { key: m.key, name: m.name, kind: m.kind, blurb: m.blurb, commission: m.commission,
        signingBonusBoost: m.signingBonusBoost, extraOffers: m.extraOffers, doors: doorsOf(m.reach.circuits),
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
    /** Part company with your manager (free). Their cut of the deals they set up and the events they got you into is still owed. */
    async leave(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        await end(tx, root);
        return view(tx, root);
      });
    },
  };
}
