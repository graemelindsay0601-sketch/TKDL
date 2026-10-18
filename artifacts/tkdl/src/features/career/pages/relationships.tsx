import { useState } from "react";
import { Link } from "wouter";
import { useCareerRelationships, usePresentation } from "../api";
import { Swords } from "lucide-react";
import { CareerSection, CareerEmptyState, Flag, QueryState } from "../components";
import { CareerShirt } from "../identity";
import { CareerPageHero } from "../page-hero";
import type { ShellContext } from "../shell";
import type { Meeting, OpponentRelationship, WorldIdentity } from "../../../../../api-server/src/career/relationships/types";

const when = (m: Meeting | null) => m ? `${m.date ?? `Season ${m.season}, day ${m.day}`} · ${m.name}` : "Not played yet";
const identity = (p: WorldIdentity) => `${p.homeRegion} · Age ${p.age}${p.status === "RETIRED" ? " at retirement" : ""} · ${p.status === "RETIRED" ? `Retired (season ${p.retiredSeason})` : "Active"} · ${p.worldRanking === null ? "No current World Ranking" : `World #${p.worldRanking}`}`;
const FILTERS = ["All opponents", "Career Rival", "Nemesis", "Favourite Opponent", "Familiar Opponent", "Generation Rival", "Q-School Class", "Junior Contemporary"] as const;
export function RelationshipsPage({ ctx }: { ctx: ShellContext }) {
  const query = useCareerRelationships(ctx.save.id);
  const presentation = usePresentation(ctx.save.id, Boolean(query.data?.opponents.length));
  const [filter,setFilter] = useState<string>("All opponents"), [search,setSearch] = useState("");
  const [worldFilter,setWorldFilter] = useState("ACTIVE"), [worldSearch,setWorldSearch] = useState(""), [limit,setLimit] = useState(30);
  const opponents = query.data?.opponents.filter(o=>(filter==="All opponents" || o.labels.some(l=>l===filter)) && o.player.name.toLowerCase().includes(search.toLowerCase())) ?? [];
  const featuredOpponent = opponents[0];
  return <div className="space-y-3">
    {query.data && <CareerPageHero kicker="Relationships · rivalries" title="Head-to-head" accent="#ff5d5d"
      stage={{ venue: { venueType: "studio" }, eventClass: "STAGE_SERIES" }} archival={ctx.retired}
      subtitle="Sporting history, not personality. Labels describe played results and shared cohorts; they never change scoring, draws, rankings or rewards."
      stats={[
        { label: "Opponents faced", value: query.data.opponents.length },
        { label: "Your H2H wins", tone: "good", value: query.data.opponents.reduce((n, o) => n + o.humanWins, 0) },
        { label: "Their wins", tone: "bad", value: query.data.opponents.reduce((n, o) => n + o.npcWins, 0) },
        { label: "Labelled rivals", value: query.data.opponents.filter(o => o.labels.length).length, tone: "gold" },
      ]} />}
    {featuredOpponent && <section className="career-relationships-showcase" aria-label="Featured head-to-head record">
      <div className="career-relationships-showcase__eyebrow"><span>Head-to-head spotlight</span><span>Based on played results</span></div>
      <div className="career-relationships-showcase__matchup">
        <div className="career-relationships-showcase__side">
          {presentation.data && <span className="career-relationships-showcase__kit"><CareerShirt identity={presentation.data.identity} sponsors={presentation.data.placements} name={ctx.save.careerName ?? "You"} scale="featured" /></span>}
          <div className="career-relationships-showcase__identity">
            <span>Your record</span><strong>{ctx.save.careerName ?? "You"}</strong>
          </div>
        </div>
        <div className="career-relationships-showcase__score">
          <span>{featuredOpponent.meetings ? "Head-to-head" : "Shared sporting history"}</span>
          {featuredOpponent.meetings
            ? <strong aria-label={`${featuredOpponent.humanWins} wins to ${featuredOpponent.npcWins}`}>{featuredOpponent.humanWins}<i>–</i>{featuredOpponent.npcWins}</strong>
            : <strong className="career-relationships-showcase__no-score">No matches yet</strong>}
          <small>{featuredOpponent.meetings} {featuredOpponent.meetings === 1 ? "meeting" : "meetings"}{featuredOpponent.winPercentage === null ? "" : ` · ${featuredOpponent.winPercentage}% wins`}</small>
        </div>
        <div className="career-relationships-showcase__side career-relationships-showcase__side--opponent">
          <span className="career-relationships-showcase__kit"><CareerShirt playerId={featuredOpponent.player.id} name={featuredOpponent.player.name} scale="featured" /></span>
          <div className="career-relationships-showcase__identity">
            <span><Flag code={featuredOpponent.player.nationality} /> Featured opponent</span><strong>{featuredOpponent.player.name}</strong>
            <div className="career-relationships-showcase__labels">{featuredOpponent.labels.map(label=><i key={label}>{label}</i>)}</div>
          </div>
        </div>
      </div>
      {featuredOpponent.evidence.length > 0 && <p className="career-relationships-showcase__evidence">{featuredOpponent.evidence[0]}</p>}
    </section>}
    <CareerSection title="Opponents" icon={<Swords aria-hidden />} accent="#ff5d5d">
      <QueryState query={query} label="Reading opponent history">{data=>{
        const world = data.world.players.filter(p=>p.name.toLowerCase().includes(worldSearch.toLowerCase()) &&
          (worldFilter==="ALL" || (worldFilter==="YOUNG" ? p.status==="ACTIVE" && p.age<=data.world.youngAgeMaximum : p.status===worldFilter)));
        return <div className="p-4 pt-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <label className="text-xs">Relationship <select value={filter} onChange={e=>setFilter(e.target.value)} className="block bg-black/60 rounded p-2 border border-white/20">
              {FILTERS.map(f=><option key={f}>{f}</option>)}</select></label>
            <label className="text-xs">Find opponent <input type="search" value={search} onChange={e=>setSearch(e.target.value)} className="block bg-black/60 rounded p-2 border border-white/20" /></label>
          </div>
          <p className="text-xs text-white/60">{opponents.length} of {data.opponents.length} opponents and historical cohort members. Unlabelled opponents still have factual H2H records.</p>
          {!opponents.length && <CareerEmptyState title="No opponent history here yet">Played matches build H2H. Shared played Q-School sessions or Junior events establish cohorts; a single match does not establish a rivalry.</CareerEmptyState>}
          <div className="career-rivals">{opponents.map(o=><OpponentPanel key={o.player.id} opponent={o} saveId={ctx.save.id} />)}</div>
          <h3 className="career-generations__title">Career generations</h3>
          <dl className="career-generations__stats">
            <div><dt>Active</dt><dd>{data.world.active}</dd></div><div><dt>Retired</dt><dd>{data.world.retired}</dd></div>
            <div><dt>New this season</dt><dd>{data.world.newEntrants}</dd></div><div><dt>Aged {data.world.youngAgeMaximum} or under</dt><dd>{data.world.youngPlayers}</dd></div>
          </dl>
          <details className="career-note"><summary>About generations</summary><p>Young age is context, not a promise of future success. New entrants use the existing junior/grassroots pathways. Retired identities and sporting records remain in this save.</p></details>
          <div className="career-generations__filters">
            <label>World players <select value={worldFilter} onChange={e=>{setWorldFilter(e.target.value);setLimit(30);}}>
              <option value="ACTIVE">Active players</option><option value="YOUNG">Young players ({data.world.youngAgeMaximum} or under)</option><option value="RETIRED">Retired players</option><option value="ALL">All generations</option>
            </select></label>
            <label>Find world player <input type="search" value={worldSearch} placeholder="Search a name" onChange={e=>{setWorldSearch(e.target.value);setLimit(30);}} /></label>
          </div>
          {!world.length && <CareerEmptyState title="No players in this view" />}
          <ul className="career-generations__grid">{world.slice(0,limit).map(p=><li key={p.id} className="career-generations__card">
            <span className="career-generations__shirt" aria-hidden="true"><CareerShirt playerId={p.id} name={p.name} scale="compact"/></span>
            <div className="min-w-0"><strong><Flag code={p.nationality} /> {p.name}</strong><small>{identity(p)} · {p.createdSeason===1 ? "Starting generation" : `Entered in season ${p.createdSeason}`}</small>
             <div className="career-generations__links"><Link href={`/career/${ctx.save.id}/world/players/${p.id}/profile`}>Player profile</Link><Link href={`/career/${ctx.save.id}/recognition/npcs/${p.id}`}>Public sporting recognition</Link></div></div>
          </li>)}</ul>
          {world.length>limit && <button className="career-btn career-btn-ghost" onClick={()=>setLimit(limit+30)}>Show more ({world.length-limit} remaining)</button>}
        </div>;
      }}</QueryState>
    </CareerSection>
  </div>;
}
export function OpponentPanel({ opponent:o, saveId }: { opponent:OpponentRelationship; saveId:string }) {
  const lead = o.humanWins > o.npcWins ? "is-ahead" : o.humanWins < o.npcWins ? "is-behind" : "is-level";
  return <details className={`career-rival ${lead}`}>
    <summary className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]">
      <span className="career-rival__shirt" aria-hidden="true"><CareerShirt playerId={o.player.id} name={o.player.name} scale="standard" /></span>
      <span className="career-rival__who"><span><Flag code={o.player.nationality} /> <strong>{o.player.name}</strong></span>
        <span className="block text-sm">{o.meetings} {o.meetings===1 ? "meeting" : "meetings"}{o.meetings ? ` · H2H ${o.humanWins}–${o.npcWins}` : " · No H2H record"}{o.winPercentage===null ? "" : ` · ${o.winPercentage}% wins`}</span>
        <span className="career-rival__labels">{o.labels.length ? o.labels.map(l => <i key={l}>{l}</i>) : <em>No special relationship yet</em>}</span></span>
      <span className="career-rival__score" aria-hidden="true"><b>{o.humanWins}</b><small>–</small><b>{o.npcWins}</b></span>
    </summary>
    <div className="pt-3 space-y-2 text-sm">
      <p>{identity(o.player)}</p>
       <div className="flex flex-wrap gap-3"><Link className="underline text-xs" href={`/career/${saveId}/world/players/${o.player.id}/profile`}>Player profile</Link><Link className="underline text-xs" href={`/career/${saveId}/world/rivalries/${o.player.id}`}>Rivalry detail</Link><Link className="underline text-xs" href={`/career/${saveId}/recognition/npcs/${o.player.id}`}>Public sporting recognition</Link></div>
      <p>First: {when(o.firstMeeting)}<br />Latest: {when(o.latestMeeting)}</p>
      <p>{o.eventCount} events · {o.seasonCount} seasons · {o.finals} finals · {o.majorMeetings} major/world meetings · {o.qualificationMeetings} qualification meetings</p>
      <ul className="text-xs text-white/70">{o.evidence.map(e=><li key={e}>{e}</li>)}</ul>
      {o.cohorts.length>0 && <ul className="text-xs">{o.cohorts.map(c=><li key={`${c.kind}:${c.season}:${c.session}`}>{c.kind} · Season {c.season} · {c.name} · Both played in this {c.kind==="Q-School Class" ? "session" : "event"}.</li>)}</ul>}
      <h4 className="font-bold">Played meetings</h4>
      <ul className="space-y-2">{o.history.map(m=><li key={m.id} className="border-t border-white/10 pt-2">
        <Link href={`/career/${saveId}/events/${m.eventId}`} className="underline">{when(m)}</Link>
        <span className="block text-xs">{m.won ? "Won" : "Lost"} · {m.stage} · Round {m.round}{m.final ? " · Final" : ""}{m.major ? " · Major/world" : ""}{m.qualification ? " · Qualification" : ""}
          {m.legsHuman===null || m.legsNpc===null ? "" : ` · Legs ${m.legsHuman}–${m.legsNpc}`}
          {m.setsHuman===null || m.setsNpc===null ? "" : ` · Sets ${m.setsHuman}–${m.setsNpc}`}</span>
      </li>)}</ul>
    </div>
  </details>;
}
