import type { PublicProfile } from "../life/types.ts";
/** Historical projections only. No Legacy Score, sporting modifier or wallet. */
export type Player = { id:string; name:string; retiredSeason:number|null; startingAge:number|null; createdSeason:number };
export type Totals = { id:string; season:number; appearances:number; titles:number; finals:number; majorTitles:number; worlds:number; amateurTitles:number; nationalTitles:number; proTitles:number; wins:number; losses:number };
export type Result = { id:string; key:string; name:string; season:number; day:number; participant:string; participantName?:string; position:number; champion:boolean; final:boolean; circuit:string; tier:string; classification:string };
export type Ranking = { id:string; season:number; week:number; participant:string; position:number };
export type Card = { id:string; participant:string; participantName?:string; source:string; awardedSeason:number; awardedWeek:number; startSeason:number; endSeason:number; endedSeason:number|null; endedWeek:number|null; status:string };
export type Evidence = {
  saveId:string; currentSeason:number; currentWeek:number; retired:boolean;
  players:Player[]; totals:Totals[]; results:Result[]; rankings:Ranking[]; cards:Card[];
  ages?:{participant:string;season:number;atStart:number}[];
  money:{season:number; prizePence:number; commercialPence:number}[];
  sponsors:{id:string; name:string; startSeason:number; endSeason:number; status:string}[];
  qualifications:{id:string; participant:string; season:number; target:string}[];
  decisions:{id:string; season:number; kind:string; thread:string|null}[];
  commitments:{id:string; season:number; title:string; status:string}[];
  merchandise:{category:string; signedSeason:number; active:boolean}|null;
};
export type Award = { kind:string; season:number; participant:string; name:string; reason:string; sources:string[] };
export type RecordRow = { metric:string; value:number; holders:{id:string; name:string}[]; scope:string };
export type RecordEvent = RecordRow & { season:number; previousValue:number };
export type Induction = { version:1; participant:string; name:string; route:string; reasons:string[]; inductedSeason?:number };
export type SeasonReview = {
  version:1; season:number; provenance:"CAPTURED"|"RECONSTRUCTED"; identity:string; story:string[];
  human:Totals; startingRank:Ranking|null; finalRank:Ranking|null; rankingMovement:number|null;
  prizePence:number; commercialPence:number; bestMajor:Result|null; worldResult:Result|null;
  cardStatus:string; changes:string[]; definingRival:{id:string; name:string; meetings:number; wins:number; losses:number}|null;
  biggestMoment:Result|null; publicLife:{decisions:number; completedWork:number; threads:string[]; profile?:PublicProfile};
  sponsors:{id:string; name:string; startSeason:number; endSeason:number; status:string}[];
  awards:Award[];
  world:{numberOne:{id:string; name:string; snapshot:string; week:number}|null; champions:Result[]; leadingAmateur:Award|null; retirements:Player[]; newEntrants:Player[]; cardChanges:Card[]};
  records:RecordRow[]; recordEvents:RecordEvent[]; notes:string[];
};
export type LegacyView = {
  careerSaveId:string; retired:boolean; completedSeasons:number[];
  reviews:{season:number; identity:string; provenance:SeasonReview["provenance"]}[];
  overview:Totals; bestRanking:Ranking|null; prizePence:number; commercialPence:number;
  championships:Result[];
  descriptors:string[]; eras:{from:number; to:number; label:string}[];
  honours:Award[]; hallOfFame:Induction[]; records:RecordRow[]; comparisons:string[];
  recordEvents:RecordEvent[]; world:SeasonReview["world"][]; players:Player[]; eventKeys:{key:string; name:string}[];
  cards:Card[]; sponsors:Evidence["sponsors"]; commercial:Evidence["commitments"]; merchandise:Evidence["merchandise"];
  storiesLink:string; finalSummary:string[]; pendingReview:number|null; notes:string[];
};
export type EventHistory={key:string;champions:Result[];defendingChampion:Result|null;
  mostTitles:{id:string;name:string;count:number}[];mostFinals:{id:string;name:string;count:number}[];human:Result[];note:string};
export type NpcHistory={player:Player;totals:Totals|null;rankings:Ranking[];titles:Result[];awards:Award[];cards:Card[];hallOfFame:Induction|null;
  meetings?:{season:number;name:string;won:boolean}[]};
