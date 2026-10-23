import { useState, type CSSProperties } from "react";
import {
  CalendarDays,
  Car,
  Coins,
  Radio,
  Shield,
  Star,
  Video,
  MousePointer2,
  ArrowUpRight,
} from "lucide-react";
import "./Redesign.css";

const publicBase = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
const clubHeroImage = `${publicBase}images/night-out-club-hero-20261022.jpg`;
const previewSaveId = "preview-save";
const week = [
  { day: "Monday", kind: "Tournament", name: "Scottish Open Qualifier", routeKind: "EVENT", id: "scottish-open-qualifier", Icon: CalendarDays, tone: "tournament" },
  { day: "Tuesday", kind: "Road trip", name: "Road trip to Kilmarnock", routeKind: "trip", id: "trip", Icon: Car, tone: "trip" },
  { day: "Wednesday", kind: "Club night", name: "Team night v Ayr", routeKind: "team", id: "team", Icon: Shield, tone: "club" },
  { day: "Thursday", kind: "", name: "Free", routeKind: "", id: "", Icon: CalendarDays, tone: "free" },
  { day: "Friday", kind: "Webcam league", name: "Webcam league v Graeme", routeKind: "league", id: "fixture", Icon: Video, tone: "league" },
  { day: "Saturday", kind: "", name: "Free", routeKind: "", id: "", Icon: CalendarDays, tone: "free" },
  { day: "Sunday", kind: "DartCast", name: "Weekly DartCast show", routeKind: "stream", id: "show", Icon: Radio, tone: "stream" },
];

function weekPlanItemHref(saveId: string, kind: string, id: string) {
  const base = `/career/${saveId}`;
  if (kind === "EVENT") return `${base}/events/${encodeURIComponent(id)}`;
  return ({
    LIFE: `${base}/life`,
    stream: `${base}/streaming`,
    trip: `${base}/road-trips`,
    league: `${base}/cam-league`,
    proam: `${base}/pro-am`,
    team: `${base}/club#team-nights`,
  } as Record<string, string>)[kind] ?? `${base}/nights`;
}

const activities = [
  {
    title: "Your club",
    status: "Team night Wednesday v Ayr · you're free",
    Icon: Shield,
    tone: "#83c7a2",
  },
  {
    title: "Money matches",
    status: "Kyle challenged you for £20",
    Icon: Coins,
    tone: "#e3bb62",
    action: "Challenge",
  },
  {
    title: "Road trips",
    status: "Tuesday in Kilmarnock · 1 of 3 played",
    Icon: Car,
    tone: "#e28a61",
    isNew: true,
  },
  {
    title: "Pro-Am nights",
    status: "No exhibition booked this week",
    Icon: Star,
    tone: "#cd9b70",
  },
  {
    title: "Webcam league",
    status: "Book a night to play Graeme",
    Icon: Video,
    tone: "#78b9cf",
    action: "Book a night",
    isNew: true,
  },
  {
    title: "DartCast",
    status: "2 streams left this week · 1,204 followers",
    Icon: Radio,
    tone: "#c99a67",
  },
];

export function Redesign() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedActivity = activities.find((activity) => activity.title === selected);

  return (
    <main className="tkdl-night">
      <div className="tkdl-night__frame">
        <div className="tkdl-night__topline">
          <div className="tkdl-night__brand">
            <span className="tkdl-night__brand-mark" aria-hidden="true">TKDL</span>
            <span>Career / Nights Out</span>
          </div>
          <span className="tkdl-night__edition">Season 3 · Week 20</span>
        </div>

        <header className="tkdl-night__hero">
          <div className="tkdl-night__hero-copy">
            <div className="tkdl-night__overline"><span className="tkdl-night__live-dot" /> The week, off the oche</div>
            <h1>Week <span>20</span></h1>
            <p>
              Your club, money matches, road trips, Pro-Am nights, the webcam league and DartCast.
              Each takes a night, so plan them around your events.
            </p>
            <dl className="tkdl-night__stats">
              <div className="tkdl-night__stat"><dt>Free nights</dt><dd>2</dd></div>
              <div className="tkdl-night__stat"><dt>Money matches left</dt><dd>1</dd></div>
              <div className="tkdl-night__stat"><dt>Streams left</dt><dd>2</dd></div>
            </dl>
          </div>
          <div className="tkdl-night__venue-photo" aria-hidden="true">
            <img src={clubHeroImage} alt="" />
          </div>
          <span className="tkdl-night__sample">Illustrative sample data</span>
        </header>

        <section className="tkdl-night__schedule-panel" aria-labelledby="tkdl-schedule-title">
          <div className="tkdl-night__section-heading">
            <div className="tkdl-night__section-label">
              <b>01 / Plan</b><span id="tkdl-schedule-title">Seven nights</span>
            </div>
            <div className="tkdl-night__legend"><i /> booked <i className="open" /> free</div>
          </div>
          <ol className="tkdl-night__schedule" aria-label="Week 20, night by night">
            {week.map((night) => {
              const item = (
                <>
                  <div className="tkdl-night__day-top">
                    <b>{night.day.slice(0, 3)}</b><span className="tkdl-night__day-icon"><night.Icon aria-hidden="true" /></span>
                  </div>
                  <div className="tkdl-night__day-details">
                    {night.kind && <span className="tkdl-night__day-kind">{night.kind}</span>}
                    <div className="tkdl-night__day-name">{night.name}</div>
                    {night.kind && <span className="tkdl-night__day-open">Open destination <ArrowUpRight aria-hidden="true" /></span>}
                  </div>
                </>
              );
              return (
                <li className="tkdl-night__day" data-free={!night.kind} data-tone={night.tone} key={night.day}>
                  {night.kind ? (
                    <a className="tkdl-night__day-link" href={weekPlanItemHref(previewSaveId, night.routeKind, night.id)} target="_blank" rel="noreferrer" aria-label={`Open ${night.kind}: ${night.name} in Career`}>
                      {item}
                    </a>
                  ) : item}
                </li>
              );
            })}
          </ol>
          <div className="tkdl-night__open-note"><span>Open nights</span><b>Thursday</b><i /><b>Saturday</b><small>Choose a free night for an activity below.</small></div>
        </section>

        <section className="tkdl-night__body" aria-labelledby="tkdl-activities-title">
          <div>
            <div className="tkdl-night__section-label">
              <b>02 / Make it count</b><span id="tkdl-activities-title">This week</span>
            </div>
            <div className="tkdl-night__activities">
              {activities.map(({ title, status, Icon, tone, action, isNew }) => (
                <button
                  className="tkdl-night__activity"
                  key={title}
                  type="button"
                  style={{ "--tone": tone } as CSSProperties}
                  data-selected={selected === title || undefined}
                  aria-pressed={selected === title}
                  onClick={() => setSelected(selected === title ? null : title)}
                >
                  <span className="tkdl-night__activity-icon" aria-hidden="true"><Icon /></span>
                  <span className="tkdl-night__activity-watermark" aria-hidden="true"><Icon /></span>
                  <span className="tkdl-night__activity-copy">
                    <span className="tkdl-night__activity-title">
                      {title}{isNew && <span className="tkdl-night__new">New</span>}
                    </span>
                    <span className="tkdl-night__activity-status">{status}</span>
                  </span>
                  {action && <span className="tkdl-night__action">{action}</span>}
                </button>
              ))}
            </div>
          </div>

          <aside className="tkdl-night__aside" aria-live="polite">
            <div className="tkdl-night__aside-kicker">This week at your local</div>
            <h3>{selectedActivity ? selectedActivity.title : "A night well spent"}</h3>
            <p>
              {selectedActivity
                ? selectedActivity.status
                : "The week is already taking shape. Check your fixtures, then see where a free night might lead."}
            </p>
            <div className="tkdl-night__aside-rule" />
            <div className="tkdl-night__aside-note">
              {selectedActivity
                ? "Selected for this prototype preview. No booking or career data is changed."
                : "Two nights still open · keep your plans around the tournament and team night."}
            </div>
            <div className="tkdl-night__proto"><MousePointer2 aria-hidden="true" /> Prototype-only selection · no actions are submitted</div>
          </aside>
        </section>

        <footer className="tkdl-night__foot">TKDL Career · Illustrative sample data · local-only prototype</footer>
      </div>
    </main>
  );
}
