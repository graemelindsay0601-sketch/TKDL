/**
 * Full definition/family inventory, not a season sample. A/B/C/D describe the
 * approved A9 baseline; finalStatus describes this correction's runtime support.
 * Execution support is capability/adapter evidence, not a claim that each event
 * has individually been played in a browser. Tests and live journeys are separate.
 */
import {mkdirSync,writeFileSync} from "node:fs";
import path from "node:path";
import {catalogueFor} from "../src/career/calendar/catalogue.ts";
import {assessCapability,liveMatchFormat,a2MatchFormat} from "../src/career/calendar/formats.ts";
import {FEE_OVERRIDES,FEE_PROFILES,PRIZE_OVERRIDES,PRIZE_PROFILES} from "../src/career/finance/config.ts";
import {eventRationale} from "../src/career/calendar/certification.ts";
export function certificationMatrix() {
  return catalogueFor(5).map(d=>{
    const capability=assessCapability(d.format,true),rationale=eventRationale(d);
    const corrected=["county-301-sprint","county-701-open","world-darts-championship"].includes(d.key);
    return {
      definitionKey:d.key,name:d.name,family:d.family,circuit:d.circuit,classification:d.classification,
      rankingCategory:d.rankingCategory,fieldSize:d.fieldSize,sideSize:d.format.sideSize,
      scheduleType:d.schedule.kind,schedule:d.schedule,gameType:d.format.gameType,
      startingScore:d.format.startingScore,inRule:d.format.inRule,outRule:d.format.outRule,
      scoringUnit:d.format.scoringUnit,legsPerSet:d.format.legsPerSet,stages:d.format.stages,
      tournamentStructure:d.format.structure,firstThrowMethod:d.format.firstThrowMethod,
      eligibility:d.eligibility,qualificationDependencies:{intake:d.entitlementIntake,outputs:d.qualificationOutputs},
      selection:{fieldPolicy:d.fieldPolicy,npcFill:d.npcFill,npcTierWeights:d.npcTierWeights,geography:d.geography,
        seedingPolicy:d.seedingPolicy,minimumEntrants:d.minimumEntrants,invitationPolicy:d.invitationPolicy},
      presentationTier:d.presentation.tier,capability,
      capabilityReason:capability.executable?null:capability.reasons,
      humanExecutionSupport:capability.executable?liveMatchFormat(d.format,d.format.stages.at(-1)!.bestOfByRound.at(-1)!):false,
      npcExecutionSupport:capability.executable?a2MatchFormat(d.format,d.format.stages.at(-1)!.bestOfByRound.at(-1)!,0):false,
      tournamentFrameworkSupport:capability.executable?capability.engine:false,
      settlement:{authority:"A4 prizes/ledger; A5 ranking eligibility",
        references:d.profiles,
        fee:FEE_OVERRIDES[d.key]??FEE_PROFILES[d.profiles.entryFee],
        prize:PRIZE_OVERRIDES[d.key]??PRIZE_PROFILES[d.profiles.prize],
        rankingEligible:d.classification==="RANKING"},
      identity:rationale,internalInspiration:d.legacyConcept,
      baselineClass:corrected?"C":capability.executable?"A":"B",
      correction:corrected?(d.key==="world-darts-championship"?"Reserved qualifying places before invitations; removed obsolete unsupported-set-play presentation":"Connected existing generic X01 scoring"):null,
      finalStatus:capability.executable?"PLAYABLE":"INTENTIONALLY_BENCHED",
    };
  });
}
const output=path.resolve(process.argv[2]??"docs/career-certification-matrix.json");
mkdirSync(path.dirname(output),{recursive:true});
const definitions=certificationMatrix();
const counts=Object.fromEntries(["A","B","C","D"].map(k=>[k,definitions.filter(d=>d.baselineClass===k).length]));
writeFileSync(output,JSON.stringify({baseline:"75c679ad4e919e48754775b8a34283b711595a88",
  scope:"All current v5 definitions; authored snapshots and fees unchanged",
  total:definitions.length,families:new Set(definitions.map(d=>d.family)).size,counts,
  playable:definitions.filter(d=>d.finalStatus==="PLAYABLE").length,
  benched:definitions.filter(d=>d.finalStatus==="INTENTIONALLY_BENCHED").map(d=>d.definitionKey),definitions},null,2)+"\n");
console.log(JSON.stringify({output,total:definitions.length,counts,benched:definitions.filter(d=>d.finalStatus==="INTENTIONALLY_BENCHED").map(d=>d.definitionKey)}));
