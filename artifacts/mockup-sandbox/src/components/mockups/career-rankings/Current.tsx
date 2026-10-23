import { useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, HelpCircle, Info } from "lucide-react";
import "./_group.css";
import "./Current.css";

type Row = { position: number; movement: number; name: string; country: string; money: string };
const rows: Row[] = [
  { position: 1, movement: 1, name: "Reece Palmer", country: "ENG", money: "£142,500" },
  { position: 2, movement: -1, name: "Marcus Vale", country: "WAL", money: "£128,750" },
  { position: 3, movement: 2, name: "Jamie Cross", country: "SCO", money: "£116,200" },
  { position: 4, movement: 0, name: "You", country: "ENG", money: "£92,350" },
  { position: 5, movement: 1, name: "Callum Frost", country: "NIR", money: "£89,900" },
  { position: 6, movement: -2, name: "Leon Mercer", country: "ENG", money: "£78,400" },
  { position: 7, movement: 0, name: "Daniel Shaw", country: "IRL", money: "£72,600" },
  { position: 8, movement: 3, name: "Owen Hart", country: "ENG", money: "£68,100" },
];

function Card({ title, children, icon }: { title: string; children: ReactNode; icon: ReactNode }) {
  return <section className="rk-card"><header><span>{icon}</span><b>{title}</b></header>{children}</section>;
}

export function Current() {
  const [mode, setMode] = useState("Around me");
  const [showExplain, setShowExplain] = useState(false);
  return <main className="rk-preview">
    <header className="rk-hero">
      <div className="rk-kicker"><i /> OFFICIAL RANKING · ROLLING 52 WEEKS</div>
      <h1>World ranking</h1>
      <p>Published season 2026, week 44 · 80 ranked players</p>
      <div className="rk-selector"><span>RANKING LIST</span><select aria-label="Ranking list"><option>World Ranking</option><option>Tour Order of Merit</option><option>Players Championship Order</option></select></div>
      <div className="rk-stats">
        <div><small>Your position</small><strong>#4 <em>↑ 2</em></strong></div>
        <div><small>Ranking money</small><strong>£92,350</strong><span>Rolling 52 weeks</span></div>
        <div><small>Career high</small><strong>#3</strong><span>Season high #4</span></div>
        <div><small>Next cut</small><strong>Top 16</strong><span>£8,750 behind</span></div>
      </div>
    </header>

    <Card title="World Ranking movers" icon={<ArrowUpRight size={16} />}>
      <div className="rk-movers"><div><small>BIGGEST CLIMBER</small><b>Reece Palmer <span>+8 places</span></b></div><div><small>NEW TO THE TOP 32</small><b>Callum Frost <span>Rising star</span></b></div></div>
    </Card>

    <Card title="World Ranking" icon={<BarChart3 size={16} />}>
      <div className="rk-table-tools"><div className="rk-segments" role="group" aria-label="Table view">{["Around me", "Top 32", "Full table"].map(item => <button key={item} type="button" className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div><span><i /> CUT LINES: TOP 16, 32</span></div>
      <div className="rk-table-wrap"><table aria-label="World ranking table"><thead><tr><th>POS</th><th>+/−</th><th>PLAYER</th><th>MONEY</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.position} data-you={row.name === "You"} data-podium={row.position <= 3 ? row.position : undefined}><td><b>{row.position}</b></td><td>{row.movement > 0 ? <span className="up"><ArrowUpRight size={13} />{row.movement}</span> : row.movement < 0 ? <span className="down"><ArrowDownRight size={13} />{Math.abs(row.movement)}</span> : "—"}</td><td><span className="rk-player"><i>{row.name.split(" ").map(part => part[0]).join("")}</i><span>{row.name}<small>{row.country}</small></span></span></td><td>{row.money}</td></tr>)}
        <tr className="rk-cut"><td colSpan={4}><span>TOP 16 CUT</span></td></tr>
      </tbody></table></div>
      <footer className="rk-pagination"><button type="button" disabled><ChevronLeft size={15} /> Previous</button><span>1–8 of 80</span><button type="button">Next <ChevronRight size={15} /></button></footer>
    </Card>

    <div className="rk-lower">
      <Card title="Your ranking history" icon={<BarChart3 size={16} />}><p className="rk-history-note">Season highs: S2024 #11 · S2025 #6 · S2026 #4</p>{[44, 40, 36].map((week, i) => <div className="rk-history-row" key={week}><span>S2026 W{week}</span><b>#{4 + i}</b><em>{i ? "↑ 2" : "↑ 1"}</em><strong>£92.3k</strong></div>)}</Card>
      <Card title="Why this ranking?" icon={<HelpCircle size={16} />}><button className="rk-explain-toggle" type="button" aria-expanded={showExplain} onClick={() => setShowExplain(!showExplain)}>{showExplain ? "Hide explanation" : "Show explanation"}</button>{showExplain && <p className="rk-explain">Your ranking is the prize money won at ranking events in the rolling 52-week window. Results age out after the window closes.</p>}<div className="rk-note"><Info size={14} /> Only published ranking facts are shown; current totals update after each ranking week.</div></Card>
    </div>
    <p className="rk-disclosure">Preview fixture data for visual review. Rankings shown here are illustrative.</p>
  </main>;
}
