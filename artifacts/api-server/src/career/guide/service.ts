import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../database.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import type { SportingFacts } from "../finance/sponsors.catalogue.ts";
import { buildGuide, type GuideEvent, type GuideFocus, type GuideStreaming } from "./model.ts";

type Overview = { today?: { week: number; dayOfWeek: number; phase: "START_OF_WEEK" | "MID_WEEK" };
  pendingHumanMatches: { matchId: string; eventId: string }[]; nextHumanEntry: { eventId: string; name: string; week: number } | null } | null;
type Deps = {
  calendar: { calendar(actor: CareerActor, saveId: string, query?: unknown, options?: { overview?: boolean }): Promise<{ events: unknown[]; overview?: unknown }>;
    glance(actor: CareerActor, saveId: string): Promise<unknown> };
  goals: { read(actor: CareerActor, saveId: string): Promise<{ focus: string; context?: { earningsPence?: number } }> };
  sponsors: { sponsors(actor: CareerActor, saveId: string): Promise<{ facts?: SportingFacts; prospects?: { tier: string; name: string; met: boolean; signed: boolean }[] }> };
  streaming: { read(actor: CareerActor, saveId: string): Promise<Record<string, any>> };
  money: { read(actor: CareerActor, saveId: string): Promise<{ challenge: { name: string; stakePence: number } | null }> };
};
const EMPTY_FACTS: SportingFacts = { careerStarted: true, titles: 0, bestFinishByCircuit: {}, qualifications: [], professionalStatus: null, tourCard: null, worldRanking: null };

/** The Career Guide: today, your path, next steps and what you're missing, from the services that own each fact. */
export function createCareerGuideService(database: CareerDatabase, deps: Deps) {
  return {
    async read(actor: CareerActor, saveId: string) {
      const root = await database.transaction(async tx => {
        const r = await lockRoot(tx, actor, saveId, false) as unknown as { id: string; current_season: number; current_week: number };
        const balance = (await tx.execute(sql`SELECT balance_pence FROM career_saves WHERE id = ${saveId}`)).rows[0]?.balance_pence;
        const channel = (await tx.execute(sql`SELECT to_regclass('career_stream_channels') IS NOT NULL AS ok`)).rows[0]?.ok === true
          && (await tx.execute(sql`SELECT 1 FROM career_stream_channels WHERE career_save_id = ${saveId}`)).rows.length > 0;
        const review = (await tx.execute(sql`SELECT to_regclass('career_legacy_reviews') IS NOT NULL AS ok`)).rows[0]?.ok === true
          ? (await tx.execute(sql`SELECT season FROM career_legacy_reviews WHERE career_save_id = ${saveId} AND acknowledged = false ORDER BY season LIMIT 1`)).rows[0]?.season : undefined;
        // Beyond the four-week window: the next event on each circuit this season, so a quiet stretch can say when the path picks up again.
        const later = (await tx.execute(sql`SELECT DISTINCT ON (circuit) circuit, id, name, start_week, registration_opens_week FROM career_event_instances
          WHERE career_save_id = ${saveId} AND season = ${r.current_season} AND start_week > ${Number(r.current_week) + 4} AND status NOT IN ('COMPLETED', 'CANCELLED')
          ORDER BY circuit, start_week, name`)).rows.map(e => ({ circuit: String(e.circuit), id: String(e.id), name: String(e.name), week: Number(e.start_week), opensWeek: Number(e.registration_opens_week) }));
        return { season: Number(r.current_season), week: Number(r.current_week), balancePence: Number(balance ?? 0), channel, pendingReview: review == null ? null : Number(review), later };
      });
      // Events without the season overview (its read of every week ahead); today and waiting matches come from the cheap glance.
      const [cal, glance] = await Promise.all([
        deps.calendar.calendar(actor, saveId, { scope: "RELEVANT", fromWeek: Math.max(1, root.week - 6), toWeek: Math.min(52, root.week + 4) }, { overview: false }),
        deps.calendar.glance(actor, saveId)]);
      const overview = glance as Overview;
      const events = cal.events as GuideEvent[];
      const [goals, sponsors, streaming, money] = await Promise.all([
        deps.goals.read(actor, saveId).catch(() => ({ focus: "OPEN_SCHEDULE" })),
        deps.sponsors.sponsors(actor, saveId).catch(() => ({ facts: undefined, prospects: [], offers: [] })),
        root.channel ? deps.streaming.read(actor, saveId).catch(() => null) : Promise.resolve(null),
        deps.money.read(actor, saveId).catch(() => ({ challenge: null })),
      ]);
      const pending = overview?.pendingHumanMatches[0];
      const stream: GuideStreaming = streaming ? { tierKey: streaming.tier?.key, tierName: streaming.tier?.name, followers: Number(streaming.followers ?? 0), nextTier: null,
        week: Number(streaming.week), scheduledNights: streaming.pathway?.scheduledNights ?? [], streamsThisWeek: Number(streaming.streamsThisWeek ?? 0),
        perWeek: Number(streaming.perWeek ?? 0), live: streaming.live ?? null } : null;
      // The best waiting offer: the biggest signing bonus, then the one closing first.
      type Offer = { id: string; status: string; terms: { displayName?: string; signingBonusPence?: number }; expires: { season: number; week: number } };
      const offers = ((sponsors as { offers?: Offer[] }).offers ?? []).filter(o => o.status === "AVAILABLE"
        && (Number(o.expires.season) > root.season || Number(o.expires.week) >= root.week))
        .sort((a, b) => (b.terms.signingBonusPence ?? 0) - (a.terms.signingBonusPence ?? 0) || (a.expires.season - b.expires.season) * 100 + a.expires.week - b.expires.week);
      const offer = offers[0];
      return buildGuide({
        sponsorOffer: offer ? { id: String(offer.id), name: offer.terms.displayName ?? "A sponsor", signingBonusPence: Number(offer.terms.signingBonusPence ?? 0),
          expiresWeek: Number(offer.expires.season) > root.season ? null : Number(offer.expires.week), count: offers.length } : null,
        saveId, season: root.season, balancePence: root.balancePence, focus: (goals.focus as GuideFocus) ?? "OPEN_SCHEDULE",
        today: overview?.today ?? { week: root.week, dayOfWeek: 1, phase: "START_OF_WEEK" },
        facts: sponsors.facts ?? EMPTY_FACTS, sponsorTiers: sponsors.prospects ?? [], events,
        pendingMatch: pending ? { matchId: pending.matchId, eventId: pending.eventId, name: events.find(e => e.id === pending.eventId)?.name ?? "your event" } : null,
        pendingReview: root.pendingReview, activeTournament: null, booked: overview?.nextHumanEntry ?? null, streaming: stream, moneyChallenge: money.challenge, missedWeeks: 6, later: root.later, earningsPence: Number((goals as { context?: { earningsPence?: number } }).context?.earningsPence ?? 0),
      });
    },
  };
}
