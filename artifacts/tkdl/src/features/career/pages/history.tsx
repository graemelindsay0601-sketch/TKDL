import { useMemo, useState } from "react";
import { Award, CalendarRange, Crown, History as HistoryIcon, TrendingUp, Trophy } from "lucide-react";
import { useFinance, useCareerFacts, useMilestones, useRankingHistory, useSporting, useTourCard } from "../api";
import { circuitLabel, formatPence, milestoneLabel, ordinal, stageLabel, tierStyle } from "../model";
import { CareerEmptyState, CareerError, CareerLoading, CareerSection, Label, OSWALD, Segmented, StatTile } from "../components";
import type { ShellContext } from "../shell";
import type { HistoryRow } from "../types";
import { FactsOverview, FactsTimeline, PerformancePanel, RecordsPanel, WorldHistoryPanel } from "./facts-panels";
import { ResultList } from "./journey";
import { RecognitionTimeline } from "./recognition";

type Tab = "OVERVIEW" | "TIMELINE" | "SEASONS" | "TITLES" | "MAJORS" | "RANKING" | "TROPHIES" | "PLAYING" | "RECORDS" | "WORLD";
const MAJOR = new Set(["MAJOR", "WORLD_CHAMPIONSHIP"]);

/**
 * Screen 9 — My Career / History & Trophy Room. Only sections backed by real data
 * are shown, composed from authoritative Career evidence. The Trophy Room is Career-only and is
 * entirely separate from the Classic Tour's 305 trophies.
 */
export function HistoryPage({ ctx, initialTab = "OVERVIEW" }: { ctx: ShellContext; initialTab?: Tab }) {
  const id = ctx.save.id;
  const history = useCareerFacts(id);
  const milestones = useMilestones(id, 200);
  const finance = useFinance(id);
  const sporting = useSporting(id);
  const cards = useTourCard(id);
  const world = useRankingHistory(id, "pro-world", "HUMAN", 1);
  const [tab, setTab] = useState<Tab>(initialTab);
  const rows: HistoryRow[] = (history.data?.results ?? []).map(r => ({ ...r, week: r.week ?? 1, presentationTier: r.presentationTier as HistoryRow["presentationTier"] }));
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
        { value: "OVERVIEW", label: "Overview" }, { value: "PLAYING", label: "Playing stats" }, { value: "RECORDS", label: "Records" }, { value: "WORLD", label: "World history" }, { value: "TIMELINE", label: "Timeline" }, { value: "SEASONS", label: "Seasons" }, { value: "TITLES", label: "Titles & finals", count: titles.length + finals.length },
        { value: "MAJORS", label: "Majors", count: majors.length }, { value: "RANKING", label: "Ranking" }, { value: "TROPHIES", label: "Trophy room", count: titles.length }]} /></div>

      {tab === "OVERVIEW" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <StatTile label="Seasons" value={ctx.save.currentSeason} sub={ctx.retired ? "Retired" : `Now week ${ctx.save.currentWeek}`} />
          <StatTile label="Events played" value={rows.length} sub="All completed event results" />
          <StatTile label="Titles" value={titles.length} tone={titles.length ? "gold" : "neutral"} sub={`${finals.length} other final${finals.length === 1 ? "" : "s"}`} />
          <StatTile label="Highest World Rank" value={sporting.data?.worldRanking.careerHighPosition ? ordinal(sporting.data.worldRanking.careerHighPosition) : "—"} />
          <StatTile label="Career Earnings" value={finance.data ? formatPence(finance.data.careerEarningsPence) : "…"} sub="Prize money" />
          <StatTile label="Tour Cards" value={cards.data?.history.length ?? "…"} sub={cards.data?.holdsCard ? "Currently held" : "None held now"} />
          <StatTile label="Major appearances" value={majors.length} />
          <StatTile label="Milestones" value={milestones.data?.milestones.length ?? "…"} />
        </div>
      )}
      {tab === "OVERVIEW" && history.data && <FactsOverview facts={history.data} />}
      {tab === "TIMELINE" && history.data && <><FactsTimeline facts={history.data} /><RecognitionTimeline saveId={id}/></>}
      {tab === "PLAYING" && history.data && <PerformancePanel facts={history.data} />}
      {tab === "RECORDS" && history.data && <RecordsPanel facts={history.data} />}
      {tab === "WORLD" && history.data && <WorldHistoryPanel facts={history.data} />}
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
                <span style={{ color: "rgba(255,255,255,0.7)" }}>now {r.position ? ordinal(r.position) : "unranked"}</span>
                <span style={{ color: "#ffd24a" }}>high {r.careerHighPosition ? ordinal(r.careerHighPosition) : "—"}</span></li>))}</ul>
          ) : <CareerLoading />}
        </CareerSection>
      )}
      {tab === "TROPHIES" && (
        <CareerSection title="Career trophy room" icon={<Award className="w-3.5 h-3.5" />} accent="#ffd24a">
          <p className="px-4 pt-3 text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>Titles won in this Career. Separate from the Classic Tour's 305 Trophy Hunt trophies, which are untouched.</p>
          {titles.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
              {titles.map(t => { const tier = tierStyle(t.presentationTier); return (
                <div key={t.eventId} className="rounded-xl p-3 text-center" style={{ background: tier.surface, border: `1px solid ${tier.accent}44` }}>
                  <Trophy className="w-6 h-6 mx-auto" style={{ color: tier.accent }} aria-hidden />
                  <div className="mt-1.5 text-xs font-black uppercase leading-tight" style={{ ...OSWALD, color: "#fff" }}>{t.name}</div>
                  <div className="text-[0.65rem]" style={{ color: "rgba(255,255,255,0.62)" }}>Season {t.season} · {circuitLabel(t.circuit)}</div>
                </div>); })}
            </div>
          ) : <CareerEmptyState title="The cabinet is empty" icon={<Trophy className="w-6 h-6" />}>Win an event and its trophy appears here.</CareerEmptyState>}
          <div className="px-4 pb-3"><Label color="rgba(255,255,255,0.3)">Career records are available in the Records tab</Label></div>
        </CareerSection>
      )}
    </div>
  );
}
