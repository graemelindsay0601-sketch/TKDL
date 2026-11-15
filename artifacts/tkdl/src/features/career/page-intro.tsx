import { Link, useLocation } from "wouter";
import { ArrowRight, Info } from "lucide-react";
import { CAREER_NAV } from "./model";

/** What each Career page is for, in one line, and the one thing you'd most likely do there. */
const INTROS: Record<string, { text: string; action?: { label: string; path: string } }> = {
  inbox: { text: "Everything new for you: qualifications, offers, entries closing and milestones.", action: { label: "Back to Today", path: "" } },
  map: { text: "Where events are. Tap a place to see what's on there and what it costs to get to.", action: { label: "Calendar", path: "/calendar" } },
  calendar: { text: "Every event this season. It opens on what you can enter now, near home.", action: { label: "Plan my week", path: "#week-planner" } },
  nights: { text: "This week, night by night. A free night can be a local night, a stream, a money match or a road trip.", action: { label: "Local nights", path: "/local" } },
  local: { text: "Cheap nights near home: practice, the pub league and club knockouts.", action: { label: "This week", path: "/nights" } },
  club: { text: "Your club: team nights, the club league and the club championship.", action: { label: "Money matches", path: "/money-matches" } },
  "money-matches": { text: "Play a club member for a stake: win and the money's yours.", action: { label: "Your club", path: "/club" } },
  "road-trips": { text: "Visit another town's club and take on their best for money.", action: { label: "This week", path: "/nights" } },
  "pro-am": { text: "Partner a pro at a charity night: a fee, a crowd and a famous name.", action: { label: "This week", path: "/nights" } },
  "cam-league": { text: "An online league played over webcam: one match a week from home.", action: { label: "This week", path: "/nights" } },
  streaming: { text: "Your DartCast channel. Go live on a free night to grow your audience and income.", action: { label: "Go live", path: "/streaming#go-live" } },
  rankings: { text: "The world ranking: built from prize money in ranking events. It decides who gets into the big events." },
  players: { text: "Everyone in the darts world: form, ranking, rivals and sponsors." },
  "world-events": { text: "Every circuit and organisation, and how they connect.", action: { label: "How darts careers work", path: "/guide" } },
  venues: { text: "The venues, from back rooms to arenas." },
  "world-history": { text: "Past champions and records." },
  overview: { text: "Your career so far: honours, standing and what you're aiming for.", action: { label: "Your path", path: "" } },
  details: { text: "The full dashboard: pathway, rankings, results and news, all in one place." },
  road: { text: "Every route onto the professional tour, and how close you are to each.", action: { label: "Your path", path: "" } },
  performance: { text: "How you're playing: averages, checkouts and form." },
  achievements: { text: "Milestones you've reached and the ones still ahead." },
  "career-life": { text: "Life around the darts: money, news and the people in your career.", action: { label: "Finances", path: "/finances" } },
  history: { text: "Season reviews and your full results history." },
  sponsors: { text: "Who could sign you next, what your sponsors pay, and what they ask of you.", action: { label: "Your path", path: "" } },
};

/** One line under the navigation: what this page is for, and its main action. Only on a section's own page. */
export function PageIntro({ saveId }: { saveId: string }) {
  const [location] = useLocation();
  const seg = location.replace(/^\/career\/[^/]+/, "").split("?")[0].replace(/\/$/, "");
  const item = CAREER_NAV.flatMap(s => s.items).find(i => i.path && i.path === seg);
  const intro = item ? INTROS[item.key] : undefined;
  if (!intro) return null;
  const base = `/career/${saveId}`;
  return <p className="career-page-intro"><Info aria-hidden /><span>{intro.text}</span>
    {intro.action && <Link href={intro.action.path.startsWith("#") ? `${base}${intro.action.path}` : `${base}${intro.action.path}`} className="career-page-intro__go">{intro.action.label} <ArrowRight aria-hidden /></Link>}</p>;
}
