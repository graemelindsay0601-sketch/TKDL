import { useState, type ReactNode } from "react";
import {
  ArrowDownRight, ArrowRight, BadgeCheck, CalendarDays, Check, ChevronDown,
  CircleDot, Crown, GraduationCap, Medal, Route, Sparkles, Ticket, Vault, X,
} from "lucide-react";
import "./_group.css";
import "./redesign.css";

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

// Explicitly illustrative local preview values; no live Career data is loaded.
const PREVIEW_PATHWAYS: PathwaysView = {
  season: 4, week: 21, age: 22,
  tourCard: { source: "CHALLENGER_TOUR", startSeason: 4, endSeason: 5, offer: { decideBy: { season: 4, week: 23 } } },
  qSchool: { pathway: "EUROPE", firstStageFeePence: 30000, finalStageFeePence: 45000,
    next: { eventId: "preview-q-school", key: "q-school-first-europe-d1", name: "European Q-School · First Stage", week: 28, status: "REGISTRATION_OPEN", zone: "EUROPE" }, nextSeason: null, finalStage: false, proCircuitAssociate: false },
  challenger: { access: "PASS", position: 8, cards: 4, worldsPlaces: 4, keepAccessTop: 16, qSchoolFinalStage: [3, 4],
    qualifiers: [{ eventId: "preview-challenger-qualifier", key: "challenger-qualifier", name: "Challenger Tour Qualifier", week: 25, status: "REGISTRATION_OPEN", zone: "EUROPE" }] },
  development: { eligible: true, minAge: 16, maxAgeExclusive: 24, position: 12, cards: 3, worldsPlaces: 3 },
  vault: { position: 6, worldsPlaces: 1 },
  worlds: { place: null, breakoutWeek: 40, qualifiers: [{ eventId: "preview-world-qualifier", key: "amateur-world-qualifier", name: "Amateur World Qualifier", week: 35, status: "REGISTRATION_OPEN", zone: "EUROPE" }], fans: 4200, fanFavouriteFans: 10000, worldRanking: null },
};
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
const rank = (n: number | null) => n === null ? "Not ranked yet" : ordinal(n);
const money = (p: number) => `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const routeNames: Record<string, string> = {
  WORLD_RANKING: "World Ranking", CHALLENGER: "Challenger Tour", CHALLENGER_RANKING: "Challenger Tour",
  Q_SCHOOL: "Q-School", DEVELOPMENT: "Development Tour", VAULT: "Vault Series",
  AMATEUR_WORLD_MASTERS: "Amateur World Masters", FAN_FAVOURITE: "Fan favourite",
};

function EventButton({ event, onOpen }: { event: EventPreview; onOpen: (event: EventPreview) => void }) {
  return <button className="rt-event" onClick={() => onOpen(event)} type="button">{event.name} · W{event.week}<ArrowRight size={13} /></button>;
}

function RouteTile({ icon, number, title, accent, rankLabel, rankValue, rankNote, description, children, completed }: {
  icon: ReactNode; number: string; title: string; accent: string; rankLabel: string; rankValue: string; rankNote: string; description: string; children?: ReactNode; completed?: boolean;
}) {
  return <article className="rt-tile" style={{ "--tile-accent": accent } as React.CSSProperties}>
    <div className="rt-tile__top"><span className="rt-tile__number">{number}</span>{completed && <BadgeCheck className="rt-tile__complete" size={17} />}</div>
    <h3 data-route={number}><span className="rt-tile__title-emblem" aria-hidden="true">{icon}</span><span className="rt-tile__title-copy">{title}</span></h3>
    <div className="rt-rank"><span>{rankLabel}</span><strong>{rankValue}</strong><small>{rankNote}</small></div>
    <p className="rt-tile__description">{description}</p>
    {children && <div className="rt-tile__next">{children}</div>}
  </article>;
}

export function Redesign() {
  const [p, setP] = useState(PREVIEW_PATHWAYS);
  const [event, setEvent] = useState<EventPreview | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState("");
  const pro = !!p.tourCard && !p.tourCard.offer;
  const offer = p.tourCard?.offer;
  const decide = (choice: "ACCEPT" | "DECLINE") => {
    if (choice === "ACCEPT") {
      setP(v => ({ ...v, tourCard: v.tourCard ? { ...v.tourCard, offer: null } : null }));
      setDecisionMessage("Preview choice recorded: Tour Card accepted. You are now shown as a professional.");
    } else {
      setP(v => ({ ...v, tourCard: null }));
      setDecisionMessage("Preview choice recorded: the card passes to the next player; amateur routes remain open.");
    }
    setConfirmDecline(false);
  };
  const worldPct = Math.min(100, (p.worlds.fans / p.worlds.fanFavouriteFans) * 100);
  return <main className="rt-page">
    <div className="rt-preview-label"><span><CircleDot size={12} /> LOCAL PREVIEW DATA</span><p>Illustrative standings and event examples only · not a live Career save</p></div>
    <header className="rt-hero">
      <div className="rt-hero__image" />
      <div className="rt-hero__grain" />
      <div className="rt-hero__content">
        <div className="rt-eyebrow"><span /> TKDL CAREER <i>/</i> SEASON {p.season} · WEEK {p.week}</div>
        <div className="rt-hero__title-row">
          <div><p className="rt-overline">THE PROGRESSION GUIDE</p><h1>{pro ? <>You’re on<br /><em>the Tour.</em></> : <>Every way<br /><em>in.</em></>}</h1></div>
          <div className="rt-hero__lead"><span className="rt-hero__rule" />{pro ? "Stay inside the World Ranking top 64 to retain your card." : "No single road. Build your season across the routes that stay open to you."}</div>
        </div>
        <div className="rt-hero__stats">
          <div><small>WORLD RANKING</small><strong>{p.worlds.worldRanking ? ordinal(p.worlds.worldRanking) : "—"}</strong><span>{pro ? "retention: top 64" : "not ranked yet"}</span></div>
          <div><small>CHALLENGER TOUR</small><strong>{rank(p.challenger.position)}</strong><span>top {p.challenger.cards} win a card</span></div>
          <div><small>VAULT SERIES</small><strong>{rank(p.vault.position)}</strong><span>optional amateur route</span></div>
          <div className="rt-season-stamp"><CalendarDays size={16} /><b>SEASON {p.season}</b><span>WEEK {p.week}</span></div>
        </div>
      </div>
      <div className="rt-hero__vertical">ROAD TO THE TOUR <span>·</span> 01—03</div>
    </header>

    {decisionMessage && <div className="rt-message" role="status"><Check size={16} />{decisionMessage}<button type="button" onClick={() => setDecisionMessage("")} aria-label="Dismiss"><X size={15} /></button></div>}
    {offer && <section className="rt-offer">
      <div className="rt-offer__seal"><Ticket size={23} /></div>
      <div className="rt-offer__body">
        <div className="rt-offer__eyebrow">DECISION PENDING · EARNED THROUGH CHALLENGER TOUR</div>
        <h2>Your Tour Card is waiting.</h2>
        <p>Accept to become a professional for seasons {p.tourCard!.startSeason}–{p.tourCard!.endSeason}. You can play the Pro Circuit, but not amateur events, Vault or Challenger during that term. Declining passes the card to the next player and keeps your amateur routes open.</p>
        <div className="rt-offer__foot"><span>DECIDE BY <b>WEEK {offer.decideBy.week}, SEASON {offer.decideBy.season}</b> · ACCEPTANCE IS IRREVERSIBLE</span>
          {!confirmDecline ? <div className="rt-offer__actions"><button type="button" className="rt-button rt-button--gold" onClick={() => decide("ACCEPT")}>Accept Tour Card <ArrowRight size={15} /></button><button type="button" className="rt-button rt-button--quiet" onClick={() => setConfirmDecline(true)}>Decline card</button></div> :
            <div className="rt-offer__actions" role="alertdialog" aria-label="Confirm declining Tour Card"><span className="rt-confirm">Pass the card for good?</span><button className="rt-button rt-button--gold" type="button" onClick={() => decide("DECLINE")}>Yes, stay amateur</button><button type="button" className="rt-button rt-button--quiet" onClick={() => setConfirmDecline(false)}>Keep thinking</button></div>}
        </div>
      </div>
    </section>}

    <section className="rt-journey" aria-label="Progression overview">
      <div className="rt-section-heading"><div><span>THE CAMPAIGN ROUTE</span><h2>Many ways forward. <em>One career.</em></h2></div><p>Routes run in parallel. Before an eligibility or card decision, one does not rule out another.</p></div>
      <div className="rt-journey__rail">
        <article className="rt-journey__origin">
          <div className="rt-step">01 <span>AMATEUR ROUTES</span></div>
          <div className="rt-origin-list">
            {!pro ? <><span>Q-School <b>{p.qSchool.finalStage ? "Final Stage" : "Entry route"}</b></span><span>Challenger <b>{rank(p.challenger.position)}</b></span>{p.development && <span>Development <b>{p.development.eligible ? rank(p.development.position) : "Age restricted"}</b></span>}<span>Vault Series <b>{rank(p.vault.position)}</b></span></> : <><span>World Ranking <b>{rank(p.worlds.worldRanking)}</b></span><span>Card retention <b>Top 64</b></span></>}
          </div>
          <small>{pro ? "Finish inside the World Ranking top 64 to retain your card." : "Standings can lead to a card or a Worlds place."}</small>
        </article>
        <div className="rt-flow" aria-hidden><span /><ArrowRight size={16} /></div>
        <article className={`rt-journey__card${pro || offer ? " is-earned" : ""}`}><div className="rt-step">02 <span>TOUR CARD</span></div><div className="rt-card-emblem"><Medal size={32} strokeWidth={1.3} /></div><strong>{pro ? "On the Tour" : offer ? "Decision pending" : "Card line"}</strong><small>{pro ? "World top 64 retains the card" : offer ? "Accept to turn professional" : `Challenger top ${p.challenger.cards} · Q-School Final Stage`}</small></article>
        <div className="rt-flow" aria-hidden><span /><ArrowRight size={16} /></div>
        <article className="rt-journey__world"><div className="rt-step">03 <span>WORLD CHAMPIONSHIP</span></div><div className="rt-world-globe">TKDL</div><strong>{p.worlds.place ? "Place secured" : "Earn your place"}</strong><small>{p.worlds.place ? routeNames[p.worlds.place.route] ?? "Qualified" : "Ranking · qualifiers · route rankings · Masters · fan favourite"}</small></article>
      </div>
    </section>

    <section className="rt-routes-section">
      <div className="rt-section-heading rt-section-heading--routes"><div><span>YOUR OPEN ROUTES</span><h2>Choose your next <em>throw.</em></h2></div><div className="rt-parallel"><span><Route size={14} /> RUN IN PARALLEL</span><p>Routes remain open unless a real status or eligibility decision changes that.</p></div></div>
      <div className="rt-route-grid">
        {!pro && <RouteTile number="01" icon={<GraduationCap />} title="Q-School" accent="#d3384e" rankLabel="YOUR ROUTE" rankValue={p.qSchool.finalStage ? "Final Stage" : "Entry route"} rankNote={p.qSchool.finalStage ? "Place secured" : "Final Stage is the card stage"} completed={p.qSchool.finalStage}
          description={`Win a day at Final Stage or finish near the top overall for a Tour Card. First Stage ${money(p.qSchool.firstStageFeePence)}; Final Stage adds ${money(p.qSchool.finalStageFeePence)}.`}>
          {p.qSchool.finalStage ? <span className="rt-next-copy"><Check size={14} /> You’re in this season’s Final Stage.</span> : p.qSchool.next ? <><span className="rt-next-label">NEXT EVENT</span><EventButton event={p.qSchool.next} onOpen={setEvent} /></> : <span className="rt-next-copy">Next season {p.qSchool.nextSeason}, weeks 2–4.</span>}
          {p.qSchool.proCircuitAssociate && <span className="rt-next-copy">Pro Circuit access this season, even without a card.</span>}
        </RouteTile>}
        {!pro && <RouteTile number="02" icon={<Route />} title="Challenger Tour" accent="#db4a50" rankLabel="CURRENT RANKING" rankValue={rank(p.challenger.position)} rankNote={`Top ${p.challenger.cards} earn a Tour Card`} completed={p.challenger.position !== null && p.challenger.position <= p.challenger.cards}
          description={`Top ${p.challenger.cards} earn a Tour Card and Worlds place. Q-School positions ${p.challenger.qSchoolFinalStage[0]}–${p.challenger.qSchoolFinalStage[1]} are exempt to the next Final Stage.`}>
          <span className="rt-next-copy">{p.challenger.access === "OPEN_SEASON" ? "Open to anyone without a card this season." : p.challenger.access === "PASS" ? "Access eligible this season. Qualifier route: reach the last 16 to earn access." : "Enter Q-School or reach the last 16 of a qualifier to access."}</span>
          {p.challenger.qualifiers.length > 0 && <><span className="rt-next-label">CHALLENGER QUALIFIER</span><EventButton event={p.challenger.qualifiers[0]} onOpen={setEvent} /></>}
          <span className="rt-next-label">ACCESS RETAINED · TOP {p.challenger.keepAccessTop}</span>
        </RouteTile>}
        {!pro && p.development && <RouteTile number="03" icon={<Sparkles />} title="Development Tour" accent="#cf9e45" rankLabel="CURRENT RANKING" rankValue={p.development.eligible ? rank(p.development.position) : "Not eligible"} rankNote={p.development.eligible ? `Top ${p.development.cards} earn a card` : "Age restricted"} completed={p.development.position !== null && p.development.position <= p.development.cards}
          description={`For ages ${p.development.minAge} to under ${p.development.maxAgeExclusive}. Top ${p.development.cards} earn a Tour Card and Worlds place.`}>
          <span className="rt-next-copy">{p.development.eligible ? "Age eligible for this season." : "Not open at your age."}</span>
        </RouteTile>}
        {!pro && <RouteTile number="04" icon={<Vault />} title="Vault Series" accent="#c29a55" rankLabel="CURRENT RANKING" rankValue={rank(p.vault.position)} rankNote="Top the ranking for a Worlds place" completed={p.vault.position === 1}
          description="The TV amateur series. An optional route: top the ranking and earn a place at the Worlds.">
          <span className="rt-next-copy"><Vault size={14} /> Optional. Playing Vault does not close other routes.</span>
        </RouteTile>}
        <RouteTile number="05" icon={<Crown />} title="World Championship" accent="#e3bf70" rankLabel="WORLDS PLACE" rankValue={p.worlds.place ? "Secured" : "Not secured"} rankNote={p.worlds.place ? routeNames[p.worlds.place.route] ?? "Qualified" : "Multiple qualification routes"} completed={!!p.worlds.place}
          description={`Qualify via World Ranking, a qualifier, route rankings, winning the Amateur World Masters, or reaching ${p.worlds.fanFavouriteFans.toLocaleString("en-GB")} fans.`}>
          {p.worlds.place ? <span className="rt-next-copy"><Check size={14} /> Place secured via {routeNames[p.worlds.place.route] ?? "qualification"}.</span> : <>
            <div className="rt-fan-meter"><div><span>FAN FAVOURITE</span><b>{p.worlds.fans.toLocaleString("en-GB")} <i>/ {p.worlds.fanFavouriteFans.toLocaleString("en-GB")}</i></b></div><span className="rt-meter-track"><i style={{ width: `${worldPct}%` }} /></span></div>
            <span className="rt-next-label">QUALIFIER</span>{p.worlds.qualifiers.map(e => <EventButton key={e.eventId} event={e} onOpen={setEvent} />)}
            <span className="rt-next-copy">Also: World Ranking or a place via route rankings / Amateur World Masters.</span>
          </>}
        </RouteTile>
      </div>
    </section>

    <footer className="rt-footer"><span><span className="rt-footer__mark">TKDL</span> CAREER · ROAD TO THE TOUR</span><p>Illustrative local preview · routes, standings and event examples are not live save data.</p><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>BACK TO TOP <ArrowDownRight size={14} /></button></footer>
    {event && <div className="rt-event-scrim" role="presentation" onClick={() => setEvent(null)}><section className="rt-event-modal" role="dialog" aria-modal="true" aria-labelledby="rt-event-title" onClick={e => e.stopPropagation()}>
      <button className="rt-event-modal__close" type="button" onClick={() => setEvent(null)} aria-label="Close event preview"><X size={18} /></button>
      <span className="rt-overline">EVENT PREVIEW · SEASON {p.season}</span><h2 id="rt-event-title">{event.name}</h2><div className="rt-event-modal__facts"><span><CalendarDays size={16} /> WEEK {event.week}</span><span className="rt-status"><i /> {event.status === "REGISTRATION_OPEN" ? "ENTRIES OPEN" : event.status}</span></div>
      <p>This is a local illustrative event detail. It does not navigate away or register an entry.</p><button type="button" className="rt-button rt-button--gold" onClick={() => setEvent(null)}>Back to routes <ChevronDown size={15} /></button>
    </section></div>}
  </main>;
}
