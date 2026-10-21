import "./_group.css";
import "./Current.css";
import { ArrowUpRight, ChevronDown, Coins, Crown, History, RotateCcw, Target, Wallet } from "lucide-react";

const members = [
  { initials: "MC", name: "Mara Quinn", avg: "46.8", odds: "EVEN", cta: "Haggle" },
  { initials: "JR", name: "Jonah Reed", avg: "44.1", odds: "FAVOURITE", cta: "Haggle" },
  { initials: "AV", name: "Avery Vale", avg: "41.9", odds: "UNDERDOG", cta: "Haggle" },
  { initials: "LC", name: "Luca Cross", avg: "43.6", odds: "EVEN", cta: "Haggle" },
];

export function Current() {
  return (
    <main className="mm-current">
      <header className="mm-current__hero">
        <span className="mm-current__sample">SAMPLE DATA · FICTIONAL CLUB MEMBERS</span>
        <div className="mm-current__eyebrow"><span>NIGHTS OUT</span><i /> AT YOUR CLUB</div>
        <div className="mm-current__hero-row">
          <div>
            <h1>Money matches</h1>
            <p>Put money on a game against a club member. Haggle over the stake; the winner takes it.</p>
          </div>
          <div className="mm-current__hero-icon"><Coins size={25} /></div>
        </div>
        <div className="mm-current__hero-stats">
          <span><small>CLUB NIGHT</small><b>Week 21</b></span>
          <span><small>FREE BALANCE</small><b>£24.50</b></span>
          <span><small>PLAYED THIS WEEK</small><b>1 <em>/ 3</em></b></span>
        </div>
      </header>

      <section className="mm-current__panel">
        <div className="mm-current__panel-head">
          <div><span className="mm-current__kicker">THIS WEEK</span><h2>Club money matches</h2></div>
          <span className="mm-current__rule"><Target size={14} /> First to 4 legs</span>
        </div>
        <p className="mm-current__intro">One-off games at the club, first to 4 legs, winner takes the stake. Name your price: they'll put more up when they fancy their chances, haggle when it's too rich, and walk away if you push too often. Up to 3 a week. You have <b>£24.50</b> free and you're averaging about <b>44.3</b>.</p>

        <div className="mm-current__challenge">
          <div className="mm-current__challenge-mark"><Coins size={21} /></div>
          <div className="mm-current__challenge-copy">
            <span className="mm-current__kicker">CHALLENGE RECEIVED</span>
            <p><b>Mara Quinn</b>: “Fancy a game? <strong>£8.00</strong>, first to four.”</p>
            <small>Even game · they average 46.8</small>
          </div>
          <div className="mm-current__actions"><button className="mm-current__gold">Play for £8.00 <ArrowUpRight size={15} /></button><button className="mm-current__quiet">Turn it down</button></div>
        </div>

        <div className="mm-current__section-title"><span>YOUR CLUB</span><span>FORM &amp; ODDS</span></div>
        <ul className="mm-current__members">
          {members.map((member, index) => (
            <li key={member.initials}>
              <span className={`mm-current__avatar mm-current__avatar--${index}`}><b>{member.initials}</b></span>
              <span className="mm-current__member-copy"><b>{member.name}</b><small>AVG {member.avg} <i /> {member.odds === "FAVOURITE" ? "You're the favourite" : member.odds === "UNDERDOG" ? "You're the underdog" : "An even game"}</small></span>
              <button className="mm-current__outline">{member.cta}</button>
            </li>
          ))}
        </ul>
        <button className="mm-current__show">Show all 12 members <ChevronDown size={14} /></button>

        <div className="mm-current__record">
          <span className="mm-current__record-icon"><Crown size={17} /></span>
          <span><small>YOUR RECORD</small><b>Won 8 of 12</b></span>
          <strong>+£12.00</strong>
          <span className="mm-current__record-note"><Wallet size={14} /> Net since joining</span>
        </div>
        <details className="mm-current__history"><summary><History size={14} /> Recent money matches <ChevronDown size={14} /></summary><div><span>S4 · W20 &nbsp; Jonah Reed</span><b>Won 4–2 · +£5.00</b></div><div><span>S4 · W19 &nbsp; Luca Cross</span><b className="loss">Lost 3–4 · −£2.00</b></div></details>
      </section>
      <footer className="mm-current__footer"><RotateCcw size={13} /> Agree a stake, then play it out on the live Career scorer. Results settle to your balance after the match.</footer>
    </main>
  );
}
