import { useState } from "react";
import { Link } from "wouter";
import { CalendarDays, Flag as FlagIcon, Medal, MapPin, Swords, TrendingUp, Trophy } from "lucide-react";
import { useCalendar, useCareerProfile, useEnterEvent, useFinance, useHistory, useSporting, errorMessage } from "../api";
import { careerChapter, circuitLabel, eventDateLabel, eventStatus, formatLabel, formatPence, milestoneLabel, ordinal, primaryAction, pickNextEvent, stageLabel, tierStyle, sourceLabel, TONES } from "../model";
import { CareerEmptyState, CareerError, CareerEventCard, CareerLoading, CareerSection, Label, Movement, OSWALD, StatTile, StatusBadge, TierBadge } from "../components";
import type { ShellContext } from "../shell";
import type { CareerEvent } from "../types";
import { MatchBoundaryNotice } from "./match-boundary";
import { GoalsSummary } from "./goals";
import { RecognitionSummary } from "./recognition";

/** Screen 1 — Career Home: next action → current status → upcoming Career → world context. */
export function HomePage({ ctx }: { ctx: ShellContext }) {
  const { save, overview, retired } = ctx;
  const id = save.id;
  const sporting = useSporting(id);
  const finance = useFinance(id);
  const upcoming = useCalendar(id, { scope: "WORLD", fromWeek: save.currentWeek, toWeek: Math.min(52, save.currentWeek + 8) }, !retired);
  const history = useHistory(id, { participant: "HUMAN" });
  const enter = useEnterEvent(id);
  const [enterMsg, setEnterMsg] = useState<string | null>(null);

  const pendingIds = new Set((upcoming.data?.overview ?? overview)?.pendingHumanMatches.map(p => p.eventId) ?? []);
  const next = upcoming.data ? pickNextEvent(upcoming.data.events, upcoming.data.overview) : null;
  const mine = (upcoming.data?.events ?? []).filter(e => e.human && ["ENTERED", "CONFIRMED", "PLAYING"].includes(e.human.relationship) && e.id !== next?.event.id).slice(0, 5);
  const open = (upcoming.data?.events ?? []).filter(e => e.human?.canEnter && e.id !== next?.event.id).slice(0, 5);
  const onEnter = (eventId: string) => { setEnterMsg(null); enter.mutate(eventId, { onSuccess: r => setEnterMsg(r.entered ? "Entry confirmed." : `Entry refused: ${r.denials.join(", ")}`), onError: e => setEnterMsg(errorMessage(e)) }); };

  return (
    <div className="space-y-3">
      {/* NEXT ACTION (a retired Career has none: it is a read-only record) */}
      {retired ? (
        <section className="pdc-card p-4 md:p-5 space-y-2" aria-label="Retired Career">
          <Label>Career record</Label>
          <h2 className="font-black uppercase leading-none" style={{ ...OSWALD, fontSize: "clamp(1.3rem, 4.5vw, 1.9rem)", color: "#fff" }}>
            Retired{save.retiredAt ? ` ${new Date(save.retiredAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}` : ""}
          </h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>Final position in the calendar: season {save.currentSeason}, week {save.currentWeek}. Results, rankings, money and milestones below are the permanent record.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={`/career/${id}/history`} className="career-btn career-btn-primary">History &amp; trophy room</Link>
            <Link href={`/career/${id}/journey`} className="career-btn career-btn-ghost">Journey</Link>
          </div>
        </section>
      ) : upcoming.isLoading ? <div className="pdc-card"><CareerLoading label="Finding your next event" /></div>
        : upcoming.error ? <CareerError error={upcoming.error} onRetry={() => upcoming.refetch()} />
        : next ? <NextEventCard event={next.event} reason={next.reason} saveId={id} awaiting={pendingIds.has(next.event.id)} retired={retired} onEnter={onEnter} entering={enter.isPending} message={enterMsg} />
        : <div className="pdc-card"><CareerEmptyState title="No event you can enter in the next eight weeks" icon={<CalendarDays className="w-6 h-6" />}>Use Continue to move the calendar on, or browse the <Link href={`/career/${id}/calendar`} className="underline">full calendar</Link>.</CareerEmptyState></div>}

      {/* CURRENT STATUS */}
      <AgeLine saveId={id} />
      <GoalsSummary saveId={id} />
      <RecognitionSummary saveId={id} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {sporting.data ? (() => {
          const w = sporting.data.worldRanking;
          const pos = w.standing?.position ?? null;
          const nextCut = w.cutLines.filter(c => !c.inside && c.valueAtCutPence !== null).sort((a, b) => b.cutPosition - a.cutPosition)[0];
          return <StatTile label="World Rank" to={`/career/${id}/rankings`} tone={pos ? "gold" : "neutral"}
            value={pos ? <span className="inline-flex items-baseline gap-2">{ordinal(pos)} <Movement movement={w.standing?.movement} isNew={w.standing?.isNew} /></span> : "Unranked"}
            sub={pos ? `Career high ${ordinal(w.careerHighPosition ?? pos)}${nextCut ? ` · ${formatPence(nextCut.gapPence, { compact: true })} to top ${nextCut.cutPosition}` : ""}` : w.published ? "No World Ranking money yet" : "No World Ranking published yet"} />;
        })() : <StatTile label="World Rank" value={sporting.isLoading ? "…" : "—"} />}
        <StatTile label="Balance" to={`/career/${id}/finances`} value={finance.data ? formatPence(finance.data.balancePence) : finance.isLoading ? "…" : "—"}
          sub={finance.data ? (finance.data.reservedForTravelPence > 0 ? `${formatPence(finance.data.availablePence)} available` : "Spendable Career cash") : undefined} />
        <StatTile label="Tour Card" to={`/career/${id}/journey`} tone={sporting.data?.tourCard.holdsCard ? "success" : "neutral"}
          value={sporting.data ? (sporting.data.tourCard.holdsCard ? "Active" : "No Tour Card") : "…"}
          sub={sporting.data?.tourCard.current ? `${sourceLabel(sporting.data.tourCard.current.source)} · review end of S${sporting.data.tourCard.current.reviewSeason}` : sporting.data ? "Q-School or the Challenger ranking can earn one" : undefined} />
        <StatTile label="Sponsor" to={`/career/${id}/finances`} value={finance.data ? (finance.data.sponsor?.displayName ?? "Self-funded") : "…"}
          sub={finance.data ? (finance.data.sponsor ? `${finance.data.sponsor.tier.toLowerCase()} · until S${finance.data.sponsor.endSeason} W${finance.data.sponsor.endWeek}` : finance.data.availableOffers ? `${finance.data.availableOffers} offer${finance.data.availableOffers > 1 ? "s" : ""} waiting` : "No offers yet") : undefined}
          tone={finance.data?.availableOffers ? "gold" : "neutral"} />
      </div>
      {sporting.error && <CareerError error={sporting.error} onRetry={() => sporting.refetch()} />}
      {finance.error && <CareerError error={finance.error} onRetry={() => finance.refetch()} />}

      {/* UPCOMING CAREER */}
      {!retired && <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CareerSection title="Your schedule" icon={<CalendarDays className="w-3.5 h-3.5" />} action={<Link href={`/career/${id}/calendar`} className="career-btn career-btn-ghost">Calendar</Link>}>
          {mine.length ? mine.map(e => <CareerEventCard key={e.id} event={e} saveId={id} awaitingMatch={pendingIds.has(e.id)} retired={retired} compact />)
            : <CareerEmptyState title="Nothing entered">Events you enter appear here with their costs and status.</CareerEmptyState>}
        </CareerSection>
        <CareerSection title="Open for entry" icon={<FlagIcon className="w-3.5 h-3.5" />} accent="#38bdf8">
          {open.length ? open.map(e => <CareerEventCard key={e.id} event={e} saveId={id} retired={retired} onEnter={retired ? undefined : onEnter} entering={enter.isPending} compact />)
            : <CareerEmptyState title="No open entries">Nothing you can enter in the next eight weeks right now.</CareerEmptyState>}
        </CareerSection>
      </div>}

      {/* WORLD / CAREER CONTEXT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <CareerSection title="Recent results" icon={<Trophy className="w-3.5 h-3.5" />} accent="#ffd24a" action={<Link href={`/career/${id}/history`} className="career-btn career-btn-ghost">History</Link>}>
          {history.isLoading ? <CareerLoading /> : history.data?.length ? (
            <ul>{history.data.slice(0, 5).map(r => (
              <li key={r.eventId} className="px-4 py-2 border-b last:border-b-0 flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <Link href={`/career/${id}/events/${r.eventId}`} className="flex-1 min-w-0 career-row-link rounded"><div className="truncate text-sm font-bold" style={{ ...OSWALD, color: "#fff" }}>{r.name}</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>S{r.season} W{r.week} · {circuitLabel(r.circuit)}</div></Link>
                <StatusBadge label={r.champion ? "Champion" : stageLabel(r.stageReached)} tone={r.champion ? "gold" : "neutral"} />
              </li>))}</ul>
          ) : <CareerEmptyState title="No results yet">Your first finished event will appear here.</CareerEmptyState>}
        </CareerSection>
        <CareerSection title="Rankings" icon={<TrendingUp className="w-3.5 h-3.5" />} accent="#c084fc" action={<Link href={`/career/${id}/rankings`} className="career-btn career-btn-ghost">Tables</Link>}>
          {sporting.data ? (
            <ul>{sporting.data.rankings.map(r => (
              <li key={r.key} className="px-4 py-2 border-b last:border-b-0 flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span className="flex-1 text-sm truncate" style={{ ...OSWALD, color: "rgba(255,255,255,0.8)" }}>{r.name}</span>
                <Movement movement={r.movement} isNew={r.isNew} />
                <span className="w-14 text-right font-black tabular-nums" style={{ ...OSWALD, color: r.position ? "#fff" : "rgba(255,255,255,0.35)" }}>{r.position ? ordinal(r.position) : "—"}</span>
              </li>))}</ul>
          ) : <CareerLoading />}
        </CareerSection>
        <CareerSection title="Targets & milestones" icon={<Medal className="w-3.5 h-3.5" />} accent="#4ade80" action={<Link href={`/career/${id}/journey`} className="career-btn career-btn-ghost">Journey</Link>}>
          {sporting.data ? <Targets ctx={ctx} /> : <CareerLoading />}
        </CareerSection>
      </div>
    </div>
  );

  function Targets({ ctx }: { ctx: ShellContext }) {
    const s = sporting.data!;
    const chapter = careerChapter(s, ctx.save);
    const facts: string[] = [];
    if (ctx.retired) { /* no objectives for a finished Career */ }
    else if (s.tourCard.current) facts.push(`Tour Card review at the end of season ${s.tourCard.current.reviewSeason}: World Ranking top ${s.tourCard.current.retention.maxPosition} keeps it.`);
    else facts.push("No Tour Card: Q-School and the season-end Challenger ranking are the routes to one.");
    const gap = s.worldRanking.cutLines.filter(c => !c.inside && c.valueAtCutPence !== null).sort((a, b) => b.cutPosition - a.cutPosition)[0];
    if (gap && s.worldRanking.standing && !ctx.retired) facts.push(`${formatPence(gap.gapPence)} of ranking money behind the World top ${gap.cutPosition}.`);
    return (
      <div className="px-4 py-3 space-y-2.5">
        <StatusBadge label={chapter.label} tone={chapter.tone} />
        <ul className="space-y-1.5 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{facts.map(f => <li key={f}>• {f}</li>)}</ul>
        {s.recentMilestones.length ? (
          <ul className="space-y-1">{s.recentMilestones.slice(0, 4).map((m, i) => { const l = milestoneLabel(m); return (
            <li key={i} className="flex items-baseline gap-2 text-xs"><span style={{ color: TONES[l.tone] }} aria-hidden>●</span>
              <span style={{ color: "#fff" }}>{l.title}</span>{l.detail && <span style={{ color: "rgba(255,255,255,0.62)" }} className="truncate">{l.detail}</span>}
              <span className="ml-auto shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>S{m.season} W{m.week}</span></li>); })}</ul>
        ) : <p className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>No milestones yet.</p>}
      </div>
    );
  }
}

function NextEventCard({ event, reason, saveId, awaiting, retired, onEnter, entering, message }: { event: CareerEvent; reason: string; saveId: string; awaiting: boolean; retired: boolean; onEnter: (id: string) => void; entering: boolean; message: string | null }) {
  const tier = tierStyle(event.presentation.tier);
  const status = eventStatus(event, { awaitingMatch: awaiting });
  const action = primaryAction(event, { awaitingMatch: awaiting, retired });
  const f = event.finance;
  return (
    <section className="pdc-card overflow-hidden relative" aria-label="Next event" style={{ borderColor: `${tier.accent}55` }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(90% 120% at 100% 0%, ${tier.accent}22, transparent 60%)` }} aria-hidden />
      <div className="relative p-4 md:p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap"><Label color={tier.accent}>Next · {reason}</Label><TierBadge tier={event.presentation.tier} />{!awaiting && <StatusBadge label={status.label} tone={status.tone} />}</div>
        <div>
          <h2 className="font-black uppercase leading-none" style={{ ...OSWALD, fontSize: "clamp(1.4rem, 5vw, 2.2rem)", color: "#fff" }}>{event.name}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
            <span>{circuitLabel(event.circuit)}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" aria-hidden />{event.venue.name}, {event.venue.city}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" aria-hidden />{eventDateLabel(event)}</span>
            <span>{formatLabel(event.format)}</span>
          </div>
        </div>
        {status.detail && <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{status.detail}</p>}
        {f && (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Fact label="Entry fee" value={formatPence(f.entryFeePence)} sub={f.sponsorCoverage.entryFeePence ? `${formatPence(f.sponsorCoverage.entryFeePence)} sponsor-covered` : f.entryFeeBasis === "PER_SERIES" ? "Whole series" : undefined} />
            <Fact label="Travel + stay" value={formatPence(f.estimatedTravelPence + f.estimatedAccommodationPence)} sub={`${f.travelBand.toLowerCase().replace("_", " ")}${f.nights ? ` · ${f.nights} night${f.nights > 1 ? "s" : ""}` : ""}`} />
            <Fact label="You pay" value={formatPence(f.estimatedPlayerCostPence)} sub={`${formatPence(f.availablePence)} available`} tone={f.affordable ? undefined : "#ff005c"} />
            <Fact label="Top prize" value={f.topPrizePence ? formatPence(f.topPrizePence, { compact: true }) : "None"} sub={f.rankingEligible ? "Ranking money" : "Not ranking money"} />
          </dl>
        )}
        {awaiting && <MatchBoundaryNotice saveId={saveId} eventId={event.id} compact />}
        <div className="flex flex-wrap items-center gap-2">
          {action.kind === "ENTER" ? <button className="career-btn career-btn-primary" onClick={() => onEnter(event.id)} disabled={entering}>{entering ? "Entering…" : action.label}</button>
            : action.kind === "PLAY_MATCH" ? <Link href={`/career/${saveId}/events/${event.id}`} className="career-btn career-btn-gold"><Swords className="w-4 h-4" aria-hidden /> Open match</Link>
            : <span className="career-btn" aria-disabled={!action.enabled} style={{ opacity: action.enabled ? 1 : 0.55 }}>{action.label}</span>}
          <Link href={`/career/${saveId}/events/${event.id}`} className="career-btn career-btn-ghost">Event details</Link>
        </div>
        {message && <p role="status" className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>{message}</p>}
      </div>
    </section>
  );
}
function Fact({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.06)" }}>
    <dt><Label color="rgba(255,255,255,0.4)">{label}</Label></dt>
    <dd className="font-black tabular-nums" style={{ ...OSWALD, color: tone ?? "#fff", fontSize: "1rem" }}>{value}</dd>
    {sub && <dd className="text-xs truncate" style={{ color: "rgba(255,255,255,0.62)" }}>{sub}</dd>}
  </div>;
}

/** A6.5: age derived from Career time (never the real clock). */
export function AgeLine({ saveId }: { saveId: string }) {
  const p = useCareerProfile(saveId).data;
  if (p?.status !== "COMPLETE") return null;
  const parts = [`Age ${p.age}`, `Career started at ${p.ageAtCareerStart}`];
  if (p.junior) parts.push(`Junior events until you turn ${p.juniorMaxAgeExclusive}`);
  if (!p.qSchool.eligibleNow && p.qSchool.eligibleFrom) parts.push(`Q-School from ${p.qSchool.eligibleFrom.date}`);
  return <p className="text-xs px-1" style={{ ...OSWALD, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em" }}>{parts.join(" · ")}</p>;
}
