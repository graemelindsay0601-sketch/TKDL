import { Link, useLocation } from "wouter";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronRight, Crown, Flag, Medal, MapPin, Shield, Ticket, Trophy, Users } from "lucide-react";
import { errorMessage, useHomeClub, useSetCountyCategory, useStartCountyTrial, type ClubView } from "../api";
import { CareerError, CareerLoading, CareerSection, CareerEmptyState } from "../components";
import type { ShellContext } from "../shell";
import { TeamNights } from "../team-nights";
import { HostTournament } from "../hosting";
import { LocalCompetitions } from "../local-competitions";
import "./club-premium.css";

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

/** Your home club: its members, captain, county league division and the club's league history. */
export function ClubPage({ ctx }: { ctx: ShellContext }) {
  const club = useHomeClub(ctx.save.id), base = `/career/${ctx.save.id}`;
  const setCountyCategory = useSetCountyCategory(ctx.save.id);
  const startTrial = useStartCountyTrial(ctx.save.id), [, navigate] = useLocation();
  if (club.isLoading) return <CareerLoading />;
  if (club.error || !club.data) return <CareerError error={club.error} onRetry={() => club.refetch()} />;
  const d: ClubView = club.data;
  if (!d.club || !d.table) return <CareerEmptyState title="No home club yet">Your home club comes from your home area. Set it in your Career profile.</CareerEmptyState>;
  const mine = d.table.rows.find(r => r.you)!, honours = d.history.filter(h => h.champions);
  return <main className="tk-club career-club">
    <section className="club-hero">
      <div className="club-hero-kicker"><span className="career-eyebrow">{d.club.region} · YOUR HOME CLUB</span>
        <span className="club-member-chip"><i />{d.legend ? "CLUB LEGEND" : "CLUB MEMBER"}</span></div>
      <div className="club-hero-body">
        <div className="club-hero-copy">
          <span className="club-founded"><MapPin size={13} /> {d.club.region} <i /> COUNTY CIRCUIT</span>
          <h1>{d.club.name}</h1>
          <p>Your home club and county pathway. Club points come from your finishes at club nights, county and regional events.{d.legend ? " You turned professional and remain the club’s legend." : ""}</p>
          <div className="club-hero-actions">
            <a className="club-button club-button-red" href="#team-nights"><CalendarDays size={16} /> Team nights</a>
            <a className="club-button club-button-outline" href="#local-competitions"><Trophy size={16} /> Local competitions</a>
            <a className="club-button club-button-outline" href="#host-tournament"><Trophy size={16} /> Host a tournament</a>
          </div>
        </div>
        <div className="club-hero-art" aria-label={`${d.club.name} crest`}>
          <div className="club-crest">
            <svg viewBox="0 0 240 300" role="img" aria-labelledby="club-crest-title club-crest-description" xmlns="http://www.w3.org/2000/svg">
              <title id="club-crest-title">{d.club.name} club crest</title>
              <desc id="club-crest-description">A regional darts club shield with a hooded archer, dartboard and crossed darts.</desc>
              <defs>
                <linearGradient id="crest-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f5df98" /><stop offset=".28" stopColor="#9a793d" /><stop offset=".52" stopColor="#e2c873" /><stop offset="1" stopColor="#69532e" /></linearGradient>
                <linearGradient id="crest-enamel" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stopColor="#30465a" /><stop offset=".55" stopColor="#15283a" /><stop offset="1" stopColor="#0c1927" /></linearGradient>
              </defs>
              <path d="M26 7h188l20 20v157c0 48-37 83-114 108C43 267 6 232 6 184V27z" fill="#0a1420" stroke="#6d542d" strokeWidth="5" />
              <path d="M27 12h186l15 16v155c0 43-35 76-108 100-73-24-108-57-108-100V28z" fill="url(#crest-metal)" stroke="#f2db91" strokeWidth="2" />
              <path d="M31 18h178l13 14v150c0 39-33 70-102 93-69-23-102-54-102-93V32z" fill="url(#crest-enamel)" stroke="#5d4928" strokeWidth="2" />
              <path d="M39 25h162l12 13v143c0 34-29 62-93 84-64-22-93-50-93-84V38z" fill="none" stroke="#d6bb6b" strokeWidth="1.5" />
              <path d="M48 37h144v31H48z" fill="#132235" stroke="#dfc36e" strokeWidth="1.5" />
              <path d="M52 41h136v23H52z" fill="none" stroke="#9c7d40" strokeWidth="1" />
              <text x="120" y="53" fill="#f2df9f" fontFamily="DM Mono, monospace" fontSize="12" fontWeight="600" letterSpacing="1" textAnchor="middle" textLength="130" lengthAdjust="spacingAndGlyphs">{d.club.region.toUpperCase()}</text>
              <text x="120" y="62" fill="#cdb46b" fontFamily="DM Mono, monospace" fontSize="7" fontWeight="600" letterSpacing="1.1" textAnchor="middle" textLength="98" lengthAdjust="spacingAndGlyphs">COUNTY DARTS CLUB</text>
              <g transform="translate(24 40) scale(.8)">
                <g fill="none" stroke="#d4b864" strokeLinecap="round" strokeLinejoin="round" opacity=".62"><path d="m57 168 94-82m-82 0 86 84" strokeWidth="2.5" /><path d="m57 168 5-17 11 12zM155 170l-11-12 17-5zM151 86l-16 5 11 11zM69 86l16 5-11 11z" fill="#b4924b" strokeWidth="1" /></g>
                <g><circle cx="177" cy="126" r="27" fill="#101c29" stroke="#e0c875" strokeWidth="2" /><circle cx="177" cy="126" r="20" fill="none" stroke="#a88643" strokeWidth="1.5" /><circle cx="177" cy="126" r="11" fill="none" stroke="#d5bd72" strokeWidth="1.5" /><circle cx="177" cy="126" r="4.5" fill="#c94c5b" stroke="#f1d990" strokeWidth="1.5" /><path d="M177 100v52m-26-26h52m-44-18 36 36m0-36-36 36" fill="none" stroke="#c7aa5c" strokeWidth="1" opacity=".75" /></g>
                <path d="M101 126h73m-11-6 11 6-11 6" fill="none" stroke="#f2dfaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <g strokeLinejoin="round"><path d="M43 174c3-36 5-65 24-87 13-15 34-20 53-13-13 9-17 20-14 31 3 12 14 19 27 27l-15 12-2 31z" fill="#a23e4b" stroke="#e3c66d" strokeWidth="3" /><path d="M54 168c4-30 9-55 23-70 9-10 20-15 34-16-9 10-11 21-7 31 4 12 14 20 29 29l-11 8-2 19z" fill="#172a3a" stroke="#c8a955" strokeWidth="1.5" /><path d="M102 108c9 4 14 12 17 21l13 7-11 7c-1 9-7 16-16 20l-20-2 7-16-6-9 9-9z" fill="#e5d3a0" stroke="#fff0c4" strokeWidth="1.4" /><path d="m117 131 11 3-8 5m-17 15 13 1" fill="none" stroke="#80623a" strokeWidth="1.8" strokeLinecap="round" /><path d="M66 160c5-31 15-53 34-66m-49 79 69 1" fill="none" stroke="#dfc36f" strokeWidth="1.5" /><path d="M72 87c-3-17 2-29 16-38 2 13 0 23-7 32 14-7 25-10 38-8-10 11-24 18-42 20" fill="#d9bd69" stroke="#f2dd94" strokeWidth="1.5" /></g>
              </g>
              <path d="M47 202h146v24H47z" fill="#182538" stroke="#dfc36e" strokeWidth="1.5" />
              <text x="120" y="218" fill="#f2df9f" fontFamily="DM Mono, monospace" fontSize="12" fontWeight="700" textAnchor="middle" textLength="132" lengthAdjust="spacingAndGlyphs">{d.club.name.toUpperCase()}</text>
              <path d="m45 223 150 0-8 24-67 19-67-19z" fill="#604d2b" stroke="#f0d481" strokeWidth="2" />
              <path d="m52 227 136 0-6 16-62 18-62-18z" fill="#293142" stroke="#a98743" strokeWidth="1" />
              <text x="120" y="240" fill="#f7e6ad" fontFamily="DM Mono, monospace" fontSize="11" fontWeight="700" letterSpacing="1" textAnchor="middle" textLength="118" lengthAdjust="spacingAndGlyphs">{d.club.region.toUpperCase()}</text>
            </svg>
          </div>
          <span className="club-division-stamp">DIV<br /><b>{String(d.table.division).padStart(2, "0")}</b></span>
          <span className="club-night-note">YOUR<br />HOME CLUB</span>
        </div>
      </div>
      <div className="club-hero-facts">
        <div><span>DIVISION</span><b>{String(d.table.division).padStart(2, "0")}</b><small>COUNTY LEAGUE</small></div>
        <div><span>LEAGUE PLACE</span><b>{ordinal(mine.position)}</b><small>OF {d.table.rows.length} CLUBS</small></div>
        <div><span>CLUB POINTS</span><b>{mine.points}</b><small>THIS SEASON</small></div>
        <div><span>CAPTAIN</span><b className="fact-captain">{d.captain ? (d.captain.you ? "You" : d.captain.name) : "To be decided"}</b><small>HOME CLUB</small></div>
      </div>
    </section>

    <div className="club-season-ribbon"><span><i /> CURRENT SEASON</span><b>{String(d.season).padStart(2, "0")}</b><span className="ribbon-rule" /><span>COUNTY CIRCUIT</span><b>{d.club.region}</b><span className="ribbon-rule" /><span>THE LADDER</span><b>#{mine.position} <small>of {d.table.rows.length}</small></b></div>

    <div className="club-feature-grid">
      <CareerSection title={`Division ${d.table.division} · Season ${d.season}`} icon={<Shield aria-hidden />} accent="#d9bd69">
        <div className="club-board-key"><span>PLACE</span><span>CLUB</span><span>PTS</span></div>
        <ol className="career-club__table career-club__ladder" aria-label={`Division ${d.table.division} standings`}>
          {d.table.rows.map(r => <li key={r.localityKey} className={r.you ? "is-you" : undefined} data-zone={r.position <= 2 ? "promotion" : r.position > d.table!.rows.length - 2 ? "relegation" : undefined}>
            <b>{String(r.position).padStart(2, "0")}</b><span className="club-board-name">{r.name}{r.you && <small>YOUR CLUB</small>}</span><em><strong>{r.points}</strong><small>PTS</small></em>
          </li>)}
        </ol>
        <div className="promotion-bar"><span><ArrowUpRight size={15} /><b>TOP TWO</b> promoted</span><span><ArrowDownRight size={15} /><b>BOTTOM TWO</b> relegated</span></div>
        <div className="finish-points"><span className="finish-heading">POINTS BY FINISH</span><div><b>Winner <i>5</i></b><b>Runner-up <i>3</i></b><b>Semi-final <i>2</i></b><b>Quarter-final <i>1</i></b></div></div>
      </CareerSection>
      <div id="team-nights"><CareerSection title="Team nights" icon={<CalendarDays aria-hidden />} accent="#7898b4">
        <TeamNights saveId={ctx.save.id} />
      </CareerSection></div>
    </div>
    <LocalCompetitions saveId={ctx.save.id} retired={!!ctx.save.retiredAt} />

    <CareerSection title="Club members" icon={<Users aria-hidden />} accent="#d8495e" id="club-members">
      <p className="club-section-note">Active members · season points</p>
      <ol className="career-club__table career-club__members">{d.members.filter(m => m.active).slice(0, 25).map((m, i) => <li key={m.key} className={m.you ? "is-you" : undefined}>
        <b className="career-club__member-mark">{d.captain?.key === m.key ? <Crown size={14} aria-label="Captain" /> : (m.you ? "YOU" : initials(m.name))}</b>
        <span>{m.you ? <strong>You</strong> : <Link href={`${base}/world/players/${m.key}/profile`}>{m.name}</Link>}{m.professional && <small className="career-club__pro"> · Pro</small>}</span>
        <em>{m.seasonPoints}<small>PTS</small></em><small>{ctx.save.currentSeason > 1 ? `Last season ${m.lastSeasonPoints} pts · ` : ""}{m.titles} title{m.titles === 1 ? "" : "s"}</small>
        <i className="club-member-rank">{String(i + 1).padStart(2, "0")}</i></li>)}</ol>
    </CareerSection>

    {d.county && <CareerSection title={`${d.county.name} county pathway`} icon={<Flag aria-hidden />} accent="#7898b4">
      <div className="county-facts"><div><small>MEN’S TEAM</small><b>12 <i>singles</i></b></div><div><small>WOMEN’S TEAM</small><b>6 <i>singles</i></b></div><div><small>A MATCH</small><b>Best of 7 <i>legs</i></b></div><div><small>WOMEN’S &amp; LOWER B</small><b>Best of 5 <i>legs</i></b></div></div>
      <div className="county-intro-row"><p>When selected and available, you play your own single in the live scorer; the other singles are simulated. The fixture completes after your match is finished.</p>
        <div className="county-selection"><span className="selection-dot" /><span><small>YOUR SELECTION</small><b>{d.county.youSelected ? `${d.county.category === "WOMEN" ? "Women’s" : "Men’s"} ${d.county.aTeam.some(m => m.you) ? "A" : "B"} squad` : "Not currently selected"}</b></span><strong>{d.county.youSelected ? "SELECTED" : "IN CONTENTION"}</strong></div></div>
      <div className="county-tabs" role="group" aria-label="County squad category">
        {(["MEN", "WOMEN"] as const).map(category => <button key={category} type="button" className={d.county!.category === category ? "active" : ""} aria-pressed={d.county!.category === category} disabled={setCountyCategory.isPending} onClick={() => setCountyCategory.mutate(category)}>{category === "MEN" ? "Men’s squads" : "Women’s squads"}</button>)}
      </div>
      {setCountyCategory.error && <p className="county-error" role="alert">{errorMessage(setCountyCategory.error)}</p>}
      {!d.county.category && <p className="club-section-note">Select a category to be considered for county team fixtures.</p>}
      {d.county.category && d.county.rankingProgress && <div className="county-ranking-progress">
        <div className="subsection-heading"><div><span className="career-eyebrow">NEXT-SEASON SELECTION</span><h3>Your A-team route</h3></div>
          <span>{d.county.rankingProgress.projectedTeam ? `PROJECTED ${d.county.rankingProgress.projectedTeam} SQUAD` : "NOT YET IN SQUAD PLACES"}</span></div>
        <div className="county-ranking-stats">
          <div><small>YOUR RANK</small><strong>{d.county.rankingProgress.rank ? `#${d.county.rankingProgress.rank}` : "—"}</strong></div>
          <div><small>YOUR POINTS</small><strong>{d.county.rankingProgress.points}</strong></div>
          <div><small>A-TEAM CUTOFF</small><strong>{d.county.rankingProgress.aCutoffPoints ?? "—"}</strong></div>
        </div>
        <p>Grassroots, county and regional event finishes build your individual points. Next season’s A squad goes to the top {d.county.rankingProgress.teamSize} in your category; a county-trial place keeps you in B until your ranking earns A selection.</p>
      </div>}
      <div className="county-subsection county-trial-card">
        <div className="subsection-heading"><div><span className="career-eyebrow">CLUB-TO-COUNTY PATHWAY</span><h3>County squad trial</h3></div>
          <span>{d.county.trial.status === "WON" ? "QUALIFIED" : d.county.trial.status.replace("_", " ")}</span></div>
        {d.county.trial.status === "NOT_EARNED" && <p className="club-section-note">
          {d.county.trial.sourceSeason
            ? `Last season: ${d.county.trial.appearances}/5 played team singles and ${d.county.trial.wins}/2 wins. Five actual appearances and two wins earn a trial invitation next season; stand-ins do not count.`
            : "Play at least five actual club-team singles and win two in a season to earn a county trial invitation next season. Stand-in appearances do not count."}
        </p>}
        {d.county.trial.status === "INVITED" && <div>
          <p className="club-section-note">Your ${d.county.trial.appearances} appearances and ${d.county.trial.wins} wins earned this invitation. Win a best-of-five-legs trial to claim a place in the {d.county.category === "WOMEN" ? "women’s" : "men’s"} county B squad. It awards no county ranking points.</p>
          {!d.county.category ? <p className="county-error">Choose your county category above before starting.</p>
            : <button className="club-button club-button-gold" type="button" disabled={startTrial.isPending}
                onClick={async () => { try { const match = await startTrial.mutateAsync({}); navigate(`${base}/club/county-trial/${match.id}`); } catch { /* mutation error is shown below */ } }}>
                {startTrial.isPending ? "Preparing trial…" : "Play county trial"} <ChevronRight size={15} />
              </button>}
          {startTrial.error && <p className="county-error" role="alert">{errorMessage(startTrial.error)}</p>}
        </div>}
        {d.county.trial.status === "LIVE" && d.county.trial.matchId && <Link className="club-button club-button-gold" href={`${base}/club/county-trial/${d.county.trial.matchId}`}>Resume county trial <ChevronRight size={15} /></Link>}
        {d.county.trial.status === "WON" && <p className="club-section-note">Trial won. You are added to the {d.county.trial.category === "WOMEN" ? "women’s" : "men’s"} B-squad selection for future county fixtures this season.</p>}
        {d.county.trial.status === "LOST" && <p className="club-section-note">The trial is complete. You can qualify again through next season’s club-team appearances and results.</p>}
        {d.county.trial.status === "EXPIRED" && <p className="club-section-note">This invitation has expired with the season.</p>}
      </div>
      <div className="county-squad-grid">{(["MEN", "WOMEN"] as const).flatMap(category => (["A", "B"] as const).map(team => {
        const roster = d.county!.squads[category][team], size = category === "MEN" ? 12 : 6;
        return <section key={`${category}-${team}`} className="squad-roster">
          <header><span>{category === "MEN" ? "MEN’S" : "WOMEN’S"} {team}</span><b>{roster.length} / {size}<small> PLACES</small></b></header>
          {roster.length ? <ol>{roster.map((m, i) => <li className={m.you ? "you-in-roster" : ""} key={m.key}><b>{String(i + 1).padStart(2, "0")}</b><span>{m.you ? "You" : <Link href={`${base}/world/players/${m.key}/profile`}>{m.name}</Link>}{m.you && <small>{m.selectionSource === "COUNTY_TRIAL" ? " TRIAL PLACE" : " YOUR PLACE"}</small>}</span><em>{m.points}<small>PTS</small></em></li>)}</ol> : <p className="roster-empty">No eligible players with county results yet.</p>}
          <footer>{roster.length} named <i /> {Math.max(0, size - roster.length)} places available</footer>
        </section>;
      }))}</div>
      <div className="county-subsection"><div className="subsection-heading"><div><span className="career-eyebrow">SEASON {d.season}</span><h3>County team standings</h3></div><span>SETS WON IN PLAYED FIXTURES</span></div>
        <div className="county-leagues">{d.county.teamStandings.map(table => <section className="county-league" key={`${table.category}-${table.team}`}><h4>{table.category === "MEN" ? "Men’s" : "Women’s"} {table.team}</h4>
          {table.rows.slice(0, 10).map(r => <div className={r.localityKey === d.club!.localityKey ? "county-top" : ""} key={r.localityKey}><b>{String(r.position).padStart(2, "0")}</b><span><strong>{r.name}</strong><small>{r.played} played · {r.won}W {r.drawn}D {r.lost}L</small></span><em>{r.points}<small>SETS</small></em></div>)}</section>)}</div></div>
      <div className="county-subsection"><div className="subsection-heading"><div><span className="career-eyebrow">COUNTY CALENDAR</span><h3>Fixtures &amp; results</h3></div></div>
        {d.county.fixtures.length ? <ul className="career-club__history county-fixture-list">{d.county.fixtures.map(f => <li key={`${f.round}-${f.week}`}>
          <span className="county-fixture-week"><small>WEEK</small><b>{String(f.week).padStart(2, "0")}</b></span><div className="county-fixture-main"><span className="county-fixture-round">{f.round >= 100 ? `County Cup · Round ${f.round - 100}` : `Round ${f.round}`}</span><strong>{f.home ? "vs" : "at"} {f.opponent}</strong>
            <div className="county-fixture-scores">{f.matches.length ? f.matches.map((m, i) => <span key={`${m.category}-${m.team}-${i}`}><small>{m.category === "MEN" ? "M" : "W"}{m.team}</small><b>{f.home ? m.homeSets : m.awaySets}<i>–</i>{f.home ? m.awaySets : m.homeSets}</b></span>) : <em>Scheduled</em>}</div>
            {f.matches.some(m => m.youPlayed) && <small className="county-you-result">Your single · {f.matches.find(m => m.youPlayed)?.humanMatch?.status === "LIVE" ? "ready to play" : f.matches.find(m => m.youPlayed)?.youWon ? "won" : "lost"}</small>}</div>
          {f.matches.map(m => m.humanMatch?.status === "LIVE" ? <Link key={m.humanMatch.id} className="club-button club-button-gold county-fixture-action" href={`/career/${ctx.save.id}/county-match/${m.humanMatch.id}`}>Throw your single <ChevronRight size={15} /></Link> : null)}
        </li>)}</ul> : <p className="club-section-note">Fixtures are played as the Career calendar reaches each county round.</p>}</div>
      <div className="county-subsection county-individual"><div className="subsection-heading"><div><span className="career-eyebrow">SEASON {d.season} · INDIVIDUAL FINISHES</span><h3>County points</h3></div><span>SELECTION RANKING</span></div>
        <p className="club-section-note">Individual event finishes select the squads; they do not count as team match results.</p>
        <ol className="county-points-list">{d.county.standings.slice(0, 10).map(c => <li className={c.you ? "you-points" : ""} key={c.localityKey}><b>{String(c.position).padStart(2, "0")}</b><span>{c.you ? "You" : c.name}{c.you && <small>YOU</small>}</span><strong>{c.points}<small>PTS</small></strong></li>)}</ol>
      </div>
    </CareerSection>}

    <div className="club-pathway-grid">
      {d.nation && <CareerSection title={`${d.nation.name} · National team`} icon={<Flag aria-hidden />} accent="#d9bd69">
        <div className="national-callout"><span className="national-number">{d.nation.yourPlace ? String(d.nation.yourPlace).padStart(2, "0") : "—"}</span><span><small>YOUR PLACE IN LINE</small><b>{d.nation.selected ? "Selected on today’s rankings" : d.nation.yourPlace ? `${ordinal(d.nation.yourPlace)} in today’s rankings` : "No published ranking yet"}</b><em>World Cup of Darts · two players per nation</em></span><span className="selection-status">{d.nation.selected ? "SELECTED" : d.nation.yourPlace ? "IN CONTENTION" : "NOT RANKED"}</span></div>
        {d.nation.candidates.length > 0 && <ol className="national-ranking">{d.nation.candidates.map((c, i) => <li className={c.you ? "rank-you" : ""} key={c.key}><b>{String(i + 1).padStart(2, "0")}</b><span>{c.you ? <strong>You</strong> : <Link href={`${base}/world/players/${c.key}/profile`}>{c.name}</Link>}{i < 2 && <small> IN THE TEAM</small>}</span><em>{c.ranking}<small>RANK</small></em></li>)}</ol>}
        {d.nation.worldCups.length > 0 && <div className="world-cup-history"><span className="career-eyebrow">WORLD CUP HISTORY</span>{d.nation.worldCups.map(w => <div key={w.season}><span>SEASON {w.season}</span><b>{w.players.join(" & ")}</b><em>{w.you ? "You played" : "Represented " + d.nation!.name}</em></div>)}</div>}
      </CareerSection>}
      <CareerSection title="Club history" icon={<Medal aria-hidden />} accent="#d9bd69">
        {honours.length > 0 && <div className="heritage-highlight"><span><Trophy size={22} /></span><div><span className="career-eyebrow">DIVISION CHAMPIONS</span><h3>{honours.length} title{honours.length === 1 ? "" : "s"}</h3><p>{honours.map(h => `Division ${h.division} · Season ${h.season}`).join(" · ")}</p></div><b>{String(honours.length).padStart(2, "0")}</b></div>}
        {d.history.length ? <ul className="career-club__history">{[...d.history].reverse().map(h => <li key={h.season}><span>SEASON {h.season}</span><span>Division {h.division} · {ordinal(h.position)} · {h.points} pts</span><em>{h.champions ? "Champions" : h.promoted ? "Promoted" : h.relegated ? "Relegated" : ""}</em></li>)}</ul>
          : <p className="club-section-note">The club’s first season is under way.</p>}
      </CareerSection>
    </div>

    <div id="host-tournament" className="club-host-wrap"><div className="club-host-banner"><span className="host-seal"><Ticket size={21} /></span><div><span className="career-eyebrow">YOUR VENUE · YOUR TOURNAMENT</span><h2>Bring everyone to your oche.</h2><p>Run a local tournament at your venue. Configure the event and prize details before hosting.</p></div><span className="host-banner-detail"><b><Trophy size={18} /></b> HOST A LOCAL OPEN</span></div>
      <CareerSection title="Run your own tournament" icon={<Trophy aria-hidden />} accent="#d9bd69"><HostTournament saveId={ctx.save.id} retired={!!ctx.save.retiredAt} /></CareerSection>
    </div>
    <div className="club-footer-rule"><span>{d.club.name.toUpperCase()}</span><i /><span>{d.club.region.toUpperCase()} · COUNTY CIRCUIT</span><i /><span>CAREER / CLUB</span></div>
  </main>;
}
