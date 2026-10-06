import type {EventDefinition} from "./catalogue.ts";
/** Internal rationale only; no external trademarks added to player UI. */
export function eventRationale(d:EventDefinition):string {
  if(d.key==="world-darts-championship")return "Palace: Sovereign Trophy, 128 singles, SI/DO BO5 legs per set, BO3/3/5/5/7/7/13 sets. Existing generic scorer.";
  if(d.key==="double-crown")return "Double Crown: DI/DO BO5 legs per set, BO3/3/5/5/7 sets. Existing generic scorer, not a Palace-only fork.";
  if(d.key==="grand-slam-of-champions")return "Grand Championship: locked A8.1 long straight-leg knockout; older group inspiration does not override fictional identity.";
  if(d.key==="amateur-world-masters")return "Amateur World Masters: retain authored long-leg knockout. Current fictional v5 identity is authoritative; historical set inspiration alone does not justify rewriting immutable snapshots.";
  if(d.key==="champions-masters")return "Champions Masters: retain authored straight-leg knockout; ambiguous historical Masters inspiration is not a reason to change current fictional identity.";
  if(d.key==="vault-nights")return "A8.2: 16 singles, four groups of four, top two into fixed eight-player knockout; sporting bull playoffs, no random tiebreak or reseeding.";
  if(d.format.sideSize>1)return "Pairs identity retained as informational content; existing Career framework represents singles, not partner rotation/team results.";
  if(d.format.structure==="LEAGUE")return "League identity retained but benched: authored field/schedule/playoffs are not the fixed 4x4 Vault framework; arbitrary league adaptation requires materially different progression.";
  if(d.format.gameType!=="X01")return "Special identity retained but benched: existing standalone games do not supply Career NPC simulation plus persisted live replay/validation. No new scorer built.";
  if(d.format.outRule==="MASTER")return "Master/treble-out identity benched: Career NPC finishing is double-out only; a shared scorer option alone does not provide equivalent NPC execution.";
  if(d.format.startingScore!==501)return "Generic X01 score variant: shared live scorer and A2 already accept this starting score; reuse adapters and ordinary settlement without new engine.";
  return `${d.family}: preserve authored fictional singles X01 identity, schedule, selection/qualification and round lengths; use existing scorer, A2, A3/A8.2, A4 and A5.`;
}
