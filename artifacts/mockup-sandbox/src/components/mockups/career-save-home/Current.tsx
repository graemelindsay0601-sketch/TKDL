import { useState, type AnchorHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import {
  Activity, ArrowLeft, ArrowUpRight, Award, Bell, BookOpen, Briefcase, CalendarDays, ChevronRight,
  CircleDollarSign, FastForward, Gamepad2, Globe2, House, LayoutGrid, Map,
  Medal, Moon, Search, Shield, Sparkles, Star, Target, TrendingUp, Trophy, UserRound, Users,
} from "lucide-react";
import "./_group.css";

/**
 * Isolated baseline extracted from CareerShell + HomePage + NextMove.
 * API, auth and continue/entry mutations are represented by fixed local save data;
 * all links are same-document anchors so this preview never leaves the saved-home screen.
 */
const save = {
  id: "career-save-01",
  careerName: "Ayrshire Debut",
  playerName: "Morgan Campbell",
  slot: 1,
  season: 1,
  week: 1,
  age: 24,
  balance: "£1,250",
  home: "Kilbirnie",
};

const primaryNav = [
  { title: "Home", icon: House, color: "#ff3d7f", active: true },
  { title: "Map", icon: Map, color: "#4fc3f7" },
  { title: "Calendar", icon: CalendarDays, color: "#ffb547" },
  { title: "Nights Out", icon: Moon, color: "#e08a5b" },
  { title: "Darts World", icon: Globe2, color: "#5ee39b" },
  { title: "My Career", icon: UserRound, color: "#c99bff" },
];

const weeks = [
  { day: "Mon", detail: "Free", state: "open" },
  { day: "Tue", detail: "Club night", state: "booked" },
  { day: "Wed", detail: "Free", state: "open" },
  { day: "Thu", detail: "Rest", state: "quiet" },
  { day: "Fri", detail: "Open event", state: "open" },
  { day: "Sat", detail: "Free", state: "open" },
  { day: "Sun", detail: "Rest", state: "quiet" },
];

function LocalLink({ children, className = "", ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href="#career-home" className={className} {...props}>{children}</a>;
}

function CareerHeader() {
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  return (
    <>
      <a className="csh-skip" href="#career-home">Skip to Career content</a>
      <header className="csh-header">
        <div className="csh-header__stage" aria-hidden="true">
          <span className="csh-header__orb csh-header__orb--red" />
          <span className="csh-header__orb csh-header__orb--gold" />
          <span className="csh-header__dart-mark"><i /><b /></span>
        </div>
        <div className="csh-header__main">
          <div className="csh-header__identity">
            <LocalLink className="csh-back" aria-label="Back to Career saves"><ArrowLeft size={17} /></LocalLink>
            <LocalLink className="csh-overview" aria-label="Career overview"><House size={15} /><span>Overview</span></LocalLink>
            <div className="csh-header__name">
              <div className="csh-micro-labels"><span>TKDL</span><b>Career</b><i>· Slot {save.slot}</i></div>
              <h1>{save.careerName}</h1>
              <p>Season {save.season} · Week {save.week} · Opening Swing · Age {save.age}</p>
            </div>
          </div>
          <button className="csh-continue career-btn career-btn-primary" type="button">
            <FastForward size={15} aria-hidden /> Continue Career
          </button>
        </div>
        <div className="csh-tools">
          <button className="csh-attention" type="button" aria-expanded={attentionOpen} onClick={() => setAttentionOpen(v => !v)}>
            <Bell size={16} aria-hidden /> Attention <span>2</span>
          </button>
          <button type="button" className="csh-sections-trigger" aria-expanded={sectionsOpen} onClick={() => setSectionsOpen(v => !v)}>
            <LayoutGrid size={15} aria-hidden /> Career sections
          </button>
          <LocalLink className="csh-play"><Gamepad2 size={16} aria-hidden /> Play mode</LocalLink>
          <form className="csh-search" onSubmit={event => event.preventDefault()}>
            <label htmlFor="csh-search">Search the darts world</label>
            <input id="csh-search" placeholder="Players, events, venues" />
            <button type="submit">Search</button>
          </form>
          <LocalLink>Career Guide</LocalLink>
          <LocalLink>Save health</LocalLink>
        </div>
        {attentionOpen && <aside className="csh-popover">
          <strong>Career updates</strong>
          <p>Two entry windows are open this week. Your first event is ready to choose.</p>
          <LocalLink>Review updates <ArrowUpRight size={14} /></LocalLink>
        </aside>}
        {sectionsOpen && <aside className="csh-popover csh-popover--sections">
          <strong>Career sections</strong>
          <div><LocalLink>Overview</LocalLink><LocalLink>Calendar</LocalLink><LocalLink>Rankings</LocalLink><LocalLink>History</LocalLink></div>
        </aside>}
      </header>
      <nav className="csh-navigation" aria-label="Career">
        <div className="csh-primary-nav">
          {primaryNav.map(({ title, icon: Icon, color, active }) => (
            <LocalLink key={title} className={`csh-nav-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}
              style={{ "--tab-accent": color } as CSSProperties}>
              <span className="csh-nav-icon"><Icon size={17} aria-hidden /></span><span>{title}</span>
            </LocalLink>
          ))}
        </div>
      </nav>
    </>
  );
}

function WelcomeChecklist() {
  return (
    <section className="csh-welcome" aria-labelledby="csh-welcome-title">
      <div className="csh-welcome__heading"><Sparkles size={18} aria-hidden /><h3 id="csh-welcome-title">Your first season</h3><span>0 of 6</span></div>
      <p>You start as an amateur at your local club with {save.balance}. Here’s how to get going.</p>
      <ol>
        <li data-next="true"><span className="csh-tick" /><div><b>Pick your first event</b><small>Choose one below and enter it. Local events near home are cheap and a good place to start.</small></div></li>
        <li><span className="csh-tick" /><div><b>Play your first event</b></div></li>
        <li><span className="csh-tick" /><div><b>Finish your first week</b></div></li>
        <li><span className="csh-tick" /><div><b>Win some prize money</b></div></li>
        <li><span className="csh-tick" /><div><b>Try a night out</b></div></li>
        <li><span className="csh-tick" /><div><b>See your routes to a Tour Card</b></div></li>
      </ol>
    </section>
  );
}

function NextMove() {
  const [week, setWeek] = useState(1);
  const [message, setMessage] = useState("");
  return (
    <section className="csh-next panel" aria-labelledby="next-move-title">
      <div className="csh-next__kicker"><i aria-hidden="true" /> Play</div>
      <div className="csh-next__heading">
        <div><span className="csh-eyebrow">CAREER HOME · SEASON 1 / WEEK 1</span><h2 id="next-move-title">Your next move</h2></div>
        <span className="csh-next__index">01 <i /> NEXT DECISION</span>
      </div>

      <WelcomeChecklist />
      <div className="csh-pick-lead">
        <div className="csh-pick-lead__copy">
          <span className="csh-pick-lead__eyebrow"><Target size={14} /> FIRST STEP</span>
          <strong>Choose your opening event</strong>
          <span>Local events near home are a good place to start.</span>
        </div>
        <span className="csh-cost"><small>CAREER BALANCE</small><b>{save.balance}</b></span>
      </div>
      <div className="csh-subhead">
        <span>Pick an event to play</span>
        <LocalLink className="csh-inline-link">Full calendar <CalendarDays size={14} /></LocalLink>
      </div>

      <div className="csh-week-planner" aria-label={`Week ${week} plan`}>
        <div className="csh-week-planner__tabs" role="tablist" aria-label="Plan week">
          {[1, 2].map(value => <button type="button" key={value} role="tab" aria-selected={week === value} onClick={() => setWeek(value)}>
            {value === 1 ? "This week" : "Next week"} <small>Wk {value}</small>
          </button>)}
        </div>
        <div className="csh-week-planner__days">
          {weeks.map((item, index) => <button type="button" key={item.day} data-state={item.state} aria-label={`${item.day}: ${item.detail}`}
            onClick={() => setMessage(`${item.day} · ${item.detail}`)}>
            <span>{item.day}</span><b>{item.detail}</b>
          </button>)}
        </div>
        <div className="csh-agenda">
          <div><b>Tue</b><span>Club night · Kilbirnie Darts Club</span><small>Home club social night</small></div>
          <div><b>Fri</b><span>North Ayrshire Open</span><small>Week 1 · £8 entry · about £14 estimated travel</small></div>
        </div>
      </div>
      <div className="csh-event-card">
        <div className="csh-event-card__art" aria-hidden="true">
          <span className="csh-board"><i /><b /><em /></span><span className="csh-oche" />
          <span className="csh-event-card__art-label">LOCAL CIRCUIT <i /> SCOTLAND</span>
        </div>
        <div className="csh-event-card__content">
          <div className="csh-event-meta"><span>WEEK 1 · FRIDAY</span><span className="csh-status">ENTRY OPEN</span></div>
          <h3>North Ayrshire Open</h3>
          <p>Grassroots · Kilbirnie · Local open</p>
          <div className="csh-event-card__facts"><span>ENTRY FEE <b>£8</b></span><span>EST. TRAVEL <b>£14</b></span><span>TOP PRIZE <b>£120</b></span></div>
          <div className="csh-event-card__actions">
            <button className="career-btn career-btn-primary" type="button" onClick={() => setMessage("Entry review is available in the full Career save.")}>
              Review event <ArrowUpRight size={14} aria-hidden />
            </button>
            <span>Entry is optional · check schedule and cost before committing</span>
          </div>
        </div>
      </div>
      {message && <p className="csh-interaction-note" role="status">{message}</p>}
      <p className="csh-next__foot">Nothing booked yet. Choose an event when registration and your schedule work.</p>
      <button type="button" className="csh-skip-ahead" onClick={() => setMessage("Continue is safely stubbed in this static preview.")}>
        <FastForward size={15} aria-hidden /> Skip ahead to the next date
      </button>
    </section>
  );
}

function CareerPageHero() {
  return (
    <section className="csh-page-hero" aria-label="Career headquarters">
      <div className="csh-hero-stage">
        <div className="csh-hero-stage__scene" aria-hidden="true"><span className="csh-stage-lamp" /><span className="csh-stage-board" /><span className="csh-stage-floor" /></div>
        <span className="csh-watermark" aria-hidden="true">S01 · W01</span>
        <div className="csh-hero-copy">
          <p className="csh-hero-kicker"><i />Career headquarters · Season 1 / Week 1</p>
          <h2>{save.playerName}</h2>
          <p className="csh-hero-subtitle">{save.home} · Amateur · Age {save.age}</p>
          <div className="csh-hero-actions">
            <LocalLink className="career-btn career-btn-primary"><CalendarDays size={15} aria-hidden /> Open calendar</LocalLink>
            <LocalLink className="career-btn career-btn-ghost"><TrendingUp size={15} aria-hidden /> Rankings</LocalLink>
          </div>
        </div>
        <div className="csh-shirt-wrap" aria-hidden="true">
          <img src="/__mockup/images/tkdl-premium-kit-redline.webp" alt="" />
          <span>LOCAL CLUB<br />PLAYER</span>
        </div>
      </div>
      <dl className="csh-hero-stats">
        <div><dt>World rank</dt><dd>Unranked</dd></div>
        <div><dt>Tour Card</dt><dd>No Tour Card</dd><small>Win one at Q-School or on the Challenger Tour</small></div>
        <div><dt>Career balance</dt><dd>{save.balance}</dd><small>£1,250 available</small></div>
        <div><dt>Sponsor</dt><dd>Self-funded</dd></div>
      </dl>
    </section>
  );
}

function Section({ icon: Icon, title, accent, children }: { icon: typeof Target; title: string; accent: string; children: ReactNode }) {
  return <section className="csh-section" style={{ "--section-accent": accent } as CSSProperties}>
    <header><Icon size={17} aria-hidden /><h3>{title}</h3><LocalLink>View <ArrowUpRight size={13} /></LocalLink></header>
    {children}
  </section>;
}

function MoreCareer() {
  return (
    <details className="csh-more">
      <summary>More about your Career <span>Guidance, route ahead, goals, schedule and results</span></summary>
      <div className="csh-more__body">
        <div className="csh-guidance"><span className="csh-eyebrow">CAREER GUIDE · GETTING STARTED</span><h3>Every route starts somewhere.</h3>
          <p>Play local events, learn your schedule and build experience. Qualification, rankings and progress come from the Career world.</p>
          <LocalLink>Read Career guidance <ArrowUpRight size={14} /></LocalLink>
        </div>
        <div className="csh-pathway-strip"><span><i /> LOCAL &amp; AMATEUR</span><b>Club events</b><ChevronRight /><b>County circuit</b><ChevronRight /><b>National events</b><ChevronRight /><b>Q-School</b><ChevronRight /><b>Tour Card</b></div>
        <Section icon={Target} title="The route ahead" accent="#8dc9bc">
          <div className="csh-section-body"><strong>Your first milestone</strong><p>Enter and complete a local event to start building a verified record. Qualification is based on event results and eligibility.</p></div>
        </Section>
        <Section icon={Sparkles} title="Career Compass" accent="#dbb866">
          <div className="csh-section-body csh-compass"><span className="csh-eyebrow">NEAR-TERM PREFERENCE</span><strong>Build experience close to home</strong><p>Your main ambition: win your first event.</p><LocalLink>Focus &amp; goals <ArrowUpRight size={13} /></LocalLink></div>
        </Section>
        <div className="csh-two-col">
          <Section icon={CalendarDays} title="Entry windows" accent="#86b8ec"><div className="csh-list-row"><b>North Ayrshire Open</b><span>Week 1 · Registration open</span></div><div className="csh-list-row"><b>West Scotland Ranking Event</b><span>Week 3 · Entry opens soon</span></div></Section>
          <Section icon={CalendarDays} title="Your schedule" accent="#84c5b2"><div className="csh-section-body"><strong>No entered commitments nearby</strong><p>Qualified does not mean entered. Choose an event when registration and your schedule work.</p></div></Section>
        </div>
        <div className="csh-two-col">
          <Section icon={Medal} title="Recent results" accent="#d8b76a"><div className="csh-empty">Your first finished event will appear here with its verified result.</div></Section>
          <Section icon={Award} title="Latest milestones" accent="#c9a96e"><div className="csh-empty">Your first ranking, Tour Card and other big moments will show here.</div></Section>
        </div>
        <div className="csh-two-col">
          <Section icon={Activity} title="Recent changes" accent="#82a9d0"><div className="csh-empty">Important changes and season reviews will show here.</div></Section>
          <Section icon={Globe2} title="Darts world" accent="#7ebbd3"><div className="csh-list-row"><b>World rankings refresh each week</b><span>Explore events, players and venues.</span></div></Section>
        </div>
      </div>
    </details>
  );
}

export function Current() {
  return (
    <div className="csh-app career-root">
      <CareerHeader />
      <main id="career-home" className="csh-home">
        <NextMove />
        <CareerPageHero />
        <aside className="csh-sponsor-alert"><span><Briefcase size={17} /><b>Self-funded Career</b><small>No sponsor decision is waiting.</small></span><LocalLink>Finances <ArrowUpRight size={14} /></LocalLink></aside>
        <section className="csh-pathway panel">
          <div><span className="csh-eyebrow">ROUTES THROUGH DARTS</span><h2>Pathway tracker</h2><p>These routes can overlap. Choosing one does not close the others; DartCast is a parallel route, not a sporting qualification.</p></div>
          <div className="csh-pathway__cards">
            <article><Map size={17} /><span>SPORTING ROUTE</span><h3>Local &amp; amateur</h3><p>Open for entry: North Ayrshire Open · week 1.</p></article>
            <article><Shield size={17} /><span>SPORTING ROUTE</span><h3>County &amp; national</h3><p>County and national selection status is not yet reported.</p></article>
            <article><Users size={17} /><span>SPORTING ROUTE</span><h3>Modus &amp; series</h3><p>No series event is listed in this calendar window.</p></article>
            <article><Star size={17} /><span>PARALLEL ROUTE</span><h3>DartCast</h3><p>Your streaming pathway is available alongside sporting progress.</p></article>
            <article><Trophy size={17} /><span>PROFESSIONAL ROUTE</span><h3>Tour Card</h3><p>No Tour Card held. Q-School and Challenger routes are shown as they become available.</p></article>
          </div>
        </section>
        <MoreCareer />
        <footer className="csh-footer"><span><CircleDollarSign size={14} /> Static Career save preview</span><span><BookOpen size={14} /> Local-only interactions</span></footer>
      </main>
    </div>
  );
}
