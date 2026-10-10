import {useState} from "react";
import {useEquipmentStudio,useSaveEquipmentLoadout,useCreateProductDraft,useApproveProductDraft,useLaunchProductDraft,useRetireProductDraft} from "../api";
import type {ShellContext} from "../shell";

const box="rounded-xl border border-white/10 bg-slate-950/70 p-4";
const input="rounded-md border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white";
const btn="rounded-lg border border-amber-300/40 px-3 py-2 text-sm font-semibold text-amber-100 disabled:opacity-40";
export function EquipmentStudio({ctx}:{ctx:ShellContext}) {
 const id=ctx.save.id,q=useEquipmentStudio(id),save=useSaveEquipmentLoadout(id),create=useCreateProductDraft(id),
  approve=useApproveProductDraft(id),launch=useLaunchProductDraft(id),retire=useRetireProductDraft(id);
 const [loadout,setLoadout]=useState({dartWeight:22,barrel:"STRAIGHT",stem:"SHORT",flight:"STANDARD",flightPattern:"CHEVRON",flightColour:"#e11d48",apparelColour:"#10253e"});
 const [contractId,setContract]=useState(""),[type,setType]=useState<"SIGNATURE_DARTS"|"SIGNATURE_RANGE">("SIGNATURE_DARTS"),[name,setName]=useState("");
 const [limited,setLimited]=useState(false),[editionSize,setEditionSize]=useState(100);
 const [notice,setNotice]=useState("");
 if(q.isLoading)return <section className={box}>Loading Equipment Studio…</section>;
 if(q.isError)return <section className={box} role="alert">Could not load equipment studio.</section>;
 const data=q.data;
 const act=async(fn:()=>Promise<unknown>,message:string)=>{try{await fn();setNotice(message);}catch(e){setNotice(e instanceof Error?e.message:"Action failed");}};
 return <section className="space-y-4" aria-label="Equipment Studio">
  <header className={`${box} bg-gradient-to-br from-slate-900 to-amber-950/30`}><p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">Career · SP-G</p><h2 className="text-2xl font-black text-white">Equipment Studio</h2><p className="text-sm text-white/60">Cosmetic equipment and signed-right signature products. Loadouts never affect darts performance.</p></header>
  {notice&&<p role="status" className={box}>{notice}</p>}
  <div className="grid gap-4 lg:grid-cols-2"><div className={box}><h3 className="font-bold text-white">Cosmetic loadout</h3><div className="mt-3 grid grid-cols-2 gap-2">
   <label className="text-xs text-white/60">Weight<input className={input+" block w-full"} type="number" min="18" max="30" value={loadout.dartWeight} onChange={e=>setLoadout({...loadout,dartWeight:Number(e.target.value)})}/></label>
   <label className="text-xs text-white/60">Barrel<select className={input+" block w-full"} value={loadout.barrel} onChange={e=>setLoadout({...loadout,barrel:e.target.value})}>{["STRAIGHT","TORPEDO","SCALLOPED","TAPERED"].map(x=><option key={x}>{x}</option>)}</select></label>
   <label className="text-xs text-white/60">Stem<select className={input+" block w-full"} value={loadout.stem} onChange={e=>setLoadout({...loadout,stem:e.target.value})}>{["SHORT","INTERMEDIATE","MEDIUM"].map(x=><option key={x}>{x}</option>)}</select></label>
   <label className="text-xs text-white/60">Flight<select className={input+" block w-full"} value={loadout.flight} onChange={e=>setLoadout({...loadout,flight:e.target.value})}>{["STANDARD","SLIM","KITE","NO2"].map(x=><option key={x}>{x}</option>)}</select></label>
   <label className="text-xs text-white/60">Flight graphic<select className={input+" block w-full"} value={loadout.flightPattern} onChange={e=>setLoadout({...loadout,flightPattern:e.target.value})}>{["SOLID","CHEVRON","GRID","RINGS"].map(x=><option key={x}>{x}</option>)}</select></label>
   <label className="text-xs text-white/60">Flight colour<input className={input+" block w-full"} type="color" value={loadout.flightColour} onChange={e=>setLoadout({...loadout,flightColour:e.target.value})}/></label>
  </div><button className={btn+" mt-3"} disabled={save.isPending} onClick={()=>void act(()=>save.mutateAsync(loadout),"Loadout saved.")}>Save loadout</button>{data.apparelEndorsements?.map((x:any)=><p key={x.brand} className="text-xs text-amber-200">Apparel partner: {x.brand}</p>)}</div>
  <div className={box}><h3 className="font-bold text-white">Create signature product</h3>{!data.contracts.length?<p className="text-sm text-white/60">No active equipment agreement has explicit product rights. Existing agreements are unchanged.</p>:<div className="grid gap-2">
   <select className={input} value={contractId} onChange={e=>setContract(e.target.value)}><option value="">Choose signed agreement</option>{data.contracts.map((c:any)=><option key={c.id} value={c.id}>{c.brand} · {c.rights.join(", ")}</option>)}</select>
   <select className={input} value={type} onChange={e=>setType(e.target.value as typeof type)}><option value="SIGNATURE_DARTS">Signature darts</option><option value="SIGNATURE_RANGE">Signature range</option></select>
   <input className={input} value={name} maxLength={80} placeholder="Product name" onChange={e=>setName(e.target.value)}/>
   <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={limited} onChange={e=>setLimited(e.target.checked)}/>Limited edition</label>
   {limited&&<label className="text-xs text-white/60">Run size<select className={input+" ml-2"} value={editionSize} onChange={e=>setEditionSize(Number(e.target.value))}>{[25,50,100,250,500].map(n=><option key={n}>{n}</option>)}</select></label>}
   <button className={btn} disabled={!contractId||name.trim().length<3||create.isPending} onClick={()=>void act(()=>create.mutateAsync({contractId,productType:type,name,design:{flightPattern:loadout.flightPattern,colours:[loadout.flightColour,loadout.apparelColour],limitedEdition:limited,editionSize:limited?editionSize:null}}),"Draft created.")}>Create draft</button>
  </div>}</div></div>
  <div className={box}><h3 className="font-bold text-white">Products, approvals & commercial performance</h3><div className="grid gap-2 md:grid-cols-2">{data.drafts.map((d:any)=><article className="rounded-lg border border-white/10 p-3" key={d.id}><b className="text-white">{d.name}</b><p className="text-xs text-white/50">{d.brand} · {d.type} · {d.status}</p>{d.status==="DRAFT"&&<button className={btn} onClick={()=>void act(()=>approve.mutateAsync(d.id),"Approved.")}>Approve</button>}{d.status==="APPROVED"&&<button className={btn} disabled={!d.contractActive} onClick={()=>void act(()=>launch.mutateAsync(d.id),"Launched.")}>Launch</button>}{d.status==="LAUNCHED"&&<button className={btn} onClick={()=>void act(()=>retire.mutateAsync(d.id),"Retired.")}>Retire</button>}</article>)}</div>{data.products.map((p:any)=><p key={p.id} className="text-sm text-white/70">{p.name} · {p.units} units · £{(p.royaltyPence/100).toFixed(2)} royalties · {p.status}</p>)}</div>
 </section>;
}
