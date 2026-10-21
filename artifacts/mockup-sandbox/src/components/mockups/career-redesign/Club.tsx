import { useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronRight, Crown, Flag, MapPin, Medal, Shield, Ticket, Trophy, Users, X } from "lucide-react";
import { CareerShell, Eyebrow } from "./_shared/CareerShell";
import "./_shared/career.css";
import "./_shared/pages.css";
import "./_shared/tkdl-theme.css";
import "./_group.css";
import "./Club.css";

const division = [
  { pos: 1, name: "Nottingham Trent", points: 53, form: "W W W L W" },
  { pos: 2, name: "The Robin Hood", points: 48, form: "W W L W W", home: true },
  { pos: 3, name: "Derbyshire Arrows", points: 41, form: "W L W W L" },
  { pos: 4, name: "Leicester Doubles", points: 36, form: "L W W L W" },
  { pos: 5, name: "Lincoln City", points: 31, form: "L W L W L" },
  { pos: 6, name: "The Steel Tip", points: 27, form: "W L L W L" },
];
const members = [
  { rank: "01", name: "Jack Turner", role: "Captain", points: 48, detail: "3 club titles", initials: "JT", color: "gold" },
  { rank: "02", name: "Alex North", role: "Professional · You", points: 42, detail: "2 club titles", initials: "AN", color: "red", you: true },
  { rank: "03", name: "Callum Reed", role: "First team", points: 35, detail: "1 club title", initials: "CR", color: "blue" },
  { rank: "04", name: "Tom Walsh", role: "First team", points: 31, detail: "1 club title", initials: "TW", color: "slate" },
  { rank: "05", name: "Peter Howard", role: "Squad", points: 24, detail: "No titles yet", initials: "PH", color: "slate" },
  { rank: "06", name: "Gary Collins", role: "Squad", points: 18, detail: "No titles yet", initials: "GC", color: "slate" },
];
const countyRosters = {
  MEN: {
    A: [["Jack Turner", 21], ["You", 18], ["Callum Reed", 16], ["Tom Walsh", 14]],
    B: [["Peter Howard", 11], ["Gary Collins", 9], ["Sam Price", 8]],
  },
  WOMEN: {
    A: [["Rachel Moore", 18], ["Sarah Green", 14], ["Lucy Hill", 12], ["Emma White", 9]],
    B: [["Emma White", 9], ["Anne Foster", 8]],
  },
};

function SectionHead({ kicker, title, detail, icon }: { kicker: string; title: string; detail?: string; icon: ReactNode }) {
  return <header className="club-section-head"><div className="club-section-icon">{icon}</div><div><Eyebrow>{kicker}</Eyebrow><h2>{title}</h2>{detail && <p>{detail}</p>}</div></header>;
}

export function Club() {
  const [category, setCategory] = useState<"MEN" | "WOMEN">("MEN");
  const [showSetup, setShowSetup] = useState(false);
  const [tournamentName, setTournamentName] = useState("Robin Hood Summer Open");
  const [week, setWeek] = useState("Week 22");
  const [field, setField] = useState("16 players · £25 room");
  const [booked, setBooked] = useState(false);
  const [notice, setNotice] = useState("");
  const toggleNotice = (key: string) => setNotice(notice === key ? "" : key);
  return <CareerShell page="Club">
    <main className="tk-club">
      <section className="club-hero">
        <div className="club-hero-kicker"><Eyebrow>NOTTINGHAMSHIRE · YOUR HOME CLUB</Eyebrow><span className="club-member-chip"><i /> CLUB LEGEND</span></div>
        <div className="club-hero-body">
          <div className="club-hero-copy">
            <span className="club-founded">EST. 1987 <i /> NOTTINGHAM</span>
            <h1>The Robin<br /><em>Hood.</em></h1>
            <p>Your home club, your county pathway. From Wednesday nights in the back room to the national team conversation.</p>
            <div className="club-hero-actions">
              <button className="club-button club-button-red" onClick={() => document.getElementById("team-nights")?.scrollIntoView({ behavior: "smooth" })}><CalendarDays size={16} /> See team nights</button>
              <button className="club-button club-button-outline" onClick={() => setShowSetup(true)}><Trophy size={16} /> Host a tournament</button>
            </div>
          </div>
          <div className="club-hero-art" aria-label="The Robin Hood club crest">
            <div className="club-crest">
              <svg viewBox="0 0 240 300" role="img" aria-labelledby="robin-crest-title robin-crest-description" xmlns="http://www.w3.org/2000/svg">
                <title id="robin-crest-title">The Robin Hood darts club crest</title>
                <desc id="robin-crest-description">A Nottinghamshire shield with a hooded archer, dartboard, crossed darts, and the club's founding year.</desc>
                <defs>
                  <linearGradient id="crest-metal" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#f5df98" />
                    <stop offset=".28" stopColor="#9a793d" />
                    <stop offset=".52" stopColor="#e2c873" />
                    <stop offset="1" stopColor="#69532e" />
                  </linearGradient>
                  <linearGradient id="crest-enamel" x1=".1" y1="0" x2=".9" y2="1">
                    <stop offset="0" stopColor="#30465a" />
                    <stop offset=".55" stopColor="#15283a" />
                    <stop offset="1" stopColor="#0c1927" />
                  </linearGradient>
                </defs>

                <path d="M26 7h188l20 20v157c0 48-37 83-114 108C43 267 6 232 6 184V27z" fill="#0a1420" stroke="#6d542d" strokeWidth="5" />
                <path d="M27 12h186l15 16v155c0 43-35 76-108 100-73-24-108-57-108-100V28z" fill="url(#crest-metal)" stroke="#f2db91" strokeWidth="2" />
                <path d="M31 18h178l13 14v150c0 39-33 70-102 93-69-23-102-54-102-93V32z" fill="url(#crest-enamel)" stroke="#5d4928" strokeWidth="2" />
                <path d="M39 25h162l12 13v143c0 34-29 62-93 84-64-22-93-50-93-84V38z" fill="none" stroke="#d6bb6b" strokeWidth="1.5" />

                <path d="M48 37h144v31H48z" fill="#132235" stroke="#dfc36e" strokeWidth="1.5" />
                <path d="M52 41h136v23H52z" fill="none" stroke="#9c7d40" strokeWidth="1" />
                <text x="120" y="53" fill="#f2df9f" fontFamily="DM Mono, monospace" fontSize="12" fontWeight="600" letterSpacing="1" textAnchor="middle">NOTTINGHAMSHIRE</text>
                <text x="120" y="62" fill="#cdb46b" fontFamily="DM Mono, monospace" fontSize="8" fontWeight="600" letterSpacing="1.5" textAnchor="middle">EST. 1987</text>

                <g transform="translate(24 40) scale(.8)">
                <g fill="none" stroke="#d4b864" strokeLinecap="round" strokeLinejoin="round" opacity=".62">
                  <path d="m57 168 94-82m-82 0 86 84" strokeWidth="2.5" />
                  <path d="m57 168 5-17 11 12zM155 170l-11-12 17-5zM151 86l-16 5 11 11zM69 86l16 5-11 11z" fill="#b4924b" strokeWidth="1" />
                </g>
                <g>
                  <circle cx="177" cy="126" r="27" fill="#101c29" stroke="#e0c875" strokeWidth="2" />
                  <circle cx="177" cy="126" r="20" fill="none" stroke="#a88643" strokeWidth="1.5" />
                  <circle cx="177" cy="126" r="11" fill="none" stroke="#d5bd72" strokeWidth="1.5" />
                  <circle cx="177" cy="126" r="4.5" fill="#c94c5b" stroke="#f1d990" strokeWidth="1.5" />
                  <path d="M177 100v52m-26-26h52m-44-18 36 36m0-36-36 36" fill="none" stroke="#c7aa5c" strokeWidth="1" opacity=".75" />
                </g>
                <path d="M101 126h73m-11-6 11 6-11 6" fill="none" stroke="#f2dfaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                <g strokeLinejoin="round">
                  <path d="M43 174c3-36 5-65 24-87 13-15 34-20 53-13-13 9-17 20-14 31 3 12 14 19 27 27l-15 12-2 31z" fill="#a23e4b" stroke="#e3c66d" strokeWidth="3" />
                  <path d="M54 168c4-30 9-55 23-70 9-10 20-15 34-16-9 10-11 21-7 31 4 12 14 20 29 29l-11 8-2 19z" fill="#172a3a" stroke="#c8a955" strokeWidth="1.5" />
                  <path d="M102 108c9 4 14 12 17 21l13 7-11 7c-1 9-7 16-16 20l-20-2 7-16-6-9 9-9z" fill="#e5d3a0" stroke="#fff0c4" strokeWidth="1.4" />
                  <path d="m117 131 11 3-8 5m-17 15 13 1" fill="none" stroke="#80623a" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M66 160c5-31 15-53 34-66m-49 79 69 1" fill="none" stroke="#dfc36f" strokeWidth="1.5" />
                  <path d="M72 87c-3-17 2-29 16-38 2 13 0 23-7 32 14-7 25-10 38-8-10 11-24 18-42 20" fill="#d9bd69" stroke="#f2dd94" strokeWidth="1.5" />
                </g>
                </g>

                <g transform="translate(0 -7)">
                  <path d="M47 202h146v24H47z" fill="#182538" stroke="#dfc36e" strokeWidth="1.5" />
                  <text x="120" y="218" fill="#f2df9f" fontFamily="DM Mono, monospace" fontSize="13" fontWeight="700" letterSpacing="1.6" textAnchor="middle">THE ROBIN HOOD</text>
                </g>

                <g transform="translate(0 12)">
                  <path d="m45 211 150 0-8 24-67 19-67-19z" fill="#604d2b" stroke="#f0d481" strokeWidth="2" />
                  <path d="m52 215 136 0-6 16-62 18-62-18z" fill="#293142" stroke="#a98743" strokeWidth="1" />
                  <text x="120" y="228" fill="#f7e6ad" fontFamily="DM Mono, monospace" fontSize="13" fontWeight="700" letterSpacing="1" textLength="136" lengthAdjust="spacingAndGlyphs" textAnchor="middle">NOTTS · DARTS CLUB</text>
                </g>
                <path d="M20 34h5M215 34h5M20 181h5M215 181h5" stroke="#f1db94" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="club-division-stamp">DIV<br /><b>01</b></span>
            <span className="club-night-note">HOME OF<br />THE HOOD</span>
          </div>
        </div>
        <div className="club-hero-facts">
          <div><span>DIVISION</span><b>01</b><small>TOP FLIGHT</small></div>
          <div><span>LEAGUE PLACE</span><b>2<sup>ND</sup></b><small>5 PTS OFF TOP</small></div>
          <div><span>CLUB POINTS</span><b>48</b><small>+17 THIS SEASON</small></div>
          <div><span>CAPTAIN</span><b className="fact-captain">Jack Turner</b><small>THIRD SEASON</small></div>
        </div>
      </section>

      <div className="club-season-ribbon"><span><i /> CURRENT SEASON</span><b>02</b><span className="ribbon-rule" /><span>COUNTY CIRCUIT</span><b>Nottinghamshire</b><span className="ribbon-rule" /><span>THE LADDER</span><b>#2 <small>of 6</small></b></div>

      <div className="club-feature-grid">
        <section className="club-panel club-ladder">
          <SectionHead kicker="THE CLUB LADDER · SEASON 2" title="Division 1" detail="Six clubs. One title. Keep climbing." icon={<Shield size={18} />} />
          <div className="ladder-columns"><span>PLACE / CLUB</span><span>RECENT FORM</span><span>PTS</span></div>
          <ol className="division-list">{division.map(row => <li key={row.name} className={`${row.home ? "is-home" : ""} ${row.pos <= 2 ? "is-promotion" : row.pos >= 5 ? "is-relegation" : ""}`}>
            <b className="division-rank">{String(row.pos).padStart(2, "0")}</b><span className="division-name"><strong>{row.name}</strong>{row.home && <small>YOUR HOME CLUB</small>}</span>
            <span className="division-form">{row.form.split(" ").map((v, i) => <i key={`${v}${i}`} className={v === "W" ? "form-win" : "form-loss"}>{v}</i>)}</span>
            <b className="division-points">{row.points}<small>PTS</small></b>
          </li>)}</ol>
          <div className="promotion-bar"><span><ArrowUpRight size={15} /><b>TOP TWO</b> promoted</span><span><ArrowDownRight size={15} /><b>BOTTOM TWO</b> relegated</span></div>
          <div className="finish-points"><span className="finish-heading">POINTS BY FINISH</span><div><b>Winner <i>5</i></b><b>Runner-up <i>3</i></b><b>Semi-final <i>2</i></b><b>Quarter-final <i>1</i></b></div></div>
        </section>

        <section className="club-panel club-match-panel" id="team-nights">
          <SectionHead kicker="WEDNESDAY · WEEK 19" title="Next team night" detail="Six singles a side · best of five legs" icon={<CalendarDays size={18} />} />
          <div className="next-fixture">
            <div className="fixture-date"><small>MAR</small><b>19</b><span>WEDNESDAY</span></div>
            <div className="fixture-opponent"><span>AWAY FIXTURE</span><h3>Derbyshire<br />Arrows</h3><p><MapPin size={14} /> Derby <i /> 19:00</p></div>
            <div className="fixture-away"><span>AWAY</span><b>DA</b></div>
          </div>
          <div className="selection-callout"><span className="selection-marker"><Check size={15} /></span><span><b>You’re in the team.</b><small>Singles line-up confirmed by captain Jack Turner.</small></span><span className="selected-tag">SELECTED</span></div>
          <div className="result-block">
            <div className="result-top"><Eyebrow>LAST RESULT · WEEK 17 · HOME</Eyebrow><span className="win-label">FULL TIME · WON</span></div>
            <div className="result-score"><b>The Robin Hood</b><strong>4 <i>–</i> 2</strong><b>Leicester Doubles</b></div>
            <div className="singles-result"><span>YOUR SINGLE</span><b>Alex North</b><strong>3–2</strong><span>Peter Howard</span><em>WON</em></div>
            <div className="past-singles">{[["Jack Turner", "3–1", "Sam Price"], ["Alex North", "3–2", "Peter Howard"], ["Callum Reed", "1–3", "Dan Walker"], ["Tom Walsh", "3–0", "Gary Collins"]].map(([home, score, away]) => <div key={home}><span>{home}</span><b>{score}</b><span>{away}</span></div>)}</div>
          </div>
          <button className="club-text-toggle" onClick={() => toggleNotice("fixtures")}>Season fixtures &amp; standings <ChevronDown size={15} className={notice === "fixtures" ? "turned" : ""} /></button>
          {notice === "fixtures" && <div className="fixture-details">
            <p>Wednesday nights, weeks 4–44. Clubs play home and away; the top four reach the end-of-season play-offs. League seeding breaks a tied knockout match.</p>
            <div className="mini-table-head"><span>TEAM</span><span>RECORD</span><span>PTS</span></div>
            {[["Nottingham Trent", "P8 · W7 · L1", 31], ["The Robin Hood", "P8 · W6 · L2", 28], ["Derbyshire Arrows", "P8 · W5 · D1 · L2", 25], ["Leicester Doubles", "P8 · W4 · L4", 21]].map(([name, record, points], i) => <div className={`mini-table-row ${i === 1 ? "my-row" : ""}`} key={String(name)}><b>{String(i + 1).padStart(2, "0")}</b><strong>{name}</strong><span>{record}</span><em>{points}</em></div>)}
            <small className="singles-season-note">Your singles this season: won 6 of 7.</small>
          </div>}
        </section>
      </div>

      <section className="club-panel members-panel">
        <SectionHead kicker="THE PEOPLE BEHIND THE POINTS" title="Club members" detail="5 of 12 active members · season points" icon={<Users size={18} />} />
        <div className="member-table">
          <div className="member-table-head"><span>PLAYER</span><span>ROLE</span><span>CLUB POINTS</span></div>
          {members.map(member => <article className={`member-row ${member.you ? "member-you" : ""}`} key={member.name}>
            <span className={`member-initial ${member.color}`}>{member.initials}</span><span className="member-name"><b>{member.name}</b><small>{member.detail}</small></span>
            <span className="member-role">{member.role === "Captain" && <Crown size={13} />}{member.role}</span><strong className="member-points">{member.points}<small>PTS</small></strong>
            <span className="member-rank">{member.rank}</span>
          </article>)}
        </div>
        <button className="club-text-toggle member-toggle" onClick={() => toggleNotice("member-rules")}>How club points are earned <ChevronDown size={15} className={notice === "member-rules" ? "turned" : ""} /></button>
        {notice === "member-rules" && <p className="member-note" role="status">Members earn club points from finishes at club, county and regional events. Jack Turner leads this season’s table on 48 points; you are second on 42.</p>}
      </section>

      <section className="club-panel county-panel">
        <SectionHead kicker="THE NEXT STEP · NOTTINGHAMSHIRE" title="Your county pathway" detail="Individual event finishes shape selection. Team results are earned together." icon={<Flag size={18} />} />
        <div className="county-facts">
          <div><small>MEN’S TEAM</small><b>12 <i>singles</i></b></div><div><small>WOMEN’S TEAM</small><b>6 <i>singles</i></b></div><div><small>A MATCH</small><b>Best of 7 <i>legs</i></b></div><div><small>WOMEN’S &amp; LOWER B</small><b>Best of 5 <i>legs</i></b></div>
        </div>
        <div className="county-intro-row"><p>When selected and available, you play your own single in the live scorer; the other singles are simulated. The fixture completes after your match is finished.</p><div className="county-selection"><span className="selection-dot" /><span><small>YOUR SELECTION</small><b>{category === "MEN" ? "Men’s A squad" : "Women’s A squad"}</b></span><strong>SELECTED</strong></div></div>
        <div className="county-tabs" role="tablist" aria-label="County squad category">
          <button role="tab" aria-selected={category === "MEN"} className={category === "MEN" ? "active" : ""} onClick={() => setCategory("MEN")}>Men’s squads <span>2</span></button>
          <button role="tab" aria-selected={category === "WOMEN"} className={category === "WOMEN" ? "active" : ""} onClick={() => setCategory("WOMEN")}>Women’s squads <span>2</span></button>
        </div>
        <div className="county-squad-grid">{(["A", "B"] as const).map(team => {
          const roster = countyRosters[category][team];
          const capacity = category === "MEN" ? 12 : 6;
          return <article className={`squad-roster ${team === "A" ? "squad-a" : ""}`} key={`${category}-${team}`}>
            <header><span>{category === "MEN" ? "MEN’S" : "WOMEN’S"} {team}</span><b>{category === "MEN" ? (team === "A" ? "12 / 12" : "10 / 12") : (team === "A" ? "6 / 6" : "5 / 6")}<small> PLACES</small></b></header>
            <ol>{roster.map(([name, pts], i) => <li className={name === "You" ? "you-in-roster" : ""} key={name}><b>{String(i + 1).padStart(2, "0")}</b><span>{name}{name === "You" && <small> YOUR PLACE</small>}</span><em>{pts}<small>PTS</small></em></li>)}</ol>
            <footer>{roster.length} named <i /> {capacity - roster.length} place{capacity - roster.length === 1 ? "" : "s"} available</footer>
          </article>;
        })}</div>
        <div className="county-standings">
          <div className="subsection-heading"><div><Eyebrow>UKDA-STYLE FORMAT · SEASON 2</Eyebrow><h3>County team standings</h3></div><span>SETS WON IN PLAYED FIXTURES</span></div>
          <div className="county-leagues">
            {[{ label: "Men’s A", rows: [["Nottinghamshire", 34, "4 played · 3W 0D 1L"], ["Derbyshire", 29, "4 played · 2W 1D 1L"], ["Leicestershire", 26, "4 played · 2W 0D 2L"]] }, { label: "Women’s A", rows: [["Nottinghamshire", 22, "4 played · 3W 0D 1L"], ["Lincolnshire", 18, "4 played · 2W 0D 2L"], ["Derbyshire", 16, "4 played · 1W 1D 2L"]] }].map(table => <div className="county-league" key={table.label}><h4>{table.label}</h4>{table.rows.map(([name, pts, record], i) => <div className={i === 0 ? "county-top" : ""} key={String(name)}><b>{String(i + 1).padStart(2, "0")}</b><span><strong>{name}</strong><small>{record}</small></span><em>{pts}<small>SETS</small></em></div>)}</div>)}
          </div>
        </div>
        <div className="county-fixtures">
          <div className="subsection-heading"><div><Eyebrow>COUNTY CALENDAR</Eyebrow><h3>Fixtures &amp; results</h3></div><span>ROUND 5 NEXT</span></div>
          <div className="county-fixture-row upcoming"><span className="county-week"><small>WEEK</small><b>21</b></span><span className="county-round">ROUND 5</span><strong>Nottinghamshire <i>at</i> Derbyshire</strong><span className="fixture-status">SCHEDULED</span><span className="fixture-score">—</span></div>
          <div className="county-fixture-row"><span className="county-week"><small>WEEK</small><b>17</b></span><span className="county-round">ROUND 4</span><strong>Nottinghamshire <i>vs</i> Leicestershire</strong><span className="fixture-status played">PLAYED</span><span className="fixture-score">M A 8–4 <small>W A 4–2</small></span></div>
          <div className="county-personal-result"><Medal size={16} /><span><b>Your single · Round 4</b><small>Won · individual county points count toward squad selection, not team match results.</small></span><strong>WIN</strong></div>
        </div>
        <div className="county-individual">
          <div className="subsection-heading"><div><Eyebrow>SEASON 2 · INDIVIDUAL FINISHES</Eyebrow><h3>County points</h3></div><span>SELECTION RANKING</span></div>
          {[[1, "Jack Turner", 26], [2, "You", 22], [3, "Callum Reed", 18], [4, "Tom Walsh", 15]].map(([rank, name, pts]) => <div className={`county-points-row ${name === "You" ? "you-points" : ""}`} key={String(name)}><b>{String(rank).padStart(2, "0")}</b><span>{name}{name === "You" && <small>YOU</small>}</span><strong>{pts}<small>PTS</small></strong></div>)}
        </div>
      </section>

      <div className="club-pathway-grid">
        <section className="club-panel national-panel">
          <SectionHead kicker="THE INTERNATIONAL DREAM" title="England · World Cup of Darts" detail="Two players. One published ranking. Your next target." icon={<Flag size={18} />} />
          <div className="national-callout"><span className="national-number">08</span><span><small>YOUR PLACE IN LINE</small><b>8th in today’s rankings</b><em>Two places available for the national team.</em></span><span className="selection-status">IN CONTENTION</span></div>
          <div className="national-ranking">
            {[["01", "Luke Humphries", "1"], ["02", "Michael Smith", "4"], ["03", "Rob Cross", "8"], ["08", "You", "18"]].map(([rank, name, points], i) => <div className={name === "You" ? "rank-you" : ""} key={name}><b>{rank}</b><span>{name}{i < 2 && <small> IN THE TEAM</small>}</span><em>{points}<small>RANK</small></em></div>)}
          </div>
          <div className="world-cup-history"><Eyebrow>WORLD CUP HISTORY</Eyebrow><div><span>SEASON 1</span><b>Luke Humphries &amp; Michael Smith</b><em>Represented England</em></div></div>
        </section>
        <section className="club-panel club-heritage">
          <SectionHead kicker="SINCE 1987 · NOTTINGHAM" title="A club with history" detail="The Hood’s story, one season at a time." icon={<Medal size={18} />} />
          <div className="heritage-highlight"><span><Trophy size={24} /></span><div><Eyebrow>DIVISION CHAMPIONS</Eyebrow><h3>Season 1</h3><p>Division 2 · 41 points · Promoted</p></div><b>01</b></div>
          <div className="history-record"><span>SEASON 2</span><b>Division 1 · 2nd · 48 pts</b><em>IN PROGRESS</em></div>
          <div className="history-record"><span>SEASON 1</span><b>Division 2 · 1st · 41 pts</b><em className="champion-label">CHAMPIONS</em></div>
          <div className="club-motto"><Eyebrow>THE CLUB MOTTO</Eyebrow><blockquote>“One leg at a time.”</blockquote><small>A JACK TURNER ORIGINAL, PROBABLY.</small></div>
        </section>
      </div>

      <section className="club-host-banner">
        <div className="host-seal"><Ticket size={21} /></div><div className="host-banner-copy"><Eyebrow>YOUR VENUE · YOUR TOURNAMENT</Eyebrow><h2>Bring everyone to your oche.</h2><p>Book the back room and add your prize money up front. Players pay entry; you keep 20% of fees, with the rest split across the final four.</p></div>
        <div className="host-banner-detail"><span>UP TO <b>2</b> LOCAL SPECIALS</span><span>THIS SEASON</span></div><button className="club-button club-button-gold" onClick={() => setShowSetup(true)}>Set up an open <ArrowUpRight size={16} /></button>
      </section>

      <section className="club-host-history"><div><Eyebrow>PAST LOCAL SPECIAL</Eyebrow><h3>Robin Hood Winter Classic</h3><p>Week 10 · Saturday · 14 players · £10 entry</p></div><span>PLAYED</span><strong>You won it <i /> £28 fee share</strong></section>
      <div className="club-footer-rule"><span>THE ROBIN HOOD</span><i /><span>NOTTINGHAM · EST. 1987</span><i /><span>CAREER / CLUB</span></div>
    </main>
    {showSetup && <div className="club-modal-scrim" onClick={() => setShowSetup(false)}><section className="club-modal" role="dialog" aria-modal="true" aria-labelledby="host-title" onClick={e => e.stopPropagation()}>
      <button className="club-modal-close" aria-label="Close setup" onClick={() => setShowSetup(false)}><X size={18} /></button><Eyebrow>ROBIN HOOD BACK ROOM</Eyebrow><h2 id="host-title">Set up your open.</h2><p className="club-modal-intro">Book a local special for a free week. Room and prize money are paid up front; players pay your entry fee.</p>
      <label className="club-field"><span>TOURNAMENT NAME</span><input value={tournamentName} onChange={e => setTournamentName(e.target.value)} /></label>
      <div className="club-modal-fields"><label className="club-field"><span>WEEK</span><select value={week} onChange={e => setWeek(e.target.value)}>{["Week 20", "Week 21", "Week 22", "Week 23", "Week 24"].map(v => <option key={v}>{v}</option>)}</select></label><label className="club-field"><span>FIELD / ROOM</span><select value={field} onChange={e => setField(e.target.value)}>{["16 players · £25 room", "24 players · £40 room", "32 players · £55 room"].map(v => <option key={v}>{v}</option>)}</select></label></div>
      <div className="club-cost-summary"><span>UP-FRONT COST <b>£75</b></span><span>EST. PRIZE POT <b>£150</b></span><span>YOUR FEE SHARE <b>~£24</b></span></div>
      {booked && <p className="club-booking-success" role="status"><Check size={15} /> {tournamentName || "Your tournament"} reserved for {week}.</p>}
      <div className="club-modal-footer"><button className="club-button club-button-outline" onClick={() => setShowSetup(false)}>Cancel</button><button className="club-button club-button-red" onClick={() => setBooked(true)}><Check size={15} /> {booked ? "Update booking" : "Reserve the room"}</button></div>
    </section></div>}
  </CareerShell>;
}
