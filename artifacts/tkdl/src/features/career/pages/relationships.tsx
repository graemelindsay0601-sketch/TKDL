import { useState } from "react";
import { Link } from "wouter";
import { useCareerRelationships } from "../api";
import { CareerSection, CareerEmptyState, Flag, QueryState } from "../components";
import type { ShellContext } from "../shell";
import type { Meeting, OpponentRelationship, WorldIdentity } from "../../../../../api-server/src/career/relationships/types";

const when = (m: Meeting | null) => m ? `${m.date ?? `Season ${m.season}, day ${m.day}`} · ${m.name}` : "No played meeting";
const identity = (p: WorldIdentity) => `${p.homeRegion} · Age ${p.age}${p.status === "RETIRED" ? " at retirement" : ""} · ${p.status === "RETIRED" ? `Retired (season ${p.retiredSeason})` : "Active"} · ${p.worldRanking === null ? "No current World Ranking" : `World #${p.worldRanking}`}`;
const FILTERS = ["All opponents", "Career Rival", "Nemesis", "Favourite Opponent", "Familiar Opponent", "Generation Rival", "Q-School Class", "Junior Contemporary"] as const;
export function RelationshipsPage({ ctx }: { ctx: ShellContext }) {
  const query = useCareerRelationships(ctx.save.id);
  const [filter,setFilter] = useState<string>("All opponents"), [search,setSearch] = useState("");
  const [worldFilter,setWorldFilter] = useState("ACTIVE"), [worldSearch,setWorldSearch] = useState(""), [limit,setLimit] = useState(30);
  return <div className="space-y-3">
    <CareerSection title="Relationships & head-to-head">
      <p className="p-4 text-sm text-white/70">Sporting history, not personality. Labels describe played results and shared cohorts; they never change scoring, draws, rankings or rewards.</p>
      <QueryState query={query} label="Reading opponent history">{data=>{
        const opponents = data.opponents.filter(o=>(filter==="All opponents" || o.labels.some(l=>l===filter)) && o.player.name.toLowerCase().includes(search.toLowerCase()));
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
          {opponents.map(o=><OpponentPanel key={o.player.id} opponent={o} saveId={ctx.save.id} />)}
          <h3 className="font-bold pt-3">Career generations</h3>
          <p className="text-sm text-white/70">{data.world.active} active · {data.world.retired} retired · {data.world.newEntrants} new entrants this season · {data.world.youngPlayers} active aged {data.world.youngAgeMaximum} or under</p>
          <p className="text-xs text-white/60">Young age is context, not a promise of future success. New entrants use the existing junior/grassroots pathways. Retired identities and sporting records remain in this save.</p>
          <div className="flex flex-wrap gap-2">
            <label className="text-xs">World players <select value={worldFilter} onChange={e=>{setWorldFilter(e.target.value);setLimit(30);}} className="block bg-black/60 rounded p-2 border border-white/20">
              <option value="ACTIVE">Active players</option><option value="YOUNG">Young players ({data.world.youngAgeMaximum} or under)</option><option value="RETIRED">Retired players</option><option value="ALL">All generations</option>
            </select></label>
            <label className="text-xs">Find world player <input type="search" value={worldSearch} onChange={e=>{setWorldSearch(e.target.value);setLimit(30);}} className="block bg-black/60 rounded p-2 border border-white/20" /></label>
          </div>
          {!world.length && <CareerEmptyState title="No players in this view" />}
          <ul className="space-y-2">{world.slice(0,limit).map(p=><li key={p.id} className="border-b border-white/10 pb-2 text-sm">
            <Flag code={p.nationality} /> {p.name}<span className="block text-xs text-white/60">{identity(p)} · {p.createdSeason===1 ? "Starting generation" : `Entered in season ${p.createdSeason}`}</span>
            <Link className="underline text-xs" href={`/career/${ctx.save.id}/recognition/npcs/${p.id}`}>Public sporting recognition</Link>
          </li>)}</ul>
          {world.length>limit && <button className="career-btn career-btn-ghost" onClick={()=>setLimit(limit+30)}>Show more ({world.length-limit} remaining)</button>}
        </div>;
      }}</QueryState>
    </CareerSection>
  </div>;
}
export function OpponentPanel({ opponent:o, saveId }: { opponent:OpponentRelationship; saveId:string }) {
  return <details className="rounded-xl border border-white/15 p-3">
    <summary className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]">
      <Flag code={o.player.nationality} /> <strong>{o.player.name}</strong>
      <span className="block text-sm">{o.meetings} meetings · H2H {o.humanWins}–{o.npcWins}{o.winPercentage===null ? "" : ` · ${o.winPercentage}% wins`}</span>
      <span className="block text-xs text-white/70">{o.labels.join(" · ") || "No special relationship yet"}</span>
    </summary>
    <div className="pt-3 space-y-2 text-sm">
      <p>{identity(o.player)}</p>
      <Link className="underline text-xs" href={`/career/${saveId}/recognition/npcs/${o.player.id}`}>Public sporting recognition</Link>
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
