import { useState } from "react";
import { CalendarDays, MapPin, Star, Trophy } from "lucide-react";
import { CareerNavigation } from "./CareerNavigation";
import "./_group.css";

const stops = [
  { town: "Nottingham", day: "Wednesday", name: "Rook Calder", rank: 1, average: "96.4", fee: "£12", travel: "£0", prize: "£35" },
  { town: "Derby", day: "Friday", name: "Mara Vale", rank: 4, average: "94.1", fee: "£10", travel: "£4", prize: "£30" },
  { town: "Sheffield", day: "Saturday", name: "Ivo Crane", rank: 6, average: "92.8", fee: "£12", travel: "£6", prize: "£35" },
];

export function CurrentProAm() {
  const [booked, setBooked] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  return <main className="career-root proam-current">
    <CareerNavigation />
    <header className="proam-current__hero">
      <div><p>NIGHTS OUT <span>·</span> EXHIBITION CIRCUIT</p><h1>Pro-Am nights</h1>
        <p>One leg under the club lights. Meet a touring name, take your shot, and make the result count.</p></div>
      <div className="proam-current__badge">PRO<Star size={16} fill="currentColor" />AM</div>
    </header>
    <section className="proam-current__board">
      <div className="proam-current__board-title"><span>EXHIBITION CIRCUIT · WEEK 18</span><h2>A shot at the touring pros</h2></div>
      <div className="proam-current__stats"><div><small>AVAILABLE</small><b>£182</b></div><div><small>YOUR ROLE</small><b>Challenger</b></div><div><small>STOPS THIS WEEK</small><b>3</b></div></div>
    </section>
    <p className="proam-current__intro">You throw first. Pay for a slot; beat the pro and the organiser pays you a prize.</p>
    {booked ? <section className="proam-current__booked"><b>Your slot is booked</b><span>{booked} · Wednesday</span>
      <div><button onClick={() => setNotice("Your leg is ready to play.")}>Throw your leg</button><button onClick={() => setNotice("Quick simulation complete.")}>Quick-sim it</button></div>
      {notice && <small role="status">{notice}</small>}</section> : null}
    <section className="proam-current__stops"><h2>This week’s exhibition stops</h2><div className="proam-current__grid">
      {stops.map((stop, i) => <article key={stop.town} className={i === 0 ? "is-featured" : ""}>
        <div className="proam-current__place"><span><MapPin size={13} /> {stop.town}</span><small><CalendarDays size={13} /> {stop.day}</small></div>
        <small className="proam-current__eyebrow">YOUR OPPONENT</small><h3>{stop.name}</h3><p>World no. {stop.rank} <span>·</span> {stop.average} match average</p>
        <dl><div><dt>Slot fee</dt><dd>{stop.fee}</dd></div><div><dt>Travel</dt><dd>{stop.travel}</dd></div><div><dt>Prize</dt><dd>{stop.prize}</dd></div></dl>
        <button disabled={!!booked} onClick={() => setBooked(stop.town)}>{booked ? "Slot selected" : `Take a slot · ${stop.fee}`}</button>
      </article>)}
    </div></section>
    <footer className="proam-current__record"><Trophy size={17} /><span>CAREER RECORD</span><b>No Pro-Am legs yet</b><small>Pros beaten 0 · Prize money £0</small></footer>
    <style>{`
      .proam-current { color:#e9f0f8; }
      .proam-current__hero { display:flex; justify-content:space-between; align-items:center; gap:24px; margin:18px 0; padding:30px 34px; border:1px solid #d9b96f3a; border-radius:15px; background:linear-gradient(120deg,#1b2d41,#101a27 70%,#241b22); box-shadow:0 16px 34px #0007,inset 0 1px #ffffff14; }
      .proam-current__hero p { max-width:65ch; color:#b8c3d0; font-size:.83rem; line-height:1.5; margin:7px 0 0; }
      .proam-current__hero p:first-child { color:#e6c46e; font:700 .63rem Oswald,sans-serif; letter-spacing:.16em; }
      .proam-current__hero h1 { margin:5px 0; color:#fff; font:800 clamp(2rem,4vw,3.1rem)/.98 Oswald,sans-serif; text-transform:uppercase; }
      .proam-current__hero p span { color:#d83c61; }
      .proam-current__badge { display:grid; grid-template-columns:auto auto; align-items:center; justify-items:center; gap:2px 5px; padding:17px; border:1px solid #e7c87970; border-radius:50%; color:#e7c879; font:800 .78rem Oswald,sans-serif; box-shadow:0 7px 0 #070c13,0 9px 20px #0008,inset 0 1px #fff2; }
      .proam-current__badge svg { grid-row:span 2; color:#d83c61; }
      .proam-current__board { display:grid; grid-template-columns:1fr auto; align-items:center; gap:18px; padding:18px 20px; border:1px solid #d9b96f3a; background:linear-gradient(115deg,#172638,#101925); box-shadow:0 10px 22px #0005,inset 0 1px #fff1; }
      .proam-current__board-title > span,.proam-current__stats small { color:#9aaaba; font:700 .56rem Oswald,sans-serif; letter-spacing:.12em; }
      .proam-current__board h2 { margin:5px 0 0; color:#f5f7fa; font:700 1.35rem Oswald,sans-serif; text-transform:uppercase; }
      .proam-current__stats { display:flex; gap:0; }
      .proam-current__stats div { display:grid; gap:4px; min-width:105px; padding:4px 12px; border-left:1px solid #ffffff20; }
      .proam-current__stats b { color:#f1d486; font:700 1rem Oswald,sans-serif; }
      .proam-current__intro { margin:13px 0; color:#b6c1cd; font-size:.8rem; }
      .proam-current__stops { padding:17px; border:1px solid #ffffff16; border-radius:14px; background:#0e1722; }
      .proam-current__stops > h2 { margin:0 0 14px; color:#e8c879; font:700 .7rem Oswald,sans-serif; letter-spacing:.14em; text-transform:uppercase; }
      .proam-current__grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
      .proam-current__grid article { min-width:0; padding:16px; border:1px solid #ffffff18; border-radius:9px; background:linear-gradient(145deg,#192737,#101a26); box-shadow:0 8px 18px #0004,inset 0 1px #fff1; }
      .proam-current__grid article.is-featured { border-color:#d9b96f66; }
      .proam-current__place { display:flex; justify-content:space-between; gap:7px; color:#d5c183; font:600 .61rem Oswald,sans-serif; letter-spacing:.06em; text-transform:uppercase; }
      .proam-current__place span,.proam-current__place small { display:flex; align-items:center; gap:4px; }
      .proam-current__place small { color:#9eacb9; font:600 .58rem Oswald,sans-serif; }
      .proam-current__eyebrow { display:block; margin-top:18px; color:#8e9eae; font:700 .52rem Oswald,sans-serif; letter-spacing:.12em; }
      .proam-current__grid h3 { margin:4px 0; color:#f3f6f9; font:700 1.2rem Oswald,sans-serif; }
      .proam-current__grid p { margin:0; color:#a9b5c0; font-size:.69rem; }
      .proam-current__grid dl { display:grid; grid-template-columns:repeat(3,1fr); margin:16px 0; border:1px solid #ffffff14; background:#080f17; }
      .proam-current__grid dl div { padding:8px; border-right:1px solid #ffffff12; }
      .proam-current__grid dt { color:#9ba9b7; font-size:.57rem; }
      .proam-current__grid dd { margin:4px 0 0; color:#f1d486; font:700 .98rem Oswald,sans-serif; }
      .proam-current__grid button,.proam-current__booked button { width:100%; min-height:40px; border:0; border-radius:5px; background:#e5c36c; color:#111722; font:700 .68rem Oswald,sans-serif; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
      .proam-current__grid button:disabled { opacity:.5; }
      .proam-current__record { display:flex; align-items:center; gap:12px; margin-top:14px; padding:12px 15px; border:1px solid #ffffff14; color:#d4bd7a; background:#0e1722; }
      .proam-current__record span { color:#9aaaba; font:700 .59rem Oswald,sans-serif; letter-spacing:.12em; }
      .proam-current__record b { color:#e8edf2; font-size:.76rem; }
      .proam-current__record small { margin-left:auto; color:#98a7b5; font-size:.68rem; }
      .proam-current__booked { display:grid; gap:9px; margin:12px 0; padding:14px; border:1px solid #d9b96f66; background:#d9b96f12; }
      .proam-current__booked > div { display:flex; gap:8px; }
      .proam-current__booked button { width:auto; padding:0 14px; }
      @media(max-width:760px){ .proam-current__hero{padding:22px;}.proam-current__grid{grid-template-columns:1fr;}.proam-current__board{grid-template-columns:1fr}.proam-current__stats div:first-child{border-left:0;padding-left:0}.proam-current__record{flex-wrap:wrap}.proam-current__record small{margin-left:0;width:100%} }
      @media(max-width:480px){ .proam-current{padding-inline:12px}.proam-current__hero{align-items:flex-start;padding:20px}.proam-current__badge{padding:12px;font-size:.62rem}.proam-current__stats div{min-width:0;flex:1;padding:4px 7px}.proam-current__stats b{font-size:.8rem}.proam-current__stats small{font-size:.46rem}.proam-current__grid article{padding:13px} }
    `}</style>
  </main>;
}
