import { useState } from "react";
import { Link } from "wouter";
import { Coins, Loader2 } from "lucide-react";
import { useDeclineMoneyMatch, useMoneyMatches, usePlayMoneyMatch, errorMessage, type MoneyMatchResult, type MoneyMatchesView } from "./api";
import { formatPence } from "./model";

type Odds = MoneyMatchesView["members"][number]["odds"];
const ODDS: Record<Odds, string> = { FAVOURITE: "You're the favourite", EVEN: "An even game", UNDERDOG: "You're the underdog", UNKNOWN: "No recent form to go on" };
const signed = (pence: number) => `${pence > 0 ? "+" : pence < 0 ? "−" : ""}${formatPence(Math.abs(pence))}`;

function Outcome({ m }: { m: MoneyMatchResult }) {
  if (m.status === "DECLINED") return <span className="money-match__outcome">Turned down ({formatPence(m.stakePence)})</span>;
  return <span className="money-match__outcome" data-tone={m.won ? "up" : "down"}>
    {m.won ? "Won" : "Lost"} {m.legs![0]}-{m.legs![1]} · <b>{signed(m.won ? m.stakePence : -m.stakePence)}</b>
    {m.averages ? <small> · you averaged {m.averages[0].toFixed(1)}, they {m.averages[1].toFixed(1)}</small> : null}
  </span>;
}

/**
 * Club page: money matches. Challenge a member for a stake (first to four legs, played out like a quick-sim with your
 * form), or answer the member who challenged you this week. The winner takes the stake; it shows in your finances.
 */
export function MoneyMatches({ saveId, retired }: { saveId: string; retired: boolean }) {
  const q = useMoneyMatches(saveId);
  const play = usePlayMoneyMatch(saveId), decline = useDeclineMoneyMatch(saveId);
  const [stakes, setStakes] = useState<Record<string, number>>({});
  const [last, setLast] = useState<MoneyMatchResult | null>(null);
  const [message, setMessage] = useState("");
  if (!q.data) return q.isLoading ? <p className="money-match__note">Loading money matches…</p> : null;
  const d = q.data;
  const busy = play.isPending || decline.isPending;
  const full = d.playedThisWeek >= d.perWeek;
  const go = (opponentKey: string, stakePence: number) => { setMessage(""); play.mutate({ opponentKey, stakePence }, {
    onSuccess: r => setLast(r.match), onError: e => setMessage(errorMessage(e)) }); };

  return (
    <div className="money-match">
      <p className="money-match__intro">One-off games at the club, first to {(d.bestOf + 1) / 2} legs, for a stake each. The winner takes the lot. Up to {d.perWeek} a week, one against each member.
        {" "}You have <b>{formatPence(d.availablePence)}</b> free{d.yourAverage ? <> and you're averaging about <b>{d.yourAverage.toFixed(1)}</b></> : null}.</p>
      {last && <p className="money-match__result" role="status" data-tone={last.won ? "up" : "down"}>
        {last.won ? `You beat ${last.opponentName}` : `${last.opponentName} beat you`} {last.legs![0]}-{last.legs![1]} and {last.won ? "you take" : "takes"} {formatPence(last.stakePence)}.
        {last.highestCheckout ? ` Your best finish: ${last.highestCheckout}.` : ""}</p>}
      {d.challenge && !retired && <div className="money-match__challenge">
        <p><Coins aria-hidden /> <b>{d.challenge.name}</b> fancies a game for <b>{formatPence(d.challenge.stakePence)}</b>.
          <small> {ODDS[d.challenge.odds]}{d.challenge.average ? ` (they average ${d.challenge.average.toFixed(1)})` : ""}.</small></p>
        <div className="money-match__actions">
          <button type="button" className="career-btn career-btn-gold" disabled={busy} onClick={() => go(d.challenge!.opponentKey, d.challenge!.stakePence)}>
            {play.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Play for {formatPence(d.challenge.stakePence)}</button>
          <button type="button" className="career-btn career-btn-ghost" disabled={busy} onClick={() => decline.mutate(undefined, { onError: e => setMessage(errorMessage(e)) })}>Turn it down</button>
        </div>
      </div>}
      {message && <p className="money-match__message" role="alert">{message}</p>}
      {d.members.length ? <ul className="money-match__members">
        {d.members.map(m => {
          const stake = stakes[m.key] ?? m.stakes[Math.min(1, m.stakes.length - 1)];
          return <li key={m.key}>
            <div className="money-match__who"><b>{m.name}</b>{m.professional && <small className="career-club__pro"> · Pro</small>}
              <small>{m.average ? `Averaging ${m.average.toFixed(1)} · ` : ""}{ODDS[m.odds]}</small></div>
            {m.thisWeek ? <Outcome m={m.thisWeek} />
              : retired ? null
              : !m.stakes.length ? <span className="money-match__outcome"><small>Not enough money free for a stake</small></span>
              : full ? <span className="money-match__outcome"><small>That's your {d.perWeek} for this week</small></span>
              : <div className="money-match__play">
                <label className="sr-only" htmlFor={`stake-${m.key}`}>Stake against {m.name}</label>
                <select id={`stake-${m.key}`} value={stake} disabled={busy} onChange={e => setStakes(s => ({ ...s, [m.key]: Number(e.target.value) }))}>
                  {m.stakes.map(s => <option key={s} value={s}>{formatPence(s)}</option>)}
                </select>
                <button type="button" className="career-btn career-btn-primary" disabled={busy} onClick={() => go(m.key, stake)}>Play</button>
              </div>}
          </li>;
        })}
      </ul> : <p className="money-match__note">Nobody at the club to play yet.</p>}
      <p className="money-match__record">{d.record.played
        ? <>Money matches so far: won {d.record.won} of {d.record.played} · <b>{signed(d.record.netPence)}</b></>
        : "No money matches played yet."}</p>
      {d.recent.length > 0 && <details className="money-match__history"><summary>Recent money matches</summary>
        <ul>{d.recent.map(m => <li key={m.id}><span>S{m.season} Wk {m.week} · {m.opponentName}</span><Outcome m={m} /></li>)}</ul></details>}
    </div>
  );
}

/** Home: a line when a club member has challenged you this week. */
export function MoneyChallengeLine({ saveId }: { saveId: string }) {
  const q = useMoneyMatches(saveId);
  const c = q.data?.challenge;
  if (!c) return null;
  return <Link href={`/career/${saveId}/club#money-matches`} className="money-match-line">
    <Coins aria-hidden /><span><b>{c.name}</b> fancies a money match for <b>{formatPence(c.stakePence)}</b> · {ODDS[c.odds].toLowerCase()}</span>
  </Link>;
}
