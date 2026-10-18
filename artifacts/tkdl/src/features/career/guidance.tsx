import {Link} from "wouter";
import {useGuidance,useEditGuidance,errorMessage} from "./api";
const HELP:Record<string,[string,string]>={
  home:["Build a darts career your way","Local, open and Vault darts can be a lifelong career. Turning professional is an option, not a must. Your next move shows what to decide now."],
  event:["Plan before committing","Qualified isn't the same as entered. Check the entry deadline, clashes with your other plans, what a sponsor covers and what it costs you."],
  tournament:["Your tournament, safely saved","Leaving the screen just pauses your match; you're never withdrawn for it, and every dart is saved. Conceding loses that match; withdrawing ends your tournament."],
  sponsors:["Your commercial choices","What sponsors pay and cover comes from your active contracts. Logos on your shirt are just for show; no deal makes you play better."],
  rankings:["Sporting routes, not levels","Ranking values and cut-off lines come from the published standings. Only the sporting rules decide who gets in; nothing boosts your ability."],
  review:["Review your season","Each season is closed off before the next begins. Look back at your results and decisions; a poor season isn't a failed career."],
  "q-school":["Q-School is a real sporting route","Q-School has a First Stage and a Final Stage. Winning a day doesn't automatically earn a Tour Card; the Order of Merit decides who gets one."],
  "tour-card":["Tour Card status","A Tour Card opens the professional tour to you. Keeping it, losing it and winning it back follow the sporting rules; local and open darts stay open to you either way."],
  major:["Your first championship opportunity","You can get in by ranking, qualifier or invitation. Check the cut-off and deadline; qualifying never enters you, so remember to enter."],
  palace:["The Palace World Championship","The biggest event of the winter: longer matches played in sets, entered through the rankings or qualifiers. The Sovereign Trophy goes to the champion."],
};
export function ContextHelp({saveId,topic}:{saveId:string;topic:string}) {
  const q=useGuidance(saveId),edit=useEditGuidance(saveId),help=HELP[topic];
  if(!help||!q.data?.canEdit||q.data.mode==="MINIMAL"||q.data.dismissed.includes(topic)||q.data.mode==="STANDARD"&&!["home","event","tournament","review"].includes(topic))return null;
  return <aside className="career-surface surface-context career-help" aria-label="Career guidance"><strong>{help[0]}</strong><p>{help[1]}</p><div><Link href={`/career/${saveId}/guide`}>Read the Career Guide</Link><button className="career-btn career-btn-ghost" disabled={edit.isPending} onClick={()=>edit.mutate({dismiss:topic})}>Dismiss this tip</button></div>{edit.error&&<p role="alert">{errorMessage(edit.error)}</p>}</aside>;
}
export function GuidanceSettings({saveId}:{saveId:string}) {
  const q=useGuidance(saveId),edit=useEditGuidance(saveId);
  return <section className="career-surface surface-context career-guidance"><div className="career-guidance__head"><div><h2>Guidance</h2><p>Help frequency only. No gameplay or difficulty effect. Every topic stays readable here.</p></div>
    <label className="career-guidance__mode">Frequency <select value={q.data?.mode??"STANDARD"} disabled={!q.data?.canEdit||edit.isPending} onChange={e=>edit.mutate({mode:e.target.value})}>{["FULL","STANDARD","MINIMAL"].map(v=><option key={v}>{v}</option>)}</select></label></div>
    <div className="career-guide-grid">{Object.entries(HELP).map(([key,h],i)=><details className="career-guide-topic" key={key}><summary><span aria-hidden="true">{String(i+1).padStart(2,"0")}</span>{h[0]}</summary><p>{h[1]}</p></details>)}</div>{edit.error&&<p role="alert">{errorMessage(edit.error)}</p>}</section>;
}
