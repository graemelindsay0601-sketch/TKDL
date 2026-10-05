import {Link} from "wouter";
import {useGuidance,useEditGuidance,errorMessage} from "./api";
const HELP:Record<string,[string,string]>={
  home:["Build a darts career your way","Local, open and Vault darts can be a lifelong career. Professional darts is an opportunity, not a compulsory objective. Next Up shows the current decision."],
  event:["Plan before committing","Qualified is not the same as entered. Check the deadline, clashes, commitment, sponsor coverage and your cost. The server decides eligibility."],
  tournament:["Your tournament, safely saved","Leaving the screen pauses play; it never withdraws you. Resume uses the verified dart log. Concession loses a match; tournament withdrawal ends participation."],
  sponsors:["Your commercial choices","Coverage comes from active A4 contracts. Shirt marks are cosmetic; signing a deal never improves darts or bot performance."],
  rankings:["Sporting routes, not levels","Ranking values and cut lines come from published standings. Only sporting rules decide access; no ability boosts or invented qualification probabilities."],
  review:["Review your season","The recorded season closes before the next one begins. Read the actual results and decisions; a poor season is not a failed career."],
  "q-school":["Q-School is a real sporting route","First Stage and Final Stage are separate. Winning a session is not automatically a Tour Card. Read the confirmed allocation and Order of Merit."],
  "tour-card":["Tour Card status","An active card opens eligible professional schedules. Retention, loss and return follow the existing sporting rules; local and open darts remain valid careers."],
  major:["Your first championship opportunity","Qualification, ranking and invitation routes are different. Check the actual cut line and deadline; qualification never enters an event for you."],
  palace:["The Palace World Championship","The winter pinnacle uses its own longer set-play format and legitimate sporting routes. The Sovereign Trophy is earned only by the actual champion."],
};
export function ContextHelp({saveId,topic}:{saveId:string;topic:string}) {
  const q=useGuidance(saveId),edit=useEditGuidance(saveId),help=HELP[topic];
  if(!help||!q.data?.canEdit||q.data.mode==="MINIMAL"||q.data.dismissed.includes(topic)||q.data.mode==="STANDARD"&&!["home","event","tournament","review"].includes(topic))return null;
  return <aside className="career-surface surface-context career-help" aria-label="Career guidance"><strong>{help[0]}</strong><p>{help[1]}</p><div><Link href={`/career/${saveId}/guide`}>Read the Career Guide</Link><button className="career-btn career-btn-ghost" disabled={edit.isPending} onClick={()=>edit.mutate({dismiss:topic})}>Dismiss this tip</button></div>{edit.error&&<p role="alert">{errorMessage(edit.error)}</p>}</aside>;
}
export function GuidanceSettings({saveId}:{saveId:string}) {
  const q=useGuidance(saveId),edit=useEditGuidance(saveId);
  return <section className="career-surface surface-context"><h2>Guidance</h2><p>Help frequency only. No gameplay or difficulty effect. Every topic stays readable here.</p><label>Frequency <select value={q.data?.mode??"STANDARD"} disabled={!q.data?.canEdit||edit.isPending} onChange={e=>edit.mutate({mode:e.target.value})}>{["FULL","STANDARD","MINIMAL"].map(v=><option key={v}>{v}</option>)}</select></label>
    {Object.entries(HELP).map(([key,h])=><details key={key}><summary>{h[0]}</summary><p>{h[1]}</p></details>)}{edit.error&&<p role="alert">{errorMessage(edit.error)}</p>}</section>;
}
