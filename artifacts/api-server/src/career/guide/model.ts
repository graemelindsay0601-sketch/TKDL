/**
 * The Career Guide: one place that tells the player where they are, what they can do today, what they're missing and
 * what the next step is on the path they chose. Pure: the service gathers the facts, this decides what to say.
 */
import type { SportingFacts } from "../finance/sponsors.catalogue.ts";
import { FEE_PROFILES } from "../finance/config.ts";

export type GuideFocus = "OPEN_SCHEDULE" | "AMATEUR_CIRCUIT" | "PROFESSIONAL_PATHWAY" | "MAJOR_QUALIFICATION" | "PRIZE_MONEY" | "DARTCAST_CREATOR";
export type GuideEvent = {
  id: string; name: string; circuit: string; status: string; classification?: string;
  dates: { startWeek: number; startDayOfWeek: number; startDay: number; endDay?: number };
  registration?: { opensWeek: number; closesWeek: number } | null;
  venue?: { city?: string } | null;
  finance?: { estimatedPlayerCostPence?: number; topPrizePence?: number | null; firstPrizePence?: number | null; travelBand?: string } | null;
  human: { canEnter: boolean; eligible: boolean; relationship: string; denials?: string[] } | null;
};
export type GuideStreaming = { tierKey: string; tierName: string; followers: number; nextTier: { name: string; followers: number } | null;
  week: number; scheduledNights: number[]; streamsThisWeek: number; perWeek: number; live: string | null } | null;
export type GuideInput = {
  saveId: string; season: number; balancePence: number; focus: GuideFocus;
  today: { week: number; dayOfWeek: number; phase: "START_OF_WEEK" | "MID_WEEK" };
  facts: SportingFacts;
  sponsorTiers: { tier: string; name: string; met: boolean; signed: boolean }[];
  events: GuideEvent[];
  pendingMatch: { matchId: string; eventId: string; name: string } | null;
  pendingReview?: number | null;
  activeTournament: { eventId: string; name: string } | null;
  booked: { eventId: string; name: string; week: number } | null;
  streaming: GuideStreaming;
  moneyChallenge: { name: string; stakePence: number } | null;
  /** The best sponsor offer waiting on you (they expire if you don't answer). */
  sponsorOffer?: { id: string; name: string; signingBonusPence: number; expiresWeek: number | null; count: number;
    /** A renewal of a deal you have: how much better it is for your titles on it. */
    renewal?: { raisePercent: number; titles: number; termsServed?: number } | null } | null;
  /** Career prize money won so far (for the money path). */
  earningsPence?: number;
  /** How many weeks back "missed" looks (default two; more after a long skip). */
  missedWeeks?: number;
  /** The next event on each circuit after the events window, this season. */
  later?: { circuit: string; id: string; name: string; week: number; opensWeek: number }[];
};
export type GuideAction = { label: string; href?: string; enterEventId?: string };
export type GuideStep = { key: string; title: string; why: string; action: GuideAction; tone: "now" | "soon" | "tip" };
export type GuideStage = { key: string; title: string; unlocks: string; done: boolean; current: boolean; progress: string | null; how: string };

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const dayName = (d: number) => DAY_NAMES[(d - 1 + 7) % 7] ?? "";
const pounds = (p: number) => `£${(p / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
/** Every day an event takes up (a weekend open runs Saturday and Sunday). */
const span = (e: GuideEvent) => { const from = e.dates.startDay, to = Math.max(from, e.dates.endDay ?? from); return Array.from({ length: to - from + 1 }, (_, i) => from + i); };
const clashes = (e: GuideEvent, days: ReadonlySet<number>) => span(e).some(d => days.has(d));
const BOOKED = new Set(["ENTERED", "CONFIRMED", "PLAYING", "COMPLETED"]);
/** Why you can't enter yet, when it's something you can wait out or fix (not closed entries or a locked field). */
const WAITABLE = ["REGISTRATION_NOT_OPEN", "INSUFFICIENT_FUNDS", "SCHEDULE_CONFLICT"];
const LOCAL = ["GRASSROOTS", "LOCAL"], COUNTY = ["COUNTY", "REGIONAL", "NATIONAL_AMATEUR", "SOFT_TIP"], ROAD = ["CHALLENGER", "Q_SCHOOL", "VAULT"],
  PRO = ["PRO_CIRCUIT", "EUROPEAN_SERIES", "WORLD_SERIES"], MAJORS = ["MAJOR", "WORLD_CHAMPIONSHIP"];
const best = (f: SportingFacts, circuits: string[]) => Math.min(Infinity, ...circuits.map(c => f.bestFinishByCircuit[c] ?? Infinity));
const playedAnything = (f: SportingFacts) => f.titles > 0 || Object.keys(f.bestFinishByCircuit).length > 0;
const ranked = (f: SportingFacts) => f.worldRanking !== null && f.worldRanking < 100_000 ? f.worldRanking : null;

type StageDef = { key: string; title: string; unlocks: string; how: string; circuits: string[]; done: (f: SportingFacts, s: GuideStreaming, earnings: number) => boolean;
  progress?: (f: SportingFacts, s: GuideStreaming, earnings: number) => string | null };
const DARTS: StageDef[] = [
  { key: "first-event", title: "Play your first event", unlocks: "Your first results, ranking-point history and form.", how: "Enter a local event: they're cheap and near home.",
    circuits: LOCAL, done: playedAnything },
  { key: "first-title", title: "Win a local title", unlocks: "Local sponsors start calling.", how: "Keep entering local events: pub nights, leagues and knockouts.",
    circuits: LOCAL, done: f => f.titles >= 1, progress: f => `${f.titles} of 1 won` },
  { key: "three-titles", title: "Win three titles", unlocks: "Regional sponsors, and county selectors notice you.", how: "Local and county events both count.",
    circuits: [...LOCAL, ...COUNTY], done: f => f.titles >= 3, progress: f => `${Math.min(f.titles, 3)} of 3 won` },
  { key: "county-final", title: "Reach a county, regional or national final", unlocks: "Proves you can go beyond the pub: the road to the tour opens up.",
    how: "Enter county, regional and national amateur events.", circuits: COUNTY, done: f => best(f, COUNTY) <= 2,
    progress: f => { const b = best(f, COUNTY); return Number.isFinite(b) ? `best so far: ${b === 1 ? "won" : `top ${b}`}` : "not played one yet"; } },
  { key: "road", title: "Play the road to the tour", unlocks: "Challenger, Vault and Q-School results are how amateurs earn a Tour Card.",
    how: "Enter a Challenger or Vault event, or Q-School when it opens.", circuits: ROAD, done: f => Number.isFinite(best(f, ROAD)) || !!f.tourCard },
  { key: "tour-card", title: "Earn a Tour Card", unlocks: "Pro Tour events, professional sponsors and the world rankings.",
    how: "Win through Q-School, or finish high on the Challenger Tour.", circuits: ["Q_SCHOOL", "CHALLENGER"], done: f => !!f.tourCard },
  { key: "top-64", title: "Break into the world top 64", unlocks: "Invitations to the bigger televised events.", how: "Play Pro Tour ranking events: ranking points come from results.",
    circuits: PRO, done: f => (ranked(f) ?? Infinity) <= 64, progress: f => ranked(f) ? `you're #${ranked(f)}` : "not ranked yet" },
  { key: "major-final", title: "Reach a major final", unlocks: "Elite sponsors and the big stages.", how: "Qualify for majors through your ranking and qualifiers.",
    circuits: MAJORS, done: f => best(f, MAJORS) <= 2 },
  { key: "world-champion", title: "Win the World Championship", unlocks: "The top of the game.", how: "Qualify for the World Championship and win it.",
    circuits: ["WORLD_CHAMPIONSHIP"], done: f => (f.bestFinishByCircuit.WORLD_CHAMPIONSHIP ?? Infinity) === 1 },
];
const AMATEUR: StageDef[] = [...DARTS.slice(0, 4),
  { key: "national-title", title: "Win a national amateur title", unlocks: "The best amateur honours and the biggest amateur prizes.",
    how: "Enter national amateur events.", circuits: ["NATIONAL_AMATEUR"], done: f => (f.bestFinishByCircuit.NATIONAL_AMATEUR ?? Infinity) === 1 },
  { key: "vault-title", title: "Win a Vault event", unlocks: "The top of the amateur scene.", how: "Enter Vault Nights.", circuits: ["VAULT"],
    done: f => (f.bestFinishByCircuit.VAULT ?? Infinity) === 1 },
];
const tierStage = (key: string, name: string, followers: number, unlocks: string): StageDef => ({ key: `tier-${key}`, title: `Reach ${name} on DartCast`, unlocks,
  how: "Go live regularly, post Shorts and clips, play the Creator Cups.", circuits: [],
  done: (_f, s) => !!s && s.followers >= followers, progress: (_f, s) => s ? `${s.followers.toLocaleString("en-GB")} of ${followers.toLocaleString("en-GB")} followers` : null });
const CREATOR: StageDef[] = [
  { key: "open-dartcast", title: "Open your DartCast channel", unlocks: "Streaming: an audience, tips and brand deals.", how: "Open DartCast and go live once.",
    circuits: [], done: (_f, s) => !!s },
  tierStage("AFFILIATE", "Affiliate", 50, "Ad revenue, bits and super chats."),
  tierStage("PARTNER", "Partner", 1000, "Paid memberships and brand partners."),
  tierStage("STAR", "Star", 25000, "The biggest audiences and tips."),
  tierStage("ICON", "Icon", 100000, "More brand partners and bigger cup prizes."),
  tierStage("LEGEND", "Legend", 500000, "The biggest name in darts streaming."),
];
const moneyStage = (pence: number, unlocks: string, how: string, circuits: string[]): StageDef => ({ key: `prize-${pence}`,
  title: pence <= 100 ? "Win your first prize money" : `Win ${pounds(pence)} in prize money`, unlocks, how, circuits,
  done: (_f, _s, e) => e >= pence, progress: (_f, _s, e) => `${pounds(e)} won so far` });
const MONEY: StageDef[] = [
  moneyStage(100, "Proof the darts can pay.", "Local events with a cash prize: check the first prize before you enter.", [...LOCAL]),
  moneyStage(10_000, "Your entry fees start paying for themselves.", "Local and county events with decent prizes; money matches at your club help too.", [...LOCAL, ...COUNTY]),
  moneyStage(100_000, "A real second income.", "County and national amateur events, and Vault nights.", [...COUNTY, "VAULT"]),
  moneyStage(1_000_000, "A living from darts.", "Challenger and Pro Tour events: bigger prizes, bigger costs.", [...ROAD, ...PRO]),
  moneyStage(10_000_000, "Rich from darts.", "Majors and televised events.", [...PRO, ...MAJORS]),
];
export const PATHS: Record<GuideFocus, { label: string; blurb: string; stages: StageDef[] }> = {
  OPEN_SCHEDULE: { label: "See how far you get", blurb: "No fixed plan: the guide follows the darts ladder and points out anything good.", stages: DARTS },
  AMATEUR_CIRCUIT: { label: "Amateur star", blurb: "Be the best player around without turning pro: local, county and national titles.", stages: AMATEUR },
  PROFESSIONAL_PATHWAY: { label: "Turn pro", blurb: "Earn a Tour Card and climb the world rankings.", stages: DARTS },
  MAJOR_QUALIFICATION: { label: "Chase the majors", blurb: "Get to the big televised events and win one.", stages: DARTS },
  PRIZE_MONEY: { label: "Make it pay", blurb: "Play where the prize money is worth the trip.", stages: MONEY },
  DARTCAST_CREATOR: { label: "Darts creator", blurb: "Build a DartCast channel; play darts for the content.", stages: CREATOR },
};

/** Near home: a local night out or a domestic trip (an amateur doesn't fly to Galway for a Monday knockout). */
const near = (e: GuideEvent) => !e.finance?.travelBand || ["LOCAL", "DOMESTIC"].includes(e.finance.travelBand);
const BAND_RANK: Record<string, number> = { LOCAL: 0, DOMESTIC: 1, UK_IRELAND: 2, EUROPE: 3, LONG_HAUL: 4 };
/** Best first: this week before later weeks, then nearest, then cheapest, then soonest. */
const sensible = (a: GuideEvent, b: GuideEvent) => a.dates.startWeek - b.dates.startWeek || (BAND_RANK[a.finance?.travelBand ?? "LOCAL"] ?? 0) - (BAND_RANK[b.finance?.travelBand ?? "LOCAL"] ?? 0)
  || (a.finance?.estimatedPlayerCostPence ?? 0) - (b.finance?.estimatedPlayerCostPence ?? 0) || a.dates.startDay - b.dates.startDay;
/** What an event could pay you over what it costs (its top prize less your costs). */
const worth = (e: GuideEvent) => (e.finance?.topPrizePence ?? e.finance?.firstPrizePence ?? 0) - (e.finance?.estimatedPlayerCostPence ?? 0);
const open = (e: GuideEvent) => !!e.human?.canEnter && !["COMPLETED", "CANCELLED"].includes(e.status);
const when = (e: GuideEvent) => `Wk ${e.dates.startWeek} ${dayName(e.dates.startDayOfWeek).slice(0, 3)}`;
const cost = (e: GuideEvent) => e.finance?.estimatedPlayerCostPence ? ` · about ${pounds(e.finance.estimatedPlayerCostPence)}` : " · free";

export function buildGuide(g: GuideInput) {
  const base = `/career/${g.saveId}`, path = PATHS[g.focus] ?? PATHS.OPEN_SCHEDULE;
  // ---- the path: every stage, the first not done is the current one
  let currentSeen = false;
  const stages: GuideStage[] = path.stages.map(st => {
    const earned = g.earningsPence ?? 0, done = st.done(g.facts, g.streaming, earned), current = !done && !currentSeen;
    if (current) currentSeen = true;
    return { key: st.key, title: st.title, unlocks: st.unlocks, done, current, progress: st.progress?.(g.facts, g.streaming, earned) ?? null, how: st.how };
  });
  const currentDef = path.stages.find(st => !st.done(g.facts, g.streaming, g.earningsPence ?? 0)) ?? null;
  const fits = (e: GuideEvent) => !!currentDef && currentDef.circuits.includes(e.circuit);
  // How far it's sensible to go, and what to spend, for the step you're on: a pub-level step stays local and cheap; a
  // county step can travel in the UK; tour-level steps on the pro or majors paths can go further.
  const stageCircuits = currentDef?.circuits ?? [];
  const localStage = stageCircuits.length > 0 && stageCircuits.every(c => LOCAL.includes(c));
  const countyStage = stageCircuits.length > 0 && stageCircuits.every(c => [...LOCAL, ...COUNTY, "VAULT"].includes(c));
  const bands = localStage ? ["LOCAL"] : countyStage || !["PROFESSIONAL_PATHWAY", "MAJOR_QUALIFICATION"].includes(g.focus) ? ["LOCAL", "DOMESTIC"] : Object.keys(BAND_RANK);
  // Low on money (under £50): only free or very cheap nights, so the career never spends itself to nothing.
  const spendCap = g.balancePence < 5_000 ? 500 : localStage ? Math.max(2_000, g.balancePence * 0.25) : g.balancePence * 0.6;
  const sensibleTripLocal = (e: GuideEvent) => (e.finance?.travelBand ?? "LOCAL") === "LOCAL" && (e.finance?.estimatedPlayerCostPence ?? 0) <= Math.min(spendCap, 2_000);
  const sensibleTrip = (e: GuideEvent) => bands.includes(e.finance?.travelBand ?? "LOCAL") && (e.finance?.estimatedPlayerCostPence ?? 0) <= spendCap;

  // ---- today
  const { week, dayOfWeek, phase } = g.today;
  const upcoming = g.events.filter(open).sort((a, b) => a.dates.startDay - b.dates.startDay);
  const todayEvents = phase === "START_OF_WEEK" ? upcoming.filter(e => e.dates.startWeek === week && e.dates.startDayOfWeek === dayOfWeek) : [];
  const restOfWeek = upcoming.filter(e => e.dates.startWeek === week && (phase === "MID_WEEK" ? false : e.dates.startDayOfWeek > dayOfWeek));
  const bookedThisWeek = g.events.some(e => e.dates.startWeek === week && e.human && BOOKED.has(e.human.relationship) && e.status !== "CANCELLED");
  const waitingOn: GuideAction[] = [];
  if (g.pendingMatch) waitingOn.push({ label: `Your match in ${g.pendingMatch.name}`, href: `${base}/matches/${g.pendingMatch.matchId}/play` });
  const streamDays = g.streaming && g.streaming.week === week && !g.streaming.live && g.streaming.streamsThisWeek < g.streaming.scheduledNights.length
    ? g.streaming.scheduledNights : [];
  if (g.streaming?.live) waitingOn.push({ label: "Your DartCast stream (you're live)", href: `${base}/streaming/${g.streaming.live}` });
  else if (streamDays.length && phase === "MID_WEEK") waitingOn.push({ label: `Your booked DartCast show (${streamDays.map(d => dayName(d).slice(0, 3)).join(", ")})`, href: `${base}/streaming#go-live` });
  const headline = g.pendingReview ? `Season ${g.pendingReview} is over: read your review to start the new season.` : phase === "MID_WEEK"
    ? waitingOn.length ? `The rest of week ${week} has been played. It's waiting on you.` : `Week ${week} is done. Play on to start week ${week + 1}.`
    : bookedThisWeek ? `Week ${week} is planned. Play on when you're ready.` : upcoming.some(e => e.dates.startWeek === week)
      ? `Nothing booked yet this week: ${upcoming.filter(e => e.dates.startWeek === week).length} events you could enter.` : `Nothing to enter this week: try a local night or plan next week.`;

  // ---- what you missed (the last two weeks, events that fitted your path and you could have played)
  // Missed: near home, on a night you had nothing else on (an event across the country, or on a night you played, isn't missed).
  const busyDays = new Set(g.events.filter(e => e.human && BOOKED.has(e.human.relationship)).flatMap(span));
  const missed = g.events.filter(e => e.status === "COMPLETED" && e.dates.startWeek >= week - (g.missedWeeks ?? 2) && e.dates.startWeek <= week && e.human?.eligible
    && (e.finance?.travelBand ?? "LOCAL") === "LOCAL" && !clashes(e, busyDays)
    && !BOOKED.has(e.human.relationship) && (e.human.denials ?? []).every(d => ["EVENT_FINISHED", "REGISTRATION_CLOSED", "FIELD_LOCKED", "INSUFFICIENT_FUNDS"].includes(d))
    && currentDef?.circuits.includes(e.circuit))
    .sort((a, b) => b.dates.startDay - a.dates.startDay).slice(0, 5)
    .map(e => ({ id: e.id, name: e.name, week: e.dates.startWeek, when: when(e), why: `It fitted your next step: ${currentDef!.title.toLowerCase()}.` }));
  const affordable = (e: GuideEvent) => (e.finance?.estimatedPlayerCostPence ?? 0) <= g.balancePence;
  const closing = upcoming.filter(e => (e.registration?.closesWeek ?? e.dates.startWeek) === week && (fits(e) || !stageCircuits.length) && sensibleTrip(e) && affordable(e)).sort(sensible).slice(0, 4)
    .map(e => ({ id: e.id, name: e.name, when: when(e), href: `${base}/events/${e.id}` }));

  // ---- next steps: at most three, the most pressing first
  const steps: GuideStep[] = [];
  const add = (s: GuideStep) => {
    const ev = s.action.enterEventId;
    if (steps.length < 3 && !steps.some(x => x.key === s.key || (ev && x.action.enterEventId === ev))) steps.push(s);
  };
  if (g.pendingReview) add({ key: "review", tone: "now", title: `Read your Season ${g.pendingReview} review`, why: "The new season starts once you've read it.",
    action: { label: "Read it", href: `${base}/my-career/history` } });
  if (g.pendingMatch) add({ key: "match", tone: "now", title: `Play your match: ${g.pendingMatch.name}`, why: "Nothing else moves until it's played.",
    action: { label: "Play it", href: `${base}/matches/${g.pendingMatch.matchId}/play` } });
  else if (g.activeTournament) add({ key: "tournament", tone: "now", title: `Back to ${g.activeTournament.name}`, why: "You're in a tournament.", action: { label: "Open it", href: `${base}/tournaments/${g.activeTournament.eventId}` } });
  for (const w of waitingOn.filter(w => !w.label.startsWith("Your match"))) add({ key: `wait:${w.label}`, tone: "now", title: w.label, why: "The week is waiting for it.", action: { label: "Go", href: w.href } });
  // Booked DartCast shows this week: Continue stops for each, so say so up front (not only once the week is waiting).
  if (!g.streaming?.live && streamDays.length && phase === "START_OF_WEEK")
    add({ key: "shows", tone: "soon", title: `Your DartCast show${streamDays.length > 1 ? "s" : ""} this week: ${streamDays.map(d => dayName(d).slice(0, 3)).join(", ")}`,
      why: "You booked them: Continue stops on each night until you've gone live.", action: { label: "Go live", href: `${base}/streaming#go-live` } });
  // An invitation or qualification you hold, on any path: these are the free (or nearly free) nights with real prize
  // money and silverware, and the easiest to let slip by.
  const invite = upcoming.filter(e => e.human?.canEnter && !BOOKED.has(e.human.relationship) && affordable(e)
      && (e.human.relationship === "QUALIFIED" || (e.classification === "INVITATIONAL_EXHIBITION" && !LOCAL.includes(e.circuit))))
    .sort((a, b) => (b.finance?.topPrizePence ?? b.finance?.firstPrizePence ?? 0) - (a.finance?.topPrizePence ?? a.finance?.firstPrizePence ?? 0) || a.dates.startDay - b.dates.startDay)[0];
  if (invite) { const fee = invite.finance?.estimatedPlayerCostPence ?? 0, top = invite.finance?.topPrizePence ?? invite.finance?.firstPrizePence ?? 0;
    add({ key: `invite:${invite.id}`, tone: "soon", title: `You're in: ${invite.name}`,
      why: `${when(invite)} · ${fee ? `about ${pounds(fee)} with travel` : "free to enter"}${top ? ` · ${pounds(top)} to the winner` : ""}. ${invite.human!.relationship === "QUALIFIED" ? "You qualified for it" : "An invitation"}: enter before entries close.`,
      action: { label: "Enter", enterEventId: invite.id, href: `${base}/events/${invite.id}` } }); }
  if (g.sponsorOffer) { const o = g.sponsorOffer, last = o.expiresWeek != null && o.expiresWeek <= week;
    const r = o.renewal, reasons = r ? [r.titles ? `${r.titles} title${r.titles === 1 ? "" : "s"}` : "", r.termsServed ? `${r.termsServed} term${r.termsServed === 1 ? "" : "s"} loyal` : ""].filter(Boolean) : [];
    const raise = r?.raisePercent ? ` (+${r.raisePercent}%: ${reasons.join(", ")})` : "";
    add({ key: `sponsor-offer:${o.id}`, tone: last ? "now" : "soon", title: o.renewal ? `${o.name} wants to renew your deal${raise}` : `${o.name} wants to sign you`,
      why: `${o.signingBonusPence > 0 ? `${pounds(o.signingBonusPence)} ${r ? "loyalty bonus" : "for signing"}, ` : ""}help with your costs and bonuses for results. ${last ? "Last week to answer" : o.expiresWeek == null ? "Open into next season" : `Open until week ${o.expiresWeek}`}${o.count > 1 ? ` · ${o.count} offers waiting` : ""}.`,
      action: { label: "See the offer", href: `${base}/sponsors` } }); }
  if (g.moneyChallenge) add({ key: "money", tone: "soon", title: `${g.moneyChallenge.name} has challenged you`, why: `A money match for ${pounds(g.moneyChallenge.stakePence)} each, this week only.`, action: { label: "Answer", href: `${base}/money-matches` } });
  for (const c of closing.slice(0, 1)) { const ev = g.events.find(e => e.id === c.id);
    add({ key: `closing:${c.id}`, tone: "soon", title: `Last week to enter ${c.name}`, why: `${c.when}${ev ? cost(ev) : ""}.${ev && fits(ev) ? " It fits your next step." : " A cheap night of darts near home."}`,
      action: { label: "Enter", enterEventId: c.id, href: c.href } }); }
  /** Nights already taken by an earlier suggestion: one event a night (you can't play two on the same night). */
  const takenDays = () => new Set(steps.flatMap(st => { const e = g.events.find(x => x.id === st.action.enterEventId); return e ? span(e) : []; }));
  const fitting = (currentDef?.circuits.length ? upcoming.filter(e => currentDef.circuits.includes(e.circuit)) : [])
    .filter(e => affordable(e) && sensibleTrip(e)).sort(sensible);
  // Make it pay: the best prize for the cost; every other path: the soonest event that fits.
  const pathPick = g.focus === "PRIZE_MONEY"
    ? [...fitting].filter(e => (e.finance?.estimatedPlayerCostPence ?? 0) === 0 || (e.finance?.topPrizePence ?? e.finance?.firstPrizePence ?? 0) >= 6 * (e.finance?.estimatedPlayerCostPence ?? 0))
        .filter(e => !clashes(e, takenDays()) || steps.some(st => st.action.enterEventId === e.id)).sort((a, b) => worth(b) - worth(a))[0]
    : fitting.find(e => !steps.some(st => st.action.enterEventId === e.id) && !clashes(e, takenDays()))
      ?? fitting.find(e => steps.some(st => st.action.enterEventId === e.id));
  const suggest = (e: GuideEvent) => add({ key: `path:${e.id}`, tone: "soon", title: `Enter ${e.name}`, why: `${when(e)}${cost(e)}. Your next step: ${currentDef!.title.toLowerCase()}.`,
    action: { label: "Enter", enterEventId: e.id, href: `${base}/events/${e.id}` } });
  const committed = () => steps.reduce((a, st) => a + (g.events.find(e => e.id === st.action.enterEventId)?.finance?.estimatedPlayerCostPence ?? 0), 0);
  if (pathPick && (steps.some(st => st.action.enterEventId === pathPick.id) || committed() + (pathPick.finance?.estimatedPlayerCostPence ?? 0) <= spendCap)) {
    suggest(pathPick);
    // A second night this week if there's one: a different day from anything already suggested.
    const taken = takenDays();
    // ...and within what's left of the week's sensible spend once the earlier picks are paid for.
    const spent = committed();
    const second = fitting.find(e => e.dates.startWeek === week && !clashes(e, taken) && e.id !== pathPick.id
      && spent + (e.finance?.estimatedPlayerCostPence ?? 0) <= spendCap);
    if (second && !bookedThisWeek) suggest(second);
  }
  else if (currentDef && !currentDef.circuits.length) add({ key: "creator", tone: "soon", title: currentDef.title, why: currentDef.how, action: { label: "Open DartCast", href: `${base}/streaming` } });
  else if (currentDef) {
    // Nothing on your path you can enter now: say exactly why (cost, when entries open), and keep you playing locally.
    const blocked = g.events.filter(e => e.status !== "COMPLETED" && e.status !== "CANCELLED" && e.dates.startWeek >= week && currentDef.circuits.includes(e.circuit)
      && e.human?.eligible && !e.human.canEnter && (e.human.denials ?? []).length > 0 && (e.human.denials ?? []).every(d => WAITABLE.includes(d)))
      .sort((a, b) => a.dates.startDay - b.dates.startDay);
    const next = blocked[0], nextCost = next?.finance?.estimatedPlayerCostPence ?? 0;
    const opens = next && (next.human?.denials ?? []).includes("REGISTRATION_NOT_OPEN") ? next.registration?.opensWeek : undefined;
    const short = next && nextCost > g.balancePence;
    // Nothing in the next few weeks: name the next event on the path this season, or say the path picks up next season.
    // (Not a circuit you're shut out of: if every one of its events in view says you can't play, its later ones won't either.)
    const shutOut = (circuit: string) => { const seen = g.events.filter(e => e.circuit === circuit && e.human);
      return seen.length > 0 && seen.every(e => e.human && !e.human.eligible); };
    const later = next ? undefined : (g.later ?? []).filter(l => currentDef.circuits.includes(l.circuit) && !shutOut(l.circuit)).sort((a, b) => a.week - b.week)[0];
    const meanwhile = "Until then, local nights and money matches keep your form sharp and your bank balance up.";
    add({ key: "path-none", tone: "tip",
      title: next ? `${next.name}: ${short ? "save up for it" : opens ? `entries open week ${opens}` : "you're booked that night"}`
        : later ? `${currentDef.title}: next chance week ${later.week}` : `${currentDef.title}: nothing more this season`,
      why: next ? `${when(next)}, about ${pounds(nextCost)} to play${short ? `. You have ${pounds(g.balancePence)}: local nights and money matches can make up the difference` : ""}.`
        : later ? `${later.name} is in week ${later.week}${later.opensWeek > week ? `; entries open week ${later.opensWeek}` : ""}. ${meanwhile}`
        : currentDef.circuits.includes("Q_SCHOOL")
          ? `Q-School comes round at the start of next season (weeks 2 to 4): about ${pounds(FEE_PROFILES["fee:q_school"].entryFeePence)} to enter, plus travel, so start saving now. ${meanwhile}`
          : `${currentDef.how} The next chances come next season. ${meanwhile}`,
      action: next ? { label: "Have a look", href: `${base}/events/${next.id}` } : later ? { label: "Have a look", href: `${base}/events/${later.id}` } : { label: "Calendar", href: `${base}/calendar` } });
    const local = upcoming.filter(e => e.dates.startWeek === week && LOCAL.includes(e.circuit) && affordable(e) && sensibleTripLocal(e) && !clashes(e, takenDays())).sort(sensible)[0];
    if (local) add({ key: `keep-playing:${local.id}`, tone: "soon", title: `Meanwhile: ${local.name}`, why: `${when(local)}${cost(local)}. Keeps your form up and can win you entry money.`,
      action: { label: "Enter", enterEventId: local.id, href: `${base}/events/${local.id}` } });
  }
  if (!bookedThisWeek && phase === "START_OF_WEEK" && upcoming.some(e => e.dates.startWeek === week))
    add({ key: "plan", tone: "tip", title: "Plan this week", why: "Pick a night for each thing you want to do before you play on.", action: { label: "Plan it", href: `${base}#week-planner` } });
  // Sponsor tiers you reach are announced once in the inbox (a weekly reminder here only nagged).

  return {
    today: { season: g.season, week, dayOfWeek, dayName: dayName(dayOfWeek), phase, headline, waitingOn,
      options: todayEvents.slice(0, 4).map(e => ({ id: e.id, name: e.name, detail: `${e.venue?.city ?? ""}${cost(e)}`.replace(/^ · /, ""), fits: fits(e) })),
      laterThisWeek: restOfWeek.length },
    path: { focus: g.focus, label: path.label, blurb: path.blurb, stages,
      current: stages.find(s => s.current) ?? null, done: stages.filter(s => s.done).length, total: stages.length,
      /** Circuits that move the current step on (for "fits your path" on event pages). */
      circuits: currentDef?.circuits ?? [] },
    paths: Object.entries(PATHS).map(([key, p]) => ({ key: key as GuideFocus, label: p.label, blurb: p.blurb })),
    nextSteps: steps, missed, closing,
  };
}
export type GuideView = ReturnType<typeof buildGuide>;
