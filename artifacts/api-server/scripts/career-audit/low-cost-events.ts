/** DEV-ONLY: season-3 events an Ayrshire amateur can enter, bucketed by all-in cost (fee + travel v2). */
import { generateSeason } from "../../src/career/calendar/generation.ts";
import { evaluateRule } from "../../src/career/calendar/eligibility.ts";
import { FEE_PROFILES, FEE_OVERRIDES } from "../../src/career/finance/config.ts";
import { travelBand, tripCost } from "../../src/career/finance/travel.ts";
import { HARNESS_SEED } from "../../src/career/world/harness.ts";
const home = { locality: "ayrshire", country: "GBR", zone: "UK_IRELAND", travelVersion: 2 };
const facts:any = {key:"HUMAN",kind:"HUMAN",country:"GBR",zone:"UK_IRELAND",locality:"ayrshire",age:25,womenEligible:false,professionalStatus:"AMATEUR",tourCard:false,rankings:{},entitlementTargets:new Set(),invited:false,results:{SAME:new Map(),PREVIOUS:new Map()},defendingChampion:false};
const out:any={};
for (const d of generateSeason(HARNESS_SEED,5,3)) { if(!d.executable||!evaluateRule(d.snapshot.eligibility,facts).eligible) continue;
  const fee=(FEE_OVERRIDES[d.definitionKey]??FEE_PROFILES[d.snapshot.profiles.entryFee])?.entryFeePence??0;
  const band=travelBand(home,{locality_key:d.localityKey,venue_key:d.venueKey,country:d.country,zone:d.zone}); const t=tripCost(band,d.endDay-d.startDay+1);
  const cost=fee+t.travelPence+t.accommodationPence; const k=cost===0?"free":cost<=500?"<=£5":cost<=1000?"<=£10":"more"; (out[k]??=[]).push(d.definitionKey+"@w"+d.startWeek);}
for(const [k,v] of Object.entries(out)) console.log(k,(v as any).length, k!=="more"?(v as any).join(" "):"");
