import { Link } from "wouter";
import { CareerEmptyState, CareerSection, StatTile } from "../components";
import type { CareerFacts, Fact } from "../../../../../api-server/src/career/facts/types";

const value = (n: number | null | undefined) => n == null ? "Unavailable" : n;
export function FactsOverview({ facts }: { facts: CareerFacts }) {
  const s = facts.statistics;
  return <><p className="text-xs text-muted-foreground">Complete Career totals from A3 completed matches and event results. Byes and walkovers are not played matches. Events entered counts completed events with a human result.</p>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <StatTile label="Matches played" value={s.matchesPlayed} /><StatTile label="Won / lost" value={`${s.wins} / ${s.losses}`} />
      <StatTile label="Win percentage" value={s.winPercentage == null ? '—' : `${s.winPercentage}%`} />
      <StatTile label="Completed events entered" value={s.eventsEntered} /><StatTile label="Runner-up finishes" value={s.runnersUp} />
      <StatTile label="Semi / quarter finals" value={`${s.semiFinals} / ${s.quarterFinals}`} /><StatTile label="Current win streak" value={value(s.currentWinningStreak)} />
      <StatTile label="Longest win streak" value={value(s.longestWinningStreak)} /><StatTile label="Seasons with play" value={s.seasonsPlayed} />
      <StatTile label="Best event finish" value={s.bestFinish ? `#${s.bestFinish.position}` : '—'} sub={s.bestFinish?.name} />
    </div></>;
}
export function PerformancePanel({ facts }: { facts: CareerFacts }) {
  const p = facts.performance;
  return <CareerSection title="Recorded playing statistics">
    <p className="p-3 text-sm text-muted-foreground">{p.recordedMatches} completed matches with usable human dart evidence; {p.unavailableMatches} without it. These figures cover recorded matches only, not simulated NPC averages. Scoring visits use points actually deducted, with busts scoring zero.</p>
    {p.recordedMatches === 0 ? <CareerEmptyState title="No recorded dart evidence yet">Complete a live Career match to start your playing statistics. Older score-only results remain in your sporting totals.</CareerEmptyState> :
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3">
        <StatTile label="Three-dart average" value={value(p.threeDartAverage)} /><StatTile label="Recorded darts" value={value(p.darts)} />
        <StatTile label="180s" value={value(p.maximums)} /><StatTile label="140+ visits" value={value(p.visits140Plus)} sub="Includes 180s" />
        <StatTile label="100+ visits" value={value(p.visits100Plus)} sub="Includes 140+ visits" /><StatTile label="Highest visit" value={value(p.highestVisit)} />
        <StatTile label="Checkouts completed" value={value(p.checkoutsCompleted)} /><StatTile label="Highest checkout" value={value(p.highestCheckout)} />
      </div>}
    <p className="p-3 text-xs text-muted-foreground">Checkout attempts and checkout percentage are unavailable: the dart log records hits, not the intended target. No aiming intent is inferred.</p>
  </CareerSection>;
}
function FactLine({ fact, saveId }: { fact: Fact; saveId: string }) {
  return <li className="border-b border-white/10 py-2 text-sm">
    <div className="text-xs text-muted-foreground">S{fact.season}{fact.week ? ` · W${fact.week}` : ' · week not recorded'}{fact.date ? ` · ${fact.date}` : ''}{fact.age != null ? ` · Age ${fact.age}` : ''}</div>
    {fact.eventId ? <Link className="career-row-link" href={`/career/${saveId}/events/${fact.eventId}`}>{fact.label}</Link> : <span>{fact.label}</span>}
    <span className="block text-xs text-muted-foreground">{fact.source}</span>
  </li>;
}
export function FactsTimeline({ facts }: { facts: CareerFacts }) {
  return <CareerSection title="Career factual timeline"><p className="p-3 text-xs text-muted-foreground">Oldest first. Same-day facts have no implied time of day. Result ages are the stored age at event start; weekly facts use the start of the Career week.</p><ol className="px-3">{facts.timeline.map(f=><FactLine key={f.id} fact={f} saveId={facts.careerSaveId} />)}</ol></CareerSection>;
}
export function RecordsPanel({ facts }: { facts: CareerFacts }) {
  const r = facts.records, p = facts.performance;
  const records: [string, Fact | null][] = [['First competitive match',r.firstMatch],['First win',r.firstWin],['First final',r.firstFinal],['First title',r.firstTitle],['Latest title',r.latestTitle],['Best World Ranking',r.bestWorldRanking],['First Tour Card awarded',r.firstTourCard]];
  return <CareerSection title="Personal Career records"><ul className="p-3">{records.map(([name,f])=><li className="py-2" key={name}><strong>{name}</strong>{f ? <ul><FactLine fact={f} saveId={facts.careerSaveId}/></ul> : <p className="text-sm text-muted-foreground">Not recorded yet</p>}</li>)}</ul>
    <div className="grid grid-cols-2 gap-2 p-3"><StatTile label="Total titles" value={facts.statistics.titles}/><StatTile label="Longest winning streak" value={value(facts.statistics.longestWinningStreak)}/><StatTile label="Best recorded match average" value={value(p.bestMatchAverage?.value)}/><StatTile label="Most 180s in a recorded match" value={value(p.most180sMatch?.value)}/><StatTile label="Highest recorded checkout" value={value(p.highestCheckout)}/><StatTile label="Tour Cards regained" value={r.regainedTourCards.length}/></div>
    <h3 className="px-3 font-bold">Highest existing presentation tier won</h3>
    {r.highestTierTitles.length ? <ul className="p-3">{r.highestTierTitles.map(f=><FactLine key={f.id} fact={{...f,label:`${f.name} — ${f.presentationTier}`}} saveId={facts.careerSaveId}/>)}</ul> : <CareerEmptyState title="No titles yet"/>}
  </CareerSection>;
}
export function WorldHistoryPanel({ facts }: { facts: CareerFacts }) {
  return <div className="space-y-3"><CareerSection title="Event champions in this Career">
    {facts.world.champions.length ? <ul className="p-3">{[...facts.world.champions].reverse().map(f=><FactLine key={f.id} fact={{...f,label:`${f.name}: ${f.participantName} (${f.circuit})`}} saveId={facts.careerSaveId}/>)}</ul> : <CareerEmptyState title="No completed events yet"/>}
    </CareerSection><CareerSection title="Historical World Ranking leaders">{facts.world.rankingLeaders.length ? <ul className="p-3">{[...facts.world.rankingLeaders].reverse().map(f=><FactLine key={f.id} fact={{...f,label:`World #1: ${f.participantName}`}} saveId={facts.careerSaveId}/>)}</ul> : <CareerEmptyState title="No published World Ranking leaders yet"/>}</CareerSection></div>;
}
