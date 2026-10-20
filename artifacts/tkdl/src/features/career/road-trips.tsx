import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Car, Crown, Loader2, MapPin } from "lucide-react";
import { useGoOnRoadTrip, useOfferRoadMatch, usePlayRoadMatch, useRoadTrips, errorMessage, type RoadTripsView } from "./api";
import { dayLabel, formatPence } from "./model";

type Opponent = NonNullable<RoadTripsView["trip"]>["opponents"][number];
const ODDS: Record<Opponent["odds"], string> = { FAVOURITE: "You're the favourite", EVEN: "An even game", UNDERDOG: "You're the underdog", UNKNOWN: "No recent form to go on" };
const ROLE: Record<Opponent["role"], string> = { CHAMPION: "Town champion", LOCAL: "Local", VISITOR: "Visitor" };
const signed = (pence: number) => `${pence > 0 ? "+" : pence < 0 ? "−" : ""}${formatPence(Math.abs(pence))}`;

/** One player on the road: their greeting, the haggling, and what you can do (offer, take their figure, play). */
function OpponentRow({ o, busy, available, full, onOffer, onPlay }: { o: Opponent; busy: boolean; available: number; full: boolean; onOffer: (p: number) => void; onPlay: (p: number) => void }) {
  const [pounds, setPounds] = useState("");
  const value = Math.round(Number(pounds) * 100), valid = Number.isInteger(Number(pounds)) && value >= 500 && value <= available;
  const t = o.talk, first = o.name.split(" ")[0];
  return <li data-role={o.role}>
    <div className="money-match__who"><b>{o.role === "CHAMPION" ? <Crown size={14} aria-hidden /> : null}{o.name}</b>
      <small>{ROLE[o.role]}{o.average ? ` · averaging ${o.average.toFixed(1)}` : ""} · {ODDS[o.odds]}</small></div>
    {!o.result && <p className="road-trip__greeting">"{o.greeting}"</p>}
    {t && t.log.length > 0 && <ol className="money-match__talk">{t.log.map((line, i) => <li key={i} data-who={line.who}><b>{line.who === "YOU" ? "You" : first}:</b> {line.text}</li>)}</ol>}
    {o.result ? <span className="money-match__outcome" data-tone={o.result.won ? "up" : "down"}>{o.result.won ? "Won" : "Lost"} {o.result.legs[0]}-{o.result.legs[1]} ·
        {" "}<b>{signed(o.result.won ? o.result.stakePence : -o.result.stakePence)}</b><small> · you averaged {o.result.averages[0].toFixed(1)}, they {o.result.averages[1].toFixed(1)}</small></span>
      : o.locked ? <span className="money-match__outcome"><small>{o.locked}</small></span>
      : full ? <span className="money-match__outcome"><small>That's your games for tonight</small></span>
      : t?.status === "WALKED" ? <span className="money-match__outcome"><small>{first} has walked away.</small></span>
      : t?.status === "AGREED" ? <div className="money-match__play"><button type="button" className="career-btn career-btn-gold" disabled={busy} onClick={() => onPlay(t.agreedPence!)}>Play for {formatPence(t.agreedPence!)}</button></div>
      : available < 500 ? <span className="money-match__outcome"><small>Not enough money free for a stake</small></span>
      : <div className="money-match__play">
        {t?.theirOfferPence ? <button type="button" className="career-btn career-btn-gold" disabled={busy || t.theirOfferPence > available} onClick={() => onPlay(t.theirOfferPence!)}>Take {formatPence(t.theirOfferPence)} and play</button>
          : !t && o.askingPence <= available ? <button type="button" className="career-btn career-btn-gold" disabled={busy} onClick={() => onPlay(o.askingPence)}>Play for their {formatPence(o.askingPence)}</button> : null}
        <label className="money-match__offer"><span className="sr-only">Your stake against {o.name}, in pounds</span>£
          <input inputMode="numeric" placeholder={t?.theirOfferPence ? "Counter" : "Stake"} value={pounds} disabled={busy} onChange={e => setPounds(e.target.value.replace(/[^0-9]/g, ""))} /></label>
        <button type="button" className="career-btn career-btn-primary" disabled={busy || !valid} onClick={() => { onOffer(value); setPounds(""); }}>{t ? "Offer again" : "Offer"}</button>
        {t && <small className="money-match__asks">{t.asksLeft} more {t.asksLeft === 1 ? "ask" : "asks"} before they lose patience</small>}
      </div>}
  </li>;
}

/**
 * Club page: road trips. Pick a town and a free night, pay the travel, and take on the locals for money. A town's champion
 * only plays a stranger who's beaten one of their locals (or one with a name there); beat the champion and the town is
 * yours, your name grows, and players from the towns you've taken come to your club for a game.
 */
export function RoadTrips({ saveId, retired }: { saveId: string; retired: boolean }) {
  const search = useSearch(), params = new URLSearchParams(search), weekParam = params.get("week");
  const requestedWeek = weekParam === null ? undefined : Number(weekParam) || undefined;
  const q = useRoadTrips(saveId, requestedWeek), go = useGoOnRoadTrip(saveId), offer = useOfferRoadMatch(saveId), play = usePlayRoadMatch(saveId);
  const requestedDayValue = params.get("day");
  const requestedDay = requestedDayValue === null ? null : Number(requestedDayValue);
  const [town, setTown] = useState<string | null>(null), [night, setNight] = useState<number | null>(requestedDay !== null && requestedDay >= 1 && requestedDay <= 7 ? requestedDay : null), [message, setMessage] = useState("");
  if (!q.data) return q.isLoading ? <p className="money-match__note">Loading road trips…</p> : null;
  const d = q.data, busy = go.isPending || offer.isPending || play.isPending;
  const fail = (e: unknown) => setMessage(errorMessage(e));
  const pickTown = town ?? d.towns.find(t => t.champion)?.key ?? null;
  const preferredNight = night ?? requestedDay;
  const pickNight = preferredNight !== null && d.freeNights.includes(preferredNight) ? preferredNight : d.freeNights[0] ?? null;
  const chosen = d.towns.find(t => t.key === pickTown);
  const act = (kind: "offer" | "play", opponentKey: string, stakePence: number) => { setMessage(""); (kind === "offer" ? offer : play).mutate({ opponentKey, stakePence }, { onError: fail }); };
  return <div className="money-match road-trip">
    <p className="money-match__intro"><Car aria-hidden /> <b>{d.reputation.title}</b>{d.reputation.towns ? ` · ${d.reputation.towns} town${d.reputation.towns === 1 ? "" : "s"} taken` : ""}. {d.reputation.note}
      {d.reputation.next ? ` ${d.reputation.next.towns - d.reputation.towns} more to be a ${d.reputation.next.title.toLowerCase()}.` : ""}</p>
    {message && <p className="money-match__message" role="alert">{message}</p>}
    {d.visitor && !retired && <div className="money-match__challenge">
      <p><MapPin aria-hidden /> <b>{d.visitor.name}</b> from {d.visitor.town} is at your club: "{d.visitor.greeting}" <small>{ODDS[d.visitor.odds]}.</small></p>
      <ul className="money-match__members"><OpponentRow o={d.visitor} busy={busy} available={d.availablePence} full={false}
        onOffer={p => act("offer", d.visitor!.key, p)} onPlay={p => act("play", d.visitor!.key, p)} /></ul>
    </div>}
    {d.trip ? <div className="road-trip__tonight">
      <h3>{d.trip.town} · {dayLabel(d.trip.dayOfWeek)} night</h3>
      <p className="money-match__note">{d.week > d.currentWeek ? `Planned for week ${d.week}. Travel paid: ${formatPence(d.trip.costPence)}. Matches open when that week begins.` : `Travel paid: ${formatPence(d.trip.costPence)}. ${d.trip.played} of ${d.trip.maxMatches} games played. First to four, winner takes the stake.`}</p>
      {d.week <= d.currentWeek && <ul className="money-match__members">{d.trip.opponents.map(o => <OpponentRow key={o.key} o={o} busy={busy} available={d.availablePence} full={d.trip!.played >= d.trip!.maxMatches}
        onOffer={p => act("offer", o.key, p)} onPlay={p => act("play", o.key, p)} />)}</ul>
      }
    </div> : d.canTravel && !retired ? <div className="road-trip__plan">
      <label className="road-trip__field"><span>Town</span>
        <select value={pickTown ?? ""} onChange={e => setTown(e.target.value)}>
          {d.towns.filter(t => t.champion).map(t => <option key={t.key} value={t.key}>{t.city} ({t.region}){t.conquered ? " · taken" : ""} · {t.miles ? `${t.miles} miles · ` : ""}{formatPence(t.costPence)}</option>)}
        </select></label>
      <div className="road-trip__nights" role="radiogroup" aria-label="Night">{d.freeNights.map(n => <button key={n} type="button" role="radio" aria-checked={pickNight === n}
        className={`career-btn ${pickNight === n ? "career-btn-primary" : "career-btn-ghost"}`} onClick={() => setNight(n)}>{dayLabel(n)}</button>)}</div>
      {chosen && <p className="money-match__note">{chosen.city}'s champion: <b>{chosen.champion!.name}</b>{chosen.champion!.average ? ` (averaging ${chosen.champion!.average.toFixed(1)})` : ""}.
        {" "}Travel {formatPence(chosen.costPence)}{chosen.overnight ? " with a night's stay" : ""}.{chosen.record.played ? ` Your record there: won ${chosen.record.won} of ${chosen.record.played}.` : ""}</p>}
      <button type="button" className="career-btn career-btn-gold" disabled={busy || !chosen || pickNight === null || chosen.costPence > d.availablePence}
        onClick={() => go.mutate({ localityKey: pickTown!, dayOfWeek: pickNight!, week: d.week }, { onError: fail })}>
        {go.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Car aria-hidden />} Head to {chosen?.city ?? "town"}{pickNight ? ` on ${dayLabel(pickNight)}` : ""}</button>
    </div> : <p className="money-match__note">{retired ? "Your career is over." : d.why}</p>}
    <p className="money-match__record">{d.record.played ? <>On the road: won {d.record.won} of {d.record.played} · <b>{signed(d.record.netPence)}</b>
      {d.record.conquered.length ? <> · towns taken: {d.record.conquered.join(", ")}</> : null}</> : "No road games yet."}</p>
    {d.recent.length > 0 && <details className="money-match__history"><summary>Recent road games</summary>
      <ul>{d.recent.map((m, i) => <li key={i}><span>S{m.season} Wk {m.week} · {m.name} ({ROLE[m.role].toLowerCase()}, {m.town})</span>
        <span className="money-match__outcome" data-tone={m.won ? "up" : "down"}>{m.won ? "Won" : "Lost"} {m.legs[0]}-{m.legs[1]} · <b>{signed(m.won ? m.stakePence : -m.stakePence)}</b></span></li>)}</ul></details>}
  </div>;
}

/** Home: a line when a visitor from a town you've taken is at your club. */
export function RoadVisitorLine({ saveId }: { saveId: string }) {
  const v = useRoadTrips(saveId).data?.visitor;
  if (!v || v.result) return null;
  return <Link href={`/career/${saveId}/road-trips`} className="money-match-line"><MapPin aria-hidden />
    <span><b>{v.name}</b> has come from {v.town} for a money match · {formatPence(v.askingPence)}</span></Link>;
}
