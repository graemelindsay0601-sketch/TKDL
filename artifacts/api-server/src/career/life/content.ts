import { createHash } from "node:crypto";
import type { Persona } from "./types.ts";

/** Separate content identity; never uses or consumes a sporting RNG stream. Version 1 is permanent. */
export function contentId(saveId:string,key:string) {
  const h=createHash("sha256").update(JSON.stringify(["career-life",1,saveId,key])).digest("hex").slice(0,32);
  return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20)}`;
}
export function variant(key:string,count:number) {
  let n=2166136261;for(const c of key)n=Math.imul(n^c.charCodeAt(0),16777619);
  return (n>>>0)%count;
}
const traits=["RESERVED","PROFESSIONAL","CONFIDENT","FIERY","SHOWMAN","HUMOROUS","INTENSE","AMBITIOUS","GRACIOUS"];
export function npcPersonality(id:string) {
  const primary=traits[variant(`primary:${id}`,traits.length)],second=traits[variant(`secondary:${id}`,traits.length)];
  return {primary,secondary:second!==primary && variant(`two:${id}`,3)===0 ? second : null};
}
export const threadTitle=(key:string)=>key==="q-school" ? "The Q-School journey" : key==="card" ? "Tour Card Career" : key==="palace" ? "The Palace" :
  key.startsWith("rival:") ? "A recurring sporting relationship" : key==="commercial" ? "Off-board Career" : key.startsWith("event:") ? "Event / place memory" : "Sporting breakthroughs";

/** Composable context families, not attributed invented NPC statements or generated private lives. */
export const COPY:Record<string,{heads:string[];intro:string[];question:string}> = {
  breakthrough:{heads:["A new step in this Career","A sporting first"],intro:["A first has been recorded.","This result adds a new entry to the Career record."],question:"What does this first mean to you?"},
  amateur:{heads:["An amateur breakthrough","Success on the amateur circuit"],intro:["Amateur achievements have their own standing.","This result matters without a professional pathway."],question:"How would you describe your amateur success?"},
  professional:{heads:["A professional milestone","A new mark on tour"],intro:["The professional record has moved forward.","A new professional achievement is now on record."],question:"What do you take from this step on tour?"},
  major:{heads:["On the major stage","A significant stage result"],intro:["A major-stage result deserves a moment.","The sporting record now includes this major milestone."],question:"How do you view this major-stage result?"},
  palace:{heads:["A Palace chapter","A World Championship milestone"],intro:["The World Championship adds a significant chapter.","This is a new part of the World Championship record."],question:"What would you say about this World Championship chapter?"},
  card:{heads:["The Tour Card chapter changes","A Tour Card milestone"],intro:["Professional status has changed in the official record.","This is an important point in the Tour Card journey."],question:"How do you approach this change in your Tour Card journey?"},
  "q-school":{heads:["A Q-School chapter","Another step through Q-School"],intro:["Q-School has produced a recorded outcome.","The qualification journey has another factual chapter."],question:"What would you say about this Q-School experience?"},
  rivalry:{heads:["A familiar contest","Another chapter across the oche"],intro:["Another played meeting is part of the shared record.","The recurring sporting relationship has new evidence."],question:"How would you describe this meeting with your opponent?"},
  adversity:{heads:["A difficult sporting result","A setback in the record"],intro:["The result is recorded without assumptions about emotion.","The next chapter is not predetermined by this outcome."],question:"How do you approach what comes next?"},
  ranking:{heads:["A published ranking milestone","Movement in the official table"],intro:["The published table provides the evidence.","This ranking story comes from the official snapshot."],question:"What do you take from this published position?"},
  return:{heads:["Returning to a familiar event","An event with Career history"],intro:["There is real previous history at this event.","This return connects with an earlier sporting result."],question:"What does returning to this event mean to you?"},
  generation:{heads:["Careers cross again","A generational connection"],intro:["The shared cohort is part of the factual history.","A played meeting connects two Career pathways."],question:"How do you see this shared sporting history?"},
  retirement:{heads:["A Career reaches retirement","A sporting farewell"],intro:["The public sporting status is now retired.","The recorded achievements remain part of the darts world."],question:"What would you say about this sporting Career?"},
  world:{heads:["Across the darts world","A result elsewhere on tour"],intro:["A significant world result has been recorded.","The wider darts world has a new result to report."],question:"What do you take from the wider darts world?"},
  commercial:{heads:["Life away from the match board","An optional off-board chapter"],intro:["A legitimate darts commitment has been completed.","Commercial history is separate from sporting results."],question:"How do you approach this part of your Career?"},
  draw:{heads:["An actual draw","An upcoming contest"],intro:["The authored draw provides the upcoming match.","This is draw evidence, not a played result."],question:"What do you take from this draw?"},
  qualification:{heads:["A qualification chapter","A recorded entry entitlement"],intro:["A public qualification has been awarded.","A recorded entitlement is not a claim of a played appearance."],question:"How do you approach this qualification opportunity?"},
  prospect:{heads:["A younger public Career","A young player's recorded result"],intro:["A younger player has produced a public sporting result.","This young player's result comes from the same darts world."],question:"What do you take from this public sporting result?"},
};
export function response(persona:Persona,family:string,key:string) {
  const subject=family==="rivalry" ? "the contest" : family==="palace" ? "this World Championship chapter" : family==="card" ? "the next step" : "this part of the Career";
  const lines:Record<Persona,string[]> = {
    PROFESSIONAL:[`I respect the work that goes into ${subject}. I'll keep approaching it properly.`,`There are good players here. I'll give ${subject} the respect it deserves.`],
    CONFIDENT:[`I believe I belong in ${subject}. I'll back myself.`,`I set high expectations for myself in ${subject}, and that hasn't changed.`],
    SHOWMAN:[`I want people to remember ${subject}. I'll enjoy sharing it with the crowd.`,`There's an audience for ${subject}. I want to give them something to enjoy.`],
    FIERY:[`I'm ready for ${subject}. I won't shy away from the challenge.`,`Bring on the next challenge in ${subject}. I intend to make my voice heard.`],
    RESERVED:[`I'll let the darts speak. ${subject.charAt(0).toUpperCase()+subject.slice(1)} is enough for me.`,`I'm keeping ${subject} low-key and concentrating on the next event.`],
  };
  return lines[persona][variant(key+persona,lines[persona].length)];
}
