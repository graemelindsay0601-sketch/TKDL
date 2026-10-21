import { useState } from "react";
import { Link } from "wouter";
import { Briefcase, CalendarClock, Coins, Handshake, Receipt, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { newOperationKey, useAcceptOffer, useCalendar, useDeclineOffer, useFinance, useLedger, useNegotiateOffer, useSponsors, errorMessage } from "../api";
import { LEDGER_FILTERS, circuitLabel, publicText, financeHeadlines, formatPence, ledgerLabel, titleCase, TONES } from "../model";
import { CareerEmptyState, CareerError, CareerLoading, CareerSection, Label, OSWALD, Segmented, StatTile, StatusBadge } from "../components";
import { useUnlocks } from "../unlocks";
import type { ShellContext } from "../shell";
import type { SponsorCommercialOverview, SponsorNegotiationChange, SponsorSigningReveal, SponsorTerms } from "../types";
import { SponsorOfferCard } from "./sponsor-offer-card";
import { SeasonMoneyChart } from "../week-money";
import { SavingsGoalPanel } from "../savings-goal";
import { ManagerPanel } from "../manager";
import { SponsorSigningReveal as SponsorSigningRevealCard } from "./sponsor-signing-reveal";
import { formatGuaranteeAmountPence, formatGuaranteeInstalmentSplit } from "./sponsor-guarantee-presentation";
import "./finances-premium.css";

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
  const negotiate = useNegotiateOffer(save.id);
  const [msg, setMsg] = useState<string | null>(null);
  const [replace,setReplace]=useState<Record<string,string[]>>({});
  const [signingReveal, setSigningReveal] = useState<SponsorSigningReveal | null>(null);
  const active=sponsors.data?.activeContracts??(sponsors.data?.active?[sponsors.data.active]:[]);
  const sponsorInterests = (sponsors.data?.journeys ?? []).filter(journey => journey.status === "INTEREST");
  const sponsorActivity = (sponsors.data?.journeys ?? []).flatMap(journey => journey.timeline
    .filter(event => event.type === "SIGNED" || event.type === "FINANCIAL_PAYMENT")
    .map((event, index) => ({ journey, event, index })))
    .sort((a, b) => (b.event.createdAt ?? "").localeCompare(a.event.createdAt ?? ""))
    .slice(0, 12);
  const commitments = (schedule.data?.events ?? []).filter(e => e.finance?.commitment && ["ENTERED", "TRAVEL_COMMITTED"].includes(e.finance.commitment.status) && e.status !== "COMPLETED");
  const pendingOffers = sponsors.data?.offers.length ?? 0;
  // Unlock as you go: sponsors and managers appear after a few events (or as soon as anything sponsor-related exists).
  const unlocks = useUnlocks(save);
  const showSponsors = unlocks.isOpen("sponsors") || active.length > 0 || pendingOffers > 0 || sponsorInterests.length > 0
    || (sponsors.data?.history.contracts.length ?? 0) > 0 || (sponsors.data?.history.offers.length ?? 0) > 0;

  return (
    <div className="career-finances-page space-y-3">
      {fin.isLoading ? <div className="pdc-card"><CareerLoading label="Loading finances" /></div> : fin.error || !fin.data ? <CareerError error={fin.error} onRetry={() => fin.refetch()} /> : (
        <>
          <header className="cf-premium-hero">
            <div className="cf-premium-hero__copy">
              <p className="cf-premium-kicker">CAREER FINANCES <i aria-hidden="true" /> SEASON {save.currentSeason} · WEEK {save.currentWeek}</p>
              <h1>Built for the next leg<span>.</span></h1>
              <p className="cf-premium-hero__intro">A clear view of what you’ve earned, what’s committed, and what you can put toward your next goal.</p>
              <div className="cf-premium-orbit" aria-hidden="true"><span /><span /><b>£</b></div>
            </div>
            <section className="cf-balance-display" aria-label="Career balance">
              <div className="cf-balance-display__top"><span>Balance · available to spend</span><Wallet aria-hidden="true" size={18} /></div>
              <strong>{formatPence(fin.data.availablePence)}</strong>
              <p>{formatPence(fin.data.balancePence)} total balance</p>
              {fin.data.reservedForTravelPence > 0 && <small>{formatPence(fin.data.reservedForTravelPence)} reserved for upcoming travel</small>}
              <div className="cf-balance-display__dial" aria-hidden="true"><i /><i /><i /></div>
            </section>
          </header>
          <div className="cf-finance-headlines" aria-label="Season financial summary">
            {financeHeadlines(fin.data).filter(h => h.key !== "BALANCE").map((headline, index) => (
              <article className={`cf-finance-stat cf-finance-stat--${headline.key.toLowerCase()}`} key={headline.key}>
                <span className="cf-finance-stat__index">0{index + 1}</span>
                <span className="cf-finance-stat__label">{headline.label}</span>
                <strong>{formatPence(headline.pence)}</strong>
                <small>{headline.hint}</small>
              </article>
            ))}
          </div>
        </>
      )}
      {fin.data && !fin.data.reconciled && <div role="alert" className="pdc-card px-4 py-2 text-sm" style={{ color: TONES.danger }}>The ledger and balance cache disagree — please report this.</div>}
      {msg && <p role="status" className="pdc-card px-4 py-2 text-sm" style={{ color: "#fff" }}>{msg}</p>}
      {signingReveal && <SponsorSigningRevealCard deal={signingReveal} onDismiss={() => setSigningReveal(null)} />}
      <CareerSection title="Savings goal" icon={<Wallet className="w-3.5 h-3.5" />} accent="#d9b96f">
        <SavingsGoalPanel saveId={save.id} season={save.currentSeason} week={save.currentWeek} retired={retired} />
      </CareerSection>
      <CareerSection title={`Darts money by week · season ${save.currentSeason}`} icon={<Coins className="w-3.5 h-3.5" />} accent="#3987e5">
        <SeasonMoneyChart saveId={save.id} />
      </CareerSection>
      {showSponsors ? <CareerSection title="Your manager" icon={<Briefcase className="w-3.5 h-3.5" />} accent="#c084fc">
        <ManagerPanel saveId={save.id} retired={retired} />
      </CareerSection> : <div className="pdc-card px-4 py-3 text-sm career-later-note"><Handshake aria-hidden size={16} />
        <span><strong>Sponsors and managers come later.</strong> Play a few events and brands start to notice you; their offers, and managers who want to sign you, will show up here.</span></div>}
      {pendingOffers > 0 && <a href="#career-finance-offers" className="pdc-card flex items-center gap-3 px-4 py-3 text-sm no-underline" style={{ borderColor: "rgba(255,210,74,0.42)", color: "#f3dfaa", background: "linear-gradient(90deg,rgba(255,210,74,0.11),rgba(255,255,255,0.025))" }}>
        <Briefcase className="shrink-0" size={16} aria-hidden="true" />
        <span><strong>{pendingOffers} sponsor {pendingOffers === 1 ? "offer" : "offers"} to review</strong><span className="block text-xs opacity-75">Review proposed terms separately from signed agreements.</span></span>
        <span className="ml-auto" aria-hidden="true">View →</span>
      </a>}
      {showSponsors && sponsors.data?.commercial && <CommercialOverview commercial={sponsors.data.commercial} />}
      {showSponsors && sponsors.data?.guaranteeConfiguration?.status === "APPROVED" && (
        <details className="career-note">
          <summary>How sponsor guarantees pay</summary>
          <p><strong style={{ color: "#ffd24a" }}>Approved annual sponsor guarantees · catalogue v{sponsors.data.guaranteeConfiguration.catalogueVersion}</strong>{" "}
          Local £250, Regional £1,250, Professional £8,000, Elite £20,000. Each signed v5 agreement pays in four instalments at Career Weeks 1, 14, 27 and 40, only while the contract is active; future payments are not advance cash. Older contracts and posted payments are unchanged.</p>
        </details>
      )}
      {sponsorInterests.length > 0 && (
        <CareerSection title="Brands watching your progress" icon={<Handshake className="w-3.5 h-3.5" />} accent="#38bdf8">
          <ul>{sponsorInterests.map(journey => {
            const event = journey.source.event as Record<string, unknown> | undefined;
            const eventName = typeof event?.eventName === "string" ? event.eventName : "a completed event";
            const position = Number(event?.finishingPosition);
            const finish = event?.isChampion === true ? "won" :
              Number.isInteger(position) && position > 0 ? `finished ${position}${ordinalSuffix(position)}` : "recorded a result";
            return <li key={journey.id} className="px-4 py-3 border-b last:border-b-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <span className="font-black uppercase" style={{ ...OSWALD, color: "#fff" }}>{journey.displayName}</span>
              <StatusBadge label={titleCase(journey.tier)} tone="info" />
              <span className="w-full text-xs" style={{ color: "rgba(255,255,255,0.72)" }}>
                {eventName} · You {finish}. Exploratory interest only — there is no offer or payment yet.
              </span>
            </li>;
          })}</ul>
        </CareerSection>
      )}

      {showSponsors && <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CareerSection title="Sponsor portfolio" icon={<Handshake className="w-3.5 h-3.5" />} accent="#4ade80">
          {sponsors.isLoading ? <CareerLoading /> : sponsors.error || !sponsors.data ? <CareerError error={sponsors.error} onRetry={() => sponsors.refetch()} />
            : active.length ? (
              <div className="px-4 py-3 space-y-3"><p>{active.length} / {sponsors.data.portfolioLimit??2} relationships · coverage never stacks</p>
                {active.map(c=><div key={c.id} className="space-y-2">
                  <div className="font-black uppercase" style={{...OSWALD,color:"#fff"}}>{c.terms.displayName} · {titleCase(c.slot??c.tier)}</div>
                  <div className="text-xs">S{c.start.season} W{c.start.week} → S{c.end.season} W{c.end.week} · cash received to date {formatPence(c.totals.paidPence)} · costs covered {formatPence(c.totals.coveredPence)}</div>
                  {c.commercial && (
                    <div className="text-xs space-y-0.5" style={{ color: "rgba(255,255,255,0.72)" }}>
                      <div>Guaranteed cash due or scheduled: {formatPence(c.commercial.remainingGuaranteesPence)}</div>
                      {c.commercial.pastDueGuaranteesPence > 0 && <div role="alert" style={{ color: TONES.danger }}>Past-due guarantees: {formatPence(c.commercial.pastDueGuaranteesPence)}</div>}
                      {c.commercial.unsupportedGuarantees.length > 0 && <div role="alert" style={{ color: TONES.warning }}>Some guarantee terms need review before they can be paid.</div>}
                    </div>
                  )}
                  <Terms terms={c.terms}/></div>)}
              </div>
            ) : <CareerEmptyState title="Self-funded" icon={<Wallet className="w-6 h-6" />}>No sponsor yet. Offers arrive from real results — titles, finishes, qualifications and later your ranking.</CareerEmptyState>}
        </CareerSection>
        <div id="career-finance-offers">
        <CareerSection title="Sponsor offers" icon={<Briefcase className="w-3.5 h-3.5" />} accent="#ffd24a">
          {sponsors.data?.offers.length ? (
            <div className="career-sponsor-offers__stack">
              {sponsors.data.offers.map(o => (
                <SponsorOfferCard
                  key={o.id}
                  offer={o}
                  activeContracts={active}
                  retired={retired}
                  replacementIds={replace[o.id] ?? []}
                  acceptBusy={accept.isPending}
                  declineBusy={decline.isPending}
                  onReplacementChange={(contractId, checked) => setReplace(previous => ({
                    ...previous,
                    [o.id]: checked
                      ? [...new Set([...(previous[o.id] ?? []), contractId])]
                      : (previous[o.id] ?? []).filter(id => id !== contractId),
                  }))}
                  onAccept={() => accept.mutate(
                    { offerId: o.id, replaceContractIds: replace[o.id] ?? [] },
                    {
                      onSuccess: result => {
                        setMsg(result.created ? `Signed with ${o.terms.displayName}.` : `${o.terms.displayName} is already signed.`);
                        if (result.signingReveal) setSigningReveal(result.signingReveal);
                      },
                      onError: error => setMsg(errorMessage(error)),
                    },
                  )}
                  onDecline={() => decline.mutate(o.id, {
                    onSuccess: () => setMsg("Offer declined."),
                    onError: error => setMsg(errorMessage(error)),
                  })}
                  onNegotiate={(change: SponsorNegotiationChange) => negotiate.mutate(
                    { offerId: o.id, requestKey: newOperationKey(), expectedRevision: o.journey?.revision ?? 0, change },
                    {
                      onSuccess: result => setMsg(result.message),
                      onError: error => setMsg(errorMessage(error)),
                    },
                  )}
                  negotiateBusy={negotiate.isPending}
                />
              ))}
            </div>
          ) : sponsors.isLoading ? <CareerLoading /> : <CareerEmptyState title="No offers right now" />}
        </CareerSection>
        </div>
      </div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
      {sponsorActivity.length > 0 && (
        <CareerSection title="Sponsor activity & payment history" icon={<Receipt className="w-3.5 h-3.5" />} accent="#ffd24a">
          {(() => { const row = ({ journey, event, index }: typeof sponsorActivity[number]) => {
              const amount = typeof event.details.amountPence === "number" ? event.details.amountPence
                : typeof event.details.signingPaymentPence === "number" ? event.details.signingPaymentPence : null;
              const category = typeof event.details.category === "string" ? event.details.category
                : typeof event.details.signingPaymentCategory === "string" ? event.details.signingPaymentCategory : null;
              const summary = typeof event.details.summary === "string" ? event.details.summary
                : typeof event.details.headline === "string" ? event.details.headline : journeyEventText(event.type);
              return (
                <li key={`${journey.id}:${event.createdAt}:${event.type}:${index}`} className="career-money-row">
                  <span className="career-money-row__week">{event.season ? <>S{event.season}<b>W{event.week ?? "—"}</b></> : "—"}</span>
                  <div className="min-w-0">
                    <strong>{journey.displayName} · {journeyEventText(event.type)}</strong>
                    <small>{publicText(summary)}{category ? ` · ${ledgerLabel(category)}` : ""}</small>
                  </div>
                  {amount !== null && amount > 0 ? <span className="career-money-row__amount is-in">{formatPence(amount)}</span> : <span />}
                </li>
              );
            };
            const recent = sponsorActivity.slice(0, 8), earlier = sponsorActivity.slice(8);
            return <><ul className="career-money-list">{recent.map(row)}</ul>
              {earlier.length > 0 && <details className="career-money-more"><summary>Show {earlier.length} earlier {earlier.length === 1 ? "entry" : "entries"}</summary><ul className="career-money-list">{earlier.map(row)}</ul></details>}</>;
          })()}
        </CareerSection>
      )}

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
      </div>

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
              <span className="ml-auto text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.7)" }}>S{c.start.season}–S{c.end.season} · {formatPence(c.totals.paidPence)} cash received · {formatPence(c.totals.coveredPence)} costs covered</span></li>))}</ul>
        </CareerSection>
      )}
    </div>
  );
}

function journeyEventText(type: string) {
  if (type === "SIGNED") return "Partnership signed";
  if (type === "FINANCIAL_PAYMENT") return "Sponsor payment posted";
  return titleCase(type);
}

function Terms({ terms }: { terms: SponsorTerms }) {
  const lines: string[] = [];
  if (terms.signingBonusPence) lines.push(`Signing bonus ${formatPence(terms.signingBonusPence)}`);
  lines.push(terms.duration.kind === "SEASONS" ? `${terms.duration.seasons} season${terms.duration.seasons > 1 ? "s" : ""}` : "Rest of this season");
  if (terms.eventPayment) lines.push(`${formatPence(terms.eventPayment.amountPence)} per event played (${terms.eventPayment.circuits.map(circuitLabel).join(", ")}; max ${terms.eventPayment.maxEventsPerSeason}/season)`);
  for (const guarantee of terms.contractFoundation?.guaranteedPayments ?? []) {
    if (guarantee.cadence === "ON_SIGNING") {
      lines.push(`Guaranteed cash: ${formatGuaranteeAmountPence(guarantee.amountPence)} once at signing`);
      continue;
    }
    const cadence = guarantee.cadence === "MONTHLY" ? "monthly" : "scheduled";
    lines.push(`Guaranteed cash: ${formatGuaranteeAmountPence(guarantee.amountPence)} total per Career season, ${guarantee.installments} ${cadence} instalments (${formatGuaranteeInstalmentSplit(guarantee.amountPence, guarantee.installments)}); paid only when due`);
  }
  for (const c of terms.coverage) lines.push(`Covers ${c.percent}% of ${c.costTypes.map(t => ledgerLabel(t).toLowerCase()).join(" + ")}${c.perEventCapPence ? `, up to ${formatPence(c.perEventCapPence)} per event` : ""}${c.seasonCapPence ? `, ${formatPence(c.seasonCapPence)} per season` : ""}${c.circuits ? ` (${c.circuits.map(circuitLabel).join(", ")})` : ""}`);
  for (const b of terms.performanceBonuses) lines.push(`Potential bonus ${formatPence(b.amountPence)} for ${b.maxPosition === 1 ? "a title" : `top ${b.maxPosition}`}${b.circuits ? ` (${b.circuits.map(circuitLabel).join(", ")})` : ""} · not guaranteed`);
  return <ul className="space-y-0.5 text-xs" style={{ color: "rgba(255,255,255,0.72)" }}>{lines.map(l => <li key={l}>• {l}</li>)}</ul>;
}

function CommercialOverview({ commercial }: { commercial: SponsorCommercialOverview }) {
  const cash = commercial.cashReceivedPence;
  const bonusCount = commercial.potentialBonuses.length;
  return (
    <CareerSection title={`Sponsor money · Season ${commercial.season}`} icon={<Handshake className="w-3.5 h-3.5" />} accent="#ffd24a">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 p-3">
        <StatTile icon={<Coins size={16}/>} label="Cash received this season" value={formatPence(cash.total)} sub="Paid into your balance" tone="gold" />
        <StatTile icon={<ShieldCheck size={16}/>} label="Costs covered" value={formatPence(commercial.costsCoveredPence)} sub="Travel and fees your sponsors paid for you" tone="neutral" />
        <StatTile icon={<CalendarClock size={16}/>} label="Guaranteed still scheduled" value={formatPence(commercial.remainingGuaranteesPence)} sub="Still to come this season" tone="neutral" />
        <StatTile icon={<Sparkles size={16}/>} label="Potential performance bonuses" value={`${bonusCount} conditional term${bonusCount === 1 ? "" : "s"}`} sub="Paid only if you hit the target" tone="neutral" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="px-4 py-3 border-b lg:border-b-0 lg:border-r" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h3 className="text-xs font-black uppercase mb-2" style={{ ...OSWALD, color: "#fff" }}>Cash actually received · Season {commercial.season}</h3>
          {cash.total > 0 && <div className="career-cash-bar" aria-hidden="true">{([["signing", cash.signing], ["guarantees", cash.guarantees], ["events", cash.eventPayments], ["bonuses", cash.performanceBonuses]] as const)
            .filter(([, v]) => v > 0).map(([k, v]) => <i key={k} data-part={k} style={{ flexGrow: v }} />)}</div>}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs career-cash-legend">
            <span>Signing payments</span><span className="text-right tabular-nums">{formatPence(cash.signing)}</span>
            <span>Guaranteed instalments paid</span><span className="text-right tabular-nums">{formatPence(cash.guarantees)}</span>
            <span>Eligible event payments</span><span className="text-right tabular-nums">{formatPence(cash.eventPayments)}</span>
            <span>Earned performance bonuses</span><span className="text-right tabular-nums">{formatPence(cash.performanceBonuses)}</span>
          </div>
        </div>
        <div className="px-4 py-3">
          <h3 className="text-xs font-black uppercase mb-2" style={{ ...OSWALD, color: "#fff" }}>Scheduled guaranteed cash</h3>
          {commercial.upcomingGuarantees.length ? (
            <ul className="space-y-1.5">
              {commercial.upcomingGuarantees.map(payment => (
                <li key={payment.operationKey} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">{payment.displayName} · {payment.installment}/{payment.installments}</span>
                  <span className="shrink-0">S{payment.season} W{payment.week}</span>
                  <span className="shrink-0 font-bold" style={{ color: "#ffd24a" }}>{formatPence(payment.amountPence)}</span>
                  {payment.status === "DUE" && <StatusBadge label="Due" tone="warning" />}
                </li>
              ))}
            </ul>
          ) : <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>No future guaranteed instalments in active contracts.</p>}
          {commercial.remainingGuaranteesPence > 0 && <p className="mt-2 text-[11px]" style={{ color: "rgba(255,255,255,0.58)" }}>Upcoming list is capped at 12 entries. Remaining total includes every supported future instalment in active signed terms.</p>}
        </div>
      </div>
      {commercial.pastDueGuaranteesPence > 0 && (
        <div role="status" className="px-4 py-3 border-t text-xs" style={{ borderColor: "rgba(255,255,255,0.08)", color: TONES.warning }}>
          {formatPence(commercial.pastDueGuaranteesPence)} in signed guarantees has a past due week but no matching ledger payment. Missed historical weeks are not automatically reissued. Review the sponsor timeline and ledger before treating this as received cash.
        </div>
      )}
      {commercial.unsupportedGuarantees.length > 0 && (
        <div role="status" className="px-4 py-3 border-t text-xs" style={{ borderColor: "rgba(255,255,255,0.08)", color: TONES.warning }}>
          {commercial.unsupportedGuarantees.map(item => <p key={`${item.contractId}:${item.termIndex}`}>{item.displayName}: guarantee schedule needs review — {item.reason}</p>)}
        </div>
      )}
      {bonusCount > 0 && (
        <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h3 className="text-xs font-black uppercase mb-2" style={{ ...OSWALD, color: "#fff" }}>Contingent bonus terms · not cash or a scheduled guarantee</h3>
          <ul className="space-y-1 text-xs">
            {commercial.potentialBonuses.slice(0, 6).map((bonus, index) => (
              <li key={`${bonus.contractId}:${bonus.bonusKey}:${index}`} className="flex flex-wrap gap-x-2">
                <span className="font-bold">{bonus.displayName}</span>
                <span>{formatPence(bonus.amountPence)} if eligible for {bonus.maxPosition === 1 ? "a title" : `top ${bonus.maxPosition}`}</span>
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.58)" }}>{[...bonus.classifications, ...(bonus.circuits ?? [])].map(titleCase).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CareerSection>
  );
}

function ordinalSuffix(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  return value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th";
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
        <ul className="career-money-list">{rows.map(e => (
          <li key={e.id} className="career-money-row">
            <span className="career-money-row__week">{e.season ? <>S{e.season}<b>W{e.week}</b></> : "—"}</span>
            <div className="min-w-0"><strong>{publicText(e.reason ?? ledgerLabel(e.category))}</strong>
              <small>{ledgerLabel(e.category)}{e.sponsorCoveredPence ? ` · ${formatPence(e.sponsorCoveredPence)} sponsor-covered` : ""}</small></div>
            <span className={`career-money-row__amount ${e.amountPence >= 0 ? "is-in" : "is-out"}`}>{formatPence(e.amountPence, { signed: true })}</span>
          </li>))}</ul>
      )}
      <div className="flex justify-between px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <button className="career-btn career-btn-ghost" disabled={cursors.length === 1} onClick={() => setCursors(cursors.slice(0, -1))}>Newer</button>
        <Label>Every payment in and out</Label>
        <button className="career-btn career-btn-ghost" disabled={!ledger.data?.next} onClick={() => ledger.data?.next && setCursors([...cursors, ledger.data.next])}>Older</button>
      </div>
    </CareerSection>
  );
}
