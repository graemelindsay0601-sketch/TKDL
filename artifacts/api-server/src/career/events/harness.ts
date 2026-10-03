import { performance } from "node:perf_hooks";
import { generateSeason, catalogue } from "./catalogue.ts";
import { capability } from "./capability.ts";
import { definitionSchema, type SportingProvider } from "./types.ts";
import { HARNESS_SEED } from "../world/harness.ts";
const counts = (values: (string | number)[]) => values.reduce<Record<string, number>>((r, v) => { r[v] = (r[v] ?? 0) + 1; return r; }, {});
/** Synthetic A5 fixture for validation ONLY. Never installed by production routes. */
export const harnessProvider: SportingProvider = { facts: async (_save, _season, entrants, event) => Object.fromEntries(entrants.map(p => [p.key, {
  tourCard: p.professionalStatus === "PROFESSIONAL", ranks: p.professionalStatus === "PROFESSIONAL" ? { PRO: 50 } : {},
  invited: p.tier === "ELITE" && (event.definition.classification === "INVITATIONAL_EXHIBITION" || ["european", "vault"].includes(event.definition.key)),
}])) };
export function calendarReport(seed = HARNESS_SEED, version = 1, season = 1) {
  const start = performance.now(), definitions = catalogue(version), events = generateSeason(seed, version, season);
  const targets = definitions.flatMap(d => d.qualification ? [d.qualification.targetKey] : []);
  return { eventDatabaseVersion: version, season, definitions: definitions.length, instances: events.length, generationMs: performance.now() - start,
    circuits: counts(events.map(e => e.definition.circuit)), classifications: counts(events.map(e => e.definition.classification)),
    countries: counts(events.map(e => e.venue.country)), regions: counts(events.map(e => e.venue.region)), presentation: counts(events.map(e => e.definition.presentationTier)),
    weeks: counts(events.map(e => Math.floor(e.startDay / 7) + 1)), fieldSizes: counts(events.map(e => e.definition.fieldSize)), formats: counts(events.map(e => e.definition.format.structure)),
    concurrentDays: Array.from({ length: 364 }, (_, day) => events.filter(e => e.startDay <= day && e.endDay >= day).length).filter(n => n > 1).length,
    duplicateKeys: events.length - new Set(events.map(e => e.key)).size,
    invalidDefinitions: definitions.filter(d => !definitionSchema.safeParse(d).success).length,
    invalidWindows: events.filter(e => e.startDay < 0 || e.endDay > 363 || e.startDay > e.endDay).length,
    qualifierCount: events.filter(e => e.definition.classification === "QUALIFIER").length,
    qualificationTargets: [...new Set(targets)], orphanTargets: targets.filter(k => !definitions.some(d => d.key === k || d.family === k)),
    unsupported: events.filter(e => capability(e.definition.format).status !== "SUPPORTED").map(e => ({ key: e.key, capability: capability(e.definition.format) })),
    qSchoolPathways: [...new Set(events.filter(e => e.definition.circuit === "Q_SCHOOL").map(e => e.definition.pathway))],
    localScottishOpportunities: events.filter(e => e.venue.region === "Scotland" && ["GRASSROOTS", "COUNTY"].includes(e.definition.circuit)).length,
    worlds: events.filter(e => e.definition.key === "worlds").map(e => ({ venue: e.venue, fieldSize: e.definition.fieldSize, eligibility: e.definition.eligibility, capability: capability(e.definition.format) })),
  };
}
