import { ArrowUpToLine, CalendarRange, CheckCircle2, ChevronUp, ChevronsUp, Crosshair, Flame, Gauge, GitBranch, Medal, Percent, Scale, Sparkles, Star, Swords, Target, Trophy, Zap } from "lucide-react";
import { Link } from "wouter";
import { CareerEmptyState, CareerSection, StatTile } from "../components";
import { circuitLabel, publicText } from "../model";
import type { CareerFacts, Fact } from "../../../../../api-server/src/career/facts/types";

const value = (n: number | null | undefined) => n == null ? "Unavailable" : n;
export function FactsOverview({ facts }: { facts: CareerFacts }) {
  const s = facts.statistics;
  return <><p className="text-xs text-muted-foreground">Your totals from every match and event you've finished. Byes and walkovers don't count as matches played.</p>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <StatTile icon={<Swords size={16}/>} label="Matches played" value={s.matchesPlayed} /><StatTile icon={<Scale size={16}/>} label="Won / lost" value={`${s.wins} / ${s.losses}`} />
      <StatTile icon={<Percent size={16}/>} label="Win percentage" value={s.winPercentage == null ? '—' : `${s.winPercentage}%`} />
      <StatTile icon={<Target size={16}/>} label="Completed events entered" value={s.eventsEntered} /><StatTile icon={<Medal size={16}/>} label="Runner-up finishes" value={s.runnersUp} />
      <StatTile icon={<GitBranch size={16}/>} label="Semi / quarter finals" value={`${s.semiFinals} / ${s.quarterFinals}`} /><StatTile icon={<Flame size={16}/>} label="Current win streak" value={value(s.currentWinningStreak)} />
      <StatTile icon={<Zap size={16}/>} label="Longest win streak" value={value(s.longestWinningStreak)} /><StatTile icon={<CalendarRange size={16}/>} label="Seasons with play" value={s.seasonsPlayed} />
      <StatTile icon={<Trophy size={16}/>} label="Best event finish" value={s.bestFinish ? `#${s.bestFinish.position}` : '—'} sub={s.bestFinish?.name} />
    </div></>;
}
export function PerformancePanel({ facts }: { facts: CareerFacts }) {
  const p = facts.performance;
  return <CareerSection title="Recorded playing statistics">
    <p className="p-3 text-sm text-muted-foreground">{p.recordedMatches} completed matches with usable human dart evidence; {p.unavailableMatches} without it. These figures cover recorded matches only, not simulated NPC averages. Scoring visits use points actually deducted, with busts scoring zero.</p>
    {p.recordedMatches === 0 ? <CareerEmptyState title="No recorded dart evidence yet">Complete a live Career match to start your playing statistics. Older score-only results remain in your sporting totals.</CareerEmptyState> :
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3">
        <StatTile icon={<Gauge size={16}/>} label="Three-dart average" value={value(p.threeDartAverage)} /><StatTile icon={<Crosshair size={16}/>} label="Recorded darts" value={value(p.darts)} />
        <StatTile icon={<Star size={16}/>} label="180s" value={value(p.maximums)} /><StatTile icon={<ChevronsUp size={16}/>} label="140+ visits" value={value(p.visits140Plus)} sub="Includes 180s" />
        <StatTile icon={<ChevronUp size={16}/>} label="100+ visits" value={value(p.visits100Plus)} sub="Includes 140+ visits" /><StatTile icon={<ArrowUpToLine size={16}/>} label="Highest visit" value={value(p.highestVisit)} />
        <StatTile icon={<CheckCircle2 size={16}/>} label="Checkouts completed" value={value(p.checkoutsCompleted)} /><StatTile icon={<Sparkles size={16}/>} label="Highest checkout" value={value(p.highestCheckout)} />
      </div>}
    <p className="p-3 text-xs text-muted-foreground">Checkout attempts and checkout percentage are unavailable: the dart log records hits, not the intended target. No aiming intent is inferred.</p>
  </CareerSection>;
}
export function FactLine({ fact, saveId }: { fact: Fact; saveId: string }) {
  return <li className="career-fact text-sm">
    <div className="career-fact__when">S{fact.season}{fact.week ? ` · W${fact.week}` : ' · week not recorded'}{fact.date ? ` · ${fact.date}` : ''}{fact.age != null ? ` · Age ${fact.age}` : ''}</div>
    {fact.eventId ? <Link className="career-row-link" href={`/career/${saveId}/events/${fact.eventId}`}>{publicText(fact.label)}</Link> : <span>{publicText(fact.label)}</span>}
    <span className="career-fact__source">{publicText(fact.source)}</span>
  </li>;
}
export function FactsTimeline({ facts }: { facts: CareerFacts }) {
  return <CareerSection title="Career factual timeline"><p className="p-3 text-xs text-muted-foreground">Oldest first. Same-day facts have no implied time of day. Result ages are the stored age at event start; weekly facts use the start of the Career week.</p><ol className="px-3">{facts.timeline.map(f=><FactLine key={f.id} fact={f} saveId={facts.careerSaveId} />)}</ol></CareerSection>;
}
export function RecordsPanel({ facts }: { facts: CareerFacts }) {
  const r = facts.records, p = facts.performance;
  const records: [string, Fact | null][] = [['First competitive match',r.firstMatch],['First win',r.firstWin],['First final',r.firstFinal],['First title',r.firstTitle],['Latest title',r.latestTitle],['Best World Ranking',r.bestWorldRanking],['First Tour Card awarded',r.firstTourCard]];
  return <CareerSection title="Personal Career records"><ul className="p-3">{records.map(([name,f])=><li className="py-2" key={name}><strong>{name}</strong>{f ? <ul><FactLine fact={f} saveId={facts.careerSaveId}/></ul> : <p className="text-sm text-muted-foreground">Not recorded yet</p>}</li>)}</ul>
    <div className="grid grid-cols-2 gap-2 p-3"><StatTile icon={<Trophy size={16}/>} label="Total titles" value={facts.statistics.titles}/><StatTile label="Longest winning streak" value={value(facts.statistics.longestWinningStreak)}/><StatTile label="Best recorded match average" value={value(p.bestMatchAverage?.value)}/><StatTile label="Most 180s in a recorded match" value={value(p.most180sMatch?.value)}/><StatTile label="Highest recorded checkout" value={value(p.highestCheckout)}/><StatTile label="Tour Cards regained" value={r.regainedTourCards.length}/></div>
    <h3 className="px-3 font-bold">Highest existing presentation tier won</h3>
    {r.highestTierTitles.length ? <ul className="p-3">{r.highestTierTitles.map(f=><FactLine key={f.id} fact={{...f,label:`${f.name} — ${f.presentationTier}`}} saveId={facts.careerSaveId}/>)}</ul> : <CareerEmptyState title="No titles yet"/>}
  </CareerSection>;
}
export function WorldHistoryPanel({ facts }: { facts: CareerFacts }) {
  return <div className="space-y-3"><CareerSection title="Latest event champions">
    {facts.world.champions.length ? <ul className="p-3">{[...facts.world.champions].reverse().map(f=><FactLine key={f.id} fact={{...f,label:`${f.name}: ${f.participantName} (${circuitLabel(f.circuit)})`}} saveId={facts.careerSaveId}/>)}</ul> : <CareerEmptyState title="No completed events yet"/>}
    </CareerSection><CareerSection title="Historical World Ranking leaders">{facts.world.rankingLeaders.length ? <ul className="p-3">{[...facts.world.rankingLeaders].reverse().map(f=><FactLine key={f.id} fact={{...f,label:`World #1: ${f.participantName}`}} saveId={facts.careerSaveId}/>)}</ul> : <CareerEmptyState title="No published World Ranking leaders yet"/>}</CareerSection></div>;
}
