import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { markVisited } from "../welcome";
import { Link } from "wouter";
import { ArrowDownRight, ArrowRight, BadgeCheck, CalendarDays, Check, Crown, GraduationCap, Route, Sparkles, Ticket, Vault, X } from "lucide-react";
import { usePathways, useTourCard, useDecideTourCard, errorMessage, type PathwaysView } from "../api";
import { CareerError, CareerLoading } from "../components";
import { BREAKOUT_ROUTES, formatPence, ordinal, sourceLabel } from "../model";
import type { ShellContext } from "../shell";
import "./road.css";

const rank = (n: number | null) => n === null ? "Not ranked yet" : ordinal(n);

function RouteTile({ icon, number, title, accent, rankLabel, rankValue, rankNote, description, children, completed }: {
  icon: ReactNode;
  number: string;
  title: string;
  accent: string;
  rankLabel: string;
  rankValue: string;
  rankNote: string;
  description: string;
  children?: ReactNode;
  completed?: boolean;
}) {
  return <article className="rt-tile" data-route={number} data-completed={completed || undefined}
    style={{ "--tile-accent": accent } as CSSProperties}>
    <div className="rt-tile__top"><span className="rt-tile__number">{number}</span>{completed && <BadgeCheck className="rt-tile__complete" size={17} aria-label="Completed" />}</div>
    <h3><span className="rt-tile__title-emblem" aria-hidden="true">{icon}</span><span className="rt-tile__title-copy">{title}</span></h3>
    <div className="rt-rank" aria-label={`${rankLabel}: ${rankValue}`}>
      <span>{rankLabel}</span><strong>{rankValue}</strong><small>{rankNote}</small>
    </div>
    <p className="rt-tile__description">{description}</p>
    {children && <div className="rt-tile__next">{children}</div>}
  </article>;
}
const EventLink = ({ saveId, e }: { saveId: string; e: { eventId: string; name: string; week: number; status: string } }) =>
  <Link className="rt-event" href={`/career/${saveId}/events/${e.eventId}`}>
    {e.name} · W{e.week}{e.status === "REGISTRATION_OPEN" ? " · ENTRIES OPEN" : ""}<ArrowRight size={13} aria-hidden />
  </Link>;

/**
 * A Tour Card you've won but not yet taken: take it and turn professional, or turn it down and stay amateur (the card
 * passes to the next player in line). After the decide-by week it is yours.
 */
export function TourCardOffer({ saveId }: { saveId: string }) {
  const card = useTourCard(saveId), decide = useDecideTourCard(saveId);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offer = card.data?.offer;
  if (!offer) return null;
  const run = async (d: "ACCEPT" | "DECLINE") => { setError(null); try { await decide.mutateAsync(d); } catch (e) { setError(errorMessage(e)); } };
  const seasons = offer.startSeason === offer.endSeason ? `season ${offer.startSeason}` : `seasons ${offer.startSeason}–${offer.endSeason}`;
  return <section className="rt-offer" aria-label="Tour Card offer">
    <div className="rt-offer__seal"><Ticket size={22} aria-hidden /></div>
    <div className="rt-offer__body">
      <div className="rt-offer__eyebrow">DECISION PENDING · EARNED THROUGH {sourceLabel(offer.source).toUpperCase()}</div>
      <h2>Your Tour Card is waiting.</h2>
      <p>Take it and you turn professional for {seasons}: you can play the Pro Circuit, but not amateur events, the Vault or the Challenger Tour. Turn it down and it goes to the next player in line, and you stay amateur.</p>
      <div className="rt-offer__foot">
        <span>DECIDE BY <b>WEEK {offer.decideBy.week}, SEASON {offer.decideBy.season}</b> · OR IT IS YOURS AUTOMATICALLY</span>
        {!confirming ? <div className="rt-offer__actions">
          <button type="button" className="rt-button rt-button--gold" disabled={decide.isPending} onClick={() => { void run("ACCEPT"); }}>Take the card <ArrowRight size={15} aria-hidden /></button>
          <button type="button" className="rt-button rt-button--quiet" disabled={decide.isPending} onClick={() => setConfirming(true)}>Turn it down</button>
        </div> : <div className="rt-offer__actions" role="alertdialog" aria-label="Turn down the Tour Card">
          <span className="rt-confirm">Turn it down for good? It passes to the next player.</span>
          <button type="button" className="rt-button rt-button--gold" disabled={decide.isPending} onClick={() => { void run("DECLINE"); }} autoFocus>Yes, stay amateur</button>
          <button type="button" className="rt-button rt-button--quiet" onClick={() => setConfirming(false)}>Keep thinking</button>
        </div>}
      </div>
      {error && <p className="rt-offer__error" role="alert">{error}</p>}
    </div>
  </section>;
}

function Routes({ saveId, p }: { saveId: string; p: PathwaysView }) {
  const pro = !!p.tourCard && !p.tourCard.offer;
  const c = p.challenger, q = p.qSchool, w = p.worlds;
  const offer = p.tourCard?.offer;
  const cardWon = pro || !!p.tourCard?.offer;
  const worldPct = p.worlds.fanFavouriteFans > 0 ? Math.min(100, p.worlds.fans / p.worlds.fanFavouriteFans * 100) : 0;
  return <>
    <section className="rt-journey" aria-label="Progression overview">
      <div className="rt-section-heading"><div><span>THE CAMPAIGN ROUTE</span><h2>Many ways forward. <em>One career.</em></h2></div><p>Routes run in parallel. Before an eligibility or card decision, one does not rule out another.</p></div>
      <div className="rt-journey__rail">
        <article className="rt-journey__origin">
          <div className="rt-step">01 <span>AMATEUR ROUTES</span></div>
          <div className="rt-origin-list">
            {!pro ? <><span>Q-School <b>{q.finalStage ? "Final Stage" : "Entry route"}</b></span><span>Challenger <b>{rank(c.position)}</b></span>{p.development && <span>Development <b>{p.development.eligible ? rank(p.development.position) : "Age restricted"}</b></span>}<span>Vault Series <b>{rank(p.vault.position)}</b></span></> : <><span>World Ranking <b>{rank(w.worldRanking)}</b></span><span>Card retention <b>Top 64</b></span></>}
          </div>
          <small>{pro ? "Finish inside the World Ranking top 64 to retain your card." : "Standings can lead to a card or a Worlds place."}</small>
        </article>
        <div className="rt-flow" aria-hidden="true"><span /><ArrowRight size={16} /></div>
        <article className={`rt-journey__card${pro || offer ? " is-earned" : ""}`}>
          <div className="rt-step">02 <span>TOUR CARD</span></div><div className="rt-card-emblem"><Ticket size={27} strokeWidth={1.5} /></div>
          <strong>{pro ? "On the Tour" : offer ? "Decision pending" : "Card line"}</strong>
          <small>{pro ? "World top 64 retains the card" : offer ? "Accept to turn professional" : `Challenger top ${c.cards} · Q-School Final Stage`}</small>
        </article>
        <div className={`rt-flow${w.place ? " is-earned" : ""}`} aria-hidden="true"><span /><ArrowRight size={16} /></div>
        <article className={`rt-journey__world${w.place ? " is-earned" : ""}`}>
          <div className="rt-step">03 <span>WORLD CHAMPIONSHIP</span></div><div className="rt-world-globe">TKDL</div>
          <strong>{w.place ? "Place secured" : "Earn your place"}</strong>
          <small>{w.place ? BREAKOUT_ROUTES[w.place.route] ?? "Qualified" : "Ranking · qualifiers · route rankings · Masters · fan favourite"}</small>
        </article>
      </div>
    </section>
    <section className="rt-routes-section">
      <div className="rt-section-heading rt-section-heading--routes">
        <div><span>YOUR OPEN ROUTES</span><h2>Choose your next <em>throw.</em></h2></div>
        <div className="rt-parallel"><span><Route size={14} aria-hidden /> RUN IN PARALLEL</span><p>Routes remain open unless a real status or eligibility decision changes that.</p></div>
      </div>
      <div className="rt-route-grid">
        {!pro && <RouteTile number="01" icon={<GraduationCap />} title="Q-School" accent="#c52e40"
          rankLabel="YOUR ROUTE" rankValue={q.finalStage ? "Final Stage" : "Entry route"} rankNote={q.finalStage ? "Place secured" : "Final Stage is the card stage"} completed={q.finalStage}
          description={`Win a day at Final Stage or finish near the top overall for a Tour Card. First Stage ${formatPence(q.firstStageFeePence)}; Final Stage adds ${formatPence(q.finalStageFeePence)}.`}>
          {q.finalStage ? <span className="rt-next-copy"><Check size={14} aria-hidden /> You're in this season's Final Stage.</span> : q.next ? <><span className="rt-next-label">NEXT EVENT</span><EventLink saveId={saveId} e={q.next} /></> : <span className="rt-next-copy">Next season {q.nextSeason}, weeks 2–4.</span>}
          {q.proCircuitAssociate && <span className="rt-next-copy"><Check size={14} aria-hidden /> Pro Circuit access this season, even without a card.</span>}
        </RouteTile>}
        {!pro && <RouteTile number="02" icon={<Route />} title="Challenger Tour" accent="#e4b95d"
          rankLabel="CURRENT RANKING" rankValue={rank(c.position)} rankNote={`Top ${c.cards} earn a Tour Card`} completed={c.position !== null && c.position <= c.cards}
          description={`Top ${c.cards} earn a Tour Card and Worlds place. Q-School positions ${c.qSchoolFinalStage[0]}–${c.qSchoolFinalStage[1]} are exempt to the next Final Stage.`}>
          <span className="rt-next-copy">{c.access === "OPEN_SEASON" ? "Open to anyone without a card this season." : c.access === "PASS" ? "Access eligible this season. Qualifier route: reach the last 16 to earn access." : "Enter Q-School or reach the last 16 of a qualifier to access."}</span>
          {c.qualifiers.length > 0 && <><span className="rt-next-label">CHALLENGER QUALIFIER</span><EventLink saveId={saveId} e={c.qualifiers[0]} /></>}
          <span className="rt-next-label">ACCESS RETAINED · TOP {c.keepAccessTop}</span>
        </RouteTile>}
        {!pro && p.development && <RouteTile number="03" icon={<Sparkles />} title="Development Tour" accent="#d0a246"
          rankLabel="CURRENT RANKING" rankValue={p.development.eligible ? rank(p.development.position) : "Not eligible"} rankNote={p.development.eligible ? `Top ${p.development.cards} earn a card` : "Age restricted"} completed={p.development.position !== null && p.development.position <= p.development.cards}
          description={`For ages ${p.development.minAge} to under ${p.development.maxAgeExclusive}. Top ${p.development.cards} earn a Tour Card and Worlds place.`}>
          <span className="rt-next-copy">{p.development.eligible ? "Age eligible for this season." : "Not open at your age."}</span>
        </RouteTile>}
        {!pro && <RouteTile number="04" icon={<Vault />} title="Vault Series" accent="#c29a55"
          rankLabel="CURRENT RANKING" rankValue={rank(p.vault.position)} rankNote="Top the ranking for a Worlds place" completed={p.vault.position === 1}
          description="The TV amateur series. An optional route: top the ranking and earn a place at the Worlds.">
          <span className="rt-next-copy"><Vault size={14} aria-hidden /> Optional. Playing Vault does not close other routes.</span>
        </RouteTile>}
        <RouteTile number="05" icon={<Crown />} title="World Championship" accent="#e3bf70"
          rankLabel="WORLDS PLACE" rankValue={w.place ? "Secured" : "Not secured"} rankNote={w.place ? BREAKOUT_ROUTES[w.place.route] ?? "Qualified" : "Multiple qualification routes"} completed={!!w.place}
          description={`Qualify via World Ranking, a qualifier, route rankings, winning the Amateur World Masters, or reaching ${w.fanFavouriteFans.toLocaleString("en-GB")} fans.`}>
          {w.place ? <span className="rt-next-copy"><Check size={14} aria-hidden /> Place secured via {BREAKOUT_ROUTES[w.place.route] ?? "qualification"}.</span> : <>
            <div className="rt-fan-meter"><div><span>FAN FAVOURITE</span><b>{w.fans.toLocaleString("en-GB")} <i>/ {w.fanFavouriteFans.toLocaleString("en-GB")}</i></b></div><span className="rt-meter-track"><i style={{ width: `${worldPct}%` }} /></span></div>
            <span className="rt-next-label">QUALIFIER</span>{w.qualifiers.map(e => <EventLink key={e.eventId} saveId={saveId} e={e} />)}
            <span className="rt-next-copy">Also: World Ranking or a place via route rankings / Amateur World Masters.</span>
          </>}
        </RouteTile>
      </div>
    </section>
  </>;
}

/** Road to the Tour: every way to a Tour Card and to the World Championship, and where you stand on each. */
export function RoadToTourPage({ ctx }: { ctx: ShellContext }) {
  const id = ctx.save.id, q = usePathways(id), p = q.data;
  useEffect(() => { markVisited(id, "road"); }, [id]);
  const pro = !!p?.tourCard && !p.tourCard.offer;
  if (q.isLoading) return <CareerLoading label="Reading your routes" />;
  if (q.error || !p) return <CareerError error={q.error} onRetry={() => q.refetch()} />;
  return <main className="rt-page" id="road-to-tour-top">
    <header className="rt-hero">
      <div className="rt-hero__image" aria-hidden="true" /><div className="rt-hero__grain" aria-hidden="true" />
      <div className="rt-hero__content">
        <div className="rt-eyebrow"><span /> TKDL CAREER <i>/</i> SEASON {p.season} · WEEK {p.week}</div>
        <div className="rt-hero__title-row">
          <div><p className="rt-overline">THE PROGRESSION GUIDE</p><h1>{pro ? <>You're on<br /><em>the Tour.</em></> : <>Every way<br /><em>in.</em></>}</h1></div>
          <div className="rt-hero__lead"><span className="rt-hero__rule" />{pro ? "Stay inside the World Ranking top 64 to retain your card." : "No single road. Build your season across the routes that stay open to you."}</div>
        </div>
        <div className="rt-hero__stats">
          <div><small>WORLD RANKING</small><strong>{p.worlds.worldRanking !== null ? ordinal(p.worlds.worldRanking) : "—"}</strong><span>{pro ? "retention: top 64" : "not ranked yet"}</span></div>
          <div><small>CHALLENGER TOUR</small><strong>{rank(p.challenger.position)}</strong><span>top {p.challenger.cards} win a card</span></div>
          <div><small>VAULT SERIES</small><strong>{rank(p.vault.position)}</strong><span>optional amateur route</span></div>
          <div className="rt-season-stamp"><CalendarDays size={16} aria-hidden /><b>SEASON {p.season}</b><span>WEEK {p.week}</span></div>
        </div>
      </div>
      <div className="rt-hero__vertical" aria-hidden="true">ROAD TO THE TOUR <span>·</span> 01—03</div>
    </header>
    <TourCardOffer saveId={id} />
    <Routes saveId={id} p={p} />
    <footer className="rt-footer"><span><span className="rt-footer__mark">TKDL</span> CAREER · ROAD TO THE TOUR</span>
      <p>Route standings, qualification status and event examples are live from this Career save.</p>
      <button type="button" onClick={() => document.getElementById("road-to-tour-top")?.scrollIntoView({ behavior: "smooth", block: "start" })}>BACK TO TOP <ArrowDownRight size={14} aria-hidden /></button>
    </footer>
  </main>;
}
