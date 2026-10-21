import { useState } from "react";
import { CalendarDays, Check, CircleDollarSign, MapPin, Radio, Star, Trophy } from "lucide-react";
import { CareerNavigation } from "./CareerNavigation";
import "./_group.css";
import "./ProAm.css";

type Stop = {
  town: string;
  day: string;
  name: string;
  rank: number;
  average: string;
  fee: number;
  travel: number;
  prize: number;
  shirtImage: string;
  shirtName: string;
};

const stops: Stop[] = [
  { town: "Nottingham", day: "Wednesday", name: "Rook Calder", rank: 1, average: "96.4", fee: 12, travel: 0, prize: 35, shirtImage: "/__mockup/images/proam-velvet-circuit.webp", shirtName: "Velvet Circuit Arc" },
  { town: "Derby", day: "Friday", name: "Mara Vale", rank: 4, average: "94.1", fee: 10, travel: 4, prize: 30, shirtImage: "/__mockup/images/proam-citrine-crown.webp", shirtName: "Citrine Crown Arc" },
  { town: "Sheffield", day: "Saturday", name: "Ivo Crane", rank: 6, average: "92.8", fee: 12, travel: 6, prize: 35, shirtImage: "/__mockup/images/proam-aurora-break.webp", shirtName: "Aurora Break Arc" },
];

const pounds = (value: number) => `£${value}`;

export function ProAm() {
  const [available, setAvailable] = useState(182);
  const [booked, setBooked] = useState<Stop | null>(null);
  const [notice, setNotice] = useState("");
  const [legReady, setLegReady] = useState(false);

  const bookStop = (stop: Stop) => {
    const totalCost = stop.fee + stop.travel;
    if (booked || totalCost > available) return;
    setBooked(stop);
    setAvailable((funds) => funds - totalCost);
    setNotice(`${stop.town} is confirmed. Your place is on the card for ${stop.day}.`);
    setLegReady(false);
  };

  const prepareLeg = () => {
    if (!booked) return;
    setLegReady(true);
    setNotice(`Your leg against ${booked.name} is ready to play.`);
  };

  const quickSim = () => {
    if (!booked) return;
    setLegReady(false);
    setNotice(`Quick simulation complete. ${booked.name} took the leg. This is a local mock result.`);
  };

  return (
    <main className="career-root proam-show">
      <CareerNavigation />

      <header className="pa-masthead">
        <div className="pa-hero-ornament" aria-hidden="true">
          <svg viewBox="0 0 300 300" fill="none">
            <circle cx="150" cy="150" r="139" />
            <circle cx="150" cy="150" r="105" />
            <circle cx="150" cy="150" r="71" />
            <circle cx="150" cy="150" r="38" />
            <circle cx="150" cy="150" r="9" />
            <path d="M150 11v278M11 150h278M52 52l196 196M248 52 52 248M102 20l96 260M280 102 20 198M198 20 102 280M20 102l260 96" />
          </svg>
          <span className="pa-hero-dart">01</span>
        </div>
        <div className="pa-masthead-copy">
          <p className="pa-kicker"><i /> Nights out <span>/</span> Exhibition circuit</p>
          <h1>Pro-Am<br /><em>Nights</em></h1>
          <div className="pa-hero-rule"><span>WEEK 18</span><b /> <span>THREE STOPS · ONE LEG EACH</span></div>
        </div>
        <div className="pa-event-stamp" aria-label="Professional amateur exhibition">
          <span className="pa-stamp-top">CLUB</span>
          <Star size={20} fill="currentColor" />
          <span>PRO</span><span>AM</span>
          <small>EXHIBITION</small>
        </div>
      </header>

      <section className="pa-scoreboard" aria-label="Exhibition circuit overview">
        <div className="pa-scoreboard-main">
          <span className="pa-live-mark"><Radio size={17} /></span>
          <div className="pa-scoreboard-title">
            <small>Exhibition circuit · Week 18</small>
            <strong>A shot at the touring pros</strong>
          </div>
        </div>
        <div className="pa-facts">
          <div className="pa-fact"><small>Available</small><strong>{pounds(available)}</strong></div>
          <div className="pa-fact"><small>Your role</small><strong>Challenger</strong></div>
          <div className="pa-fact"><small>Stops this week</small><strong>{booked ? "1 booked" : "3"}</strong></div>
        </div>
      </section>

      <div className="pa-standfirst">
        <div className="pa-standfirst-mark"><Star size={16} fill="currentColor" /></div>
        <strong>YOU THROW FIRST</strong>
        <span>Beat the touring pro. The organiser pays the prize.</span>
        <span className="pa-role-chip">CHALLENGER <b>VS</b> TOURING PRO</span>
      </div>

      {booked && (
        <section className="pa-booking" aria-live="polite">
          <div className="pa-booking-copy">
            <span className="pa-booking-tag"><Check size={14} /> Slot confirmed · {booked.day}</span>
            <h2>{booked.town}<span> / </span>{booked.name}</h2>
            <p>One leg · Fee {pounds(booked.fee)}{booked.travel ? ` + ${pounds(booked.travel)} travel` : ""} · Prize {pounds(booked.prize)}</p>
          </div>
          <div className="pa-booking-actions">
            <button className="pa-action-button" type="button" onClick={prepareLeg}>
              <Star size={15} /> {legReady ? "Leg ready" : "Throw your leg"}
            </button>
            <button className="pa-action-button is-quiet" type="button" onClick={quickSim}>
              Quick-sim it
            </button>
          </div>
          {notice && <p className="pa-status" role="status">{notice}</p>}
        </section>
      )}

      <section className="pa-section">
        <div className="pa-section-heading">
          <h2><CalendarDays size={16} /> The exhibition card</h2>
          <span>Choose your opponent</span>
        </div>
        <div className="pa-stops">
          <div className="pa-stop-grid">
            {stops.map((stop, index) => {
              const cost = stop.fee + stop.travel;
              const isSelected = booked?.town === stop.town;
              const disabled = Boolean(booked) || cost > available;
              return (
                <article key={stop.town} className={`pa-stop${index === 0 ? " is-featured" : ""}${isSelected ? " is-selected" : ""}`}>
                  <span className="pa-card-index">0{index + 1}</span>
                  <div className="pa-stop-top">
                    <span className="pa-place"><MapPin size={14} /> {stop.town}</span>
                    <span className="pa-day">{stop.day}</span>
                  </div>
                  <div className="pa-player-plaque">
                    <div className="pa-player-mark">
                      <img src={stop.shirtImage} alt={`${stop.name} wearing ${stop.shirtName}`} />
                    </div>
                    <div className="pa-player-info">
                      <p className="pa-opponent-label">TOURING PRO · WORLD RANK <b>#{stop.rank}</b></p>
                      <h3>{stop.name}</h3>
                      <span className="pa-shirt-name">{stop.shirtName}</span>
                      <div className="pa-average"><small>MATCH AVG</small><strong>{stop.average}</strong></div>
                    </div>
                  </div>
                  <div className="pa-price-grid">
                    <div><small>Slot fee</small><strong>{pounds(stop.fee)}</strong></div>
                    <div><small>Travel</small><strong>{pounds(stop.travel)}</strong></div>
                    <div><small>Prize</small><strong>{pounds(stop.prize)}</strong></div>
                  </div>
                  <button
                    className={`pa-book-button${isSelected ? " is-current" : ""}`}
                    type="button"
                    disabled={disabled}
                    aria-pressed={isSelected}
                    onClick={() => bookStop(stop)}
                  >
                    {isSelected ? <><Check size={15} /> Slot selected</> : booked ? "Slot unavailable" : `Take a slot · ${pounds(cost)}`}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pa-record" aria-label="Career record">
        <span className="pa-record-icon"><Trophy size={18} /></span>
        <div className="pa-record-copy">
          <small>CAREER RECORD</small>
          <strong>No Pro-Am legs yet</strong>
        </div>
        <div className="pa-record-stats">
          <span>Pros beaten <b>0</b></span>
          <span>Prize money <b>£0</b></span>
        </div>
      </section>
      <p className="pa-mock-note"><CircleDollarSign size={12} /> Illustrative mock data · not a live Career save</p>
    </main>
  );
}

export default ProAm;
