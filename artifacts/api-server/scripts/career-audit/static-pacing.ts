/**
 * DEV-ONLY static calendar pacing audit (pure; no database). Generates the CURRENT
 * event database (v5) season calendars with the real generator and evaluates the real
 * eligibility rules for LABELLED representative player states (fixtures: ranks and
 * entitlements are assumed, not earned). Costs use the real A4 fee/travel/prize tables
 * and travel bands for a new save (travel version 2) from Ayrshire.
 *
 * "Meaningful" = executable, enterable (rules + registration), RANKING or QUALIFIER, and
 * not a club/county night outside the player's own county catchment.
 *
 *   node scripts/career-audit/static-pacing.ts [--seasons=1,2,3,5,10,15,20]
 */
import { generateSeason, type EventInstanceDraft } from "../../src/career/calendar/generation.ts";
import { evaluateRule, type ParticipantFacts } from "../../src/career/calendar/eligibility.ts";
import { COUNTY_CATCHMENTS } from "../../src/career/calendar/geography.ts";
import { FEE_PROFILES, FEE_OVERRIDES, PRIZE_PROFILES, PRIZE_OVERRIDES } from "../../src/career/finance/config.ts";
import { travelBand, tripCost } from "../../src/career/finance/travel.ts";
import { HARNESS_SEED } from "../../src/career/world/harness.ts";

const VERSION = Number(process.argv.find(a => a.startsWith("--version="))?.slice(10) ?? 5);
const seasons = (process.argv.find(a => a.startsWith("--seasons="))?.slice(10) ?? "1,2,3,5,10,15,20").split(",").map(Number);
const home = { locality: "ayrshire", country: "GBR", zone: "UK_IRELAND", travelVersion: 2 };

type State = { label: string; facts: Omit<ParticipantFacts, "results" | "defendingChampion" | "invited"> };
const base = { key: "HUMAN", kind: "HUMAN" as const, country: "GBR", zone: "UK_IRELAND" as const, locality: "ayrshire", age: 25, womenEligible: false };
const STATES: State[] = [
  { label: "A_newAmateur", facts: { ...base, professionalStatus: "AMATEUR", tourCard: false, rankings: {}, entitlementTargets: new Set() } },
  { label: "B_qSchoolEntrant", facts: { ...base, professionalStatus: "AMATEUR", tourCard: false, rankings: { amateur: 20, "open-world": 30 }, entitlementTargets: new Set(["challenger-tour"]) } },
  { label: "C_newPro", facts: { ...base, professionalStatus: "PROFESSIONAL", tourCard: true, rankings: {}, entitlementTargets: new Set() } },
  { label: "C2_pro_rank50", facts: { ...base, professionalStatus: "PROFESSIONAL", tourCard: true, rankings: { "pro-world": 50, "pro-circuit": 50, "european-series": 60 }, entitlementTargets: new Set() } },
  { label: "D_champion_rank1", facts: { ...base, professionalStatus: "PROFESSIONAL", tourCard: true, rankings: { "pro-world": 1, "pro-circuit": 1, "european-series": 1 }, entitlementTargets: new Set() } },
];

const feeOf = (d: EventInstanceDraft) => (FEE_OVERRIDES[d.definitionKey] ?? FEE_PROFILES[d.snapshot.profiles.entryFee])?.entryFeePence ?? 0;
const topPrizeOf = (d: EventInstanceDraft) => (PRIZE_OVERRIDES[d.definitionKey] ?? PRIZE_PROFILES[d.snapshot.profiles.prize])?.bands[0]?.amountPence ?? 0;
const costOf = (d: EventInstanceDraft) => {
  const band = travelBand(home, { locality_key: d.localityKey, venue_key: d.venueKey, country: d.country, zone: d.zone });
  const trip = tripCost(band, d.endDay - d.startDay + 1);
  return { band, cost: feeOf(d) + trip.travelPence + trip.accommodationPence };
};

const report: any = {};
for (const season of seasons) {
  const drafts = generateSeason(HARNESS_SEED, VERSION, season);
  const catchment = new Set(COUNTY_CATCHMENTS[home.locality] ?? []);
  const perState: any = {};
  for (const st of STATES) {
    const facts: ParticipantFacts = { ...st.facts, invited: false, results: { SAME: new Map(), PREVIOUS: new Map() }, defendingChampion: false };
    const weeks = Array.from({ length: 52 }, (_, i) => i + 1).map(week => {
      const starting = drafts.filter(d => d.startWeek === week);
      const eligible = starting.filter(d => d.executable && evaluateRule(d.snapshot.eligibility, facts).eligible);
      const meaningful = eligible.filter(d => ["RANKING", "QUALIFIER"].includes(d.classification) && !(d.localityKey && ["GRASSROOTS", "COUNTY"].includes(d.circuit) && !catchment.has(d.localityKey)) && !(d.circuit === "SPECIAL"));
      const local = meaningful.filter(d => costOf(d).band === "LOCAL");
      const cheap = meaningful.filter(d => costOf(d).cost <= 2500);
      const worthTrip = meaningful.filter(d => { const c = costOf(d); return c.band === "LOCAL" || topPrizeOf(d) >= 2 * c.cost; });
      // overlapping meaningful options (by day) = genuine scheduling choice
      let clashes = 0;
      for (let i = 0; i < meaningful.length; i++) for (let j = i + 1; j < meaningful.length; j++)
        if (meaningful[i].startDay <= meaningful[j].endDay && meaningful[j].startDay <= meaningful[i].endDay && meaningful[i].seriesKey !== meaningful[j].seriesKey) clashes++;
      return { week, all: starting.length, eligible: eligible.length, meaningful: meaningful.length, local: local.length, cheap: cheap.length, worthTrip: worthTrip.length, clashes,
        circuits: [...new Set(meaningful.map(d => d.circuit))].join("+"), topPrizeMax: Math.max(0, ...meaningful.map(topPrizeOf)) / 100 };
    });
    const ranking = (w: typeof weeks[number]) => w.meaningful;
    perState[st.label] = {
      weeksWithZeroMeaningful: weeks.filter(w => ranking(w) === 0).map(w => w.week),
      weeksWithZeroWorthwhile: weeks.filter(w => w.worthTrip === 0).map(w => w.week),
      weeksWithClashes: weeks.filter(w => w.clashes > 0).length,
      meaningfulPerWeek: { mean: +(weeks.reduce((t, w) => t + w.meaningful, 0) / 52).toFixed(2), max: Math.max(...weeks.map(w => w.meaningful)) },
      localPerWeekMean: +(weeks.reduce((t, w) => t + w.local, 0) / 52).toFixed(2),
      byCircuitSeason: Object.fromEntries(Object.entries(weeks.flatMap(w => w.circuits.split("+").filter(Boolean)).reduce((a: any, c) => (a[c] = (a[c] ?? 0) + 1, a), {}))),
      weeks,
    };
  }
  const byCircuit = drafts.reduce((a: any, d) => (a[d.circuit] = (a[d.circuit] ?? 0) + 1, a), {});
  const unsupported = drafts.filter(d => !d.executable).reduce((a: any, d) => (a[d.definitionKey] = (a[d.definitionKey] ?? 0) + 1, a), {});
  report[`S${season}`] = { totalInstances: drafts.length, byCircuit, unsupportedByDefinition: unsupported,
    qSchoolInstances: drafts.filter(d => d.circuit === "Q_SCHOOL").length, perState };
}
console.log(JSON.stringify(report, null, 1));
