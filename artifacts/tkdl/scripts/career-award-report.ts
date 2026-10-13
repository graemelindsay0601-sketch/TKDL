#!/usr/bin/env node
/**
 * Workstream E2 — auditable event-to-award report, regenerated from source:
 * every event definition in every supported catalogue version, its stored
 * content identity, and the locked presentation policy.
 *
 *   node scripts/career-award-report.ts   (writes docs/career/e2-trophy-award-report.md)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { catalogueFor } from "../../api-server/src/career/calendar/catalogue.ts";
import { identity } from "../../api-server/src/career/content/events.ts";
import { TROPHIES } from "../../api-server/src/career/content/world.ts";
import { assessCapability } from "../../api-server/src/career/calendar/formats.ts";
import { CURRENT_EVENT_DATABASE_VERSION } from "../../api-server/src/career/calendar/config.ts";
import { AWARD_POLICY_VERSION, EVENT_DESIGNS_V2, resolveAward } from "../src/features/career/trophies/manifest/award-policy.ts";
import { TROPHY_ART, TROPHY_ART_VERSION } from "../src/features/career/trophies/manifest/trophy-manifest.ts";
import { TROPHY_RENDERS } from "../src/features/career/trophies/manifest/render-manifest.ts";

type Row = { key: string; name: string; circuit: string; classification: string; tier: string; eventClass: string; contentTrophy: string; versions: number[] };
export function auditRows(): Row[] {
  const rows = new Map<string, Row>();
  for (let v = 1; ; v++) {
    let catalogue;
    try { catalogue = catalogueFor(v); } catch { break; }
    for (const d of catalogue) {
      const content = (d as { content?: ReturnType<typeof identity> }).content ?? identity(d);
      const prev = rows.get(d.key);
      rows.set(d.key, { key: d.key, name: d.name, circuit: d.circuit, classification: d.classification, tier: d.presentation.tier,
        eventClass: content.eventClass, contentTrophy: content.trophyId, versions: [...(prev?.versions ?? []), v] });
    }
  }
  return [...rows.values()].sort((a, b) => a.circuit.localeCompare(b.circuit) || a.key.localeCompare(b.key));
}

/**
 * Whether normal Career scheduling can ever produce a winner for a definition, computed with the
 * same capability check season generation uses (calendar/generation.ts). Non-executable instances
 * are inserted as CANCELLED / INTENTIONALLY_BENCHED (calendar/engine.ts) and never drawn or played.
 *  - SCHEDULED: in the current catalogue and executable — can be entered and won in a new Career.
 *  - BENCHED: in the current catalogue but its format is not executable — visible as benched, never played.
 *  - LEGACY: not in the current catalogue — only saves pinned to an older catalogue version can hold it.
 */
export type Reachability = { status: "SCHEDULED" | "BENCHED" | "LEGACY"; executableIn: number[]; benchedIn: number[]; reasons: string[] };
export function reachability(key: string): Reachability {
  const executableIn: number[] = [], benchedIn: number[] = [], reasons = new Set<string>();
  for (let v = 1; ; v++) {
    let catalogue;
    try { catalogue = catalogueFor(v); } catch { break; }
    const d = catalogue.find(x => x.key === key);
    if (!d) continue;
    const c = assessCapability(d.format, d.eventDatabaseVersion >= 4);
    if (c.executable) executableIn.push(v); else { benchedIn.push(v); for (const r of c.reasons) reasons.add(r); }
  }
  const current = CURRENT_EVENT_DATABASE_VERSION;
  const status = executableIn.includes(current) ? "SCHEDULED" : benchedIn.includes(current) ? "BENCHED" : "LEGACY";
  return { status, executableIn, benchedIn, reasons: [...reasons] };
}
const reachLabel = (r: Reachability) => r.status === "SCHEDULED" ? (r.benchedIn.length ? `scheduled (benched in v${r.benchedIn.join(",")})` : "scheduled")
  : r.status === "BENCHED" ? `**benched** (${r.reasons.join(", ").toLowerCase()})` : r.executableIn.length ? `legacy (playable in v${r.executableIn.join(",")} saves)` : "legacy (never playable)";

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = auditRows();
  const versions = [...new Set(rows.flatMap(r => r.versions))].sort((a, b) => a - b);
  const counts = { PHYSICAL_TROPHY: 0, RECOGNITION: 0, RESULT_ONLY: 0 } as Record<string, number>;
  const lines = rows.map(r => {
    const a = resolveAward({ definitionKey: r.key, circuit: r.circuit, classification: r.classification, tier: r.tier });
    counts[a.award]++;
    const alloc = EVENT_DESIGNS_V2[r.key];
    const shown = a.award === "PHYSICAL_TROPHY" ? `**${TROPHY_ART[a.designId!]?.name ?? "MISSING"}** (\`${a.designId}\`)` : a.award === "RECOGNITION" ? `Winner's ${a.recognition?.toLowerCase()}` : "—";
    const allocation = alloc ? (alloc.allocation === "UNIQUE" ? "unique" : `${alloc.allocation.toLowerCase()}: ${alloc.group}`) : "";
    return `| \`${r.key}\` | ${r.name} | ${r.circuit} | ${r.classification} | ${r.tier} | ${a.kind.replace(/_/g, " ").toLowerCase()} | \`${r.contentTrophy}\` | ${a.award.replace(/_/g, " ").toLowerCase()} | ${shown} | ${allocation} | ${a.inscription ?? ""} | v${r.versions.join(",")} | ${reachLabel(reachability(r.key))} | ${a.source.toLowerCase()} |`;
  });
  const physical = rows.map(r => ({ r, a: resolveAward({ definitionKey: r.key }) })).filter(x => x.a.award === "PHYSICAL_TROPHY");
  const designsUsed = new Set(physical.map(x => x.a.designId!));
  const unique = physical.filter(x => EVENT_DESIGNS_V2[x.r.key]?.allocation === "UNIQUE");
  const groups = new Map<string, string[]>();
  for (const x of physical) { const al = EVENT_DESIGNS_V2[x.r.key]; if (al && al.allocation !== "UNIQUE") groups.set(`${al.group} → ${TROPHY_ART[al.designId].name} (\`${al.designId}\`)`, [...(groups.get(`${al.group} → ${TROPHY_ART[al.designId].name} (\`${al.designId}\`)`) ?? []), x.r.key]); }
  const all = Object.values(TROPHY_ART);
  const reach = physical.map(x => ({ ...x, reach: reachability(x.r.key) }));
  const byStatus = (st: Reachability["status"]) => reach.filter(x => x.reach.status === st);
  const reachRow = (x: (typeof reach)[number]) => `| ${x.r.name} (\`${x.r.key}\`) | ${TROPHY_ART[x.a.designId!].name} (\`${x.a.designId}\`) | ${x.r.circuit} | ${reachLabel(x.reach)} |`;
  const md = `# Career trophy award report (Workstream E2)

Generated by \`artifacts/tkdl/scripts/career-award-report.ts\` from the live catalogue — do not edit by hand.

- Award policy version: **${AWARD_POLICY_VERSION}** (v1 = award type + catalogue family; v2 = event-specific premium designs) · trophy art version: **${TROPHY_ART_VERSION}**
- Catalogue versions audited: **${versions.join(", ")}** · distinct event definitions: **${rows.length}**
- Physical trophy: **${counts.PHYSICAL_TROPHY}** · plaque/medal recognition: **${counts.RECOGNITION}** · result & prize only: **${counts.RESULT_ONLY}**
- Premium designs: **${all.length}** distinct (${all.filter(a => a.family).length} catalogue families + ${all.filter(a => !a.family).length} event-specific), **${designsUsed.size}** awarded by current events; **${Object.keys(TROPHY_RENDERS.images).length}/${all.length}** have physically based renders.

Presentation only: this decides what the winner is *shown* receiving. Results, titles, prize payments, ranking money and qualification are unchanged. The stored catalogue \`trophyId\` stays each event's identity; a saved event whose stored identity differs from today's catalogue keeps its stored identity.

## Reachability through normal Career scheduling

Computed from each catalogue version with the same capability check season generation uses (current catalogue: **v${CURRENT_EVENT_DATABASE_VERSION}**). A benched definition is generated as a \`CANCELLED · INTENTIONALLY_BENCHED\` calendar entry: registration is refused (\`UNSUPPORTED_FORMAT\`), no draw is made, no match is simulated or played, and no result, prize or award is ever recorded. Its trophy artwork is kept as a finished asset but **cannot appear in any trophy cabinet**.

- Trophy events reachable in a new Career: **${byStatus("SCHEDULED").length}** · benched (authored, never played): **${byStatus("BENCHED").length}** · legacy (older saves only): **${byStatus("LEGACY").length}**
- Designs a new Career can actually award: **${new Set(byStatus("SCHEDULED").map(x => x.a.designId)).size}** of ${all.length}. Designs held only by benched or legacy events (kept, dormant until their format becomes executable): ${[...designsUsed].filter(d => !byStatus("SCHEDULED").some(x => x.a.designId === d)).map(d => `\`${d}\``).join(", ")}.
- Scheduled does not mean every player can enter: eligibility (women's, youth, junior, invitation, ranking) still applies, and NPCs win the rest. Only recorded winners receive the award.

| Event | Design | Circuit | Reachability |
|---|---|---|---|
${[...byStatus("BENCHED"), ...byStatus("LEGACY"), ...byStatus("SCHEDULED")].map(reachRow).join("\n")}

## Significant championships with their own design (${unique.length})

| Event | Design | Inscription |
|---|---|---|
${unique.map(x => `| ${x.r.name} (\`${x.r.key}\`) | ${TROPHY_ART[x.a.designId!].name} (\`${x.a.designId}\`) | ${x.a.inscription ?? ""} |`).join("\n")}

## Events that legitimately share a design

${[...groups.entries()].map(([g, keys]) => `- **${g}:** ${keys.map(k => `\`${k}\``).join(", ")}`).join("\n")}

## Full event-to-award table

| Key | Event | Circuit | Classification | Tier | Kind | Content trophyId | Award | Design shown (v2) | Allocation | Inscription | Versions | Reachability | Mapping |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${lines.join("\n")}
`;
  const out = path.resolve(import.meta.dirname, "../../../docs/career/e2-trophy-award-report.md");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, md);
  console.log(`${rows.length} definitions · ${JSON.stringify(counts)} → ${path.relative(process.cwd(), out)}`);
}
