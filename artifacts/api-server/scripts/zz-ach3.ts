import { ACHIEVEMENT_DEFINITIONS } from "../src/lib/achievements.ts";
import { SHADOW_BOT_ACHIEVEMENT_DEFS } from "../src/lib/shadow-bot-achievements.ts";
import { TOUR_ACHIEVEMENT_DEFS } from "../src/lib/tourSeed.ts";
type D = { key: string; name: string; description: string; criteriaType?: string; criteriaValue?: number; secondaryCriteria?: string; secondaryValue?: number; category?: string; sys: string };
const all: D[] = [...ACHIEVEMENT_DEFINITIONS.map(a => ({ ...a, sys: a.category })), ...SHADOW_BOT_ACHIEVEMENT_DEFS.map(a => ({ ...a, sys: "Shadow Bot" })), ...TOUR_ACHIEVEMENT_DEFS.map((a: any) => ({ ...a, sys: "Tour" }))];
const tmpl = (s: string) => s.replace(/[\d,]+(\.\d+)?\+?/g, "#").replace(/\s+/g, " ").trim();
const groups = new Map<string, D[]>();
for (const a of all) { const fam = a.sys === "Shadow Bot" ? "SB" : a.sys === "Tour" ? "T" : "M"; const k = `${fam}|${a.criteriaType ?? a.key}|${a.secondaryCriteria ?? ""}|${a.secondaryValue ?? ""}`; groups.set(k, [...(groups.get(k) ?? []), a]); }
const tracks = [...groups.values()].filter(g => g.length > 1), feats = [...groups.values()].filter(g => g.length === 1);
console.log("defs", all.length, "tracks", tracks.length, "covering", tracks.reduce((n, g) => n + g.length, 0), "feats", feats.length);
const bySys = new Map<string, [number, number]>(); for (const g of tracks) { const s = g[0].sys; const v = bySys.get(s) ?? [0, 0]; v[0]++; bySys.set(s, v); } for (const g of feats) { const s = g[0].sys; const v = bySys.get(s) ?? [0, 0]; v[1]++; bySys.set(s, v); }
console.log("by system [tracks, feats]", JSON.stringify([...bySys]));
const lens = new Map<number, number>(); for (const g of tracks) lens.set(g.length, (lens.get(g.length) ?? 0) + 1); console.log("track lengths", JSON.stringify([...lens].sort((a, b) => a[0] - b[0])));
for (const g of tracks.slice(0, 12)) console.log(" T", g[0].sys, "|", tmpl(g[0].description), "|", g.map(a => a.criteriaValue).join(","));
for (const g of feats.slice(0, 12)) console.log(" F", g[0].sys, "|", g[0].description);
