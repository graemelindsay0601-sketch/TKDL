import { ensureInbox } from "../../db/migrations/create_career_inbox.ts";
export { ensureInbox };
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { activeManager } from "../manager/state.ts";
import { INBOX, INBOX_CATEGORIES, OPEN_CIRCUITS, QUALIFIED_CIRCUITS, seriesName, voiced, type InboxCategory, type InboxItem } from "./model.ts";

type CalendarRead = { calendar(actor: CareerActor, saveId: string, query?: unknown, options?: { overview?: boolean }): Promise<{ events: CalEvent[] }> };
type CalEvent = { id: string; name: string; circuit: string; status: string; dates: { startWeek: number; startDayOfWeek: number };
  finance?: unknown;
  registration: { opensWeek: number; closesWeek: number } | null; venue: { city?: string } | null;
  human: { canEnter: boolean; eligible: boolean; relationship: string; managerInvite?: unknown; streamInvite?: boolean } | null };
type StreamingRead = { read(actor: CareerActor, saveId: string): Promise<Record<string, any>> };
type MoneyRead = { read(actor: CareerActor, saveId: string): Promise<{ challenge: { name: string; stakePence: number } | null }> };

const pounds = (p: number) => `£${(p / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
let stateSeen = false;
async function ensureState(tx: CareerExecutor) {
  if (stateSeen) return;
  if ((await tx.execute(sql`SELECT to_regclass('career_inbox_state') IS NOT NULL AS ok`)).rows[0]?.ok !== true) await ensureInbox(tx);
  stateSeen = true;
}

export function createCareerInboxService(database: CareerDatabase, deps: { calendar: CalendarRead; streaming: StreamingRead; money: MoneyRead;
  sponsors?: { sponsors(actor: CareerActor, saveId: string): Promise<{ prospects?: { tier: string; name: string; met: boolean; signed: boolean; sponsors: number }[] }> } }) {
  /** Everything the inbox could say right now (before read state), from the facts. */
  async function gather(actor: CareerActor, saveId: string) {
    const { root, offers, channel, manager } = await database.transaction(async tx => {
      const root = await lockRoot(tx, actor, saveId, false) as unknown as { id: string; current_season: number; current_week: number; status: string };
      const season = Number(root.current_season), week = Number(root.current_week);
      const offers = (await tx.execute(sql`SELECT id, terms, expires_season, expires_week FROM career_sponsor_offers WHERE career_save_id=${saveId} AND status='AVAILABLE'
        AND (expires_season > ${season} OR (expires_season = ${season} AND expires_week >= ${week}))`)).rows;
      const channel = (await tx.execute(sql`SELECT to_regclass('career_stream_channels') IS NOT NULL AS ok`)).rows[0]?.ok === true
        && (await tx.execute(sql`SELECT 1 FROM career_stream_channels WHERE career_save_id=${saveId}`)).rows.length > 0;
      return { root, offers, channel, manager: await activeManager(tx, saveId) };
    });
    const week = Number(root.current_week), items: InboxItem[] = [], base = `/career/${saveId}`;
    const add = (i: InboxItem) => items.push(i);
    // Events: qualified for, newly open, and entry closing this week.
    const cal = await deps.calendar.calendar(actor, saveId, { scope: "AVAILABLE", fromWeek: week, toWeek: Math.min(52, week + INBOX.lookAheadWeeks) }, { overview: false });
    const told = new Set<string>();
    const opened: { id: string; name: string; dates: { startWeek: number } }[] = [];
    for (const e0 of [...cal.events].sort((a, b) => a.dates.startWeek - b.dates.startWeek || a.dates.startDayOfWeek - b.dates.startDayOfWeek)) {
      if (!e0.human || !e0.human.canEnter || e0.status === "CANCELLED") continue;
      const name = seriesName(e0.name);
      if (told.has(name)) continue;
      told.add(name);
      const e = { ...e0, name, human: e0.human };
      const where = e.venue?.city ? ` in ${e.venue.city}` : "", closes = e.registration?.closesWeek ?? e.dates.startWeek;
      const invited = !!e.human.managerInvite || !!e.human.streamInvite;
      // "You're in" only when you really qualified or were invited; events open to anyone go in the "now open" digest.
      const qualified = e.human.relationship === "QUALIFIED" || invited;
      if (qualified)
        add({ key: `qualified:${e.id}`, category: "QUALIFIED", title: `You're in for ${e.name}`, week: e.dates.startWeek, expiresWeek: closes,
          body: `${invited ? (e.human.streamInvite ? "Your DartCast audience earned an invitation" : "Your manager got you an invitation") : "You've qualified"} for ${e.name}${where}, week ${e.dates.startWeek}. Qualifying doesn't enter you: enter by week ${closes}.`,
          action: { label: "Enter", href: `${base}/events/${e.id}` } });
      else if ((OPEN_CIRCUITS.has(e.circuit) || QUALIFIED_CIRCUITS.has(e.circuit)) && ["LOCAL", "DOMESTIC", undefined].includes((e.finance as { travelBand?: string } | null | undefined)?.travelBand)) opened.push(e);
      if (closes === week && (QUALIFIED_CIRCUITS.has(e.circuit) || OPEN_CIRCUITS.has(e.circuit) || invited))
        add({ key: `closing:${e.id}:${week}`, category: "CLOSING", title: `Last week to enter ${e.name}`, week, expiresWeek: week,
          body: `Entries for ${e.name} close this week.`, action: { label: "Enter", href: `${base}/events/${e.id}` } });
    }
    // Newly open events near you: one digest a week, not one item per event.
    if (opened.length) add({ key: `open-digest:${root.current_season}:${week}`, category: "OPEN", week, expiresWeek: week,
      title: opened.length === 1 ? `${opened[0].name} is open` : `${opened.length} events near you are open`,
      body: `Entries are open for ${opened.slice(0, 3).map(e => `${e.name} (week ${e.dates.startWeek})`).join(", ")}${opened.length > 3 ? ` and ${opened.length - 3} more` : ""}.`,
      action: opened.length === 1 ? { label: "Have a look", href: `${base}/events/${opened[0].id}` } : { label: "See them", href: `${base}/calendar` } });
    // Sponsor offers for your darts career.
    for (const o of offers) {
      const t = o.terms as { displayName?: string; signingBonusPence?: number };
      const last = Number(o.expires_season) === Number(root.current_season) && Number(o.expires_week) <= week + 1;
      add({ key: `sponsor-offer:${o.id}`, category: last ? "CLOSING" : "WAITING", title: `${t.displayName ?? "A sponsor"} wants to sign you`, week, expiresWeek: Number(o.expires_week),
        body: `${t.displayName ?? "A sponsor"} has made you an offer${t.signingBonusPence ? ` with a ${pounds(t.signingBonusPence)} signing bonus` : ""}. It's open until week ${o.expires_week}.`,
        action: { label: "See the offer", href: `${base}/sponsors` } });
    }
    // Sponsor tiers you now qualify for (offers arrive by themselves; this says so, once per tier).
    if (deps.sponsors) try {
      const sp = await deps.sponsors.sponsors(actor, saveId);
      for (const p of sp.prospects ?? []) if (p.met && !p.signed)
        add({ key: `sponsor-qualify:${p.tier}`, category: "MILESTONE", title: `You now qualify for ${p.name.toLowerCase()}`, week, expiresWeek: null,
          body: `Your results have caught the eye of ${p.name.toLowerCase()} (${p.sponsors} of them). Offers arrive by themselves over the next few weeks, as long as you have room in your portfolio.`,
          action: { label: "Sponsor HQ", href: `${base}/sponsors` } });
    } catch { /* no sponsor facts yet */ }
    // A member's money-match challenge.
    try {
      const m = await deps.money.read(actor, saveId);
      if (m.challenge) add({ key: `money-challenge:${root.current_season}:${week}`, category: "WAITING", title: `${m.challenge.name} has challenged you`, week, expiresWeek: week,
        body: `${m.challenge.name} wants a money match at the club for ${pounds(m.challenge.stakePence)} each, this week only.`, action: { label: "Answer", href: `${base}/money-matches` } });
    } catch { /* no club yet */ }
    // DartCast: offers, cups, celebrations, vlogs, gear and tiers.
    // Only once you've opened DartCast (reading it would otherwise set up a channel you haven't asked for).
    if (channel) try {
      const s = await deps.streaming.read(actor, saveId), b = s.business ?? {}, dc = `${base}/streaming`;
      for (const o of b.partners?.offers ?? []) add({ key: `partner:${o.id}`, category: "WAITING", title: `${o.brand}: ${o.kindName.toLowerCase()} offer`, week, expiresWeek: o.expiresWeek,
        body: `${o.brand} (${o.what}) want you for a ${o.kindName.toLowerCase()}. Open until week ${o.expiresWeek}.`, action: { label: "Answer", href: `${dc}#business` } });
      if (b.sponsor?.offer) add({ key: `ladder:${b.sponsor.offer.id}`, category: "WAITING", title: `${b.sponsor.offer.brand} want to sponsor the channel`, week, expiresWeek: b.sponsor.offer.expiresWeek,
        body: `${b.sponsor.offer.brand} offer ${pounds(b.sponsor.offer.weeklyPence)} a live week as your headline sponsor.`, action: { label: "Answer", href: `${dc}#business` } });
      if (b.affiliate?.offer) add({ key: `affiliate:${b.affiliate.offer.id}`, category: "WAITING", title: `${b.affiliate.offer.brand} offer you a code`, week, expiresWeek: null,
        body: `${b.affiliate.offer.brand} want to give your viewers a code: you earn a cut every month.`, action: { label: "Answer", href: `${dc}#business` } });
      if (b.platform?.offer) add({ key: `platform:${root.current_season}`, category: "WAITING", title: `${b.platform.name} want you exclusive`, week, expiresWeek: null,
        body: `${b.platform.name} offer ${pounds(b.platform.offer)} for a season of exclusivity.`, action: { label: "Decide", href: `${dc}#business` } });
      if (s.dealOffer) add({ key: `deal:${s.dealOffer.id}`, category: "WAITING", title: `${s.dealOffer.brand} brand deal`, week, expiresWeek: s.dealOffer.expiresWeek,
        body: `${s.dealOffer.brand} (${s.dealOffer.what}) offer ${pounds(s.dealOffer.perStreamPence)} a stream for ${s.dealOffer.streamsTotal} streams.`, action: { label: "Answer", href: dc } });
      if (s.cups?.current?.open) add({ key: `cup:${root.current_season}:${s.cups.current.name}`, category: "OPEN", title: `The ${s.cups.current.name} is on`, week, expiresWeek: s.cups.current.closes ?? null,
        body: `The ${s.cups.current.name} is open this week: a one-night knockout that doesn't use a stream night.`, action: { label: "Play it", href: `${dc}#cups` } });
      if (s.celebration) add({ key: `celebration:${s.celebration.milestone}`, category: "MILESTONE", title: `${Number(s.celebration.milestone).toLocaleString("en-GB")} followers!`, week, expiresWeek: null,
        body: `You've passed ${Number(s.celebration.milestone).toLocaleString("en-GB")} followers: a celebration stream is ready when you are.`, action: { label: "Celebrate", href: dc } });
      for (const v of s.content?.vlogs?.available ?? []) add({ key: `vlog:${v.source}`, category: "OPEN", title: "A vlog's ready to cut", week, expiresWeek: null,
        body: `${v.title}: post it for views and followers.`, action: { label: "Post it", href: `${dc}#content` } });
      add({ key: `tier:${s.tier?.key}`, category: "MILESTONE", title: `DartCast: you're ${s.tier?.name}`, week, expiresWeek: null,
        body: `Your channel has reached ${s.tier?.name}. ${s.tier?.perks ?? ""}`, action: { label: "Open DartCast", href: dc } });
      for (const p of s.plaques ?? []) if (p.earned) add({ key: `plaque:${p.key}`, category: "MILESTONE", title: `${p.name} arrived`, week, expiresWeek: null,
        body: `The platform sent a ${p.name.toLowerCase()} for ${Number(p.followers).toLocaleString("en-GB")} followers.`, action: { label: "See it", href: dc } });
    } catch { /* no channel yet */ }
    return { root, manager, items: items.filter(i => !(i.key.startsWith("tier:NEWCOMER"))) };
  }

  async function state(saveId: string) {
    return database.transaction(async tx => {
      await ensureState(tx);
      const r = (await tx.execute(sql`SELECT seen, dismissed, muted FROM career_inbox_state WHERE career_save_id=${saveId}`)).rows[0];
      return { seen: new Set((r?.seen as string[]) ?? []), dismissed: new Set((r?.dismissed as string[]) ?? []), muted: new Set((r?.muted as string[]) ?? []) };
    });
  }

  return {
    async read(actor: CareerActor, saveId: string) {
      const { manager, items } = await gather(actor, saveId), st = await state(saveId);
      const shown = items.filter(i => !st.dismissed.has(i.key)).sort((a, b) =>
        Object.keys(INBOX_CATEGORIES).indexOf(a.category) - Object.keys(INBOX_CATEGORIES).indexOf(b.category) || a.week - b.week);
      const out = shown.map(i => ({ ...voiced(manager ? { name: manager.name } : null, i), isNew: !st.seen.has(i.key), muted: st.muted.has(i.category) }));
      return { manager: manager ? { name: manager.name } : null, categories: INBOX_CATEGORIES, muted: [...st.muted] as InboxCategory[],
        items: out, unread: out.filter(i => i.isNew && !i.muted).length };
    },
    /** Mark items seen, dismiss some, or mute/unmute a category. */
    async update(actor: CareerActor, saveId: string, body: unknown) {
      const q = z.object({ seen: z.array(z.string().max(120)).max(200).optional(), dismiss: z.array(z.string().max(120)).max(200).optional(),
        mute: z.enum(Object.keys(INBOX_CATEGORIES) as [InboxCategory, ...InboxCategory[]]).optional(),
        unmute: z.enum(Object.keys(INBOX_CATEGORIES) as [InboxCategory, ...InboxCategory[]]).optional() }).strict().parse(body);
      await database.transaction(async tx => {
        await lockRoot(tx, actor, saveId, false);
        await ensureState(tx);
        const r = (await tx.execute(sql`SELECT seen, dismissed, muted FROM career_inbox_state WHERE career_save_id=${saveId}`)).rows[0];
        const keep = (a: string[]) => a.slice(-INBOX.keep);
        const seen = keep([...new Set([...((r?.seen as string[]) ?? []), ...(q.seen ?? []), ...(q.dismiss ?? [])])]);
        const dismissed = keep([...new Set([...((r?.dismissed as string[]) ?? []), ...(q.dismiss ?? [])])]);
        const muted = [...new Set([...((r?.muted as string[]) ?? []), ...(q.mute ? [q.mute] : [])])].filter(m => m !== q.unmute);
        await tx.execute(sql`INSERT INTO career_inbox_state (career_save_id, seen, dismissed, muted) VALUES (${saveId}, ${JSON.stringify(seen)}::jsonb, ${JSON.stringify(dismissed)}::jsonb, ${JSON.stringify(muted)}::jsonb)
          ON CONFLICT (career_save_id) DO UPDATE SET seen=EXCLUDED.seen, dismissed=EXCLUDED.dismissed, muted=EXCLUDED.muted, updated_at=NOW()`);
      });
      return this.read(actor, saveId);
    },
  };
}
export type InboxView = Awaited<ReturnType<ReturnType<typeof createCareerInboxService>["read"]>>;
