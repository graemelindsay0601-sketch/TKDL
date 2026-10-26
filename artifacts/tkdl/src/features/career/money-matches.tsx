import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Coins, Loader2 } from "lucide-react";
import { useDeclineMoneyMatch, useMoneyMatches, useOfferMoneyMatch, usePlayMoneyMatch, errorMessage, type MoneyMatchResult, type MoneyMatchesView } from "./api";
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

type Member = MoneyMatchesView["members"][number];
/** Members listed before "Show all". */
const SHORT_LIST = 8;

/** One member: their form, the haggling so far, and what you can do next (offer, take their figure, play the agreed stake). */
function MemberRow({ m, busy, canPlay, perWeek, available, onOffer, onPlay }: { m: Member; busy: boolean; canPlay: boolean; perWeek: number; available: number;
  onOffer: (pence: number) => void; onPlay: (pence: number) => void }) {
  const [pounds, setPounds] = useState("");
  const [open, setOpen] = useState(false);
  const value = Math.round(Number(pounds) * 100);
  const valid = Number.isInteger(Number(pounds)) && value >= 500 && value <= available;
  const t = m.talk;
  const initials = m.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  return <li data-compact={(!open && !t && !m.thisWeek) || undefined} data-odds={m.odds}>
    <div className="money-match__who">
      <span className="money-match__avatar" aria-hidden="true">{initials}</span>
      <div className="money-match__identity">
        <div className="money-match__name">{m.name}{m.professional && <span className="money-match__pro">PRO</span>}</div>
        <div className="money-match__meta">
          {m.average ? <span className="money-match__average">AVG {m.average.toFixed(1)}</span> : null}
          <span className="money-match__odds">{ODDS[m.odds]}</span>
        </div>
      </div>
    </div>
    {t && t.log.length > 0 && <ol className="money-match__talk">{t.log.map((line, i) => <li key={i} data-who={line.who}><b>{line.who === "YOU" ? "You" : m.name.split(" ")[0]}:</b> {line.text}</li>)}</ol>}
    {m.thisWeek ? <Outcome m={m.thisWeek} />
      : t?.status === "WALKED" ? <span className="money-match__outcome"><small>{m.name.split(" ")[0]} has walked away for this week.</small></span>
      : !canPlay ? <span className="money-match__outcome"><small>That's your {perWeek} for this week</small></span>
      : t?.status === "AGREED" ? <div className="money-match__play"><button type="button" className="career-btn career-btn-gold" disabled={busy} onClick={() => onPlay(t.agreedPence!)}>Play for {formatPence(t.agreedPence!)}</button></div>
      : available < 500 ? <span className="money-match__outcome"><small>Not enough money free for a stake</small></span>
      : !open && !t ? <div className="money-match__play"><button type="button" className="career-btn career-btn-ghost" onClick={() => setOpen(true)}>Haggle</button></div>
      : <div className="money-match__play">
        {t?.theirOfferPence ? <button type="button" className="career-btn career-btn-gold" disabled={busy || t.theirOfferPence > available} onClick={() => onPlay(t.theirOfferPence!)}>
          Take {formatPence(t.theirOfferPence)} and play</button> : null}
        <label className="money-match__offer"><span className="sr-only">Your stake against {m.name}, in pounds</span>£
          <input inputMode="numeric" placeholder={t?.theirOfferPence ? "Counter" : "Stake"} value={pounds} disabled={busy} onChange={e => setPounds(e.target.value.replace(/[^0-9]/g, ""))} /></label>
        <button type="button" className="career-btn career-btn-primary" disabled={busy || !valid} onClick={() => { onOffer(value); setPounds(""); }}>{t ? "Offer again" : "Offer"}</button>
        {t && <small className="money-match__asks">{t.asksLeft} more {t.asksLeft === 1 ? "ask" : "asks"} before they lose patience</small>}
      </div>}
  </li>;
}

/**
 * Money matches. Haggle with a member over the stake (they put up more when they fancy their chances), or answer the
 * member who challenged you. First to four legs on the live scorer. The winner takes the stake.
 */
export function MoneyMatches({ saveId, retired }: { saveId: string; retired: boolean }) {
  const [, navigate] = useLocation();
  const q = useMoneyMatches(saveId);
  const offer = useOfferMoneyMatch(saveId), play = usePlayMoneyMatch(saveId), decline = useDeclineMoneyMatch(saveId);
  const [last, setLast] = useState<MoneyMatchResult | null>(null);
  const [message, setMessage] = useState("");
  const [showAll, setShowAll] = useState(false);
  if (!q.data) return q.isLoading ? <p className="money-match__note">Loading money matches…</p> : null;
  const d = q.data;
  const busy = play.isPending || decline.isPending || offer.isPending;
  const canPlay = d.playedThisWeek < d.perWeek && !retired;
  const fail = (e: unknown) => setMessage(errorMessage(e));
  const go = (opponentKey: string, stakePence: number) => { setMessage(""); play.mutate({ opponentKey, stakePence }, {
    onSuccess: r => {
      if (r.session) navigate(`/career/${saveId}/money-matches/${r.session.id}/play`);
      else if (r.match) setLast(r.match);
    },
    onError: fail,
  }); };
  const ask = (opponentKey: string, stakePence: number) => { setMessage(""); offer.mutate({ opponentKey, stakePence }, { onError: fail }); };

  // The members nearest your level first (the games worth a stake); anyone you've talked to or played this week stays in view.
  const near = (m: Member) => m.average === null || !d.yourAverage ? 99 : Math.abs(m.average - d.yourAverage);
  const sorted = [...d.members].sort((a, b) => Number(!!b.talk || !!b.thisWeek) - Number(!!a.talk || !!a.thisWeek) || near(a) - near(b));
  const shown = showAll ? sorted : sorted.filter((m, i) => i < SHORT_LIST || m.talk || m.thisWeek);
  return (
    <div className="money-match">
      <p className="money-match__intro">One-off games at the club, first to {(d.bestOf + 1) / 2} legs, winner takes the stake. Name your price: they'll put more up when they fancy
        their chances, haggle when it's too rich, and walk away if you push too often. Up to {d.perWeek} a week.
        {" "}You have <b>{formatPence(d.availablePence)}</b> free{d.yourAverage ? <> and you're averaging about <b>{d.yourAverage.toFixed(1)}</b></> : null}.</p>
      {last && <p className="money-match__result" role="status" data-tone={last.won ? "up" : "down"}>
        {last.won ? `You beat ${last.opponentName}` : `${last.opponentName} beat you`} {last.legs![0]}-{last.legs![1]} and {last.won ? "you take" : "takes"} {formatPence(last.stakePence)}.
        {last.highestCheckout ? ` Your best finish: ${last.highestCheckout}.` : ""}</p>}
      {d.challenge && !retired && <div className="money-match__challenge">
        <p><Coins aria-hidden /> <b>{d.challenge.name}</b>: "Fancy a game? <b>{formatPence(d.challenge.stakePence)}</b>, first to four."
          <small> {ODDS[d.challenge.odds]}{d.challenge.average ? ` (they average ${d.challenge.average.toFixed(1)})` : ""}.</small></p>
        <div className="money-match__actions">
          <button type="button" className="career-btn career-btn-gold" disabled={busy} onClick={() => go(d.challenge!.opponentKey, d.challenge!.stakePence)}>
            {play.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Play for {formatPence(d.challenge.stakePence)}</button>
          <button type="button" className="career-btn career-btn-ghost" disabled={busy} onClick={() => decline.mutate(undefined, { onError: fail })}>Turn it down</button>
        </div>
        <small className="money-match__note">Want a different stake? Make them an offer below.</small>
      </div>}
      {message && <p className="money-match__message" role="alert">{message}</p>}
      {d.liveMatches.length > 0 && <section className="money-match__challenge" aria-label="Unfinished money matches">
        <p><b>Resume an unfinished match</b></p>
        {d.liveMatches.map(m => <Link key={m.id} className="career-btn career-btn-gold"
          href={`/career/${saveId}/money-matches/${m.id}/play`}>{m.opponentName} · Season {m.season}, week {m.week} · {formatPence(m.stakePence)}</Link>)}
      </section>}
      {d.members.length ? <ul className="money-match__members">
        {shown.map(m => <MemberRow key={m.key} m={m} busy={busy} canPlay={canPlay} perWeek={d.perWeek} available={d.availablePence}
          onOffer={p => ask(m.key, p)} onPlay={p => go(m.key, p)} />)}
      </ul> : <p className="money-match__note">Nobody at the club to play yet.</p>}
      {shown.length < d.members.length && <button type="button" className="career-btn career-btn-ghost money-match__more" onClick={() => setShowAll(true)}>
        Show all {d.members.length} members</button>}
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
  return <Link href={`/career/${saveId}/money-matches`} className="money-match-line">
    <Coins aria-hidden /><span><b>{c.name}</b> fancies a money match for <b>{formatPence(c.stakePence)}</b> · {ODDS[c.odds].toLowerCase()}</span>
  </Link>;
}
