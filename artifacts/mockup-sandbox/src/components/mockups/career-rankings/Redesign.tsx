import { useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, BarChart3, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Info, Medal, Target, Trophy,
} from "lucide-react";
import "./_group.css";
import "./Redesign.css";

type RankingRow = {
  position: number;
  movement: number;
  name: string;
  country: string;
  money: string;
};

const rows: RankingRow[] = [
  { position: 1, movement: 1, name: "Reece Palmer", country: "ENG", money: "£142,500" },
  { position: 2, movement: -1, name: "Marcus Vale", country: "WAL", money: "£128,750" },
  { position: 3, movement: 2, name: "Jamie Cross", country: "SCO", money: "£116,200" },
  { position: 4, movement: 0, name: "You", country: "ENG", money: "£92,350" },
  { position: 5, movement: 1, name: "Callum Frost", country: "NIR", money: "£89,900" },
  { position: 6, movement: -2, name: "Leon Mercer", country: "ENG", money: "£78,400" },
  { position: 7, movement: 0, name: "Daniel Shaw", country: "IRL", money: "£72,600" },
  { position: 8, movement: 3, name: "Owen Hart", country: "ENG", money: "£68,100" },
];

const listOptions = ["World Ranking", "Tour Order of Merit", "Players Championship Order"];
const views = ["Around me", "Top 32", "Full table"] as const;
type TableView = (typeof views)[number];

function RankingGraphic() {
  return (
    <div className="rkr-rank-art" role="img" aria-label="Top four world ranking positions">
      <div className="rkr-rank-art__plate">
        <div className="rkr-rank-art__heading">
          <span><i /> WORLD ORDER</span>
          <small>WEEK 44 · 2026</small>
        </div>
        <div className="rkr-rank-art__rows">
          <div className="rkr-rank-art__row rkr-rank-art__row--gold">
            <b>01</b><span><strong>Reece Palmer</strong><small>ENGLAND</small></span><em>£142.5k</em>
          </div>
          <div className="rkr-rank-art__row">
            <b>02</b><span><strong>Marcus Vale</strong><small>WALES</small></span><em>£128.7k</em>
          </div>
          <div className="rkr-rank-art__row">
            <b>03</b><span><strong>Jamie Cross</strong><small>SCOTLAND</small></span><em>£116.2k</em>
          </div>
          <div className="rkr-rank-art__row rkr-rank-art__row--you">
            <b>04</b><span><strong>YOUR POSITION</strong><small>UP 2 PLACES</small></span><em>£92.3k</em>
          </div>
        </div>
      </div>
      <span className="rkr-rank-art__seal"><Trophy size={13} /><b>TOP<br />FOUR</b></span>
    </div>
  );
}

function Movement({ value }: { value: number }) {
  if (!value) return <span className="rkr-movement rkr-movement--same">—</span>;
  return (
    <span className={`rkr-movement ${value > 0 ? "rkr-movement--up" : "rkr-movement--down"}`}>
      {value > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {Math.abs(value)}
    </span>
  );
}

export function Redesign() {
  const [ranking, setRanking] = useState(listOptions[0]);
  const [view, setView] = useState<TableView>("Around me");
  const [page, setPage] = useState(0);
  const [showExplain, setShowExplain] = useState(false);
  const visibleRows = view === "Around me"
    ? rows.filter((row) => row.position >= 1 && row.position <= 8)
    : view === "Top 32"
      ? rows.filter((row) => row.position <= 8)
      : rows.slice(page * 8, (page + 1) * 8);
  const first = view === "Full table" ? page * 8 + 1 : 1;
  const last = Math.min(first + visibleRows.length - 1, 80);
  const hasNext = view === "Full table" && page === 0;

  const changeView = (next: TableView) => {
    setView(next);
    setPage(0);
  };

  return (
    <main className="rkr-page">
      <div className="rkr-shell">
        <header className="rkr-topbar">
          <a className="rkr-brand" href="#rankings-top" aria-label="TKDL Career rankings">
            <span className="rkr-brand__mark">TK</span>
            <span><b>TKDL</b><small>CAREER · DARTS WORLD</small></span>
          </a>
          <nav className="rkr-breadcrumb" aria-label="Page location"><span>CAREER</span><i>/</i><span>DARTS WORLD</span><i>/</i><strong>RANKINGS</strong></nav>
          <span className="rkr-edition"><i /> OFFICIAL RECORD <b>·</b> 2026</span>
        </header>

        <section className="rkr-hero" id="rankings-top">
          <div className="rkr-hero__texture" aria-hidden="true" />
          <div className="rkr-hero__copy">
            <div className="rkr-kicker"><span /> OFFICIAL RANKING <i>—</i> ROLLING 52 WEEKS</div>
            <h1>World<br /><em>ranking.</em></h1>
            <p>Every place has a number.<br />Every number has a record.</p>
            <div className="rkr-list-picker">
              <label htmlFor="rkr-list">RANKING LIST</label>
              <span className="rkr-select-wrap">
                <select id="rkr-list" value={ranking} onChange={(event) => setRanking(event.currentTarget.value)}>
                  {listOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
                <ChevronDown size={14} />
              </span>
            </div>
            <div className="rkr-hero__foot"><span><i /> PUBLISHED SEASON 2026 · WEEK 44</span><span>80 RANKED PLAYERS</span></div>
          </div>
          <RankingGraphic />
        </section>

        <section className="rkr-statline" aria-label="Your ranking facts">
          <div className="rkr-stat rkr-stat--position"><small>Your position</small><strong>#4 <em>↑ 2</em></strong><span>World Ranking</span></div>
          <div className="rkr-stat"><small>Ranking money</small><strong>£92,350</strong><span>Rolling 52 weeks</span></div>
          <div className="rkr-stat"><small>Career high</small><strong>#3</strong><span>Season high #4</span></div>
          <div className="rkr-stat rkr-stat--cut"><small>Next cut</small><strong>Top 16</strong><span>£8,750 behind</span></div>
        </section>

        <section className="rkr-movers" aria-label="World Ranking movers">
          <div className="rkr-movers__title">
            <span className="rkr-section-index">01 <i>—</i></span>
            <div><small>WORLD RANKING</small><h2>The movers</h2></div>
          </div>
          <div className="rkr-mover">
            <span className="rkr-mover__icon"><ArrowUpRight size={17} /></span>
            <span><small>BIGGEST CLIMBER</small><strong>Reece Palmer</strong></span>
            <b>+8 <small>places</small></b>
          </div>
          <div className="rkr-mover">
            <span className="rkr-mover__icon rkr-mover__icon--gold"><Medal size={17} /></span>
            <span><small>NEW TO THE TOP 32</small><strong>Callum Frost</strong></span>
            <b className="rkr-rising">Rising star</b>
          </div>
        </section>

        <section className="rkr-table-panel" aria-labelledby="rkr-table-heading">
          <header className="rkr-panel-head">
            <div className="rkr-panel-title"><span className="rkr-panel-icon"><BarChart3 size={17} /></span><div><small>OFFICIAL TABLE</small><h2 id="rkr-table-heading">{ranking}</h2></div></div>
            <span className="rkr-week">S2026 <b>·</b> W44</span>
          </header>
          <div className="rkr-toolbar">
            <div className="rkr-tabs" role="group" aria-label="Table view">
              {views.map((item) => <button key={item} type="button" className={view === item ? "is-active" : ""} onClick={() => changeView(item)}>{item}</button>)}
            </div>
            <span className="rkr-cut-key"><i /> CUT LINES: TOP 16, 32</span>
          </div>
          <div className="rkr-table-wrap">
            <table aria-label={`${ranking} table`}>
              <thead><tr><th>POS</th><th>+/−</th><th>PLAYER</th><th>MONEY</th></tr></thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.position} data-you={row.name === "You"} data-podium={row.position <= 3 ? row.position : undefined}>
                    <td><b className="rkr-rank">{row.position}</b></td>
                    <td><Movement value={row.movement} /></td>
                    <td>
                      <a className="rkr-player" href={row.name === "You" ? "#my-career" : `#player-${row.position}`} aria-label={`Open ${row.name === "You" ? "your" : `${row.name}'s`} player profile`}>
                        <span className="rkr-monogram">{row.name.split(" ").map((part) => part[0]).join("")}</span>
                        <span><strong>{row.name}</strong><small>{row.country}</small></span>
                      </a>
                    </td>
                    <td className="rkr-money">{row.money}</td>
                  </tr>
                ))}
                {view !== "Full table" && <tr className="rkr-cut"><td colSpan={4}><span>TOP 16 CUT</span></td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="rkr-pagination">
            <button type="button" disabled={page === 0 || view !== "Full table"} onClick={() => setPage(0)}><ChevronLeft size={15} /> Previous</button>
            <span>{first}–{last} of 80 <i>·</i> preview rows shown</span>
            <button type="button" disabled={!hasNext} onClick={() => setPage(1)}>Next <ChevronRight size={15} /></button>
          </footer>
        </section>

        <div className="rkr-lower">
          <section className="rkr-history">
            <header className="rkr-lower-head"><span className="rkr-panel-icon"><BarChart3 size={16} /></span><div><small>YOUR CAREER</small><h2>Ranking history</h2></div></header>
            <p className="rkr-highs">SEASON HIGHS <b>S2024 #11</b><i>·</i><b>S2025 #6</b><i>·</i><b>S2026 #4</b></p>
            <div className="rkr-history-chart" aria-label="Three recent ranking snapshots">
              <span className="rkr-chart-grid rkr-chart-grid--top">#4</span><span className="rkr-chart-grid rkr-chart-grid--middle">#5</span><span className="rkr-chart-grid rkr-chart-grid--bottom">#6</span>
              <svg viewBox="0 0 420 92" preserveAspectRatio="none" role="img" aria-label="Ranking improves from sixth to fourth">
                <defs><linearGradient id="rank-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#c82132" stopOpacity=".32" /><stop offset="1" stopColor="#c82132" stopOpacity="0" /></linearGradient></defs>
                <path d="M20 67 L210 43 L400 19 L400 92 L20 92 Z" fill="url(#rank-fill)" />
                <path d="M20 67 L210 43 L400 19" fill="none" stroke="#e14a4c" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                <circle cx="20" cy="67" r="4" fill="#f0c773" /><circle cx="210" cy="43" r="4" fill="#f0c773" /><circle cx="400" cy="19" r="5" fill="#f0c773" />
              </svg>
              <div className="rkr-history-points">
                {[{ week: "S2026 W36", rank: "#6", move: "↑ 2" }, { week: "S2026 W40", rank: "#5", move: "↑ 2" }, { week: "S2026 W44", rank: "#4", move: "↑ 1" }].map((item) =>
                  <div key={item.week}><small>{item.week}</small><strong>{item.rank}</strong><em>{item.move}</em><b>£92.3k</b></div>)}
              </div>
            </div>
          </section>
          <section className="rkr-explain">
            <header className="rkr-lower-head"><span className="rkr-panel-icon rkr-panel-icon--gold"><CircleHelp size={16} /></span><div><small>THE RECORD</small><h2>Why this ranking?</h2></div></header>
            <button className="rkr-explain-toggle" type="button" aria-expanded={showExplain} onClick={() => setShowExplain((open) => !open)}>
              {showExplain ? "Hide explanation" : "Show explanation"} <ChevronDown size={14} />
            </button>
            {showExplain && <p className="rkr-explain-copy">Your ranking is the prize money you’ve won at ranking events in the rolling 52-week window. Results age out after the window closes.</p>}
            <div className="rkr-note"><Info size={15} /><span>Only published ranking facts are shown. Current totals update after each ranking week.</span></div>
          </section>
        </div>
        <footer className="rkr-footer"><span>TKDL <i>×</i> DARTS WORLD</span><p>The throw fades. The record stays.</p><span className="rkr-preview-tag"><Target size={13} /> PREVIEW EXAMPLES · NOT LIVE RANKINGS</span></footer>
      </div>
    </main>
  );
}
