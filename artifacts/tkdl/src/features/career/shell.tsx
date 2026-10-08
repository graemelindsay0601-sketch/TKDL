import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FastForward, Loader2, Lock, Swords, House, Map, CalendarDays, Globe2, UserRound, Bell, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAdvance, useCalendar, useCareerSave, useSaveLifecycle, useLiveSession, useCareerProfile, useSetCareerProfile, useLegacy, useActiveTournament, useFinance, useCareerLife, useSporting, errorMessage, errorStatus } from "./api";
import { CAREER_NAV, activeNavKey, advanceStopLabel, navLayerOf, weekLabel, ageOnDate, HOME_REGIONS, MINIMUM_CAREER_START_AGE } from "./model";
import { CareerError, CareerLoading, Label, OSWALD, SeasonProgress } from "./components";
import type { CareerSave, CalendarOverview } from "./types";

export type ShellContext = { save: CareerSave; overview: CalendarOverview | null; retired: boolean };

/**
 * Career shell: live situation header (name, season/week, swing, progress),
 * the three-layer navigation and the single "advance time" control. Children
 * receive the shared save + calendar overview so screens don't refetch them.
 */
export function CareerShell({ saveId, children }: { saveId: string; children: (ctx: ShellContext) => ReactNode }) {
  const [location]=useLocation();
  const save = useCareerSave(saveId);
  const week = save.data?.currentWeek ?? 1;
  const header = useCalendar(saveId, { scope: "WORLD", fromWeek: week, toWeek: week }, !!save.data);
  if (save.isLoading) return <CareerLoading label="Opening Career" />;
  if (save.error || !save.data) return <div className="space-y-3"><BackToSaves /><CareerError error={save.error ?? new Error("Career not found")} onRetry={() => save.refetch()} /></div>;
  const retired = save.data.status === "RETIRED";
  const overview = header.data?.overview ?? null;
  return (
    <div className={`career-root space-y-3 pb-10 ${/\/(tournaments|matches)\//.test(location)?"career-gameplay":""}`}>
      <a href="#career-content" className="career-skip">Skip to Career content</a>
      <CareerHeader save={save.data} overview={overview} retired={retired} />
      {!location.includes("/play")&&<CareerNav saveId={saveId} />}
      {!retired && <ProfileIncompleteBanner saveId={saveId} />}
      {retired && (
        <div role="status" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" }}>
          <Lock className="w-4 h-4 shrink-0" aria-hidden /> This Career is retired. Its history stays readable; nothing can be entered, advanced or signed.
        </div>
      )}
      {header.error && !overview ? (errorStatus(header.error) === 409 && !retired ? <InitializeCareer saveId={saveId} /> : <CareerError error={header.error} onRetry={() => header.refetch()} />)
        : header.isLoading ? <CareerLoading label="Loading Career world" /> : <main id="career-content" tabIndex={-1}>{children({ save: save.data, overview, retired })}</main>}
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
      <div className="career-header-tools"><WorldSearch saveId={save.id}/><CareerAttention saveId={save.id} retired={retired}/><Link href={`/career/${save.id}/guide`}>Career Guide</Link></div>
    </header>
  );
}

function HeaderAge({ saveId }: { saveId: string }) {
  const p = useCareerProfile(saveId).data;
  if (p?.status !== "COMPLETE") return null;
  return <>{` · ${p.careerDate} · Age ${p.age}`}{p.junior ? " · Junior" : ""}</>;
}

/** Time only moves through A3's retry-safe advance. A pending human match blocks it (honestly). */
function AdvanceControl({ save, pendingEventId, pendingMatchId, pendingCount }: { save: CareerSave; pendingEventId: string | null; pendingMatchId: string | null; pendingCount: number }) {
  const advance = useAdvance(save.id);
  const legacy=useLegacy(save.id);
  const tournament=useActiveTournament(save.id);
  const active=tournament.data?.tournaments.find(t=>!t.terminal);
  const [message, setMessage] = useState<string | null>(null);
  const live = useLiveSession(save.id, pendingMatchId);
  const resumable = !!live.data && (live.data.status === "BULL_UP" || live.data.status === "IN_PLAY");
  if(legacy.data?.pendingReview)return <Link className="career-btn career-btn-primary" href={`/career/${save.id}/my-career/history`}>Continue Season Review — before Season {save.currentSeason}</Link>;
  if(active)return <Link className="career-btn career-btn-primary" href={`/career/${save.id}/tournaments/${active.eventId}`}>Return to Tournament</Link>;
  if (pendingEventId) return (
    <Link href={pendingMatchId ? `/career/${save.id}/matches/${pendingMatchId}/play` : `/career/${save.id}/events/${pendingEventId}`}
      className="career-btn career-btn-gold w-full sm:w-auto" aria-label={resumable ? "Resume your match" : `${pendingCount > 1 ? `${pendingCount} matches are` : "Your match is"} waiting — play it now`}>
      <Swords className="w-4 h-4" aria-hidden /> {resumable ? "Resume match" : pendingCount > 1 ? `Play match (${pendingCount} waiting)` : "Play your match"}
    </Link>
  );
  return (
    <div className="flex flex-col items-stretch sm:items-end gap-1">
      <button className="career-btn career-btn-primary" title="Play simulated weeks until your next important date" disabled={advance.isPending||legacy.isLoading||tournament.isLoading||!!legacy.error||!!tournament.error}
        onClick={() => { setMessage(null); advance.mutate({ season: save.currentSeason, week: save.currentWeek, target: { kind: "NEXT_MEANINGFUL" } },
          { onSuccess: r => setMessage(`${advanceStopLabel(r.stop.reason)} — ${weekLabel(r.to.season, r.to.week)}`), onError: e => setMessage(errorMessage(e)) }); }}>
        {advance.isPending ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <FastForward className="w-4 h-4" aria-hidden />}
        {advance.isPending ? "Playing…" : "Continue Career"}
      </button>
      {(legacy.error||tournament.error)&&<CareerError error={legacy.error||tournament.error} onRetry={()=>{void legacy.refetch();void tournament.refetch();}}/>}
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
  const icons:Record<string,typeof House> = {HOME:House,MAP:Map,CALENDAR:CalendarDays,DARTS_WORLD:Globe2,MY_CAREER:UserRound};
  return (
    <nav aria-label="Career" className="career-navigation">
      <div className="career-primary-nav">
        {CAREER_NAV.map(section => {const Icon=icons[section.layer]??Globe2;return (
          <Link key={section.layer} href={`/career/${saveId}${section.path}`} className="career-nav-link justify-center"
            aria-current={layer.layer === section.layer ? (section.items.length === 1 ? "page" : "true") : undefined}><span className="career-destination-icon" aria-hidden><Icon size={18}/></span><span>{section.label}</span></Link>
        );})}
      </div>
      {layer.items.length > 1 && (
        <div className="career-context-nav" aria-label={`${layer.label} pages`} role="group">
          {layer.items.map(item => (
            <Link key={item.key} href={`/career/${saveId}${item.path}`} className="career-subnav-link" aria-current={active === item.key ? "page" : undefined}>{item.label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}

function WorldSearch({saveId}:{saveId:string}) {
  const [search,setSearch]=useState(""),[,navigate]=useLocation();
  return <form className="career-search" role="search" onSubmit={e=>{e.preventDefault();navigate(`/career/${saveId}/world/search?q=${encodeURIComponent(search)}`);}}>
    <label htmlFor={`world-search-${saveId}`}>Search the darts world</label><input id={`world-search-${saveId}`} type="search" maxLength={80} placeholder="Players, events, venues" value={search} onChange={e=>setSearch(e.target.value)}/><button className="career-btn career-btn-ghost">Search</button></form>;
}
export function CareerAttention({saveId,retired=false}:{saveId:string;retired?:boolean}) {
  const [open,setOpen]=useState(false);
  const t=useActiveTournament(saveId),legacy=useLegacy(saveId),finance=useFinance(saveId,open),life=useCareerLife(saveId,open),sporting=useSporting(saveId,open);
  const active=t.data?.tournaments.find(x=>!x.terminal),base=`/career/${saveId}`;
  const actions=!retired?[...(active?[{title:`Return to ${active.name}`,path:`${base}/tournaments/${active.eventId}`}]:[]),
    ...(legacy.data?.pendingReview?[{title:"Season Review waiting",path:`${base}/my-career/history`}]:[]),
    ...(finance.data?.availableOffers?[{title:"Sponsor decision available",path:`${base}/finances`}]:[])]:[];
  const panelId=`career-attention-panel-${saveId}`;
  const milestones=sporting.data?.recentMilestones.slice(0,2)??[];
  const news=life.data?.news.slice(0,Math.min(3,5-actions.length))??[];
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="career-attention-trigger" data-testid="button-career-attention" aria-expanded={open} aria-controls={panelId}>
        <Bell size={17} aria-hidden/><span>Attention</span>{actions.length>0&&<span className="career-inbox-count" title="Known actions — open to check all updates">{actions.length}</span>}
      </button>
    </PopoverTrigger>
    <PopoverContent id={panelId} className="career-attention-panel" side="bottom" align="end" sideOffset={10} collisionPadding={12} aria-labelledby={`${panelId}-title`}>
      <header className="career-attention-panel-header">
        <div><span className="career-eyebrow">Career updates</span><h2 id={`${panelId}-title`}>Attention</h2><p>Your next steps and recent activity.</p></div>
        <div className="career-attention-panel-tools">
          {actions.length>0&&<span className="career-attention-total" data-testid="text-career-attention-count">{actions.length} action{actions.length===1?"":"s"}</span>}
          <button type="button" className="career-attention-close" data-testid="button-close-career-attention" aria-label="Close Career attention" onClick={()=>setOpen(false)}><X size={17} aria-hidden/></button>
        </div>
      </header>
      <div className="career-attention-content">
        {(finance.isLoading||life.isLoading||sporting.isLoading)&&<p role="status" data-testid="status-career-attention-loading">Loading Career updates…</p>}
        <section className="career-attention-group" aria-labelledby={`${panelId}-actions`}>
          <h3 id={`${panelId}-actions`}>Action required</h3>
          {actions.length?actions.map((a,i)=><Link key={a.path} data-testid={`link-career-action-${i}`} href={a.path}>{a.title}</Link>):<p>{finance.isLoading?"Checking pending decisions…":"No pending action reported."}</p>}
        </section>
        <section className="career-attention-group" aria-labelledby={`${panelId}-career`}>
          <h3 id={`${panelId}-career`}>Career updates</h3>
          {milestones.map((m,i)=><Link key={`${m.kind}-${m.season}-${i}`} data-testid={`link-career-milestone-${i}`} href={`${base}/journey`}>{String(m.kind).replace(/_/g," ")} · Season {m.season}</Link>)}
          {sporting.data&&!milestones.length&&<p>No recent Career milestones.</p>}
        </section>
        <section className="career-attention-group" aria-labelledby={`${panelId}-world`}>
          <h3 id={`${panelId}-world`}>World news</h3>
          {news.map(n=><Link key={n.id} data-testid={`link-career-story-${n.id}`} href={`${base}/stories`}>{n.title}</Link>)}
          {life.data&&!news.length&&<p>No recent Darts World stories.</p>}
          <Link data-testid="link-explore-darts-world" href={`${base}/world`}>Explore Darts World</Link>
        </section>
        {(t.error||legacy.error||finance.error||life.error||sporting.error)&&<p className="career-attention-error" role="status">Attention is temporarily incomplete. Open the relevant Career page to retry.</p>}
      </div>
    </PopoverContent>
  </Popover>;
}
