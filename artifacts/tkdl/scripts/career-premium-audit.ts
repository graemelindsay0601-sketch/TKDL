/**
 * DEV-ONLY premium-treatment audit for every event definition in the current event database edition:
 * stored content identity, registered circuit, explicit award policy, trophy art, venue content + map
 * anchor + venue artwork family, and (for v7 additions) a player-facing summary. Exits non-zero on gaps.
 *   node scripts/career-premium-audit.ts
 */
import { catalogueFor } from "../../api-server/src/career/calendar/catalogue.ts";
import { CURRENT_EVENT_DATABASE_VERSION } from "../../api-server/src/career/calendar/config.ts";
import { generateSeason } from "../../api-server/src/career/calendar/generation.ts";
import { CIRCUIT_CONTENT, VENUE_FAMILIES, venueContent } from "../../api-server/src/career/content/world.ts";
import { HARNESS_SEED } from "../../api-server/src/career/world/harness.ts";
import { EVENT_AWARDS, resolveAward } from "../src/features/career/trophies/manifest/award-policy.ts";
import { TROPHY_ART } from "../src/features/career/trophies/manifest/trophy-manifest.ts";

const version = CURRENT_EVENT_DATABASE_VERSION, defs = catalogueFor(version), previous = new Set(catalogueFor(version - 1).map(d => d.key));
const circuits = new Set(CIRCUIT_CONTENT.map(c => c.id)), gaps: string[] = [];
for (const d of defs) {
  const c = d.content;
  if (!c) { gaps.push(`${d.key}: no content identity`); continue; }
  if (!circuits.has(c.circuitId)) gaps.push(`${d.key}: circuit ${c.circuitId} not registered`);
  if (!EVENT_AWARDS[d.key]) gaps.push(`${d.key}: no explicit award policy`);
  const award = resolveAward({ definitionKey: d.key });
  if (award.award === "PHYSICAL_TROPHY" && !TROPHY_ART[award.trophyId!]) gaps.push(`${d.key}: trophy ${award.trophyId} has no art`);
  if (!previous.has(d.key) && !c.summary) gaps.push(`${d.key}: new in v${version} but no summary`);
}
const venues = new Set(generateSeason(HARNESS_SEED, version, 2).map(e => e.venueKey));
for (const key of venues) {
  const v = venueContent(key);
  if (!Number.isFinite(v.mapAnchor.latitude)) gaps.push(`venue ${key}: no map anchor`);
  if (!(VENUE_FAMILIES as readonly string[]).includes(v.venueType)) gaps.push(`venue ${key}: no artwork family`);
}
console.log(`v${version}: ${defs.length} definitions, ${venues.size} venues in use, ${defs.filter(d => !previous.has(d.key)).length} new — ${gaps.length ? `${gaps.length} gaps` : "no gaps"}`);
for (const g of gaps) console.log(" -", g);
process.exit(gaps.length ? 1 : 0);
