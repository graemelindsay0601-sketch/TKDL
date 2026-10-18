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
export const threadTitle=(key:string)=>key==="q-school" ? "Q-School" : key==="card" ? "Your Tour Card" : key==="palace" ? "The Palace" :
  key.startsWith("rival:") ? "A rivalry" : key==="commercial" ? "Off the oche" : key.startsWith("event:") ? "Events you keep going back to" : "Career firsts";

/** Composable context families, not attributed invented NPC statements or generated private lives. */
export const COPY:Record<string,{heads:string[];intro:string[];question:string}> = {
  breakthrough:{heads:["A first","A new first"],intro:["It's the first time this has happened in your career.","One for the scrapbook: a career first."],question:"What does this first mean to you?"},
  amateur:{heads:["Amateur success","A win on the amateur circuit"],intro:["Amateur darts is a career in its own right, and this is a good day in it.","A result to be proud of, Tour Card or not."],question:"How would you describe your amateur success?"},
  professional:{heads:["A professional milestone","A step forward on tour"],intro:["Another step forward as a professional.","A new high on tour."],question:"What do you take from this step on tour?"},
  major:{heads:["On the big stage","A big stage result"],intro:["A result on one of the big stages.","The big stage, and you made your mark on it."],question:"How do you view this big-stage result?"},
  palace:{heads:["The Palace","World Championship news"],intro:["The World Championship is the one everyone wants.","News from the biggest event of the year."],question:"What would you say about the World Championship?"},
  card:{heads:["Tour Card news","On the Tour Card list"],intro:["A change on the list of Tour Card holders.","Tour Cards are the ticket to the professional tour."],question:"How do you feel about your Tour Card news?"},
  "q-school":{heads:["Q-School","Q-School news"],intro:["Another day at Q-School is done.","Q-School is where Tour Cards are won and lost."],question:"What would you say about your time at Q-School?"},
  rivalry:{heads:["A familiar opponent","Another meeting"],intro:["You two have met before.","Another chapter between two players who know each other well."],question:"How would you describe this meeting with your opponent?"},
  adversity:{heads:["A tough result","A setback"],intro:["Not the result you wanted.","A bad day, but the next event is never far away."],question:"How do you approach what comes next?"},
  ranking:{heads:["Ranking news","On the move in the rankings"],intro:["The new rankings are out.","This week's rankings have you on the move."],question:"What do you make of your ranking?"},
  return:{heads:["Back again","A return visit"],intro:["You've been here before.","A familiar event, with history behind it."],question:"What does returning to this event mean to you?"},
  generation:{heads:["Paths cross again","Old faces"],intro:["Two players who came through together meet again.","You started out around the same time."],question:"How do you see your shared history?"},
  retirement:{heads:["Retirement","A farewell"],intro:["A career comes to an end.","The darts world says goodbye, but the results stay in the record books."],question:"What would you say about this career?"},
  world:{heads:["Around the darts world","Elsewhere on tour"],intro:["Big news from elsewhere in the darts world.","Meanwhile, elsewhere on tour."],question:"What do you make of the news?"},
  commercial:{heads:["Off the oche","Away from the board"],intro:["A job done away from the board.","Business off the oche, separate from your results."],question:"How do you approach this part of your career?"},
  draw:{heads:["The draw is out","Coming up"],intro:["The draw has been made.","Your next opponent is set."],question:"What do you make of the draw?"},
  qualification:{heads:["Qualified","You're in"],intro:["You've earned your place.","Your place is booked; you still need to enter."],question:"How do you feel about qualifying?"},
  club:{heads:["Club news","At your home club"],intro:["News from your home club's county league.","Your club has news."],question:"What does your club mean to you?"},
  fans:{heads:["A growing following","The crowd is with you"],intro:["More people are following your darts than ever.","Your results have built a following."],question:"What do your supporters mean to you?"},
  savings:{heads:["Money in the bank","Saved up"],intro:["The small nights have paid for something bigger.","Week by week, the money has added up."],question:"Was it worth all those midweek nights?"},
  perfect:{heads:["Perfection","A nine-dart finish"],intro:["The darts world has a perfect leg to talk about.","Nine darts, one leg: the rarest feat in the game."],question:"What does a perfect leg mean to you?"},
  tipped:{heads:["Tipped for the top","One to watch this season"],intro:["The close season has the circuit talking about a player on the rise.","A name is doing the rounds on the circuit this close season."],question:"Who do you see coming through?"},
  watch:{heads:["Names to watch","Rising through the ranks"],intro:["A few players are being tipped to step up a level this season.","The close season has produced some names to follow."],question:"Who do you see coming through?"},
  arrival:{heads:["The tip comes good","A rise confirmed"],intro:["A player tipped in the close season has backed it up with a result.","The talk has turned into a result."],question:"What do you make of this player's rise?"},
  prospect:{heads:["One for the future","A young player makes a name"],intro:["A young player has made people sit up.","A good result from one of the game's young players."],question:"What do you make of this young player's result?"},
};
export function response(persona:Persona,family:string,key:string) {
  const subject=family==="rivalry" ? "this rivalry" : family==="palace" ? "the World Championship" : family==="card" ? "the next step" : "this part of my career";
  const lines:Record<Persona,string[]> = {
    PROFESSIONAL:[`I respect the work that goes into ${subject}. I'll keep approaching it properly.`,`There are good players here. I'll give ${subject} the respect it deserves.`],
    CONFIDENT:[`I believe I belong in ${subject}. I'll back myself.`,`I set high expectations for myself in ${subject}, and that hasn't changed.`],
    SHOWMAN:[`I want people to remember ${subject}. I'll enjoy sharing it with the crowd.`,`There's an audience for ${subject}. I want to give them something to enjoy.`],
    FIERY:[`I'm ready for ${subject}. I won't shy away from the challenge.`,`Bring on the next challenge in ${subject}. I intend to make my voice heard.`],
    RESERVED:[`I'll let the darts speak. ${subject.charAt(0).toUpperCase()+subject.slice(1)} is enough for me.`,`I'm keeping ${subject} low-key and concentrating on the next event.`],
  };
  return lines[persona][variant(key+persona,lines[persona].length)];
}
