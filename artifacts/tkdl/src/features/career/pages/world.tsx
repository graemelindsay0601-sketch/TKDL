import {useState} from "react";
import {Link,useSearch} from "wouter";
import {useWorldContent,useWorldMap,useWorldPlayers,useTrophyCabinet,usePresentation,useEditPresentation,useLaunchSignature,errorMessage} from "../api";
import {CareerError,CareerLoading,CareerSection,BoundedList} from "../components";
import {titleCase,formatPence} from "../model";
import type {ShellContext} from "../shell";
import type {PresentationContent} from "../../../../../api-server/src/career/content/service";
import {CareerShirt,CareerTrophy,CareerEventIdentity} from "../identity";
import {GuidanceSettings} from "../guidance";
import {CareerMapPage} from "./map";

export function WorldPage({ctx,guide=false}:{ctx:ShellContext;guide?:boolean}) {
  const world=useWorldContent(ctx.save.id);
  if(world.isLoading)return <CareerLoading/>;
  if(world.error||!world.data)return <CareerError error={world.error} onRetry={()=>world.refetch()}/>;
  const d=world.data;
  return <div className="space-y-3">
    <h1>{guide?"Career Guide":"Darts World / Almanac"}</h1>
    <p>Build a darts career your way. Professional darts is an opportunity, not a mandatory objective.</p>
    {guide?<><GuidanceSettings saveId={ctx.save.id}/>{d.guide.map(g=><details className="pdc-card p-3" key={g.id}><summary>{g.title}</summary><p className="py-2">{g.body}</p></details>)}</>:<>
      <CareerSection title="Organisations & circuits"><div className="p-4 space-y-2">{d.organisations.map(o=><p key={o.id}><strong>{o.shortName}</strong> — {o.name}: {o.role}</p>)}
        <p>{d.circuits.map(c=>c.name).join(" · ")}</p></div></CareerSection>
      <CareerSection title="Season rhythm"><div className="p-4">{d.seasonRhythm.map(s=><p key={s.id}>Weeks {s.fromWeek}–{s.toWeek}: {s.name}</p>)}</div></CareerSection>
      <CareerSection title="World directory"><div className="p-4 space-y-2">
        <Link href={`/career/${ctx.save.id}/rankings`}>Published rankings</Link>{" · "}
        <Link href={`/career/${ctx.save.id}/map`}>Events & locations</Link>{" · "}
        <Link href={`/career/${ctx.save.id}/history`}>Champions, records & Hall of Fame</Link>{" · "}
        <Link href={`/career/${ctx.save.id}/world/trophies`}>Factual trophy cabinet</Link>{" · "}
        <Link href={`/career/${ctx.save.id}/relationships`}>Player relationships (A7.2)</Link>{" · "}
        <Link href={`/career/${ctx.save.id}/world/players`}>Players & commercial identity</Link>
        <p>{d.venues.length} authored venues · {d.trophies.length} trophy designs · {d.brands.length} brands and local partners</p></div></CareerSection>
      <CareerSection title="Championship identities"><div className="p-4 space-y-2">{d.eventFamilies.filter(e=>["MAJOR","WORLD_CHAMPIONSHIP"].includes(e.eventClass)).map(e=><p key={e.id}>
        <strong>{e.name}</strong> · {d.trophies.find(t=>t.id===e.trophyId)?.name} · {titleCase(e.longevity)} · {e.fieldDescription}</p>)}</div></CareerSection>
      <details className="pdc-card p-4"><summary>Venues & regions</summary>{d.venues.map(v=><p key={v.id}>{v.displayName} — {v.city}, {v.countryId} · {titleCase(v.venueType)}</p>)}</details>
      <details className="pdc-card p-4"><summary>Commercial brands</summary>{d.brands.map(b=><p key={b.id}>{b.name} · {b.sector} · {titleCase(b.slot)} · {b.personality}</p>)}</details>
    </>}
  </div>;
}
export function WorldMapPage({ctx}:{ctx:ShellContext}) {
  return <CareerMapPage ctx={ctx}/>;
}
export function WorldPlayersPage({ctx}:{ctx:ShellContext}) {
  const [offset,setOffset]=useState(0),players=useWorldPlayers(ctx.save.id,offset);
  if(players.isLoading)return <CareerLoading/>;
  if(players.error||!players.data)return <CareerError error={players.error} onRetry={()=>players.refetch()}/>;
  return <CareerSection title="World players"><p className="p-3">{players.data.total} people · public facts only. Commercial allocations are content metadata, not NPC financial accounts or invented contract history.</p>
    {players.data.players.map(p=><div className="p-3 border-b" key={p.id}><Link href={`/career/${ctx.save.id}/${p.historyRoute}`}><strong>{p.name}</strong></Link> · {String(p.country)}, {String(p.region)} · {String(p.status)}
      <p>{p.commercial.portfolio.map(s=>`${s.brandName} (${titleCase(s.slot)})`).join(" · ")||"No commercial allocation"}{p.commercial.signatureProductPossible?" · Signature-product possibility":""}</p></div>)}
    <div className="p-3 flex gap-2"><button className="career-btn" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><button className="career-btn" disabled={players.data.nextOffset===null} onClick={()=>players.data.nextOffset!==null&&setOffset(players.data.nextOffset)}>Next</button></div>
  </CareerSection>;
}
export function TrophyPage({ctx}:{ctx:ShellContext}) {
  const [offset,setOffset]=useState(0),cabinet=useTrophyCabinet(ctx.save.id,offset);
  if(cabinet.isLoading)return <CareerLoading/>;
  if(cabinet.error||!cabinet.data)return <CareerError error={cabinet.error} onRetry={()=>cabinet.refetch()}/>;
  return <CareerSection title="Factual trophy cabinet"><p className="p-3">{cabinet.data.total} actual A3 tournament wins. Repeated wins remain separate achievements. Qualifier wins are labelled, not promoted into major titles.</p>
    <div className="career-trophy-grid">{[...new Set(cabinet.data.titles.map(t=>t.canonicalEventId))].map(key=>{
      const editions=cabinet.data!.titles.filter(t=>t.canonicalEventId===key),t=editions[0];
      return <CareerEventIdentity eventKey={key} key={key} className="career-surface surface-prestige">
        {t.trophy&&t.circuit!=="Q_SCHOOL"&&<CareerTrophy name={t.trophy.name} design={t.trophy.designKey}/>}<h3>{t.name}</h3><p>{editions.length} recorded edition{editions.length===1?"":"s"} on this page · {t.circuit==="Q_SCHOOL"?"Session win — not a tournament title or automatic Tour Card":titleCase(t.classification)}</p><details><summary>Inspect individual wins</summary>{editions.map(e=><p key={e.eventId}><Link href={`/career/${ctx.save.id}/events/${e.eventId}`}>Season {e.season} · {e.venue?.displayName??"Venue not recorded"} · {e.circuit==="Q_SCHOOL"?"Q-School session":e.trophy?.name??"Trophy design unavailable"}</Link></p>)}</details></CareerEventIdentity>;
    })}</div>
    {!cabinet.data.total&&<p className="p-3">No titles invented. Your first actual win will appear here.</p>}
    <div className="p-3 flex gap-2"><button className="career-btn" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><button className="career-btn" disabled={cabinet.data.nextOffset===null} onClick={()=>cabinet.data.nextOffset!==null&&setOffset(cabinet.data.nextOffset)}>Next</button></div>
  </CareerSection>;
}
export function PresentationPage({ctx}:{ctx:ShellContext}) {
  const needsSetup=new URLSearchParams(useSearch()).get("setup")==="needed";
  const p=usePresentation(ctx.save.id),launch=useLaunchSignature(ctx.save.id),[message,setMessage]=useState("");
  if(p.isLoading)return <CareerLoading/>;
  if(p.error||!p.data)return <CareerError error={p.error} onRetry={()=>p.refetch()}/>;
  return <div className="space-y-3"><h1>Player presentation & equipment</h1><p>Cosmetic only. No scorer, ability, RNG, ranking or financial bonuses.</p>
    {needsSetup&&<p className="career-surface surface-context" role="status">This Career is saved. Shirt setup was not confirmed; review and save your cosmetic choices here. You do not need to create another Career.</p>}
    <IdentityEditor key={JSON.stringify(p.data.identity)} saveId={ctx.save.id} data={p.data}/>
    <CareerSection title="Contract-controlled shirt placement"><div className="p-4">{p.data.placements.map(s=><p key={s.contractId}>{s.brandName}: {titleCase(s.position)} ({titleCase(s.slot)})</p>)}{!p.data.placements.length&&<p>No active partners.</p>}</div></CareerSection>
    <CareerSection title="Signature product history"><div className="p-4"><BoundedList rows={p.data.products}>{s=><p key={s.id}>{s.name} · S{s.launchSeason} · {s.state}</p>}</BoundedList>
      <p>Launch requires an active equipment deal, established sporting achievement and an active A7.5 merchandise agreement. A range also requires {formatPence(100000)} recorded commercial income. A4 owns payments.</p>
      {!ctx.retired&&p.data.productCandidates.map(c=><div key={c.contractId}>{c.types.map(type=><button className="career-btn m-1" key={type} disabled={launch.isPending||!c.hasCommercialAgreement}
        onClick={()=>launch.mutate({contractId:c.contractId,productType:type},{onSuccess:()=>setMessage("Signature product recorded."),onError:e=>setMessage(errorMessage(e))})}>Launch {titleCase(type)} with {c.manufacturer}</button>)}</div>)}
      {message&&<p role="status">{message}</p>}</div></CareerSection></div>;
}
function IdentityEditor({saveId,data}:{saveId:string;data:PresentationContent}) {
  const edit=useEditPresentation(saveId),[identity,setIdentity]=useState(data.identity),[message,setMessage]=useState("");
  const set=(key:string,value:string)=>setIdentity({...identity,[key]:value});
  return <CareerSection title="Presentation identity"><form className="p-4 space-y-3" onSubmit={e=>{e.preventDefault();edit.mutate(identity,{onSuccess:()=>setMessage("Presentation saved."),onError:e=>setMessage(errorMessage(e))});}}>
    <CareerShirt name="Your Career player" identity={identity} sponsors={data.placements} scale="profile"/>
    <label className="block">Nickname <input maxLength={32} value={identity.nickname??""} onChange={e=>set("nickname",e.target.value)} disabled={!data.canEdit}/></label>
    <label className="block">Shirt <select value={identity.shirtTemplate} onChange={e=>set("shirtTemplate",e.target.value)} disabled={!data.canEdit}>{["CLASSIC","CHEVRON","SPLIT"].map(t=><option key={t}>{t}</option>)}</select></label>
    {(["primaryColour","secondaryColour","accentColour"] as const).map(k=><label className="block" key={k}>{titleCase(k)} <input type="color" value={identity[k]} onChange={e=>set(k,e.target.value)} disabled={!data.canEdit}/></label>)}
    <label className="block">Competition category <select value={String(identity.competitionCategory)} onChange={e=>set("competitionCategory",e.target.value)} disabled={!data.canEdit}>
      <option value="OPEN">Open / mixed pathways</option><option value="WOMEN">Declared women's-category eligibility + open / mixed pathways</option></select></label>
    <p>{data.editWindow}. All other eligibility rules still apply.</p><button className="career-btn" disabled={!data.canEdit||edit.isPending}>Save presentation</button>{message&&<p role="status">{message}</p>}
  </form></CareerSection>;
}
