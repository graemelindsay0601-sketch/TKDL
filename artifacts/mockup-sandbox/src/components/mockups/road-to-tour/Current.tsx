import { useState, type CSSProperties, type ReactNode } from "react";
import { BadgeCheck, Crown, GraduationCap, Route, Sparkles, Ticket, Vault } from "lucide-react";
import "./_group.css";
import "./_road.css";

type EventPreview = { eventId: string; name: string; week: number; status: string; key?: string; zone?: string };
type PathwaysView = {
  season: number; week: number; age: number | null;
  tourCard: { source: string; startSeason: number; endSeason: number; offer: { decideBy: { season: number; week: number } } | null } | null;
  qSchool: { pathway: string; firstStageFeePence: number; finalStageFeePence: number; next: EventPreview | null; nextSeason: number | null; finalStage: boolean; proCircuitAssociate: boolean };
  challenger: { access: string; position: number | null; cards: number; worldsPlaces: number; keepAccessTop: number; qSchoolFinalStage: number[]; qualifiers: EventPreview[] };
  development: { eligible: boolean; minAge: number; maxAgeExclusive: number; position: number | null; cards: number; worldsPlaces: number } | null;
  vault: { position: number | null; worldsPlaces: number };
  worlds: { place: { route: string } | null; breakoutWeek: number; qualifiers: EventPreview[]; fans: number; fanFavouriteFans: number; worldRanking: number | null };
};
const PREVIEW_PATHWAYS: PathwaysView = {
  season: 4, week: 21, age: 22,
  tourCard: { source: "CHALLENGER_TOUR", startSeason: 4, endSeason: 5, offer: { decideBy: { season: 4, week: 23 } } },
  qSchool: { pathway: "EUROPE", firstStageFeePence: 30000, finalStageFeePence: 45000,
    next: { eventId: "preview-q-school", key: "q-school-first-europe-d1", name: "European Q-School · First Stage", week: 28, status: "REGISTRATION_OPEN", zone: "EUROPE" }, nextSeason: null, finalStage: false, proCircuitAssociate: false },
  challenger: { access: "PASS", position: 8, cards: 4, worldsPlaces: 4, keepAccessTop: 16, qSchoolFinalStage: [3, 4],
    qualifiers: [{ eventId: "preview-challenger-qualifier", key: "challenger-qualifier", name: "Challenger Tour Qualifier", week: 25, status: "REGISTRATION_OPEN", zone: "EUROPE" }] },
  development: { eligible: true, minAge: 16, maxAgeExclusive: 24, position: 12, cards: 3, worldsPlaces: 3 },
  vault: { position: 6, worldsPlaces: 1 },
  worlds: { place: null, breakoutWeek: 40, qualifiers: [{ eventId: "preview-world-qualifier", key: "amateur-world-qualifier", name: "Amateur World Qualifier", week: 35, status: "REGISTRATION_OPEN", zone: "EUROPE" }],
    fans: 4200, fanFavouriteFans: 10000, worldRanking: null },
};
const rank = (n: number | null) => n === null ? "Not ranked yet" : ordinal(n);
const formatPence = (p: number) => `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
const sourceLabel = (s: string) => s.toLowerCase().split(/[_\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const BREAKOUT_ROUTES: Record<string, string> = {
  WORLD_RANKING: "World Ranking", CHALLENGER: "Challenger Tour", CHALLENGER_RANKING: "Challenger Tour",
  Q_SCHOOL: "Q-School", DEVELOPMENT: "Development Tour", VAULT: "Vault Series",
  AMATEUR_WORLD_MASTERS: "Amateur World Masters", FAN_FAVOURITE: "Fan favourite",
};
const PLATES = {
  "community-hall": { src: "/__mockup/images/road-to-tour/career-venue-county-hall.jpg" },
  "professional-floor": { src: "/__mockup/images/road-to-tour/career-venue-floor.jpg" },
};
function CareerPageHero({ kicker, title, subtitle, stats = [], accent = "#d83b58" }: {
  kicker: string; title: ReactNode; subtitle?: ReactNode; accent?: string; stats?: { label: string; value: ReactNode; tone?: string }[];
}) {
  return <section className="career-page-hero road-preview-hero" style={{ "--hero-accent": accent } as CSSProperties}>
    <div className="career-page-hero__stage road-preview-hero__stage">
      <div className="road-preview-hero__backdrop" aria-hidden="true" />
      <div className="career-page-hero__content"><div className="career-page-hero__text">
        <p className="career-page-hero__kicker"><i aria-hidden="true" />{kicker}</p>
        <h1 className="career-page-hero__title">{title}</h1>
        {subtitle && <div className="career-page-hero__subtitle">{subtitle}</div>}
      </div></div>
    </div>
    {stats.length > 0 && <dl className="career-page-hero__stats" style={{ "--hero-cols": Math.min(stats.length, 5) } as CSSProperties}>
      {stats.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
    </dl>}
  </section>;
}
function CareerSection({ title, icon, accent, children }: { title: string; icon: ReactNode; accent: string; children: ReactNode }) {
  return <section className="career-section road-preview-section" style={{ "--section-accent": accent } as React.CSSProperties}>
    <header className="road-preview-section__header"><span>{icon}</span><h2>{title}</h2></header>{children}
  </section>;
}

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
const EventLink = ({ e, onOpen }: { e: EventPreview; onOpen: (event: EventPreview) => void }) =>
  <button type="button" className="road-event-link" onClick={() => onOpen(e)}>{e.name}, week {e.week}{e.status === "REGISTRATION_OPEN" ? " (entries open)" : ""}</button>;

/**
 * A Tour Card you've won but not yet taken: take it and turn professional, or turn it down and stay amateur (the card
 * passes to the next player in line). After the decide-by week it is yours.
 */
function TourCardOffer({ offer, onDecision }: {
  offer: { source: string; decideBy: { season: number; week: number }; startSeason: number; endSeason: number };
  onDecision: (decision: "ACCEPT" | "DECLINE") => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const seasons = offer.startSeason === offer.endSeason ? `season ${offer.startSeason}` : `seasons ${offer.startSeason}–${offer.endSeason}`;
  return <section className="road-offer" aria-label="Tour Card offer">
    <Ticket aria-hidden />
    <div>
      <b>You've earned a Tour Card</b>
      <p>{sourceLabel(offer.source)}. Take it and you turn professional for {seasons}: you can play the Pro Circuit, but not amateur events, the Vault or the Challenger Tour.
        Turn it down and it goes to the next player in line, and you stay amateur.</p>
      <p className="road-offer__by">Decide by week {offer.decideBy.week} of season {offer.decideBy.season}, or it's yours automatically. Once you take it, you can't give it back.</p>
      {message && <p className="road-offer__error" role="status">{message}</p>}
      {!confirming ? <div className="road-offer__actions">
        <button type="button" className="career-btn career-btn-primary" onClick={() => { onDecision("ACCEPT"); setMessage("Preview choice recorded: Tour Card accepted."); }}>Take the card</button>
        <button type="button" className="career-btn career-btn-ghost" onClick={() => setConfirming(true)}>Turn it down</button>
      </div> : <div className="road-offer__actions" role="alertdialog" aria-label="Turn down the Tour Card">
        <span>Turn it down for good? It passes to the next player.</span>
        <button type="button" className="career-btn career-btn-primary" onClick={() => { onDecision("DECLINE"); setMessage("Preview choice recorded: the card passes to the next player."); }} autoFocus>Yes, stay amateur</button>
        <button type="button" className="career-btn career-btn-ghost" onClick={() => setConfirming(false)}>Keep thinking</button>
      </div>}
    </div>
  </section>;
}

function Routes({ p, onOpenEvent }: { p: PathwaysView; onOpenEvent: (event: EventPreview) => void }) {
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
      {q.finalStage ? <p>You're in this season's Final Stage.</p> : q.next ? <p>Next: <EventLink e={q.next} onOpen={onOpenEvent} />.</p>
        : <p>This season's Q-School is over. The next one is in season {q.nextSeason}, weeks 2–4.</p>}
      {q.proCircuitAssociate && <p className="road-good">You did well enough at Q-School to play Pro Circuit events this season, even without a card.</p>}
    </RouteCard>}
    {!pro && <RouteCard icon={<Route />} title="Challenger Tour" done={c.position !== null && c.position <= c.cards}
      standing={{ label: "Current ranking", value: rank(c.position), note: `Top ${c.cards} earn a Tour Card` }}
      gives={`Finish in the top ${c.cards} for a Tour Card and a place at the Worlds. The top ${c.qSchoolFinalStage[1]} skip straight to the next Q-School Final Stage.`}>
      {c.access === "OPEN_SEASON" ? <p>Anyone without a card can play it this season.</p>
        : c.access === "PASS" ? <p>You can play it this season.</p>
        : <p>To play it this season, enter Q-School or reach the last 16 of a qualifier
          {c.qualifiers.length ? <> (<EventLink e={c.qualifiers[0]} onOpen={onOpenEvent} />)</> : " (none left this season)"}.</p>}
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
        {w.qualifiers.length ? <p>Qualifiers: {w.qualifiers.map((e, i) => <span key={e.eventId}>{i ? ", " : ""}<EventLink e={e} onOpen={onOpenEvent} /></span>)}.</p> : <p>No qualifiers left this season.</p>}
        <p>Fans: <b>{w.fans.toLocaleString("en-GB")}</b> of {w.fanFavouriteFans.toLocaleString("en-GB")} for a fan favourite place.</p>
      </>}
    </RouteCard>
    </div>
  </>;
}

/** Road to the Tour: every way to a Tour Card and to the World Championship, and where you stand on each. */
export function Current() {
  const [p, setP] = useState<PathwaysView>(PREVIEW_PATHWAYS);
  const [selectedEvent, setSelectedEvent] = useState<EventPreview | null>(null);
  const [feedback, setFeedback] = useState("");
  const pro = !!p.tourCard && !p.tourCard.offer;
  const offer = p.tourCard?.offer ? {
    source: p.tourCard.source, startSeason: p.tourCard.startSeason, endSeason: p.tourCard.endSeason, decideBy: p.tourCard.offer.decideBy,
  } : null;
  const decide = (decision: "ACCEPT" | "DECLINE") => {
    if (decision === "ACCEPT") {
      setP(current => ({ ...current, tourCard: current.tourCard ? { ...current.tourCard, offer: null } : null }));
      setFeedback("Preview choice recorded: Tour Card accepted. You are now shown as a professional.");
    } else {
      setP(current => ({ ...current, tourCard: null }));
      setFeedback("Preview choice recorded: the card passes to the next player; amateur routes remain open.");
    }
  };
  return <main className="road-preview">
    <div className="road-preview__notice"><b>LOCAL PREVIEW DATA</b><span>Illustrative standings and event examples only. Nothing here is a live Career save.</span></div>
    <CareerPageHero kicker="Road to the Tour · Season 4 · Week 21" title={pro ? "You're on the Tour" : "Every way in"} accent="#d83b58"
      subtitle={<p>{pro ? "Stay in the top 64 of the World Ranking to keep your card." : "There's more than one way to a Tour Card and the World Championship. Try any of them; none rules out the others."}</p>}
      stats={[{ label: "World Ranking", value: p.worlds.worldRanking ? ordinal(p.worlds.worldRanking) : "—" }, { label: "Challenger", value: p.challenger.position ? ordinal(p.challenger.position) : "—" },
        { label: "Vault", value: p.vault.position ? ordinal(p.vault.position) : "—", tone: "gold" }]} />
    {feedback && <p className="road-preview__feedback" role="status">{feedback}</p>}
    {offer && <TourCardOffer offer={offer} onDecision={decide} />}
    <CareerSection title={pro ? "Your season" : "Your routes"} icon={<Route aria-hidden />} accent="#d83b58">
      <Routes p={p} onOpenEvent={setSelectedEvent} />
    </CareerSection>
    {selectedEvent && <aside className="road-preview__event" aria-live="polite">
      <div><small>EVENT PREVIEW · SEASON {p.season}</small><b>{selectedEvent.name}</b><span>Week {selectedEvent.week} · {selectedEvent.status === "REGISTRATION_OPEN" ? "Entries open" : selectedEvent.status}</span></div>
      <button type="button" onClick={() => setSelectedEvent(null)} aria-label="Close event preview">Close</button>
    </aside>}
  </main>;
}
