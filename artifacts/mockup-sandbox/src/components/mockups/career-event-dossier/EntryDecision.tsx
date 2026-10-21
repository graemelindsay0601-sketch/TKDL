import { useState } from "react";
import {
  ArrowDownRight, ArrowRight, CalendarDays, Check, ChevronRight, CircleDollarSign,
  MapPin, ShieldCheck, Ticket, Trophy,
} from "lucide-react";
import "./_group.css";

const PLATE = "/__mockup/images/career-venues/career-venue-major-arena.jpg";

const money = (pence: number) =>
  `£${(pence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: Number.isInteger(pence / 100) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

export function EntryDecision() {
  const [entered, setEntered] = useState(false);
  const fieldPercent = (84 / 96) * 100;
  const viabilityPercent = (64 / 96) * 100;

  return (
    <main className="edd-shell">
      <style>{`
        .edd-shell {
          --edd-ink: #f3f1e9;
          --edd-muted: #aab5bc;
          --edd-dim: #71818a;
          --edd-line: rgba(218, 228, 225, .13);
          --edd-card: #14242b;
          --edd-deep: #0c171c;
          --edd-gold: #e6bf68;
          --edd-mint: #8bd9b3;
          --edd-red: #d74763;
          min-height: 100dvh;
          padding: 28px clamp(14px, 3vw, 44px) 38px;
          color: var(--edd-ink);
          background:
            radial-gradient(ellipse at 92% 6%, rgba(210, 165, 74, .12), transparent 32%),
            linear-gradient(145deg, #14242b 0%, #0b151a 70%);
          font-family: "Space Grotesk", "Trebuchet MS", sans-serif;
        }
        .edd-shell * { box-sizing: border-box; }
        .edd-shell button, .edd-shell a { font: inherit; }
        .edd-shell a:focus-visible, .edd-shell button:focus-visible {
          outline: 3px solid #f1d27c; outline-offset: 3px;
        }
        .edd-wrap { width: min(1120px, 100%); margin: 0 auto; }
        .edd-topline {
          display:flex; align-items:center; justify-content:space-between; gap:16px;
          padding-bottom:14px; border-bottom:1px solid var(--edd-line);
          color:#d6c17f; font:600 10px "DM Mono",monospace; letter-spacing:.14em;
        }
        .edd-topline span:last-child { color:#91a0a7; letter-spacing:.08em; }
        .edd-hero {
          position:relative; display:grid; grid-template-columns:minmax(0,1fr) 270px;
          min-height:238px; align-items:end; gap:28px; overflow:hidden;
          margin-top:18px; border:1px solid rgba(231,195,110,.22); border-radius:12px;
          padding:30px 32px; isolation:isolate;
          background:#10202a;
        }
        .edd-hero img {
          position:absolute; z-index:-2; inset:0; width:100%; height:100%;
          object-fit:cover; object-position:center 48%; filter:saturate(.72) brightness(.68);
        }
        .edd-hero::after {
          position:absolute; z-index:-1; inset:0; content:"";
          background:linear-gradient(90deg,rgba(7,15,20,.96) 0%,rgba(9,19,25,.84) 49%,rgba(8,17,21,.25) 100%),
            linear-gradient(0deg,rgba(7,14,17,.72),transparent 55%);
        }
        .edd-hero-copy { min-width:0; }
        .edd-eyebrow { color:var(--edd-gold); font:600 10px "DM Mono",monospace; letter-spacing:.16em; }
        .edd-hero h1 {
          max-width:650px; margin:12px 0 10px; color:#faf8f0;
          font:700 clamp(42px,6.5vw,78px)/.91 "Oswald",sans-serif;
          letter-spacing:.005em; text-transform:uppercase;
        }
        .edd-circuit { margin:0; color:#c4ced1; font-size:13px; }
        .edd-hero-side {
          align-self:stretch; display:flex; flex-direction:column; justify-content:space-between;
          border-left:1px solid rgba(255,255,255,.21); padding:4px 0 2px 22px;
        }
        .edd-hero-side small, .edd-label {
          color:#a3b0b4; font:600 9px "DM Mono",monospace; letter-spacing:.11em;
          text-transform:uppercase;
        }
        .edd-season { display:flex; align-items:baseline; gap:8px; margin-top:7px; }
        .edd-season strong { color:#f3d482; font:600 38px/1 "Oswald",sans-serif; }
        .edd-season span { color:#c2ccd0; font:500 11px "DM Mono",monospace; }
        .edd-venue-line { display:flex; gap:9px; align-items:flex-start; color:#f0f2ec; font-size:12px; }
        .edd-venue-line svg { flex:none; color:var(--edd-gold); }
        .edd-venue-line span { display:flex; flex-direction:column; gap:3px; }
        .edd-venue-line small { color:#aeb9bd; font:400 10px "Space Grotesk",sans-serif; letter-spacing:0; text-transform:none; }
        .edd-main-grid {
          display:grid; grid-template-columns:minmax(0,1.35fr) minmax(320px,.8fr);
          gap:16px; align-items:start; margin-top:16px;
        }
        .edd-left, .edd-right { display:grid; gap:16px; min-width:0; }
        .edd-panel {
          min-width:0; border:1px solid var(--edd-line); border-radius:10px;
          background:linear-gradient(145deg,rgba(21,39,47,.98),rgba(12,24,30,.98));
        }
        .edd-entry { padding:20px 22px 18px; }
        .edd-entry-head { display:flex; align-items:flex-start; justify-content:space-between; gap:15px; }
        .edd-entry-head h2 { margin:7px 0 0; color:#f6f4ec; font:600 24px/1.05 "Oswald",sans-serif; text-transform:uppercase; }
        .edd-open {
          display:inline-flex; align-items:center; gap:7px; flex:none; border:1px solid rgba(139,217,179,.34);
          border-radius:4px; padding:7px 9px; background:rgba(139,217,179,.09);
          color:#a9e7c6; font:600 9px "DM Mono",monospace; letter-spacing:.04em; text-transform:uppercase;
        }
        .edd-open i { width:7px; height:7px; border-radius:50%; background:#8bd9b3; }
        .edd-entry-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:21px; }
        .edd-window { border-left:2px solid var(--edd-gold); padding-left:12px; }
        .edd-window strong { display:block; margin:7px 0 4px; color:#f4d786; font:600 27px/1 "Oswald",sans-serif; }
        .edd-window span { color:#a8b7bc; font-size:11px; }
        .edd-eligible { display:flex; align-items:center; gap:10px; }
        .edd-check {
          display:grid; width:36px; height:36px; flex:none; place-items:center;
          border:1px solid rgba(139,217,179,.32); border-radius:50%;
          background:rgba(139,217,179,.1); color:var(--edd-mint);
        }
        .edd-eligible span { display:flex; flex-direction:column; gap:3px; }
        .edd-eligible strong { color:#d8f1e3; font:600 14px "Oswald",sans-serif; text-transform:uppercase; }
        .edd-eligible small { color:#9babb0; font-size:10px; }
        .edd-field { padding:19px 22px 20px; }
        .edd-panel-title { display:flex; align-items:baseline; justify-content:space-between; gap:10px; }
        .edd-panel-title h3 { margin:0; color:#e4e9e5; font:600 14px "Oswald",sans-serif; letter-spacing:.06em; text-transform:uppercase; }
        .edd-panel-title span { color:#a3b1b6; font:500 9px "DM Mono",monospace; }
        .edd-field-figure { display:flex; align-items:baseline; gap:8px; margin-top:15px; }
        .edd-field-figure strong { color:#f4d583; font:600 46px/.9 "Oswald",sans-serif; letter-spacing:-.025em; }
        .edd-field-figure span { color:#90a1a8; font:500 15px "DM Mono",monospace; }
        .edd-meter { position:relative; height:9px; margin:13px 0 10px; border-radius:9px; background:#283a40; }
        .edd-meter-filled { position:absolute; inset:0 auto 0 0; width:${fieldPercent}%; border-radius:9px; background:linear-gradient(90deg,#cda854,#f0d987); }
        .edd-meter-min { position:absolute; top:-4px; bottom:-4px; left:${viabilityPercent}%; width:1px; background:#dce5dc; }
        .edd-meter-min::before { position:absolute; top:-5px; left:-3px; width:7px; height:7px; border:1px solid #e2e9df; border-radius:50%; background:#14242b; content:""; }
        .edd-meter-legend { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; color:#9baab0; font-size:10px; }
        .edd-meter-legend span { display:flex; align-items:center; gap:7px; }
        .edd-legend-dot { width:7px; height:7px; border-radius:50%; background:#e7c96f; }
        .edd-legend-mark { width:2px; height:11px; background:#dce5dc; }
        .edd-ready { display:flex; align-items:center; gap:7px; margin-top:15px; border-top:1px solid var(--edd-line); padding-top:12px; color:#aee2c6; font-size:11px; }
        .edd-ready svg { flex:none; }
        .edd-cost { overflow:hidden; border-color:rgba(230,191,104,.27); }
        .edd-cost-top { padding:20px 22px 17px; background:linear-gradient(120deg,rgba(226,187,94,.13),transparent 75%); }
        .edd-cost-title { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .edd-cost-title span { display:flex; align-items:center; gap:8px; color:#d6c17f; font:600 10px "DM Mono",monospace; letter-spacing:.11em; }
        .edd-cost-title small { color:#83939a; font:500 9px "DM Mono",monospace; }
        .edd-cost-number { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-top:15px; }
        .edd-cost-number > div { display:flex; flex-direction:column; gap:3px; }
        .edd-cost-number small { color:#a5b1b4; font-size:10px; }
        .edd-cost-number strong { color:#f3d584; font:600 clamp(38px,4vw,52px)/.94 "Oswald",sans-serif; }
        .edd-cost-number em { color:#9babb0; font-size:10px; font-style:normal; text-align:right; }
        .edd-cost-content { padding:14px 22px 17px; }
        .edd-cost-content .edd-label { display:block; margin-bottom:10px; }
        .edd-money-line { display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,.055); color:#aab7ba; font-size:10px; }
        .edd-money-line strong { color:#e1e7e3; font:500 11px "DM Mono",monospace; text-align:right; }
        .edd-money-line small { min-width:70px; color:#83d4aa; font-size:9px; text-align:right; }
        .edd-cost-total { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:10px; color:#bfccca; font-size:10px; }
        .edd-cost-total strong { color:#a6e5c2; font:600 15px "Oswald",sans-serif; }
        .edd-prize {
          display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; gap:10px;
          padding:18px 22px; background:#1a2b31;
        }
        .edd-prize-label { color:#a9b7b7; font:600 9px "DM Mono",monospace; letter-spacing:.1em; }
        .edd-prize strong { display:block; margin-top:7px; color:#f0d27d; font:600 36px/.95 "Oswald",sans-serif; }
        .edd-prize-detail { align-self:center; text-align:right; }
        .edd-prize-detail span { display:block; color:#dce3df; font-size:10px; }
        .edd-prize-detail small { display:block; margin-top:4px; color:#91a2a4; font-size:9px; }
        .edd-format { display:grid; grid-template-columns:68px minmax(0,1fr) auto; align-items:center; gap:14px; padding:15px 18px; }
        .edd-score { color:#f2d583; font:600 40px/.9 "Oswald",sans-serif; }
        .edd-format-copy { display:flex; min-width:0; flex-direction:column; gap:4px; }
        .edd-format-copy small { color:#9aabb0; font:600 9px "DM Mono",monospace; letter-spacing:.08em; }
        .edd-format-copy strong { color:#e7ece7; font-size:12px; }
        .edd-format-copy span { color:#94a5aa; font-size:10px; }
        .edd-format-side { border-left:1px solid var(--edd-line); padding-left:13px; color:#a6b4b7; font:500 9px "DM Mono",monospace; text-align:center; }
        .edd-format-side strong { display:block; color:#e6cc82; font:600 19px "Oswald",sans-serif; }
        .edd-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:1px; }
        .edd-button {
          display:inline-flex; min-height:48px; align-items:center; justify-content:center; gap:9px;
          border:1px solid transparent; border-radius:5px; padding:0 16px;
          text-decoration:none; font:600 10px "DM Mono",monospace; letter-spacing:.04em;
          transition:transform .18s ease,background-color .18s ease,border-color .18s ease;
        }
        .edd-button:hover { transform:translateY(-2px); }
        .edd-primary { flex:1 1 210px; background:linear-gradient(110deg,#d64b67,#b42c4b); color:white; }
        .edd-primary:hover:not(:disabled) { background:#e25470; }
        .edd-primary:disabled { cursor:default; opacity:.8; }
        .edd-secondary { flex:0 0 auto; border-color:var(--edd-line); background:rgba(255,255,255,.035); color:#d7dfdc; }
        .edd-notes { display:flex; gap:9px; align-items:flex-start; color:#b4c0be; font-size:10px; line-height:1.5; }
        .edd-notes svg { flex:none; color:var(--edd-gold); }
        .edd-hidden-details { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
        @media (max-width:760px) {
          .edd-shell { padding:18px 14px 28px; }
          .edd-hero { grid-template-columns:1fr; min-height:290px; gap:20px; padding:23px; }
          .edd-hero::after { background:linear-gradient(0deg,rgba(7,15,20,.96),rgba(9,19,25,.5) 75%,rgba(8,17,21,.2)); }
          .edd-hero-side { flex-direction:row; align-items:flex-end; gap:16px; border-left:0; border-top:1px solid rgba(255,255,255,.2); padding:12px 0 0; }
          .edd-main-grid {
            grid-template-columns:minmax(0,1fr);
            grid-template-areas:"entry" "field" "format" "cost" "prize" "actions" "pathway" "date";
          }
          .edd-left, .edd-right { display:contents; }
          .edd-entry { grid-area:entry; }
          .edd-field { grid-area:field; }
          .edd-format { grid-area:format; }
          .edd-cost { grid-area:cost; }
          .edd-prize { grid-area:prize; }
          .edd-actions { grid-area:actions; }
          .edd-pathway-note { grid-area:pathway; }
          .edd-date-note { grid-area:date; }
          .edd-format { grid-template-columns:52px minmax(0,1fr); }
          .edd-format-side { grid-column:2; justify-self:start; border:0; padding:0; text-align:left; }
        }
        @media (max-width:520px) {
          .edd-topline { font-size:8px; }
          .edd-topline span:last-child { text-align:right; }
          .edd-hero { min-height:265px; padding:18px; }
          .edd-hero h1 { font-size:clamp(38px,12vw,58px); }
          .edd-circuit { font-size:11px; }
          .edd-season strong { font-size:31px; }
          .edd-venue-line { max-width:46%; font-size:10px; }
          .edd-entry { padding:17px; }
          .edd-entry-head { flex-direction:column; }
          .edd-entry-head h2 { font-size:21px; }
          .edd-entry-grid { gap:10px; }
          .edd-window strong { font-size:22px; }
          .edd-eligible { gap:7px; }
          .edd-eligible strong { font-size:12px; }
          .edd-eligible small { font-size:9px; }
          .edd-field { padding:17px; }
          .edd-panel-title { align-items:flex-start; flex-direction:column; gap:5px; }
          .edd-field-figure strong { font-size:40px; }
          .edd-right { grid-template-columns:1fr; }
          .edd-cost-top, .edd-cost-content { padding-inline:17px; }
          .edd-prize { padding-inline:17px; }
          .edd-format { grid-template-columns:54px minmax(0,1fr) auto; }
          .edd-format-side { grid-column:auto; justify-self:auto; border-left:1px solid var(--edd-line); padding-left:10px; text-align:center; }
          .edd-actions { display:grid; grid-template-columns:1fr; }
          .edd-secondary, .edd-primary { width:100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .edd-button { transition:none; }
          .edd-button:hover { transform:none; }
        }
        /* Midnight navy with restrained red and gold accents. */
        .edd-shell {
          --edd-ink:#f3efe6;
          --edd-muted:#b7afa3;
          --edd-dim:#8c857a;
          --edd-line:rgba(202,216,238,.17);
          --edd-card:#18243a;
          --edd-deep:#0d1728;
          --edd-gold:#e0bd64;
          --edd-mint:#a1c9a3;
          --edd-red:#b6384c;
          color:#f3efe6;
          background:radial-gradient(ellipse at 92% 6%,#d5aa451c,transparent 32%),linear-gradient(145deg,#18263e,#0b1423 70%);
        }
        .edd-topline { color:#ddbd70; border-color:#d4def02a; }
        .edd-topline span:last-child { color:#aeb9ca; }
        .edd-hero { border-color:#d7bc735c; background:#0d1728; }
        .edd-hero img { filter:saturate(.8) brightness(.68); }
        .edd-hero::after {
          background:linear-gradient(90deg,rgba(8,8,7,.95) 0%,rgba(9,9,8,.78) 49%,rgba(8,8,7,.2) 100%),linear-gradient(0deg,rgba(8,8,7,.74),transparent 55%);
        }
        .edd-hero h1 { color:#fff8e9; }
        .edd-circuit { color:#d7d0c4; }
        .edd-hero-side { border-color:#fff8e936; }
        .edd-hero-side small,.edd-label { color:#b2a995; }
        .edd-season strong { color:#e4c56f; }
        .edd-season span { color:#ddd4c6; }
        .edd-venue-line { color:#f5eedf; }
        .edd-venue-line small { color:#c9c0b2; }
        .edd-panel {
          border-color:#d4def022;
          background:linear-gradient(145deg,#1a2941,#111d32);
          color:#f3efe6;
          box-shadow:0 8px 24px #00000026;
        }
        .edd-entry-head h2,.edd-panel-title h3,.edd-format-copy strong { color:#f1eee5; }
        .edd-open { border-color:#a1c9a34f; background:#a1c9a311; color:#b7d9b7; }
        .edd-open i { background:#a1c9a3; }
        .edd-window strong,.edd-field-figure strong,.edd-score { color:#e0bd64; }
        .edd-window span,.edd-eligible small,.edd-panel-title span { color:#b7afa3; }
        .edd-check { border-color:#a1c9a34a; background:#a1c9a314; color:#a1c9a3; }
        .edd-eligible strong { color:#d9e9d7; }
        .edd-meter { background:#354258; }
        .edd-meter-filled { background:linear-gradient(90deg,#b6384c,#e0bd64); }
        .edd-meter-min { background:#eee6d7; }
        .edd-meter-min::before { border-color:#eee6d7; background:#18243a; }
        .edd-meter-legend { color:#b7afa3; }
        .edd-legend-dot { background:#c44858; }
        .edd-legend-mark { background:#eee6d7; }
        .edd-ready { border-color:#d4def022; color:#b7d9b7; }
        .edd-cost { border-color:#b9974f69; }
        .edd-cost-top { background:linear-gradient(120deg,#ddbd6420,#d5e1f008); }
        .edd-cost-title span { color:#dfc26f; }
        .edd-cost-title small,.edd-cost-number small,.edd-cost-number em { color:#b7afa3; }
        .edd-cost-number strong { color:#e6c66f; }
        .edd-cost-content .edd-label { color:#b7afa3; }
        .edd-money-line { border-color:#eee6d70e; color:#c0b8ac; }
        .edd-money-line strong { color:#f1eee5; }
        .edd-money-line small,.edd-cost-total strong { color:#b7d9b7; }
        .edd-cost-total { color:#c0b8ac; }
        .edd-prize { background:#22314a; }
        .edd-prize-label,.edd-format-copy small,.edd-format-side { color:#b7afa3; }
        .edd-prize strong { color:#e0bd64; }
        .edd-prize-detail span { color:#f1eee5; }
        .edd-prize-detail small,.edd-format-copy span { color:#b7afa3; }
        .edd-format-side { border-color:#d4def022; }
        .edd-format-side strong { color:#e0bd64; }
        .edd-primary { background:linear-gradient(110deg,#c13b50,#992c3e); color:#fff8e9; }
        .edd-primary:hover:not(:disabled) { background:#d04a5e; }
        .edd-secondary { border-color:#d4def04a; background:#ffffff08; color:#f0e9dc; }
        .edd-notes { color:#b7afa3; }
        .edd-notes svg { color:#e0bd64; }
      `}</style>
      <div className="edd-wrap" id="event-dossier">
        <header className="edd-topline">
          <span>TKDL / CAREER / EVENT DOSSIER</span>
          <span>DECISION DESK&nbsp; · &nbsp;WORLD TIER</span>
        </header>

        <section className="edd-hero" aria-labelledby="edd-event-title">
          <img src={PLATE} alt="" loading="lazy" decoding="async" />
          <div className="edd-hero-copy">
            <span className="edd-eyebrow">PDC WORLD CHAMPIONSHIP</span>
            <h1 id="edd-event-title">World<br />Championship</h1>
            <p className="edd-circuit">Qualifiers and the world’s leading players. One stage. The Sid Waddell Trophy.</p>
          </div>
          <div className="edd-hero-side">
            <div>
              <small>SEASON / EVENT WEEKS</small>
              <div className="edd-season"><strong>2032</strong><span>W49—50</span></div>
            </div>
            <div className="edd-venue-line">
              <MapPin size={17} aria-hidden="true" />
              <span>Alexandra Palace<small>London, England · United Kingdom</small></span>
            </div>
          </div>
        </section>

        <div className="edd-main-grid">
          <div className="edd-left">
            <section className="edd-panel edd-entry" aria-labelledby="edd-entry-title">
              <div className="edd-entry-head">
                <div>
                  <span className="edd-label">Your decision</span>
                  <h2 id="edd-entry-title">You’re clear to enter.</h2>
                </div>
                <span className="edd-open"><i aria-hidden="true" /> Registration open</span>
              </div>
              <div className="edd-entry-grid">
                <div className="edd-window">
                  <span className="edd-label">Registration closes</span>
                  <strong>WEEK 46</strong>
                  <span>Opens week 42 · event begins week 49</span>
                </div>
                <div className="edd-eligible">
                  <span className="edd-check"><Check size={18} aria-hidden="true" /></span>
                  <span><strong>Qualified · eligible</strong><small>Eligibility confirmed for this event</small></span>
                </div>
              </div>
            </section>

            <section className="edd-panel edd-field" aria-labelledby="edd-field-title">
              <div className="edd-panel-title">
                <h3 id="edd-field-title">Field readiness</h3>
                <span>CONFIRMED TO RUN</span>
              </div>
              <div className="edd-field-figure">
                <strong>84</strong><span>/ 96</span>
              </div>
              <div className="edd-meter" role="img" aria-label="84 of 96 places filled. The 64 entrant minimum is met.">
                <span className="edd-meter-filled" />
                <span className="edd-meter-min" />
              </div>
              <div className="edd-meter-legend">
                <span><i className="edd-legend-dot" />84 entrants</span>
                <span><i className="edd-legend-mark" />64 minimum to run</span>
                <span>96 capacity</span>
              </div>
              <div className="edd-ready"><ShieldCheck size={16} aria-hidden="true" /> Field confirmed · minimum met</div>
            </section>

            <section className="edd-panel edd-format" aria-label="Tournament format">
              <strong className="edd-score">501</strong>
              <div className="edd-format-copy">
                <small>TOURNAMENT FORMAT</small>
                <strong>Knockout · best of 5–13 sets</strong>
                <span>Set play · 12 days</span>
              </div>
              <div className="edd-format-side"><strong>1</strong>per side</div>
            </section>

            <div className="edd-actions">
              <button
                type="button"
                className="edd-button edd-primary"
                disabled={entered}
                onClick={() => setEntered(true)}
                aria-label={entered ? "Entry confirmed" : "Enter the World Championship for an estimated player cost of £185"}
              >
                {entered ? <Check size={17} aria-hidden="true" /> : <Ticket size={17} aria-hidden="true" />}
                {entered ? "Entry confirmed" : "Enter · £185"}
                {!entered && <ArrowRight size={16} aria-hidden="true" />}
              </button>
              <a className="edd-button edd-secondary" href="#event-dossier">
                Full event details <ChevronRight size={15} aria-hidden="true" />
              </a>
            </div>
            <div className="edd-notes edd-pathway-note">
              <Trophy size={16} aria-hidden="true" />
              <span>World Championship pathway confirmed. Quarter-finalists receive {money(30_000)}; estimated player cost is recovered at that finish.</span>
            </div>
          </div>

          <div className="edd-right">
            <section className="edd-panel edd-cost" aria-labelledby="edd-cost-title">
              <div className="edd-cost-top">
                <div className="edd-cost-title">
                  <span id="edd-cost-title"><CircleDollarSign size={16} aria-hidden="true" /> COST AFTER SPONSOR</span>
                  <small>ESTIMATE</small>
                </div>
                <div className="edd-cost-number">
                  <div><small>Estimated player cost</small><strong>{money(18_500)}</strong></div>
                  <em>£90 sponsor<br />contribution</em>
                </div>
              </div>
              <div className="edd-cost-content">
                <span className="edd-label">Cost breakdown <span className="edd-hidden-details"> · cost / sponsor / you pay</span></span>
                <div className="edd-money-line"><span>Entry fee</span><strong>{money(12_000)}</strong><small>−{money(0)} covered</small></div>
                <div className="edd-money-line"><span>Travel estimate</span><strong>{money(3_500)}</strong><small>−{money(2_500)} covered</small></div>
                <div className="edd-money-line"><span>Accommodation</span><strong>{money(12_000)}</strong><small>−{money(6_500)} covered</small></div>
                <div className="edd-cost-total"><span>After sponsor contribution</span><strong>{money(18_500)}</strong></div>
              </div>
            </section>
            <section className="edd-panel edd-prize" aria-label="Reward and ranking">
              <div>
                <span className="edd-prize-label">TOP PRIZE</span>
                <strong>{money(500_000)}</strong>
              </div>
              <div className="edd-prize-detail">
                <span>Ranking event</span>
                <small>Quarter-final: {money(30_000)}</small>
              </div>
            </section>
            <div className="edd-notes edd-date-note">
              <CalendarDays size={15} aria-hidden="true" />
              <span>Season 2032 · week 49–50 · London</span>
              <ArrowDownRight size={15} aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
