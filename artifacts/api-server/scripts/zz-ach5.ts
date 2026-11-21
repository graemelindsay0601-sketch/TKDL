import { ACHIEVEMENT_DEFINITIONS } from "../src/lib/achievements.ts";
import { SHADOW_BOT_ACHIEVEMENT_DEFS } from "../src/lib/shadow-bot-achievements.ts";
const norm = (t: string) => t.replace(/_\d+$/, "").replace(/_WINS_\d+$/, "_WINS");
const groups = new Map<string, any[]>();
for (const a of ACHIEVEMENT_DEFINITIONS) { const k = `M|${a.category}|${norm(a.criteriaType)}|${a.secondaryCriteria ?? ""}|${a.secondaryValue ?? ""}`; groups.set(k, [...(groups.get(k) ?? []), a]); }
for (const a of SHADOW_BOT_ACHIEVEMENT_DEFS as any[]) { const k = `S|${a.criteriaType}|${a.gameFilter ?? ""}`; groups.set(k, [...(groups.get(k) ?? []), a]); }
const tracks = [...groups].filter(([, g]) => g.length > 1);
console.log("groups", groups.size, "tracks", tracks.length, "feats", [...groups].filter(([, g]) => g.length === 1).length);
for (const [k, g] of tracks) console.log(k, "×" + g.length, "::", g.sort((a: any, b: any) => a.criteriaValue - b.criteriaValue).map((a: any) => a.criteriaValue).join(","), "::", g[0].description.slice(0, 70));
