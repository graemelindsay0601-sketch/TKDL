import { useEffect, useState, type ReactNode } from "react";
import { markVisited } from "../welcome";
import { Link } from "wouter";
import { BadgeCheck, Crown, GraduationCap, Route, Sparkles, Ticket, Vault } from "lucide-react";
import { usePathways, useTourCard, useDecideTourCard, errorMessage, type PathwaysView } from "../api";
import { CareerError, CareerLoading, CareerSection } from "../components";
import { CareerPageHero } from "../page-hero";
import { PLATES } from "../atmosphere";
import { BREAKOUT_ROUTES, formatPence, ordinal, sourceLabel } from "../model";
import type { ShellContext } from "../shell";
import "./road.css";

const rank = (n: number | null) => n === null ? "Not ranked yet" : ordinal(n);

/** One route: what it gives, where you stand, and the next step. */
function RouteCard({ icon, title, gives, children, done, standing }: {
  icon: ReactNode;
  title: string;
  gives: string;
  children?: ReactNode;
  done?: boolean;
  standing?: { label: string; value: string; note: string };
}) {
  return <article className="road-route" data-done={done || undefined}>
    <header><span aria-hidden>{icon}</span><b>{title}</b>{done && <BadgeCheck className="road-route__done" aria-label="Done" />}</header>
    {standing && <div className="road-route__standing" aria-label={`${standing.label}: ${standing.value}`}>
      <span>{standing.label}</span><strong>{standing.value}</strong><small>{standing.note}</small>
    </div>}
    <p className="road-route__gives">{gives}</p>
    {children && <div className="road-route__you">{children}</div>}
  </article>;
}
const EventLink = ({ saveId, e }: { saveId: string; e: { eventId: string; name: string; week: number; status: string } }) =>
  <Link href={`/career/${saveId}/events/${e.eventId}`}>{e.name}, week {e.week}{e.status === "REGISTRATION_OPEN" ? " (entries open)" : ""}</Link>;

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
  return <section className="road-offer" aria-label="Tour Card offer">
    <Ticket aria-hidden />
    <div>
      <b>You've earned a Tour Card</b>
      <p>{sourceLabel(offer.source)}. Take it and you turn professional for {seasons}: you can play the Pro Circuit, but not amateur events, the Vault or the Challenger Tour.
        Turn it down and it goes to the next player in line, and you stay amateur.</p>
      <p className="road-offer__by">Decide by week {offer.decideBy.week} of season {offer.decideBy.season}, or it's yours automatically. Once you take it, you can't give it back.</p>
      {error && <p className="road-offer__error" role="alert">{error}</p>}
      {!confirming ? <div className="road-offer__actions">
        <button type="button" className="career-btn career-btn-primary" disabled={decide.isPending} onClick={() => { void run("ACCEPT"); }}>Take the card</button>
        <button type="button" className="career-btn career-btn-ghost" disabled={decide.isPending} onClick={() => setConfirming(true)}>Turn it down</button>
      </div> : <div className="road-offer__actions" role="alertdialog" aria-label="Turn down the Tour Card">
        <span>Turn it down for good? It passes to the next player.</span>
        <button type="button" className="career-btn career-btn-primary" disabled={decide.isPending} onClick={() => { void run("DECLINE"); }} autoFocus>Yes, stay amateur</button>
        <button type="button" className="career-btn career-btn-ghost" onClick={() => setConfirming(false)}>Keep thinking</button>
      </div>}
    </div>
  </section>;
}

function Routes({ saveId, p }: { saveId: string; p: PathwaysView }) {
  const pro = !!p.tourCard && !p.tourCard.offer;
  const c = p.challenger, q = p.qSchool, w = p.worlds;
  const cardWon = pro || !!p.tourCard?.offer;
  const currentPlate = PLATES[pro ? "professional-floor" : "community-hall"];
  return <>
    <div className="road-map" aria-label="Progression map from amateur routes to Tour Card and World Championship">
      <div className="road-map__head">
        <div><span>THE CAMPAIGN ROUTE</span><strong>Many ways forward. One career.</strong></div>
        <p>Qualification routes can run in parallel. Your current positions and places are shown below.</p>
      </div>
      <div className="road-map__track">
        <article className="road-map__stage road-map__stage--routes">
          <div className="road-map__index">01 <span>AMATEUR ROUTES</span></div>
          {pro ? <div className="road-map__route-list">
            <span>World Ranking <b>{p.worlds.worldRanking !== null ? ordinal(p.worlds.worldRanking) : "Not ranked"}</b></span>
            <span>Card retention <b>Top 64</b></span>
          </div> : <div className="road-map__route-list">
            <span>Q-School <b>{q.finalStage ? "Final Stage" : "Entry route"}</b></span>
            <span>Challenger <b>{rank(c.position)}</b></span>
            {p.development && <span>Development Tour <b>{p.development.eligible ? rank(p.development.position) : "Age restricted"}</b></span>}
            <span>Vault Series <b>{rank(p.vault.position)}</b></span>
          </div>}
          <small>{pro ? "Keep your card by finishing inside the World Ranking top 64." : "Results here can award a card or a Worlds place."}</small>
        </article>
        <div className={`road-map__connector${cardWon ? " is-earned" : ""}`} aria-hidden="true"><i /></div>
        <article className={`road-map__stage road-map__stage--card${cardWon ? " is-earned" : ""}`} style={{ backgroundImage: `linear-gradient(90deg,rgba(7,10,14,.95),rgba(7,10,14,.67)),url("${currentPlate.src}")` }}>
          <div className="road-map__index">02 <span>TOUR CARD</span></div>
          <strong>{pro ? "On the Tour" : p.tourCard?.offer ? "Card earned · decision pending" : "Card line"}</strong>
          <small>{pro ? "World top 64 retains the card" : p.tourCard?.offer ? "Accept to turn professional" : `Challenger card places: top ${c.cards}; Q-School Final Stage also awards cards`}</small>
        </article>
        <div className={`road-map__connector${!!w.place ? " is-earned" : ""}`} aria-hidden="true"><i /></div>
        <article className={`road-map__stage road-map__stage--world${w.place ? " is-earned" : ""}`}>
          <div className="road-map__index">03 <span>WORLD CHAMPIONSHIP</span></div>
          <strong>{w.place ? "Place secured" : "Earn your place"}</strong>
          <small>{w.place ? BREAKOUT_ROUTES[w.place.route] ?? "Qualified" : `World Ranking, qualifiers, route rankings, Amateur World Masters or ${w.fanFavouriteFans.toLocaleString("en-GB")} fans`}</small>
        </article>
      </div>
    </div>
    <div className="road-routes">
    {!pro && <RouteCard icon={<GraduationCap />} title="Q-School" done={q.finalStage}
      standing={{ label: "Your route", value: q.finalStage ? "Final Stage" : "Entry route", note: q.finalStage ? "Final Stage place secured" : "Final Stage is the card stage" }}
      gives={`Win a day at the Final Stage, or finish near the top overall, and you get a Tour Card. ${formatPence(q.firstStageFeePence)} to enter, plus ${formatPence(q.finalStageFeePence)} if you reach the Final Stage.`}>
      {q.finalStage ? <p>You're in this season's Final Stage.</p> : q.next ? <p>Next: <EventLink saveId={saveId} e={q.next} />.</p>
        : <p>This season's Q-School is over. The next one is in season {q.nextSeason}, weeks 2–4.</p>}
      {q.proCircuitAssociate && <p className="road-good">You did well enough at Q-School to play Pro Circuit events this season, even without a card.</p>}
    </RouteCard>}
    {!pro && <RouteCard icon={<Route />} title="Challenger Tour" done={c.position !== null && c.position <= c.cards}
      standing={{ label: "Current ranking", value: rank(c.position), note: `Top ${c.cards} earn a Tour Card` }}
      gives={`Finish in the top ${c.cards} for a Tour Card and a place at the Worlds. The top ${c.qSchoolFinalStage[1]} skip straight to the next Q-School Final Stage.`}>
      {c.access === "OPEN_SEASON" ? <p>Anyone without a card can play it this season.</p>
        : c.access === "PASS" ? <p>You can play it this season.</p>
        : <p>To play it this season, enter Q-School or reach the last 16 of a qualifier
          {c.qualifiers.length ? <> (<EventLink saveId={saveId} e={c.qualifiers[0]} />)</> : " (none left this season)"}.</p>}
    </RouteCard>}
    {!pro && p.development && <RouteCard icon={<Sparkles />} title="Development Tour" done={p.development.position !== null && p.development.position <= p.development.cards}
      standing={{ label: "Current ranking", value: p.development.eligible ? rank(p.development.position) : "Not eligible", note: p.development.eligible ? `Top ${p.development.cards} earn a Tour Card` : "Age restricted" }}
      gives={`For ages ${p.development.minAge} to ${p.development.maxAgeExclusive - 1}. Finish in the top ${p.development.cards} for a Tour Card and a place at the Worlds.`}>
      {p.development.eligible ? <p>You're eligible to play this season.</p> : <p>Not open to you at your age.</p>}
    </RouteCard>}
    {!pro && <RouteCard icon={<Vault />} title="Vault Series" done={p.vault.position === 1}
      standing={{ label: "Current ranking", value: rank(p.vault.position), note: "Top the ranking for a Worlds place" }}
      gives="The TV amateur series. Top the ranking and you get a place at the Worlds.">
    </RouteCard>}
    <RouteCard icon={<Crown />} title="World Championship" done={!!w.place}
      standing={{ label: "Worlds place", value: w.place ? "Secured" : "Not secured", note: w.place ? (BREAKOUT_ROUTES[w.place.route] ?? "Qualified") : "Multiple qualification routes" }}
      gives={`Get in through the World Ranking, a qualifier, or a big season on one of the routes above. Winning the Amateur World Masters, or ${w.fanFavouriteFans.toLocaleString("en-GB")} fans, also gets you a place.`}>
      {w.place ? <p className="road-good">You have a place: {BREAKOUT_ROUTES[w.place.route] ?? "qualified"}. Enter it from the calendar.</p> : <>
        {w.worldRanking !== null && <p>World Ranking: <b>{ordinal(w.worldRanking)}</b>.</p>}
        {w.qualifiers.length ? <p>Qualifiers: {w.qualifiers.map((e, i) => <span key={e.eventId}>{i ? ", " : ""}<EventLink saveId={saveId} e={e} /></span>)}.</p> : <p>No qualifiers left this season.</p>}
        <p>Fans: <b>{w.fans.toLocaleString("en-GB")}</b> of {w.fanFavouriteFans.toLocaleString("en-GB")} for a fan favourite place.</p>
      </>}
    </RouteCard>
    </div>
  </>;
}

/** Road to the Tour: every way to a Tour Card and to the World Championship, and where you stand on each. */
export function RoadToTourPage({ ctx }: { ctx: ShellContext }) {
  const id = ctx.save.id, q = usePathways(id), p = q.data;
  useEffect(() => { markVisited(id, "road"); }, [id]);
  const pro = !!p?.tourCard && !p.tourCard.offer;
  return <div className="space-y-3">
    <CareerPageHero kicker="Road to the Tour" title={pro ? "You're on the Tour" : "Every way in"} accent="#d83b58"
      stage={{ venue: { venueType: "professional-floor" }, circuit: "Q_SCHOOL", classification: "QUALIFIER" }}
      subtitle={<p>{pro ? "Stay in the top 64 of the World Ranking to keep your card." : "There's more than one way to a Tour Card and the World Championship. Try any of them; none rules out the others."}</p>}
      stats={p ? [{ label: "World Ranking", value: p.worlds.worldRanking ? ordinal(p.worlds.worldRanking) : "—" }, { label: "Challenger", value: p.challenger.position ? ordinal(p.challenger.position) : "—" },
        { label: "Vault", value: p.vault.position ? ordinal(p.vault.position) : "—", tone: "gold" }] : []} />
    <TourCardOffer saveId={id} />
    {q.isLoading ? <CareerLoading label="Reading your routes" /> : q.error ? <CareerError error={q.error} onRetry={() => q.refetch()} /> : p &&
      <CareerSection title={pro ? "Your season" : "Your routes"} icon={<Route aria-hidden />} accent="#d83b58"><Routes saveId={id} p={p} /></CareerSection>}
  </div>;
}
