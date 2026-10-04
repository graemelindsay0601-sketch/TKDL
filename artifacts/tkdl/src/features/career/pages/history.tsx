import { useMemo, useState } from "react";
import { Award, CalendarRange, Crown, History as HistoryIcon, TrendingUp, Trophy } from "lucide-react";
import { useFinance, useHistory, useMilestones, useRankingHistory, useSporting, useTourCard } from "../api";
import { circuitLabel, formatPence, milestoneLabel, ordinal, stageLabel, tierStyle } from "../model";
import { CareerEmptyState, CareerError, CareerLoading, CareerSection, Label, OSWALD, Segmented, StatTile } from "../components";
import type { ShellContext } from "../shell";
import type { HistoryRow } from "../types";
import { ResultList } from "./journey";

type Tab = "OVERVIEW" | "TIMELINE" | "SEASONS" | "TITLES" | "MAJORS" | "RANKING" | "TROPHIES";
const MAJOR = new Set(["MAJOR", "WORLD_CHAMPIONSHIP"]);

/**
 * Screen 9 — My Career / History & Trophy Room. Only sections backed by real data
 * are shown (Rivalries/Records wait for A7). The Trophy Room is Career-only and is
 * entirely separate from the Classic Tour's 305 trophies.
 */
export function HistoryPage({ ctx, initialTab = "OVERVIEW" }: { ctx: ShellContext; initialTab?: Tab }) {
  const id = ctx.save.id;
  const history = useHistory(id, { participant: "HUMAN" });
  const milestones = useMilestones(id, 200);
  const finance = useFinance(id);
  const sporting = useSporting(id);
  const cards = useTourCard(id);
  const world = useRankingHistory(id, "pro-world", "HUMAN", 1);
  const [tab, setTab] = useState<Tab>(initialTab);
  const rows = history.data ?? [];
  const titles = rows.filter(r => r.champion);
  const finals = rows.filter(r => r.stageReached === "FINAL");
  const majors = rows.filter(r => MAJOR.has(r.circuit));
  const seasons = useMemo(() => {
    const by = new Map<number, HistoryRow[]>();
    for (const r of rows) by.set(r.season, [...(by.get(r.season) ?? []), r]);
    return [...by.entries()].sort((a, b) => b[0] - a[0]);
  }, [rows]);

  if (history.isLoading) return <div className="pdc-card"><CareerLoading label="Loading your record" /></div>;
  if (history.error) return <CareerError error={history.error} onRetry={() => history.refetch()} />;
  return (
    <div className="space-y-3">
      <div className="pdc-card px-3 py-2.5"><Segmented<Tab> label="History sections" value={tab} onChange={setTab} wrap options={[
        { value: "OVERVIEW", label: "Overview" }, { value: "TIMELINE", label: "Timeline" }, { value: "SEASONS", label: "Seasons" }, { value: "TITLES", label: "Titles & finals", count: titles.length + finals.length },
        { value: "MAJORS", label: "Majors", count: majors.length }, { value: "RANKING", label: "Ranking" }, { value: "TROPHIES", label: "Trophy room", count: titles.length }]} /></div>

      {tab === "OVERVIEW" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <StatTile label="Seasons" value={ctx.save.currentSeason} sub={ctx.retired ? "Retired" : `Now week ${ctx.save.currentWeek}`} />
          <StatTile label="Events played" value={rows.length} sub={rows.length >= 200 ? "Showing the latest 200" : undefined} />
          <StatTile label="Titles" value={titles.length} tone={titles.length ? "gold" : "neutral"} sub={`${finals.length} other final${finals.length === 1 ? "" : "s"}`} />
          <StatTile label="Highest World Rank" value={sporting.data?.worldRanking.careerHighPosition ? ordinal(sporting.data.worldRanking.careerHighPosition) : "—"} />
          <StatTile label="Career Earnings" value={finance.data ? formatPence(finance.data.careerEarningsPence) : "…"} sub="Prize money" />
          <StatTile label="Tour Cards" value={cards.data?.history.length ?? "…"} sub={cards.data?.holdsCard ? "Currently held" : "None held now"} />
          <StatTile label="Major appearances" value={majors.length} />
          <StatTile label="Milestones" value={milestones.data?.milestones.length ?? "…"} />
        </div>
      )}
      {tab === "TIMELINE" && (
        <CareerSection title="Timeline" icon={<HistoryIcon className="w-3.5 h-3.5" />}>
          {milestones.isLoading ? <CareerLoading /> : milestones.data?.milestones.length ? (
            <ol className="px-4 py-2">{milestones.data.milestones.map((m, i) => { const l = milestoneLabel(m); return (
              <li key={m.id ?? i} className="flex gap-3 py-1.5 border-b last:border-b-0 text-sm" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span className="w-16 shrink-0 text-xs" style={{ ...OSWALD, color: "rgba(255,255,255,0.45)" }}>S{m.season} W{m.week}</span><span style={{ color: "#fff" }}>{l.title}</span>
                {l.detail && <span className="truncate" style={{ color: "rgba(255,255,255,0.5)" }}>{l.detail}</span>}</li>); })}</ol>
          ) : <CareerEmptyState title="Nothing on the timeline yet" />}
        </CareerSection>
      )}
      {tab === "SEASONS" && (
        <CareerSection title="Season by season" icon={<CalendarRange className="w-3.5 h-3.5" />}>
          {seasons.length ? (
            <table className="career-table"><thead><tr><th scope="col">Season</th><th scope="col">Events</th><th scope="col">Titles</th><th scope="col">Best</th><th scope="col">World high</th></tr></thead>
              <tbody>{seasons.map(([season, list]) => {
                const best = list.reduce((b, r) => Math.min(b, r.position), Infinity);
                const high = world.data?.seasonHighs.find(s => s.season === season);
                return <tr key={season}><td style={OSWALD}>S{season}</td><td>{list.length}</td><td>{list.filter(r => r.champion).length}</td>
                  <td>{best === 1 ? "Champion" : stageLabel(list.find(r => r.position === best)!.stageReached)}</td><td>{high ? ordinal(high.best) : "—"}</td></tr>;
              })}</tbody></table>
          ) : <CareerEmptyState title="No completed seasons with results yet" />}
        </CareerSection>
      )}
      {tab === "TITLES" && (
        <CareerSection title="Titles & finals" icon={<Trophy className="w-3.5 h-3.5" />} accent="#ffd24a">
          {titles.length + finals.length ? <ResultList rows={[...titles, ...finals].sort((a, b) => b.season - a.season || b.week - a.week)} saveId={id} /> : <CareerEmptyState title="No titles or finals yet" />}
        </CareerSection>
      )}
      {tab === "MAJORS" && (
        <CareerSection title="Majors & World Championship" icon={<Crown className="w-3.5 h-3.5" />} accent="#ff005c">
          {majors.length ? <ResultList rows={majors} saveId={id} /> : <CareerEmptyState title="No major appearances yet" />}
        </CareerSection>
      )}
      {tab === "RANKING" && (
        <CareerSection title="Ranking record" icon={<TrendingUp className="w-3.5 h-3.5" />} accent="#c084fc">
          {sporting.data ? (
            <ul>{sporting.data.rankings.map(r => (
              <li key={r.key} className="px-4 py-2 border-b last:border-b-0 flex items-center gap-2 text-sm" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span className="flex-1" style={{ ...OSWALD, color: "#fff" }}>{r.name}</span>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>now {r.position ? ordinal(r.position) : "unranked"}</span>
                <span style={{ color: "#ffd24a" }}>high {r.careerHighPosition ? ordinal(r.careerHighPosition) : "—"}</span></li>))}</ul>
          ) : <CareerLoading />}
        </CareerSection>
      )}
      {tab === "TROPHIES" && (
        <CareerSection title="Career trophy room" icon={<Award className="w-3.5 h-3.5" />} accent="#ffd24a">
          <p className="px-4 pt-3 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Titles won in this Career. Separate from the Classic Tour's 305 Trophy Hunt trophies, which are untouched.</p>
          {titles.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
              {titles.map(t => { const tier = tierStyle(t.presentationTier); return (
                <div key={t.eventId} className="rounded-xl p-3 text-center" style={{ background: tier.surface, border: `1px solid ${tier.accent}44` }}>
                  <Trophy className="w-6 h-6 mx-auto" style={{ color: tier.accent }} aria-hidden />
                  <div className="mt-1.5 text-xs font-black uppercase leading-tight" style={{ ...OSWALD, color: "#fff" }}>{t.name}</div>
                  <div className="text-[0.65rem]" style={{ color: "rgba(255,255,255,0.5)" }}>Season {t.season} · {circuitLabel(t.circuit)}</div>
                </div>); })}
            </div>
          ) : <CareerEmptyState title="The cabinet is empty" icon={<Trophy className="w-6 h-6" />}>Win an event and its trophy appears here.</CareerEmptyState>}
          <div className="px-4 pb-3"><Label color="rgba(255,255,255,0.3)">Rivalries and records arrive with the Career story phase</Label></div>
        </CareerSection>
      )}
    </div>
  );
}
