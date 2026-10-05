import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarDays, Coins, MapPin, Swords, Trophy, Users } from "lucide-react";
import { useEnterEvent, useEvent, useEventFinance, useQualification, useWithdrawEvent, errorMessage } from "../api";
import { circuitLabel, denialLabel, eventDateLabel, eventLifecycle, formatLabel, formatPence, listLabel, ordinal, roundName, routeLines, stageLabel, tierStyle, titleCase, TONES, isJuniorEvent, ageReason } from "../model";
import { CareerEmptyState, CareerError, CareerLoading, CareerSection, ConfirmButton, Flag, JuniorBadge, Label, OSWALD, Segmented, StatusBadge, TierBadge } from "../components";
import type { ShellContext } from "../shell";
import type { CareerMatch, EventDetail } from "../types";
import { MatchBoundaryNotice } from "./match-boundary";

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
  const tabs: { value: Tab; label: string }[] = [{ value: "OVERVIEW", label: "Overview" }];
  if (detail.draw.matches.length) tabs.push({ value: "DRAW", label: "Draw" }, { value: "SCHEDULE", label: "Schedule" });
  if (myMatches.length) tabs.push({ value: "MY_MATCHES", label: "My matches" });
  if (detail.field.length) tabs.push({ value: "PLAYERS", label: `Players ${detail.field.length}` });
  tabs.push({ value: "PRIZE", label: "Prize" }, { value: "RANKING", label: "Ranking" });
  const [tab, setTab] = useState<Tab>("OVERVIEW");

  return (
    <div className="space-y-3">
      {!palace && <Link href={`/career/${save.id}/calendar`} className="career-btn career-btn-ghost"><ArrowLeft className="w-4 h-4" aria-hidden /> Calendar</Link>}
      <section className="pdc-card overflow-hidden relative" style={{ borderColor: `${tier.accent}${tier.emphasis >= 4 ? "66" : "33"}` }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden style={{ background: `radial-gradient(80% 140% at 100% 0%, ${tier.accent}${tier.emphasis >= 4 ? "26" : "12"}, transparent 60%)` }} />
        <div className="relative p-4 md:p-5 space-y-2">
          <div className="flex flex-wrap items-center gap-2"><TierBadge tier={e.presentation.tier} />{isJuniorEvent(e) && <JuniorBadge />}<StatusBadge label={life.label} tone={life.tone} />
            {ageReason(e) && <StatusBadge label={ageReason(e)!} tone="muted" />}
            {e.qSchool && <StatusBadge label={`Q-School ${e.qSchool.stage === "FIRST" ? "First" : "Final"} Stage · Day ${e.qSchool.day}`} tone="gold" />}</div>
          <h1 className="font-black uppercase leading-none" style={{ ...OSWALD, fontSize: `clamp(1.5rem, ${4 + tier.emphasis * 0.4}vw, ${2 + tier.emphasis * 0.18}rem)`, color: palace ? "#ffe79a" : "#fff" }}>{e.name}</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
            <span>{circuitLabel(e.circuit)} · {titleCase(e.classification)}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" aria-hidden />{e.venue.name}, {e.venue.city} <Flag code={e.venue.country} /></span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" aria-hidden />Season {e.season} · {eventDateLabel(e)}</span>
            <span>{formatLabel(e.format)}</span>
          </div>
        </div>
      </section>

      {life.key === "UNSUPPORTED" && (
        <div role="status" className="pdc-card px-4 py-3 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
          <strong style={OSWALD}>Not playable yet.</strong> The Career engine currently runs 501 double-out legs-format knockouts only. This event's format ({formatLabel(e.format)}) is
          {e.status === "CANCELLED" ? " recorded as cancelled — no field, draw or results exist, and none have been invented." : " kept in the calendar and will be cancelled when it starts; it cannot be entered."}
        </div>
      )}
      <Link href={`/career/${save.id}/tournaments/${e.id}`} className="career-btn career-btn-gold"><Trophy className="w-4 h-4" aria-hidden/> Tournament Hub</Link>
      {awaiting && <MatchBoundaryNotice saveId={save.id} eventId={e.id} />}
      {!awaiting && <EntryActions ctx={ctx} detail={detail} />}

      <Segmented<Tab> label="Event sections" value={tab} onChange={setTab} options={tabs} wrap />
      {tab === "OVERVIEW" && <Overview detail={detail} saveId={save.id} />}
      {tab === "DRAW" && <Draw detail={detail} />}
      {tab === "SCHEDULE" && <Schedule detail={detail} />}
      {tab === "MY_MATCHES" && <CareerSection title="My matches" icon={<Swords className="w-3.5 h-3.5" />}>{myMatches.map(m => <MatchRow key={m.id} m={m} rounds={detail.draw.rounds} />)}</CareerSection>}
      {tab === "PLAYERS" && <Players detail={detail} />}
      {tab === "PRIZE" && <Prize saveId={save.id} detail={detail} />}
      {tab === "RANKING" && <RankingTab saveId={save.id} detail={detail} retired={retired} />}
    </div>
  );
}

function EntryActions({ ctx, detail }: { ctx: ShellContext; detail: EventDetail }) {
  const e = detail.event, h = e.human;
  const enter = useEnterEvent(ctx.save.id);
  const withdraw = useWithdrawEvent(ctx.save.id);
  const [msg, setMsg] = useState<string | null>(null);
  if (ctx.retired || !h) return null;
  const entered = h.entryStatus && h.entryStatus !== "WITHDRAWN" && !["COMPLETED", "CANCELLED"].includes(e.status);
  const locked = ["DRAW_PENDING", "DRAWN", "IN_PROGRESS"].includes(e.status);
  const f = e.finance;
  if (!h.canEnter && !entered && !h.denials.length) return null;
  return (
    <div className="pdc-card px-4 py-3 space-y-2">
      {h.canEnter ? (
        <div className="flex flex-wrap items-center gap-3">
          <button className="career-btn career-btn-primary" disabled={enter.isPending} onClick={() => enter.mutate(e.id, { onSuccess: r => setMsg(r.entered ? "Entry confirmed." : `Entry refused: ${r.denials.map(denialLabel).join(", ")}`), onError: x => setMsg(errorMessage(x)) })}>
            {enter.isPending ? "Entering…" : f && f.estimatedPlayerCostPence > 0 ? `Enter · ${formatPence(f.estimatedPlayerCostPence)}` : "Enter"}</button>
          {f && <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>Entry fee {formatPence(f.entryFeePence)}{f.entryFeeBasis === "PER_SERIES" ? " (whole series)" : ""} charged now · travel {formatPence(f.estimatedTravelPence + f.estimatedAccommodationPence)} reserved, charged in the week you travel</span>}
        </div>
      ) : entered ? (
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge label={h.entryStatus === "CONFIRMED" ? "In the field" : "Entered"} tone="success" />
          <ConfirmButton label={locked ? "Withdraw (concede)" : "Withdraw"} confirmLabel="Withdraw" danger busy={withdraw.isPending}
            description={locked ? "The field is locked: withdrawing concedes your remaining matches as walkovers. Late withdrawals are not refunded." : "Withdraw before entries close. The refund depends on this event's refund policy (A4)."}
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
          <F label="Entries" value={`Weeks ${e.registration.opensWeek}–${e.registration.closesWeek}`} />
          <F label="Ranking category" value={e.rankingCategory ? titleCase(e.rankingCategory) : "None"} />
          <F label="Seeding" value={e.seedingPolicy.list ? `${e.seedingPolicy.seeds} seeds · ${listLabel(e.seedingPolicy.list)}` : "Unseeded draw"} />
          <F label="Progress" value={detail.draw.matches.length ? `${detail.progress.completedMatches}/${detail.progress.totalMatches} matches` : "No draw yet"} />
          <F label="Status" value={titleCase(e.status)} />
        </dl>
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
function Draw({ detail }: { detail: EventDetail }) {
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
        {list.map(m => <MatchCard key={m.id} m={m} seeds={seeds} />)}
      </div>
    </CareerSection>
  );
}
function MatchCard({ m, seeds }: { m: CareerMatch; seeds: Map<string, number> }) {
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
      <div className="px-2.5 py-1 text-[0.6rem] uppercase flex justify-between" style={{ ...OSWALD, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)" }}>
        <span>Best of {m.bestOf} · day {m.scheduledDay}</span><span>{m.status === "AWAITING_HUMAN" ? "Awaiting your match" : m.status === "WALKOVER" ? "Walkover" : m.status === "BYE" ? "Bye" : m.resultSource === "A2_SIMULATION" ? "Simulated" : m.resultSource === "HUMAN_LIVE" ? "Played live" : titleCase(m.status)}</span>
      </div>
    </div>
  );
}
function MatchRow({ m, rounds }: { m: CareerMatch; rounds: number }) {
  const opp = m.a?.key === "HUMAN" ? m.b : m.a;
  const won = m.winnerKey === "HUMAN";
  const legs = m.legs ? (m.a?.key === "HUMAN" ? m.legs : [m.legs[1], m.legs[0]]) : null;
  return (
    <div className="px-4 py-2.5 border-b last:border-b-0 flex items-center gap-3 flex-wrap" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <span className="w-24 text-xs" style={{ ...OSWALD, color: "rgba(255,255,255,0.62)" }}>{roundName(m.round, rounds)}</span>
      <span className="flex-1 min-w-0 truncate text-sm" style={{ color: "#fff" }}>vs {opp?.name ?? (m.status === "BYE" ? "Bye" : "TBC")}</span>
      {legs && <span className="font-black tabular-nums" style={{ ...OSWALD, color: won ? "#4ade80" : "#ff005c" }}>{legs[0]}–{legs[1]}</span>}
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
function Players({ detail }: { detail: EventDetail }) {
  const results = new Map(detail.results.map(r => [r.participantKey, r]));
  return (
    <CareerSection title="Field" icon={<Users className="w-3.5 h-3.5" />}>
      <ul className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        {detail.field.map(p => { const r = results.get(p.participantKey); return (
          <li key={p.participantKey} className="px-4 py-2 flex items-center gap-2 text-sm" style={{ background: p.participantKey === "HUMAN" ? "rgba(255,0,92,0.1)" : undefined }}>
            <span className="w-6 text-center text-xs" style={{ ...OSWALD, color: "#ffd24a" }}>{p.seed ?? ""}</span>
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
  const award = (fin.data?.actuals as { prizeAward?: { finishingPosition: number; cashAwardPence: number; rankingEligiblePence: number } | null } | null)?.prizeAward ?? null;
  const actuals = fin.data?.actuals as Record<string, number> | null | undefined;
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
      <p className="px-4 pb-3 text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>Prize bands by finishing position are set by the event's prize profile; amounts shown are the authoritative A4 figures.</p>
    </CareerSection>
  );
}
function RankingTab({ saveId, detail, retired }: { saveId: string; detail: EventDetail; retired: boolean }) {
  const qual = useQualification(saveId, { eventId: detail.event.id }, !retired);
  const e = detail.event;
  const ev = qual.data?.events[0];
  return (
    <CareerSection title="Ranking & qualification" icon={<Trophy className="w-3.5 h-3.5" />} accent="#c084fc">
      <div className="px-4 py-3 space-y-2 text-sm">
        {!e.capability.executable && <div style={{ color: "rgba(255,255,255,0.75)" }}>This format cannot run in the Career engine yet, so it is cancelled when it starts and awards no ranking money. Qualifying for it is still recorded as a factual milestone.</div>}
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
