import type { CareerEvent, CareerSave, CalendarOverview, FinanceSummary, Milestone, PresentationTier, QSchoolPathwayView, RouteFact, SportingSummary } from "./types";

/**
 * Pure Career view-model helpers. They only translate authoritative A1–A5 facts
 * into labels/tones/actions — they never compute sporting or financial truth
 * (eligibility, affordability, rankings, cards all come from the server).
 */

// ---------------------------------------------------------------- money / time
export function formatPence(pence: number | null | undefined, opts: { compact?: boolean; signed?: boolean } = {}): string {
  if (pence === null || pence === undefined || !Number.isFinite(pence)) return "—";
  const sign = pence < 0 ? "−" : opts.signed && pence > 0 ? "+" : "";
  const pounds = Math.abs(pence) / 100;
  if (opts.compact && pounds >= 1_000_000) return `${sign}£${trim(pounds / 1_000_000)}m`;
  if (opts.compact && pounds >= 10_000) return `${sign}£${trim(pounds / 1_000)}k`;
  const whole = Number.isInteger(pounds);
  return `${sign}£${pounds.toLocaleString("en-GB", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}
const trim = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-GB", { maximumFractionDigits: 1 });
export const WEEKS_PER_SEASON = 52;
export const seasonProgressPct = (week: number) => Math.max(0, Math.min(100, Math.round(((week - 1) / WEEKS_PER_SEASON) * 100)));
export const weekLabel = (season: number, week: number) => `Season ${season} · Week ${week}`;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const dayLabel = (dayOfWeek: number) => DAYS[(dayOfWeek - 1 + 7) % 7] ?? "";
export function eventDateLabel(e: Pick<CareerEvent, "dates">) {
  const { startWeek, endWeek, startDayOfWeek } = e.dates;
  return startWeek === endWeek ? `Wk ${startWeek} · ${dayLabel(startDayOfWeek)}` : `Wk ${startWeek}–${endWeek}`;
}

// ---------------------------------------------------------------- labels
const CIRCUITS: Record<string, string> = {
  GRASSROOTS: "Grassroots", COUNTY: "County", REGIONAL: "Regional", NATIONAL_AMATEUR: "National Amateur", CHALLENGER: "Challenger", VAULT: "Vault",
  Q_SCHOOL: "Q-School", PRO_CIRCUIT: "Pro Circuit", EUROPEAN_SERIES: "European Series", WORLD_SERIES: "World Series", INVITATIONAL: "Invitational",
  MAJOR: "Major", WORLD_CHAMPIONSHIP: "World Championship", SPECIAL: "Special",
};
export const circuitLabel = (c: string) => CIRCUITS[c] ?? titleCase(c);
export const titleCase = (s: string) => s.toLowerCase().split(/[_\s-]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
const COUNTRIES: Record<string, { name: string; flag: string }> = {
  GBR: { name: "United Kingdom", flag: "🇬🇧" }, IRL: { name: "Ireland", flag: "🇮🇪" }, NLD: { name: "Netherlands", flag: "🇳🇱" }, DEU: { name: "Germany", flag: "🇩🇪" },
  BEL: { name: "Belgium", flag: "🇧🇪" }, AUT: { name: "Austria", flag: "🇦🇹" }, CZE: { name: "Czechia", flag: "🇨🇿" }, DNK: { name: "Denmark", flag: "🇩🇰" },
  POL: { name: "Poland", flag: "🇵🇱" }, HUN: { name: "Hungary", flag: "🇭🇺" }, ESP: { name: "Spain", flag: "🇪🇸" }, AUS: { name: "Australia", flag: "🇦🇺" },
  CAN: { name: "Canada", flag: "🇨🇦" }, USA: { name: "United States", flag: "🇺🇸" }, NZL: { name: "New Zealand", flag: "🇳🇿" }, JPN: { name: "Japan", flag: "🇯🇵" },
};
export const country = (code: string | null | undefined) => code ? COUNTRIES[code] ?? { name: code, flag: "" } : null;

const DENIALS: Record<string, string> = {
  NOT_ELIGIBLE: "Not eligible", OUTSIDE_REGION: "Outside region", REQUIRES_AMATEUR_STATUS: "Amateurs only", REQUIRES_PROFESSIONAL_STATUS: "Professionals only",
  REQUIRES_TOUR_CARD: "Tour Card required", TOUR_CARD_HOLDER_EXCLUDED: "Not open to Tour Card holders", REQUIRES_QUALIFICATION: "Qualification required",
  REQUIRES_INVITATION: "Invitation only", REQUIRES_RANKING: "Ranking position required", REQUIRES_EVENT_RESULT: "Earlier result required",
  REQUIRES_DEFENDING_CHAMPION: "Defending champion only", REGISTRATION_NOT_OPEN: "Registration not open", REGISTRATION_CLOSED: "Registration closed",
  SCHEDULE_CONFLICT: "Clashes with your schedule", ALREADY_ENTERED: "Already entered", NOT_ENTERED: "Not entered", UNSUPPORTED_FORMAT: "Format not yet playable",
  CAREER_NOT_ACTIVE: "Career retired", PARTICIPANT_RETIRED: "Retired", FIELD_LOCKED: "Field locked", EVENT_FINISHED: "Event finished", INSUFFICIENT_FUNDS: "Cannot afford",
};
export const denialLabel = (d: string) => DENIALS[d] ?? titleCase(d);

// ---------------------------------------------------------------- event status (from server facts only)
export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "gold" | "muted";
export type EventStatusKey = "UNSUPPORTED" | "CANCELLED" | "CHAMPION" | "COMPLETED" | "ELIMINATED" | "IN_PROGRESS" | "ENTERED" | "WITHDRAWN" | "CANNOT_AFFORD"
  | "CONFLICT" | "NOT_QUALIFIED" | "NOT_OPEN" | "CLOSED" | "AVAILABLE" | "QUALIFIED" | "MISSED" | "FINISHED";
export type EventStatusView = { key: EventStatusKey; label: string; tone: Tone; detail?: string };

export function eventStatus(e: CareerEvent, opts: { awaitingMatch?: boolean } = {}): EventStatusView {
  const h = e.human;
  if (!e.capability.executable || e.statusReason === "UNSUPPORTED_FORMAT") return { key: "UNSUPPORTED", label: "Format not playable yet", tone: "muted",
    detail: e.status === "CANCELLED" ? "Cancelled — this format is not supported by the Career engine yet" : "Will be cancelled when it starts: the Career engine cannot run this format yet" };
  if (e.status === "CANCELLED") return { key: "CANCELLED", label: "Cancelled", tone: "muted", detail: e.statusReason === "INSUFFICIENT_ENTRANTS" ? "Not enough entrants" : e.statusReason ?? undefined };
  if (h?.result) return h.result.champion ? { key: "CHAMPION", label: "Champion", tone: "gold" }
    : { key: "COMPLETED", label: `Finished — ${stageLabel(h.result.stageReached)}`, tone: "info" };
  if (opts.awaitingMatch) return { key: "IN_PROGRESS", label: "Your match is ready", tone: "warning" };
  if (h?.relationship === "PLAYING") return { key: "IN_PROGRESS", label: "In progress", tone: "warning" };
  if (h?.relationship === "WITHDRAWN") return { key: "WITHDRAWN", label: "Withdrawn", tone: "muted" };
  if (h && (h.relationship === "ENTERED" || h.relationship === "CONFIRMED")) return { key: "ENTERED", label: h.relationship === "CONFIRMED" ? "Confirmed" : "Entered", tone: "success" };
  if (e.status === "COMPLETED") return h?.relationship === "MISSED" ? { key: "MISSED", label: "Completed", tone: "muted" } : { key: "FINISHED", label: "Completed", tone: "muted" };
  if (!h) return { key: "AVAILABLE", label: statusWord(e.status), tone: "neutral" };
  if (h.denials.includes("INSUFFICIENT_FUNDS") && h.eligible) return { key: "CANNOT_AFFORD", label: "Cannot afford", tone: "danger", detail: costDetail(e) };
  if (h.denials.includes("SCHEDULE_CONFLICT") && h.eligible) return { key: "CONFLICT", label: "Schedule conflict", tone: "warning" };
  if (!h.eligible) return { key: "NOT_QUALIFIED", label: denialLabel(h.eligibilityReasons[0] ?? "NOT_ELIGIBLE"), tone: "muted" };
  if (h.denials.includes("REGISTRATION_NOT_OPEN")) return { key: "NOT_OPEN", label: `Entries open wk ${e.registration.opensWeek}`, tone: "neutral" };
  if (h.denials.includes("REGISTRATION_CLOSED") || h.denials.includes("FIELD_LOCKED")) return { key: "CLOSED", label: "Entries closed", tone: "muted" };
  if (h.canEnter) return h.relationship === "QUALIFIED" ? { key: "QUALIFIED", label: "Qualified — enter now", tone: "gold" } : { key: "AVAILABLE", label: "Open for entry", tone: "info" };
  return { key: "NOT_QUALIFIED", label: denialLabel(h.denials[0] ?? "NOT_ELIGIBLE"), tone: "muted" };
}
const costDetail = (e: CareerEvent) => e.finance ? `Costs ${formatPence(e.finance.estimatedPlayerCostPence)} · available ${formatPence(e.finance.availablePence)}` : undefined;
const statusWord = (s: string) => titleCase(s);
export function stageLabel(stage: string) {
  if (stage === "CHAMPION") return "Champion";
  if (stage === "FINAL") return "Runner-up";
  if (stage === "SEMI_FINAL") return "Semi-final";
  if (stage === "QUARTER_FINAL") return "Quarter-final";
  const m = /^LAST_(\d+)$/.exec(stage);
  return m ? `Last ${m[1]}` : titleCase(stage);
}

export type PrimaryAction = { kind: "PLAY_MATCH" | "ENTER" | "VIEW" | "CANNOT_AFFORD" | "NOT_QUALIFIED" | "WITHDRAW" | "NONE"; label: string; enabled: boolean };
/** The one action a card offers. Enter is only offered when the server says canEnter. */
export function primaryAction(e: CareerEvent, opts: { awaitingMatch?: boolean; retired?: boolean } = {}): PrimaryAction {
  if (opts.awaitingMatch) return { kind: "PLAY_MATCH", label: "Play match", enabled: !opts.retired };
  const s = eventStatus(e);
  if (opts.retired) return { kind: "VIEW", label: "View event", enabled: true };
  if (e.human?.canEnter) return { kind: "ENTER", label: e.finance && e.finance.estimatedPlayerCostPence > 0 ? `Enter · ${formatPence(e.finance.estimatedPlayerCostPence)}` : "Enter", enabled: true };
  if (s.key === "CANNOT_AFFORD") return { kind: "CANNOT_AFFORD", label: "Cannot afford", enabled: false };
  if (s.key === "NOT_QUALIFIED") return { kind: "NOT_QUALIFIED", label: "Not qualified", enabled: false };
  return { kind: "VIEW", label: s.key === "IN_PROGRESS" ? "Continue event" : e.status === "IN_PROGRESS" || e.status === "DRAWN" ? "View draw" : "View event", enabled: true };
}

/** Home's dominant card: pending human match > my next entered event > best open entry > next world event. */
export function pickNextEvent(events: CareerEvent[], overview: Pick<CalendarOverview, "pendingHumanMatches" | "week" | "season">): { event: CareerEvent; reason: string } | null {
  const pending = new Set(overview.pendingHumanMatches.map(p => p.eventId));
  const upcoming = [...events].filter(e => e.season === overview.season).sort((a, b) => a.dates.startDay - b.dates.startDay || b.presentation.calendarPriority - a.presentation.calendarPriority);
  const live = upcoming.find(e => pending.has(e.id));
  if (live) return { event: live, reason: "Your match is waiting" };
  const mine = upcoming.find(e => e.human && ["ENTERED", "CONFIRMED", "PLAYING"].includes(e.human.relationship) && e.status !== "COMPLETED" && e.status !== "CANCELLED");
  if (mine) return { event: mine, reason: "Your next event" };
  const open = upcoming.filter(e => e.human?.canEnter && e.dates.startWeek >= overview.week);
  const best = open.find(e => e.human?.relationship === "QUALIFIED") ?? open.sort((a, b) => a.dates.startDay - b.dates.startDay || b.presentation.calendarPriority - a.presentation.calendarPriority)[0];
  if (best) return { event: best, reason: best.human?.relationship === "QUALIFIED" ? "You have qualified" : "Open for entry" };
  const blocked = upcoming.find(e => e.dates.startWeek >= overview.week && e.human && e.human.eligible && e.status !== "CANCELLED" && e.capability.executable);
  return blocked ? { event: blocked, reason: "Next event you are eligible for" } : null;
}

// ---------------------------------------------------------------- rankings
export function movementLabel(movement: number | null | undefined, isNew = false): { text: string; tone: Tone; aria: string } {
  if (isNew) return { text: "NEW", tone: "info", aria: "New entry" };
  if (movement === null || movement === undefined || movement === 0) return { text: "–", tone: "muted", aria: "No change" };
  return movement > 0 ? { text: `▲${movement}`, tone: "success", aria: `Up ${movement}` } : { text: `▼${Math.abs(movement)}`, tone: "danger", aria: `Down ${Math.abs(movement)}` };
}
export const ordinal = (n: number) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`; };
/** Cut lines that fall between consecutive rows (render a divider after row `position`). */
export function cutAfter(position: number, cutLines: number[]) { return cutLines.includes(position); }

// ---------------------------------------------------------------- Q-School
/** Card-line position text. A5 reports contenderPosition 0 for players who already hold a card (not contenders). */
export function cardLineText(mine: { contenderPosition: number | null; insideCardLine: boolean } | null, cards: number, alreadyCarded: boolean): { text: string; tone: Tone } {
  if (!mine) return { text: "—", tone: "muted" };
  if (alreadyCarded || mine.contenderPosition === 0) return { text: "Not a contender — card already won", tone: "success" };
  if (mine.contenderPosition === null) return { text: "—", tone: "muted" };
  return mine.insideCardLine ? { text: `Inside (${ordinal(mine.contenderPosition)} of ${cards} OoM places)`, tone: "success" }
    : { text: `Outside (${ordinal(mine.contenderPosition)}; ${cards} OoM places)`, tone: "warning" };
}
export type QSchoolStateView = { stage: "NOT_ENTERED" | "FIRST_STAGE" | "FINAL_STAGE" | "CARD_WON_DIRECT" | "CARD_WON_OOM" | "NO_CARD"; label: string; tone: Tone };
export function qSchoolState(p: QSchoolPathwayView, participant = "HUMAN"): QSchoolStateView {
  const award = p.allocation?.awards.find(a => a.participantKey === participant);
  if (award) return award.route === "DIRECT" ? { stage: "CARD_WON_DIRECT", label: `Tour Card won — Final Stage Day ${award.day} winner`, tone: "gold" }
    : { stage: "CARD_WON_OOM", label: `Tour Card won — Order of Merit ${ordinal(award.orderOfMeritPosition ?? 0)}`, tone: "gold" };
  const inFinal = !!p.participant.finalStageEntry || !!p.participant.orderOfMerit;
  if (p.allocation && (inFinal || p.participant.firstStage.length)) return { stage: "NO_CARD", label: "No Tour Card this year", tone: "muted" };
  if (inFinal) return { stage: "FINAL_STAGE", label: "Final Stage", tone: "warning" };
  if (p.participant.firstStage.length) return { stage: "FIRST_STAGE", label: "First Stage", tone: "info" };
  return { stage: "NOT_ENTERED", label: "Not entered", tone: "muted" };
}

// ---------------------------------------------------------------- finance
export type Headline = { key: "BALANCE" | "EARNINGS" | "SPONSOR" | "EXPENSES"; label: string; pence: number; hint: string };
export function financeHeadlines(f: FinanceSummary): Headline[] {
  return [
    { key: "BALANCE", label: "Balance", pence: f.balancePence, hint: f.reservedForTravelPence > 0 ? `${formatPence(f.availablePence)} available after reserved travel` : "Spendable Career cash" },
    { key: "EARNINGS", label: "Career Earnings", pence: f.careerEarningsPence, hint: "Prize money only" },
    { key: "SPONSOR", label: "Sponsor Earnings", pence: f.sponsorEarningsPence, hint: "Signing, event and performance payments" },
    { key: "EXPENSES", label: "Career Expenses", pence: f.careerExpensesPence, hint: f.sponsorCoveredExpensesPence > 0 ? `${formatPence(f.sponsorCoveredExpensesPence)} more covered by sponsors` : "Fees, travel and accommodation you paid" },
  ];
}
const LEDGER: Record<string, string> = { CAREER_START: "Starting funds", ENTRY_FEE: "Entry fee", TRAVEL: "Travel", ACCOMMODATION: "Accommodation", PRIZE: "Prize money",
  SPONSOR_SIGNING_BONUS: "Sponsor signing bonus", SPONSOR_EVENT_PAYMENT: "Sponsor event payment", SPONSOR_PERFORMANCE_BONUS: "Sponsor performance bonus", REFUND: "Refund", ADJUSTMENT: "Adjustment" };
export const ledgerLabel = (c: string) => LEDGER[c] ?? titleCase(c);
export const LEDGER_FILTERS = [{ key: "ALL", label: "All", categories: null }, { key: "PRIZE", label: "Prize", categories: ["PRIZE"] },
  { key: "SPONSOR", label: "Sponsor", categories: ["SPONSOR_SIGNING_BONUS", "SPONSOR_EVENT_PAYMENT", "SPONSOR_PERFORMANCE_BONUS"] },
  { key: "COSTS", label: "Costs", categories: ["ENTRY_FEE", "TRAVEL", "ACCOMMODATION"] }, { key: "REFUND", label: "Refunds", categories: ["REFUND"] }] as const;

// ---------------------------------------------------------------- milestones (A5 facts, neutral labels; no prose)
const MILESTONES: Record<string, string> = {
  FIRST_RANKING_ENTRY: "First ranking entry", CAREER_HIGH_RANK: "Career-high ranking", WORLD_NUMBER_ONE: "World No.1", RANKING_NUMBER_ONE: "No.1 on a ranking list",
  ENTERED_TOP_100: "Entered top 100", ENTERED_TOP_64: "Entered top 64", ENTERED_TOP_32: "Entered top 32", ENTERED_TOP_16: "Entered top 16", ENTERED_TOP_8: "Entered top 8",
  Q_SCHOOL_FINAL_STAGE_REACHED: "Q-School Final Stage reached", TOUR_CARD_WON: "Tour Card won", TOUR_CARD_RETAINED: "Tour Card retained", TOUR_CARD_LOST: "Tour Card lost",
  TOUR_CARD_REGAINED: "Tour Card regained", TOUR_CARD_SURRENDERED: "Tour Card surrendered", FIRST_PROFESSIONAL_EVENT: "First professional event",
  FIRST_MAJOR: "First major qualification", FIRST_WORLD_CHAMPIONSHIP: "First World Championship qualification",
};
const LISTS: Record<string, string> = { "pro-world": "World Ranking", "pro-circuit": "Pro Circuit", "european-series": "European Series", challenger: "Challenger", vault: "Vault", amateur: "Amateur" };
export const listLabel = (key: string | null | undefined) => key ? LISTS[key] ?? titleCase(key) : "";
export function milestoneLabel(m: Pick<Milestone, "kind" | "list_key" | "detail">): { title: string; detail: string | null; tone: Tone } {
  const title = MILESTONES[m.kind] ?? titleCase(m.kind);
  const d = m.detail ?? {};
  const bits: string[] = [];
  if (m.list_key && m.kind !== "WORLD_NUMBER_ONE") bits.push(listLabel(m.list_key));
  if (typeof d.position === "number") bits.push(ordinal(d.position));
  if (typeof d.eventName === "string") bits.push(d.eventName);
  if (typeof d.pathway === "string") bits.push(d.pathway === "UK_IRELAND" ? "UK & Ireland" : titleCase(d.pathway));
  if (typeof d.source === "string") bits.push(sourceLabel(d.source));
  const tone: Tone = /LOST|SURRENDERED/.test(m.kind) ? "danger" : /WON|REGAINED|NUMBER_ONE|TOP_8|WORLD_CHAMPIONSHIP/.test(m.kind) ? "gold" : "info";
  return { title, detail: bits.length ? bits.join(" · ") : null, tone };
}
const SOURCES: Record<string, string> = { FOUNDING: "Founding member", Q_SCHOOL_DIRECT: "Q-School day winner", Q_SCHOOL_ORDER_OF_MERIT: "Q-School Order of Merit",
  RANKING_RETENTION: "Retained on ranking", CHALLENGER_RANKING: "Challenger ranking" };
export const sourceLabel = (s: string) => SOURCES[s] ?? titleCase(s);

// ---------------------------------------------------------------- career state (factual chapter label, no narrative)
export function careerChapter(s: Pick<SportingSummary, "tourCard" | "worldRanking" | "professionalStatus">, save?: Pick<CareerSave, "status">): { label: string; tone: Tone } {
  if (save?.status === "RETIRED") return { label: "Retired Career", tone: "muted" };
  const pos = s.worldRanking.standing?.position ?? null;
  if (s.tourCard.holdsCard && pos !== null && pos <= 32) return { label: "Established professional", tone: "gold" };
  if (s.tourCard.holdsCard) return { label: pos === null ? "New professional" : "Tour Card professional", tone: "success" };
  if (pos !== null) return { label: "Ranked, no Tour Card", tone: "warning" };
  return { label: "Amateur", tone: "info" };
}

// ---------------------------------------------------------------- qualification routes (structured facts → short lines)
export function routeLines(r: RouteFact): { text: string; met: boolean }[] {
  if (r.type === "ALL" || r.type === "ANY") {
    const parts = (r.parts ?? []).flatMap(routeLines);
    return r.type === "ANY" && parts.length > 1 ? parts.map((p, i) => ({ ...p, text: i === 0 ? p.text : `or ${p.text}` })) : parts;
  }
  if (r.type === "NOT") return (r.inner ? routeLines(r.inner) : []).map(p => ({ text: `Not: ${p.text}`, met: r.met }));
  switch (r.type) {
    case "TOUR_CARD": return [{ text: "Tour Card required", met: r.met }];
    case "NON_TOUR_CARD": return [{ text: "Not open to Tour Card holders", met: r.met }];
    case "RANKING": {
      const where = r.position ? `you are ${ordinal(r.position)}` : "you are unranked";
      const gap = !r.met && r.placesOutside ? ` (${r.placesOutside} place${r.placesOutside === 1 ? "" : "s"} outside)` : "";
      return [{ text: `Top ${r.maxPosition} on ${listLabel(r.list)} — ${where}${gap}`, met: r.met }];
    }
    case "QUALIFICATION": return [{ text: r.held ? "Qualified" : r.qualifierRoutes?.length ? "Qualifier route available" : "Qualification required", met: r.met }];
    case "INVITATION": return [{ text: "Invitation", met: r.met }];
    case "PRO_STATUS": return [{ text: r.required === "AMATEUR" ? "Amateurs only" : "Professionals only", met: r.met }];
    case "OPEN": return [{ text: "Open entry", met: true }];
    case "ZONE": case "COUNTRY": case "LOCALITY": return [{ text: "Region restricted", met: r.met }];
    case "EVENT_RESULT": return [{ text: "Earlier result required", met: r.met }];
    case "DEFENDING_CHAMPION": return [{ text: "Defending champion", met: r.met }];
    default: return [{ text: titleCase(r.type), met: r.met }];
  }
}

// ---------------------------------------------------------------- presentation tiers
export type TierStyle = { accent: string; label: string; emphasis: 0 | 1 | 2 | 3 | 4 | 5; surface: string };
export const TIER_STYLES: Record<PresentationTier, TierStyle> = {
  LOCAL:     { accent: "#94a3b8", label: "Local",     emphasis: 0, surface: "rgba(148,163,184,0.05)" },
  STANDARD:  { accent: "#38bdf8", label: "Standard",  emphasis: 1, surface: "rgba(56,189,248,0.05)" },
  FEATURED:  { accent: "#4ade80", label: "Featured",  emphasis: 2, surface: "rgba(74,222,128,0.06)" },
  TELEVISED: { accent: "#c084fc", label: "Televised", emphasis: 3, surface: "rgba(192,132,252,0.07)" },
  MAJOR:     { accent: "#ff005c", label: "Major",     emphasis: 4, surface: "rgba(255,0,92,0.07)" },
  WORLD:     { accent: "#ffd24a", label: "World",     emphasis: 5, surface: "rgba(255,210,74,0.08)" },
};
export const tierStyle = (t: PresentationTier | string | undefined) => TIER_STYLES[(t as PresentationTier)] ?? TIER_STYLES.STANDARD;
export const TONES: Record<Tone, string> = { neutral: "#cbd5e1", info: "#38bdf8", success: "#4ade80", warning: "#fb923c", danger: "#ff005c", gold: "#ffd24a", muted: "rgba(255,255,255,0.45)" };

// ---------------------------------------------------------------- navigation (three layers)
export type NavItem = { key: string; label: string; path: string };
export const CAREER_NAV: { layer: "HOME" | "MY_CAREER" | "DARTS_WORLD"; label: string; items: NavItem[] }[] = [
  { layer: "HOME", label: "Home", items: [{ key: "home", label: "Home", path: "" }] },
  { layer: "MY_CAREER", label: "My Career", items: [{ key: "journey", label: "Journey", path: "/journey" }, { key: "history", label: "History", path: "/history" }, { key: "finances", label: "Finances", path: "/finances" }] },
  { layer: "DARTS_WORLD", label: "Darts World", items: [{ key: "calendar", label: "Calendar", path: "/calendar" }, { key: "rankings", label: "Rankings", path: "/rankings" },
    { key: "q-school", label: "Q-School", path: "/q-school" }, { key: "world-championship", label: "The Palace", path: "/world-championship" }] },
];
/** The layer (Home / My Career / Darts World) that owns a nav key. */
export function navLayerOf(key: string) {
  return CAREER_NAV.find(s => s.items.some(i => i.key === key)) ?? CAREER_NAV[0];
}
export function activeNavKey(location: string): string {
  const m = /^\/career\/[^/]+(\/[^/]+)?/.exec(location);
  const seg = m?.[1] ?? "";
  if (seg === "/events") return "calendar";
  return CAREER_NAV.flatMap(s => s.items).find(i => i.path === seg)?.key ?? "home";
}

// ---------------------------------------------------------------- saves
export function slotLines(save: CareerSave): { label: string; value: string }[] {
  return [
    { label: "Season", value: `S${save.currentSeason} · Wk ${save.currentWeek}` },
    { label: "World Rank", value: save.professionalRanking ? ordinal(save.professionalRanking) : "Unranked" },
    { label: "Balance", value: formatPence(save.balancePence) },
    { label: "Tour Card", value: save.hasTourCard ? "Active" : "None" },
    { label: "Sponsor", value: save.sponsor ?? "Self-funded" },
  ];
}
export const advanceStopLabel = (reason: string) => ({ TARGET_REACHED: "Week played", MEANINGFUL_DATE: "Stopped at your next important date",
  SEASON_BOUNDARY: "New season", HUMAN_MATCH_PENDING: "Your match is ready", LIMIT: "Advanced" } as Record<string, string>)[reason] ?? titleCase(reason);

// ---------------------------------------------------------------- formats (describes A3's stored format; never executes it)
export function formatLabel(f: CareerEvent["format"] | undefined | null): string {
  if (!f) return "";
  const game = f.gameType === "X01" ? `${f.startingScore ?? 501}` : titleCase(f.gameType);
  const legs = f.stages[0]?.bestOfByRound ?? [];
  // A3 stores the scoring unit explicitly (LEGS | SETS); sets formats are not executable yet.
  const unit = f.scoringUnit === "SETS" || f.setPlay ? "sets" : "legs";
  const range = legs.length ? (Math.min(...legs) === Math.max(...legs) ? `best of ${legs[0]} ${unit}` : `best of ${Math.min(...legs)}–${Math.max(...legs)} ${unit}`) : "";
  const structure = f.structure === "KNOCKOUT" ? "knockout" : titleCase(f.structure);
  return [game, structure, range, f.sideSize > 1 ? "pairs" : ""].filter(Boolean).join(" · ");
}
export const pathwayLabel = (p: string) => p === "UK_IRELAND" ? "UK & Ireland" : p === "EUROPE" ? "Europe" : titleCase(p);

// ---------------------------------------------------------------- tournament lifecycle (from persisted A3 draw/results only)
export type LifecycleKey = "UNSUPPORTED" | "CANCELLED" | "PRE_ENTRY" | "ENTERED" | "DRAW" | "ACTIVE" | "ELIMINATED" | "COMPLETED";
export function eventLifecycle(d: { event: CareerEvent; draw: { matches: { a: { key: string } | null; b: { key: string } | null; status: string; winnerKey: string | null }[] } }): { key: LifecycleKey; label: string; tone: Tone } {
  const e = d.event;
  if (!e.capability.executable || e.statusReason === "UNSUPPORTED_FORMAT") return { key: "UNSUPPORTED", label: "Format not playable yet", tone: "muted" };
  if (e.status === "CANCELLED") return { key: "CANCELLED", label: "Cancelled", tone: "muted" };
  const inField = d.draw.matches.some(m => m.a?.key === "HUMAN" || m.b?.key === "HUMAN");
  const lost = d.draw.matches.some(m => (m.a?.key === "HUMAN" || m.b?.key === "HUMAN") && (m.status === "COMPLETED" || m.status === "WALKOVER") && m.winnerKey !== null && m.winnerKey !== "HUMAN");
  if (e.status === "COMPLETED") return lost || !inField ? { key: "COMPLETED", label: "Completed", tone: "info" } : { key: "COMPLETED", label: "Completed — champion", tone: "gold" };
  if (inField && lost) return { key: "ELIMINATED", label: "Eliminated", tone: "danger" };
  if (e.status === "IN_PROGRESS") return { key: "ACTIVE", label: inField ? "In play — you are still in" : "In progress", tone: "warning" };
  if (e.status === "DRAWN" || e.status === "DRAW_PENDING") return { key: "DRAW", label: "Draw made", tone: "info" };
  if (e.human && ["ENTERED", "CONFIRMED"].includes(e.human.relationship)) return { key: "ENTERED", label: "Entered", tone: "success" };
  return { key: "PRE_ENTRY", label: e.status === "REGISTRATION_OPEN" ? "Entries open" : e.status === "SCHEDULED" ? `Entries open week ${e.registration.opensWeek}` : "Entries closed", tone: "neutral" };
}
export function roundName(round: number, rounds: number) {
  const remaining = 2 ** (rounds - round + 1);
  return remaining === 2 ? "Final" : remaining === 4 ? "Semi-finals" : remaining === 8 ? "Quarter-finals" : `Last ${remaining}`;
}
export const CALENDAR_STATUS_FILTERS = [
  { key: "ALL", label: "Any status" }, { key: "MINE", label: "Entered" }, { key: "OPEN", label: "Can enter" },
  { key: "BLOCKED", label: "Not qualified" }, { key: "AFFORD", label: "Cannot afford" }, { key: "DONE", label: "Completed" },
] as const;
export function matchesStatusFilter(e: CareerEvent, filter: string): boolean {
  const s = eventStatus(e);
  switch (filter) {
    case "MINE": return ["ENTERED", "IN_PROGRESS", "CHAMPION", "COMPLETED", "WITHDRAWN"].includes(s.key);
    case "OPEN": return s.key === "AVAILABLE" || s.key === "QUALIFIED";
    case "BLOCKED": return s.key === "NOT_QUALIFIED";
    case "AFFORD": return s.key === "CANNOT_AFFORD";
    case "DONE": return ["COMPLETED", "FINISHED", "MISSED", "CHAMPION", "CANCELLED", "UNSUPPORTED"].includes(s.key) && e.status !== "REGISTRATION_OPEN";
    default: return true;
  }
}

/** Human match play is not connected to the TKDL scorer yet (integration checkpoint). The UI must never pretend otherwise. */
export const MATCH_PLAY_STATUS = {
  connected: false,
  reason: "Live Career match play is not connected yet. The TKDL scorer will launch from here once the Career result hand-off is integrated.",
} as const;
