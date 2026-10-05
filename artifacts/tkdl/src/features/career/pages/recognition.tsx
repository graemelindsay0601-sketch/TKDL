import { Link } from "wouter";
import { useCareerRecognition, useNpcRecognition } from "../api";
import { CareerEmptyState, CareerSection, QueryState, StatusBadge } from "../components";
import type { ShellContext } from "../shell";
import type { Tone } from "../model";
import type { RecognitionLevel, RecognitionView } from "../../../../../api-server/src/career/recognition/types";
import { FactLine } from "./facts-panels";

const tone = (level:RecognitionLevel):Tone => level==="ELITE" ? "gold" : level==="HIGHLY_REGARDED" ? "info" : level==="ESTABLISHED" ? "success" : level==="UNKNOWN" ? "muted" : "neutral";
export function RecognitionPage({ctx,npcId}: {ctx:ShellContext;npcId?:string}) {
  const human=useCareerRecognition(ctx.save.id,!npcId),npc=useNpcRecognition(ctx.save.id,npcId);
  const query=npcId ? npc : human;
  return <div className="space-y-3">
    <CareerSection title={npcId ? "Public opponent recognition" : "Career standing & recognition"}>
      <p className="p-4 text-sm text-white/70">Earned sporting recognition, not points to collect. Local, amateur, professional, major-stage and international standing develop independently. Focus and personal goals do not grant recognition.</p>
      <QueryState query={query} label="Reading sporting recognition">{data=><RecognitionDetails data={data} saveId={ctx.save.id}/>}</QueryState>
    </CareerSection>
    <Link className="career-btn career-btn-ghost" href={`/career/${ctx.save.id}/${npcId ? "relationships" : "history"}`}>{npcId ? "Back to relationships" : "Career history"}</Link>
  </div>;
}
export function RecognitionDetails({data,saveId}: {data:RecognitionView;saveId:string}) {
  return <div className="p-4 pt-0 space-y-4">
    {data.subject.kind==="NPC" && <h2 className="text-lg font-bold">{data.subject.name}</h2>}
    <div><h2 className="text-xl font-bold">{data.standing.label}</h2><p className="text-sm text-white/70 mt-1">{data.standing.description}</p></div>
    {data.subject.retired && <p className="text-sm text-white/70">Retired {data.subject.kind==="NPC" ? "player" : "Career"}: earned recognition remains readable. This screen creates no further progression.</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{data.contexts.map(c=><section key={c.context} className="rounded-xl border border-white/15 p-3" aria-label={`${c.label} recognition`}>
      <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{c.label}</h3><StatusBadge label={c.levelLabel} tone={tone(c.level)} /></div>
      <h4 className="text-xs text-white/60 mt-3">Why you're recognised</h4>
      {c.evidence.length ? <ul>{c.evidence.map(f=><FactLine key={f.id} fact={f} saveId={saveId}/>)}</ul>
        : <p className="mt-2 text-sm text-white/60">No qualifying sporting evidence recorded in this context yet.</p>}
    </section>)}</div>
    <p className="text-xs text-white/60">{data.historyNote}</p>
    <MilestoneList data={data} saveId={saveId}/>
    {data.relationships.length>0 && <section><h3 className="font-bold">Notable sporting relationships</h3><ul className="space-y-2 mt-2">{data.relationships.map(r=><li key={r.opponentId} className="text-sm">
      <Link className="underline" href={`/career/${saveId}/recognition/npcs/${r.opponentId}`}>{r.name}</Link> — {r.labels.join(" · ")}
      <p className="text-xs text-white/60">{r.description}</p></li>)}</ul></section>}
    <p className="text-xs text-white/60">Recognition never changes scoring, opponents, draws, rankings, qualification, entry costs, prize money, Tour Cards or sponsor offers.</p>
  </div>;
}
function MilestoneList({data,saveId}: {data:RecognitionView;saveId:string}) {
  return <section><h3 className="font-bold">Recent recognition milestones</h3>
    {data.milestones.length ? <ul>{[...data.milestones].reverse().slice(0,6).map(f=><FactLine key={f.id} fact={f} saveId={saveId}/>)}</ul>
      : <CareerEmptyState title="No dated recognition milestones">Current standing still uses all evidenced achievements. Missing chronology is not replaced with invented dates.</CareerEmptyState>}
  </section>;
}
export function RecognitionSummary({saveId}: {saveId:string}) {
  const query=useCareerRecognition(saveId);
  return <CareerSection title="Career standing" action={<Link className="career-btn career-btn-ghost" href={`/career/${saveId}/recognition`}>Recognition</Link>}>
    <QueryState query={query} label="Reading Career standing">{data=><div className="px-4 py-3 space-y-2">
      <h3 className="font-bold">{data.standing.label}</h3><p className="text-xs text-white/70">{data.standing.description}</p>
      <div className="flex flex-wrap gap-2">{data.strongest.map(context=>{
        const c=data.contexts.find(v=>v.context===context)!;
        return <StatusBadge key={context} label={`${c.label} · ${c.levelLabel}`} tone={tone(c.level)}/>;
      })}</div>
    </div>}</QueryState>
  </CareerSection>;
}
/** Recognition history stays separate from A7.1's sporting facts authority. */
export function RecognitionTimeline({saveId}: {saveId:string}) {
  const query=useCareerRecognition(saveId);
  return <CareerSection title="Recognition threshold history">
    <QueryState query={query} label="Reading recognition history">{data=><div className="p-3">
      <p className="text-xs text-white/60">{data.historyNote} Oldest first; same-day facts have no implied time of day.</p>
      {data.milestones.length ? <ol>{data.milestones.map(f=><FactLine key={f.id} fact={f} saveId={saveId}/>)}</ol>
        : <CareerEmptyState title="No dated recognition milestones"/>}
    </div>}</QueryState>
  </CareerSection>;
}
