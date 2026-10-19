import { Link } from "wouter";
import { Crown, Flag, Shield, Trophy, Users } from "lucide-react";
import { errorMessage, useHomeClub, useSetCountyCategory, type ClubView } from "../api";
import { CareerError, CareerLoading, CareerSection, CareerEmptyState } from "../components";
import { CareerPageHero } from "../page-hero";
import type { ShellContext } from "../shell";
import { TeamNights } from "../team-nights";
import { HostTournament } from "../hosting";

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/** Your home club: its members, captain, county league division and the club's league history. */
export function ClubPage({ ctx }: { ctx: ShellContext }) {
  const club = useHomeClub(ctx.save.id), base = `/career/${ctx.save.id}`;
  const setCountyCategory = useSetCountyCategory(ctx.save.id);
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
    <CareerSection title="Members" icon={<Users aria-hidden />} accent="#7ec8a4">
      <ol className="career-club__table">{d.members.filter(m => m.active).slice(0, 25).map(m => <li key={m.key} className={m.you ? "is-you" : undefined}>
        <b>{d.captain?.key === m.key ? <Crown size={14} aria-label="Captain" /> : ""}</b>
        <span>{m.you ? <strong>You</strong> : <Link href={`${base}/world/players/${m.key}/profile`}>{m.name}</Link>}{m.professional && <small className="career-club__pro"> · Pro</small>}</span>
        <em>{m.seasonPoints}</em>{ctx.save.currentSeason > 1 || m.titles > 0 ? <small>{ctx.save.currentSeason > 1 ? `Last season ${m.lastSeasonPoints} pts · ` : ""}{m.titles} title{m.titles === 1 ? "" : "s"}</small> : null}</li>)}</ol>
    </CareerSection>
    {d.county && <CareerSection title={`${d.county.name} representative squads`} icon={<Shield aria-hidden />} accent="#69b8ec">
      <div className="px-4 pt-3 space-y-2">
        <p className="text-sm">Choose the county squad category you’re eligible for. UKDA-style format: 12 singles in each men’s team and 6 in each women’s team; A matches are best of 7 legs, women’s and lower-division men’s B matches best of 5. When selected and available, you play your own single in the live scorer; the other singles are simulated. The fixture completes after your match is finished.</p>
        <div className="flex gap-2">
          {(["MEN", "WOMEN"] as const).map(category => <button key={category} type="button"
            className={`career-btn ${d.county!.category === category ? "career-btn-gold" : "career-btn-ghost"}`}
            aria-pressed={d.county!.category === category} disabled={setCountyCategory.isPending}
            onClick={() => setCountyCategory.mutate(category)}>
            {category === "MEN" ? "Men’s squads" : "Women’s squads"}
          </button>)}
        </div>
        {setCountyCategory.error && <p className="text-xs text-rose-300" role="alert">{errorMessage(setCountyCategory.error)}</p>}
        {!d.county.category && <p className="text-xs text-white/60">Select a category to be considered for county team fixtures.</p>}
      </div>
      <p className="px-4 pt-3 text-sm">{d.county.youSelected ? `You are currently selected in the ${d.county.category === "WOMEN" ? "women’s" : "men’s"} ${d.county.aTeam.some(m => m.you) ? "A" : "B"} squad.` : "Squads are selected from last season’s results; you are not currently selected."}</p>
      <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
        {(["MEN", "WOMEN"] as const).flatMap(category => (["A", "B"] as const).map(team => {
          const roster = d.county!.squads[category][team];
          const size = category === "MEN" ? 12 : 6;
          return <section key={`${category}-${team}`} className="rounded-lg border border-white/10 p-3">
            <h3 className="mb-2 text-sm font-bold">{category === "MEN" ? "Men’s" : "Women’s"} {team} · {roster.length}/{size}</h3>
            {roster.length ? <ol className="space-y-1 text-sm">{roster.map((m, i) => <li key={m.key} className={m.you ? "font-bold text-amber-200" : ""}>
              {i + 1}. {m.you ? "You" : <Link href={`${base}/world/players/${m.key}/profile`}>{m.name}</Link>} <span className="text-white/55">· {m.points} pts</span>
            </li>)}</ol> : <p className="text-xs text-white/55">No eligible players with county results yet.</p>}
          </section>;
        }))}
      </div>
      <h3 className="px-4 pt-2 text-sm font-bold">UKDA-style county team standings · Season {d.season}</h3>
      <p className="px-4 text-xs text-white/60">Separate tables for men’s and women’s A/B teams. Points are sets won in played county fixtures.</p>
      <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
        {d.county.teamStandings.map(table => <section key={`${table.category}-${table.team}`} className="rounded-lg border border-white/10 p-3">
          <h4 className="mb-2 text-sm font-bold">{table.category === "MEN" ? "Men’s" : "Women’s"} {table.team}</h4>
          <ol className="career-club__table">{table.rows.slice(0, 10).map(r => <li key={r.localityKey} className={r.localityKey === d.club!.localityKey ? "is-you" : undefined}>
            <b>{r.position}</b><span>{r.name}<small> · {r.played} played · {r.won}W {r.drawn}D {r.lost}L</small></span><em>{r.points}</em>
          </li>)}</ol>
        </section>)}
      </div>
      <h3 className="px-4 pt-2 text-sm font-bold">County fixtures</h3>
      {d.county.fixtures.length ? <ul className="career-club__history">{d.county.fixtures.map(f => <li key={`${f.round}-${f.week}`}>
        <span>Round {f.round} · Week {f.week}</span><span>{f.home ? "vs" : "at"} {f.opponent}</span>
        <em>{f.matches.length ? <>{f.matches.map(m => `${m.category[0]}${m.team} ${f.home ? m.homeSets : m.awaySets}-${f.home ? m.awaySets : m.homeSets}`).join(" · ")}
          {f.matches.some(m => m.youPlayed) && <small> · You {f.matches.find(m => m.youPlayed)?.humanMatch?.status === "LIVE"
            ? "have a single to play" : f.matches.find(m => m.youPlayed)?.youWon ? "won your single" : "lost your single"}</small>}</> : "Scheduled"}</em>
        {f.matches.map(m => m.humanMatch?.status === "LIVE" ? <Link key={m.humanMatch.id} className="career-btn career-btn-gold"
          href={`/career/${ctx.save.id}/county-match/${m.humanMatch.id}`}>Throw your single</Link> : null)}
      </li>)}</ul> : <p className="p-4 text-sm text-white/70">Fixtures are played as the Career calendar reaches each county round.</p>}
      <h3 className="px-4 pt-2 text-sm font-bold">Individual county points · Season {d.season}</h3>
      <p className="px-4 text-xs text-white/60">These individual event finishes select the squads; they do not count as team match results.</p>
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
