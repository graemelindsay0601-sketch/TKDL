import { useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgePoundSterling,
  ChevronDown,
  CircleHelp,
  Clock3,
  Crosshair,
  History,
  MessageSquareText,
  Pause,
  ShieldCheck,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import "./Redesign.css";

const members = [
  { initials: "MQ", name: "Mara Quinn", average: "46.8", read: "Even game", color: "rose", note: "Often plays after league night" },
  { initials: "JR", name: "Jonah Reed", average: "44.1", read: "You're the favourite", color: "gold", note: "Last seen on the Tuesday oche" },
  { initials: "AV", name: "Avery Vale", average: "41.9", read: "You're the underdog", color: "blue", note: "Likes a close finish" },
  { initials: "LC", name: "Luca Cross", average: "43.6", read: "Even game", color: "mint", note: "Usually up for a rematch" },
  { initials: "ND", name: "Nia Doyle", average: "42.7", read: "Even game", color: "violet", note: "A steady club regular" },
];

const history = [
  { name: "Jonah Reed", date: "S4 · W20", result: "Won 4–2", net: "+£5.00", up: true },
  { name: "Luca Cross", date: "S4 · W19", result: "Lost 3–4", net: "−£2.00", up: false },
  { name: "Mara Quinn", date: "S4 · W18", result: "Won 4–1", net: "+£4.00", up: true },
];

export function Redesign() {
  const [challenge, setChallenge] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [counterName, setCounterName] = useState("");
  const [stake, setStake] = useState("8.00");
  const [counterOpen, setCounterOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeMatch, setActiveMatch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);

  const beginMatch = (name: string, amount: string) => {
    setActiveMatch(`${name} · £${amount}`);
    setNotice("");
  };

  return (
    <main className="mm-redesign">
      <header className="mm-topbar">
        <div className="mm-brand"><span className="mm-brand__mark"><Crosshair size={18} /></span><span>TKDL <i>CAREER</i></span></div>
        <div className="mm-breadcrumb"><span>THE RED LION</span><b>/</b><strong>Money matches</strong></div>
        <div className="mm-sample"><span /> SAMPLE DATA</div>
      </header>

      <section className="mm-hero">
        <div className="mm-hero__copy">
          <div className="mm-overline"><span>CLUB ROOM</span><i /> WEEK 21 <i /> SEASON 4</div>
          <h1>Money<br /><em>matches.</em></h1>
          <p>Agree the stake with someone from the club.<br />Then take your place at the oche and play every dart.</p>
          <div className="mm-hero__proof"><ShieldCheck size={15} /> No quick-sim. The match is played live by you.</div>
        </div>
        <div className="mm-hero__art" aria-label="Illustration of a dartboard and darts" role="img">
          <div className="mm-art__ring mm-art__ring--outer" />
          <div className="mm-art__ring mm-art__ring--mid" />
          <div className="mm-art__board">
            <div className="mm-board__ring mm-board__ring--one" />
            <div className="mm-board__ring mm-board__ring--two" />
            <div className="mm-board__ring mm-board__ring--three" />
            <div className="mm-board__ring mm-board__ring--four" />
            <div className="mm-board__bull" />
            <div className="mm-board__spokes" />
          </div>
          <div className="mm-art__dart mm-art__dart--one"><span /></div>
          <div className="mm-art__dart mm-art__dart--two"><span /></div>
          <div className="mm-art__shadow" />
          <span className="mm-art__caption">THE OCH<span>E</span></span>
        </div>
        <div className="mm-hero__stats">
          <div><small>FREE BALANCE</small><strong>£24.50</strong><span>Available to stake</span></div>
          <div><small>THIS WEEK</small><strong>1 <i>/ 3</i></strong><span>Money matches played</span></div>
          <div><small>YOUR AVERAGE</small><strong>44.3</strong><span>Recent form</span></div>
        </div>
      </section>

      <div className="mm-content">
        <section className="mm-main-column">
          <div className="mm-section-heading">
            <div><span className="mm-kicker">THE TABLE</span><h2>Games to make</h2></div>
            <span className="mm-format"><Crosshair size={14} /> FIRST TO 4 LEGS</span>
          </div>
          <p className="mm-section-intro">One-off club games. Name a stake, haggle if it feels too rich, and agree before a dart is thrown.</p>

          {challenge && <article className="mm-challenge">
            <div className="mm-challenge__top"><span className="mm-challenge__tag"><span /> CHALLENGE RECEIVED</span><span className="mm-challenge__time"><Clock3 size={13} /> TONIGHT AT THE CLUB</span></div>
            <div className="mm-challenge__body">
              <div className="mm-person-mark mm-person-mark--rose">MQ</div>
              <div className="mm-challenge__details">
                <span className="mm-kicker">MARA QUINN SAYS</span>
                <h3>“Fancy a game?”</h3>
                <p>First to four. <strong>£8.00</strong> on the table.</p>
                <small>Even game <b /> Mara averages 46.8</small>
              </div>
              <div className="mm-challenge__stake"><small>PROPOSED STAKE</small><strong>£8<span>.00</span></strong><i>Each player stakes this amount</i></div>
            </div>
            <div className="mm-challenge__actions">
              <button className="mm-button mm-button--primary" onClick={() => beginMatch("Mara Quinn", "8.00")}>Accept challenge <ArrowRight size={16} /></button>
              <button className="mm-button mm-button--secondary" onClick={() => { setCounterName("Mara Quinn"); setCounterOpen(true); }}>Counter the stake <MessageSquareText size={15} /></button>
              <button className="mm-button mm-button--text" onClick={() => { setChallenge(false); setNotice("Challenge declined in this sample preview."); }}>Decline</button>
            </div>
          </article>}

          <div className="mm-roster-heading"><div><span className="mm-kicker">AROUND THE CLUB</span><h2>Find a game</h2></div><span className="mm-roster-count"><UsersRound size={14} /> {showAll ? "5" : "4"} MEMBERS</span></div>
          <div className="mm-members">
            {(showAll ? members : members.slice(0, 4)).map((member, index) => (
              <article className="mm-member" key={member.initials}>
                <div className={`mm-person-mark mm-person-mark--${member.color}`}>{member.initials}</div>
                <div className="mm-member__copy"><strong>{member.name}</strong><span>AVG {member.average} <i /> {member.read}</span><small>{member.note}</small></div>
                <button className="mm-member__offer" onClick={() => { setCounterName(member.name); setCounterOpen(true); }}>Propose stake <ArrowUpRight size={14} /></button>
                <button aria-label={`Play a money match with ${member.name}`} className="mm-member__play" onClick={() => beginMatch(member.name, stake)}>Play <ArrowRight size={14} /></button>
              </article>
            ))}
          </div>
          {!showAll && <button className="mm-show-all" onClick={() => setShowAll(true)}>Show all club members <ChevronDown size={15} /></button>}
          {notice && <div className="mm-notice"><CircleHelp size={16} /><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={15} /></button></div>}
        </section>

        <aside className="mm-side-column">
          <section className="mm-resume">
            <div className="mm-side-heading"><span className="mm-kicker">PICK UP WHERE YOU LEFT OFF</span><span className="mm-live-mark"><i /> LIVE SESSION</span></div>
            <div className="mm-resume__name"><div className="mm-person-mark mm-person-mark--gold">JR</div><div><small>UNFINISHED MATCH</small><strong>You &amp; Jonah Reed</strong></div></div>
            <div className="mm-resume__meta"><span>Season 4 · Week 21</span><b>£5.00 stake</b></div>
            <div className="mm-resume__score"><span>RESUME FROM THE LIVE SCORER</span><Pause size={15} /></div>
            <button className="mm-button mm-button--resume" onClick={() => beginMatch("Jonah Reed", "5.00")}>Resume live match <ArrowRight size={15} /></button>
            <p>This match is still in progress. No result has been recorded.</p>
          </section>

          <section className="mm-record">
            <div className="mm-record__head"><span className="mm-kicker">YOUR MONEY-MATCH RECORD</span><Trophy size={17} /></div>
            <div className="mm-record__main"><strong>8 <i>/ 12</i></strong><span>matches won</span><b>+£12.00</b></div>
            <div className="mm-record__bar"><span /></div>
            <div className="mm-record__foot"><span>Net since joining</span><span>4 matches lost</span></div>
          </section>

          <section className="mm-history">
            <button className="mm-history__toggle" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}>
              <span><History size={15} /> RECENT MATCHES</span><ChevronDown className={historyOpen ? "is-open" : ""} size={16} />
            </button>
            {historyOpen && <div className="mm-history__list">
              {history.map((item) => <div className="mm-history__row" key={item.name}>
                <div><strong>{item.name}</strong><small>{item.date} <i /> {item.result}</small></div>
                <b className={item.up ? "is-up" : "is-down"}>{item.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{item.net}</b>
              </div>)}
            </div>}
          </section>
        </aside>
      </div>

      <footer className="mm-footer"><BadgePoundSterling size={16} /><span>Agree a stake first. Then play it out, dart by dart, in the live Career scorer.</span><b>SAMPLE DATA · FICTIONAL CLUB MEMBERS</b></footer>

      {activeMatch && <div className="mm-modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveMatch(""); }}>
        <section className="mm-modal" role="dialog" aria-modal="true" aria-labelledby="mm-modal-title">
          <button className="mm-modal__close" aria-label="Close" onClick={() => setActiveMatch("")}><X size={18} /></button>
          <span className="mm-kicker">LIVE MATCH SETUP</span><h2 id="mm-modal-title">You’re up at the oche.</h2>
          <p><strong>{activeMatch}</strong></p>
          <div className="mm-modal__rule"><Crosshair size={17} /><span>The match is played by you in the live scorer. This preview will not simulate darts or settle a result.</span></div>
          <button className="mm-button mm-button--primary" onClick={() => setActiveMatch("")}>Back to money matches <ArrowRight size={15} /></button>
        </section>
      </div>}

      {counterOpen && <div className="mm-modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCounterOpen(false); }}>
        <section className="mm-modal mm-modal--counter" role="dialog" aria-modal="true" aria-labelledby="mm-counter-title">
          <button className="mm-modal__close" aria-label="Close" onClick={() => setCounterOpen(false)}><X size={18} /></button>
          <span className="mm-kicker">STAKE TALK · SAMPLE PREVIEW</span><h2 id="mm-counter-title">Name your stake.</h2>
          <p>Propose an amount to <strong>{counterName}</strong>. The match only begins after the stake is agreed.</p>
          <label className="mm-stake-field"><span>YOUR PROPOSED STAKE</span><div><b>£</b><input value={stake} onChange={(event) => setStake(event.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label="Proposed stake in pounds" /><small>per player</small></div></label>
          <div className="mm-modal__rule"><CircleHelp size={16} /><span>This is a visual mockup. No offer is sent or saved.</span></div>
          <button className="mm-button mm-button--primary" onClick={() => { setCounterOpen(false); setNotice(`Sample offer of £${stake || "0.00"} proposed to ${counterName}. No match has started.`); }}>Show sample offer <ArrowRight size={15} /></button>
        </section>
      </div>}
    </main>
  );
}
