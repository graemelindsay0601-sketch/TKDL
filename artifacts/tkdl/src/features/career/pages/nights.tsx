import { useEffect, type CSSProperties, type ReactNode } from "react";
import { markVisited } from "../welcome";
import { markSeen, nextUnlockLine, useUnlocks, type UnlockKey } from "../unlocks";
import { Link } from "wouter";
import { CalendarDays, Car, ChevronRight, Coins, Heart, Moon, Radio, Shield, Star, Video } from "lucide-react";
import { useCamLeague, useMoneyMatches, useProAm, useRoadTrips, useStreaming, useTeamNights, useWeekNights } from "../api";
import { CareerSection } from "../components";
import { CareerPageHero } from "../page-hero";
import { dayLabel, formatPence } from "../model";
import type { ShellContext } from "../shell";
import { MoneyMatches } from "../money-matches";
import { RoadTrips } from "../road-trips";
import { ProAmNights } from "../pro-am";

/** Calendar items the week strip names (events and commitments come with their own label). */
const KIND: Record<string, string> = { EVENT: "event", LIFE: "life", stream: "stream", trip: "trip", league: "league", proam: "proam", team: "team" };
const KIND_LABEL: Record<string, string> = { EVENT: "Tournament", LIFE: "Personal", stream: "DartCast", trip: "Road trip", league: "Webcam league", proam: "Pro-Am", team: "Club night" };
const KIND_ICON: Record<string, ReactNode> = {
  EVENT: <CalendarDays aria-hidden />, LIFE: <Heart aria-hidden />, stream: <Radio aria-hidden />, trip: <Car aria-hidden />,
  league: <Video aria-hidden />, proam: <Star aria-hidden />, team: <Shield aria-hidden />,
};

export function weekPlanItemHref(saveId: string, kind: string, id: string) {
  const base = `/career/${saveId}`;
  if (kind === "EVENT") return `${base}/events/${encodeURIComponent(id)}`;
  return ({
    LIFE: `${base}/life`,
    stream: `${base}/streaming`,
    trip: `${base}/road-trips`,
    league: `${base}/cam-league`,
    proam: `${base}/pro-am`,
    team: `${base}/club#team-nights`,
  }[kind] ?? `${base}/nights`);
}

/** This week night by night, with the club's team night (Wednesday) added to what the server knows you've booked. */
function useNightsWeek(saveId: string, fallbackWeek: number) {
  const plan = useWeekNights(saveId), team = useTeamNights(saveId);
  const week = plan.data?.week ?? fallbackWeek;
  const teamNight = team.data?.next && team.data.next.week === week ? team.data.next : null;
  const days = (plan.data?.days ?? []).map(d => ({ ...d, items: [...d.items,
    ...(teamNight && d.dayOfWeek === 3 ? [{ kind: "team", label: `Team night ${teamNight.home ? "v" : "at"} ${teamNight.opponent}`, id: "team" }] : [])] }));
  return { loaded: !!plan.data, week, days, free: days.filter(d => !d.items.length).length, team, teamNight };
}

/** One activity: where it lives and what it needs from you this week. */
function Card({ href, icon, title, accent, status, action, isNew }: { href: string; icon: ReactNode; title: string; accent: string; status: ReactNode; action?: boolean; isNew?: boolean }) {
  return <Link href={href} className="nights-card" style={{ "--accent": accent } as CSSProperties} data-action={action || undefined}>
    <span className="nights-card__icon" aria-hidden>{icon}</span>
    <span className="nights-card__body"><b>{title}{isNew && <span className="career-new-badge">New</span>}</b><small>{status}</small></span>
  </Link>;
}

/**
 * Nights Out: everything you do with a night that isn't an event. The week at a glance (what each night holds), then each
 * activity with what it needs from you this week.
 */
export function NightsPage({ ctx }: { ctx: ShellContext }) {
  const id = ctx.save.id, base = `/career/${id}`;
  useEffect(() => { markVisited(id, "nights"); }, [id]);
  const unlocks = useUnlocks(ctx.save);
  const comingNext = nextUnlockLine(unlocks.next, unlocks.played);
  const { loaded, week, days, free, team, teamNight } = useNightsWeek(id, ctx.save.currentWeek);
  const money = useMoneyMatches(id), road = useRoadTrips(id), proam = useProAm(id),
    cam = useCamLeague(id), stream = useStreaming(id);

  const m = money.data, r = road.data, p = proam.data, c = cam.data, s = stream.data, fixture = c?.league?.thisWeek ?? null;
  const moneyLeft = m ? m.perWeek - m.playedThisWeek : 0;
  const streamsLeft = s ? s.perWeek - s.streamsThisWeek : 0;
  return <div className="space-y-3 nights">
    <CareerPageHero kicker="Nights Out" title={`Week ${week}`} accent="#e08a5b" stage={{ venue: { venueType: "social-club" }, eventClass: "LOCAL" }}
      subtitle={<p>{unlocks.everything ? "Your club, money matches, road trips, Pro-Am nights, the webcam league and DartCast. Each takes a night, so plan them around your events."
        : "What to do with your free weeknights. Each activity takes a night, so plan them around your events."}</p>}
      stats={[{ label: "Free nights", value: loaded ? free : "…", tone: "gold" }, { label: "Money matches left", value: m ? moneyLeft : "…" },
        ...(unlocks.isOpen("streaming") ? [{ label: "Streams left", value: s ? streamsLeft : "…" }] : [])]} />
    <ol className="nights-week" aria-label={`Week ${week}, night by night`}>
      {days.map(d => <li key={d.dayOfWeek} data-free={!d.items.length || undefined}>
        <b>{dayLabel(d.dayOfWeek)}</b>
        {d.items.length ? d.items.map(i => <Link key={`${i.kind}:${i.id}`} href={weekPlanItemHref(id, i.kind, i.id)}
          className="nights-week__item" data-kind={KIND[i.kind] ?? "event"} aria-label={`Open ${i.label}`}>
          <span className="nights-week__item-icon">{KIND_ICON[i.kind] ?? <CalendarDays aria-hidden />}</span>
          <span className="nights-week__item-copy"><small>{KIND_LABEL[i.kind] ?? "Booked event"}</small><strong>{i.label}</strong></span>
          <ChevronRight className="nights-week__item-arrow" aria-hidden />
        </Link>) : <small>Free</small>}
      </li>)}
    </ol>
    <CareerSection title="This week" icon={<Moon aria-hidden />} accent="#e08a5b">
      <div className="nights-cards">
        <Card href={`${base}/club`} icon={<Shield />} title="Your club" accent="#7ec8a4"
          status={teamNight ? `Team night Wednesday ${teamNight.home ? "v" : "at"} ${teamNight.opponent}${teamNight.youFree ? "" : ` · you're busy (${teamNight.clash ?? "booked"})`}`
            : team.data?.next ? `Next team night week ${team.data.next.week}` : "Table, members and your own tournament"} />
        <Card href={`${base}/money-matches`} icon={<Coins />} title="Money matches" accent="#d9b96f" action={!!m?.challenge}
          status={!m ? "…" : m.challenge ? `${m.challenge.name} has challenged you for ${formatPence(m.challenge.stakePence)}` : moneyLeft > 0 ? `${moneyLeft} left to play this week` : "Done for this week"} />
        {unlocks.isOpen("road-trips") && <Card isNew={unlocks.isNew("road-trips")} href={`${base}/road-trips`} icon={<Car />} title="Road trips" accent="#e08a5b" action={!!r?.visitor}
          status={!r ? "…" : r.trip ? `${dayLabel(r.trip.dayOfWeek)} in ${r.trip.town} · ${r.trip.played} of ${r.trip.maxMatches} played` : r.visitor ? `${r.visitor.name} from ${r.visitor.town} is at your club`
            : r.canTravel ? `${r.towns.length} towns on your road · ${r.reputation.title}` : r.why ?? "No trip this week"} />}
        {unlocks.isOpen("pro-am") && <Card isNew={unlocks.isNew("pro-am")} href={`${base}/pro-am`} icon={<Star />} title="Pro-Am nights" accent="#c77dff" action={p?.booking?.status === "BOOKED"}
          status={!p ? "…" : p.booking ? `${dayLabel(p.booking.dayOfWeek)} in ${p.booking.town} · ${p.booking.status === "BOOKED" ? (p.booking.role === "PRO" ? "you're the pro" : `against ${p.booking.pro?.name}`) : p.booking.status.toLowerCase()}`
            : p.nights.length ? `${p.nights.length} night${p.nights.length === 1 ? "" : "s"} this week${p.side === "PRO" ? " looking for a pro" : ""}` : "None this week"} />}
        {unlocks.isOpen("cam-league") && <Card isNew={unlocks.isNew("cam-league")} href={`${base}/cam-league`} icon={<Video />} title="Webcam league" accent="#5bc0eb" action={fixture?.status === "SCHEDULED" || fixture?.status === "BOOKED"}
          status={!c ? "…" : fixture ? (fixture.status === "SCHEDULED" ? `Book a night to play ${fixture.opponent.name}` : fixture.status === "BOOKED" ? `${dayLabel(fixture.dayOfWeek!)} v ${fixture.opponent.name}`
            : `Played ${fixture.opponent.name}${fixture.legs ? ` ${fixture.legs[0]}-${fixture.legs[1]}` : ""}`) : c.league ? "No match this week" : c.join.ok ? `Join ${c.division.name} · next league from week ${c.join.startsWeek}` : c.join.why ?? c.division.name} />}
        {unlocks.isOpen("streaming") && <Card isNew={unlocks.isNew("streaming")} href={`${base}/streaming`} icon={<Radio />} title="DartCast" accent="#9b6bff"
          status={!s ? "…" : s.live ? "You're live now" : `${streamsLeft > 0 ? `${streamsLeft} stream${streamsLeft === 1 ? "" : "s"} left this week` : "Streamed out this week"} · ${s.followers.toLocaleString("en-GB")} followers`} />}
      </div>
      {comingNext && <p className="nights-coming">{comingNext} New things to do on your free nights open up as you play.</p>}
    </CareerSection>
  </div>;
}

/** A page of its own for an activity that used to sit at the bottom of the club page. */
function ActivityPage({ ctx, kicker, title, accent, blurb, icon, children, unlock }: { ctx: ShellContext; kicker: string; title: string; accent: string; blurb: string; icon: ReactNode; children: ReactNode; unlock?: UnlockKey }) {
  useEffect(() => { if (unlock) markSeen(ctx.save.id, unlock); }, [ctx.save.id, unlock]);
  return <div className="space-y-3">
    <CareerPageHero kicker={kicker} title={title} accent={accent} stage={{ venue: { venueType: "social-club" }, eventClass: "LOCAL" }} subtitle={<p>{blurb}</p>} />
    <CareerSection title="This week" icon={icon} accent={accent}>{children}</CareerSection>
    <p className="nights-back"><Link href={`/career/${ctx.save.id}/nights`}>Back to this week's nights</Link></p>
  </div>;
}

export const MoneyMatchesPage = ({ ctx }: { ctx: ShellContext }) => <ActivityPage ctx={ctx} kicker="Nights Out · at your club" title="Money matches" accent="#d9b96f" icon={<Coins aria-hidden />}
  blurb="Put money on a game against a club member. Haggle over the stake; the winner takes it."><MoneyMatches saveId={ctx.save.id} retired={!!ctx.save.retiredAt} /></ActivityPage>;
export const RoadTripsPage = ({ ctx }: { ctx: ShellContext }) => <ActivityPage unlock="road-trips" ctx={ctx} kicker="Nights Out · on the road" title="Road trips" accent="#e08a5b" icon={<Car aria-hidden />}
  blurb="Drive to another town's club for a night and take on their locals for money. Beat a town's champion to make your name there."><RoadTrips saveId={ctx.save.id} retired={!!ctx.save.retiredAt} /></ActivityPage>;
export const ProAmPage = ({ ctx }: { ctx: ShellContext }) => <ActivityPage unlock="pro-am" ctx={ctx} kicker="Nights Out · exhibitions" title="Pro-Am nights" accent="#c77dff" icon={<Star aria-hidden />}
  blurb="Pay for a leg against a touring pro and win twenty times your fee if you beat them. With a Tour Card, you're the pro and you're paid to turn up."><ProAmNights saveId={ctx.save.id} retired={!!ctx.save.retiredAt} /></ActivityPage>;

/** Home: how many nights are still free this week, and the way into Nights Out. */
export function NightsLine({ saveId, week, save }: { saveId: string; week: number; save?: ShellContext["save"] }) {
  const { loaded, free } = useNightsWeek(saveId, week);
  const unlocks = useUnlocks(save ?? { id: saveId, currentSeason: 99, status: "ACTIVE" });
  if (!loaded) return null;
  const open = ["your club", "money matches", ...(unlocks.isOpen("road-trips") ? ["road trips"] : []), ...(unlocks.isOpen("pro-am") ? ["Pro-Am nights"] : []),
    ...(unlocks.isOpen("cam-league") ? ["the webcam league"] : []), ...(unlocks.isOpen("streaming") ? ["DartCast"] : [])];
  const list = open.length > 1 ? `${open.slice(0, -1).join(", ")} and ${open.at(-1)}` : open[0];
  return <Link href={`/career/${saveId}/nights`} className="money-match-line nights-line"><Moon aria-hidden />
    <span>{free ? <><b>{free} free night{free === 1 ? "" : "s"}</b> this week for {list}</> : "Every night this week is booked"}</span>
  </Link>;
}
