/** DEV-ONLY: definitions a GBR human can never enter, even holding every ranking/result (invited=false as in engine.ts). */
import { generateSeason } from "../../src/career/calendar/generation.ts";
import { evaluateRule } from "../../src/career/calendar/eligibility.ts";
import { HARNESS_SEED } from "../../src/career/world/harness.ts";
const d = generateSeason(HARNESS_SEED, 5, 3);
const all = new Set(["challenger-tour","vault-tour","vault-championship"]);
const best = (inv:boolean, card:boolean)=>({key:"HUMAN",kind:"HUMAN",country:"GBR",zone:"UK_IRELAND",locality:"ayrshire",age:25,womenEligible:false,
 professionalStatus:card?"PROFESSIONAL":"AMATEUR",tourCard:card,rankings:{"pro-world":1,"pro-circuit":1,"european-series":1,challenger:1,vault:1,amateur:1,"open-world":1},
 entitlementTargets:new Set<string>(), invited:inv, results:{SAME:new Map(),PREVIOUS:new Map()}, defendingChampion:true} as any);
const seen = new Map<string,string>();
for (const e of d) { if (!e.executable || seen.has(e.definitionKey)) continue;
  const okNo = [true,false].some(c=>evaluateRule(e.snapshot.eligibility,best(false,c)).eligible);
  const okYes = [true,false].some(c=>evaluateRule(e.snapshot.eligibility,best(true,c)).eligible);
  if (!okNo) seen.set(e.definitionKey, `${e.circuit} ${e.classification} inviteOnlyPath=${okYes} rule=${JSON.stringify(e.snapshot.eligibility).slice(0,160)}`);
}
for (const [k,v] of seen) console.log(k, v);
