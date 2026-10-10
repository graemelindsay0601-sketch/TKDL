import { useMemo, useState } from "react";
import { errorMessage, newOperationKey, useAcceptOffer, useDeclineOffer, useNegotiateOffer, useSponsors, useUpdateSponsorActivity,
  useRequestSponsorRelease, useAcceptSponsorRelease, useAcknowledgeSponsorNotice } from "../api";
import { CareerError, CareerLoading, CareerSection, OSWALD } from "../components";
import type { ShellContext } from "../shell";
import type { SponsorNegotiationChange, SponsorSigningReveal } from "../types";
import { SponsorOfferCard } from "./sponsor-offer-card";
import { SponsorSigningReveal as SponsorSigningRevealCard } from "./sponsor-signing-reveal";

const money=(pence:number|undefined|null)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format((pence??0)/100);
const label=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());

export function SponsorHQPage({ctx}:{ctx:ShellContext}){
  const {save}=ctx, query=useSponsors(save.id), update=useUpdateSponsorActivity(save.id);
  const [weeks,setWeeks]=useState<Record<string,number>>({});
  const [notice,setNotice]=useState("");
  const [replace,setReplace]=useState<Record<string,string[]>>({});
  const [signingReveal,setSigningReveal]=useState<SponsorSigningReveal|null>(null);
  const accept=useAcceptOffer(save.id), decline=useDeclineOffer(save.id), negotiate=useNegotiateOffer(save.id);
  const requestRelease=useRequestSponsorRelease(save.id), acceptRelease=useAcceptSponsorRelease(save.id), acknowledgeNotice=useAcknowledgeSponsorNotice(save.id);
  const activities=useMemo(()=>[
    ...(query.data?.sponsorHQ?.commitments??[]).map(item=>({...item,required:true as const,from:item.availableFromWeek,to:item.dueWeek})),
    ...(query.data?.sponsorHQ?.opportunities??[]).map(item=>({...item,sponsorName:item.sponsorKey,required:false as const,from:item.availableFromWeek,to:item.availableToWeek})),
  ],[query.data]);
  if(query.isLoading)return <CareerLoading label="Loading Sponsor HQ"/>;
  if(query.error||!query.data)return <CareerError error={query.error} onRetry={()=>query.refetch()}/>;
  const portfolio=query.data.activeContracts??(query.data.active?[query.data.active]:[]);
  const history=query.data.history?.contracts??[];
  const decisionOffers=(query.data.offers??[]).filter(offer=>
    (offer.kind==="RENEWAL"&&(portfolio.some(contract=>contract.sponsorKey===offer.sponsorKey)||
      history.some(contract=>contract.id===offer.source?.previousContractId)))||
    (offer.conflictingContractIds??[]).some(id=>portfolio.some(contract=>contract.id===id)));
  const journeys=query.data.journeys??[];
  const commercial=query.data.commercial;
  async function act(id:string,action:"ACCEPT"|"DECLINE"|"SCHEDULE"|"COMPLETE",week?:number){
    try{await update.mutateAsync({activityId:id,action,week});setNotice("Sponsor activity updated.");}
    catch(error){setNotice(errorMessage(error));}
  }
  function requestContractRelease(contractId:string,releaseType:"IMMEDIATE_NO_COST"|"MUTUAL"|"PRICED_BUYOUT"){
    requestRelease.mutate({contractId,releaseType,operationKey:newOperationKey()},{onSuccess:result=>{
      setNotice(result.status==="DECLINED"?"The sponsor declined the mutual-release request.":result.status==="OFFERED"?"Release terms are ready for your confirmation.":"Release request recorded.");
    },onError:error=>setNotice(errorMessage(error))});
  }
  function confirmRelease(caseId:string){
    if(!window.confirm("Accept this release and end the sponsor agreement now? This cannot be undone."))return;
    acceptRelease.mutate(caseId,{onSuccess:()=>setNotice("Sponsor agreement released and recorded in your Career history."),onError:error=>setNotice(errorMessage(error))});
  }
  return <div className="space-y-5">
    {signingReveal&&<SponsorSigningRevealCard deal={signingReveal} onDismiss={()=>setSigningReveal(null)}/>}
    <CareerSection title="Sponsor headquarters">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="mb-1 text-xs uppercase tracking-[.18em] text-amber-200">Commercial career</p>
          <h2 className="text-2xl text-white" style={OSWALD}>Your partners, commitments and history</h2>
          <p className="mt-1 text-sm text-white/60">Only signed contract terms create duties. Existing v1–v3 agreements remain obligation-free.</p></div>
        <div className="rounded-lg border border-amber-300/25 bg-amber-300/[.07] px-4 py-2 text-right">
          <p className="text-[10px] uppercase tracking-widest text-white/50">Season {commercial?.season??save.currentSeason} · Week {commercial?.week??save.currentWeek}</p>
          <p className="text-lg font-semibold text-amber-100">{portfolio.length} active {portfolio.length===1?"partner":"partners"}</p>
        </div>
      </div>
    </CareerSection>

    <section aria-label="Sponsor finances" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[
        ["Sponsor cash received this season",money(commercial?.cashReceivedPence?.total)],
        ["Costs covered by partners",money(commercial?.costsCoveredPence)],
        ["Scheduled guarantees",money(commercial?.remainingGuaranteesPence)],
      ].map(([title,value])=><article key={title} className="pdc-card border border-white/10 p-4">
        <p className="text-[10px] uppercase tracking-[.16em] text-white/50">{title}</p><p className="mt-1 text-2xl text-white" style={OSWALD}>{value}</p>
      </article>)}
    </section>

    <CareerSection title="Active sponsor portfolio">
      {portfolio.length===0?<div className="rounded-lg border border-dashed border-white/15 bg-black/10 p-5">
        <h3 className="text-base text-white" style={OSWALD}>No active partnerships yet</h3>
        <p className="mt-1 text-sm text-white/55">When a sponsor agreement is signed, its brand, representative, contract term and commercial terms will appear here. Older contracts with no explicit activity clauses have no duties.</p>
      </div>:<div className="grid gap-3 lg:grid-cols-2">{portfolio.map(contract=>{
        const representative=contract.representative;
        const category=contract.category??"Partnership";
        return <article key={contract.id} className="overflow-hidden rounded-xl border border-amber-300/20 bg-gradient-to-br from-slate-900 via-slate-950 to-black">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
            <div><p className="text-[10px] uppercase tracking-[.2em] text-amber-200">{label(contract.tier)} partner · {label(category)}</p>
              <h3 className="mt-1 text-2xl text-white" style={OSWALD}>{contract.terms.displayName}</h3>
              <p className="mt-1 text-xs text-white/55">{contract.sponsorKey} · Season {contract.start.season}, week {contract.start.week} — season {contract.end.season}, week {contract.end.week}</p></div>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-emerald-200">{label(contract.status)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <div><p className="text-[10px] uppercase tracking-wider text-white/45">Sponsor representative</p>
              <p className="mt-1 text-sm text-white">{representative?.displayName??"Partnership team"}</p>
              <p className="text-xs text-white/50">{representative?.role??"Commercial contact"}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-white/45">Commercial record</p>
              <p className="mt-1 text-sm text-white">Received {money(contract.totals.paidPence)}</p>
              <p className="text-xs text-white/50">Costs covered {money(contract.totals.coveredPence)}</p></div>
          </div>
        </article>;
      })}</div>}
    </CareerSection>

    <CareerSection title="Contract decisions">
      <div className="px-4 py-3">
        <p className="text-xs text-white/55">Expiry is calculated from your current Career week to each signed end week. Renewal status below reflects persisted offers only; no offer is assumed from an approaching end date.</p>
        {portfolio.length===0
          ? <div className="mt-3 rounded-lg border border-dashed border-white/15 p-4">
              <h3 className="text-base text-white" style={OSWALD}>No active contracts to review</h3>
              <p className="mt-1 text-sm text-white/55">When a partnership is signed, its expiry and any persisted renewal or rival proposal will appear here.</p>
            </div>
          : <div className="mt-3 grid gap-2 lg:grid-cols-2">{portfolio.map(contract=>{
              const remaining=contractWeeksRemaining(save.currentSeason,save.currentWeek,contract.end.season,contract.end.week);
              const renewal=(query.data?.offers??[]).find(offer=>offer.kind==="RENEWAL"&&offer.sponsorKey===contract.sponsorKey);
              const rivals=decisionOffers.filter(offer=>offer.kind!=="RENEWAL"&&(offer.conflictingContractIds??[]).includes(contract.id));
              return <article key={contract.id} className="rounded-lg border border-white/10 bg-black/20 p-3" data-testid={`contract-decision-${contract.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-[10px] uppercase tracking-[.15em] text-white/45">{contract.renewal?"Renewal active · new term begun":`${label(contract.tier)} · ${label(contract.status)}`}</p>
                    <h3 className="mt-1 text-lg text-white" style={OSWALD}>{contract.terms.displayName}</h3>
                    <p className="mt-1 text-xs text-white/55">Signed S{contract.start.season} W{contract.start.week} · ends S{contract.end.season} W{contract.end.week}</p>
                  </div>
                  <div className={`sponsor-expiry-countdown${remaining<=4?" is-near":""}`} aria-label={remaining===0?"Contract end week has passed":`${remaining} contract weeks remaining`}>
                    <span>{remaining===0?"END WEEK PASSED":"WEEKS TO END"}</span><strong>{remaining}</strong>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded border border-white/[.07] bg-white/[.025] px-2.5 py-2">
                    <p className="text-[9px] uppercase tracking-widest text-white/40">Renewal status</p>
                    <p className="mt-1 text-xs text-white">{renewal?`Offer ${label(renewal.status)} · expires S${renewal.expires.season} W${renewal.expires.week}`:"No persisted renewal offer available"}</p>
                  </div>
                  <div className="rounded border border-white/[.07] bg-white/[.025] px-2.5 py-2">
                    <p className="text-[9px] uppercase tracking-widest text-white/40">Rival status</p>
                    <p className="mt-1 text-xs text-white">{rivals.length?`${rivals.length} persisted rival ${rivals.length===1?"offer":"offers"} identify this contract as a conflict`:"No persisted rival offer identifies this contract as a conflict"}</p>
                  </div>
                </div>
              </article>;
            })}</div>}
      </div>
      {(query.data?.pendingContracts??[]).map(contract=><article key={contract.id}
        className="mx-4 mb-3 rounded-lg border border-amber-300/25 bg-amber-300/[.06] p-3" data-testid={`pending-renewal-${contract.id}`}>
        <p className="text-[10px] uppercase tracking-[.15em] text-amber-200">Renewal accepted · starts next term</p>
        <h3 className="mt-1 text-lg text-white" style={OSWALD}>{contract.terms.displayName}</h3>
        <p className="mt-1 text-xs text-white/65">Starts Season {contract.start.season}, Week {contract.start.week} · ends Season {contract.end.season}, Week {contract.end.week}</p>
        <p className="mt-1 text-xs text-white/45">Your current agreement remains active until its scheduled end. No renewal income or activities are active yet.</p>
      </article>)}
      {decisionOffers.length===0
        ?<p className="border-t border-white/[.07] px-4 py-3 text-sm text-white/55">No available renewal or rival proposals are recorded for your active agreements.</p>
        :<div className="career-sponsor-offers__stack border-t border-white/[.07]">
          {decisionOffers.map(offer=><SponsorOfferCard key={`decision-${offer.id}`} offer={offer} activeContracts={portfolio} retired={ctx.retired}
            replacementIds={replace[offer.id]??[]} replacementDisabled
            onReplacementChange={(contractId,checked)=>setReplace(previous=>({...previous,[offer.id]:checked?[...new Set([...(previous[offer.id]??[]),contractId])]:(previous[offer.id]??[]).filter(id=>id!==contractId)}))}
            onAccept={()=>accept.mutate({offerId:offer.id,replaceContractIds:replace[offer.id]??[]},{onSuccess:result=>{
              setNotice(result.status==="SCHEDULED"
                ?`Renewal accepted — starts Season ${result.signingReveal?.start.season??""}, Week ${result.signingReveal?.start.week??""}.`
                :result.created?`Signed with ${offer.terms.displayName}.`:`${offer.terms.displayName} is already signed.`);
              if(result.signingReveal&&result.status!=="SCHEDULED")setSigningReveal(result.signingReveal);
            },onError:error=>setNotice(errorMessage(error))})}
            onDecline={()=>decline.mutate(offer.id,{onSuccess:()=>setNotice("Offer declined."),onError:error=>setNotice(errorMessage(error))})}
            onNegotiate={(change:SponsorNegotiationChange)=>negotiate.mutate({offerId:offer.id,requestKey:newOperationKey(),expectedRevision:offer.journey?.revision??0,change},{onSuccess:result=>setNotice(result.message),onError:error=>setNotice(errorMessage(error))})}
            acceptBusy={accept.isPending} declineBusy={decline.isPending} negotiateBusy={negotiate.isPending}/>)}
        </div>}
    </CareerSection>

    <CareerSection title="Compliance and contract releases">
      <p className="mb-3 text-sm text-white/55">Notices appear only when a required activity was genuinely missed and the signed agreement explicitly includes a material-breach term. Releases are limited to signed clauses; no existing agreement is changed.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-white/10 bg-black/20 p-3" aria-label="Compliance notices">
          <h3 className="text-sm text-white" style={OSWALD}>Compliance notices</h3>
          {(query.data.sponsorHQ?.notices??[]).length===0?<p className="mt-2 text-xs text-white/55">No contract-authorised compliance notices are recorded.</p>:
            <div className="mt-2 space-y-2">{query.data.sponsorHQ!.notices!.map(item=><article key={item.id} className="rounded border border-amber-200/20 bg-amber-300/[.04] p-3">
              <p className="text-xs text-amber-100">Missed required activity · {label(String(item.status))}</p>
              <p className="mt-1 text-[11px] text-white/55">Career season {String(item.details.season??"—")}, due week {String(item.details.dueWeek??"—")}. No penalty or termination has been applied.</p>
              {item.status==="OPEN"&&<button className="career-button-secondary mt-2" disabled={acknowledgeNotice.isPending}
                onClick={()=>acknowledgeNotice.mutate(item.id,{onSuccess:()=>setNotice("Notice acknowledged."),onError:error=>setNotice(errorMessage(error))})}>Acknowledge</button>}
            </article>)}</div>}
        </section>
        <section className="rounded-lg border border-white/10 bg-black/20 p-3" aria-label="Contract release decisions">
          <h3 className="text-sm text-white" style={OSWALD}>Release options and history</h3>
          {portfolio.length===0?<p className="mt-2 text-xs text-white/55">No active agreements to review.</p>:
            <div className="mt-2 space-y-2">{portfolio.map(contract=>{
              const clause=contract.terms.contractFoundation?.releaseClause;
              const conditions=contract.terms.contractFoundation?.terminationConditions??[];
              const mayRelease=clause?.playerNoticeWeeks===0&&clause?.buyoutPence===0;
              const mayBuyout=(clause?.buyoutPence??0)>0;
              const mayMutuallyRelease=conditions.includes("MUTUAL_AGREEMENT");
              const sameSponsorRenewal=(query.data.pendingContracts??[]).some(pending=>pending.sponsorKey===contract.sponsorKey);
              return <article key={contract.id} className="rounded border border-white/[.08] p-3">
                <p className="text-xs text-white">{contract.terms.displayName} · {sameSponsorRenewal?"Scheduled renewal protects this agreement": "No scheduled renewal"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {mayRelease&&<button className="career-button-secondary" disabled={sameSponsorRenewal||requestRelease.isPending}
                    onClick={()=>requestContractRelease(contract.id,"IMMEDIATE_NO_COST")}>Request immediate release</button>}
                  {mayBuyout&&<button className="career-button-secondary" disabled={sameSponsorRenewal||requestRelease.isPending}
                    onClick={()=>requestContractRelease(contract.id,"PRICED_BUYOUT")}>Request buyout · {money(clause!.buyoutPence)}</button>}
                  {mayMutuallyRelease&&<button className="career-button-secondary" disabled={sameSponsorRenewal||requestRelease.isPending}
                    onClick={()=>requestContractRelease(contract.id,"MUTUAL")}>Request mutual release</button>}
                  {!mayRelease&&!mayBuyout&&!mayMutuallyRelease&&<span className="text-xs text-white/45">No player release route is authorised by this contract.</span>}
                </div>
              </article>;
            })}</div>}
          {(query.data.sponsorHQ?.releases??[]).map(item=><article key={item.id} className="mt-2 rounded border border-white/[.08] p-3">
            <p className="text-xs text-white">{item.sponsorName} · {label(item.type)} · {label(item.status)}{item.amountPence?` · ${money(item.amountPence)}`:""}</p>
            {item.status==="OFFERED"&&<button className="career-button-primary mt-2" disabled={acceptRelease.isPending}
              onClick={()=>confirmRelease(item.id)}>Confirm and end agreement</button>}
          </article>)}
        </section>
      </div>
    </CareerSection>

    <CareerSection title="Contractual commitments and opportunities">
      <p className="mb-3 text-sm text-white/55">Required duties are included in the agreement. Optional activities are unpaid and declining them has no penalty.</p>
      {activities.length===0?<div className="rounded-lg border border-dashed border-white/15 p-5">
        <h3 className="text-base text-white" style={OSWALD}>No sponsor activities due</h3>
        <p className="mt-1 text-sm text-white/55">{portfolio.length?"Your signed contracts have no configured duties or opportunities.":"Existing v1–v3 contracts stay obligation-free; no duties are backfilled."}</p>
      </div>:<div className="grid gap-3 lg:grid-cols-2">{activities.map(item=>{
        const week=weeks[item.id]??Math.max(item.from,save.currentWeek);
        const canSchedule=item.required?["AVAILABLE","CONFIRMED"].includes(item.status):["ACCEPTED","CONFIRMED"].includes(item.status);
        const firstWeek=Math.max(item.from,save.currentWeek),weekChoices=firstWeek<=item.to?Array.from({length:item.to-firstWeek+1},(_,i)=>firstWeek+i):[];
        const canDecline=!item.required&&["AVAILABLE","ACCEPTED"].includes(item.status);
        const canAccept=!item.required&&item.status==="AVAILABLE";
        const canComplete=item.status==="CONFIRMED"&&item.scheduledWeek===save.currentWeek;
        return <article key={item.id} className="pdc-card space-y-3 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="cc-eyebrow">{item.required?"REQUIRED CONTRACT DUTY":"OPTIONAL OPPORTUNITY"}</p>
            <h3 className="text-lg text-white" style={OSWALD}>{label(item.kind)}</h3>
            <p className="text-xs text-white/60">{item.sponsorName??item.sponsorKey} · Season {item.season} · Weeks {item.from}–{item.to}</p></div>
            <span className="rounded border border-white/15 px-2 py-1 text-[10px] uppercase text-amber-200">{label(item.status)}</span></div>
          {item.status==="CONFIRMED"&&<p className="text-xs text-emerald-200">Booked for Career week {item.scheduledWeek}; completion is available only during that week.</p>}
          {(canAccept||canDecline||canSchedule||canComplete)&&<div className="flex flex-wrap items-center gap-2">
            {canAccept&&<button className="career-button-secondary" disabled={update.isPending} onClick={()=>void act(item.id,"ACCEPT")}>Accept</button>}
            {canDecline&&<button className="career-button-secondary" disabled={update.isPending} onClick={()=>void act(item.id,"DECLINE")}>Decline</button>}
            {canSchedule&&<><label className="text-xs text-white/60">Career week
              <select aria-label={`Schedule ${label(item.kind)} week`} className="ml-2 rounded bg-slate-900 px-2 py-1 text-white" value={week} onChange={e=>setWeeks(prev=>({...prev,[item.id]:Number(e.target.value)}))}>
                {weekChoices.map(value=><option key={value} value={value}>Week {value}</option>)}
              </select>
            </label><button className="career-button-primary" disabled={update.isPending||weekChoices.length===0} onClick={()=>void act(item.id,"SCHEDULE",week)}>{item.status==="CONFIRMED"?"Change week":"Schedule"}</button></>}
            {canComplete&&<button className="career-button-primary" disabled={update.isPending} onClick={()=>void act(item.id,"COMPLETE")}>Complete activity</button>}
          </div>}
        </article>;
      })}</div>}
    </CareerSection>

    <CareerSection title="Representative communications and sponsor history">
      {journeys.length===0&&history.length===0?<p className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-white/55">Sponsor conversations and signed partnership history will appear here as they happen.</p>:
        <div className="grid gap-3 lg:grid-cols-2">
          {journeys.map(journey=><article key={journey.id} className="pdc-card p-4">
            <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] uppercase tracking-widest text-cyan-200">{journey.representative?.role??"Sponsor representative"}</p>
              <h3 className="mt-1 text-lg text-white" style={OSWALD}>{journey.displayName}</h3><p className="text-xs text-white/50">{journey.representative?.displayName??journey.brandPersonality} · {label(journey.status)}</p></div>
              <span className="text-xs text-white/45">{journey.timeline.length} updates</span></div>
            <ol className="mt-3 space-y-2 border-l border-white/10 pl-3">{journey.timeline.slice(-4).reverse().map((event,index)=><li key={`${journey.id}-${event.type}-${event.createdAt}-${index}`}>
              <p className="text-xs font-medium text-white">{String(event.details.headline??label(event.type))}</p>
              <p className="mt-0.5 text-xs text-white/55">{String(event.details.summary??"Sponsor journey update")} · Season {event.season??"—"}, week {event.week??"—"}</p>
            </li>)}</ol>
          </article>)}
          {history.map(contract=><article key={contract.id} className="pdc-card p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/45">Partnership record · {label(contract.status)}</p>
            <h3 className="mt-1 text-lg text-white" style={OSWALD}>{contract.terms.displayName}</h3>
            <p className="mt-1 text-xs text-white/55">{label(contract.tier)} · Season {contract.start.season} week {contract.start.week} to season {contract.end.season} week {contract.end.week}</p>
            <p className="mt-2 text-xs text-white/55">Received {money(contract.totals.paidPence)} · Covered {money(contract.totals.coveredPence)}</p>
          </article>)}
        </div>}
    </CareerSection>
    {notice&&<p role="status" className="pdc-card p-3 text-sm text-white">{notice}</p>}
  </div>;
}

function contractWeeksRemaining(currentSeason:number,currentWeek:number,endSeason:number,endWeek:number){
  const current=(currentSeason-1)*52+currentWeek;
  const end=(endSeason-1)*52+endWeek;
  return Math.max(0,end-current+1);
}
