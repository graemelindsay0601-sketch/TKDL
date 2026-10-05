import { useState } from "react";
import { Link } from "wouter";
import { Briefcase, Handshake, Receipt, Wallet } from "lucide-react";
import { useAcceptOffer, useCalendar, useDeclineOffer, useFinance, useLedger, useSponsors, errorMessage } from "../api";
import { LEDGER_FILTERS, circuitLabel, financeHeadlines, formatPence, ledgerLabel, titleCase, TONES } from "../model";
import { CareerEmptyState, CareerError, CareerLoading, CareerSection, ConfirmButton, Label, OSWALD, Segmented, StatTile, StatusBadge } from "../components";
import type { ShellContext } from "../shell";
import type { SponsorTerms } from "../types";

/**
 * Screen 8 — Finances & Sponsorship, directly over A4. Four separate headlines
 * (never mixed), real offers with accept/decline only, immutable ledger.
 * No coin conversion, purchases, loans, debt or gambling anywhere.
 */
export function FinancesPage({ ctx }: { ctx: ShellContext }) {
  const { save, retired } = ctx;
  const fin = useFinance(save.id);
  const sponsors = useSponsors(save.id);
  const schedule = useCalendar(save.id, { scope: "MY_SCHEDULE", season: save.currentSeason });
  const accept = useAcceptOffer(save.id);
  const decline = useDeclineOffer(save.id);
  const [msg, setMsg] = useState<string | null>(null);
  const [replace,setReplace]=useState<Record<string,string[]>>({});
  const active=sponsors.data?.activeContracts??(sponsors.data?.active?[sponsors.data.active]:[]);
  const commitments = (schedule.data?.events ?? []).filter(e => e.finance?.commitment && ["ENTERED", "TRAVEL_COMMITTED"].includes(e.finance.commitment.status) && e.status !== "COMPLETED");

  return (
    <div className="space-y-3">
      {fin.isLoading ? <div className="pdc-card"><CareerLoading label="Loading finances" /></div> : fin.error || !fin.data ? <CareerError error={fin.error} onRetry={() => fin.refetch()} /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {financeHeadlines(fin.data).map(h => <StatTile key={h.key} label={h.label} value={formatPence(h.pence)} sub={h.hint} tone={h.key === "BALANCE" ? "gold" : "neutral"} />)}
        </div>
      )}
      {fin.data && !fin.data.reconciled && <div role="alert" className="pdc-card px-4 py-2 text-sm" style={{ color: TONES.danger }}>The ledger and balance cache disagree — please report this.</div>}
      {msg && <p role="status" className="pdc-card px-4 py-2 text-sm" style={{ color: "#fff" }}>{msg}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CareerSection title="Sponsor portfolio" icon={<Handshake className="w-3.5 h-3.5" />} accent="#4ade80">
          {sponsors.isLoading ? <CareerLoading /> : sponsors.error || !sponsors.data ? <CareerError error={sponsors.error} onRetry={() => sponsors.refetch()} />
            : active.length ? (
              <div className="px-4 py-3 space-y-3"><p>{active.length} / {sponsors.data.portfolioLimit??2} relationships · coverage never stacks</p>
                {active.map(c=><div key={c.id} className="space-y-2">
                  <div className="font-black uppercase" style={{...OSWALD,color:"#fff"}}>{c.terms.displayName} · {titleCase(c.slot??c.tier)}</div>
                  <div className="text-xs">S{c.start.season} W{c.start.week} → S{c.end.season} W{c.end.week} · paid {formatPence(c.totals.paidPence)} · covered {formatPence(c.totals.coveredPence)}</div>
                  <Terms terms={c.terms}/></div>)}
              </div>
            ) : <CareerEmptyState title="Self-funded" icon={<Wallet className="w-6 h-6" />}>No sponsor yet. Offers arrive from real results — titles, finishes, qualifications and later your ranking.</CareerEmptyState>}
        </CareerSection>
        <CareerSection title="Sponsor offers" icon={<Briefcase className="w-3.5 h-3.5" />} accent="#ffd24a">
          {sponsors.data?.offers.length ? sponsors.data.offers.map(o => (
            <div key={o.id} className="px-4 py-3 border-b last:border-b-0 space-y-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2 flex-wrap"><span className="font-black uppercase" style={{ ...OSWALD, color: "#fff" }}>{o.terms.displayName}</span>
                <StatusBadge label={titleCase(o.tier)} tone="gold" />{o.kind === "RENEWAL" && <StatusBadge label="Renewal" tone="info" />}
                <span className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.62)" }}>Expires S{o.expires.season} W{o.expires.week}</span></div>
              <Terms terms={o.terms} />
              {!retired&&active.length>0&&<fieldset className="space-y-1 text-xs"><legend>Optional explicit replacement — otherwise existing compatible deals stay active</legend>
                {active.map(c=><label className="block" key={c.id}><input type="checkbox" checked={(replace[o.id]??[]).includes(c.id)}
                  onChange={e=>setReplace({...replace,[o.id]:e.target.checked?[...(replace[o.id]??[]),c.id]:(replace[o.id]??[]).filter(id=>id!==c.id)})}/>
                  {" "}{c.terms.displayName}{o.conflictingContractIds?.includes(c.id)?" — must replace for this offer":""}</label>)}
                {o.portfolioFull&&<p>Portfolio full: select a deal to replace.</p>}</fieldset>}
              {!retired && <div className="flex flex-wrap gap-2">
                <ConfirmButton label="Accept" confirmLabel="Sign contract" busy={accept.isPending}
                  description={`Sign with ${o.terms.displayName}. ${replace[o.id]?.length?`Terminate only: ${active.filter(c=>replace[o.id].includes(c.id)).map(c=>c.terms.displayName).join(", ")}.`:"Keep all existing deals."}`}
                  onConfirm={() => accept.mutate({offerId:o.id,replaceContractIds:replace[o.id]??[]}, { onSuccess: () => setMsg(`Signed with ${o.terms.displayName}.`), onError: e => setMsg(errorMessage(e)) })} />
                <button className="career-btn career-btn-ghost" disabled={decline.isPending} onClick={() => decline.mutate(o.id, { onSuccess: () => setMsg("Offer declined."), onError: e => setMsg(errorMessage(e)) })}>Decline</button>
              </div>}
            </div>
          )) : sponsors.isLoading ? <CareerLoading /> : <CareerEmptyState title="No offers right now" />}
        </CareerSection>
      </div>

      <CareerSection title="Upcoming commitments" icon={<Receipt className="w-3.5 h-3.5" />} accent="#38bdf8">
        {schedule.isLoading ? <CareerLoading /> : commitments.length ? (
          <ul>{commitments.map(e => (
            <li key={e.id} className="px-4 py-2 border-b last:border-b-0 flex items-center gap-3 text-sm" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <Link href={`/career/${save.id}/events/${e.id}`} className="flex-1 min-w-0 truncate career-row-link rounded py-1.5" style={{ ...OSWALD, color: "#fff" }}>{e.name}</Link>
              <span className="text-xs hidden sm:inline" style={{ color: "rgba(255,255,255,0.62)" }}>Wk {e.dates.startWeek} · {circuitLabel(e.circuit)}</span>
              <StatusBadge label={e.finance!.commitment!.status === "TRAVEL_COMMITTED" ? "Travel paid" : "Travel reserved"} tone="info" />
              <span className="w-20 text-right tabular-nums" style={OSWALD}>{formatPence(e.finance!.estimatedTravelPence + e.finance!.estimatedAccommodationPence)}</span>
            </li>))}</ul>
        ) : <CareerEmptyState title="No upcoming commitments" />}
        {fin.data && fin.data.reservedForTravelPence > 0 && <p className="px-4 py-2 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{formatPence(fin.data.reservedForTravelPence)} is reserved for travel on events you have entered; it is charged in the week you travel.</p>}
      </CareerSection>

      <Ledger saveId={save.id} />

      {sponsors.data && sponsors.data.history.offers.length > 0 && (
        <CareerSection title="Past offers" icon={<Briefcase className="w-3.5 h-3.5" />}>
          <ul>{sponsors.data.history.offers.slice(0, 10).map(o => (
            <li key={o.id} className="px-4 py-2 border-b last:border-b-0 flex items-center gap-2 text-sm flex-wrap" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <span className="font-bold" style={{ ...OSWALD, color: "#fff" }}>{o.terms.displayName}</span><StatusBadge label={titleCase(o.tier)} tone="muted" />
              <StatusBadge label={o.statusReason === "LAPSED" ? "Lapsed" : titleCase(o.status)} tone="muted" />
              <span className="ml-auto text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.7)" }}>Offered S{o.offered.season} W{o.offered.week} · valid to S{o.expires.season} W{o.expires.week}</span></li>))}</ul>
        </CareerSection>
      )}
      {sponsors.data && sponsors.data.history.contracts.length > 0 && (
        <CareerSection title="Sponsor history" icon={<Handshake className="w-3.5 h-3.5" />}>
          <ul>{sponsors.data.history.contracts.map(c => (
            <li key={c.id} className="px-4 py-2 border-b last:border-b-0 flex items-center gap-2 text-sm flex-wrap" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <span className="font-bold" style={{ ...OSWALD, color: "#fff" }}>{c.terms.displayName}</span><StatusBadge label={titleCase(c.status)} tone="muted" />
              {c.endReason && <span className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>{titleCase(c.endReason)}</span>}
              <span className="ml-auto text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.7)" }}>S{c.start.season}–S{c.end.season} · {formatPence(c.totals.paidPence)} paid</span></li>))}</ul>
        </CareerSection>
      )}
    </div>
  );
}

function Terms({ terms }: { terms: SponsorTerms }) {
  const lines: string[] = [];
  if (terms.signingBonusPence) lines.push(`Signing bonus ${formatPence(terms.signingBonusPence)}`);
  lines.push(terms.duration.kind === "SEASONS" ? `${terms.duration.seasons} season${terms.duration.seasons > 1 ? "s" : ""}` : "Rest of this season");
  if (terms.eventPayment) lines.push(`${formatPence(terms.eventPayment.amountPence)} per event played (${terms.eventPayment.circuits.map(circuitLabel).join(", ")}; max ${terms.eventPayment.maxEventsPerSeason}/season)`);
  for (const c of terms.coverage) lines.push(`Covers ${c.percent}% of ${c.costTypes.map(t => ledgerLabel(t).toLowerCase()).join(" + ")}${c.perEventCapPence ? `, up to ${formatPence(c.perEventCapPence)} per event` : ""}${c.seasonCapPence ? `, ${formatPence(c.seasonCapPence)} per season` : ""}${c.circuits ? ` (${c.circuits.map(circuitLabel).join(", ")})` : ""}`);
  for (const b of terms.performanceBonuses) lines.push(`Bonus ${formatPence(b.amountPence)} for ${b.maxPosition === 1 ? "a title" : `top ${b.maxPosition}`}${b.circuits ? ` (${b.circuits.map(circuitLabel).join(", ")})` : ""}`);
  return <ul className="space-y-0.5 text-xs" style={{ color: "rgba(255,255,255,0.72)" }}>{lines.map(l => <li key={l}>• {l}</li>)}</ul>;
}

function Ledger({ saveId }: { saveId: string }) {
  const [cursors, setCursors] = useState<({ beforeCreatedAt: string; beforeId: string } | null)[]>([null]);
  const [filter, setFilter] = useState<string>("ALL");
  const before = cursors[cursors.length - 1];
  const ledger = useLedger(saveId, 25, before);
  const cats = LEDGER_FILTERS.find(f => f.key === filter)?.categories ?? null;
  const rows = (ledger.data?.entries ?? []).filter(e => !cats || (cats as readonly string[]).includes(e.category));
  return (
    <CareerSection title="Transactions" icon={<Receipt className="w-3.5 h-3.5" />} accent="#c084fc">
      <div className="px-3 pt-2.5 pb-1"><Segmented label="Transaction filter" wrap value={filter} onChange={setFilter} options={LEDGER_FILTERS.map(f => ({ value: f.key, label: f.label }))} /></div>
      {ledger.isLoading ? <CareerLoading /> : ledger.error ? <CareerError error={ledger.error} onRetry={() => ledger.refetch()} /> : rows.length === 0 ? <CareerEmptyState title="No transactions on this page" /> : (
        <ul>{rows.map(e => (
          <li key={e.id} className="px-4 py-2 border-b last:border-b-0 flex items-center gap-3" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex-1 min-w-0"><div className="text-sm truncate" style={{ color: "#fff" }}>{e.reason ?? ledgerLabel(e.category)}</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>{ledgerLabel(e.category)}{e.season ? ` · S${e.season} W${e.week}` : ""}{e.sponsorCoveredPence ? ` · ${formatPence(e.sponsorCoveredPence)} sponsor-covered` : ""}</div></div>
            <span className="tabular-nums font-black" style={{ ...OSWALD, color: e.amountPence >= 0 ? TONES.success : "rgba(255,255,255,0.85)" }}>{formatPence(e.amountPence, { signed: true })}</span>
          </li>))}</ul>
      )}
      <div className="flex justify-between px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <button className="career-btn career-btn-ghost" disabled={cursors.length === 1} onClick={() => setCursors(cursors.slice(0, -1))}>Newer</button>
        <Label>Immutable ledger · filter applies to this page</Label>
        <button className="career-btn career-btn-ghost" disabled={!ledger.data?.next} onClick={() => ledger.data?.next && setCursors([...cursors, ledger.data.next])}>Older</button>
      </div>
    </CareerSection>
  );
}
