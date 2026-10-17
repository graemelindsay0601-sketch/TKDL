import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { stableUuid } from "../world/random.ts";
import { LOCALITIES } from "../calendar/geography.ts";
import { generateSeason, absoluteDay, calendarHashOf, type EventInstanceDraft } from "../calendar/generation.ts";
import { insertDrafts, openRegistrations, type RootRow } from "../calendar/engine.ts";
import { post } from "../finance/ledger.ts";
import { reservedPence } from "../finance/engine.ts";
import { fansForEffects } from "../fans/service.ts";
import { streamNights } from "../streaming/state.ts";
import { HOSTING, expectedTurnout, hostedPrize, organiserTake, type HostedTerms } from "./model.ts";

type Root = RootRow & { career_name?: string | null };
const HUMAN = "HUMAN";
const HOSTED_DEFINITION = { key: HOSTING.definitionKey, name: "Your own tournament", hosted: true, version: HOSTING.version };

export type HostedEventView = { eventId: string; name: string; week: number; day: number; dayOfWeek: number; status: string; fieldSize: number; entrants: number | null;
  feePence: number; topUpPence: number; roomHirePence: number; potPence: number; takePence: number | null; youPlayed: boolean; yourPosition: number | null };
export type HostingView = {
  season: number; week: number; club: string | null; availablePence: number; hostedThisSeason: number; maxPerSeason: number; fans: number;
  rules: { leadWeeks: number; lastWeek: number; fieldSizes: number[]; roomHirePence: Record<number, number>; maxFeePence: number; maxTopUpPence: number; organiserShare: number };
  events: HostedEventView[];
};

const homeOf = async (tx: CareerExecutor, root: Root) => {
  const key = String((await tx.execute(sql`SELECT home_locality FROM career_profiles WHERE career_save_id=${root.id}`)).rows[0]?.home_locality
    ?? (root.settings_snapshot as { homeLocality?: string } | undefined)?.homeLocality ?? "");
  return LOCALITIES.find(l => l.key === key) ?? null;
};
const available = async (tx: CareerExecutor, saveId: string) =>
  Math.max(0, Number((await tx.execute(sql`SELECT balance_pence FROM career_saves WHERE id=${saveId}`)).rows[0]?.balance_pence ?? 0) - await reservedPence(tx, saveId));

/** A local night to model your tournament on (its format, venue and open entry), from the save's own event database. */
function template(root: Root, season: number, locality: { key: string; city: string }): EventInstanceDraft | null {
  const local = (d: EventInstanceDraft) => d.startDay === d.endDay && !d.seriesKey && d.snapshot.format.structure === "KNOCKOUT" && d.snapshot.format.sideSize !== 2;
  const drafts = generateSeason(root.world_seed, Number(root.event_database_version), season, d => d.circuit === "GRASSROOTS" && d.classification !== "QUALIFIER").filter(local);
  // A night held in your club's own town (its venue), the biggest such field first; failing that any local open in your area.
  const mine = drafts.filter(d => d.localityKey === locality.key).sort((a, b) => b.fieldSize - a.fieldSize || a.definitionKey.localeCompare(b.definitionKey));
  return mine.find(d => d.city === locality.city) ?? mine[0] ?? null;
}

export function createCareerHostingService(database: CareerDatabase) {
  async function view(tx: CareerExecutor, root: Root): Promise<HostingView> {
    const season = Number(root.current_season), week = Number(root.current_week);
    const home = await homeOf(tx, root);
    const rows = (await tx.execute(sql`SELECT i.*, r.finishing_position,
        (SELECT SUM(amount_pence) FROM career_finance_entries f WHERE f.career_save_id=i.career_save_id AND f.event_id=i.id AND f.operation_key LIKE 'hosting-income:%')::bigint AS take
      FROM career_event_instances i LEFT JOIN career_event_results r ON r.career_save_id=i.career_save_id AND r.event_id=i.id AND r.participant_key=${HUMAN}
      WHERE i.career_save_id=${root.id} AND i.definition_key=${HOSTING.definitionKey} ORDER BY i.season DESC, i.start_day DESC LIMIT 20`)).rows;
    const events = rows.map(r => {
      const t = (r.snapshot as { hosted: HostedTerms }).hosted, done = r.status === "COMPLETED";
      const entrants = r.field_locked_at || done ? Number(r.entrant_count) : null;
      return { eventId: String(r.id), name: String(r.name), week: Number(r.start_week), day: Number(r.start_day), dayOfWeek: ((Number(r.start_day) - 1) % 7) + 1, status: String(r.status),
        fieldSize: t.fieldSize, entrants, feePence: t.feePence, topUpPence: t.topUpPence, roomHirePence: t.roomHirePence,
        potPence: hostedPrize(t, entrants ?? Math.round(t.fieldSize * 0.6)).bands.reduce((n, b, i) => n + b.amountPence * (i === 2 ? 2 : 1), 0),
        takePence: done ? Number(r.take ?? 0) : null, youPlayed: r.finishing_position !== null, yourPosition: r.finishing_position === null ? null : Number(r.finishing_position) };
    });
    return { season, week, club: home ? `${home.city} Darts Club` : null, availablePence: await available(tx, root.id),
      hostedThisSeason: rows.filter(r => Number(r.season) === season && r.status !== "CANCELLED").length, maxPerSeason: HOSTING.maxPerSeason,
      fans: Math.max(0, (await fansForEffects(tx, root.id)) ?? 0),
      rules: { leadWeeks: HOSTING.leadWeeks, lastWeek: HOSTING.lastWeek, fieldSizes: [...HOSTING.fieldSizes], roomHirePence: HOSTING.roomHirePence, maxFeePence: HOSTING.maxFeePence,
        maxTopUpPence: HOSTING.maxTopUpPence, organiserShare: HOSTING.organiserShare }, events };
  }

  return {
    async read(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => view(tx, await lockRoot(tx, actor, saveId, false) as unknown as Root));
    },

    /**
     * Book your own tournament: a night at your club at least two weeks ahead that you're free, the field size, the entry fee
     * and your prize top-up. The room and the top-up are paid now. It opens for entries straight away and is played like any
     * other event. Returns the new event's id (enter it yourself from its page, or with `play`).
     */
    async create(actor: CareerActor, saveId: string, body: unknown) {
      const input = z.object({ name: z.string().trim().min(3).max(40).optional(), week: z.number().int().min(1).max(52), dayOfWeek: z.number().int().min(1).max(7),
        fieldSize: z.number().int(), feePence: z.number().int().min(0).max(HOSTING.maxFeePence), topUpPence: z.number().int().min(0).max(HOSTING.maxTopUpPence) }).strict().parse(body);
      if (!HOSTING.fieldSizes.includes(input.fieldSize)) throw new CareerError(400, "Choose a field of 16 or 32");
      if (input.feePence % 100 || input.topUpPence % 100) throw new CareerError(400, "Whole pounds only");
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        if (input.week < week + HOSTING.leadWeeks || input.week > HOSTING.lastWeek) throw new CareerError(409, `Book a night between week ${week + HOSTING.leadWeeks} and week ${HOSTING.lastWeek}`);
        const before = await view(tx, root);
        if (before.hostedThisSeason >= HOSTING.maxPerSeason) throw new CareerError(409, `You can run ${HOSTING.maxPerSeason} tournaments a season`);
        if (before.events.some(e => e.status !== "COMPLETED" && e.status !== "CANCELLED")) throw new CareerError(409, "Finish the tournament you've already booked first");
        const home = await homeOf(tx, root);
        if (!home) throw new CareerError(409, "You need a home club to run a tournament");
        const day = absoluteDay(input.week, input.dayOfWeek);
        const clash = (await tx.execute(sql`SELECT 1 FROM career_participant_bookings WHERE career_save_id=${root.id} AND season=${season} AND day=${day} AND participant_key=${HUMAN}
          UNION ALL SELECT 1 FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season} AND day=${day} AND status='ACCEPTED' LIMIT 1`)).rows.length;
        if (clash || (await streamNights(tx, root.id, season)).has(day)) throw new CareerError(409, "You're already booked that night");
        const tmpl = template(root, season, home);
        if (!tmpl) throw new CareerError(409, "Your club has no back room to hire (no local open to model it on)");
        const roomHirePence = HOSTING.roomHirePence[input.fieldSize];
        const cost = roomHirePence + input.topUpPence;
        if (cost > before.availablePence) throw new CareerError(409, `That costs ${cost / 100} pounds up front and you have ${Math.floor(before.availablePence / 100)} free`);
        const terms: HostedTerms = { feePence: input.feePence, topUpPence: input.topUpPence, fieldSize: input.fieldSize, roomHirePence, organiserShare: HOSTING.organiserShare,
          name: input.name ?? `${home.city} Darts Club Open` };
        const turnout = expectedTurnout(terms, before.fans);
        const n = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_event_instances WHERE career_save_id=${root.id} AND definition_key=${HOSTING.definitionKey}`)).rows[0].n) + 1;
        const id = stableUuid(root.world_seed, HOSTING.version, "hosted-event", root.id, season, n);
        const draft: EventInstanceDraft = { ...tmpl, id, instanceKey: `${HOSTING.definitionKey}:${season}:${n}`, ordinal: 1000 + n, definitionKey: HOSTING.definitionKey, name: terms.name,
          family: "hosted", circuit: "SPECIAL", classification: "SPECIAL", rankingCategory: null, presentationTier: "LOCAL", featured: false,
          startWeek: input.week, endWeek: input.week, startDay: day, endDay: day, registrationOpensWeek: week, registrationClosesWeek: input.week,
          fieldSize: input.fieldSize, minimumEntrants: HOSTING.minimumEntrants, executable: true, seriesKey: null, seriesDay: null,
          snapshot: { ...tmpl.snapshot, key: HOSTING.definitionKey, name: terms.name, family: "hosted", circuit: "SPECIAL", classification: "SPECIAL", rankingCategory: null,
            presentation: { ...tmpl.snapshot.presentation, tier: "LOCAL", featured: false }, fieldSize: input.fieldSize, minimumEntrants: HOSTING.minimumEntrants,
            npcFill: [turnout, turnout], qualificationOutputs: [], entitlementIntake: [], exclusiveGroup: null,
            content: tmpl.snapshot.content ? { ...tmpl.snapshot.content, canonicalEventId: HOSTING.definitionKey, titleSponsorId: null,
              summary: `Your own tournament at ${home.city} Darts Club: £${input.feePence / 100} to enter, ${input.topUpPence ? `£${input.topUpPence / 100} of your own in the pot` : "the pot made of the entry fees"}.` } : tmpl.snapshot.content,
            hosted: terms } as EventInstanceDraft["snapshot"] & { hosted: HostedTerms } };
        // Every event names its definition: one shared "your own tournament" definition per event database (never in the catalogue).
        await tx.execute(sql`INSERT INTO career_event_definitions (event_database_version, definition_key, definition_hash, circuit, classification, definition)
          VALUES (${Number(root.event_database_version)}, ${HOSTING.definitionKey}, ${calendarHashOf(HOSTED_DEFINITION)}, 'SPECIAL', 'SPECIAL', ${JSON.stringify(HOSTED_DEFINITION)}::jsonb)
          ON CONFLICT (event_database_version, definition_key) DO NOTHING`);
        await insertDrafts(tx, root, season, [draft]);
        await post(tx, root, { operationKey: `hosting-cost:${id}`, category: "HOSTING_COST", amountPence: -cost,
          reason: `${terms.name}: room hire ${input.fieldSize}-player (£${roomHirePence / 100})${input.topUpPence ? ` and £${input.topUpPence / 100} prize money` : ""}`,
          season, week, eventId: id, detail: { roomHirePence, topUpPence: input.topUpPence } });
        await openRegistrations(tx, root.id, season, week);
        return { eventId: id, turnout, view: await view(tx, root) };
      });
    },
  };
}

/** What a booking would look like before you commit (turnout, pot and your take at that turnout). */
export function hostingPreview(t: Pick<HostedTerms, "feePence" | "topUpPence" | "fieldSize">, fans: number) {
  const terms = { ...t, organiserShare: HOSTING.organiserShare };
  const turnout = expectedTurnout(t, fans), entrants = Math.max(HOSTING.minimumEntrants, Math.round(t.fieldSize * turnout));
  return { turnout, entrants, prize: hostedPrize(terms, entrants), takePence: organiserTake(terms, entrants), costPence: HOSTING.roomHirePence[t.fieldSize] + t.topUpPence };
}
