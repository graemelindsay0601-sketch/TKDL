import { useState } from "react";
import { Award, GraduationCap, ListOrdered, Target } from "lucide-react";
import { useCalendar, useQSchool, useEnterEvent, errorMessage } from "../api";
import { ordinal, pathwayLabel, qSchoolState, TONES } from "../model";
import { CareerEmptyState, CareerError, CareerEventCard, CareerLoading, CareerSection, Label, OSWALD, Segmented, StatusBadge } from "../components";
import type { ShellContext } from "../shell";
import type { QSchoolPathwayView } from "../types";

/** Screen 5 — Q-School: two separate pathways, real stages, Order of Merit, card line and the allocation result. */
export function QSchoolPage({ ctx }: { ctx: ShellContext }) {
  const { save, retired } = ctx;
  const [season, setSeason] = useState(save.currentSeason);
  const q = useQSchool(save.id, season);
  const events = useCalendar(save.id, { scope: "WORLD", season, circuit: "Q_SCHOOL" });
  const enter = useEnterEvent(save.id);
  const [msg, setMsg] = useState<string | null>(null);
  const defaultPathway = q.data?.pathways.find(p => qSchoolState(p).stage !== "NOT_ENTERED")?.pathway ?? "UK_IRELAND";
  const [pathway, setPathway] = useState<string | null>(null);
  const active = pathway ?? defaultPathway;
  const view = q.data?.pathways.find(p => p.pathway === active);
  const pathwayEvents = (events.data?.events ?? []).filter(e => e.qSchool?.pathway === active);

  return (
    <div className="space-y-3">
      <section className="pdc-card p-4 md:p-5 relative overflow-hidden" style={{ borderColor: "rgba(255,210,74,0.3)" }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden style={{ background: "radial-gradient(70% 120% at 100% 0%, rgba(255,210,74,0.12), transparent 60%)" }} />
        <div className="relative flex items-start gap-3 flex-wrap">
          <GraduationCap className="w-6 h-6 shrink-0" style={{ color: "#ffd24a" }} aria-hidden />
          <div className="flex-1 min-w-0">
            <Label color="#ffd24a">The road to a Tour Card</Label>
            <h2 className="font-black uppercase leading-none" style={{ ...OSWALD, fontSize: "clamp(1.4rem, 4.5vw, 2rem)", color: "#fff" }}>Q-School · Season {season}</h2>
            <p className="text-xs mt-1.5 max-w-xl" style={{ color: "rgba(255,255,255,0.6)" }}>Two separate pathways. First Stage finishes earn a Final Stage place; each Final Stage day winner earns a Tour Card, and the rest go down the Order of Merit.</p>
          </div>
          <label className="flex items-center gap-2"><Label>Season</Label>
            <select value={season} onChange={e => setSeason(Number(e.target.value))} className="rounded-lg px-2 py-1.5 bg-black/40 border border-white/15 text-sm">
              {Array.from({ length: save.currentSeason }, (_, i) => save.currentSeason - i).map(s => <option key={s} value={s}>Season {s}</option>)}</select></label>
        </div>
      </section>
      {q.isLoading ? <div className="pdc-card"><CareerLoading label="Loading Q-School" /></div> : q.error || !q.data ? <CareerError error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <div className="pdc-card px-3 py-2.5"><Segmented label="Pathway" value={active} onChange={setPathway} options={q.data.pathways.map(p => ({ value: p.pathway, label: `${pathwayLabel(p.pathway)}${qSchoolState(p).stage !== "NOT_ENTERED" ? " ●" : ""}` }))} /></div>
          {view && <PathwayView view={view} />}
          <CareerSection title={`${pathwayLabel(active)} events`} icon={<Target className="w-3.5 h-3.5" />} accent="#ffd24a">
            {events.isLoading ? <CareerLoading /> : pathwayEvents.length ? pathwayEvents.map(e => <CareerEventCard key={e.id} event={e} saveId={save.id} retired={retired || season !== save.currentSeason}
              onEnter={retired || season !== save.currentSeason ? undefined : id => enter.mutate(id, { onSuccess: r => setMsg(r.entered ? "Entered — the whole stage series is booked." : `Refused: ${r.denials.join(", ")}`), onError: x => setMsg(errorMessage(x)) })} entering={enter.isPending} compact />)
              : <CareerEmptyState title="No Q-School events found" />}
            {msg && <p role="status" className="px-4 py-2 text-sm" style={{ color: "#fff" }}>{msg}</p>}
          </CareerSection>
          <p className="text-xs px-1" style={{ color: "rgba(255,255,255,0.4)" }}>Order of Merit tie-breaks: {q.data.tieBreaks.map(t => t.toLowerCase().replace(/_/g, " ")).join(" → ")}.</p>
        </>
      )}
    </div>
  );
}

function PathwayView({ view }: { view: QSchoolPathwayView }) {
  const state = qSchoolState(view);
  const mine = view.participant.orderOfMerit;
  const remaining = view.finalStage.days - view.finalStage.completed;
  const pointsGap = mine && view.cardLine.valueAtLinePoints !== null && !mine.insideCardLine ? Math.max(0, view.cardLine.valueAtLinePoints - mine.points) : null;
  return (
    <>
      {(state.stage === "CARD_WON_DIRECT" || state.stage === "CARD_WON_OOM" || state.stage === "NO_CARD") && (
        <div role="status" className="pdc-card px-4 py-4 flex items-center gap-3" style={{ borderColor: state.tone === "gold" ? "rgba(255,210,74,0.6)" : undefined, background: state.tone === "gold" ? "rgba(255,210,74,0.08)" : undefined }}>
          <Award className="w-7 h-7 shrink-0" style={{ color: TONES[state.tone] }} aria-hidden />
          <div><Label color={TONES[state.tone]}>Tour Card result</Label><div className="font-black uppercase" style={{ ...OSWALD, fontSize: "1.25rem", color: "#fff" }}>{state.label}</div></div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CareerSection title="Your Q-School" icon={<GraduationCap className="w-3.5 h-3.5" />} accent="#ffd24a">
          <dl className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt><Label>Status</Label></dt><dd><StatusBadge label={state.label} tone={state.tone} /></dd></div>
            <div><dt><Label>First Stage</Label></dt><dd style={{ color: "#fff" }}>{view.participant.firstStage.length ? view.participant.firstStage.map(f => `D${f.day}: ${ordinal(f.position)}`).join(" · ") : "—"}</dd></div>
            <div><dt><Label>Final Stage place</Label></dt><dd style={{ color: "#fff" }}>{view.participant.finalStageEntry ? (view.participant.finalStageEntry.route === "PROVIDER" ? "Exempt" : "Earned at First Stage") : "No"}</dd></div>
            <div><dt><Label>Final Stage days</Label></dt><dd style={{ color: "#fff" }}>{view.finalStage.completed}/{view.finalStage.days} played</dd></div>
            <div><dt><Label>Order of Merit</Label></dt><dd style={{ color: "#fff" }}>{mine ? `${ordinal(mine.position)} · ${mine.points} pts` : "—"}</dd></div>
            <div><dt><Label>Card line</Label></dt><dd style={{ color: mine?.insideCardLine ? TONES.success : "#fff" }}>{mine?.contenderPosition ? (mine.insideCardLine ? `Inside (${ordinal(mine.contenderPosition)} of ${view.cardLine.orderOfMeritCards})` : `Outside (${ordinal(mine.contenderPosition)})`) : "—"}</dd></div>
          </dl>
        </CareerSection>
        <CareerSection title="What you need" icon={<Target className="w-3.5 h-3.5" />} accent="#4ade80">
          <ul className="px-4 py-3 space-y-1.5 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
            <li>• {view.cardLine.orderOfMeritCards} Order of Merit cards{view.allocation ? ` were awarded` : " this year (plus a card for each Final Stage day winner)"}.</li>
            {!view.allocation && <li>• {remaining} Final Stage day{remaining === 1 ? "" : "s"} still to play.</li>}
            {mine && !view.allocation && (mine.insideCardLine ? <li>• You are currently inside the card line.</li>
              : <li>• {pointsGap !== null ? `${pointsGap} point${pointsGap === 1 ? "" : "s"} behind the current card line` : "Outside the current card line"} (points: champion 6, runner-up 5, semi 4, quarter 3, last 16 2, last 32 1).</li>)}
            {!mine && !view.participant.finalStageEntry && <li>• No Final Stage place in this pathway this season.</li>}
          </ul>
        </CareerSection>
      </div>
      <CareerSection title="Order of Merit" icon={<ListOrdered className="w-3.5 h-3.5" />} accent="#ffd24a">
        {view.standings.length === 0 ? <CareerEmptyState title="No Final Stage results yet">Standings appear after the first Final Stage day.</CareerEmptyState> : (
          <table className="career-table" aria-label="Q-School Order of Merit">
            <thead><tr><th scope="col">Pos</th><th scope="col">Player</th><th scope="col" style={{ textAlign: "right" }}>Pts</th><th scope="col" style={{ textAlign: "right" }}>Best day</th></tr></thead>
            <tbody>{view.standings.map(s => (
              <tr key={s.participantKey} data-me={s.participantKey === "HUMAN"}>
                <td className="font-black tabular-nums" style={OSWALD}>{s.position}</td>
                <td><span className="font-bold" style={OSWALD}>{s.participantKey === "HUMAN" ? "You" : s.name}</span>{s.dayWinner && <span className="ml-2"><StatusBadge label="Day winner — card" tone="gold" /></span>}
                  {view.allocation?.awards.some(a => a.participantKey === s.participantKey && a.route === "ORDER_OF_MERIT") && <span className="ml-2"><StatusBadge label="OoM card" tone="success" /></span>}</td>
                <td className="tabular-nums" style={{ textAlign: "right", ...OSWALD }}>{s.points}</td>
                <td className="tabular-nums" style={{ textAlign: "right" }}>{ordinal(s.bestDayFinish)}</td>
              </tr>))}</tbody>
          </table>
        )}
        {view.allocation && <p className="px-4 py-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Allocated in week {view.allocation.allocatedWeek}: {view.allocation.directCards} direct, {view.allocation.orderOfMeritCards} Order of Merit{view.allocation.unusedDirectCards ? ` (${view.allocation.unusedDirectCards} unused day card${view.allocation.unusedDirectCards > 1 ? "s" : ""} rolled into the OoM)` : ""}.</p>}
      </CareerSection>
    </>
  );
}
