import {useState} from "react";
import {Link,useSearch} from "wouter";
import {useWorldContent,useWorldMap,useWorldPlayers,useTrophyCabinet,usePresentation,useEditPresentation,useLaunchSignature,errorMessage} from "../api";
import {CareerError,CareerLoading,CareerSection,BoundedList,OSWALD} from "../components";
import {titleCase,formatPence} from "../model";
import type {ShellContext} from "../shell";
import type {PresentationContent} from "../../../../../api-server/src/career/content/service";
import {CareerShirt,CareerEventIdentity,type ShirtIdentity} from "../identity";
import {AwardPresentation,awardLabel,resolveAward,trophyArt} from "../trophies";
import "./trophy-cabinet.css";
import {CareerKitCustomizer} from "../kit-customizer";
import {GuidanceSettings} from "../guidance";
import {CareerMapPage} from "./map";
import {eligibleKitMakerIds} from "../apparel/brand-mark-identity";
import {CareerPageHero} from "../page-hero";
import {Shirt,Sparkles,Tag} from "lucide-react";
import "./life.css";

export function WorldPage({ctx,guide=false}:{ctx:ShellContext;guide?:boolean}) {
  const world=useWorldContent(ctx.save.id);
  if(world.isLoading)return <CareerLoading/>;
  if(world.error||!world.data)return <CareerError error={world.error} onRetry={()=>world.refetch()}/>;
  const d=world.data;
  return <div className="space-y-3">
    {guide?<CareerPageHero kicker="Career Guide" title="How Career works" accent="#69b8ec" stage={{venue:{venueType:"conference"},eventClass:"PROFESSIONAL_TOUR"}}
      watermark={`${d.guide.length}`} subtitle={<p>Build a darts career your way. Professional darts is an opportunity, not a mandatory objective.</p>}
      stats={[{label:"Guide topics",value:d.guide.length,tone:"gold"},{label:"Organisations",value:d.organisations.length},{label:"Circuits",value:d.circuits.length},{label:"Venues",value:d.venues.length}]}/>
    :<><h1>Darts World / Almanac</h1><p>Build a darts career your way. Professional darts is an opportunity, not a mandatory objective.</p></>}
    {guide?<><GuidanceSettings saveId={ctx.save.id}/>
      <div className="career-guide-grid">{d.guide.map((g,i)=><details className="career-guide-topic" key={g.id}><summary><span aria-hidden="true">{String(i+1).padStart(2,"0")}</span>{g.title}</summary><p>{g.body}</p></details>)}</div></>:<>
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
  // G1: silverware on shelves (E2 policy by actual event key); title wins without a trophy listed honestly below.
  const groups=[...new Set(cabinet.data.titles.map(t=>t.canonicalEventId))].map(key=>{
    const editions=cabinet.data!.titles.filter(t=>t.canonicalEventId===key),t=editions[0];
    return {key,t,editions,award:resolveAward({definitionKey:key,circuit:t.circuit,classification:t.classification},{persistedTrophyId:t.trophy?.id??null})};
  });
  const silverware=groups.filter(g=>g.award.award!=="RESULT_ONLY"),plain=groups.filter(g=>g.award.award==="RESULT_ONLY");
  const wins=(n:number)=>`${n} recorded win${n===1?"":"s"}`;
  // The award's name as text (not only image alt): the E2 design's catalogue name, or the recognition form.
  const awardName=(a:ReturnType<typeof resolveAward>)=>a.designId?trophyArt(a.designId)?.name??awardLabel(a):awardLabel(a);
  return <div className="space-y-3">
    <section className="career-cabinet-hero" aria-label="Trophy cabinet">
      <p className="career-cabinet-hero__eyebrow">Trophy cabinet</p>
      <h1 style={OSWALD}>{cabinet.data.total} recorded title{cabinet.data.total===1?"":"s"}</h1>
      <p>{silverware.length?`${silverware.reduce((n,g)=>n+g.editions.length,0)} brought home silverware.`:"No silverware yet."} Every win is an actual A3 champion result; repeat wins stay separate.</p>
    </section>
    {silverware.length>0?<section className="career-cabinet" aria-label="Silverware">
      {silverware.map(({key,t,editions,award})=><CareerEventIdentity eventKey={key} key={key} className="career-cabinet__item">
        <div className="career-cabinet__plinth">{editions.length>1&&<span className="career-cabinet__count" aria-label={`${editions.length} wins`}>×{editions.length}</span>}
          <AwardPresentation event={{definitionKey:key,circuit:t.circuit,classification:t.classification}} persistedTrophyId={t.trophy?.id??null} size="lg" eventName={t.name}/></div>
        <h3 style={OSWALD}>{t.name}</h3><p className="career-cabinet__award">{awardName(award)}</p><p>{wins(editions.length)} · {titleCase(t.classification)}</p>
        <details><summary>Inspect individual wins</summary>{editions.map(e=><p key={e.eventId}><Link href={`/career/${ctx.save.id}/events/${e.eventId}`}>Season {e.season} · {e.venue?.displayName??"Venue not recorded"} · {awardName(award)}</Link></p>)}</details>
      </CareerEventIdentity>)}
    </section>:<p className="career-cabinet__empty">Silverware appears here when you win an event that awards a trophy, plaque or medal.</p>}
    {plain.length>0&&<CareerSection title="Titles without silverware">
      <p className="px-3 pt-3 text-sm text-white/60">Weekly fixtures, qualifiers and Q-School sessions are recorded wins with result and prize only.</p>
      <ul className="career-cabinet__list">{plain.map(({key,t,editions})=><li key={key}>
        <Link href={`/career/${ctx.save.id}/events/${editions[0].eventId}`}><strong>{t.name}</strong></Link>
        <span>{wins(editions.length)} · {t.circuit==="Q_SCHOOL"?"Session win — not a tournament title or automatic Tour Card":titleCase(t.classification)}</span></li>)}</ul>
    </CareerSection>}
    {!cabinet.data.total&&<p className="p-3">No titles invented. Your first actual win will appear here.</p>}
    {(offset>0||cabinet.data.nextOffset!==null)&&<div className="p-3 flex gap-2"><button className="career-btn" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><button className="career-btn" disabled={cabinet.data.nextOffset===null} onClick={()=>cabinet.data.nextOffset!==null&&setOffset(cabinet.data.nextOffset)}>Next</button></div>}
  </div>;
}
export function PresentationPage({ctx}:{ctx:ShellContext}) {
  const needsSetup=new URLSearchParams(useSearch()).get("setup")==="needed";
  const p=usePresentation(ctx.save.id),launch=useLaunchSignature(ctx.save.id);
  const [message,setMessage]=useState("");
  const [launchReveal,setLaunchReveal]=useState<{manufacturer:string;type:string;season:number}|null>(null);
  if(p.isLoading)return <CareerLoading/>;
  if(p.error||!p.data)return <CareerError error={p.error} onRetry={()=>p.refetch()}/>;
  const products=p.data.products;
  return <div className="space-y-3">
    <CareerPageHero kicker="Career identity · Equipment studio" title="Kit Room" accent="#4fd1e8"
      stage={{venue:{venueType:"studio"},eventClass:"PROFESSIONAL_TOUR"}}
      subtitle={<p>Shape the presentation of your player, manage your cosmetic kit and see the signature products recorded in your Career.</p>}
      portrait={<CareerShirt identity={p.data.identity} sponsors={p.data.placements} name={ctx.save.careerName??"Player"} scale="featured"/>}
      actions={<><Link className="career-btn career-btn-ghost" href={`/career/${ctx.save.id}/sponsors`}>Sponsor headquarters</Link>
        <Link className="career-btn career-btn-ghost" href={`/career/${ctx.save.id}/finances`}>Commercial finances</Link>
        <Link className="career-btn career-btn-ghost" href={`/career/${ctx.save.id}/history`}>Career history</Link></>}
      stats={[{label:"Kit collection",value:"250",sub:"Original designs",tone:"gold"},{label:"Partner marks",value:p.data.placements.length,sub:p.data.placements.length?"On your shirt":"No active partners"},
        {label:"Signature products",value:products.length},{label:"Edit window",value:p.data.canEdit?"Open":"Closed",sub:p.data.editWindow,tone:p.data.canEdit?"good":"neutral"}]}/>
    {needsSetup&&<p className="career-surface surface-context" role="status">This Career is saved. Shirt setup was not confirmed; review and save your cosmetic choices here. You do not need to create another Career.</p>}
    <CareerSection title="Player kit & presentation" icon={<Shirt size={15}/>} accent="#4fd1e8">
      <details className="career-note mx-4 mt-4"><summary>Style, never stats</summary><p>Your kit and cosmetic choices change presentation only. They do not alter scoring, ability, RNG, rankings, eligibility or finances.</p></details>
      <IdentityEditor key={JSON.stringify(p.data.identity)} saveId={ctx.save.id} data={p.data}/>
    </CareerSection>
    <CareerSection title="Contract-controlled shirt placement" icon={<Tag size={15}/>} accent="#d1a65c"><div className="p-4">
      {p.data.placements.length?<div className="career-placements">{p.data.placements.map(s=><div key={s.contractId} className="career-placement">
        <span aria-hidden="true">{s.brandName.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase()}</span>
        <div><strong>{s.brandName}</strong><small>{titleCase(s.position)} · {titleCase(s.slot)}</small></div></div>)}</div>
      :<p className="career-fineprint">No active partners. Partner marks appear here and on your shirt when a sponsor agreement is signed.</p>}</div></CareerSection>
    <CareerSection title="Signature products" icon={<Sparkles size={15}/>} accent="#4fd1e8">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-200">Your commercial legacy</p>
            <h2 className="mt-1 text-2xl text-white" style={OSWALD}>Products carrying your name</h2></div>
          <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1 text-xs text-white/65">{products.length} recorded</span>
        </div>
        {launchReveal&&<div className="relative overflow-hidden rounded-xl border border-amber-200/25 bg-[radial-gradient(ellipse_at_80%_0%,rgba(251,191,36,.17),transparent_40%),linear-gradient(110deg,#111d2e,#07101c)] p-4" role="status">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-200">Career product milestone · Season {launchReveal.season}</p>
              <h3 className="mt-1 text-xl text-white" style={OSWALD}>{titleCase(launchReveal.type.replaceAll("_"," "))}</h3>
              <p className="mt-1 text-sm text-white/65">Recorded with {launchReveal.manufacturer}. A4 remains the authority for any commercial payments.</p></div>
            <button className="career-btn career-btn-ghost shrink-0" onClick={()=>setLaunchReveal(null)} aria-label="Dismiss product launch confirmation">Close</button>
          </div>
        </div>}
        {products.length>0?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{products.map(product=>{
          const productType=String(product.type??"SIGNATURE_PRODUCT"),manufacturer=String(product.manufacturer??"Equipment partner");
          return <article key={product.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(145deg,#122338,#09111c_70%)] p-4 transition hover:-translate-y-0.5 hover:border-cyan-200/25">
          <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full border border-cyan-200/10 bg-cyan-300/[.035]" aria-hidden="true"/>
          <div className="relative flex items-start justify-between gap-3">
            <ProductArtwork type={productType} manufacturer={manufacturer}/>
            <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${product.state==="ACTIVE"?"border-emerald-300/25 bg-emerald-300/10 text-emerald-200":"border-white/10 bg-white/[.04] text-white/55"}`}>{product.state}</span>
          </div>
          <p className="relative mt-4 text-[9px] font-semibold uppercase tracking-[.18em] text-cyan-100/65">{titleCase(manufacturer)} · Season {product.launchSeason}</p>
          <h3 className="relative mt-1 text-xl leading-tight text-white" style={OSWALD}>{product.name}</h3>
          <p className="relative mt-1 text-xs text-white/50">{titleCase(productType.replaceAll("_"," "))} · Cosmetic identity only</p>
        </article>})}</div>:<div className="rounded-xl border border-dashed border-white/15 bg-black/10 p-5">
          <p className="text-sm text-white/70">No signature products are recorded yet.</p>
          <p className="mt-1 text-xs text-white/45">Eligible launches will appear here after the required sporting standing, active equipment partnership and merchandise agreement are in place.</p>
        </div>}
        <div className="rounded-xl border border-white/10 bg-black/15 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-200">Eligible equipment partners</p>
              <h3 className="mt-1 text-lg text-white" style={OSWALD}>Launch a signature line</h3>
           <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/50">Only active equipment contracts with an explicit signed product right appear here. Launching records the product; it does not invent sales or pay a royalty.</p></div>
          </div>
          {!p.data.productCandidates.length&&<p className="mt-3 text-sm text-white/50">An active equipment partnership is required before a signature-product launch can be offered.</p>}
          <div className="mt-3 grid gap-3 md:grid-cols-2">{!ctx.retired&&p.data.productCandidates.map(candidate=><article key={candidate.contractId} className="rounded-lg border border-white/10 bg-white/[.025] p-3">
            <p className="text-xs uppercase tracking-wider text-white/45">Equipment partner</p><h4 className="mt-1 text-base text-white" style={OSWALD}>{titleCase(candidate.manufacturer)}</h4>
             <div className="mt-3 flex flex-wrap gap-2">{candidate.types.map(type=><button className="career-btn career-btn-primary" key={type} disabled={launch.isPending}
              onClick={()=>launch.mutate({contractId:candidate.contractId,productType:type},{onSuccess:()=>{setMessage("");setLaunchReveal({manufacturer:titleCase(candidate.manufacturer),type,season:p.data.season});},onError:e=>setMessage(errorMessage(e))})}>
              Launch {titleCase(type.replaceAll("_"," "))}
            </button>)}</div>
          </article>)}</div>
          {message&&<p role="alert" className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/[.06] px-3 py-2 text-sm text-rose-100">{message}</p>}
        </div>
        <p className="text-xs text-white/45">Actual product payments belong to A4. This view reports recorded product state only; it does not estimate sales or royalties.</p>
      </div>
    </CareerSection>
  </div>;
}

function ProductArtwork({type,manufacturer}:{type:string;manufacturer:string}) {
  const darts=type==="SIGNATURE_DARTS";
  return <div className="relative flex h-28 flex-1 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(ellipse_at_50%_45%,rgba(34,211,238,.13),transparent_65%),linear-gradient(135deg,#15263a,#080d15)]" aria-hidden="true">
    <span className="absolute left-2 top-2 text-[8px] font-bold uppercase tracking-[.2em] text-white/30">{manufacturer.slice(0,12)}</span>
    {darts?<svg viewBox="0 0 240 100" className="h-20 w-full max-w-52" fill="none">
      <path d="M28 52h68l12-14h38l20 14-20 14h-38L96 52" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="2"/>
      <path d="M146 40l19-20 8 22m-8 18 8 22-19-20" fill="#fbbf24" stroke="#fde68a" strokeWidth="2"/>
      <path d="M28 52H12m16-7-12-7m12 21-12 7" stroke="#67e8f9" strokeWidth="3" strokeLinecap="round"/>
      <path d="M94 45h45m-45 14h45" stroke="#475569" strokeWidth="2"/>
    </svg>:<div className="flex items-center gap-3">
      <div className="relative h-16 w-9 rotate-[-16deg] rounded-[45%_45%_10%_10%] border border-cyan-100/35 bg-gradient-to-b from-cyan-300/65 via-blue-700 to-slate-950 shadow-[0_0_24px_rgba(34,211,238,.18)]">
        <span className="absolute left-1/2 top-2 h-1 w-6 -translate-x-1/2 bg-amber-200/90"/>
        <span className="absolute bottom-3 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full border border-white/20"/>
      </div><div className="flex flex-col gap-1"><span className="h-1 w-12 -skew-x-12 bg-cyan-200/70"/><span className="h-1 w-9 -skew-x-12 bg-amber-200/70"/></div>
    </div>}
  </div>;
}
function IdentityEditor({saveId,data}:{saveId:string;data:PresentationContent}) {
  type EditableIdentity=ShirtIdentity&{nickname?:string|null;competitionCategory?:unknown};
  const edit=useEditPresentation(saveId),[identity,setIdentity]=useState<EditableIdentity>(data.identity),[message,setMessage]=useState("");
  const set=(key:string,value:string)=>setIdentity({...identity,[key]:value});
  return <form className="p-4 space-y-4" onSubmit={e=>{e.preventDefault();edit.mutate(identity,{onSuccess:()=>setMessage("Presentation saved."),onError:e=>setMessage(errorMessage(e))});}}>
     <CareerKitCustomizer identity={identity} sponsors={data.placements}
       eligibleMakerBrandIds={eligibleKitMakerIds(data.placements)}
       playerName="Your Career player" disabled={!data.canEdit} onChange={patch=>setIdentity(current=>({...current,...patch}))}/>
    <div className="career-kitroom-details">
      <label>Nickname <input maxLength={32} value={identity.nickname??""} onChange={e=>set("nickname",e.target.value)} disabled={!data.canEdit} placeholder="e.g. The Anchor"/></label>
      <label>Competition category <select value={String(identity.competitionCategory)} onChange={e=>set("competitionCategory",e.target.value)} disabled={!data.canEdit}>
        <option value="OPEN">Open / mixed pathways</option><option value="WOMEN">Declared women's-category eligibility + open / mixed pathways</option></select></label>
      <button className="career-btn career-btn-primary" disabled={!data.canEdit||edit.isPending}>Save presentation</button>
    </div>
    <p className="career-fineprint">{data.editWindow}. All other eligibility rules still apply.</p>{message&&<p role="status">{message}</p>}
  </form>;
}
