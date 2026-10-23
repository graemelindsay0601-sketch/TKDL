import { Car, Crown, MapPin, Trophy } from "lucide-react";
import "./_group.css";
import "./Current.css";

const opponents = [
  { name:"Jamie McLeod", role:"Local", average:"48.2", quote:"Long way from home. Fancy a game?" },
  { name:"Alasdair Boyd", role:"Town champion", average:"61.4", quote:"Beat one of the locals first, then we'll talk." },
];

export function Current() {
  return <main className="road-page"><div className="road-wrap">
    <div className="road-topline"><span><b>TKDL</b> / Career / Nights Out</span><span>On the road</span></div>
    <header className="road-hero"><div className="road-kicker">Nights Out · on the road</div><h1>Road trips</h1>
      <p>Drive to another town's club for a night and take on their locals for money. Beat a town's champion to make your name there.</p></header>
    <section className="road-current-reputation">
      <p><Car size={17}/><b>Club regular</b> · 1 town taken. Your name is starting to travel.</p>
      <span className="road-chip"><Trophy size={13}/> Next · Town favourite</span>
    </section>
    <section className="road-current-main">
      <div className="road-current-trip">
        <div className="road-label">Tonight's trip · Tuesday</div><h2 className="road-title">Kilmarnock</h2>
        <p className="road-muted">Travel paid: £18.50 · 1 of 3 games played · first to four, winner takes the stake.</p>
        <div className="road-current-opponents">{opponents.map((o,i)=><article key={o.name} data-champion={i===1}>
          <div className="road-current-opponent-head">{i===1&&<Crown size={14}/>}<b>{o.name}</b><small>{o.role} · averaging {o.average} · {i===0?"Even game":"You're the underdog"}</small></div>
          {!i&&<p className="road-muted">“{o.quote}”</p>}
          <div className="road-current-asks"><span>Stake</span><input aria-label={`Stake against ${o.name}`} placeholder="£20"/><button className="road-btn secondary">Offer</button><button className="road-btn">Play for £20</button></div>
        </article>)}</div>
      </div>
      <aside className="road-current-record"><div className="road-label">Your road record</div><strong>3–1</strong><p className="road-muted">Games won · +£42.50 net</p><hr/><b>Town taken</b><span>Ayr</span><small>Beat the champion to claim the town and bring a visitor back to your club.</small></aside>
    </section>
    <footer className="road-current-foot">Illustrative sample data · actions are preview-only</footer>
  </div></main>;
}
