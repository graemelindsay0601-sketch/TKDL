import { useMemo, useState } from "react";
import { Award, CalendarRange, CreditCard, Crown, Flag, Medal, TrendingUp, Trophy } from "lucide-react";
import { useFinance, useCareerFacts, useMilestones, useRankingHistory, useSporting, useTourCard } from "../api";
import { circuitLabel, formatPence, ordinal, stageLabel, tierStyle } from "../model";
import { CareerEmptyState, CareerError, CareerLoading, CareerSection, Label, OSWALD, Segmented } from "../components";
import type { ShellContext } from "../shell";
import type { HistoryRow } from "../types";
import { FactsOverview, FactsTimeline, PerformancePanel, RecordsPanel, WorldHistoryPanel } from "./facts-panels";
import { ResultList } from "./journey";
import { RecognitionTimeline } from "./recognition";
import "./history.css";

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
    <div className="career-history space-y-4">
      <header className="career-history-hero">
        <div className="career-history-mast">
          <span className="career-history-brand">TKDL <i /> MY CAREER</span>
          <span className="career-history-season"><span className="career-history-live" />{ctx.retired ? "RETIRED CAREER" : "ACTIVE CAREER"} <b>S{ctx.save.currentSeason} · W{ctx.save.currentWeek}</b></span>
        </div>
        <div className="career-history-heading">
          <div>
            <Label className="career-history-kicker" color="#ef8aa9">THE RECORD, SEASON BY SEASON</Label>
            <h1>A career<br className="career-history-desktop-break" /> in the making.</h1>
            <p>Your results, personal bests and honours, season by season.</p>
          </div>
          <div className="career-history-season-mark">
            <span>{ctx.retired ? "CAREER COMPLETE" : "YOUR PLACE IN THE RECORD"}</span>
            <strong>Season {String(ctx.save.currentSeason).padStart(2, "0")} <small>· Week {ctx.save.currentWeek}</small></strong>
            <i aria-hidden="true">TKDL</i>
          </div>
        </div>
        <div className="career-history-records" aria-label="Career highlights">
          <div><span>EVENTS COMPLETED</span><strong>{rows.length}</strong><small>Results on the record</small></div>
          <div><span>EVENT TITLES</span><strong>{titles.length.toString().padStart(2, "0")}</strong><small><b>{finals.length}</b> other finals</small></div>
          <div><span>WORLD RANKING HIGH</span><strong>{sporting.data?.worldRanking.careerHighPosition ? ordinal(sporting.data.worldRanking.careerHighPosition) : "—"}</strong><small>Career-best position</small></div>
          <div><span>PRIZE MONEY</span><strong>{finance.data ? formatPence(finance.data.careerEarningsPence) : "…"}</strong><small>Career earnings</small></div>
        </div>
        <div className="career-history-proofline">
          <span><CreditCard size={14} aria-hidden /> {cards.data?.history.length ?? "…"} tour cards{cards.data?.holdsCard ? " · currently held" : ""}</span>
          <span><Crown size={14} aria-hidden /> {majors.length} major appearances</span>
          <span><Flag size={14} aria-hidden /> {milestones.data?.milestones.length ?? "…"} milestones</span>
        </div>
      </header>

      <nav className="career-history-navigation" aria-label="Career history sections">
        <span className="career-history-nav-label">CAREER RECORD</span>
        <Segmented label="History sections" value={tab} onChange={next => setTab(next as Tab)} options={[
          { value: "OVERVIEW", label: "Overview" }, { value: "PLAYING", label: "Playing stats" }, { value: "RECORDS", label: "Records" }, { value: "WORLD", label: "World history" }, { value: "TIMELINE", label: "Timeline" }, { value: "SEASONS", label: "Seasons" }, { value: "TITLES", label: "Titles & finals", count: titles.length + finals.length },
          { value: "MAJORS", label: "Majors", count: majors.length }, { value: "RANKING", label: "Ranking" }, { value: "TROPHIES", label: "Trophy room", count: titles.length }]} />
      </nav>

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
        <CareerSection title="Career trophy room" icon={<Award className="w-3.5 h-3.5" />} accent="#e9c77a">
          <div className="career-trophy-intro">
            <div><Label color="#e9c77a">CAREER-ONLY HONOURS</Label><h3>The trophy room</h3></div>
            <p>Titles won in this Career. Separate from the Classic Tour&apos;s 305 Trophy Hunt trophies.</p>
          </div>
          {titles.length ? (
            <div className="career-trophy-gallery" aria-label={`${titles.length} Career event titles`}>
              {titles.map(t => { const tier = tierStyle(t.presentationTier); return (
                <article key={t.eventId} className="career-trophy-entry" style={{ ["--trophy-accent" as string]: tier.accent }}>
                  <span className="career-trophy-seal"><Trophy size={23} aria-hidden /></span>
                  <span className="career-trophy-title" style={{ ...OSWALD }}>{t.name}</span>
                  <span className="career-trophy-meta">Season {t.season} · {circuitLabel(t.circuit)}</span>
                </article>); })}
            </div>
          ) : <CareerEmptyState title="The cabinet is empty" icon={<Trophy className="w-6 h-6" />}>Win an event and its trophy appears here.</CareerEmptyState>}
          <div className="career-trophy-foot"><Medal size={14} aria-hidden /> {titles.length} event title{titles.length === 1 ? "" : "s"} recorded in this Career</div>
        </CareerSection>
      )}
    </div>
  );
}
