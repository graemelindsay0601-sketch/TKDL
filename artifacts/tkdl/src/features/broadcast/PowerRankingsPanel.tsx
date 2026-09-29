import { useMemo, useState } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, BarChart3, Flame, Minus, Mic2, Radio, Shield, Sparkles } from "lucide-react";
import "./power-rankings.css";

export type PowerLeague = "singles" | "doubles" | "shift_wars";
export type PowerRankingEntry = {
  id: number; name: string; rank: number; score: number; movement: number | null;
  recentForm: Array<"W" | "L">; wins: number; losses: number; pointsDelta: number;
  streak: { result: "W" | "L"; count: number }; latestPlayedAt: string;
  chalkyVerdict: string; tonVerdict: string;
};
export type PowerRankings = Record<PowerLeague, PowerRankingEntry[]>;

const LABELS: Record<PowerLeague, string> = { singles: "Singles", doubles: "Doubles", shift_wars: "Shift Wars" };

function Movement({ value }: { value: number | null }) {
  if (value === null) return <span className="power-move power-move--new"><Sparkles /> New</span>;
  if (value > 0) return <span className="power-move power-move--up"><ArrowUp /> {value}</span>;
  if (value < 0) return <span className="power-move power-move--down"><ArrowDown /> {Math.abs(value)}</span>;
  return <span className="power-move"><Minus /> Hold</span>;
}

export function PowerRankingsPanel({ rankings, loading, onBack }: { rankings: PowerRankings | null; loading: boolean; onBack: () => void }) {
  const [league, setLeague] = useState<PowerLeague>("singles");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const rows = rankings?.[league] ?? [];
  const selected = useMemo(() => rows.find(row => row.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);
  const switchLeague = (next: PowerLeague) => { setLeague(next); setSelectedId(null); };
  return <section className="power-rankings">
    <button className="channel-back" onClick={onBack}><ArrowLeft /> Channel Home</button>
    <header className="power-rankings__hero">
      <div><span><Radio /> TKDL LIVE FORM TABLE</span><h1>Power<br /><em>Rankings</em></h1><p>The table the standings cannot show: who is producing the strongest results right now.</p></div>
      <aside><BarChart3 /><small>Ranking method</small><strong>Latest five</strong><p>Results, opponent strength, points movement, upset wins and current streaks. Movement compares the previous five-match window.</p></aside>
    </header>
    <nav className="power-rankings__tabs" aria-label="Power Rankings league">
      {(Object.keys(LABELS) as PowerLeague[]).map(key => <button className={league === key ? "is-active" : ""} onClick={() => switchLeague(key)} key={key}>{LABELS[key]}</button>)}
    </nav>
    {loading ? <div className="channel-loading">Calculating current form…</div> : rows.length === 0 ? <div className="power-rankings__empty"><Shield /><strong>No completed {LABELS[league]} matches yet</strong><span>The first result will create this table automatically.</span></div> : <div className="power-rankings__layout">
      <div className="power-table">
        <div className="power-table__head"><span>Rank</span><span>Player / team</span><span>Form</span><span>Move</span><span>Rating</span></div>
        {rows.map(row => <button className={selected?.id === row.id ? "is-selected" : ""} onClick={() => setSelectedId(row.id)} key={row.id}>
          <b>{String(row.rank).padStart(2, "0")}</b><div><strong>{row.name}</strong><small>{row.pointsDelta >= 0 ? "+" : ""}{row.pointsDelta} points · {row.wins}W {row.losses}L</small></div><div className="power-form">{row.recentForm.map((result, index) => <i className={result === "W" ? "is-win" : "is-loss"} key={index}>{result}</i>)}</div><Movement value={row.movement} /><em>{row.score}</em>
        </button>)}
      </div>
      {selected && <aside className="power-verdict">
        <div className="power-verdict__rank"><span>Current power rank</span><strong>#{selected.rank}</strong><Movement value={selected.movement} /></div>
        <h2>{selected.name}</h2><div className="power-verdict__meter"><span style={{ width: `${selected.score}%` }} /></div>
        <div className="power-verdict__numbers"><span><b>{selected.score}</b> form rating</span><span><Flame /><b>{selected.streak.count}</b> {selected.streak.result === "W" ? "win" : "loss"} streak</span></div>
        <article><div><Mic2 /><b>Chalky</b></div><p>{selected.chalkyVerdict}</p></article>
        <article><div><Mic2 /><b>Ton</b></div><p>{selected.tonVerdict}</p></article>
      </aside>}
    </div>}
  </section>;
}
