import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FastForward, Loader2, Lock, Swords } from "lucide-react";
import { useAdvance, useCalendar, useCareerSave, useSaveLifecycle, errorMessage, errorStatus } from "./api";
import { CAREER_NAV, activeNavKey, advanceStopLabel, weekLabel } from "./model";
import { CareerError, CareerLoading, Label, OSWALD, SeasonProgress } from "./components";
import type { CareerSave, CalendarOverview } from "./types";

export type ShellContext = { save: CareerSave; overview: CalendarOverview | null; retired: boolean };

/**
 * Career shell: live situation header (name, season/week, swing, progress),
 * the three-layer navigation and the single "advance time" control. Children
 * receive the shared save + calendar overview so screens don't refetch them.
 */
export function CareerShell({ saveId, children }: { saveId: string; children: (ctx: ShellContext) => ReactNode }) {
  const save = useCareerSave(saveId);
  const week = save.data?.currentWeek ?? 1;
  const header = useCalendar(saveId, { scope: "WORLD", fromWeek: week, toWeek: week }, !!save.data);
  if (save.isLoading) return <CareerLoading label="Opening Career" />;
  if (save.error || !save.data) return <div className="space-y-3"><BackToSaves /><CareerError error={save.error ?? new Error("Career not found")} onRetry={() => save.refetch()} /></div>;
  const retired = save.data.status === "RETIRED";
  const overview = header.data?.overview ?? null;
  return (
    <div className="career-root space-y-3 pb-10">
      <CareerHeader save={save.data} overview={overview} retired={retired} />
      <CareerNav saveId={saveId} />
      {retired && (
        <div role="status" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" }}>
          <Lock className="w-4 h-4 shrink-0" aria-hidden /> This Career is retired. Its history stays readable; nothing can be entered, advanced or signed.
        </div>
      )}
      {header.error && !overview ? (errorStatus(header.error) === 409 && !retired ? <InitializeCareer saveId={saveId} /> : <CareerError error={header.error} onRetry={() => header.refetch()} />)
        : header.isLoading ? <CareerLoading label="Loading Career world" /> : children({ save: save.data, overview, retired })}
    </div>
  );
}

/** A save whose world/calendar was never initialized (e.g. created before A6): one idempotent server initialize. */
function InitializeCareer({ saveId }: { saveId: string }) {
  const { initialize } = useSaveLifecycle();
  return (
    <div className="pdc-card px-4 py-4 space-y-2">
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>This Career's world has not been generated yet.</p>
      <button className="career-btn career-btn-primary" disabled={initialize.isPending} onClick={() => initialize.mutate(saveId)}>{initialize.isPending ? "Generating world…" : "Generate Career world"}</button>
      {initialize.error && <p role="alert" className="text-sm" style={{ color: "#ff8fb4" }}>{errorMessage(initialize.error)}</p>}
    </div>
  );
}

function BackToSaves() {
  return <Link href="/career" className="career-btn career-btn-ghost"><ArrowLeft className="w-4 h-4" aria-hidden /> Career saves</Link>;
}

function CareerHeader({ save, overview, retired }: { save: CareerSave; overview: CalendarOverview | null; retired: boolean }) {
  const pending = overview?.pendingHumanMatches ?? [];
  return (
    <header className="pdc-card px-4 py-3 space-y-2.5">
      <div className="flex items-start gap-3 flex-wrap">
        <Link href="/career" className="p-2 -ml-2 rounded-lg hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]" aria-label="Back to Career saves">
          <ArrowLeft className="w-4 h-4" style={{ color: "rgba(255,255,255,0.5)" }} />
        </Link>
        <div className="flex-1 min-w-0">
          <Label color="#ff005c">TKDL Career · Slot {save.slotNumber}</Label>
          <h1 className="font-black uppercase leading-none truncate" style={{ ...OSWALD, fontSize: "clamp(1.35rem, 4.5vw, 2rem)", color: "#fff", letterSpacing: "0.04em" }}>
            {save.careerName ?? "My Career"}
          </h1>
          <div className="text-xs mt-1" style={{ ...OSWALD, color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em" }}>
            {weekLabel(save.currentSeason, save.currentWeek)}{overview ? ` · ${overview.grouping.name}` : ""}
          </div>
        </div>
        {!retired && <AdvanceControl save={save} pendingEventId={pending[0]?.eventId ?? null} />}
      </div>
      <SeasonProgress week={save.currentWeek} groupings={overview?.groupings} current={overview?.grouping.key} />
    </header>
  );
}

/** Time only moves through A3's retry-safe advance. A pending human match blocks it (honestly). */
function AdvanceControl({ save, pendingEventId }: { save: CareerSave; pendingEventId: string | null }) {
  const advance = useAdvance(save.id);
  const [message, setMessage] = useState<string | null>(null);
  if (pendingEventId) return (
    <Link href={`/career/${save.id}/events/${pendingEventId}`} className="career-btn career-btn-gold" aria-label="Your match is waiting — open event">
      <Swords className="w-4 h-4" aria-hidden /> Your match
    </Link>
  );
  return (
    <div className="flex flex-col items-end gap-1">
      <button className="career-btn career-btn-primary" disabled={advance.isPending}
        onClick={() => { setMessage(null); advance.mutate({ season: save.currentSeason, week: save.currentWeek, target: { kind: "NEXT_MEANINGFUL" } },
          { onSuccess: r => setMessage(`${advanceStopLabel(r.stop.reason)} — ${weekLabel(r.to.season, r.to.week)}`), onError: e => setMessage(errorMessage(e)) }); }}>
        {advance.isPending ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <FastForward className="w-4 h-4" aria-hidden />}
        {advance.isPending ? "Playing…" : "Continue"}
      </button>
      {message && <span role="status" className="text-xs text-right max-w-[16rem]" style={{ color: "rgba(255,255,255,0.6)" }}>{message}</span>}
    </div>
  );
}

/** Three layers (Home / My Career / Darts World) as one scrollable row; works at 390px without a second bottom bar. */
export function CareerNav({ saveId }: { saveId: string }) {
  const [location] = useLocation();
  const active = activeNavKey(location);
  return (
    <nav aria-label="Career" className="pdc-card px-2 py-1.5">
      <div className="flex items-center gap-1 career-scroll-x no-scrollbar">
        {CAREER_NAV.map((section, i) => (
          <div key={section.layer} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span aria-hidden className="mx-1 h-5 w-px" style={{ background: "rgba(255,255,255,0.12)" }} />}
            {section.items.length > 1 && <span className="hidden md:inline px-1"><Label color="rgba(255,255,255,0.3)">{section.label}</Label></span>}
            {section.items.map(item => (
              <Link key={item.key} href={`/career/${saveId}${item.path}`} className="career-nav-link" aria-current={active === item.key ? "page" : undefined}>{item.label}</Link>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
