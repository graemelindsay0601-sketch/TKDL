import {useState} from "react";
import {errorMessage,useEquipmentStudio,useSaveEquipmentLoadout,useCreateProductDraft,useApproveProductDraft,useLaunchProductDraft,useRetireProductDraft} from "../api";
import type {ShellContext} from "../shell";

const styles="rounded-xl border border-white/10 bg-slate-950/70 p-4";
const button="rounded-lg border border-amber-300/40 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-300/10 disabled:opacity-40";
const label="grid gap-1 text-xs uppercase tracking-wide text-white/55";
const select="rounded-md border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white";
const money=(p:number)=>`£${(p/100).toFixed(2)}`;
export function EquipmentStudio({ctx}:{ctx:ShellContext}) {
  const saveId=ctx.save.id;
  const query=useEquipmentStudio(saveId);
  const save=useSaveEquipmentLoadout(saveId),create=useCreateProductDraft(saveId),approve=useApproveProductDraft(saveId),
    launch=useLaunchProductDraft(saveId),retire=useRetireProductDraft(saveId);
  const [message,setMessage]=useState("");
  const [loadout,setLoadout]=useState({dartWeight:22,barrel:"STRAIGHT",stem:"SHORT",flight:"STANDARD",flightPattern:"CHEVRON",flightColour:"#e11d48",apparelColour:"#10253e"});
  const [contractId,setContractId]=useState(""),[productType,setProductType]=useState<"SIGNATURE_DARTS"|"SIGNATURE_RANGE">("SIGNATURE_DARTS"),
    [name,setName]=useState(""),[limitedEdition,setLimitedEdition]=useState(false),[editionSize,setEditionSize]=useState(100);
  if(query.isLoading)return <section className={styles}>Loading equipment studio…</section>;
  if(query.isError)return <section className={styles} role="alert">{errorMessage(query.error)}</section>;
  const data=query.data;
  const run=async(fn:()=>Promise<unknown>,success:string)=>{try{await fn();setMessage(success);}catch(e){setMessage(errorMessage(e));}};
  return <section className="space-y-4" aria-label="Equipment studio">
    <header className="rounded-2xl border border-amber-300/20 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/30 p-5">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">Career · SP-G</p>
      <h2 className="mt-1 text-2xl font-black text-white">Equipment Studio</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/65">Build a personal cosmetic setup, develop products only under rights in a signed equipment agreement, and follow sales and royalties from launch.</p>
      <p className="mt-2 text-xs text-white/45">Equipment is cosmetic only. It never changes darts ability, scoring, or match physics.</p>
    </header>
    {message&&<p role="status" className={styles}>{message}</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={styles}>
        <h3 className="text-lg font-bold text-white">Your loadout</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={label}>Weight (g)<input className={select} type="number" min="18" max="30" step=".5" value={loadout.dartWeight} onChange={e=>setLoadout({...loadout,dartWeight:Number(e.target.value)})}/></label>
          <label className={label}>Barrel<select className={select} value={loadout.barrel} onChange={e=>setLoadout({...loadout,barrel:e.target.value})}>{["STRAIGHT","TORPEDO","SCALLOPED","TAPERED"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label className={label}>Stem<select className={select} value={loadout.stem} onChange={e=>setLoadout({...loadout,stem:e.target.value})}>{["SHORT","INTERMEDIATE","MEDIUM"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label className={label}>Flight shape<select className={select} value={loadout.flight} onChange={e=>setLoadout({...loadout,flight:e.target.value})}>{["STANDARD","SLIM","KITE","NO2"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label className={label}>Flight graphic<select className={select} value={loadout.flightPattern} onChange={e=>setLoadout({...loadout,flightPattern:e.target.value})}>{["SOLID","CHEVRON","GRID","RINGS"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label className={label}>Flight colour<input className={select} type="color" value={loadout.flightColour} onChange={e=>setLoadout({...loadout,flightColour:e.target.value})}/></label>
          <label className={label}>Apparel accent<input className={select} type="color" value={loadout.apparelColour} onChange={e=>setLoadout({...loadout,apparelColour:e.target.value})}/></label>
        </div>
        <button className={`${button} mt-4`} disabled={save.isPending} onClick={()=>void run(()=>save.mutateAsync(loadout),"Cosmetic loadout saved.")}>Save loadout</button>
        <p className="mt-3 text-xs text-white/50">Signed equipment exclusivity and apparel-partner branding remain governed by the active contract portfolio.</p>
        {!!data.apparelEndorsements.length&&<p className="mt-1 text-xs text-amber-200">Apparel partner: {data.apparelEndorsements.map((e:any)=>e.brand).join(", ")}</p>}
      </div>
      <div className={styles}>
        <h3 className="text-lg font-bold text-white">Develop a signature product</h3>
        {data.contracts.length===0?<p className="mt-2 text-sm text-white/55">No active equipment endorsement with signed product rights. Historical contracts do not gain rights retroactively.</p>:<>
          <div className="mt-3 grid gap-3">
            <label className={label}>Signed equipment agreement<select className={select} value={contractId} onChange={e=>setContractId(e.target.value)}><option value="">Choose agreement</option>{data.contracts.map((c:any)=><option key={c.id} value={c.id}>{c.brand} · rights: {c.rights.join(", ")||"none"}</option>)}</select></label>
            <label className={label}>Product type<select className={select} value={productType} onChange={e=>setProductType(e.target.value as "SIGNATURE_DARTS"|"SIGNATURE_RANGE")}><option value="SIGNATURE_DARTS">Signature darts</option><option value="SIGNATURE_RANGE">Signature range / personalised flights</option></select></label>
            <label className={label}>Product name<input className={select} maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. The North Star Series"/></label>
            <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={limitedEdition} onChange={e=>setLimitedEdition(e.target.checked)}/>Limited-edition collection</label>
            {limitedEdition&&<label className={label}>Edition size<select className={select} value={editionSize} onChange={e=>setEditionSize(Number(e.target.value))}>{[25,50,100,250,500].map(n=><option key={n} value={n}>{n} pieces</option>)}</select></label>}
            <button className={button} disabled={!contractId||name.trim().length<3||create.isPending} onClick={()=>void run(()=>create.mutateAsync({contractId,productType,name,design:{flightPattern:loadout.flightPattern,colours:[loadout.flightColour,loadout.apparelColour],limitedEdition,editionSize:limitedEdition?editionSize:null}}),"Product draft created.")}>Create draft</button>
          </div>
        </>}
      </div>
    </div>
    <div className={styles}>
      <h3 className="text-lg font-bold text-white">Drafts & approvals</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-2">{data.drafts.map((d:any)=><article key={d.id} className="rounded-lg border border-white/10 p-3">
        <div className="flex items-start justify-between gap-2"><div><strong className="text-white">{d.name}</strong><p className="text-xs text-white/50">{d.brand} · {d.type.replaceAll("_"," ")} · {d.status}</p></div><span className={d.contractActive?"text-emerald-300":"text-white/40"}>{d.contractActive?"Rights active":"Legacy agreement"}</span></div>
        <div className="mt-2 flex flex-wrap gap-2">{d.status==="DRAFT"&&<button className={button} disabled={!d.contractActive||approve.isPending} onClick={()=>void run(()=>approve.mutateAsync(d.id),"Product approved.")}>Approve</button>}
          {d.status==="APPROVED"&&<button className={button} disabled={!d.contractActive||launch.isPending} onClick={()=>void run(()=>launch.mutateAsync(d.id),"Product launched.")}>Launch</button>}
          {d.status==="LAUNCHED"&&<button className={button} disabled={retire.isPending} onClick={()=>void run(()=>retire.mutateAsync(d.id),"Product retired.")}>Retire</button>}</div>
      </article>)}</div>
      {!data.drafts.length&&<p className="mt-2 text-sm text-white/50">No product drafts yet.</p>}
    </div>
    <div className={styles}>
      <h3 className="text-lg font-bold text-white">Portfolio & commercial performance</h3>
      <p className="mt-1 text-xs text-white/50">Darts £69.99 · ranges/flights £24.99 · deterministic weekly demand capped at 100 units per product. Royalty: 8% of recorded gross sales through A4.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">{data.products.map((p:any)=><article key={p.id} className="rounded-lg border border-white/10 p-3">
        <div className="flex justify-between"><strong className="text-white">{p.name}</strong><span className="text-xs text-amber-300">{p.state}</span></div>
        <p className="mt-1 text-xs text-white/50">{p.brand} · Season {p.season} · {p.units} units</p>
        <p className="mt-2 text-sm text-white/75">Gross {money(p.grossPence)} · A4 royalties {money(p.royaltyPence)}</p>
      </article>)}</div>
      {!data.products.length&&<p className="mt-2 text-sm text-white/50">No launched products; commercial history will populate after Career weeks progress.</p>}
    </div>
    <div className={styles}><h3 className="text-lg font-bold text-white">Product development history</h3>
      {!data.events.length?<p className="mt-2 text-sm text-white/50">Draft, approval, launch and retirement events will be recorded here.</p>:
        <ol className="mt-2 grid gap-2 sm:grid-cols-2">{data.events.map((e:any)=><li key={e.id} className="rounded-lg border border-white/10 p-3">
          <strong className="text-amber-200">{e.type}</strong><p className="text-xs text-white/55">Season {e.season}, week {e.week}</p>
        </li>)}</ol>}
    </div>
  </section>;
}
