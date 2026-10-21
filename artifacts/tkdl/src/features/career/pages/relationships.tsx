import { useState } from "react";
import { ArrowUpRight, ChevronDown, Search, Swords } from "lucide-react";
import { Link } from "wouter";
import { useCareerRelationships } from "../api";
import { CareerEmptyState, Flag, QueryState } from "../components";
import type { ShellContext } from "../shell";
import type { Meeting, OpponentRelationship, WorldIdentity } from "../../../../../api-server/src/career/relationships/types";
import "./relationships-premium.css";

const FILTERS = ["All opponents", "Career Rival", "Nemesis", "Favourite Opponent", "Familiar Opponent", "Generation Rival", "Q-School Class", "Junior Contemporary"] as const;
const when = (m: Meeting | null) => m ? `${m.date ?? `Season ${m.season}, day ${m.day}`} · ${m.name}` : "Not played yet";
const identity = (p: WorldIdentity) => `${p.homeRegion} · Age ${p.age}${p.status === "RETIRED" ? " at retirement" : ""} · ${p.status === "RETIRED" ? `Retired (season ${p.retiredSeason})` : "Active"} · ${p.worldRanking === null ? "No current World Ranking" : `World #${p.worldRanking}`}`;

function PlayerLinks({ playerId, saveId, rivalry = false }: { playerId: string; saveId: string; rivalry?: boolean }) {
  return <nav className="rel3-links" aria-label="Player links">
    <Link href={`/career/${saveId}/world/players/${playerId}/profile`}>Player profile <ArrowUpRight size={13} aria-hidden /></Link>
    {rivalry && <Link href={`/career/${saveId}/world/rivalries/${playerId}`}>Rivalry detail <ArrowUpRight size={13} aria-hidden /></Link>}
    <Link href={`/career/${saveId}/recognition/npcs/${playerId}`}>Public sporting recognition <ArrowUpRight size={13} aria-hidden /></Link>
  </nav>;
}

function RivalRecord({ opponent, saveId }: { opponent: OpponentRelationship; saveId: string }) {
  const lead = opponent.humanWins > opponent.npcWins ? "ahead" : opponent.humanWins < opponent.npcWins ? "behind" : "level";
  return <details className={`rel3-rival rel3-rival--${lead}`}>
    <summary>
      <span className="rel3-rival__order" aria-hidden="true">01</span>
      <span className="rel3-rival__name">
        <span className="rel3-rival__nation"><Flag code={opponent.player.nationality} /></span>
        <strong>{opponent.player.name}</strong>
        <small>{opponent.meetings} {opponent.meetings === 1 ? "meeting" : "meetings"} <i>·</i> {opponent.labels[0] ?? "No special relationship yet"}</small>
      </span>
      <span className="rel3-rival__labels">{opponent.labels.length ? opponent.labels.map(label => <em key={label}>{label}</em>) : <i>No special relationship yet</i>}</span>
      <span className="rel3-rival__record" aria-label={`Head-to-head ${opponent.humanWins} wins to ${opponent.npcWins}`}>
        <b>{opponent.humanWins}</b><i>–</i><b>{opponent.npcWins}</b><small>W—L</small>
      </span>
      <span className="rel3-rival__expand" aria-hidden="true"><ChevronDown size={17} /></span>
    </summary>
    <div className="rel3-rival__details">
      <div className="rel3-rival__bio">
        <p>{identity(opponent.player)}</p>
        <PlayerLinks playerId={opponent.player.id} saveId={saveId} rivalry />
      </div>
      <div className="rel3-meetings">
        <div><span>FIRST MEETING</span><strong>{when(opponent.firstMeeting)}</strong></div>
        <div><span>LATEST MEETING</span><strong>{when(opponent.latestMeeting)}</strong></div>
      </div>
      <p className="rel3-rival__totals">{opponent.eventCount} events <i>·</i> {opponent.seasonCount} seasons <i>·</i> {opponent.finals} finals <i>·</i> {opponent.majorMeetings} major/world meetings <i>·</i> {opponent.qualificationMeetings} qualification meetings</p>
      {opponent.evidence.length > 0 && <ul className="rel3-evidence">{opponent.evidence.map(item => <li key={item}>{item}</li>)}</ul>}
      {opponent.cohorts.length > 0 && <ul className="rel3-cohorts">{opponent.cohorts.map(cohort => <li key={`${cohort.kind}:${cohort.season}:${cohort.session}`}><b>{cohort.kind}</b> · Season {cohort.season} · {cohort.name} · Both played in this {cohort.kind === "Q-School Class" ? "session" : "event"}.</li>)}</ul>}
      <h3 className="rel3-last-match__title">Played meetings</h3>
      <ul className="rel3-history">{opponent.history.map(meeting => <li key={meeting.id}>
        <span className="rel3-history__mark" aria-hidden="true">{meeting.won ? "W" : "L"}</span>
        <div><Link href={`/career/${saveId}/events/${meeting.eventId}`}>{when(meeting)} <ArrowUpRight size={12} aria-hidden /></Link>
          <small>{meeting.won ? "Won" : "Lost"} · {meeting.stage} · Round {meeting.round}{meeting.final ? " · Final" : ""}{meeting.major ? " · Major/world" : ""}{meeting.qualification ? " · Qualification" : ""}
            {meeting.legsHuman === null || meeting.legsNpc === null ? "" : ` · Legs ${meeting.legsHuman}–${meeting.legsNpc}`}
            {meeting.setsHuman === null || meeting.setsNpc === null ? "" : ` · Sets ${meeting.setsHuman}–${meeting.setsNpc}`}</small>
        </div>
      </li>)}</ul>
    </div>
  </details>;
}

export function RelationshipsPage({ ctx }: { ctx: ShellContext }) {
  const query = useCareerRelationships(ctx.save.id);
  const [filter, setFilter] = useState<string>("All opponents");
  const [search, setSearch] = useState("");
  const [worldFilter, setWorldFilter] = useState("ACTIVE");
  const [worldSearch, setWorldSearch] = useState("");
  const [limit, setLimit] = useState(30);

  return <QueryState query={query} label="Reading opponent history">{data => {
    const opponents = data.opponents.filter(opponent =>
      (filter === "All opponents" || opponent.labels.some(label => label === filter)) &&
      opponent.player.name.toLowerCase().includes(search.toLowerCase())
    );
    const featured = opponents[0];
    const world = data.world.players.filter(player =>
      player.name.toLowerCase().includes(worldSearch.toLowerCase()) &&
      (worldFilter === "ALL" || (worldFilter === "YOUNG"
        ? player.status === "ACTIVE" && player.age <= data.world.youngAgeMaximum
        : player.status === worldFilter))
    );
    const humanWins = data.opponents.reduce((sum, opponent) => sum + opponent.humanWins, 0);
    const npcWins = data.opponents.reduce((sum, opponent) => sum + opponent.npcWins, 0);
    const labelled = data.opponents.filter(opponent => opponent.labels.length > 0).length;
    const leader = featured ? featured.humanWins > featured.npcWins : false;

    return <main className="rel3-page">
      <div className="rel3-shell">
        <div className="rel3-topline">
          <div className="rel3-brand"><span className="rel3-brand__block">TK<span>DL</span></span><span className="rel3-brand__sub">CAREER / COMPETITION RECORD</span></div>
          <p>Sporting record <i>·</i> {ctx.retired ? "Career archive" : `Season ${ctx.save.currentSeason} · Week ${ctx.save.currentWeek}`}</p>
        </div>

        <header className="rel3-hero" aria-labelledby="relationships-title">
          <div className="rel3-hero__content">
            <p className="rel3-kicker"><span /> THE RIVALRY ARCHIVE <b>—</b> SEASON RECORD</p>
            <h1 id="relationships-title">Head to<br /><em>head.</em></h1>
            <p className="rel3-hero__intro">Sporting history, not personality. Every label is earned on the oche, through played results and shared cohorts — never through scoring, rankings or rewards.</p>
            <div className="rel3-hero__foot">
              <div className="rel3-hero__mark"><Swords size={17} aria-hidden /><span>Records that<br />remember.</span></div>
              <div className="rel3-hero__stats">
                <div><strong>{String(data.opponents.length).padStart(2, "0")}</strong><span>Opponents faced</span></div>
                <div><strong>{humanWins}</strong><span>Your H2H wins</span></div>
                <div><strong>{npcWins}</strong><span>Their wins</span></div>
                <div><strong>{String(labelled).padStart(2, "0")}</strong><span>Labelled rivals</span></div>
              </div>
            </div>
          </div>
          <div className="rel3-hero__edition" aria-hidden="true"><span>TKDL</span><b>OFFICIAL</b><i>PLAYER RECORD</i></div>
          <div className="rel3-hero__caption"><span>TOUR FLOOR</span><i>·</i><span>LIGHTS ON</span></div>
        </header>

        {featured && <section className="rel3-feature" aria-label="Featured head-to-head record">
          <div className="rel3-feature__masthead"><span><i /> THE CURRENT MATCHUP</span><b>Based on played results</b></div>
          <div className="rel3-scoreboard">
            <div className="rel3-contender rel3-contender--home">
              <span className="rel3-contender__index">YOUR RECORD</span>
              <strong>{ctx.save.careerName ?? "You"}</strong>
              <span className="rel3-contender__role">PLAYER 01</span>
            </div>
            <div className="rel3-score">
              <div className="rel3-score__digits">{featured.meetings ? <><strong>{featured.humanWins}</strong><i>–</i><strong>{featured.npcWins}</strong></> : <strong className="rel3-score__empty">—</strong>}</div>
              <span>{featured.meetings ? "HEAD TO HEAD" : "SHARED SPORTING HISTORY"}</span>
              <small>{featured.meetings} {featured.meetings === 1 ? "meeting" : "meetings"}{featured.winPercentage === null ? "" : ` · ${featured.winPercentage}% wins`}</small>
            </div>
            <div className="rel3-contender rel3-contender--away">
              <span className="rel3-contender__index"><Flag code={featured.player.nationality} /> OPPONENT</span>
              <strong>{featured.player.name}</strong>
              <span className="rel3-labels">{featured.labels.map(label => <em key={label}>{label}</em>)}</span>
            </div>
            <div className={`rel3-scoreboard__verdict ${leader ? "is-positive" : featured.humanWins === featured.npcWins ? "is-level" : "is-negative"}`}>
              <span>{leader ? "ADVANTAGE" : featured.humanWins === featured.npcWins ? "LEVEL" : "TRAILING"}</span><i />
            </div>
          </div>
          {featured.evidence.length > 0 && <p className="rel3-feature__evidence"><span>FORM LINE</span>{featured.evidence[0]}</p>}
        </section>}

        <section className="rel3-opponents" aria-labelledby="opponents-title">
          <div className="rel3-section-title">
            <div><span className="rel3-section-title__number">01</span><div><small>PLAYED HISTORY</small><h2 id="opponents-title">Opponents</h2></div></div>
            <span className="rel3-section-title__count">{opponents.length}<i> / </i>{data.opponents.length}<small>records</small></span>
          </div>
          <div className="rel3-controls">
            <label><span>Relationship</span><select value={filter} onChange={event => setFilter(event.target.value)}>{FILTERS.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={15} aria-hidden /></label>
            <label className="rel3-controls__search"><span>Find opponent</span><div><Search size={16} aria-hidden /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search a name" /></div></label>
            <p>{opponents.length} of {data.opponents.length} opponents and historical cohort members. Unlabelled opponents still have factual H2H records.</p>
          </div>
          <div className="rel3-ledger">
            {opponents.map((opponent, index) => <RivalRecord key={opponent.player.id} opponent={opponent} saveId={ctx.save.id} />)}
            {!opponents.length && <CareerEmptyState title="No opponent history here yet">Played matches build head-to-head records. Shared played Q-School sessions or Junior events establish cohorts; a single match does not establish a rivalry.</CareerEmptyState>}
          </div>
        </section>

        <section className="rel3-generations" aria-labelledby="generation-summary-title">
          <div className="rel3-generation-title"><span>02</span><div><small>THE WIDER FIELD</small><h2 id="generation-summary-title">Career generations</h2></div></div>
          <div className="rel3-generation-metrics">
            <div className="rel3-metric rel3-metric--red"><strong>{String(data.world.active).padStart(2, "0")}</strong><span>Active</span></div>
            <div className="rel3-metric rel3-metric--soft"><strong>{String(data.world.retired).padStart(2, "0")}</strong><span>Retired</span></div>
            <div className="rel3-metric rel3-metric--gold"><strong>{String(data.world.newEntrants).padStart(2, "0")}</strong><span>New this season</span></div>
            <div className="rel3-metric rel3-metric--cream"><strong>{String(data.world.youngPlayers).padStart(2, "0")}</strong><span>Aged {data.world.youngAgeMaximum} or under</span></div>
          </div>
          <details className="rel3-generation-note"><summary>About generations <ChevronDown size={15} aria-hidden /></summary><p>Young age is context, not a promise of future success. New entrants use the existing junior and grassroots pathways. Retired identities and sporting records remain in this save.</p></details>
        </section>

        <div className="rel3-world-toolbar">
          <div className="rel3-section-title rel3-section-title--world"><div><span className="rel3-section-title__number">03</span><div><small>ALL ERAS · ALL IDENTITIES</small><h2>The generation</h2></div></div></div>
          <div className="rel3-controls rel3-controls--world">
            <label><span>World players</span><select value={worldFilter} onChange={event => { setWorldFilter(event.target.value); setLimit(30); }}>
              <option value="ACTIVE">Active players</option><option value="YOUNG">Young players ({data.world.youngAgeMaximum} or under)</option><option value="RETIRED">Retired players</option><option value="ALL">All generations</option>
            </select><ChevronDown size={15} aria-hidden /></label>
            <label className="rel3-controls__search"><span>Find world player</span><div><Search size={16} aria-hidden /><input type="search" value={worldSearch} onChange={event => { setWorldSearch(event.target.value); setLimit(30); }} placeholder="Search a name" /></div></label>
          </div>
        </div>
        <ul className="rel3-world">
          {world.slice(0, limit).map((player, index) => <li key={player.id}>
            <span className="rel3-world__number">{String(index + 1).padStart(2, "0")}</span>
            <span className="rel3-world__monogram" aria-hidden="true">{player.name.split(" ").map(part => part[0]).join("")}</span>
            <div className="rel3-world__identity"><strong><Flag code={player.nationality} />{player.name}</strong><small>{identity(player)} · {player.createdSeason === 1 ? "Starting generation" : `Entered in season ${player.createdSeason}`}</small><PlayerLinks playerId={player.id} saveId={ctx.save.id} /></div>
            <span className={`rel3-status rel3-status--${player.status.toLowerCase()}`}>{player.status === "RETIRED" ? "Retired" : "Active"}</span>
          </li>)}
        </ul>
        {!world.length && <CareerEmptyState title="No players in this view" />}
        {world.length > limit && <button className="rel3-more" onClick={() => setLimit(limit + 30)}>Show more <span>({world.length - limit} remaining)</span><ChevronDown size={16} aria-hidden /></button>}
        <footer className="rel3-footer"><span>TKDL <i>/</i> Career archive</span><span>All records are from this save</span></footer>
      </div>
    </main>;
  }}</QueryState>;
}
