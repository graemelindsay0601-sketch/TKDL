import type { CSSProperties } from "react";
import { Car, CalendarDays, ChevronRight, Coins, Moon, Radio, Shield, Star, Video } from "lucide-react";
import "./_group.css";

const days = [
  { day: "Mon", kind: "EVENT", label: "Scottish Open Qualifier" },
  { day: "Tue", kind: "trip", label: "Road trip · Kilmarnock" },
  { day: "Wed", kind: "team", label: "Team night v Ayr" },
  { day: "Thu", kind: "", label: "Free" },
  { day: "Fri", kind: "league", label: "Webcam league v Graeme" },
  { day: "Sat", kind: "", label: "Free" },
  { day: "Sun", kind: "stream", label: "DartCast · weekly show" },
];

const activities = [
  { title: "Your club", status: "Team night Wednesday v Ayr · you're free", accent: "#7ec8a4", Icon: Shield },
  { title: "Money matches", status: "Kyle has challenged you for £20", accent: "#d9b96f", Icon: Coins, action: true },
  { title: "Road trips", status: "Tuesday in Kilmarnock · 1 of 3 played", accent: "#e08a5b", Icon: Car, isNew: true },
  { title: "Pro-Am nights", status: "No exhibition booked this week", accent: "#c77dff", Icon: Star },
  { title: "Webcam league", status: "Book a night to play Graeme", accent: "#5bc0eb", Icon: Video, action: true, isNew: true },
  { title: "DartCast", status: "2 streams left this week · 1,204 followers", accent: "#9b6bff", Icon: Radio },
];

export function Current() {
  return (
    <main className="nights-preview">
      <div className="nights-preview__wrap">
        <header className="nights-preview__hero">
          <span className="nights-preview__arena" aria-hidden="true" />
          <div className="nights-preview__hero-content">
            <div className="nights-preview__kicker"><i /> Nights Out · Season 3</div>
            <h1>Week <span>20</span></h1>
            <p>Your club, money matches, road trips, Pro-Am nights, the webcam league and DartCast. Each takes a night, so plan them around your events.</p>
            <dl className="nights-preview__stats">
              <div className="is-gold"><dt>Free nights</dt><dd>2</dd></div>
              <div><dt>Money matches left</dt><dd>1</dd></div>
              <div><dt>Streams left</dt><dd>2</dd></div>
            </dl>
          </div>
        </header>

        <ol className="nights-week" aria-label="Week 20, night by night">
          {days.map(({ day, kind, label }) => (
            <li key={day} data-free={!kind || undefined}>
              <b>{day}</b>
              {kind ? (
                <a className="nights-week__item" data-kind={kind === "EVENT" ? "event" : kind} href="#this-week" aria-label={`Open ${label}`}>
                  <span className="nights-week__item-icon">
                    {kind === "EVENT" ? <CalendarDays aria-hidden /> : kind === "trip" ? <Car aria-hidden /> : kind === "team" ? <Shield aria-hidden /> : kind === "league" ? <Video aria-hidden /> : <Radio aria-hidden />}
                  </span>
                  <span className="nights-week__item-copy"><small>{kind === "EVENT" ? "Tournament" : kind === "trip" ? "Road trip" : kind === "team" ? "Club night" : kind === "league" ? "Webcam league" : "DartCast"}</small><strong>{label}</strong></span>
                  <ChevronRight className="nights-week__item-arrow" aria-hidden />
                </a>
              ) : <small>{label}</small>}
            </li>
          ))}
        </ol>

        <section className="nights-preview__section" id="this-week" aria-labelledby="nights-week-heading">
          <div className="nights-preview__section-head">
            <span aria-hidden="true"><Moon /></span>
            <h2 id="nights-week-heading">This week</h2>
          </div>
          <div className="nights-cards">
            {activities.map(({ title, status, accent, Icon, action, isNew }) => (
              <a key={title} className="nights-card" href="#this-week" style={{ "--accent": accent } as CSSProperties} data-action={action || undefined}>
                <span className="nights-card__icon" aria-hidden="true"><Icon /></span>
                <span className="nights-card__body">
                  <b>{title}{isNew && <span className="career-new-badge">New</span>}</b>
                  <small>{status}</small>
                </span>
              </a>
            ))}
          </div>
          <div className="nights-preview__footer">Illustrative preview data · local-only navigation</div>
        </section>
      </div>
    </main>
  );
}
