import { useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowUpRight, Car, Check, Clock3, Compass, Crown, Loader2, MapPin, Route, Trophy } from "lucide-react";
import { useGoOnRoadTrip, useOfferRoadMatch, usePlayRoadMatch, useRoadTrips, errorMessage, type RoadTripsView } from "./api";
import { dayLabel, formatPence } from "./model";
import "./road-trips-redesign.css";

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
  if (!q.data) return q.isLoading ? <p className="money-match__note">Loading road trips…</p>
    : <p className="money-match__message" role="alert">{q.isError ? errorMessage(q.error) : "Road trips are unavailable right now."}</p>;
  const d = q.data, busy = go.isPending || offer.isPending || play.isPending;
  const fail = (e: unknown) => setMessage(errorMessage(e));
  const pickTown = town ?? d.towns.find(t => t.champion)?.key ?? null;
  const preferredNight = night ?? requestedDay;
  const pickNight = preferredNight !== null && d.freeNights.includes(preferredNight) ? preferredNight : d.freeNights[0] ?? null;
  const chosen = d.towns.find(t => t.key === pickTown);
  const destinations = d.towns.filter(t => t.champion);
  const destinationName = d.trip?.town ?? chosen?.city ?? "Choose a town";
  const roadWins = d.record.won, roadLosses = Math.max(0, d.record.played - d.record.won);
  const act = (kind: "offer" | "play", opponentKey: string, stakePence: number) => { setMessage(""); (kind === "offer" ? offer : play).mutate({ opponentKey, stakePence }, { onError: fail }); };
  return <div className="money-match road-trip road-trip-shell">
    <header className="road-atlas-hero">
      <div className="road-atlas-copy">
        <p className="road-atlas-kicker"><i /> NIGHTS OUT <span>·</span> SEASON {d.season} / WEEK {d.week}</p>
        <h1>Take it<br /><em>on the road.</em></h1>
        <p className="road-atlas-lede">Find a rival town, pick a free night and earn your name one local at a time. The champion can wait until you’ve beaten their best.</p>
        <dl className="road-atlas-stats">
          <div><dt>ROAD REPUTATION</dt><dd>{d.reputation.title}</dd></div>
          <div><dt>TOWNS CLAIMED</dt><dd>{String(d.reputation.towns).padStart(2, "0")}</dd><small>{d.reputation.towns} town{d.reputation.towns === 1 ? "" : "s"} taken</small></div>
          <div><dt>ROAD RECORD</dt><dd>{roadWins}–{roadLosses}</dd></div>
        </dl>
        <p className="road-atlas-note"><Car size={14} />{d.reputation.note}{d.reputation.next ? ` ${d.reputation.next.towns - d.reputation.towns} more to be a ${d.reputation.next.title.toLowerCase()}.` : ""}</p>
      </div>
      <div className="road-atlas-scene" role="img" aria-label={`Schematic road trip from ${d.home ?? "your club"} to ${destinationName}; route is illustrative`}>
        <img src="/images/career-night-local.jpg" alt="" />
        <div className="road-atlas-scene-shade" />
        <div className="road-atlas-grid" />
        <svg viewBox="0 0 540 300" aria-hidden="true">
          <path className="road-atlas-route-under" d="M58 230 C104 195 119 191 151 158 C187 120 228 131 246 172 C267 219 301 234 340 176 C377 121 389 104 429 83 S472 71 490 55" />
          <path className="road-atlas-route" d="M58 230 C104 195 119 191 151 158 C187 120 228 131 246 172 C267 219 301 234 340 176 C377 121 389 104 429 83 S472 71 490 55" />
          <circle cx="246" cy="172" r="5" /><circle cx="340" cy="176" r="4" />
        </svg>
        <span className="road-atlas-pin road-atlas-pin-home"><i /><b>{d.home ?? "HOME CLUB"}</b><small>YOUR CLUB</small></span>
        <span className="road-atlas-pin road-atlas-pin-town"><i /><b>{destinationName.toUpperCase()}</b><small>{d.trip?.region ?? chosen?.region ?? "CHOOSE A TOWN"}</small></span>
        <span className="road-atlas-schematic"><Compass size={14} /> ROUTE SKETCH · NOT TO SCALE</span>
        <span className="road-atlas-stamp"><b>AWAY<br />NIGHT</b><small>W{d.week}</small></span>
      </div>
    </header>

    <div className="road-route-summary">
      <span className="road-route-mark"><Route size={19} /></span>
      <span className="road-route-copy"><small>{d.trip ? "TRIP BOOKED" : "YOUR NEXT DRIVE"}</small><b>{d.home ?? "Home club"} <i>to</i> {destinationName}</b>
        <span>{d.trip ? `${dayLabel(d.trip.dayOfWeek)} night · Travel paid ${formatPence(d.trip.costPence)}` : chosen ? `${chosen.region}${chosen.miles !== null ? ` · ${chosen.miles} miles` : ""} · Travel ${formatPence(chosen.costPence)}${chosen.overnight ? " with a night's stay" : ""}` : "Choose a town to see the travel cost."}</span></span>
      <span className="road-route-week"><Clock3 size={15} /><b>WEEK {d.week}</b><small>{d.trip ? dayLabel(d.trip.dayOfWeek) : pickNight ? dayLabel(pickNight) : "NO NIGHT"}</small></span>
    </div>

    {message && <p className="money-match__message" role="alert">{message}</p>}
    {d.visitor && !retired && <section className="road-visitor-panel">
      <div className="road-subhead"><span className="road-atlas-label"><MapPin size={13} /> BACK AT YOUR CLUB</span><h2>{d.visitor.name} from {d.visitor.town} is at your club</h2>
        <p>“{d.visitor.greeting}” <small>{ODDS[d.visitor.odds]}.</small></p></div>
      <ul className="money-match__members"><OpponentRow o={d.visitor} busy={busy} available={d.availablePence} full={false}
        onOffer={p => act("offer", d.visitor!.key, p)} onPlay={p => act("play", d.visitor!.key, p)} /></ul>
    </section>}

    {d.trip ? <section className="road-live-trip">
      <div className="road-subhead"><span className="road-atlas-label"><Car size={13} /> TONIGHT'S TOWN · {d.trip.region}</span>
        <h2>{d.trip.town} · {dayLabel(d.trip.dayOfWeek)} night</h2>
        <p className="money-match__note">{d.week > d.currentWeek ? `Planned for week ${d.week}. Travel paid: ${formatPence(d.trip.costPence)}. Matches open when that week begins.` : `Travel paid: ${formatPence(d.trip.costPence)}. ${d.trip.played} of ${d.trip.maxMatches} games played. First to four, winner takes the stake.`}</p>
      </div>
      {d.week <= d.currentWeek && <ul className="money-match__members">{d.trip.opponents.map(o => <OpponentRow key={o.key} o={o} busy={busy} available={d.availablePence} full={d.trip!.played >= d.trip!.maxMatches}
        onOffer={p => act("offer", o.key, p)} onPlay={p => act("play", o.key, p)} />)}</ul>}
    </section> : d.canTravel && !retired ? <section className="road-trip-planner">
      <div className="road-planner-main">
        <div className="road-subhead"><span className="road-atlas-label">01 / PICK YOUR NEXT STOP</span><h2>Where to tonight?</h2>
          <p>Each town has its own locals, champion and travel cost.</p></div>
        {destinations.length ? <div className="road-town-list" role="radiogroup" aria-label="Choose a town">
          {destinations.map(item => <button key={item.key} type="button" role="radio" aria-checked={item.key === pickTown} onClick={() => setTown(item.key)}>
            <span className="road-town-select">{item.key === pickTown ? <Check size={14} /> : <MapPin size={14} />}</span>
            <span className="road-town-name"><b>{item.city}{item.conquered && <i>TAKEN</i>}</b><small>{item.region}{item.miles !== null ? ` · ${item.miles} miles` : ""}{item.overnight ? " · overnight" : ""}</small></span>
            <strong>{formatPence(item.costPence)}</strong><ArrowUpRight size={14} />
          </button>)}
        </div> : <p className="money-match__note">No towns with a local champion are available for a road match yet.</p>}
        <div className="road-night-picker"><div><span className="road-atlas-label">02 / CHOOSE A FREE NIGHT</span><small>Your booked events and commitments are already excluded.</small></div>
          <div role="radiogroup" aria-label="Choose a free night">{d.freeNights.map(n => <button key={n} type="button" role="radio" aria-checked={pickNight === n}
            onClick={() => setNight(n)}>{dayLabel(n)}</button>)}</div>
        </div>
        {chosen && <p className="road-town-fact"><Crown size={14} /><span><b>{chosen.champion!.name}</b>{chosen.champion!.average ? ` · averaging ${chosen.champion!.average.toFixed(1)}` : ""} · Travel {formatPence(chosen.costPence)}{chosen.overnight ? " with a night's stay" : ""}{chosen.record.played ? ` · Your record: won ${chosen.record.won} of ${chosen.record.played}` : ""}</span></p>}
        <div className="road-trip-summary"><span><Car size={18} /><b>{destinationName}</b><small>{pickNight ? `${dayLabel(pickNight)} night · ` : ""}{chosen ? formatPence(chosen.costPence) : "Select a town"}</small></span>
          <button type="button" className="career-btn career-btn-gold" disabled={busy || !chosen || pickNight === null || chosen.costPence > d.availablePence}
            onClick={() => go.mutate({ localityKey: pickTown!, dayOfWeek: pickNight!, week: d.week }, { onError: fail })}>
            {go.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Car aria-hidden />} Head to {chosen?.city ?? "town"}{pickNight ? ` on ${dayLabel(pickNight)}` : ""}
          </button>
        </div>
        {d.why && <p className="road-plan-note">{d.why}</p>}
      </div>
      <aside className="road-town-card">
        <div className="road-town-card-top"><span className="road-atlas-label">THE ONE TO BEAT</span><span className="road-champion-tag"><Crown size={12} /> TOWN CHAMPION</span></div>
        {chosen?.champion ? <><div className="road-champion-person"><div className="road-champion-crest"><Crown size={21} /><small>{chosen.city.slice(0, 2).toUpperCase()}</small></div>
          <div><h3>{chosen.champion.name}</h3><p>{chosen.city}'s champion. Beat a local first to earn the right to challenge them.</p></div></div>
          <div className="road-champion-stat"><span>SEASON AVERAGE</span><b>{chosen.champion.average?.toFixed(1) ?? "—"}</b><small>LOCAL CIRCUIT</small></div>
          <div className="road-progress"><span><i /></span><small><b>STEP 1 OF 2</b> · WIN A LOCAL GAME TO OPEN THE CHALLENGE</small></div>
          {chosen.record.played > 0 && <p className="road-town-record">Your record here: <b>{chosen.record.won}–{chosen.record.played - chosen.record.won}</b> · {signed(chosen.record.netPence)}</p>}
        </> : <p className="money-match__note">{chosen ? "This town has no champion to challenge yet." : "Choose a town to meet its champion."}</p>}
      </aside>
    </section> : <p className="road-plan-note">{retired ? "Your career is over." : d.why}</p>}

    <section className="road-record-panel">
      <div><span className="road-atlas-label"><Trophy size={13} /> YOUR ROAD RECORD</span>
        <p>{d.record.played ? <>On the road: won <b>{d.record.won} of {d.record.played}</b> · <b>{signed(d.record.netPence)}</b>{d.record.conquered.length ? <> · towns taken: {d.record.conquered.join(", ")}</> : null}</> : "No road games yet."}</p>
      </div>
      <span className="road-record-score">{roadWins}<i>–</i>{roadLosses}</span>
    </section>
    {d.recent.length > 0 && <details className="money-match__history road-trip-history"><summary>Recent road games <span>{d.recent.length} results</span></summary>
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
