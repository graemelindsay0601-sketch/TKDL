import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";
import { useTournament } from "../api";
import { CalendarDays, Coins, Crown, MapPin, Medal, Shield, Swords, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { Label, OSWALD, StatusBadge } from "../components";
import { formatPence } from "../model";
import { CareerShirt } from "../identity";
import { AwardPresentation, awardLabel, resolveAward, trophyArt } from "../trophies";
import { CareerStageBackdrop, atmosphereFromTournament, resolveAtmosphere, spectacleFor, type MatchStage, type MomentKind } from "../atmosphere";
import type { CareerEvent } from "../types";
import {
  bracketColumns, dossier, humanPath, involvesHuman, isFinal, isGroup, knockoutRounds, opponentIfWin, prizeLadder,
  resultMoment, runSummary, stageOf, tierFromEvent, tierProfile, type ResultMoment, type TMatch, type TPlayer, type TView,
  needleMatch, roundUp,
} from "./model";
import "./tournament-broadcast.css";

const nameOf = (v: Pick<TView, "field">, key: string | null) => key === null ? "To be decided" : v.field.find(p => p.key === key)?.name ?? "Participant unavailable";
const formatLine = (f: TView["event"]["format"], bestOf?: number) => {
  const unit = f.scoringUnit === "SETS" ? "sets" : "legs";
  const isX01 = f.gameType?.toUpperCase() === "X01" || f.startingScore != null;
  const rule = (value?: string) => ({ STRAIGHT: "straight", DOUBLE: "double", MASTER: "master", TREBLE: "treble", BULL: "bull" } as Record<string, string>)[value ?? ""];
  const rules = [f.inRule && rule(f.inRule) ? `${rule(f.inRule)}-in` : null, f.outRule && rule(f.outRule) ? `${rule(f.outRule)}-out` : null,
    "bull" in f && f.bull === "FAT" ? "fat bull" : null, "roundLimit" in f && f.roundLimit ? `${f.roundLimit}-round limit (cork decides)` : null].filter(Boolean).join(", ");
  const base = isX01
    ? [`X01 · ${f.startingScore ?? 501}`, rules, f.scoringUnit === "SETS" && f.legsPerSet ? `${f.legsPerSet} legs per set` : null].filter(Boolean).join(" · ")
    : f.scoringUnit === "SETS" ? `Set play · ${f.legsPerSet ?? "variable"} legs per set` : f.gameType;
  return bestOf ? `${base} · best of ${bestOf} ${unit}` : base;
};

/** E2: the event's award by its actual key (never by name); the stored catalogue trophy keeps historical identity. */
const awardInput = (v: TView) => ({ event: { definitionKey: v.event.definitionKey, circuit: v.event.circuit, classification: v.event.classification },
  persistedTrophyId: v.event.content?.trophyId ?? null, eventName: v.event.name });
/** F1: atmosphere for this event and moment, honouring server presentation depth and reduced motion. */
function Stage({ v, moment, matchStage = null, className = "" }: { v: TView; moment: MomentKind; matchStage?: MatchStage; className?: string }) {
  const atmosphere = resolveAtmosphere(atmosphereFromTournament(v.event));
  const spectacle = spectacleFor(moment, atmosphere.level, { matchStage, fullCeremony: v.depth.fullCeremony });
  if (spectacle.intensity === 0) return null;
  return <CareerStageBackdrop atmosphere={atmosphere} spectacle={spectacle} animate={v.depth.animate && !v.presentation.reducedMotion} eager className={className} />;
}
const matchStageOf = (label: string): MatchStage => label === "Final" ? "FINAL" : label === "Semi-final" ? "SEMI_FINAL" : label === "Quarter-final" ? "QUARTER_FINAL" : "EARLY";

// ---------------------------------------------------------------- hero / arrival
/** Broadcast-style event identity built only from the real event, venue and trophy content. */
export function TournamentHero({ v, children }: { v: TView; children?: ReactNode }) {
  const tier = tierProfile(v.event.level, v.event.content?.eventClass, v.event.circuit);
  const venue = v.event.venue;
  const days = v.event.startDay === v.event.endDay ? `Day ${v.event.startDay}` : `Days ${v.event.startDay}–${v.event.endDay}`;
  return (
    <section className={`tb-hero tb-tier-${tier.key.toLowerCase()}`} aria-label={`${v.event.name} event identity`}>
      <Stage v={v} moment="ARRIVAL" className="tb-hero__stage" />
      <div className="tb-hero__shade" aria-hidden />
      <div className="tb-hero__body">
        <div className="tb-hero__kicker"><span className="tb-chip">{tier.label}</span><span>{tier.kicker}</span></div>
        <h1 className="tb-hero__title" style={OSWALD}>{v.event.name}</h1>
        <p className="tb-hero__venue"><MapPin size={15} aria-hidden />
          <span>{venue?.nickname ? `${venue.nickname} · ` : ""}{venue?.displayName ?? v.event.venueFallback.city}</span>
          <span className="tb-dim">{venue?.city ?? v.event.venueFallback.city}, {v.event.venueFallback.country}</span></p>
        <dl className="tb-hero__facts">
          <div><dt>When</dt><dd><CalendarDays size={13} aria-hidden /> Season {v.event.season} · {days}</dd></div>
          <div><dt>Format</dt><dd>{formatLine(v.event.format)}</dd></div>
          <div><dt>Field</dt><dd><Users size={13} aria-hidden /> {v.field.length ? `${v.field.length} players` : "Field not yet locked"}</dd></div>
          {v.money.bands?.length ? <div><dt>Winner</dt><dd><Coins size={13} aria-hidden /> {formatPence(Math.max(...v.money.bands.map(b => b.amountPence)))}</dd></div> : null}
        </dl>
        {v.event.content?.fieldDescription && <p className="tb-hero__field">{v.event.content.fieldDescription}</p>}
        {children}
      </div>
      {(() => { const award = resolveAward(awardInput(v).event, { persistedTrophyId: awardInput(v).persistedTrophyId });
        if (award.award === "RESULT_ONLY") return null;
        return <div className="tb-hero__trophy"><AwardPresentation {...awardInput(v)} size="md" />
          <span>{award.designId ? trophyArt(award.designId)?.name ?? awardLabel(award) : awardLabel(award)}</span></div>; })()}
    </section>
  );
}

/** Arrival ceremony: the venue and what is at stake, all real metadata. */
export function ArrivalCeremony({ v }: { v: TView }) {
  const tier = tierProfile(v.event.level, v.event.content?.eventClass, v.event.circuit);
  const venue = v.event.venue;
  const atmosphere = (venue?.atmosphereTags ?? []).map(t => t.replace(/-/g, " "));
  return (
    <div className={`tb-arrival tb-tier-${tier.key.toLowerCase()}`}>
      <Stage v={v} moment="ARRIVAL" />
      <p className="tb-arrival__eyebrow">{tier.stage}</p>
      <h2 style={OSWALD}>{venue?.nickname ?? venue?.displayName ?? v.event.name}</h2>
      {venue?.nickname && <p className="tb-dim">{venue.displayName} · {venue.city}</p>}
      <p>{tier.arrival}</p>
      <ul className="tb-arrival__tags" aria-label="Venue character">
        {venue && <li>{venue.stageConfiguration === "MULTI_BOARD_FLOOR" ? "Multi-board floor" : "Feature board stage"}</li>}
        {venue && <li>{venue.capacityBand === "ARENA" ? "Arena crowd" : venue.capacityBand === "HALL" ? "Hall crowd" : "Club crowd"}</li>}
        {atmosphere.slice(0, 3).map(t => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- prize ladder
export function PrizeLadder({ v }: { v: TView }) {
  const ladder = prizeLadder(v.money.bands, v.position);
  if (!ladder.length) return null;
  return (
    <section className="tb-panel" aria-label="Prize ladder">
      <div className="tb-panel__head"><Coins size={15} aria-hidden /><Label color="#ffd24a">Prize ladder</Label>
        <span className="tb-dim tb-small">{v.money.paid ? "Prize settled" : ["COMPLETE", "CHAMPION"].includes(v.phase) ? "Final award pending" : "Current-position estimate · not settled"}</span></div>
      <ol className="tb-ladder">
        {ladder.map(step => (
          <li key={step.upToPosition} className={step.current ? "is-current" : step.reached ? "is-reached" : ""}>
            <span>{step.label}</span><strong>{formatPence(step.amountPence)}</strong>
            {step.current && <span className="tb-ladder__you">{v.money.paid ? "Settled finish" : ["COMPLETE", "CHAMPION"].includes(v.phase) ? "Final position · unpaid" : "Current position · estimate"}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------- bracket
export function BracketBoard({ v, focusHuman = true }: { v: TView; focusHuman?: boolean }) {
  const columns = useMemo(() => bracketColumns(v), [v]);
  const seeds = useMemo(() => new Map(v.field.filter(p => p.seed).map(p => [p.key, p.seed!])), [v.field]);
  const pathIds = new Set(humanPath(v).map(m => m.id));
  if (!columns.length) return <p className="tb-dim">The knockout draw appears here once it is made official.</p>;
  return (
    <div className="tb-bracket" role="region" aria-label="Knockout bracket" tabIndex={0}>
      {columns.map(col => (
        <div key={col.round} className="tb-bracket__col">
          <h4 style={OSWALD}>{col.label}<span className="tb-dim"> · {col.matches.length}</span></h4>
          <ol>{col.matches.map(m => <BracketMatch key={m.id} v={v} m={m} seeds={seeds} highlight={focusHuman && pathIds.has(m.id)} />)}</ol>
        </div>
      ))}
    </div>
  );
}
function BracketMatch({ v, m, seeds, highlight }: { v: TView; m: TMatch; seeds: Map<string, number>; highlight: boolean }) {
  const row = (key: string | null, legs: number | null) => {
    const won = !!key && m.winner_key === key, me = key === "HUMAN";
    return (
      <div className={`tb-bm__row${won ? " is-won" : ""}${me ? " is-me" : ""}`}>
        <span className="tb-bm__seed">{key && seeds.get(key) ? seeds.get(key) : ""}</span>
        <span className="tb-bm__name">{key ? (me ? `${nameOf(v, key)} (you)` : nameOf(v, key)) : m.status === "BYE" ? "Bye" : "TBC"}</span>
        <span className="tb-bm__legs">{legs ?? ""}</span>
        {won && <span className="sr-only">winner</span>}
      </div>
    );
  };
  return (
    <li className={`tb-bm${highlight ? " is-path" : ""}${m.status === "AWAITING_HUMAN" ? " is-awaiting" : ""}`}>
      {row(m.a_key, m.legs_a)}{row(m.b_key, m.legs_b)}
      <div className="tb-bm__meta">{m.status === "AWAITING_HUMAN" ? "Your match" : m.status === "WALKOVER" ? "Walkover" : m.status === "BYE" ? "Bye"
        : m.status === "COMPLETED" ? (m.result_source === "HUMAN_LIVE" ? "Played live" : "Result") : `Day ${m.scheduled_day}`}</div>
    </li>
  );
}

// ---------------------------------------------------------------- the player's path
export function PathToTitle({ v }: { v: TView }) {
  const path = humanPath(v);
  const rounds = knockoutRounds(v.matches);
  if (!path.length) return null;
  const last = path[path.length - 1];
  const stillIn = !["ELIMINATED", "WITHDRAWN", "COMPLETE", "CHAMPION", "CANCELLED"].includes(v.phase);
  const ahead = stillIn && !isGroup(last) && last.round < rounds ? Array.from({ length: rounds - last.round }, (_, i) => last.round + i + 1) : [];
  const ifWin = stillIn && !isFinal(last) ? opponentIfWin(v, last) : { kind: "NONE" as const };
  return (
    <section className="tb-panel" aria-label="Your path through the draw">
      <div className="tb-panel__head"><Target size={15} aria-hidden /><Label color="#ffd24a">Your path</Label></div>
      <ol className="tb-path">
        {path.map(m => {
          const opp = m.a_key === "HUMAN" ? m.b_key : m.a_key;
          const mine = m.a_key === "HUMAN" ? [m.legs_a, m.legs_b] : [m.legs_b, m.legs_a];
          const state = !isFinal(m) ? (m.status === "AWAITING_HUMAN" ? "next" : "upcoming") : m.status === "BYE" ? "bye" : m.winner_key === "HUMAN" ? "won" : "lost";
          return (
            <li key={m.id} className={`tb-path__step is-${state}`}>
              <span className="tb-path__round">{stageOf(m, rounds)}</span>
              <span className="tb-path__opp">{m.status === "BYE" ? "Bye" : `vs ${nameOf(v, opp)}`}</span>
              <span className="tb-path__res">{state === "won" || state === "lost" ? (m.status === "WALKOVER" ? (state === "won" ? "W/O win" : "W/O loss") : `${mine[0]}–${mine[1]}`)
                : state === "next" ? "Next" : state === "bye" ? "Through" : `Day ${m.scheduled_day}`}</span>
              <span className="sr-only">{state}</span>
            </li>
          );
        })}
        {ahead.map(r => (
          <li key={`ahead-${r}`} className="tb-path__step is-ahead">
            <span className="tb-path__round">{stageOf({ stage_key: last.stage_key, round: r }, rounds)}</span>
            <span className="tb-path__opp tb-dim">{r === last.round + 1 && ifWin.kind === "KNOWN" ? `Would face ${nameOf(v, ifWin.key)}`
              : r === last.round + 1 && ifWin.kind === "PENDING" ? `Winner of ${nameOf(v, ifWin.feeder.a_key)} v ${nameOf(v, ifWin.feeder.b_key)}` : "Decided by the draw"}</span>
            <span className="tb-path__res tb-dim">—</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------- pre-match
/** Tale of the tape: two real identities, the meeting record and this event's results. */
export function TaleOfTheTape({ v, match }: { v: TView; match: TMatch }) {
  const rounds = knockoutRounds(v.matches);
  const oppKey = match.a_key === "HUMAN" ? match.b_key : match.a_key;
  const me = v.field.find(p => p.key === "HUMAN");
  const them = oppKey ? dossier(v, oppKey) : null;
  const meetings = them?.meetings;
  const total = meetings ? meetings.humanWins + meetings.npcWins : 0;
  return (
    <section className="tb-tape" aria-label="Tale of the tape">
      <div className="tb-tape__stage"><Swords size={15} aria-hidden /> {stageOf(match, rounds)} · {formatLine(v.event.format, match.best_of)}</div>
      <div className="tb-tape__grid">
        {me && <TapeSide p={me} side="left" lines={[me.ranking ? `World #${me.ranking}` : "Unranked", me.titles ? `${me.titles} recorded titles` : "No recorded titles", me.nationality || "Country not recorded"]} />}
        <div className="tb-tape__vs" style={OSWALD} aria-hidden>VS</div>
        {them ? <TapeSide p={them.player} side="right" lines={[them.ranking, them.titles, them.nationality]} />
          : <div className="tb-tape__tbc">Opponent decided by the draw</div>}
      </div>
      {needleMatch(meetings ?? null) && <div className="tb-tape__needle" role="note"><strong style={OSWALD}>{needleMatch(meetings ?? null)!.label}</strong><span>{needleMatch(meetings ?? null)!.line}</span></div>}
      <div className="tb-tape__h2h">
        <Label>Head to head</Label>
        {meetings && meetings.played > 0 ? <>
          <div className="tb-h2h" role="img" aria-label={`You ${meetings.humanWins}, ${them!.player.name} ${meetings.npcWins}`}>
            <span style={{ flexGrow: Math.max(meetings.humanWins, 0.0001) }} className="tb-h2h__me">{meetings.humanWins}</span>
            <span style={{ flexGrow: Math.max(meetings.npcWins, 0.0001) }} className="tb-h2h__them">{meetings.npcWins}</span>
          </div>
          <p className="tb-small tb-dim">{meetings.played} played meeting{meetings.played === 1 ? "" : "s"}{total < meetings.played ? " (some undecided)" : ""}{meetings.latest ? ` · last: ${meetings.latest}` : ""}</p>
          {meetings.labels.length > 0 && <div className="tb-badges">{meetings.labels.map(l => <StatusBadge key={l} label={l} tone="info" />)}</div>}
        </> : <p className="tb-small tb-dim">First recorded meeting. Byes and walkovers never count as a meeting.</p>}
      </div>
      {them && them.thisEvent.length > 0 && (
        <div className="tb-tape__form"><Label>{them.player.name.split(" ")[0]}'s run this event</Label>
          <ul>{them.thisEvent.map((r, i) => <li key={i}><span>{r.round}</span><span>{r.how}{r.score ? ` ${r.score}` : ""}{r.opponent !== "—" ? ` v ${r.opponent}` : ""}</span></li>)}</ul></div>
      )}
    </section>
  );
}
function TapeSide({ p, side, lines }: { p: TPlayer; side: "left" | "right"; lines: string[] }) {
  return (
    <article className={`tb-tape__side is-${side}`} aria-label={`${p.name} profile`}>
      <CareerShirt playerId={p.key === "HUMAN" ? undefined : p.key} name={p.name} identity={p.shirt} sponsors={p.sponsors} scale="featured" />
      <div className="min-w-0">
        <h3 style={OSWALD}>{p.name}</h3>
        {p.nickname && <p className="tb-nick">“{String(p.nickname)}”</p>}
        <ul className="tb-tape__lines">{lines.map(l => <li key={l}>{l}</li>)}</ul>
        {p.seed && <span className="tb-chip tb-chip--gold">Seed {p.seed}</span>}
        {p.badges.length > 0 && <div className="tb-badges">{p.badges.map(b => <StatusBadge key={b.label} label={b.label} tone="gold" />)}</div>}
      </div>
    </article>
  );
}

/** Walk-on: the opponent, then the player, then the bull-up. Purely presentational. */
export function WalkOn({ v, match, playHref, onSkip }: { v: TView; match: TMatch; playHref: string; onSkip: () => void }) {
  const rounds = knockoutRounds(v.matches);
  const tier = tierProfile(v.event.level, v.event.content?.eventClass, v.event.circuit);
  const oppKey = match.a_key === "HUMAN" ? match.b_key : match.a_key;
  const me = v.field.find(p => p.key === "HUMAN"), them = v.field.find(p => p.key === oppKey);
  const animate = v.depth.animate && !v.presentation.reducedMotion;
  return (
    <section className={`tb-walkon tb-tier-${tier.key.toLowerCase()}${animate ? " is-animated" : ""}`} aria-label="Walk-on">
      <Stage v={v} moment="MATCH_INTRO" matchStage={matchStageOf(stageOf(match, rounds))} />
      <p className="tb-walkon__eyebrow">{v.event.name} · {stageOf(match, rounds)}</p>
      <div className="tb-walkon__stage">
        {them && <WalkOnCard p={them} order={1} caption="Walking on first" />}
        {me && <WalkOnCard p={me} order={2} caption="And now walking on" />}
      </div>
      <p className="tb-walkon__format">{formatLine(v.event.format, match.best_of)} · first throw decided by the real bull-up</p>
      <div className="tb-walkon__actions">
        <Link href={playHref} className="career-btn career-btn-gold"><Target size={16} aria-hidden /> To the oche · bull-up</Link>
        <button type="button" className="career-btn career-btn-ghost" onClick={onSkip}>Skip / return to hub</button>
      </div>
    </section>
  );
}
function WalkOnCard({ p, order, caption }: { p: TPlayer; order: number; caption: string }) {
  return (
    <article className="tb-walkon__card" style={{ "--tb-order": order } as CSSProperties}>
      <span className="tb-walkon__caption">{caption}</span>
      <CareerShirt playerId={p.key === "HUMAN" ? undefined : p.key} name={p.name} identity={p.shirt} sponsors={p.sponsors} scale="featured" />
      <h3 style={OSWALD}>{p.name}</h3>
      {p.nickname && <p className="tb-nick">“{String(p.nickname)}”</p>}
      <p className="tb-small tb-dim">{p.ranking ? `World #${p.ranking}` : "Unranked"}{p.seed ? ` · Seed ${p.seed}` : ""}</p>
    </article>
  );
}

// ---------------------------------------------------------------- results
const MOMENT_ICON: Record<ResultMoment["significance"], ReactNode> = {
  TITLE: <Crown size={22} aria-hidden />, FINAL_REACHED: <Trophy size={20} aria-hidden />, SEMI_REACHED: <Medal size={20} aria-hidden />,
  QUARTER_REACHED: <TrendingUp size={20} aria-hidden />, WIN: <TrendingUp size={20} aria-hidden />, GROUP_WIN: <Shield size={20} aria-hidden />,
  GROUP_LOSS: <Shield size={20} aria-hidden />, ELIMINATED: <Swords size={20} aria-hidden />, RUNNER_UP: <Medal size={20} aria-hidden />,
};
export function ResultBanner({ moment, score, opponent }: { moment: ResultMoment; score?: string; opponent?: string }) {
  const good = ["TITLE", "FINAL_REACHED", "SEMI_REACHED", "QUARTER_REACHED", "WIN", "GROUP_WIN", "RUNNER_UP"].includes(moment.significance);
  return (
    <div className={`tb-result is-${moment.significance.toLowerCase()} ${good ? "is-positive" : "is-negative"}${moment.milestone ? " is-milestone" : ""}`} role="status">
      <span className="tb-result__icon">{MOMENT_ICON[moment.significance]}</span>
      <div className="min-w-0">
        {moment.milestone && <span className="tb-result__tag">Milestone</span>}
        <strong style={OSWALD}>{moment.headline}</strong>
        {(score || opponent) && <p className="tb-result__score">{score}{opponent ? ` v ${opponent}` : ""}</p>}
        <p className="tb-small">{moment.detail}</p>
        {moment.rivalry && <p className="tb-small tb-result__rivalry">{moment.rivalry}</p>}
      </div>
    </div>
  );
}
export function LatestResult({ v }: { v: TView }) {
  const m = v.latestMatch;
  const moment = resultMoment(v, m);
  if (!m || !moment) return null;
  const opp = m.a_key === "HUMAN" ? m.b_key : m.a_key;
  const score = m.status === "WALKOVER" ? "Walkover" : m.a_key === "HUMAN" ? `${m.legs_a}–${m.legs_b}` : `${m.legs_b}–${m.legs_a}`;
  return <ResultBanner moment={moment} score={score} opponent={nameOf(v, opp)} />;
}

// ---------------------------------------------------------------- completion
export function CompletionSummary({ v, children, actions }: { v: TView; children?: ReactNode; actions?: ReactNode }) {
  const run = runSummary(v);
  const champion = v.phase === "CHAMPION";
  const tier = tierProfile(v.event.level, v.event.content?.eventClass, v.event.circuit);
  // E2: the award is resolved from the event's own key; weekly/qualifier wins are result-only.
  const award = resolveAward(awardInput(v).event, { persistedTrophyId: awardInput(v).persistedTrophyId });
  const trophy = award.designId ? { name: trophyArt(award.designId)?.name ?? "Championship trophy" } : null;
  const finish = v.position === 1 ? "Champion" : v.position === 2 ? "Runner-up" : v.position ? `Finished ${v.position <= 4 ? "joint " : ""}${ordinalFinish(v.position)}` : null;
  const prior = v.history?.bestFinish ?? null;
  const records: string[] = [];
  if (v.history) {
    if (!v.history.previousAppearances.length && v.humanResult) records.push("Debut appearance at this event");
    if (v.history.previousAppearances.length && v.position && prior && v.position < prior) records.push(`Best ever finish here (previously ${ordinalFinish(prior)})`);
    if (v.history.palace?.firstAppearance) records.push("World Championship debut");
    if (champion && !v.event.qSchool) {
      const priorTitles = v.history.previousAppearances.filter(p => p.is_champion === true);
      const last = v.history.previousAppearances[0];
      records.push(last?.is_champion === true && String(v.history.recentChampions[0]?.id) === String(last.id) ? "Title defended" : priorTitles.length ? `Title number ${priorTitles.length + 1} at this event` : "First title at this event");
    }
  }
  if (v.achievements.groupWinner) records.push("Group winner");
  const heading = champion ? `${nameOf(v, "HUMAN")} — ${v.event.name}`
    : v.phase === "WITHDRAWN" ? "You withdrew from this event"
    : v.phase === "ELIMINATED" ? "Your tournament is over"
    : v.phase === "CANCELLED" ? "Event cancelled"
    : "Tournament complete";
  const detailTitle = records.length ? `Verified event changes · ${records.length}` : "Run details";
  return (
    <section className={`tb-complete tb-tier-${tier.key.toLowerCase()}${champion ? " is-champion" : ""}`} aria-label="Event closeout">
      {/* F1: victory spectacle only for the recorded champion; a loss never celebrates. */}
      {champion && !v.event.qSchool && <Stage v={v} moment="VICTORY" />}
      <div className="tb-complete__head">
        {champion && !v.event.qSchool && award.award !== "RESULT_ONLY" && <div className="tb-complete__trophy"><AwardPresentation {...awardInput(v)} size="lg" /></div>}
        <div className="min-w-0">
          <Label color="#ffd24a">{champion ? (v.event.qSchool ? "Q-School session winner" : v.event.level >= 5 ? "World Champion · Sovereign Trophy" : "Tournament Champion")
            : v.event.level >= 5 && v.position === 2 ? "World Championship Runner-up" : v.phase === "WITHDRAWN" ? "Tournament run · withdrawal" : v.phase === "CANCELLED" ? "Event cancelled" : "Tournament closeout"}</Label>
          <h2 style={OSWALD}>{heading}</h2>
          {finish && <p className="tb-complete__finish">{finish}{v.humanResult ? "" : " · settlement pending"}</p>}
          {champion && <p className="tb-small tb-dim">{v.event.qSchool ? "Actual session finish; Tour Cards are decided by the Order of Merit" : `${award.award === "RESULT_ONLY" ? "Result & prize · no trophy at this event" : award.award === "RECOGNITION" ? (award.recognition === "MEDAL" ? "Winner's medal" : "Winner's plaque") : trophy?.name ?? "Championship trophy"} · a title you actually won`}</p>}
          {v.phase === "WITHDRAWN" && <p className="tb-small tb-dim">You withdrew; remaining fixtures were recorded as walkovers.</p>}
          {v.phase === "CANCELLED" && <p className="tb-small tb-dim">This event was cancelled. No final placing is reported here.</p>}
        </div>
      </div>
      <details className="tb-complete__details" open={champion || records.length > 0}>
        <summary>{detailTitle}</summary>
        <dl className="tb-complete__stats">
          <div><dt>Matches</dt><dd>{v.humanResult ? `${Number(v.humanResult.wins)}–${Number(v.humanResult.losses)}` : `${run.won}–${run.matches - run.won}`}</dd></div>
          <div><dt>Legs</dt><dd>{run.legsFor}–{run.legsAgainst}</dd></div>
          <div><dt>Prize</dt><dd>{formatPence(v.money.paid ? Number(v.money.prize?.cash_award_pence ?? 0) : v.money.securedPence)}</dd></div>
          <div><dt>Ranking money</dt><dd>{v.money.prize ? formatPence(Number(v.money.prize.ranking_eligible_pence)) : "—"}</dd></div>
        </dl>
        {records.length > 0 && <ul className="tb-complete__records" aria-label="Verified event changes">{records.map(r => <li key={r}><Medal size={14} aria-hidden /> {r}</li>)}</ul>}
        {v.championKey && !champion && <p className="tb-small">Champion: <strong>{nameOf(v, v.championKey)}</strong></p>}
        {children}
      </details>
      {actions}
    </section>
  );
}
function ordinalFinish(n: number) {
  const s = ["th", "st", "nd", "rd"], x = n % 100;
  return `${n}${s[(x - 20) % 10] || s[x] || s[0]}`;
}

// ---------------------------------------------------------------- entry screen
/** Why this event is worth entering — every figure from A3/A4/A5 previews. */
export function EntryCase({ e }: { e: CareerEvent }) {
  const tier = tierFromEvent(e.presentation.tier, e.circuit);
  const f = e.finance;
  const cover = f ? f.sponsorCoverage.entryFeePence + f.sponsorCoverage.travelPence + f.sponsorCoverage.accommodationPence : 0;
  const cost = f?.estimatedPlayerCostPence ?? null;
  const points: { icon: ReactNode; label: string; value: string }[] = [];
  if (f?.topPrizePence) points.push({ icon: <Trophy size={15} aria-hidden />, label: "Winner's prize", value: formatPence(f.topPrizePence) });
  points.push({ icon: <TrendingUp size={15} aria-hidden />, label: "Ranking", value: !e.capability.executable ? "No ranking money (benched)" : f?.rankingEligible ? "Prize money counts for rankings" : e.rankingCategory ? "Ranking event" : "Cash only — no ranking money" });
  points.push({ icon: <Users size={15} aria-hidden />, label: "Field", value: `${e.field.entrants ? `${e.field.entrants} entered · ` : ""}${e.field.size} places${e.seedingPolicy.list ? ` · ${e.seedingPolicy.seeds} seeds` : " · open draw"}` });
  if (cost !== null) points.push({ icon: <Coins size={15} aria-hidden />, label: "Your cost", value: cost > 0 ? `${formatPence(cost)}${cover > 0 ? ` after ${formatPence(cover)} sponsor cover` : ""}` : cover > 0 ? "Fully covered by your sponsor" : "Free to enter" });
  return (
    <section className={`tb-entry tb-tier-${tier.key.toLowerCase()}`} aria-label="Why enter this event">
      <div className="tb-entry__head"><span className="tb-chip">{tier.label}</span><span className="tb-dim tb-small">{tier.kicker}</span></div>
      <ul className="tb-entry__points">{points.map(p => <li key={p.label}>{p.icon}<span className="tb-entry__label">{p.label}</span><strong>{p.value}</strong></li>)}</ul>
      {f && cost !== null && cost > f.availablePence && <p className="tb-small" style={{ color: "#fb8a92" }}>Estimated cost is more than your available balance.</p>}
    </section>
  );
}

/** Event identity above the real bull-up: event, tier, stage and format. Display only. */
export function MatchContextStrip({ saveId, eventId, matchId }: { saveId: string; eventId: string; matchId: string }) {
  const q = useTournament(saveId, eventId);
  const v = q.data;
  const m = v?.matches.find(x => x.id === matchId);
  if (!v || !m) return null;
  const tier = tierProfile(v.event.level, v.event.content?.eventClass, v.event.circuit);
  return (
    <div className={`tb-strip tb-tier-${tier.key.toLowerCase()}`} role="note" aria-label="Match context">
      <span className="tb-chip">{tier.label}</span>
      <strong style={OSWALD}>{v.event.name}</strong>
      <span>{stageOf(m, knockoutRounds(v.matches))}</span>
      <span className="tb-dim">{formatLine(v.event.format, m.best_of)}</span>
    </div>
  );
}

export { involvesHuman, isFinal, resultMoment, tierProfile };

/** Elsewhere in the draw: notable results from other boards in this event. */
export function RoundUp({ v }: { v: TView }) {
  const items = roundUp(v);
  if (!items.length) return null;
  return (
    <section className="pdc-card p-4 tb-roundup" aria-label="Elsewhere in the draw">
      <Label>Elsewhere in the draw</Label>
      <ul>{items.map((i, n) => <li key={n} className={`tb-roundup__${i.kind.toLowerCase()}`}><span className="tb-roundup__stage">{i.stage}</span><span>{i.text}</span></li>)}</ul>
    </section>
  );
}
