import { useEffect, useState, type ReactNode } from "react";
import { Coins, Flame, MapPin, Target, Trophy, Zap } from "lucide-react";
import { PLATES, atmosphereFromTournament, resolveAtmosphere } from "./atmosphere";
import { legSummaries, matchStats, type SideStats } from "./live-model";
import { formatPence } from "./model";
import { tierProfile, type ResultMoment } from "./tournament/model";
import { usePresentation, type TournamentView } from "./api";
import { CareerShirt } from "./identity";
import type { LiveSession } from "./types";
import "./match-result.css";

/** A number that counts up when the card arrives (straight to the value with reduced motion). */
function useCountUp(target: number, ms = 900) {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) { setValue(target); return; }
    let frame = 0; const start = performance.now();
    const tick = (now: number) => { const t = Math.min(1, (now - start) / ms); setValue(target * (1 - Math.pow(1 - t, 3))); if (t < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms, reduced]);
  return value;
}
const Count = ({ value, decimals = 0 }: { value: number; decimals?: number }) => <>{useCountUp(value).toFixed(decimals)}</>;

type Row = { label: string; you: number | null; them: number | null; decimals: number; suffix?: string; better: "HIGH" | "LOW" };
/** Rows worth comparing: averages from the server, the rest from the dart log; rows with nothing on either side are left out. */
function rows(session: LiveSession, stats: [SideStats, SideStats] | null): Row[] {
  const f = session.result?.facts;
  const out: Row[] = [{ label: "Average", you: f?.human.average ?? null, them: f?.opponent.average ?? null, decimals: 2, better: "HIGH" }];
  if (stats) {
    const [you, them] = stats;
    out.push({ label: "180s", you: you.oneEighties, them: them.oneEighties, decimals: 0, better: "HIGH" },
      { label: "100+ visits", you: you.tonPlus, them: them.tonPlus, decimals: 0, better: "HIGH" },
      { label: "Best checkout", you: you.bestCheckout, them: them.bestCheckout, decimals: 0, better: "HIGH" },
      { label: "Best leg", you: you.bestLegDarts, them: them.bestLegDarts, decimals: 0, suffix: " darts", better: "LOW" });
  }
  return out.filter(r => r.label === "Average" || (r.you ?? 0) > 0 || (r.them ?? 0) > 0);
}
const edge = (r: Row): "you" | "them" | null => {
  if (r.you === null && r.them === null) return null;
  if (r.them === null) return "you";
  if (r.you === null) return "them";
  if (r.you === r.them) return null;
  return (r.better === "HIGH" ? r.you > r.them : r.you < r.them) ? "you" : "them";
};
/** Bar share for each side: the larger number fills its half (fewer darts is better for a leg, so it's inverted). */
function shares(r: Row): [number, number] {
  const a = r.you ?? 0, b = r.them ?? 0;
  if (r.better === "LOW") { const best = Math.min(a || Infinity, b || Infinity); return [a ? best / a : 0, b ? best / b : 0]; }
  const top = Math.max(a, b);
  return top > 0 ? [a / top, b / top] : [0, 0];
}

/** The night's notable moments, yours only: what a broadcast would put on screen. */
function highlights(stats: [SideStats, SideStats] | null): { icon: ReactNode; text: string }[] {
  if (!stats) return [];
  const [you] = stats, out: { icon: ReactNode; text: string }[] = [];
  if (you.oneEighties) out.push({ icon: <Flame aria-hidden />, text: you.oneEighties === 1 ? "A maximum 180" : `${you.oneEighties} maximums` });
  if ((you.bestCheckout ?? 0) >= 100) out.push({ icon: <Target aria-hidden />, text: `${you.bestCheckout} ton-plus finish` });
  if ((you.bestLegDarts ?? 99) <= 15) out.push({ icon: <Zap aria-hidden />, text: `${you.bestLegDarts}-dart leg` });
  return out;
}

/**
 * The end of a match, broadcast style: the venue behind it, the verdict and what it means, a scoreboard with your shirt,
 * the legs one by one, the head-to-head numbers and the money. The actions are passed in by the match page.
 */
export function MatchResultCard({ saveId, session, tournament, moment, prizePence, prizePaid, noPrize, next, children }: {
  saveId: string; session: LiveSession; tournament: TournamentView | undefined; moment: ResultMoment | null;
  prizePence: number | null; prizePaid: boolean; noPrize: string | null; next: string; children: ReactNode;
}) {
  const r = session.result!;
  const won = r.humanWon;
  const sets = session.format.unit === "SETS" && r.sets;
  const score: [number, number] = sets ? [r.sets![0], r.sets![1]] : [r.legs[0], r.legs[1]];
  const stats = matchStats(session), legs = legSummaries(session);
  const presentation = usePresentation(saveId);
  const event = tournament?.event;
  const plate = event ? PLATES[resolveAtmosphere(atmosphereFromTournament(event)).plate] : null;
  const tier = event ? tierProfile(event.level, null, event.circuit) : null;
  const venue = event?.venue?.displayName ?? event?.venueFallback?.city ?? null;
  const title = moment?.significance === "TITLE";
  const outcome = title ? "title" : won ? "win" : "loss";
  const verdict = title ? "Champion" : won ? "Victory" : "Defeat";
  const notes = highlights(stats);
  return <section className="mr" data-outcome={outcome} role="dialog" aria-label={`Match result: ${verdict}`}>
    {plate && <img className="mr__plate" src={plate.src} alt="" aria-hidden="true" />}
    <div className="mr__wash" aria-hidden="true" />
    {won && <div className="mr__rays" aria-hidden="true" />}

    <div className="mr__bar">
      <span className="mr__brand">TKDL Career Tour</span>
      {tier && <span className="mr__tier">{tier.label}</span>}
    </div>

    <header className="mr__head">
      <p className="mr__kicker">{event?.name ?? "Career match"}</p>
      {venue && <p className="mr__venue"><MapPin aria-hidden />{venue}</p>}
      <h2 className="mr__verdict" data-text={verdict}>{title && <Trophy aria-hidden />}{verdict}</h2>
      {moment && <p className="mr__moment">{moment.headline}</p>}
    </header>

    <div className="mr__board" aria-label={`${session.player.name} ${score[0]}, ${session.opponent.name} ${score[1]}`}>
      <div className="mr__side" data-winner={won || undefined}>
        <div className="mr__shirt" aria-hidden="true">
          {presentation.data ? <CareerShirt identity={presentation.data.identity} sponsors={presentation.data.placements} name={session.player.name} scale="compact" />
            : <span className="mr__initial">{session.player.name.slice(0, 1)}</span>}
        </div>
        <b>{session.player.name}</b>
        <small>{r.facts ? `${r.facts.human.average.toFixed(1)} avg` : "You"}</small>
      </div>
      <div className="mr__score">
        <span data-winner={won || undefined}><Count value={score[0]} /></span><i aria-hidden>:</i><span data-winner={!won || undefined}><Count value={score[1]} /></span>
        <small>{sets ? `Sets · ${r.legs[0]}–${r.legs[1]} legs` : "Legs"}</small>
      </div>
      <div className="mr__side mr__side--them" data-winner={!won || undefined}>
        <div className="mr__shirt mr__shirt--them" aria-hidden="true"><span className="mr__initial">{session.opponent.name.slice(0, 1)}</span></div>
        <b>{session.opponent.name}</b>
        <small>{r.facts ? `${r.facts.opponent.average.toFixed(1)} avg` : "Opponent"}</small>
      </div>
    </div>

    {legs.length > 0 && <ol className="mr__legs" aria-label="Leg by leg">
      {legs.map((leg, i) => <li key={i} data-you={leg.winner === 0 || undefined} style={{ animationDelay: `${0.25 + i * 0.08}s` }}>
        <small>Leg {i + 1}</small><b>{leg.winner === 0 ? "You" : session.opponent.name.split(" ")[0]}</b>
        <span>{leg.darts} darts{leg.checkout ? <><br />{leg.checkout} out</> : null}</span>
      </li>)}
    </ol>}

    {notes.length > 0 && <ul className="mr__notes" aria-label="Your highlights">{notes.map(n => <li key={n.text}>{n.icon}{n.text}</li>)}</ul>}

    <dl className="mr__stats">
      {rows(session, stats).map(row => { const e = edge(row), [a, b] = shares(row);
        return <div key={row.label} className="mr__stat">
          <dd data-edge={e === "you" || undefined}>{row.you === null ? "–" : <><Count value={row.you} decimals={row.decimals} />{row.suffix ?? ""}</>}</dd>
          <dt>{row.label}</dt>
          <dd data-edge={e === "them" || undefined}>{row.them === null ? "–" : <><Count value={row.them} decimals={row.decimals} />{row.suffix ?? ""}</>}</dd>
          <div className="mr__bars" aria-hidden="true">
            <span style={{ ["--w" as string]: a }} data-edge={e === "you" || undefined} />
            <span style={{ ["--w" as string]: b }} data-edge={e === "them" || undefined} />
          </div>
        </div>; })}
    </dl>

    <div className="mr__money" data-paid={(prizePence ?? 0) > 0 || undefined}>
      <span className="mr__coin"><Coins aria-hidden /></span>
      {(prizePence ?? 0) > 0
        ? <p><b>{formatPence(prizePence!)}</b><span>{prizePaid ? "Prize money, paid to your account" : "Prize money secured so far"}</span></p>
        : <p><span>{noPrize ?? moment?.detail ?? "Prize money follows your finishing position."}</span></p>}
    </div>

    <p className="mr__next">{next}</p>
    <div className="mr__actions">{children}</div>
  </section>;
}
