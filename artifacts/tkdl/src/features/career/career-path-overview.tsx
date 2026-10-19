import { Link } from "wouter";
import { OSWALD } from "./components";

type CareerPathOverviewProps = { saveId?: string; headingId?: string };

const paths = [
  {
    label: "01 · START CLOSE TO HOME",
    title: "Local & grassroots",
    description: "Begin at your home club and look for local events on your calendar. Play when an event suits you.",
    destination: "/calendar",
    action: "See the calendar",
  },
  {
    label: "02 · AMATEUR COMPETITION",
    title: "County & national teams",
    description: "County and national team competitions are available amateur routes. Check the relevant event details for your next step.",
    destination: "/calendar",
    action: "Find team events",
  },
  {
    label: "03 · SERIES EVENTS",
    title: "Modus",
    description: "Enter Modus series events from their event or calendar pages. Some involve a multi-week commitment, so check the dates before entering.",
    destination: "/calendar",
    action: "Check event dates",
  },
  {
    label: "04 · BUILD AN AUDIENCE",
    title: "DartCast",
    description: "Streaming is its own route. Stream regularly to grow an audience; subscriptions and brand deals can follow.",
    destination: "/streaming",
    action: "Open DartCast",
  },
  {
    label: "05 · TOWARD A TOUR CARD",
    title: "Q-School",
    description: "Q-School is a route toward a Tour Card. Entry and qualification depend on the event rules; check the entry details and budget.",
    destination: "/q-school",
    action: "View Q-School",
  },
  {
    label: "06 · RANKING EVENTS",
    title: "Challenger & rankings",
    description: "Challenger and ranking events can also be routes toward a Tour Card. Entry or qualification depends on event rules, and costs may apply.",
    destination: "/road-to-the-tour",
    action: "View the Tour routes",
  },
] as const;

/** Informational route guide shared by new-save onboarding and the in-save Career Guide. */
export function CareerPathOverview({ saveId, headingId = "career-paths-overview-title" }: CareerPathOverviewProps) {
  return (
    <section className="career-new-career__paths" aria-labelledby={headingId}>
      <div className="career-new-career__paths-intro">
        <span className="career-path-overview__eyebrow">Career paths · orientation</span>
        <h3 id={headingId} style={OSWALD}>There is more than one way to play</h3>
        <p>These routes can overlap. This is only an overview: it does not lock a route, change eligibility or game rules, or affect recommendations. You can change direction any time.</p>
      </div>
      <div className="career-new-career__path-grid">
        {paths.map(path => (
          <article key={path.title}>
            <span>{path.label}</span>
            <h4>{path.title}</h4>
            <p>{path.description}</p>
            {saveId && <Link href={`/career/${saveId}${path.destination}`}>{path.action}</Link>}
          </article>
        ))}
      </div>
    </section>
  );
}
