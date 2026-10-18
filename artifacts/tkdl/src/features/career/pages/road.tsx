import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { BadgeCheck, Crown, GraduationCap, Route, Sparkles, Ticket, Vault } from "lucide-react";
import { usePathways, useTourCard, useDecideTourCard, errorMessage, type PathwaysView } from "../api";
import { CareerError, CareerLoading, CareerSection } from "../components";
import { CareerPageHero } from "../page-hero";
import { BREAKOUT_ROUTES, formatPence, ordinal, sourceLabel } from "../model";
import type { ShellContext } from "../shell";
import "./road.css";

const rank = (n: number | null) => n === null ? "Not ranked yet" : ordinal(n);

/** One route: what it gives, where you stand, and the next step. */
function RouteCard({ icon, title, gives, children, done }: { icon: ReactNode; title: string; gives: string; children: ReactNode; done?: boolean }) {
  return <article className="road-route" data-done={done || undefined}>
    <header><span aria-hidden>{icon}</span><b>{title}</b>{done && <BadgeCheck className="road-route__done" aria-label="Done" />}</header>
    <p className="road-route__gives">{gives}</p>
    <div className="road-route__you">{children}</div>
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
      <p>{sourceLabel(offer.source)}. Take it and you turn professional for {seasons}: the Pro Circuit, the European Series and a World Ranking, but no more amateur events, Vault or Challenger Tour.
        Turn it down and it goes to the next player in line; you stay amateur and every amateur route stays open.</p>
      <p className="road-offer__by">Decide by the end of season {offer.decideBy.season}, week {offer.decideBy.week}. After that the card is yours. Once taken, it can't be handed back.</p>
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
  return <div className="road-routes">
    {!pro && <RouteCard icon={<GraduationCap />} title="Q-School" done={q.finalStage}
      gives={`Every Final Stage day winner earns a Tour Card, and more go down the Order of Merit. ${formatPence(q.firstStageFeePence)} to enter, ${formatPence(q.finalStageFeePence)} more if you reach the Final Stage. Missing out still gets you on the Challenger Tour, and the best of the rest can play Pro Circuit events.`}>
      {q.finalStage ? <p>You're in this season's Final Stage.</p> : q.next ? <p>Next: <EventLink saveId={saveId} e={q.next} />.</p>
        : <p>This season's Q-School is over. The next one is in season {q.nextSeason}, weeks 2–4.</p>}
      {q.proCircuitAssociate && <p className="road-good">You're a Pro Circuit associate this season: you can enter Pro Circuit Championships without a card.</p>}
    </RouteCard>}
    {!pro && <RouteCard icon={<Route />} title="Challenger Tour" done={c.position !== null && c.position <= c.cards}
      gives={`The top ${c.cards} at the end of the season earn Tour Cards and the top ${c.worldsPlaces} not yet qualified get a World Championship place. ${ordinal(c.qSchoolFinalStage[0])}–${ordinal(c.qSchoolFinalStage[1])} go straight to next season's Q-School Final Stage, and the top ${c.keepAccessTop} keep their Challenger Tour place.`}>
      <p>Your ranking: <b>{rank(c.position)}</b>.</p>
      {c.access === "OPEN_SEASON" ? <p>Open to everyone without a card this season.</p>
        : c.access === "PASS" ? <p>You have this season's Challenger Tour pass.</p>
        : <p>You need this season's pass: enter Q-School, or reach the last 16 of a Challenger Tour Qualifier
          {c.qualifiers.length ? <> (<EventLink saveId={saveId} e={c.qualifiers[0]} />)</> : " (none left this season)"}.</p>}
    </RouteCard>}
    {!pro && p.development && <RouteCard icon={<Sparkles />} title="Development Tour" done={p.development.position !== null && p.development.position <= p.development.cards}
      gives={`For players aged ${p.development.minAge} to ${p.development.maxAgeExclusive - 1}. The top ${p.development.cards} earn Tour Cards and the top ${p.development.worldsPlaces} not yet qualified get a World Championship place: the way a teenage unknown reaches the Palace.`}>
      {p.development.eligible ? <p>Your ranking: <b>{rank(p.development.position)}</b>.</p> : <p>Not open to you at your age.</p>}
    </RouteCard>}
    {!pro && <RouteCard icon={<Vault />} title="Vault Series" done={p.vault.position === 1}
      gives="The televised amateur series. The ranking leader without a card gets a World Championship place.">
      <p>Your ranking: <b>{rank(p.vault.position)}</b>.</p>
    </RouteCard>}
    <RouteCard icon={<Crown />} title="World Championship" done={!!w.place}
      gives={`The top of the World Ranking go straight in. Everyone else: the qualifiers, or a breakout place handed out after week ${w.breakoutWeek} for a big year on the Challenger Tour, Development Tour or Vault, winning the Amateur World Masters, or a fan favourite with ${w.fanFavouriteFans.toLocaleString("en-GB")}+ fans.`}>
      {w.place ? <p className="road-good">You have a place: {BREAKOUT_ROUTES[w.place.route] ?? "qualified"}. Enter it from the calendar.</p> : <>
        {w.worldRanking !== null && <p>World Ranking: <b>{ordinal(w.worldRanking)}</b>.</p>}
        {w.qualifiers.length ? <p>Qualifiers: {w.qualifiers.map((e, i) => <span key={e.eventId}>{i ? ", " : ""}<EventLink saveId={saveId} e={e} /></span>)}.</p> : <p>No qualifiers left this season.</p>}
        <p>Fans: <b>{w.fans.toLocaleString("en-GB")}</b> of {w.fanFavouriteFans.toLocaleString("en-GB")} for a fan favourite place.</p>
      </>}
    </RouteCard>
  </div>;
}

/** Road to the Tour: every way to a Tour Card and to the World Championship, and where you stand on each. */
export function RoadToTourPage({ ctx }: { ctx: ShellContext }) {
  const id = ctx.save.id, q = usePathways(id), p = q.data;
  const pro = !!p?.tourCard && !p.tourCard.offer;
  return <div className="space-y-3">
    <CareerPageHero kicker="Road to the Tour" title={pro ? "You're on the Tour" : "Every way in"} accent="#4ade80"
      stage={{ venue: { venueType: "professional-floor" }, circuit: "Q_SCHOOL", classification: "QUALIFIER" }}
      subtitle={<p>{pro ? "Keep your card by finishing inside the top 64 of the World Ranking when it comes up for renewal." : "There's more than one way to a Tour Card and the Palace. Pick the routes that suit you; none of them shuts the others."}</p>}
      stats={p ? [{ label: "World Ranking", value: p.worlds.worldRanking ? ordinal(p.worlds.worldRanking) : "—" }, { label: "Challenger", value: p.challenger.position ? ordinal(p.challenger.position) : "—" },
        { label: "Vault", value: p.vault.position ? ordinal(p.vault.position) : "—", tone: "gold" }] : []} />
    <TourCardOffer saveId={id} />
    {q.isLoading ? <CareerLoading label="Reading your routes" /> : q.error ? <CareerError error={q.error} onRetry={() => q.refetch()} /> : p &&
      <CareerSection title={pro ? "Your season" : "Your routes"} icon={<Route aria-hidden />} accent="#4ade80"><Routes saveId={id} p={p} /></CareerSection>}
  </div>;
}
