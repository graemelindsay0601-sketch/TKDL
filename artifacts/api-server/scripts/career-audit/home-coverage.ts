/**
 * DEV-ONLY: event coverage for every selectable home locality (pure; real generator, eligibility,
 * fee/travel/prize tables). Per home and player stage: weeks with no meaningful option, mean options
 * per week, and how many options are in the player's own country, by level.
 *   node scripts/career-audit/home-coverage.ts [--version=6] [--season=2]
 */
import { generateSeason, type EventInstanceDraft } from "../../src/career/calendar/generation.ts";
import { evaluateRule, type ParticipantFacts } from "../../src/career/calendar/eligibility.ts";
import { COUNTY_CATCHMENTS, LOCALITIES, zoneOf } from "../../src/career/calendar/geography.ts";
import { FEE_PROFILES, FEE_OVERRIDES } from "../../src/career/finance/config.ts";
import { travelBand, tripCost } from "../../src/career/finance/travel.ts";
import { HARNESS_SEED } from "../../src/career/world/harness.ts";
const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const VERSION = Number(arg("version", "6")), SEASON = Number(arg("season", "2"));
const HOMES = ["ayrshire","highlands","north-east","midlands","south-wales","south-coast","munster","connacht","leinster","utrecht","limburg","friesland","hessen","saxony","bremen","flanders","wallonia","victoria","queensland","western-australia","ontario","alberta","nova-scotia","glasgow-clyde","central-scotland","edinburgh-lothians","borders","north-east-scotland","tayside","northern-ireland","ile-de-france","stockholm","kanto","new-york","auckland"];
const drafts = generateSeason(HARNESS_SEED, VERSION, SEASON).filter(d => d.executable && ["RANKING", "QUALIFIER"].includes(d.classification) && d.circuit !== "SPECIAL");
const fee = (d: EventInstanceDraft) => (FEE_OVERRIDES[d.definitionKey] ?? FEE_PROFILES[d.snapshot.profiles.entryFee])?.entryFeePence ?? 0;
const LEVEL: Record<string, string> = { GRASSROOTS: "local", COUNTY: "county", REGIONAL: "regional", NATIONAL_AMATEUR: "national", VAULT: "secondary", CHALLENGER: "secondary", Q_SCHOOL: "qschool",
  PRO_CIRCUIT: "pro", EUROPEAN_SERIES: "pro", MAJOR: "major", WORLD_CHAMPIONSHIP: "major", WORLD_SERIES: "pro", INVITATIONAL: "pro" };
const out: any[] = [];
for (const key of HOMES) {
  const loc = LOCALITIES.find(l => l.key === key)!;
  const home = { locality: key, country: loc.country, zone: zoneOf(loc.country), travelVersion: 2 };
  const catchment = new Set(COUNTY_CATCHMENTS[key] ?? [key]);
  const base = { key: "HUMAN", kind: "HUMAN" as const, country: loc.country, zone: home.zone as never, locality: key, age: 25, womenEligible: false, invited: false,
    results: { SAME: new Map(), PREVIOUS: new Map() }, defendingChampion: false };
  const stages: Record<string, ParticipantFacts> = {
    amateur: { ...base, professionalStatus: "AMATEUR", tourCard: false, rankings: {}, entitlementTargets: new Set(["challenger-tour"]) },
    pro: { ...base, professionalStatus: "PROFESSIONAL", tourCard: true, rankings: { "pro-world": 60, "pro-circuit": 60, "european-series": 60 }, entitlementTargets: new Set() },
  };
  const row: any = { home: key, country: loc.country };
  for (const [stage, facts] of Object.entries(stages)) {
    const ok = drafts.filter(d => evaluateRule(d.snapshot.eligibility, facts).eligible && !(d.localityKey && ["GRASSROOTS", "COUNTY"].includes(d.circuit) && !catchment.has(d.localityKey)));
    const cost = (d: EventInstanceDraft) => { const t = tripCost(travelBand(home, { locality_key: d.localityKey, venue_key: d.venueKey, country: d.country, zone: d.zone }), d.endDay - d.startDay + 1); return fee(d) + t.travelPence + t.accommodationPence; };
    const affordable = ok.filter(d => stage === "pro" || cost(d) <= 40000);
    const weeks = Array.from({ length: 52 }, (_, i) => affordable.filter(d => d.startWeek === i + 1).length);
    const domestic = affordable.filter(d => d.country === loc.country);
    const levels: Record<string, number> = {}; for (const d of domestic) levels[LEVEL[d.circuit] ?? d.circuit] = (levels[LEVEL[d.circuit] ?? d.circuit] ?? 0) + 1;
    row[stage] = { zeroWeeks: weeks.filter(n => n === 0).length, perWeek: +(weeks.reduce((a, b) => a + b, 0) / 52).toFixed(1), domestic: domestic.length, levels,
      longHaulShare: +(ok.filter(d => travelBand(home, { locality_key: d.localityKey, venue_key: d.venueKey, country: d.country, zone: d.zone }) === "LONG_HAUL").length / Math.max(1, ok.length)).toFixed(2) };
  }
  out.push(row);
}
for (const r of out) console.log(r.home.padEnd(20), r.country, "| AM zero", String(r.amateur.zeroWeeks).padStart(2), "/wk", String(r.amateur.perWeek).padStart(4), "home", String(r.amateur.domestic).padStart(3), JSON.stringify(r.amateur.levels),
  "| PRO zero", String(r.pro.zeroWeeks).padStart(2), "home", r.pro.domestic, "longhaul", r.pro.longHaulShare);
