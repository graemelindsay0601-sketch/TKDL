import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FastForward, Loader2, Lock, Swords, House, Map, CalendarDays, Globe2, UserRound, Bell, X,
  Activity, BookOpen, Gamepad2, Briefcase, Landmark, LayoutGrid, ListOrdered, Medal, ScrollText, Sparkles, Trophy, Users, Newspaper, Moon, Shield, Coins, Car, Star, Video, Radio, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCalendar, useCareerSave, useSaveLifecycle, useLiveSession, useCareerProfile, useSetCareerProfile, usePresentation, useCareerLegacySummary, useActiveTournament, useFinance, useCareerLife, useSporting, errorMessage, errorStatus } from "./api";
import { CAREER_NAV, milestoneLabel, activeNavKey, navLayerOf, weekLabel, ageOnDate, HOME_REGIONS, MINIMUM_CAREER_START_AGE, registrationAlerts } from "./model";
import { CareerError, CareerLoading, Label, OSWALD, SeasonProgress } from "./components";
import type { CareerSave, CalendarOverview } from "./types";
import { CareerShirt } from "./identity";
import { PlayBar } from "./play-bar";
import { useContinueCareer, ContinueOutcomeCard, ContinueProgress } from "./continue-career";
import { CareerStageBackdrop, PLATES, resolveAtmosphere, spectacleFor } from "./atmosphere";
import type { PlateKey } from "./atmosphere/model";

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
  const header = useCalendar(saveId, { scope: "WORLD", fromWeek: week, toWeek: week, view: "overview" }, !!save.data);
  if (save.isLoading) return <CareerLoading label="Opening Career" />;
  if (save.error || !save.data) return <div className="space-y-3"><BackToSaves /><CareerError error={save.error ?? new Error("Career not found")} onRetry={() => save.refetch()} /></div>;
  const retired = save.data.status === "RETIRED";
  const overview = header.data?.overview ?? null;
  // Play mode: a slim bar and a Menu instead of the full header and navigation.
  const focused = /^\/career\/[^/]+\/play\/?$/.test(location);
  return (
    <div className={`career-root space-y-3 ${/\/(tournaments|matches)\//.test(location)?"career-gameplay":""}`}>
      <a href="#career-content" className="career-skip">Skip to Career content</a>
      {focused ? <PlayBar save={save.data} /> : <>
        <CareerHeader save={save.data} overview={overview} retired={retired} />
        {!location.includes("/play")&&<CareerNav saveId={saveId} />}
      </>}
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
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    if (startedFor.current === saveId) return;
    startedFor.current = saveId;
    initialize.mutate(saveId);
  }, [initialize.mutate, saveId]);
  const retry = () => {
    startedFor.current = saveId;
    initialize.reset();
    initialize.mutate(saveId);
  };
  return (
    <div className="pdc-card px-4 py-4 space-y-2" role={initialize.error ? "alert" : "status"}>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
        {initialize.error ? "Career setup could not finish." : initialize.isPending ? "Setting up your Career world and calendar…" : "Preparing your Career…"}
      </p>
      {initialize.error && <>
        <p className="text-sm" style={{ color: "#ff8fb4" }}>{errorMessage(initialize.error)}</p>
        <button className="career-btn career-btn-primary" disabled={initialize.isPending} onClick={retry}>Retry setup</button>
      </>}
    </div>
  );
}

function BackToSaves() {
  return <Link href="/career" className="career-btn career-btn-ghost"><ArrowLeft className="w-4 h-4" aria-hidden /> Career saves</Link>;
}

function CareerHeader({ save, overview, retired }: { save: CareerSave; overview: CalendarOverview | null; retired: boolean }) {
  const pending = overview?.pendingHumanMatches ?? [];
  const presentation = usePresentation(save.id).data;
  // G1: the header stands on the player's real stage — club room as an amateur, the professional floor with a
  // Tour Card, archival grade once retired. Decorative only; nothing here names a venue or claims a result.
  const stage = resolveAtmosphere({ eventClass: save.hasTourCard ? "PROFESSIONAL_TOUR" : "GRASSROOTS" });
  return (
    <header className="pdc-card career-hero career-hero--stage px-4 py-3 space-y-2.5">
      <CareerStageBackdrop atmosphere={stage} spectacle={spectacleFor("ARRIVAL", stage.level)} documentary={retired} animate={false} eager className="career-hero__stage" />
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {presentation && <span className="career-hero__portrait" aria-hidden="true"><CareerShirt identity={presentation.identity} sponsors={presentation.placements} name={save.careerName ?? "Player"} scale="compact" /></span>}
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
        {!retired && <AdvanceControl save={save} pendingEventId={pending[0]?.eventId ?? null} pendingMatchId={pending[0]?.matchId ?? null} pendingCount={pending.length} hubAction={!!overview?.pendingTournamentActions?.length} nextEntry={overview?.nextHumanEntry ?? null} />}
      </div>
      <div className="career-header-tools">{!retired && <Link href={`/career/${save.id}/play`} className="career-header-play"><Gamepad2 aria-hidden /> Play mode</Link>}<WorldSearch saveId={save.id}/><CareerAttention saveId={save.id} season={save.currentSeason} week={save.currentWeek} retired={retired}/><Link href={`/career/${save.id}/guide`}>Career Guide</Link><Link href={`/career/${save.id}/health`}>Save health</Link></div>
    </header>
  );
}

function HeaderAge({ saveId }: { saveId: string }) {
  const p = useCareerProfile(saveId).data;
  if (p?.status !== "COMPLETE") return null;
  return <>{` · ${p.careerDate} · Age ${p.age}`}{p.junior ? " · Junior" : ""}</>;
}

/**
 * Time only moves through A3's retry-safe advance. A pending human match blocks it (honestly).
 * One button, one next step: a waiting match opens straight in the scorer, Continue Career opens
 * the match it stops for, and a finished tournament is filed away as the calendar continues.
 */
function AdvanceControl({ save, pendingEventId, pendingMatchId, pendingCount, hubAction, nextEntry }: { save: CareerSave; pendingEventId: string | null; pendingMatchId: string | null; pendingCount: number; hubAction: boolean; nextEntry: { name: string; week: number } | null }) {
  const seasonReview=useCareerLegacySummary(save.id);
  const tournament=useActiveTournament(save.id);
  const active=tournament.data?.tournaments.find(t=>!t.terminal);
  const go = useContinueCareer(save, nextEntry);
  const live = useLiveSession(save.id, pendingMatchId);
  const resumable = !!live.data && (live.data.status === "BULL_UP" || live.data.status === "IN_PLAY");
  if(seasonReview.data?.pendingReview)return <Link className="career-btn career-btn-primary" href={`/career/${save.id}/my-career/history`}>Continue Season Review — before Season {save.currentSeason}</Link>;
  if (pendingEventId) return (
    <Link href={pendingMatchId ? `/career/${save.id}/matches/${pendingMatchId}/play` : `/career/${save.id}/events/${pendingEventId}`}
      className="career-btn career-btn-gold w-full sm:w-auto" aria-label={resumable ? "Resume your match" : `${pendingCount > 1 ? `${pendingCount} matches are` : "Your match is"} waiting — play it now`}>
      <Swords className="w-4 h-4" aria-hidden /> {resumable ? "Resume match" : pendingCount > 1 ? `Play match (${pendingCount} waiting)` : "Play your match"}
    </Link>
  );
  if(active&&hubAction)return <Link className="career-btn career-btn-primary" href={`/career/${save.id}/tournaments/${active.eventId}`}>Return to Tournament</Link>;
  return (
    <div className="flex flex-col items-stretch sm:items-end gap-1">
      <button className="career-btn career-btn-primary" title={nextEntry ? `Play on to your next match: ${nextEntry.name}` : "Play simulated weeks until your next important date"} disabled={go.pending||seasonReview.isLoading||go.blocked||!!seasonReview.error}
        onClick={() => { void go.run(); }}>
        {go.pending ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <FastForward className="w-4 h-4" aria-hidden />}
        {go.pending ? "Playing…" : nextEntry ? "Play on to your match" : "Continue Career"}
      </button>
      {nextEntry && !go.pending && <span className="text-xs sm:text-right sm:max-w-[16rem]" style={{ color: "rgba(255,255,255,0.62)" }}>Booked: {nextEntry.name} · wk {nextEntry.week}</span>}
      {(seasonReview.error||tournament.error)&&<CareerError error={seasonReview.error||tournament.error} onRetry={()=>{void seasonReview.refetch();void tournament.refetch();}}/>}
      {go.pending && <ContinueProgress saveId={save.id} from={go.from} toEvent={nextEntry} />}
      {go.outcome && <ContinueOutcomeCard outcome={go.outcome} onClose={go.clear} />}
    </div>
  );
}

/**
 * Three layers — Home / My Career / Darts World — as one compact segmented row,
 * with the active layer's pages beneath it. Never more than four links per row,
 * so it fits a 390px phone without hidden overflow and without a second bottom bar
 * (TKDL's global mobile bar stays the app-level navigation).
 */
/** Small dartboard glyph for the Darts World destination (decorative, matches lucide stroke style). */
function DartboardIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.4"/>
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>;
}
/** Per-destination identity: accent, icon and the venue plate shown behind the active tab. Decorative only. */
const DESTINATIONS: Record<string, { icon: LucideIcon | typeof DartboardIcon; accent: string; plate: PlateKey }> = {
  HOME: { icon: House, accent: "#ff3d7f", plate: "pub-club" },
  MAP: { icon: Map, accent: "#4fc3f7", plate: "conference" },
  CALENDAR: { icon: CalendarDays, accent: "#ffb547", plate: "professional-floor" },
  NIGHTS: { icon: Moon, accent: "#e08a5b", plate: "pub-club" },
  DARTS_WORLD: { icon: DartboardIcon, accent: "#5ee39b", plate: "small-arena" },
  MY_CAREER: { icon: UserRound, accent: "#c99bff", plate: "historic-theatre" },
};
const SUB_ICONS: Record<string, LucideIcon> = {
  rankings: ListOrdered, players: Users, "world-events": Trophy, venues: Landmark, "world-history": ScrollText,
  nights: Moon, club: Shield, "money-matches": Coins, "road-trips": Car, "pro-am": Star, "cam-league": Video, streaming: Radio,
  overview: LayoutGrid, performance: Activity, achievements: Medal, "career-life": Sparkles, history: BookOpen, sponsors: Briefcase,
};
export function CareerNav({ saveId }: { saveId: string }) {
  const [location] = useLocation();
  const active = activeNavKey(location);
  const layer = navLayerOf(active);
  return (
    <nav aria-label="Career" className="career-navigation career-navigation--premium" style={{ ["--dest-accent" as string]: DESTINATIONS[layer.layer]?.accent ?? "#ff3d7f" }}>
      <div className="career-primary-nav">
        {CAREER_NAV.map(section => {const d=DESTINATIONS[section.layer]??DESTINATIONS.HOME,Icon=d.icon,plate=PLATES[d.plate]??PLATES.neutral,current=layer.layer === section.layer;return (
          <Link key={section.layer} href={`/career/${saveId}${section.path}`} className="career-nav-link justify-center"
            aria-label={section.label} style={{ ["--tab-accent" as string]: d.accent }}
            aria-current={current ? (section.items.length === 1 ? "page" : "true") : undefined}>
            {current && <img className="career-nav-plate" src={plate.src} alt="" aria-hidden="true" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.display = "none"; }} />}
            <span className="career-destination-icon" aria-hidden><Icon size={18}/></span>
            <span className="career-nav-label-full">{section.label}</span>
            <span className="career-nav-label-short">{section.layer === "DARTS_WORLD" ? "World" : section.layer === "MY_CAREER" ? "Career" : section.layer === "NIGHTS" ? "Nights" : section.label}</span>
          </Link>
        );})}
      </div>
      {layer.items.length > 1 && (
        <div className="career-context-nav" aria-label={`${layer.label} pages`} role="group">
          {layer.items.map(item => {const Sub=SUB_ICONS[item.key];return (
            <Link key={item.key} href={`/career/${saveId}${item.path}`} className="career-subnav-link" aria-current={active === item.key ? "page" : undefined}>{Sub && <Sub size={14} aria-hidden className="career-subnav-icon"/>}{item.label}</Link>
          );})}
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
export function CareerAttention({saveId,season,week,retired=false}:{saveId:string;season:number;week:number;retired?:boolean}) {
  const [open,setOpen]=useState(false);
  const t=useActiveTournament(saveId),seasonReview=useCareerLegacySummary(saveId),finance=useFinance(saveId,open),life=useCareerLife(saveId,open),sporting=useSporting(saveId,open);
  const entryCalendar=useCalendar(saveId,{scope:"AVAILABLE",season,fromWeek:week,toWeek:Math.min(52,week+1)},open&&!retired);
  const active=t.data?.tournaments.find(x=>!x.terminal),base=`/career/${saveId}`;
  const entryWindows=retired?[]:registrationAlerts(entryCalendar.data?.events??[],season,week);
  const actions=!retired?[...(active?[{title:`Return to ${active.name}`,path:`${base}/tournaments/${active.eventId}`}]:[]),
    ...(seasonReview.data?.pendingReview?[{title:"Season Review waiting",path:`${base}/my-career/history`}]:[]),
    ...(finance.data?.availableOffers?[{title:"Sponsor decision available",path:`${base}/finances`}]:[])]:[];
  const attentionCount=actions.length+entryWindows.length;
  const panelId=`career-attention-panel-${saveId}`;
  const milestones=sporting.data?.recentMilestones.slice(0,2)??[];
  const news=life.data?.news.slice(0,Math.min(3,5-attentionCount))??[];
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="career-attention-trigger" data-testid="button-career-attention" aria-expanded={open} aria-controls={panelId}>
        <Bell size={17} aria-hidden/><span>Attention</span>{attentionCount>0&&<span className="career-inbox-count" title="Known actions — open to check all updates">{attentionCount}</span>}
      </button>
    </PopoverTrigger>
    <PopoverContent id={panelId} className="career-attention-panel" side="bottom" align="end" sideOffset={10} collisionPadding={12} aria-labelledby={`${panelId}-title`}>
      <header className="career-attention-panel-header">
        <div><span className="career-eyebrow">Career updates</span><h2 id={`${panelId}-title`}>Attention</h2><p>Your next steps and recent activity.</p></div>
        <div className="career-attention-panel-tools">
          {attentionCount>0&&<span className="career-attention-total" data-testid="text-career-attention-count">{attentionCount} action{attentionCount===1?"":"s"}</span>}
          <button type="button" className="career-attention-close" data-testid="button-close-career-attention" aria-label="Close Career attention" onClick={()=>setOpen(false)}><X size={17} aria-hidden/></button>
        </div>
      </header>
      <div className="career-attention-content">
        {(finance.isLoading||life.isLoading||sporting.isLoading||entryCalendar.isLoading)&&<p role="status" data-testid="status-career-attention-loading">Loading Career updates…</p>}
        <section className="career-attention-group" aria-labelledby={`${panelId}-actions`}>
          <h3 id={`${panelId}-actions`}>Action required</h3>
          {actions.map((a,i)=><Link key={a.path} className="is-action" data-testid={`link-career-action-${i}`} href={a.path}><Bell size={14} aria-hidden/><span>{a.title}</span></Link>)}
          {entryWindows.slice(0,3).map(e=><Link key={e.id} className="is-action" data-testid={`link-registration-alert-${e.id}`} href={`${base}/events/${encodeURIComponent(e.id)}`}><CalendarDays size={14} aria-hidden/><span>{e.name}<small>Entry closes {e.registration.closesWeek===week?"this week":"next week"}</small></span></Link>)}
          {entryWindows.length>3&&<Link href={`${base}/calendar`}>View all {entryWindows.length} entry windows</Link>}
          {!attentionCount&&<p>{finance.isLoading||entryCalendar.isLoading?"Checking pending decisions and entry windows…":"No pending action reported."}</p>}
        </section>
        <section className="career-attention-group" aria-labelledby={`${panelId}-career`}>
          <h3 id={`${panelId}-career`}>Career updates</h3>
          {milestones.map((m,i)=><Link key={`${m.kind}-${m.season}-${i}`} data-testid={`link-career-milestone-${i}`} href={`${base}/journey`}><Trophy size={14} aria-hidden/><span>{milestoneLabel(m).title}</span><small>Season {m.season}</small></Link>)}
          {sporting.data&&!milestones.length&&<p>No recent Career milestones.</p>}
        </section>
        <section className="career-attention-group" aria-labelledby={`${panelId}-world`}>
          <h3 id={`${panelId}-world`}>World news</h3>
          {news.map(n=><Link key={n.id} data-testid={`link-career-story-${n.id}`} href={`${base}/stories`}><Newspaper size={14} aria-hidden/><span>{n.title}</span></Link>)}
          {life.data&&!news.length&&<p>No recent Darts World stories.</p>}
          <Link data-testid="link-explore-darts-world" href={`${base}/world`}>Explore Darts World</Link>
        </section>
        {(t.error||seasonReview.error||finance.error||life.error||sporting.error||entryCalendar.error)&&<p className="career-attention-error" role="status">Attention is temporarily incomplete. Open the relevant Career page to retry.</p>}
      </div>
    </PopoverContent>
  </Popover>;
}
