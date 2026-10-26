import type { CareerFacts, EventFact } from "../facts/types.ts";
import type { CareerRelationships } from "../relationships/types.ts";
import type { RecognitionView } from "../recognition/types.ts";

export const PERSONAS = ["PROFESSIONAL","CONFIDENT","SHOWMAN","FIERY","RESERVED"] as const;
export type Persona = typeof PERSONAS[number];
export type Tone = "RESPECTFUL" | "COMPETITIVE" | "HEATED";
export type Decision = {
  id:string; kind:"DIALOGUE"|"ATMOSPHERE"|"OPPORTUNITY"|"MERCHANDISE";
  choice:string; season:number; week:number; data:Record<string,unknown>;
};
export type Commitment = {
  id:string; family:string; title:string; season:number; day:number; feePence:number;
  status:"ACCEPTED"|"COMPLETED"; contractId:string|null;
};
export type LifeEvent = {id:string;key:string;name:string;circuit:string;tier:string;classification:string;season:number;day:number;endDay:number;status:string;venueKey?:string};
export type LifeSources = {
  saveId:string; season:number;week:number;active:boolean;ready:boolean;
  facts:CareerFacts; relationships:CareerRelationships;recognition:RecognitionView;
  events:LifeEvent[]; worldResults:EventFact[]; decisions:Decision[];commitments:Commitment[];
  sponsor:{id:string;name:string}|null;
  publicChanges?:(import("../facts/types.ts").Fact & {kind:string;participantKey:string;participantName:string})[];
  draws?:{id:string;eventId:string;opponentId:string;season:number;day:number;name:string;circuit:string;tier:string;classification:string}[];
  /** Player database v6: players tipped for a breakthrough in each close season (published at the new season's start). */
  tips?:{npcId:string;name:string;band:"ELITE"|"TOUR";season:number;order:number}[];
  fans?:import("../fans/model.ts").FanFollowing;
  /** Savings goals reached (the week the money was there, or the event was entered), within the news window. */
  savingsGoals?:{id:string;kind:"EVENT"|"AMOUNT";label:string;targetPence:number;eventId:string|null;season:number;week:number}[];
  /** Your home club: its name, this season's captain and its league history (promotions, titles). */
  club?:Pick<import("../club/service.ts").ClubView,"club"|"captain"|"history"|"season"|"county"|"nation">;
  /** Only completed singles the player personally played; teammate cover is excluded. */
  localTeamRecord?:{appearances:number;wins:number};
  /** Nine-dart legs from the records book (recorded match statistics), within the news window. */
  nineDarters?:{matchId:string;eventId:string;eventName:string;participantKey:string;name:string;season:number;day:number;count:number;source:string}[];
  upsets?:(import("../facts/types.ts").Fact & {winnerKey:string;winnerName:string;loserKey:string;loserName:string;winnerPosition:number;loserPosition:number;snapshotId:string})[];
};
export type Callback = {text:string;sourceIds:string[]};
export type Choice = {id:Persona;text:string};
export type Story = {
  id:string;kind:string;scope:"HUMAN"|"RIVAL"|"WORLD";significance:"NEWS"|"MOMENT"|"MAJOR";
  title:string;body:string;season:number;week:number|null;day:number|null;date:string|null;
  eventId?:string;opponentId?:string;thread:string;sourceIds:string[];callbacks:Callback[];
};
export type Moment = {id:string;storyId:string;kind:"ATMOSPHERE"|"DIALOGUE";title:string;prompt:string;steps:string[];choices:Choice[];opponentId?:string;thread:string;statementFamily:string};
export type Opportunity = {
  id:string;family:string;title:string;description:string;season:number;day:number;feePence:number;
  contractId:string|null;compatibility:string;conflicts:string[];canAccept:boolean;eventId?:string;eventName?:string;
};
export type ClubInvitationProgress = {
  nextInvitation:"LOCAL_SPOTLIGHT"|"REGIONAL_SHOWCASE"|null;
  status:"IN_PROGRESS"|"READY"|"BOOKED"|"COMPLETE"|"CLOSED";
  appearances:number;wins:number;targetAppearances:number|null;targetWins:number|null;
  eventId?:string;eventName?:string;
};
export type PublicProfile = {
  persona:{label:string;primary:Persona|null;secondary:Persona|null;description:string};
  awareness:string;reception:string;draw:string;
  commercial:{demand:string;activity:string;description:string};
};
export type LifeView = {
  careerSaveId:string;retired:boolean;profile:PublicProfile;
  news:Story[];threads:{id:string;title:string;stories:Story[]}[];/** All threads (only the most recent are sent). */ threadCount:number;moments:Moment[];
   opportunities:Opportunity[];clubInvitationProgress:ClubInvitationProgress;history:Decision[];commitments:Commitment[];
  relationshipTones:{opponentId:string;name:string;tone:Tone;sportingLabels:string[]}[];
  merchandise:{demand:string;incomePence:number;agreement:string|null;royaltyPence:number|null;offerRoyaltyPence:number;canOptIn:boolean;canStop:boolean};
  commercialIncomePence:number;notes:string[];
  signatureProducts?:{id:string;name:string;manufacturer:string;launchSeason:number;state:"ACTIVE"|"LEGACY"}[];
  /** Your fan following (from your results, nine-darters and interview style) and how crowds treat you. */
  fans?:import("../fans/model.ts").FanFollowing & {crowd:{home:string;away:string}};
};
export type NpcLifeView = {careerSaveId:string;id:string;name:string;retired:boolean;personality:{primary:string;secondary:string|null};standing:string;publicDraw:string;notes:string};
