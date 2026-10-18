import { Link } from "wouter";
import { Car, Coins, Crown, Flag, Shield, Star, Trophy, Users } from "lucide-react";
import { useHomeClub, type ClubView } from "../api";
import { CareerError, CareerLoading, CareerSection, CareerEmptyState } from "../components";
import { CareerPageHero } from "../page-hero";
import type { ShellContext } from "../shell";
import { MoneyMatches } from "../money-matches";
import { TeamNights } from "../team-nights";
import { HostTournament } from "../hosting";
import { RoadTrips } from "../road-trips";
import { ProAmNights } from "../pro-am";

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/** Your home club: its members, captain, county league division and the club's league history. */
export function ClubPage({ ctx }: { ctx: ShellContext }) {
  const club = useHomeClub(ctx.save.id), base = `/career/${ctx.save.id}`;
  if (club.isLoading) return <CareerLoading />;
  if (club.error || !club.data) return <CareerError error={club.error} onRetry={() => club.refetch()} />;
  const d: ClubView = club.data;
  if (!d.club || !d.table) return <CareerEmptyState title="No home club yet">Your home club comes from your home area. Set it in your Career profile.</CareerEmptyState>;
  const mine = d.table.rows.find(r => r.you)!, honours = d.history.filter(h => h.champions);
  return <div className="space-y-3 career-club">
    <CareerPageHero kicker={`${d.club.region} · County league`} title={d.club.name} accent="#7ec8a4" stage={{ venue: { venueType: "social-club" }, eventClass: "LOCAL" }}
      subtitle={<p>Your home club. Members score club points with their finishes at club nights, county and regional events. {d.legend ? "You turned professional and remain the club's legend." : ""}</p>}
      stats={[{ label: "Division", value: d.table.division, tone: "gold" }, { label: "League position", value: ordinal(mine.position) }, { label: "Club points", value: mine.points },
        { label: "Captain", value: d.captain ? (d.captain.you ? "You" : d.captain.name) : "To be decided" }]} />
    <CareerSection title={`Division ${d.table.division} · Season ${d.season}`} icon={<Shield aria-hidden />} accent="#7ec8a4">
      <ol className="career-club__table">{d.table.rows.map(r => <li key={r.localityKey} className={r.you ? "is-you" : undefined}>
        <b>{r.position}</b><span>{r.name}</span><em>{r.points}</em></li>)}</ol>
      <p className="px-4 pb-3 text-xs text-white/60">The top two go up and the bottom two go down at the end of the season. Points: winner 5, runner-up 3, semi-final 2, quarter-final 1.</p>
    </CareerSection>
    <div id="team-nights"><CareerSection title="Team nights" icon={<Users aria-hidden />} accent="#69b8ec">
      <TeamNights saveId={ctx.save.id} />
    </CareerSection></div>
    <div id="host-tournament"><CareerSection title="Run your own tournament" icon={<Trophy aria-hidden />} accent="#ffd24a">
      <HostTournament saveId={ctx.save.id} retired={!!ctx.save.retiredAt} />
    </CareerSection></div>
    <div id="money-matches"><CareerSection title="Money matches" icon={<Coins aria-hidden />} accent="#d9b96f">
      <MoneyMatches saveId={ctx.save.id} retired={!!ctx.save.retiredAt} />
    </CareerSection></div>
    <div id="road-trips"><CareerSection title="Road trips" icon={<Car aria-hidden />} accent="#e08a5b">
      <RoadTrips saveId={ctx.save.id} retired={!!ctx.save.retiredAt} />
    </CareerSection></div>
    <div id="pro-am"><CareerSection title="Pro-Am nights" icon={<Star aria-hidden />} accent="#c77dff">
      <ProAmNights saveId={ctx.save.id} retired={!!ctx.save.retiredAt} />
    </CareerSection></div>
    <CareerSection title="Members" icon={<Users aria-hidden />} accent="#7ec8a4">
      <ol className="career-club__table">{d.members.filter(m => m.active).slice(0, 25).map(m => <li key={m.key} className={m.you ? "is-you" : undefined}>
        <b>{d.captain?.key === m.key ? <Crown size={14} aria-label="Captain" /> : ""}</b>
        <span>{m.you ? <strong>You</strong> : <Link href={`${base}/world/players/${m.key}/profile`}>{m.name}</Link>}{m.professional && <small className="career-club__pro"> · Pro</small>}</span>
        <em>{m.seasonPoints}</em><small>Last season {m.lastSeasonPoints} pts · {m.titles} title{m.titles === 1 ? "" : "s"}</small></li>)}</ol>
    </CareerSection>
    {d.county && <CareerSection title={`${d.county.name} A team`} icon={<Shield aria-hidden />} accent="#69b8ec">
      <p className="px-4 pt-3 text-sm">{d.county.youSelected ? "You are in the A team this season." : d.county.youSelectedLastSeason ? "You lost your A-team place this season." : "The A team is last season's six best scorers in the county."}
        {d.county.lastSeasonChampion && <> Inter-County champions last season: <strong>{d.county.lastSeasonChampion.name}</strong>{d.county.lastSeasonChampion.you ? " (your county)" : ""}.</>}</p>
      {d.county.aTeam.length ? <ol className="career-club__table">{d.county.aTeam.map((m, i) => <li key={m.key} className={m.you ? "is-you" : undefined}>
        <b>{i + 1}</b><span>{m.you ? <strong>You</strong> : <Link href={`${base}/world/players/${m.key}/profile`}>{m.name}</Link>}</span><em>{m.points}</em></li>)}</ol>
        : <p className="p-4 text-sm text-white/70">The first A team is picked once a season of local results is in.</p>}
      <h3 className="px-4 pt-2 text-sm font-bold">Inter-County Championship · Season {d.season}</h3>
      <ol className="career-club__table">{d.county.standings.slice(0, 10).map(c => <li key={c.localityKey} className={c.you ? "is-you" : undefined}>
        <b>{c.position}</b><span>{c.name}</span><em>{c.points}</em></li>)}</ol>
    </CareerSection>}
    {d.nation && <CareerSection title={`${d.nation.name} national team`} icon={<Flag aria-hidden />} accent="#e4bb67">
      <p className="px-4 pt-3 text-sm">The World Cup of Darts takes each nation's two best players on the published rankings. {d.nation.selected ? "On today's rankings you would be picked." :
        d.nation.yourPlace ? `On today's rankings you are ${ordinal(d.nation.yourPlace)} in line.` : "You need a ranking to be considered."}</p>
      {d.nation.candidates.length > 0 && <ol className="career-club__table">{d.nation.candidates.map((c, i) => <li key={c.key} className={c.you ? "is-you" : undefined}>
        <b>{i + 1}</b><span>{c.you ? <strong>You</strong> : <Link href={`${base}/world/players/${c.key}/profile`}>{c.name}</Link>}{i < 2 && <small className="career-club__pro"> · In the team</small>}</span><em>{c.ranking}</em></li>)}</ol>}
      {d.nation.worldCups.length > 0 && <ul className="career-club__history">{d.nation.worldCups.map(w => <li key={w.season}><span>Season {w.season}</span><span>{w.players.join(" & ")}</span><em>{w.you ? "You played" : ""}</em></li>)}</ul>}
    </CareerSection>}
    <CareerSection title="Club history" icon={<Crown aria-hidden />} accent="#e9c77a">
      {honours.length > 0 && <p className="px-4 pt-3 text-sm">Division titles: {honours.map(h => `Division ${h.division}, season ${h.season}`).join(" · ")}</p>}
      {d.history.length ? <ul className="career-club__history">{[...d.history].reverse().map(h => <li key={h.season}>
        <span>Season {h.season}</span><span>Division {h.division} · {ordinal(h.position)} · {h.points} pts</span>
        <em>{h.champions ? "Champions" : h.promoted ? "Promoted" : h.relegated ? "Relegated" : ""}</em></li>)}</ul>
        : <p className="p-4 text-sm text-white/70">The club's first season is under way.</p>}
    </CareerSection>
  </div>;
}
