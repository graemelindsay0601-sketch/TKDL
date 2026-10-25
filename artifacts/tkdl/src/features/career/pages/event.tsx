import { useMemo, useState, type CSSProperties } from "react";
import {CareerEventIdentity, CareerShirt} from "../identity";
import {ContextHelp} from "../guidance";
import { Link } from "wouter";
import { ArrowLeft, CalendarDays, Coins, MapPin, Play, ShieldCheck, Swords, Ticket, Trophy, Users } from "lucide-react";
import { useEnterEvent, useEvent, useEventFinance, useEventHistory, useQualification, usePresentation, useWithdrawEvent, errorMessage } from "../api";
import { eventCircuitLabel, denialLabel, eventDateLabel, eventLifecycle, eventMatchFormatLine, formatLabel, formatRuleLines, formatPence, listLabel, ordinal, roundName, routeLines, stageLabel, tierStyle, titleCase, TONES, isJuniorEvent, ageReason, viabilityText, worthIt } from "../model";
import { CareerEmptyState, CareerError, CareerEventStakes, CareerLoading, CareerSection, ConfirmButton, Flag, JuniorBadge, Label, OSWALD, Segmented, StatusBadge, TierBadge } from "../components";
import type { ShellContext } from "../shell";
import type { CareerMatch, EventDetail } from "../types";
import { MatchBoundaryNotice } from "./match-boundary";
import { CareerVenueArtwork } from "./venue-atlas";
import { EntryCase } from "../tournament/components";
import "./event.css";

type Tab = "OVERVIEW" | "DRAW" | "SCHEDULE" | "MY_MATCHES" | "PLAYERS" | "PRIZE" | "RANKING";

/** Screen 3 — Event / Tournament over the real A3 lifecycle. Tabs appear only when real data exists. */
export function EventPage({ ctx, eventId, palace }: { ctx: ShellContext; eventId: string; palace?: boolean }) {
  const q = useEvent(ctx.save.id, eventId);
  if (q.isLoading) return <div className="pdc-card"><CareerLoading label="Loading event" /></div>;
  if (q.error || !q.data) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  return <EventView ctx={ctx} detail={q.data} palace={palace} />;
}

export function EventView({ ctx, detail, palace }: { ctx: ShellContext; detail: EventDetail; palace?: boolean }) {
  const { save, retired, overview } = ctx;
  const e = detail.event;
  const tier = tierStyle(e.presentation.tier);
  const life = eventLifecycle(detail);
  const awaiting = !!overview?.pendingHumanMatches.some(p => p.eventId === e.id);
  const myMatches = detail.draw.matches.filter(m => m.a?.key === "HUMAN" || m.b?.key === "HUMAN");
  const fieldPct = e.field.size > 0 ? Math.min(100, Math.max(0, e.field.entrants / e.field.size * 100)) : 0;
  const fieldMet = e.field.entrants >= e.field.minimum;
  const entryState = e.human?.entryStatus && e.human.entryStatus !== "WITHDRAWN"
    ? (e.human.entryStatus === "CONFIRMED" ? "In the field" : "Entered")
    : e.human?.canEnter ? "Entry open" : e.human?.denials.length ? "Not eligible" : "No entry";
  const tabs: { value: Tab; label: string }[] = [{ value: "OVERVIEW", label: "Overview" }];
  if (detail.draw.matches.length) tabs.push({ value: "DRAW", label: "Draw" }, { value: "SCHEDULE", label: "Schedule" });
  if (myMatches.length) tabs.push({ value: "MY_MATCHES", label: "My matches" });
  if (detail.field.length) tabs.push({ value: "PLAYERS", label: `Players ${detail.field.length}` });
  tabs.push({ value: "PRIZE", label: "Prize" }, { value: "RANKING", label: "Ranking" });
  const [tab, setTab] = useState<Tab>("OVERVIEW");

  return (
    <CareerEventIdentity eventKey={e.definitionKey} circuit={e.circuit} level={e.presentation.tier}><div className="career-event-page space-y-3">
      <header className="career-event-masthead">
        <span className="career-event-brand">TKDL <i>·</i> CAREER TOUR</span>
        <span className="career-event-edition">SEASON <b>{e.season}</b></span>
      </header>
      {!palace && <Link href={`/career/${save.id}/calendar`} className="career-btn career-btn-ghost career-event-back"><ArrowLeft className="w-4 h-4" aria-hidden /> Calendar</Link>}
      <section className="pdc-card overflow-hidden relative career-event-hero" style={{ borderColor: `${tier.accent}${tier.emphasis >= 4 ? "66" : "33"}`, ["--event-accent" as string]: tier.accent }}
        aria-label={`${e.name} at ${e.venue.name}`}>
        {/* The event's own venue art sits behind the title (decorative); the venue name stays in the text below. */}
        <CareerVenueArtwork family={e.venue.venueType} className="career-event-hero__art" />
        <div className="career-event-hero__shade" aria-hidden="true" />
        <div className="absolute inset-0 pointer-events-none" aria-hidden style={{ background: `radial-gradient(80% 140% at 100% 0%, ${tier.accent}${tier.emphasis >= 4 ? "26" : "12"}, transparent 60%)` }} />
        <div className="career-event-hero-meta">
          <span><Trophy size={14} aria-hidden /> {eventCircuitLabel(e)}</span>
          <span>{titleCase(e.classification)} · {life.label}</span>
        </div>
        <div className="relative p-4 md:p-6 space-y-2 career-event-hero__copy">
          <p className="career-event-hero__venue">{eventCircuitLabel(e)} · Season {e.season}</p>
          <div className="flex flex-wrap items-center gap-2"><TierBadge tier={e.presentation.tier} />{isJuniorEvent(e) && <JuniorBadge />}<StatusBadge label={life.label} tone={life.tone} />
            {ageReason(e) && <StatusBadge label={ageReason(e)!} tone="muted" />}
            {e.qSchool && <StatusBadge label={`Q-School ${e.qSchool.stage === "FIRST" ? "First" : "Final"} Stage · Day ${e.qSchool.day}`} tone="gold" />}</div>
          <h1 className="font-black uppercase leading-none" style={{ ...OSWALD, fontSize: `clamp(2.6rem, ${6 + tier.emphasis * 0.5}vw, ${4 + tier.emphasis * 0.22}rem)`, color: palace ? "#ffe79a" : "#fff" }}>{e.name}</h1>
          {e.content?.summary && <p className="text-sm max-w-3xl" style={{ color: "rgba(255,255,255,0.78)" }}>{e.content.summary}</p>}
        </div>
        <div className="career-event-date-stamp" aria-label={`Season ${e.season}, weeks ${e.dates.startWeek} to ${e.dates.endWeek}`}>
          <small>SEASON {e.season}</small><strong>{e.dates.startWeek}</strong><span>— {e.dates.endWeek}</span><small>EVENT WEEKS</small>
        </div>
        <div className="career-event-hero-venue"><MapPin size={17} aria-hidden />
          <span><small>THE VENUE · {e.venue.city}</small><strong>{e.venue.name}</strong><em>{e.venue.city}, {e.venue.region} · {eventDateLabel(e)}</em></span>
        </div>
        <div className="career-event-hero-live"><span className="career-event-live-dot" /><span><small>YOUR ENTRY</small><strong>{entryState}</strong></span></div>
      </section>
      <div className="career-event-info-strip">
        <div><CalendarDays size={17} aria-hidden /><span><small>EVENT DATES</small><strong>Season {e.season} · {eventDateLabel(e)}</strong><em>{formatLabel(e.format)}</em></span></div>
        <div><MapPin size={17} aria-hidden /><span><small>DESTINATION</small><strong>{e.venue.name}</strong><em>{e.venue.city}, {e.venue.country} <Flag code={e.venue.country} /></em></span></div>
        <div><ShieldCheck size={17} aria-hidden /><span><small>EVENT STATUS</small><strong>{life.label}</strong><em>{titleCase(e.status)}</em></span></div>
      </div>
      <div className="career-event-feature-grid">
        <section className="career-event-timeline" aria-label="Registration and event timeline">
          <div className="career-event-feature-heading"><span>THE ROAD TO THE STAGE</span><small>SEASON {e.season}</small></div>
          <div className="career-event-timeline-track">
            <div className="career-event-timeline-line" aria-hidden="true" />
            <div><i>{e.registration.opensWeek}</i><small>REGISTRATION</small><strong>Opens</strong></div>
            <div><i>{e.registration.closesWeek}</i><small>ENTRY WINDOW</small><strong>Closes</strong></div>
            <div className="career-event-milestone-final"><i><Trophy size={15} aria-hidden /></i><small>WEEKS {e.dates.startWeek}–{e.dates.endWeek}</small><strong>Event stage</strong></div>
          </div>
        </section>
        <section className="career-event-feature-stakes">
          <div className="career-event-field">
            <div className="career-event-feature-heading"><span>{fieldMet ? "FIELD CONFIRMED" : "FIELD BUILDING"}</span><small>01 / 03</small></div>
            <div className="career-event-field-content">
              <div className="career-event-field-ring" role="img" aria-label={`${e.field.entrants} entrants out of ${e.field.size} capacity; ${e.field.minimum} required to run`} style={{ "--field-progress": `${fieldPct}%` } as CSSProperties}>
                <span><strong>{e.field.entrants}</strong><small>OF {e.field.size}</small></span>
              </div>
              <div className="career-event-field-copy"><small>ENTRANTS / CAPACITY</small><strong>{fieldMet ? "Minimum field met" : "Field building"}</strong>
                <div className="career-event-field-threshold"><span><i style={{ width: `${e.field.size > 0 ? Math.min(100, e.field.minimum / e.field.size * 100) : 0}%` }} /></span><b aria-hidden style={{ left: `${e.field.size > 0 ? Math.min(100, e.field.minimum / e.field.size * 100) : 0}%` }} /><small><strong>{e.field.minimum}</strong> required to run</small></div>
              </div>
            </div>
            <p className="career-event-field-foot"><ShieldCheck size={14} aria-hidden /> {e.field.entrants} entrants · {fieldMet ? "minimum met" : `${Math.max(0, e.field.minimum - e.field.entrants)} more needed`}</p>
          </div>
          <div className="career-event-prize-format">
            <div><div className="career-event-feature-heading"><span>THE STAKES</span><small>02 / 03</small></div><small>TOP PRIZE</small><strong>{e.finance?.topPrizePence ? formatPence(e.finance.topPrizePence) : "Not published"}</strong>
              <span className="career-event-trophy-name"><Trophy size={16} aria-hidden /> {e.finance?.rankingEligible ? "RANKING EVENT" : e.rankingCategory ? titleCase(e.rankingCategory) : "EVENT PRIZE"}</span>
            </div>
            <div><div className="career-event-feature-heading"><span>THE FORMAT</span><small>03 / 03</small></div><strong>{formatLabel(e.format)}</strong><small>{e.format.days} {e.format.days === 1 ? "day" : "days"} · {e.format.gameType.replaceAll("_", " ").toLowerCase()}</small></div>
          </div>
        </section>
      </div>
      <CareerEventStakes event={e} />
      {!!detail.seriesStandings?.length && <CareerSection title="Oceania Premier League standings" icon={<Trophy className="w-3.5 h-3.5" />} accent="#ffd24a">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left opacity-70">
          <th className="p-2">#</th><th className="p-2">Player</th><th className="p-2">Pts</th><th className="p-2">Night wins</th><th className="p-2">Matches</th><th className="p-2">Leg diff</th><th className="p-2">Legs against throw</th><th className="p-2">Avg</th><th className="p-2">Finals</th>
        </tr></thead><tbody>{detail.seriesStandings.map(row => <tr key={row.participantKey} className="border-t border-white/10">
          <td className="p-2">{row.position}</td><td className="p-2 font-semibold">{row.name ?? row.participantKey}</td><td className="p-2">{row.points}</td>
          <td className="p-2">{row.nightsWon}</td><td className="p-2">{row.wins}</td><td className="p-2">{row.legDifference > 0 ? `+${row.legDifference}` : row.legDifference}</td>
          <td className="p-2">{row.legsWonAgainstThrow ?? "—"}</td><td className="p-2">{row.tournamentAverage?.toFixed(2) ?? "—"}</td>
          <td className="p-2">{row.qualified ? "Qualified" : !detail.seriesFinalsDecided && row.position <= 4 ? "In top four" : "—"}</td>
        </tr>)}</tbody></table></div>
      </CareerSection>}
      {/* F2: guidance loads asynchronously; placed after the hero so it never pushes the event identity down (CLS). */}
      <ContextHelp saveId={save.id} topic="event"/>
      {(e.circuit==="Q_SCHOOL"||["WORLD","MAJOR"].includes(e.presentation.tier))&&<ContextHelp saveId={save.id} topic={e.circuit==="Q_SCHOOL"?"q-school":e.presentation.tier==="WORLD"?"palace":"major"}/>}

      {life.key === "UNSUPPORTED" && (
        <div role="status" className="career-event-notice">
          <strong style={OSWALD}>Intentionally benched.</strong> This event's format ({formatLabel(e.format)}) is
          {" intentionally benched — informational only, with no entry, field, draw or invented result."}
        </div>
      )}
      <div className="career-event-registration">
        <div className="career-event-registration-heading"><span>YOUR PLACE IN THE FIELD</span><StatusBadge label={entryState} tone={e.human?.entryStatus && e.human.entryStatus !== "WITHDRAWN" ? "success" : e.human?.canEnter ? "gold" : "muted"} /></div>
        <div className="career-event-registration-actions">
          <div><span className="career-event-registration-icon"><Ticket size={16} aria-hidden /></span><span><small>ENTRY WINDOW</small><strong>Weeks {e.registration.opensWeek}–{e.registration.closesWeek}</strong></span></div>
          <div><span className="career-event-registration-icon"><ShieldCheck size={16} aria-hidden /></span><span><small>YOUR EVENT</small><strong>{entryState}</strong></span></div>
        </div>
        <Link href={`/career/${save.id}/tournaments/${e.id}`} className="career-btn career-btn-gold"><Trophy className="w-4 h-4" aria-hidden/> Tournament Hub</Link>
        {awaiting && <MatchBoundaryNotice saveId={save.id} eventId={e.id} />}
        {!awaiting && !["COMPLETED", "CANCELLED"].includes(e.status) && <EntryCase e={e} />}
        {!awaiting && <EntryActions ctx={ctx} detail={detail} />}
      </div>

      <Segmented label="Event sections" value={tab} onChange={value => setTab(value as Tab)} options={tabs} wrap />
      {tab === "OVERVIEW" && <Overview detail={detail} saveId={save.id} />}
      {tab === "DRAW" && <Draw detail={detail} saveId={save.id} />}
      {tab === "SCHEDULE" && <Schedule detail={detail} />}
      {tab === "MY_MATCHES" && <CareerSection title="My matches" icon={<Swords className="w-3.5 h-3.5" />}>{myMatches.map(m => <MatchRow key={m.id} m={m} rounds={detail.draw.rounds} saveId={save.id} format={e.format} />)}</CareerSection>}
      {tab === "PLAYERS" && <Players detail={detail} saveId={save.id} />}
      {tab === "PRIZE" && <Prize saveId={save.id} detail={detail} />}
      {tab === "RANKING" && <RankingTab saveId={save.id} detail={detail} retired={retired} />}
    </div></CareerEventIdentity>
  );
}

function EntryActions({ ctx, detail }: { ctx: ShellContext; detail: EventDetail }) {
  const e = detail.event, h = e.human;
  const enter = useEnterEvent(ctx.save.id);
  const withdraw = useWithdrawEvent(ctx.save.id);
  const [msg, setMsg] = useState<string | null>(null);
  const [travelChoice, setTravelChoice] = useState<"AUTO" | "GROUND_COMMUTE" | "AIR_STAY">("AUTO");
  if (ctx.retired || !h) return null;
  const entered = h.entryStatus && h.entryStatus !== "WITHDRAWN" && !["COMPLETED", "CANCELLED"].includes(e.status);
  const locked = ["DRAW_PENDING", "DRAWN", "IN_PROGRESS"].includes(e.status);
  const f = e.finance;
  const travelOptions = f?.travelOptions ?? [];
  const selectedTravel = travelOptions.find(option => option.choice === travelChoice) ?? travelOptions[0];
  const committedTravel = travelOptions.find(option => option.choice === f?.commitment?.travelChoice);
  if (!h.canEnter && !entered && !h.denials.length) return null;
  return (
    <div className="pdc-card px-4 py-3 space-y-2">
      {h.canEnter ? (
        <div className="space-y-2">
          {travelOptions.length > 1 && <label className="block max-w-xl text-xs text-white/75">Travel plan
            <select className="ml-2 rounded border border-white/20 bg-slate-950 px-2 py-1.5 text-white" value={selectedTravel?.choice ?? "AUTO"}
              onChange={event => setTravelChoice(event.target.value as typeof travelChoice)}>
              {travelOptions.map(option => <option key={option.choice} value={option.choice}>
                {option.label} · travel {formatPence(option.estimatedTravelPence)} · stay {formatPence(option.estimatedAccommodationPence)} · total after sponsor cover {formatPence(option.estimatedPlayerCostPence)}
              </option>)}
            </select>
          </label>}
          {selectedTravel && (selectedTravel.sponsorCoverage.travelPence + selectedTravel.sponsorCoverage.accommodationPence > 0)
            && <p className="text-xs text-emerald-200">Sponsor travel and stay cover: {formatPence(selectedTravel.sponsorCoverage.travelPence + selectedTravel.sponsorCoverage.accommodationPence)}.</p>}
          {travelOptions.length > 1 && <p className="text-xs text-white/55">If consecutive events at the same destination share one trip, the first explicit travel choice in event order applies to the combined journey.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button className="career-btn career-btn-primary" disabled={enter.isPending} onClick={() => enter.mutate({ eventId: e.id, travelChoice: selectedTravel?.choice ?? "AUTO" }, { onSuccess: r => setMsg(r.entered ? "Entry confirmed." : `Entry refused: ${r.denials.map(denialLabel).join(", ")}`), onError: x => setMsg(errorMessage(x)) })}>
              {enter.isPending ? "Entering…" : selectedTravel && selectedTravel.estimatedPlayerCostPence > 0 ? `Enter · ${formatPence(selectedTravel.estimatedPlayerCostPence)}` : "Enter"}</button>
            {f && <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>Entry fee {formatPence(f.entryFeePence)}{f.entryFeeBasis === "PER_SERIES" ? " (whole series)" : ""} charged now · selected travel and stay reserved, charged in the week you travel</span>}
          </div>
        </div>
      ) : entered ? (
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge label={h.entryStatus === "CONFIRMED" ? "In the field" : "Entered"} tone="success" />
          {committedTravel && <span className="text-xs text-white/65">Travel plan: {committedTravel.label}</span>}
          <ConfirmButton label={locked ? "Withdraw (concede)" : "Withdraw"} confirmLabel="Withdraw" danger busy={withdraw.isPending}
            description={locked ? "The field is locked: withdrawing concedes your remaining matches as walkovers. Late withdrawals are not refunded." : "Withdraw before entries close. The refund depends on this event's refund policy."}
            onConfirm={() => withdraw.mutate(e.id, { onSuccess: r => setMsg(r.withdrawn ? "Withdrawn." : `Not withdrawn: ${r.denials.map(denialLabel).join(", ")}`), onError: x => setMsg(errorMessage(x)) })} />
        </div>
      ) : (
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}><Label>Entry</Label><div>{[...new Set(h.denials)].map(denialLabel).join(" · ")}</div>
          {h.denials.includes("INSUFFICIENT_FUNDS") && f && <div className="text-xs mt-1" style={{ color: TONES.danger }}>Estimated cost {formatPence(f.estimatedPlayerCostPence)} · available {formatPence(f.availablePence)}</div>}</div>
      )}
      {!!h.commercialConflicts?.length&&<p className="text-sm">An accepted off-board commitment reserves this date. <Link className="underline" href={`/career/${ctx.save.id}/life`}>View Career Life</Link></p>}
      {msg && <p role="status" className="text-sm" style={{ color: "#fff" }}>{msg}</p>}
    </div>
  );
}

function Overview({ detail, saveId }: { detail: EventDetail; saveId: string }) {
  const e = detail.event;
  const champion = detail.results.find(r => r.champion);
  const mine = detail.results.find(r => r.participantKey === "HUMAN");
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <CareerSection title="Event facts" icon={<Trophy className="w-3.5 h-3.5" />}>
        <dl className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <F label="Field" value={`${e.field.entrants || "—"} of ${e.field.size} (min ${e.field.minimum})`} />
          {viabilityText(e.viability) && <F label="Goes ahead?" value={`${viabilityText(e.viability)!.label} · ${viabilityText(e.viability)!.detail}`} />}
          <F label="Entries" value={`Weeks ${e.registration.opensWeek}–${e.registration.closesWeek}`} />
          <F label="Ranking category" value={e.rankingCategory ? titleCase(e.rankingCategory) : "None"} />
          <F label="Seeding" value={e.seedingPolicy.list ? `${e.seedingPolicy.seeds} seeds · ${listLabel(e.seedingPolicy.list)}` : "Unseeded draw"} />
          <F label="Progress" value={detail.draw.matches.length ? `${detail.progress.completedMatches}/${detail.progress.totalMatches} matches` : "No draw yet"} />
          <F label="Status" value={titleCase(e.status)} />
        </dl>
      </CareerSection>
      <CareerSection title="Match rules by stage" icon={<Swords className="w-3.5 h-3.5" />}>
        <ul className="px-4 py-3 space-y-1 text-sm text-white/75">
          {formatRuleLines(e.format).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
        </ul>
      </CareerSection>
      <CareerSection title="Result" icon={<Trophy className="w-3.5 h-3.5" />} accent="#ffd24a">
        {champion || mine ? (
          <div className="px-4 py-3 space-y-2 text-sm">
            {champion && <div><Label>Champion</Label><div className="font-black uppercase" style={{ ...OSWALD, color: "#ffd24a" }}>{champion.name}</div></div>}
            {mine && <div><Label>Your finish</Label><div className="font-black" style={{ ...OSWALD, color: "#fff" }}>{mine.champion ? "Champion" : stageLabel(mine.stageReached)} · {mine.wins}W {mine.losses}L · legs {mine.legsFor}–{mine.legsAgainst}</div></div>}
          </div>
        ) : <CareerEmptyState title="No result yet">Results appear once the event completes.</CareerEmptyState>}
        {e.status === "COMPLETED" && <div className="px-4 pb-3"><Link href={`/career/${saveId}/history`} className="career-btn career-btn-ghost">My Career history</Link></div>}
      </CareerSection>
    </div>
  );
}
const F = ({ label, value }: { label: string; value: string }) => <div className="min-w-0"><dt><Label>{label}</Label></dt><dd className="break-words" style={{ color: "#fff" }}>{value}</dd></div>;

/** Persisted A3 draw, one round at a time (works on phones; no client-side recomputation). */
function Draw({ detail, saveId }: { detail: EventDetail; saveId: string }) {
  const rounds = detail.draw.rounds;
  const humanRound = detail.draw.matches.filter(m => (m.a?.key === "HUMAN" || m.b?.key === "HUMAN")).reduce((r, m) => Math.max(r, m.round), 0);
  const [round, setRound] = useState(humanRound || Math.min(Math.max(detail.progress.currentRound, 1), rounds) || 1);
  const seeds = useMemo(() => new Map(detail.field.filter(f => f.seed).map(f => [f.participantKey, f.seed!])), [detail.field]);
  const list = detail.draw.matches.filter(m => m.round === round);
  return (
    <CareerSection title={`Draw · ${roundName(round, rounds)}`} icon={<Swords className="w-3.5 h-3.5" />}>
      <div className="px-3 pt-2"><Segmented label="Round" wrap value={String(round)} onChange={v => setRound(Number(v))}
        options={Array.from({ length: rounds }, (_, i) => ({ value: String(i + 1), label: roundName(i + 1, rounds) }))} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 p-3">
        {list.map(m => <MatchCard key={m.id} m={m} seeds={seeds} saveId={saveId} format={detail.event.format} />)}
      </div>
    </CareerSection>
  );
}
function MatchCard({ m, seeds, saveId, format }: { m: CareerMatch; seeds: Map<string, number>; saveId: string; format: EventDetail["event"]["format"] }) {
  const side = (p: CareerMatch["a"], legs: number | undefined) => {
    const won = p && m.winnerKey === p.key;
    const me = p?.key === "HUMAN";
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ background: me ? "rgba(255,0,92,0.12)" : undefined }}>
        {p && seeds.get(p.key) ? <span className="text-[0.6rem] w-5 text-center rounded" style={{ ...OSWALD, color: "#ffd24a", background: "rgba(255,210,74,0.12)" }} aria-label={`Seed ${seeds.get(p.key)}`}>{seeds.get(p.key)}</span> : <span className="w-5" aria-hidden />}
        <span className="flex-1 truncate text-sm" style={{ ...OSWALD, color: won ? "#fff" : p ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)", fontWeight: won ? 900 : 500 }}>{p ? (me ? "You" : p.name) : m.status === "BYE" ? "Bye" : "TBC"}</span>
        {legs !== undefined && <span className="tabular-nums font-black" style={{ ...OSWALD, color: won ? "#4ade80" : "rgba(255,255,255,0.5)" }}>{legs}</span>}
        {won && <span className="sr-only">winner</span>}
      </div>
    );
  };
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${m.status === "AWAITING_HUMAN" ? "rgba(255,210,74,0.5)" : "rgba(255,255,255,0.08)"}`, background: "rgba(255,255,255,0.02)" }}>
      {side(m.a, m.legs?.[0])}<div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />{side(m.b, m.legs?.[1])}
      <div className="px-2.5 py-1 text-[0.6rem] uppercase flex flex-wrap gap-2 justify-between" style={{ ...OSWALD, letterSpacing: "0.08em", color: "rgba(255,255,255,0.48)" }}>
        <span>{eventMatchFormatLine(format, m.bestOf)} · day {m.scheduledDay}</span><span>{m.status === "AWAITING_HUMAN" ? "Awaiting your match" : m.status === "WALKOVER" ? "Walkover" : m.status === "BYE" ? "Bye" : m.resultSource === "A2_SIMULATION" ? "Simulated" : m.resultSource === "QUICK_SIM" ? "Quick-sim" : m.resultSource === "HUMAN_LIVE" ? "Played live" : titleCase(m.status)}</span>
      </div>
      {m.status === "AWAITING_HUMAN" && (m.a?.key === "HUMAN" || m.b?.key === "HUMAN") && <Link className="career-btn career-btn-gold m-2 mt-0" href={`/career/${saveId}/matches/${m.id}/play`}><Play size={13} aria-hidden /> Play this match</Link>}
    </div>
  );
}
function MatchRow({ m, rounds, saveId, format }: { m: CareerMatch; rounds: number; saveId: string; format: EventDetail["event"]["format"] }) {
  const opp = m.a?.key === "HUMAN" ? m.b : m.a;
  const won = m.winnerKey === "HUMAN";
  const legs = m.legs ? (m.a?.key === "HUMAN" ? m.legs : [m.legs[1], m.legs[0]]) : null;
  return (
    <div className="px-4 py-2.5 border-b last:border-b-0 flex items-center gap-3 flex-wrap" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <span className="w-24 text-xs" style={{ ...OSWALD, color: "rgba(255,255,255,0.62)" }}>{roundName(m.round, rounds)}</span>
      <span className="flex-1 min-w-0 truncate text-sm" style={{ color: "#fff" }}>vs {opp?.name ?? (m.status === "BYE" ? "Bye" : "TBC")}</span>
      {legs && <span className="font-black tabular-nums" style={{ ...OSWALD, color: won ? "#4ade80" : "#ff005c" }}>{legs[0]}–{legs[1]}</span>}
      <span className="basis-full text-xs text-white/55">{eventMatchFormatLine(format, m.bestOf)}</span>
      {m.status === "AWAITING_HUMAN" && <Link className="career-btn career-btn-gold" href={`/career/${saveId}/matches/${m.id}/play`}><Play size={13} aria-hidden /> Play</Link>}
      <StatusBadge label={m.status === "AWAITING_HUMAN" ? "Awaiting your match" : m.winnerKey ? (won ? "Won" : "Lost") : titleCase(m.status)} tone={m.status === "AWAITING_HUMAN" ? "gold" : m.winnerKey ? (won ? "success" : "danger") : "neutral"} />
    </div>
  );
}
function Schedule({ detail }: { detail: EventDetail }) {
  const days = [...new Set(detail.draw.matches.map(m => m.scheduledDay))].sort((a, b) => a - b);
  return (
    <CareerSection title="Schedule" icon={<CalendarDays className="w-3.5 h-3.5" />}>
      <ul>{days.map(d => {
        const ms = detail.draw.matches.filter(m => m.scheduledDay === d);
        const rounds = [...new Set(ms.map(m => m.round))];
        return <li key={d} className="px-4 py-2 border-b last:border-b-0 flex items-center gap-3 text-sm" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <span className="w-20" style={{ ...OSWALD, color: "#fff" }}>Day {d}</span>
          <span className="flex-1" style={{ color: "rgba(255,255,255,0.7)" }}>{rounds.map(r => roundName(r, detail.draw.rounds)).join(", ")}</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>{ms.filter(m => ["COMPLETED", "WALKOVER", "BYE"].includes(m.status)).length}/{ms.length} done</span></li>;
      })}</ul>
    </CareerSection>
  );
}
function Players({ detail, saveId }: { detail: EventDetail; saveId: string }) {
  const presentation = usePresentation(saveId);
  const results = new Map(detail.results.map(r => [r.participantKey, r]));
  return (
    <CareerSection title="Field" icon={<Users className="w-3.5 h-3.5" />}>
      <ul className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        {detail.field.map(p => { const r = results.get(p.participantKey); return (
          <li key={p.participantKey} className="px-4 py-2 flex items-center gap-2 text-sm" style={{ background: p.participantKey === "HUMAN" ? "rgba(255,0,92,0.1)" : undefined }}>
            <span className="w-6 text-center text-xs" style={{ ...OSWALD, color: "#ffd24a" }}>{p.seed ?? ""}</span>
            <span className="career-field-shirt" aria-hidden="true">{p.kind === "HUMAN"
              ? presentation.data && <CareerShirt identity={presentation.data.identity} sponsors={presentation.data.placements} name="You" scale="compact" />
              : <CareerShirt playerId={p.participantKey} name={p.name} scale="compact" />}</span>
            <Flag code={p.nationality} />
            <span className="flex-1 truncate" style={{ ...OSWALD, color: "#fff" }}>{p.kind === "HUMAN" ? "You" : p.name}</span>
            <span className="hidden sm:inline text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>{titleCase(p.source)}</span>
            {r && <StatusBadge label={r.champion ? "Champion" : stageLabel(r.stageReached)} tone={r.champion ? "gold" : "neutral"} />}
            {p.status === "WITHDRAWN" && <StatusBadge label="Withdrawn" tone="muted" />}
          </li>); })}
      </ul>
    </CareerSection>
  );
}
function Prize({ saveId, detail }: { saveId: string; detail: EventDetail }) {
  const e = detail.event;
  const fin = useEventFinance(saveId, detail.event.id);
  const p = detail.event.finance;
  const actuals = fin.data?.actuals as {
    entryFeePaidPence?: number; travelPaidPence?: number; accommodationPaidPence?: number;
    sponsorCoveredPence?: number; refundsPence?: number; prizePence?: number;
    sponsorPaymentsPence?: number; sponsorEventPaymentsPence?: number;
    prizeAward?: { finishingPosition: number; cashAwardPence: number; rankingEligiblePence: number } | null;
  } | null | undefined;
  const award = actuals?.prizeAward ?? null;
  const completedByPlayer = e.status === "COMPLETED" && detail.results.some(result => result.participantKey === "HUMAN");
  const eventIncome = (actuals?.prizePence ?? 0) + (actuals?.sponsorPaymentsPence ?? 0) + (actuals?.refundsPence ?? 0);
  const playerCosts = (actuals?.entryFeePaidPence ?? 0) + (actuals?.travelPaidPence ?? 0) + (actuals?.accommodationPaidPence ?? 0);
  const eventNet = eventIncome - playerCosts;
  const eventSponsorPayment = actuals?.sponsorEventPaymentsPence ?? 0;
  const sponsorPerformanceBonus = Math.max(0, (actuals?.sponsorPaymentsPence ?? 0) - eventSponsorPayment);
  return (
    <CareerSection title="Prize & costs" icon={<Coins className="w-3.5 h-3.5" />} accent="#ffd24a">
      {fin.isLoading ? <CareerLoading /> : fin.error ? <CareerError error={fin.error} onRetry={() => fin.refetch()} /> : (
        <dl className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <F label="Winner's prize" value={p?.topPrizePence ? formatPence(p.topPrizePence) : "None"} />
          <F label="Ranking money" value={!e.capability.executable ? "None while unsupported" : p?.rankingEligible ? "Yes — counts for rankings" : "No — cash only"} />
          {award ? <><F label="Your prize" value={formatPence(award.cashAwardPence)} /><F label="Your ranking money" value={formatPence(award.rankingEligiblePence)} /></>
            : <F label="Your prize" value={detail.results.some(r => r.participantKey === "HUMAN") ? "£0" : "—"} />}
          {actuals ? <>
            <F label="Entry paid" value={formatPence(actuals.entryFeePaidPence)} /><F label="Travel paid" value={formatPence(actuals.travelPaidPence)} />
            <F label="Accommodation paid" value={formatPence(actuals.accommodationPaidPence)} /><F label="Sponsor covered" value={formatPence(actuals.sponsorCoveredPence)} />
            <F label="Refunds" value={formatPence(actuals.refundsPence)} /><F label="Sponsor payments" value={formatPence(actuals.sponsorPaymentsPence)} />
          </> : p ? <><F label="Entry fee (est.)" value={formatPence(p.entryFeePence)} /><F label="Travel + stay (est.)" value={formatPence(p.estimatedTravelPence + p.estimatedAccommodationPence)} /></> : null}
        </dl>
      )}
      {completedByPlayer && actuals && <section className="career-event-settlement" aria-label="Your completed event financial result">
        <header><span>POST-EVENT SETTLEMENT</span><strong data-negative={eventNet < 0}>
          {eventNet > 0 ? "+" : eventNet < 0 ? "−" : ""}{formatPence(Math.abs(eventNet))}
        </strong></header>
        <div className="career-event-settlement__grid">
          <div><small>Prize income</small><b>{formatPence(actuals.prizePence ?? 0)}</b></div>
          <div><small>Event sponsor pay</small><b>{formatPence(eventSponsorPayment)}</b></div>
          <div><small>Sponsor performance bonus</small><b>{formatPence(sponsorPerformanceBonus)}</b></div>
          <div><small>Refunds</small><b>{formatPence(actuals.refundsPence ?? 0)}</b></div>
          <div><small>Entry paid</small><b>−{formatPence(actuals.entryFeePaidPence ?? 0)}</b></div>
          <div><small>Travel paid</small><b>−{formatPence(actuals.travelPaidPence ?? 0)}</b></div>
          <div><small>Accommodation paid</small><b>−{formatPence(actuals.accommodationPaidPence ?? 0)}</b></div>
        </div>
        {!!actuals.sponsorCoveredPence && <p>Sponsor-covered costs: {formatPence(actuals.sponsorCoveredPence)} (paid directly, not counted again in your cash result).</p>}
        <small className="career-event-settlement__caption">Actual ledger income minus the costs you paid for this event.</small>
      </section>}
      {p?.prizePot && <p className="px-4 pb-1 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
        <strong style={{ color: "#fff" }}>Prize pot:</strong> {formatPence(p.prizePot.feePence)} from every player plus {formatPence(p.prizePot.housePence)} from the club
        {p.prizePot.entrants !== null ? ` — ${p.prizePot.entrants} players, ${formatPence(p.prizePot.feePence * p.prizePot.entrants + p.prizePot.housePence)} in the pot.`
          : ` — about ${formatPence(p.prizePot.feePence * p.prizePot.typicalField + p.prizePot.housePence)} on a typical night of ${p.prizePot.typicalField}. Half to the winner.`}</p>}
      {!actuals && worthIt(p) && <p className="career-worth px-4 pb-1 text-sm" data-tone={worthIt(p)!.tone}><strong>{worthIt(p)!.label}</strong> · {worthIt(p)!.detail}</p>}
      {p?.prizeBands && p.prizeBands.some(b => b.amountPence > 0) && <ul className="career-prize-ladder px-4 pb-2 text-xs">
        {p.prizeBands.filter(b => b.amountPence > 0).map(b => <li key={b.upToPosition}><span>{prizeStage(b.upToPosition)}</span><b>{formatPence(b.amountPence)}</b></li>)}
      </ul>}
      <EventMoneyHistory saveId={saveId} eventId={detail.event.id} />
      <p className="px-4 pb-3 text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>Prize bands by finishing position are set by the event's prize profile; amounts shown are the official figures.</p>
    </CareerSection>
  );
}
/** Your record at this event in earlier editions: visits, best finish, and money spent and won each time. */
function EventMoneyHistory({ saveId, eventId }: { saveId: string; eventId: string }) {
  const q = useEventHistory(saveId, eventId);
  const h = q.data;
  if (!h || !h.totals.visits) return null;
  const net = h.totals.netPence, sign = net > 0 ? "+" : net < 0 ? "−" : "";
  const finish = (v: { champion: boolean; stageReached: string }) => v.champion ? "Winner" : stageLabel(v.stageReached);
  return <div className="event-history px-4 pb-3">
    <p className="event-history__title">Your record here</p>
    <p className="event-history__sum">{h.totals.visits} visit{h.totals.visits === 1 ? "" : "s"}{h.totals.titles ? ` · ${h.totals.titles} title${h.totals.titles === 1 ? "" : "s"}` : ""}
      {" "}· spent {formatPence(h.totals.spentPence)} · won {formatPence(h.totals.wonPence)} <strong>({sign}{formatPence(Math.abs(net))})</strong>
      {h.best ? <> · best: {finish(h.best)} (season {h.best.season})</> : null}</p>
    <ul className="event-history__list">{h.visits.slice(0, 8).map(v => <li key={v.eventId}>
      <span>S{v.season} wk {v.week}</span><span>{finish(v)}</span><span>−{formatPence(v.spentPence)} / +{formatPence(v.wonPence)}</span></li>)}</ul>
  </div>;
}
const prizeStage = (upTo: number) => upTo === 1 ? "Winner" : upTo === 2 ? "Runner-up" : upTo === 4 ? "Semi-finalist" : upTo === 8 ? "Quarter-finalist" : `Last ${upTo}`;
function RankingTab({ saveId, detail, retired }: { saveId: string; detail: EventDetail; retired: boolean }) {
  const qual = useQualification(saveId, { eventId: detail.event.id }, !retired);
  const e = detail.event;
  const ev = qual.data?.events[0];
  return (
    <CareerSection title="Ranking & qualification" icon={<Trophy className="w-3.5 h-3.5" />} accent="#c084fc">
      <div className="px-4 py-3 space-y-2 text-sm">
        {!e.capability.executable && <div style={{ color: "rgba(255,255,255,0.75)" }}>This edition is intentionally benched and cannot be entered. It awards no ranking money or invented results.</div>}
        <div style={{ color: "rgba(255,255,255,0.75)" }}>{e.rankingCategory ? `${titleCase(e.rankingCategory)} — ranking-eligible prize money feeds the matching ranking lists.` : "Not a ranking event — prize money (if any) does not count towards rankings."}</div>
        {e.seedingPolicy.list && <div style={{ color: "rgba(255,255,255,0.75)" }}>Seeded from the {listLabel(e.seedingPolicy.list)} ({e.seedingPolicy.seeds} seeds) at the time of the draw.</div>}
        {retired ? null : qual.isLoading ? <CareerLoading /> : ev ? (
          <div><Label>How you qualify</Label>
            <ul className="mt-1 space-y-1">{routeLines(ev.routes).map((l, i) => <li key={i} className="flex gap-2"><span aria-hidden style={{ color: l.met ? TONES.success : TONES.muted }}>{l.met ? "✓" : "✗"}</span><span>{l.text}</span><span className="sr-only">{l.met ? "met" : "not met"}</span></li>)}</ul></div>
        ) : null}
        {qual.data?.rankings && Object.keys(qual.data.rankings).length > 0 && <div className="text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>Your positions: {Object.entries(qual.data.rankings).map(([l, p]) => `${listLabel(l)} ${ordinal(p)}`).join(" · ")}</div>}
      </div>
    </CareerSection>
  );
}
