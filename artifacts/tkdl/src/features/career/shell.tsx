import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FastForward, Loader2, Lock, Swords } from "lucide-react";
import { useAdvance, useCalendar, useCareerSave, useSaveLifecycle, useLiveSession, useCareerProfile, useSetCareerProfile, errorMessage, errorStatus } from "./api";
import { CAREER_NAV, activeNavKey, advanceStopLabel, navLayerOf, weekLabel, ageOnDate, HOME_REGIONS, MINIMUM_CAREER_START_AGE } from "./model";
import { CareerError, CareerLoading, Label, OSWALD, SeasonProgress } from "./components";
import type { CareerSave, CalendarOverview } from "./types";
import { CareerBetaAccess } from "@/components/career-beta-access";

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
      <CareerBetaAccess />
      <CareerHeader save={save.data} overview={overview} retired={retired} />
      <CareerNav saveId={saveId} />
      {!retired && <ProfileIncompleteBanner saveId={saveId} />}
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

/**
 * A6.5: saves created before Career identity existed have no date of birth
 * (PROFILE_INCOMPLETE). Browsing stays open; entering events, advancing time and
 * starting matches are blocked server-side until the DOB is set once.
 */
function ProfileIncompleteBanner({ saveId }: { saveId: string }) {
  const profile = useCareerProfile(saveId);
  const set = useSetCareerProfile(saveId);
  const [dob, setDob] = useState("");
  const [home, setHome] = useState("");
  if (profile.data?.status !== "PROFILE_INCOMPLETE") return null;
  const start = profile.data.careerStartDate ?? `${new Date().getUTCFullYear()}-01-01`;
  const startAge = dob ? ageOnDate(dob, start) : null;
  const tooYoung = startAge !== null && startAge < MINIMUM_CAREER_START_AGE;
  return (
    <section role="region" aria-label="Complete your Career profile" className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,210,74,0.07)", border: "1px solid rgba(255,210,74,0.45)" }}>
      <div><Label color="#ffd24a">Profile incomplete</Label>
        <p className="text-sm mt-1" style={{ color: "#fff" }}>This Career was created before ages existed. Set your date of birth to keep playing — entering events, continuing the calendar and starting matches wait until you do. It can only be set once.</p></div>
      <form className="flex flex-col sm:flex-row sm:items-end gap-2" onSubmit={e => { e.preventDefault(); if (dob && !tooYoung) set.mutate({ dateOfBirth: dob, ...(home ? { homeLocality: home } : {}) }); }}>
        <label className="flex flex-col gap-1"><Label>Date of birth</Label>
          <input type="date" required value={dob} max={start} onChange={e => setDob(e.target.value)} aria-invalid={tooYoung || undefined}
            className="rounded-lg px-3 py-2 text-sm bg-black/40 border border-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]" /></label>
        {!profile.data.homeLocality && <label className="flex flex-col gap-1"><Label>Home region</Label>
          <select value={home} onChange={e => setHome(e.target.value)} className="rounded-lg px-3 py-2 text-sm bg-black/40 border border-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]">
            <option value="">Keep default (Ayrshire)</option>{HOME_REGIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select></label>}
        <button type="submit" className="career-btn career-btn-gold" disabled={!dob || tooYoung || set.isPending}>{set.isPending ? "Saving…" : "Save date of birth"}</button>
      </form>
      <p className="text-xs" style={{ color: tooYoung ? "#ff8fb4" : "rgba(255,255,255,0.62)" }} role="status">
        {startAge === null ? `This Career's time began on ${start}; you must have been at least ${MINIMUM_CAREER_START_AGE} then.`
          : tooYoung ? `You would have been ${startAge} when this Career began — the minimum is ${MINIMUM_CAREER_START_AGE}.` : `You started this Career aged ${startAge}.`}
      </p>
      {set.error && <p role="alert" className="text-sm" style={{ color: "#ff8fb4" }}>{errorMessage(set.error)}</p>}
    </section>
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
    <header className="pdc-card career-hero px-4 py-3 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Link href="/career" className="p-2 -ml-2 rounded-lg hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]" aria-label="Back to Career saves">
            <ArrowLeft className="w-4 h-4" style={{ color: "rgba(255,255,255,0.62)" }} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 whitespace-nowrap"><Label color="#3d8bff">TKDL</Label><Label color="#ff005c">Career</Label><Label>· Slot {save.slotNumber}</Label></div>
            <h1 className="font-black uppercase leading-tight break-words" style={{ ...OSWALD, fontSize: "clamp(1.3rem, 4.5vw, 2rem)", color: "#fff", letterSpacing: "0.04em" }}>
              {save.careerName ?? "My Career"}
            </h1>
            <div className="text-xs mt-0.5" style={{ ...OSWALD, color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em" }}>
              {weekLabel(save.currentSeason, save.currentWeek)}{overview ? ` · ${overview.grouping.name}` : ""}<HeaderAge saveId={save.id} />
            </div>
          </div>
        </div>
        {!retired && <AdvanceControl save={save} pendingEventId={pending[0]?.eventId ?? null} pendingMatchId={pending[0]?.matchId ?? null} pendingCount={pending.length} />}
      </div>
      <SeasonProgress week={save.currentWeek} groupings={overview?.groupings} current={overview?.grouping.key} />
    </header>
  );
}

function HeaderAge({ saveId }: { saveId: string }) {
  const p = useCareerProfile(saveId).data;
  if (p?.status !== "COMPLETE") return null;
  return <>{` · Age ${p.age}`}{p.junior ? " · Junior" : ""}</>;
}

/** Time only moves through A3's retry-safe advance. A pending human match blocks it (honestly). */
function AdvanceControl({ save, pendingEventId, pendingMatchId, pendingCount }: { save: CareerSave; pendingEventId: string | null; pendingMatchId: string | null; pendingCount: number }) {
  const advance = useAdvance(save.id);
  const [message, setMessage] = useState<string | null>(null);
  const live = useLiveSession(save.id, pendingMatchId);
  const resumable = !!live.data && (live.data.status === "BULL_UP" || live.data.status === "IN_PLAY");
  if (pendingEventId) return (
    <Link href={pendingMatchId ? `/career/${save.id}/matches/${pendingMatchId}/play` : `/career/${save.id}/events/${pendingEventId}`}
      className="career-btn career-btn-gold w-full sm:w-auto" aria-label={resumable ? "Resume your match" : `${pendingCount > 1 ? `${pendingCount} matches are` : "Your match is"} waiting — play it now`}>
      <Swords className="w-4 h-4" aria-hidden /> {resumable ? "Resume match" : pendingCount > 1 ? `Play match (${pendingCount} waiting)` : "Play your match"}
    </Link>
  );
  return (
    <div className="flex flex-col items-stretch sm:items-end gap-1">
      <button className="career-btn career-btn-primary" title="Play simulated weeks until your next important date" disabled={advance.isPending}
        onClick={() => { setMessage(null); advance.mutate({ season: save.currentSeason, week: save.currentWeek, target: { kind: "NEXT_MEANINGFUL" } },
          { onSuccess: r => setMessage(`${advanceStopLabel(r.stop.reason)} — ${weekLabel(r.to.season, r.to.week)}`), onError: e => setMessage(errorMessage(e)) }); }}>
        {advance.isPending ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <FastForward className="w-4 h-4" aria-hidden />}
        {advance.isPending ? "Playing…" : "Continue"}
      </button>
      {message && <span role="status" className="text-xs sm:text-right sm:max-w-[16rem]" style={{ color: "rgba(255,255,255,0.7)" }}>{message}</span>}
    </div>
  );
}

/**
 * Three layers — Home / My Career / Darts World — as one compact segmented row,
 * with the active layer's pages beneath it. Never more than four links per row,
 * so it fits a 390px phone without hidden overflow and without a second bottom bar
 * (TKDL's global mobile bar stays the app-level navigation).
 */
export function CareerNav({ saveId }: { saveId: string }) {
  const [location] = useLocation();
  const active = activeNavKey(location);
  const layer = navLayerOf(active);
  return (
    <nav aria-label="Career" className="pdc-card career-nav px-2 py-1.5 space-y-1">
      <div className="grid grid-cols-3 gap-1">
        {CAREER_NAV.map(section => (
          <Link key={section.layer} href={`/career/${saveId}${section.items[0].path}`} className="career-nav-link justify-center"
            aria-current={layer.layer === section.layer ? (section.items.length === 1 ? "page" : "true") : undefined}>{section.label}</Link>
        ))}
      </div>
      {layer.items.length > 1 && (
        <div className="flex gap-1 career-scroll-x no-scrollbar border-t pt-1" style={{ borderColor: "rgba(255,255,255,0.06)" }} aria-label={`${layer.label} pages`} role="group">
          {layer.items.map(item => (
            <Link key={item.key} href={`/career/${saveId}${item.path}`} className="career-subnav-link" aria-current={active === item.key ? "page" : undefined}>{item.label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}
