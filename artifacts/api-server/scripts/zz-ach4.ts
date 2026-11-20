import { SHADOW_BOT_ACHIEVEMENT_DEFS } from "../src/lib/shadow-bot-achievements.ts";
import { FORMAT_AND_MEME_ACHIEVEMENT_DEFINITIONS as F } from "../src/lib/format-and-meme-achievements.ts";
const c = (l: any[]) => { const m = new Map<string, number>(); for (const a of l) m.set(a.criteriaType, (m.get(a.criteriaType) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
console.log("SB", c(SHADOW_BOT_ACHIEVEMENT_DEFS).length, JSON.stringify(c(SHADOW_BOT_ACHIEVEMENT_DEFS).slice(0, 15)));
console.log(SHADOW_BOT_ACHIEVEMENT_DEFS.slice(0, 8).map(a => `${a.criteriaType}:${a.criteriaValue} ${a.description}`).join(" | "));
console.log("F", c(F).length, JSON.stringify(c(F).slice(0, 12)));
console.log(F.slice(0, 10).map((a: any) => `${a.criteriaType}:${a.criteriaValue}:${a.secondaryCriteria ?? ""} ${a.description}`).join(" | "));
