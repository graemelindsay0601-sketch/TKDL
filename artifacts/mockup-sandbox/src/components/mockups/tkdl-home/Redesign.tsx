import React, { useState } from "react";
import "./_group.css";
import "./Redesign.css";
import {
  ArrowDown, ArrowRight, ArrowUp, Award, BookOpen, Building2, CalendarDays,
  CircuitBoard, Coins, Dumbbell, Flame, Ghost, History, MessageSquare,
  Minus, Pin, Plus, Radio, Swords, Target, ThumbsUp, Trophy, Users, Zap, Skull,
  Star,
} from "lucide-react";

type PulseItem = {
  category: "league" | "achievements" | "community" | "tour";
  title: string;
  subtitle: string;
  time: string;
  fresh?: boolean;
};

const standings = [
  { id: 1, place: 1, movement: 1, name: "Callum Reid", nickname: "The Kilbirnie King", points: 186, tier: "GOLD" },
  { id: 2, place: 2, movement: 0, name: "Jamie McLean", nickname: "The Marksman", points: 154, tier: "GOLD", me: true },
  { id: 3, place: 3, movement: 2, name: "Morgan Fraser", nickname: "", points: 128, tier: "SILVER" },
  { id: 4, place: 4, movement: -1, name: "Aileen Stewart", nickname: "", points: 96, tier: "SILVER" },
  { id: 5, place: 5, movement: 1, name: "Ross Campbell", nickname: "", points: 73, tier: "BRONZE" },
];

const matches = [
  { winner: "Callum Reid", loser: "Jamie McLean", time: "18 min ago", detail: "501 · Best of 5", points: "+8", elo: "ELO +12" },
  { winner: "Jamie McLean", loser: "Ross Campbell", time: "1 hr ago", detail: "501 · Best of 5", points: "+6", elo: "ELO +8" },
  { winner: "Morgan Fraser", loser: "Aileen Stewart", time: "4 hrs ago", detail: "501 · Best of 3", points: "+6", elo: "ELO +9" },
  { winner: "Jamie McLean", loser: "Morgan Fraser", time: "22 hrs ago", detail: "501 · Best of 5", points: "+8", elo: "ELO +11" },
];

const pulseFeed: PulseItem[] = [
  { category: "league", title: "Callum Reid moved into first place after a 3–1 win", subtitle: "Standings updated", time: "18m", fresh: true },
  { category: "achievements", title: "Jamie McLean unlocked the Four on the Spin achievement", subtitle: "Achievement earned", time: "54m", fresh: true },
  { category: "community", title: "Aileen Stewart shared a match-night photo", subtitle: "Off the Oche", time: "3h" },
  { category: "tour", title: "Morgan Fraser completed the Quarter-Final", subtitle: "Classic Tour", time: "7h" },
];

const modes = [
  { label: "Practice", href: "/practice", icon: Dumbbell },
  { label: "Master-501", href: "/master501", icon: Zap },
  { label: "Doubles", href: "/leaderboard?mode=doubles", icon: Users },
  { label: "Shift Wars", href: "/leaderboard?mode=shiftwars", icon: Building2 },
  { label: "Boss Battle", href: "/boss-battle", icon: Skull },
  { label: "Board Curse", href: "/board-curse", icon: Ghost },
  { label: "Shadow League", href: "/shadow-league", icon: Trophy },
  { label: "Tour", href: "/tour", icon: Star },
  { label: "Shadow Bot", href: "/shadow-bot", icon: CircuitBoard },
  { label: "Community", href: "/community", icon: MessageSquare },
];

function PreviewLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return <a className={className} href={href} onClick={(event) => event.preventDefault()}>{children}</a>;
}

function DartboardMark() {
  return (
    <svg className="tkdl-board-mark" viewBox="0 0 220 220" aria-hidden="true">
      <path d="M110 8v204M8 110h204M38 38l144 144M182 38 38 182M84 13l52 194M13 84l194 52M136 13 84 207M207 84 13 136" stroke="#bba575" strokeWidth=".7" opacity=".54" />
      <circle cx="110" cy="110" r="102" fill="#171113" stroke="#d5ba7a" strokeWidth="2" />
      <circle cx="110" cy="110" r="92" fill="none" stroke="#735a3a" strokeWidth="1" />
      <circle cx="110" cy="110" r="80" fill="none" stroke="#a92231" strokeWidth="7" />
      <circle cx="110" cy="110" r="72" fill="none" stroke="#beaa7c" strokeWidth="1.2" />
      <circle cx="110" cy="110" r="54" fill="none" stroke="#32272a" strokeWidth="13" />
      <circle cx="110" cy="110" r="46" fill="none" stroke="#a88e5c" strokeWidth="1.4" />
      <circle cx="110" cy="110" r="30" fill="none" stroke="#a92231" strokeWidth="7" />
      <circle cx="110" cy="110" r="22" fill="none" stroke="#d2b86f" strokeWidth="1.5" />
      <circle cx="110" cy="110" r="8" fill="#a8202e" stroke="#f0d48a" strokeWidth="2" />
    </svg>
  );
}

export function Redesign() {
  const [pulseFilter, setPulseFilter] = useState("All");
  const [liked, setLiked] = useState(false);
  const [activeTab, setActiveTab] = useState<"table" | "matches">("table");
  const visiblePulse = pulseFilter === "All" ? pulseFeed : pulseFeed.filter((item) => item.category.toLowerCase() === pulseFilter.toLowerCase());

  return (
    <main className="tkdl-redesign">
      <div className="tkdl-grain" />
      <header className="tkdl-masthead">
        <PreviewLink href="/" className="tkdl-brand">
          <span className="tkdl-brand-mark"><Target size={18} /></span>
          <span><strong>TKDL</strong><small>Tesco Kitchen Darts League</small></span>
        </PreviewLink>
        <div className="tkdl-season-lockup"><span className="tkdl-live-pip" /> Season 8 <i /> The Winter Series</div>
        <PreviewLink href="/account" className="tkdl-user">
          <span className="tkdl-user-initials">JM</span>
          <span><strong>Jamie McLean</strong><small>PLAYER PROFILE</small></span>
          <ArrowRight size={15} />
        </PreviewLink>
      </header>

      <section className="tkdl-welcome">
        <div className="tkdl-welcome-copy">
          <p className="tkdl-eyebrow">SEASON 8 <span>—</span> THE WINTER SERIES</p>
          <div className="tkdl-viewer-rank">YOUR STANDING <span>02 / 24 ACTIVE</span></div>
          <h1>Jamie<br /><em>McLean.</em></h1>
          <div className="tkdl-signature">THE MARKSMAN <i /> GOLD TIER</div>
          <p className="tkdl-welcome-note">Four wins in a row. 32 points between you and first place.</p>
          <div className="tkdl-hero-statline">
            <span><b>154</b><small>POINTS</small></span><i />
            <span><b>1376</b><small>ELO</small></span><i />
            <span><b>26<span>–</span>12</b><small>W / L</small></span>
            <span className="tkdl-hero-streak"><Flame size={13} /> 4 WIN STREAK</span>
          </div>
          <div className="tkdl-actions">
            <PreviewLink href="/submit" className="tkdl-button tkdl-button-gold"><Plus size={16} /> Log your next match</PreviewLink>
            <PreviewLink href="/practice" className="tkdl-button tkdl-button-outline"><Dumbbell size={15} /> Practice</PreviewLink>
            <PreviewLink href="/play" className="tkdl-button tkdl-button-quiet">Match scorer <ArrowRight size={13} /></PreviewLink>
          </div>
        </div>
        <div className="tkdl-art">
          <div className="tkdl-board-halo" />
          <DartboardMark />
          <div className="tkdl-art-label"><span>32 PTS</span><b>TO THE TOP</b><small>CALLUM REID · 186</small></div>
          <div className="tkdl-dart" aria-hidden="true"><span /></div>
        </div>
        <div className="tkdl-match-ribbon">
          <span><i className="tkdl-live-pip" /> TONIGHT’S MATCH TO WATCH</span>
          <strong>Callum Reid <b>VS</b> Morgan Fraser</strong>
          <small>A place in the season final is on the line.</small>
          <PreviewLink href="/leaderboard">Match Centre <ArrowRight size={13} /></PreviewLink>
        </div>
      </section>

      <section className="tkdl-for-you">
        <div className="tkdl-section-head">
          <div><p className="tkdl-eyebrow">ONE THING TO CATCH UP ON</p><h2>From around the league</h2></div>
          <span className="tkdl-count">PERSONAL TO YOU</span>
        </div>
        <div className="tkdl-personal-row">
          <PreviewLink href="/tkdl-live" className="tkdl-broadcast-feature">
            <div className="tkdl-feature-icon"><Radio size={17} /></div><div><small>TKDL LIVE · NEW EDITION</small><strong>The Week in Kilbirnie</strong><span>Latest broadcast, ready when you are.</span></div><b>Watch now <ArrowRight size={14} /></b>
          </PreviewLink>
          <div className="tkdl-personal-links">
            <PreviewLink href="/account?tab=achievements"><Award size={15} /><span><b>Trophy case</b><small>Four on the Spin · Checkout Artist</small></span><ArrowRight size={13} /></PreviewLink>
            <PreviewLink href="/account?tab=cosmetics"><Coins size={15} /><span><b>Wallet · 240 coins</b><small>Obsidian name style · Target Icon</small></span><ArrowRight size={13} /></PreviewLink>
            <PreviewLink href="/tour/18"><Star size={15} /><span><b>Resume your Tour</b><small>Road to the Oche · Professional</small></span><ArrowRight size={13} /></PreviewLink>
          </div>
        </div>
      </section>

      <section className="tkdl-lower-grid">
        <div className="tkdl-panel tkdl-pulse">
          <div className="tkdl-panel-header">
            <div><p className="tkdl-eyebrow"><span className="tkdl-live-pip" /> AROUND THE LEAGUE</p><h2>League Pulse</h2></div>
            <div className="tkdl-filters">{["All", "League", "Tour", "Achievements", "Community"].map((filter) => <button key={filter} className={pulseFilter === filter ? "selected" : ""} onClick={() => setPulseFilter(filter)}>{filter}</button>)}</div>
          </div>
          <div className="tkdl-feed">
            {visiblePulse.map((item) => <article key={item.title} className={item.fresh ? "is-fresh" : ""}>
              <span className={`tkdl-feed-symbol ${item.category}`}><PulseIcon category={item.category} /></span>
              <div className="tkdl-feed-copy"><strong>{item.title}</strong><small>{item.category} <i>·</i> {item.subtitle} <i>·</i> {item.time}</small></div>
              {item.category === "community" && <button className={`tkdl-like ${liked ? "is-liked" : ""}`} aria-label="Like community post" onClick={() => setLiked(!liked)}><ThumbsUp size={14} />{liked ? "1" : ""}</button>}
              {item.fresh && <span className="tkdl-new-tag">NEW</span>}
            </article>)}
            {visiblePulse.length === 0 && <div className="tkdl-empty">No {pulseFilter.toLowerCase()} updates just now.</div>}
          </div>
          <PreviewLink className="tkdl-panel-link" href="/community">Open the community <ArrowRight size={14} /></PreviewLink>
        </div>

        <div className="tkdl-panel tkdl-flashback">
          <div className="tkdl-panel-header">
            <div><p className="tkdl-eyebrow">FROM THE ARCHIVE</p><h2>One year ago, today</h2></div>
            <CalendarDays size={18} />
          </div>
          <div className="tkdl-archive-stamp">MATCH<br />208</div>
          <p className="tkdl-flashback-copy"><strong>Jamie McLean</strong> beat <strong>Callum Reid</strong> in a 501 upset win.</p>
          <div className="tkdl-archive-stats"><span><b>+20</b><small>POINT STAKE</small></span><span><b>+18</b><small>ELO CHANGE</small></span><span><b>501</b><small>GAME TYPE</small></span></div>
          <PreviewLink href="/h2h">Relive the rivalry <ArrowRight size={14} /></PreviewLink>
        </div>
      </section>

      <section className="tkdl-explore">
        <div className="tkdl-explore-label"><span>STEP UP</span><h2>Pick your next game.</h2></div>
        <div className="tkdl-mode-list">{modes.map(({ label, href, icon: Icon }) => <PreviewLink key={label} href={href}><Icon size={15} />{label}<ArrowRight size={12} /></PreviewLink>)}</div>
        <div className="tkdl-reference"><span>REFERENCE</span><PreviewLink href="/hall-of-fame"><Award size={14} /> Hall of Fame</PreviewLink><PreviewLink href="/seasons"><History size={14} /> Seasons</PreviewLink><PreviewLink href="/rules"><BookOpen size={14} /> Rules</PreviewLink></div>
      </section>

      <section className="tkdl-results">
        <div className="tkdl-results-heading"><div><p className="tkdl-eyebrow">THE NUMBERS DON’T LIE</p><h2>League records</h2></div><div className="tkdl-mobile-tabs"><button className={activeTab === "table" ? "active" : ""} onClick={() => setActiveTab("table")}><Trophy size={13} /> Table</button><button className={activeTab === "matches" ? "active" : ""} onClick={() => setActiveTab("matches")}><Swords size={13} /> Matches</button></div></div>
        <div className="tkdl-record-columns">
          <div className={`tkdl-record-panel ${activeTab !== "table" ? "mobile-hidden" : ""}`}>
            <div className="tkdl-record-title"><h3><Trophy size={16} /> Standings</h3><PreviewLink href="/leaderboard">Full table <ArrowRight size={13} /></PreviewLink></div>
            <div className="tkdl-table-head"><span>RANK</span><span>PLAYER</span><span>DIVISION</span><span>POINTS</span></div>
            {standings.map((player) => <PreviewLink href={`/players/${player.id}`} key={player.name} className={`tkdl-table-row ${player.me ? "is-me" : ""}`}>
              <span className={`tkdl-place place-${player.place}`}>{String(player.place).padStart(2, "0")}</span>
              <span className="tkdl-person"><strong>{player.name}</strong><small>{player.nickname || "SEASON PLAYER"}</small></span>
              <span className="tkdl-division">{player.tier}</span>
              <span className="tkdl-points">{player.points}<small>PTS</small></span>
              <span className="tkdl-movement">{player.movement > 0 ? <><ArrowUp size={12} />{player.movement}</> : player.movement < 0 ? <><ArrowDown size={12} />{Math.abs(player.movement)}</> : <Minus size={12} />}</span>
            </PreviewLink>)}
          </div>
          <div className={`tkdl-record-panel ${activeTab !== "matches" ? "mobile-hidden" : ""}`}>
            <div className="tkdl-record-title"><h3><Swords size={16} /> Recent matches</h3><span>LAST 24 HOURS</span></div>
            <div className="tkdl-match-list">{matches.map((match) => <div className="tkdl-match-row" key={`${match.winner}-${match.loser}`}>
              <span className="tkdl-match-mark"><Target size={15} /></span><div className="tkdl-match-info"><strong>{match.winner} <i>def.</i> {match.loser}</strong><small>{match.detail} <i>·</i> {match.time}</small></div><div className="tkdl-match-points"><b>{match.points}</b><small>{match.elo}</small></div>
            </div>)}</div>
            <PreviewLink className="tkdl-panel-link" href="/leaderboard">League table <ArrowRight size={14} /></PreviewLink>
          </div>
        </div>
      </section>

      <footer className="tkdl-footer"><span><span className="tkdl-brand-dot" /> TKDL <i>·</i> TESCO KITCHEN DARTS LEAGUE</span><span>SEASON 8 · THE WINTER SERIES</span><PreviewLink href="/rules">LEAGUE RULES <ArrowRight size={12} /></PreviewLink></footer>
    </main>
  );
}

function PulseIcon({ category }: { category: PulseItem["category"] }) {
  if (category === "league") return <Trophy size={14} />;
  if (category === "achievements") return <Award size={14} />;
  if (category === "community") return <MessageSquare size={14} />;
  return <Star size={14} />;
}
