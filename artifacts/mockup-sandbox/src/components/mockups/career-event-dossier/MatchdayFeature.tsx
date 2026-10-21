import { useState } from "react";
import {
  ChevronRight,
  CircleDollarSign,
  MapPin,
  ShieldCheck,
  Ticket,
  Trophy,
} from "lucide-react";
import "./_group.css";

const PLATE = "/__mockup/images/career-venues/career-venue-major-arena.jpg";
const money = (pence: number) =>
  `£${(pence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: Number.isInteger(pence / 100) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

export function MatchdayFeature() {
  const [entered, setEntered] = useState(false);

  return (
    <main className="mf-page">
      <article className="mf-dossier" id="event-dossier" aria-label="Selected event details">
        <header className="mf-masthead">
          <span className="mf-brand">TKDL <i>·</i> CAREER TOUR</span>
          <span className="mf-edition">THE SEASON FINALE <b>2032</b></span>
        </header>

        <section className="mf-hero">
          <img className="mf-hero-image" src={PLATE} alt="" />
          <div className="mf-image-shade" />
          <div className="mf-hero-meta">
            <span><Trophy size={14} /> WORLD CHAMPIONSHIP</span>
            <span>SEASON FINALE <b>·</b> FEATURED</span>
          </div>
          <div className="mf-hero-copy">
            <p className="mf-overline">PDC WORLD CHAMPIONSHIP <span>·</span> SEASON 2032</p>
            <h1>World<br /><em>Championship</em></h1>
            <p className="mf-deck">The season’s defining stage.<br />The Sid Waddell Trophy, at Alexandra Palace.</p>
          </div>
          <div className="mf-date-stamp" aria-label="Event weeks 49 to 50">
            <small>SEASON 2032</small><strong>49</strong><span>— 50</span><small>WORLD CHAMPIONSHIP</small>
          </div>
          <div className="mf-hero-venue">
            <MapPin size={17} aria-hidden="true" />
            <span><small>THE VENUE · LONDON</small><strong>Alexandra Palace</strong><em>England, United Kingdom · 12 days</em></span>
          </div>
          <div className="mf-hero-live"><span className="mf-live-dot" /><span><small>ENTRY</small><strong>{entered ? "CONFIRMED" : "QUALIFIED · OPEN"}</strong></span></div>
        </section>

        <div className="mf-main-grid">
          <section className="mf-timeline" aria-label="Registration and event timeline">
            <div className="mf-timeline-heading">
              <span className="mf-section-index">THE ROAD TO THE STAGE</span>
              <span className="mf-timeline-caption">SEASON 2032</span>
            </div>
            <div className="mf-timeline-track">
              <div className="mf-timeline-line" aria-hidden="true"><i /><b /></div>
              <div className="mf-milestone">
                <span className="mf-milestone-dot">42</span>
                <small>REGISTRATION</small>
                <strong>Opens</strong>
              </div>
              <div className="mf-milestone">
                <span className="mf-milestone-dot">46</span>
                <small>ENTRY WINDOW</small>
                <strong>Closes</strong>
              </div>
              <div className="mf-milestone mf-milestone-final">
                <span className="mf-milestone-dot"><Trophy size={16} /></span>
                <small>WEEKS 49–50</small>
                <strong>The world stage</strong>
              </div>
            </div>
          </section>

          <section className="mf-stakes">
          <div className="mf-field">
            <div className="mf-compact-label"><span>FIELD CONFIRMED</span><span>01 / 03</span></div>
            <div className="mf-field-visual">
              <div className="mf-field-ring" role="img" aria-label="84 entrants out of 96 capacity; 64 entrants required to run">
                <div className="mf-ring-copy"><strong>84</strong><span>OF 96</span></div>
              </div>
              <div className="mf-field-copy">
                <small>ENTRANTS / CAPACITY</small>
                <strong>Field confirmed</strong>
                <div className="mf-threshold">
                  <span className="mf-threshold-bar"><i /></span>
                  <b aria-hidden="true" />
                  <span className="mf-threshold-label"><strong>64</strong><small>required to run</small></span>
                </div>
              </div>
            </div>
            <p className="mf-field-foot"><ShieldCheck size={14} /> 84 entrants · minimum field met</p>
          </div>
          <div className="mf-prize-feature">
            <div className="mf-prize-copy">
              <div className="mf-compact-label"><span>THE STAKES</span><span>02 / 03</span></div>
              <small>TOP PRIZE</small>
              <strong>{money(500_000)}</strong>
              <span className="mf-prize-trophy"><Trophy size={19} /> THE SID WADDELL TROPHY</span>
            </div>
            <div className="mf-format-feature">
              <div className="mf-compact-label"><span>THE FORMAT</span><span>03 / 03</span></div>
              <strong>501</strong>
              <span>KNOCKOUT</span>
              <small>Best of 5–13 sets<br />12 days · Ranking event</small>
            </div>
          </div>
          </section>
        </div>

        <section className="mf-entry">
          <div className="mf-entry-heading">
            <span className="mf-section-index">YOUR PLACE IN THE FIELD</span>
            <span className="mf-eligibility"><ShieldCheck size={15} /> ELIGIBLE</span>
          </div>
          <div className="mf-entry-grid">
            <div className="mf-player-state">
              <span className="mf-state-mark"><Ticket size={15} /></span>
              <span><small>YOUR ENTRY</small><strong>{entered ? "Entered" : "Qualified"}</strong></span>
              <span className="mf-open-tag">{entered ? "CONFIRMED" : "OPEN"}</span>
            </div>
            <div className="mf-player-state mf-confirmed">
              <span className="mf-state-mark"><ShieldCheck size={17} /></span>
              <span><small>WORLD CHAMPIONSHIP PATHWAY</small><strong>Eligibility confirmed</strong></span>
            </div>
          </div>
        </section>

        <section className="mf-cost">
          <div className="mf-cost-lead">
            <span className="mf-section-index">THE TRIP</span>
            <div className="mf-cost-title"><CircleDollarSign size={17} /><span>ESTIMATED PLAYER COST</span></div>
            <div className="mf-cost-totals">
              <div className="mf-player-total"><small>YOU PAY</small><strong className="mf-total">{money(18_500)}</strong></div>
              <div className="mf-sponsor-total"><small>SPONSOR COVERS</small><strong>{money(9_000)}</strong></div>
            </div>
            <span className="mf-cost-caption">PLAYER ESTIMATE AFTER COVERAGE</span>
            <div className="mf-prize-quick">
              <span><Trophy size={16} /> TOP PRIZE</span>
              <strong>{money(500_000)}</strong>
            </div>
          </div>
          <div className="mf-cost-breakdown">
            <div className="mf-cost-labels"><span>ESTIMATE</span><span>SPONSOR</span><span>YOU PAY</span></div>
            <div className="mf-cost-row"><span>Entry fee</span><b>{money(12_000)}</b><i>{money(0)}</i><strong>{money(12_000)}</strong></div>
            <div className="mf-cost-row"><span>Travel</span><b>{money(3_500)}</b><i>−{money(2_500)}</i><strong>{money(1_000)}</strong></div>
            <div className="mf-cost-row"><span>Accommodation</span><b>{money(12_000)}</b><i>−{money(6_500)}</i><strong>{money(5_500)}</strong></div>
            <div className="mf-cost-foot"><span>Quarter-final prize</span><strong>{money(30_000)}</strong></div>
          </div>
        </section>

        <footer className="mf-actions">
          <div className="mf-action-context">
            <span className="mf-action-number"><Ticket size={18} /></span>
            <span><strong>{entered ? "You’re on the card." : "Take your place."}</strong><small>{entered ? "Entry confirmed for the World Championship." : "Qualified · eligible · registration open"}</small></span>
          </div>
          <div className="mf-buttons">
            <button type="button" className="mf-enter" disabled={entered} onClick={() => setEntered(true)}>
              <Ticket size={17} />{entered ? "Entry confirmed" : `Enter · ${money(18_500)}`}
            </button>
            <a className="mf-details-link" href="#event-dossier">
              Full event details <ChevronRight size={16} />
            </a>
          </div>
        </footer>
      </article>

      <style>{`
        .mf-page {
          --mf-paper:#f3eee4; --mf-ink:#181b1a; --mf-muted:#77786f; --mf-line:#d8d0c2;
          --mf-red:#bd3445; --mf-gold:#d8b76c; --mf-green:#316e54;
          min-height:100vh; padding:28px 22px 44px; color:var(--mf-ink);
          background:#e9e2d6; font-family:"Space Grotesk",sans-serif;
        }
        .mf-page * { box-sizing:border-box; }
        .mf-dossier { max-width:1120px; margin:0 auto; overflow:hidden; background:var(--mf-paper); box-shadow:0 22px 65px #342b1f22; }
        .mf-masthead { height:52px; display:flex; align-items:center; justify-content:space-between; padding:0 36px; border-bottom:1px solid var(--mf-line); color:#5a5a52; font:600 10px "DM Mono",monospace; letter-spacing:.13em; }
        .mf-brand { color:#202320; font-weight:700; }.mf-brand i { color:var(--mf-red); font-style:normal; padding:0 5px; }
        .mf-edition b { color:var(--mf-red); font-weight:600; margin-left:8px; }
        .mf-hero { min-height:462px; position:relative; overflow:hidden; isolation:isolate; color:#fff; background:#202c2a; }
        .mf-hero-image { position:absolute; z-index:-2; inset:0; width:100%; height:100%; object-fit:cover; object-position:50% 48%; filter:saturate(.75) contrast(1.06); }
        .mf-image-shade { position:absolute; z-index:-1; inset:0; background:linear-gradient(90deg,rgba(12,20,20,.88) 0%,rgba(14,22,20,.62) 43%,rgba(15,18,18,.06) 100%),linear-gradient(0deg,rgba(12,17,17,.72),transparent 40%); }
        .mf-hero-meta { position:absolute; top:25px; left:36px; right:36px; display:flex; justify-content:space-between; color:#f0dca7; font:600 10px "DM Mono",monospace; letter-spacing:.13em; }
        .mf-hero-meta span:first-child { display:flex; align-items:center; gap:8px; }.mf-hero-meta span:last-child { border:1px solid #e3c87888; padding:7px 10px; }
        .mf-hero-copy { position:absolute; left:6.2%; bottom:48px; max-width:670px; }
        .mf-overline { margin:0 0 12px; color:#e8d39b; font:600 10px "DM Mono",monospace; letter-spacing:.12em; }
        .mf-overline span { padding:0 5px; color:#fff8; }
        .mf-hero h1 { margin:0; color:#fffaf0; font:700 clamp(58px,8.7vw,112px)/.83 "Oswald",sans-serif; letter-spacing:-.035em; text-transform:uppercase; }
        .mf-hero h1 em { color:#e3c779; font-style:normal; }
        .mf-deck { max-width:390px; margin:20px 0 0; color:#e7e2d6; font-size:14px; line-height:1.55; }
        .mf-date-stamp { position:absolute; right:6.1%; top:50%; transform:translateY(-42%); display:flex; width:142px; height:178px; flex-direction:column; align-items:center; justify-content:center; border:1px solid #f0d694bb; background:#1119174a; color:#f3d990; text-shadow:0 2px 12px #0008; }
        .mf-date-stamp small { font:600 9px "DM Mono",monospace; letter-spacing:.2em; }.mf-date-stamp strong { font:700 83px/.94 "Oswald",sans-serif; }.mf-date-stamp span { font:500 22px "Oswald",sans-serif; letter-spacing:.08em; }.mf-date-stamp small:last-child { margin-top:9px; }
        .mf-photo-caption { position:absolute; right:36px; bottom:20px; color:#fff9; font:500 9px "DM Mono",monospace; letter-spacing:.12em; }.mf-photo-caption span { color:#e2c778; padding:0 5px; }
        .mf-location-strip { display:grid; grid-template-columns:1.18fr 1fr .95fr; background:#e6dece; border-bottom:1px solid #d2c7b5; }
        .mf-location,.mf-status { display:flex; min-height:102px; align-items:center; gap:13px; padding:17px 26px; border-right:1px solid #d2c7b5; color:#9d392f; }
        .mf-location span,.mf-status span:last-child { display:flex; flex-direction:column; gap:4px; min-width:0; }
        .mf-location small,.mf-status small { color:#7d796e; font:600 9px "DM Mono",monospace; letter-spacing:.1em; }
        .mf-location strong,.mf-status strong { color:#222621; font-size:15px; font-weight:700; }.mf-location em { color:#77776d; font-size:11px; font-style:normal; }
        .mf-status { border-right:0; color:var(--mf-green); }.mf-status strong { color:var(--mf-green); font-size:13px; }
        .mf-live-dot { width:9px; height:9px; flex:none; border-radius:50%; background:#488660; box-shadow:0 0 0 4px #48866022; }
        .mf-stakes { display:grid; grid-template-columns:.85fr 1.5fr; gap:38px; align-items:center; padding:40px 6.2%; border-bottom:1px solid var(--mf-line); }
        .mf-section-index { color:#a2403d; font:600 9px "DM Mono",monospace; letter-spacing:.13em; }
        .mf-stakes-heading h2 { margin:15px 0 0; font:600 clamp(35px,4vw,52px)/.98 "Oswald",sans-serif; letter-spacing:-.02em; text-transform:uppercase; }
        .mf-stakes-heading h2 em { color:#a43a3d; font-style:normal; }
        .mf-stakes-stats { display:grid; grid-template-columns:1.12fr 1fr 1.12fr; }
        .mf-stat { min-height:126px; display:flex; flex-direction:column; justify-content:center; padding:8px 19px; border-left:1px solid var(--mf-line); }
        .mf-stat small { color:#888276; font:600 9px "DM Mono",monospace; letter-spacing:.1em; }
        .mf-stat strong { margin-top:8px; color:#252823; font:600 clamp(31px,3vw,43px)/1 "Oswald",sans-serif; white-space:nowrap; }
        .mf-field-stat strong span { color:#9c988d; font-size:.56em; }
        .mf-stat p { margin:8px 0 0; color:#77766e; font-size:10px; line-height:1.45; }.mf-stat p b { color:#b3443e; }
        .mf-capacity { width:100%; height:4px; margin-top:10px; background:#d8d0c2; }.mf-capacity i { display:block; width:87.5%; height:100%; background:#a43a3d; }
        .mf-entry { padding:27px 6.2% 31px; background:#f7f3eb; border-bottom:1px solid var(--mf-line); }
        .mf-entry-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:18px; }
        .mf-eligibility { display:flex; align-items:center; gap:7px; color:#316e54; font:600 9px "DM Mono",monospace; letter-spacing:.07em; }
        .mf-entry-grid { display:grid; grid-template-columns:1.1fr 1fr 1.24fr; border-top:1px solid var(--mf-line); border-bottom:1px solid var(--mf-line); }
        .mf-entry-window,.mf-player-state { display:flex; min-width:0; min-height:86px; align-items:center; gap:12px; padding:15px 17px; border-right:1px solid var(--mf-line); }
        .mf-entry-window { flex-direction:column; align-items:flex-start; justify-content:center; gap:5px; padding-left:0; }
        .mf-entry-window small,.mf-player-state small { color:#858176; font:600 9px "DM Mono",monospace; letter-spacing:.08em; }
        .mf-entry-window strong { font:600 25px "Oswald",sans-serif; }.mf-entry-window strong i { color:#ad4b42; font-style:normal; padding:0 3px; }
        .mf-entry-window > span { color:#8b867b; font-size:10px; }
        .mf-player-state > span:nth-child(2) { display:flex; flex-direction:column; gap:4px; min-width:0; }
        .mf-player-state strong { color:#252823; font-size:13px; }.mf-player-state em { color:#7e7a70; font-size:9px; font-style:normal; }
        .mf-state-mark { display:grid; width:32px; height:32px; flex:none; place-items:center; border:1px solid #b8aa90; border-radius:50%; color:#9d3e3a; font:600 11px "DM Mono",monospace; }
        .mf-open-tag { margin-left:auto; color:#a43a3d; font:600 8px "DM Mono",monospace; letter-spacing:.08em; }
        .mf-confirmed { border-right:0; }.mf-confirmed .mf-state-mark { border-color:#a9c3b1; color:#397050; }
        .mf-details-note { margin:14px 0 0; border-left:2px solid #a43a3d; padding:6px 0 6px 11px; color:#645f55; font-size:11px; }.mf-details-note span { padding:0 5px; color:#a43a3d; }
        .mf-cost { display:grid; grid-template-columns:.78fr 1.22fr; gap:48px; padding:35px 6.2% 38px; background:#e6dece; }
        .mf-cost-lead { display:flex; flex-direction:column; align-items:flex-start; }
        .mf-cost-title { display:flex; align-items:center; gap:8px; margin-top:18px; color:#8c4b3f; font:600 9px "DM Mono",monospace; letter-spacing:.11em; }
        .mf-total { margin-top:5px; color:#20231f; font:600 clamp(56px,6vw,78px)/.98 "Oswald",sans-serif; letter-spacing:-.035em; }
        .mf-cost-lead > p { margin:8px 0 0; color:#77746a; font-size:11px; }
        .mf-recovery { display:grid; grid-template-columns:1fr auto; gap:5px 15px; width:100%; margin-top:20px; border-top:1px solid #cfc4b1; padding-top:13px; }
        .mf-recovery span { color:#8c4b3f; font:600 8px "DM Mono",monospace; letter-spacing:.08em; }.mf-recovery strong { color:#28694e; font:600 23px "Oswald",sans-serif; }.mf-recovery small { grid-column:1/-1; color:#77746a; font-size:10px; }
        .mf-cost-breakdown { align-self:center; }
        .mf-cost-labels { display:grid; grid-template-columns:1fr auto 1fr; gap:12px; margin-bottom:8px; color:#8b8376; font:600 8px "DM Mono",monospace; letter-spacing:.07em; }
        .mf-cost-labels span:first-child { grid-column:1/3; }.mf-cost-labels span:last-child { grid-column:3; text-align:right; }
        .mf-cost-row { display:grid; grid-template-columns:1fr 66px 24px 66px; align-items:center; gap:8px; min-height:38px; border-top:1px solid #d0c6b5; color:#5e5d55; font-size:11px; }
        .mf-cost-row b { color:#272a25; font:600 14px "Oswald",sans-serif; text-align:right; }.mf-cost-row i { color:#a59882; font-style:normal; text-align:center; }.mf-cost-row .mf-covered { color:#327052; }
        .mf-cost-legend { display:flex; justify-content:space-between; gap:8px; margin-top:12px; color:#888174; font-size:9px; }.mf-cost-legend span:last-child { display:flex; align-items:center; gap:6px; }.mf-cost-legend i { width:7px; height:7px; border-radius:50%; background:#327052; }
        .mf-actions { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:20px 6.2%; background:#202b28; color:#f4efe5; }
        .mf-action-context { display:flex; align-items:center; gap:13px; }.mf-action-number { color:#e0c77b; font:600 29px "Oswald",sans-serif; }
        .mf-action-context > span:last-child { display:flex; flex-direction:column; gap:4px; }.mf-action-context strong { font-size:14px; }.mf-action-context small { color:#bbc2b8; font-size:10px; }
        .mf-buttons { display:flex; align-items:center; gap:11px; }
        .mf-enter,.mf-details-link { min-height:46px; display:inline-flex; align-items:center; justify-content:center; gap:9px; padding:0 20px; border-radius:2px; cursor:pointer; font:600 10px "DM Mono",monospace; letter-spacing:.045em; text-decoration:none; }
        .mf-enter { border:1px solid #e2c878; background:#d4b766; color:#1d211d; }.mf-enter:hover:not(:disabled) { background:#ead58e; }.mf-enter:disabled { opacity:.65; cursor:default; }
        .mf-details-link { border:1px solid #ffffff45; background:transparent; color:#eee9de; }.mf-details-link:hover { background:#ffffff0e; }
        .mf-page button:focus-visible,.mf-page a:focus-visible { outline:3px solid #efb9bd; outline-offset:3px; }
        @media (max-width:760px) {
          .mf-page { padding:12px; }.mf-masthead { padding:0 18px; }.mf-hero { min-height:430px; }
          .mf-hero-meta { left:20px; right:20px; }.mf-hero-copy { left:22px; right:22px; bottom:37px; }.mf-hero h1 { font-size:clamp(54px,12vw,86px); }
          .mf-deck { max-width:320px; font-size:12px; }.mf-date-stamp { right:20px; top:100px; width:91px; height:120px; transform:none; }
          .mf-date-stamp strong { font-size:55px; }.mf-date-stamp span { font-size:15px; }.mf-photo-caption { right:20px; bottom:15px; font-size:7px; }
          .mf-location-strip { grid-template-columns:1fr 1fr; }.mf-location,.mf-status { min-height:85px; padding:13px 16px; }.mf-location-date { border-right:0; }.mf-status { grid-column:1/-1; min-height:67px; border-top:1px solid #d2c7b5; }
          .mf-stakes { grid-template-columns:1fr; gap:22px; padding:30px 22px; }.mf-stakes-heading h2 { margin-top:10px; }
          .mf-stat { padding:8px 12px; }.mf-entry { padding:23px 22px; }.mf-entry-grid { grid-template-columns:1fr 1fr; }.mf-entry-window { grid-column:1/-1; min-height:73px; border-right:0; border-bottom:1px solid var(--mf-line); }
          .mf-player-state { padding:13px 9px; }.mf-confirmed { grid-column:1/-1; border-top:1px solid var(--mf-line); }
          .mf-cost { grid-template-columns:1fr; gap:24px; padding:29px 22px; }.mf-total { font-size:65px; }.mf-cost-breakdown { width:100%; }
          .mf-actions { align-items:stretch; flex-direction:column; padding:19px 22px; }.mf-buttons { display:grid; grid-template-columns:1fr 1fr; }
          .mf-enter,.mf-details-link { padding:0 10px; font-size:9px; }
        }
        @media (max-width:420px) {
          .mf-page { padding:0; }.mf-dossier { box-shadow:none; }.mf-masthead { height:44px; padding:0 14px; font-size:8px; }.mf-edition { font-size:7px; }
          .mf-hero { min-height:402px; }.mf-hero-meta { top:16px; left:14px; right:14px; font-size:8px; }.mf-hero-meta span:last-child { padding:6px; }
          .mf-hero-copy { left:16px; bottom:34px; }.mf-overline { max-width:220px; font-size:8px; line-height:1.6; }.mf-hero h1 { font-size:53px; }.mf-deck { max-width:260px; font-size:11px; }
          .mf-date-stamp { top:83px; right:14px; width:75px; height:104px; }.mf-date-stamp strong { font-size:46px; }.mf-date-stamp small { font-size:7px; }.mf-photo-caption { right:14px; bottom:12px; font-size:6px; }
          .mf-location,.mf-status { padding:12px 10px; gap:8px; }.mf-location svg,.mf-status svg { width:14px; }.mf-location strong { font-size:12px; }.mf-location em { font-size:9px; }.mf-location small,.mf-status small { font-size:7px; }.mf-status strong { font-size:11px; }
          .mf-stakes { padding:25px 16px; }.mf-stakes-stats { grid-template-columns:1fr 1fr; }.mf-stat { min-height:110px; padding:10px; }.mf-score-stat { grid-column:1/-1; border-top:1px solid var(--mf-line); border-left:0; }.mf-stat strong { font-size:35px; }
          .mf-entry { padding:20px 16px; }.mf-entry-heading { align-items:flex-start; flex-direction:column; }.mf-entry-window strong { font-size:23px; }.mf-player-state { gap:8px; }.mf-player-state strong { font-size:11px; }.mf-player-state small { font-size:7px; }.mf-open-tag { font-size:7px; }
          .mf-cost { padding:25px 16px; }.mf-cost-row { grid-template-columns:1fr 54px 18px 54px; gap:5px; font-size:10px; }.mf-cost-row b { font-size:12px; }.mf-cost-labels { font-size:7px; }.mf-cost-legend { font-size:8px; }
          .mf-actions { padding:17px 16px; }.mf-action-context strong { font-size:12px; }.mf-action-context small { font-size:9px; }.mf-buttons { grid-template-columns:1fr; }.mf-enter,.mf-details-link { min-height:44px; font-size:10px; }
        }
        /* Match the requested dark charcoal, red and gold direction across
           the full page; keep the arena photograph as the visual anchor. */
        .mf-page {
          --mf-paper:#18243a; --mf-ink:#f0ece3; --mf-muted:#b7bed0; --mf-line:#d4def02b;
          --mf-red:#b6384c; --mf-gold:#e0bd64; --mf-green:#9fc9a4;
          color:#f0ece3; background:#0b1423;
        }
        .mf-dossier { background:#162239; box-shadow:0 22px 65px #0008; }
        .mf-masthead { background:#162239; border-color:var(--mf-line); color:#b7bed0; }
        .mf-brand { color:#f0ece3; }.mf-brand i,.mf-edition b { color:var(--mf-red); }
        .mf-hero { background:#0d1728; }
        .mf-hero-image { filter:saturate(.82) contrast(1.08) brightness(.8); }
        .mf-image-shade { background:linear-gradient(90deg,rgba(8,8,7,.91) 0%,rgba(9,9,8,.7) 43%,rgba(8,8,7,.12) 100%),linear-gradient(0deg,rgba(8,8,7,.78),transparent 40%); }
        .mf-hero-meta,.mf-overline { color:#e2c873; }
        .mf-overline span { color:#fff8; }
        .mf-hero h1 { color:#f4efe5; }.mf-hero h1 em { color:#e0bd64; }
        .mf-deck { color:#e0d9cc; }
        .mf-date-stamp { border-color:#e0bd64bb; background:#11100e88; color:#e0bd64; }
        .mf-photo-caption { color:#fff9; }.mf-photo-caption span { color:#e0bd64; }
        .mf-location-strip { background:#1b2a42; border-color:var(--mf-line); }
        .mf-location,.mf-status { border-color:var(--mf-line); color:#c34b56; }
        .mf-location small,.mf-status small { color:#b7bed0; }
        .mf-location strong,.mf-status strong { color:#f0ece3; }
        .mf-location em { color:#b7bed0; }
        .mf-status { color:#a1c9a3; }.mf-status strong { color:#b7d9b7; }
        .mf-live-dot { background:#83b78f; box-shadow:0 0 0 4px #83b78f22; }
        .mf-stakes { background:#142138; border-color:var(--mf-line); }
        .mf-section-index,.mf-stakes-heading h2 em { color:#c44858; }
        .mf-stakes-heading h2 { color:#f0ece3; }
        .mf-stat { border-color:var(--mf-line); }
        .mf-stat small,.mf-stat p { color:#b7bed0; }
        .mf-stat strong { color:#e3c56c; }.mf-field-stat strong span { color:#aab5c8; }
        .mf-stat p b { color:#dc6c72; }
        .mf-capacity { background:#354258; }.mf-capacity i { background:linear-gradient(90deg,#b6384c,#e0bd64); }
        .mf-entry { background:#18243a; border-color:var(--mf-line); }
        .mf-eligibility { color:#acd1ad; }
        .mf-entry-grid,.mf-entry-window,.mf-player-state { border-color:var(--mf-line); }
        .mf-entry-window small,.mf-player-state small { color:#b7bed0; }
        .mf-entry-window strong { color:#f0ece3; }.mf-entry-window strong i { color:#d75a63; }
        .mf-entry-window > span,.mf-player-state em { color:#b7bed0; }
        .mf-player-state strong { color:#f0ece3; }
        .mf-state-mark { border-color:#e0bd645c; color:#e0bd64; }
        .mf-open-tag { color:#dc6670; }.mf-confirmed .mf-state-mark { border-color:#a1c9a35c; color:#a1c9a3; }
        .mf-details-note { border-color:#b6384c; color:#c5bcaf; }
        .mf-details-note span { color:#dc6670; }
        .mf-cost { background:#18243a; }
        .mf-cost-title,.mf-recovery span { color:#e0bd64; }
        .mf-total { color:#f0ece3; }.mf-cost-lead > p,.mf-recovery small { color:#b7bed0; }
        .mf-recovery { border-color:var(--mf-line); }.mf-recovery strong { color:#e0bd64; }
        .mf-cost-labels { color:#b7bed0; }
        .mf-cost-row { border-color:var(--mf-line); color:#c5bcaf; }
        .mf-cost-row b { color:#f0ece3; }.mf-cost-row i { color:#d1bd87; }
        .mf-cost-row .mf-covered { color:#b7d9b7; }
        .mf-cost-legend { color:#b7bed0; }.mf-cost-legend i { background:#9fc9a4; }
        .mf-actions { background:#0b1423; color:#f0ece3; }
        .mf-action-number { color:#e0bd64; }.mf-action-context small { color:#b7bed0; }
        .mf-enter { border-color:#c44858; background:linear-gradient(110deg,#c04454,#982c3e); color:#fff7eb; }
        .mf-enter:hover:not(:disabled) { background:#d14d5e; }
        .mf-details-link { border-color:#e5d8bd66; background:#ffffff08; color:#f0ece3; }
        .mf-details-link:hover { background:#ffffff12; }
        .mf-page button:focus-visible,.mf-page a:focus-visible { outline-color:#e0bd64; }
        /* Refined match-day editorial system: one photographic anchor, then
           open, graphic information bands instead of a stack of cards. */
        .mf-page {
          --mf-midnight:#071321; --mf-deep:#0a1728; --mf-panel:#101f34;
          --mf-blue:#172942; --mf-rule:#d9e4f022; --mf-white:#f2f4f2;
          --mf-muted:#a8b4c4; --mf-red:#bd394c; --mf-gold:#e0bf69; --mf-green:#9ecaa9;
          min-height:100vh; padding:0 22px 42px; color:var(--mf-white); background:var(--mf-midnight);
        }
        .mf-dossier { max-width:1200px; background:var(--mf-deep); box-shadow:0 28px 90px #02081380; }
        .mf-masthead { height:54px; padding:0 38px; border-color:var(--mf-rule); color:#aebac9; background:#091727; }
        .mf-brand { color:#f1f3f2; letter-spacing:.16em; }.mf-edition { color:#b8c2ce; }
        .mf-hero { min-height:500px; background:#0a1727; }
        .mf-hero-image { filter:saturate(.87) contrast(1.12) brightness(.8); object-position:50% 43%; transform:scale(1.015); }
        .mf-image-shade {
          background:
            linear-gradient(90deg,#071321f5 0%,#071321dd 29%,#07132180 55%,#07132105 100%),
            linear-gradient(0deg,#071321d9 0%,transparent 46%),
            linear-gradient(180deg,#07132180 0%,transparent 25%);
        }
        .mf-hero-meta { left:38px; right:38px; top:24px; }
        .mf-hero-meta span:first-child { font-size:10px; }
        .mf-hero-meta span:last-child { border-color:#e0bf6970; background:#07132172; }
        .mf-hero-copy { left:6%; bottom:45px; max-width:740px; }
        .mf-overline { color:#f0d78f; }
        .mf-hero h1 { font-size:clamp(76px,9.4vw,132px); line-height:.78; letter-spacing:-.045em; text-shadow:0 5px 35px #0008; }
        .mf-hero h1 em { display:inline-block; padding-top:9px; color:#e2c673; }
        .mf-deck { max-width:360px; margin-top:19px; color:#d5dce3; font-size:13px; line-height:1.48; }
        .mf-date-stamp {
          right:6%; top:48%; width:164px; height:195px; transform:translateY(-38%);
          border:0; border-left:1px solid #e0bf69b0; background:#07132138; color:#f1d98d;
          text-shadow:0 3px 18px #000b;
        }
        .mf-date-stamp strong { font-size:96px; line-height:.84; }
        .mf-date-stamp span { margin-top:7px; font-size:28px; }
        .mf-date-stamp small { font-size:8px; letter-spacing:.14em; }
        .mf-date-stamp small:last-child { margin-top:11px; font-size:7px; }
        .mf-photo-caption { right:38px; bottom:20px; color:#d0d7de; }
        .mf-location-strip {
          grid-template-columns:1.12fr 1fr .9fr; min-height:86px;
          background:#0d1b2e; border-bottom:1px solid var(--mf-rule);
        }
        .mf-location,.mf-status { min-height:86px; padding:15px 24px; border-color:var(--mf-rule); color:var(--mf-gold); }
        .mf-location small,.mf-status small { color:#8291a5; font-size:8px; }
        .mf-location strong { color:#f0f2f2; font-size:14px; }
        .mf-location em { color:#aeb9c7; font-size:10px; }
        .mf-status { color:var(--mf-green); }.mf-status strong { color:#c1dfc5; font-size:12px; }
        .mf-live-dot { background:#86be91; box-shadow:0 0 0 4px #86be9123; }
        .mf-section-index { color:#e0bf69; font-size:8px; letter-spacing:.17em; }
        .mf-timeline { padding:25px 6% 29px; background:#0a1728; border-bottom:1px solid var(--mf-rule); }
        .mf-timeline-heading,.mf-compact-label { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .mf-timeline-caption { color:#8190a4; font:500 8px "DM Mono",monospace; letter-spacing:.15em; }
        .mf-timeline-track { position:relative; display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:21px; }
        .mf-timeline-line { position:absolute; top:17px; left:16%; right:16%; height:1px; background:#e0bf6952; }
        .mf-timeline-line i { position:absolute; top:-2px; left:0; width:66.67%; height:5px; background:linear-gradient(90deg,#bd394c,#e0bf69); }
        .mf-timeline-line b { position:absolute; top:-4px; left:66.67%; width:9px; height:9px; border:2px solid #e0bf69; border-radius:50%; background:#0a1728; }
        .mf-milestone { position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:3px; padding:0 10px; }
        .mf-milestone:nth-of-type(2) { align-items:center; text-align:center; }
        .mf-milestone-final { align-items:flex-end; text-align:right; }
        .mf-milestone-dot {
          z-index:1; display:grid; width:35px; height:35px; place-items:center; margin-bottom:5px;
          border:1px solid #bd394c; border-radius:50%; background:#0a1728; color:#f0d88b;
          font:600 12px "Oswald",sans-serif;
        }
        .mf-milestone:nth-of-type(2) .mf-milestone-dot { border-color:#d2a75b; }
        .mf-milestone-final .mf-milestone-dot { border-color:#e0bf69; color:#e0bf69; }
        .mf-milestone small { color:#8290a3; font:600 8px "DM Mono",monospace; letter-spacing:.11em; }
        .mf-milestone strong { color:#ecf0ef; font:600 15px "Oswald",sans-serif; letter-spacing:.02em; text-transform:uppercase; }
        .mf-stakes { grid-template-columns:.83fr 1.17fr; gap:36px; align-items:stretch; padding:34px 6%; background:#101f34; border-bottom:1px solid var(--mf-rule); }
        .mf-field { min-width:0; }
        .mf-compact-label { color:#8391a4; font:600 8px "DM Mono",monospace; letter-spacing:.12em; }
        .mf-compact-label span:last-child { color:#667990; }
        .mf-field-visual { display:flex; align-items:center; gap:23px; margin-top:22px; }
        .mf-field-ring {
          position:relative; display:grid; width:138px; height:138px; flex:none; place-items:center;
          border-radius:50%; background:conic-gradient(var(--mf-red) 0deg 90deg,var(--mf-gold) 90deg 315deg,#344259 315deg 360deg);
          transform:rotate(-90deg);
        }
        .mf-field-ring::before { position:absolute; inset:8px; border-radius:50%; background:#101f34; content:""; }
        .mf-ring-copy { z-index:1; display:flex; flex-direction:column; align-items:center; transform:rotate(90deg); }
        .mf-ring-copy strong { color:#f3f4f0; font:600 43px/.9 "Oswald",sans-serif; }
        .mf-ring-copy span { margin-top:6px; color:#9eabbc; font:600 8px "DM Mono",monospace; letter-spacing:.14em; }
        .mf-field-copy { flex:1; min-width:0; }
        .mf-field-copy > small { color:#8998ab; font:600 8px "DM Mono",monospace; letter-spacing:.12em; }
        .mf-field-copy > strong { display:block; margin-top:8px; color:#f0f1ee; font:600 19px "Oswald",sans-serif; text-transform:uppercase; }
        .mf-threshold { position:relative; margin:20px 0 0; padding-bottom:34px; }
        .mf-threshold-bar { display:block; width:100%; height:5px; overflow:hidden; border-radius:5px; background:#35445a; }
        .mf-threshold-bar i { display:block; width:87.5%; height:100%; background:linear-gradient(90deg,#bd394c,#e0bf69); }
        .mf-threshold > b { position:absolute; top:-4px; left:66.666%; width:2px; height:13px; background:#f0f2ed; }
        .mf-threshold-label { position:absolute; top:15px; left:66.666%; display:flex; flex-direction:column; align-items:center; transform:translateX(-50%); white-space:nowrap; }
        .mf-threshold-label strong { color:#e3c774; font:600 16px "Oswald",sans-serif; }
        .mf-threshold-label small { color:#8b99ab; font-size:8px; }
        .mf-field-foot { display:flex; align-items:center; gap:8px; margin:4px 0 0; color:#b6d6ba; font:500 9px "DM Mono",monospace; letter-spacing:.025em; }
        .mf-field-foot svg { color:var(--mf-green); }
        .mf-prize-feature { display:grid; grid-template-columns:1.13fr .87fr; align-items:stretch; border-left:1px solid var(--mf-rule); padding-left:34px; }
        .mf-prize-copy { position:relative; display:flex; flex-direction:column; align-items:flex-start; padding:0 23px 0 0; }
        .mf-prize-copy > small { margin-top:25px; color:#9ba7b6; font:600 8px "DM Mono",monospace; letter-spacing:.15em; }
        .mf-prize-copy > strong { margin-top:2px; color:#e7cc7b; font:600 clamp(53px,6vw,79px)/1 "Oswald",sans-serif; letter-spacing:-.04em; }
        .mf-prize-trophy { display:flex; align-items:center; gap:8px; margin-top:auto; padding-top:16px; color:#c0cad4; font:500 8px "DM Mono",monospace; letter-spacing:.1em; }
        .mf-prize-trophy svg { color:#e0bf69; }
        .mf-format-feature { display:flex; flex-direction:column; align-items:flex-start; border-left:1px solid var(--mf-rule); padding-left:25px; }
        .mf-format-feature > strong { margin-top:26px; color:#eff0ed; font:600 64px/.9 "Oswald",sans-serif; letter-spacing:-.04em; }
        .mf-format-feature > span { margin-top:8px; color:#e0bf69; font:600 8px "DM Mono",monospace; letter-spacing:.15em; }
        .mf-format-feature > small { margin-top:12px; color:#a7b2bf; font-size:9px; line-height:1.55; }
        .mf-entry { padding:22px 6% 24px; background:#0b192b; border-bottom:1px solid var(--mf-rule); }
        .mf-entry-heading { margin:0 0 13px; }
        .mf-eligibility { color:#b4d7ba; font-size:8px; }
        .mf-entry-grid { grid-template-columns:1fr 1fr; border-top:1px solid var(--mf-rule); border-bottom:0; }
        .mf-player-state { min-height:63px; padding:12px 14px 8px 0; border-right:1px solid var(--mf-rule); }
        .mf-player-state:last-child { padding-left:20px; border-right:0; }
        .mf-player-state > span:nth-child(2) { gap:3px; }
        .mf-player-state small { color:#8795a8; font-size:8px; }
        .mf-player-state strong { color:#edf0ee; font:600 14px "Oswald",sans-serif; }
        .mf-state-mark { width:28px; height:28px; border-color:#e0bf695c; color:#e0bf69; }
        .mf-confirmed .mf-state-mark { border-color:#9ecaa95c; color:#9ecaa9; }
        .mf-open-tag { color:#e1c66f; font-size:8px; }
        .mf-cost { grid-template-columns:.7fr 1.3fr; gap:45px; padding:34px 6% 37px; background:#0e1d31; }
        .mf-cost-title { margin-top:17px; color:#dfc271; font-size:8px; }
        .mf-total { margin-top:8px; color:#f3f3ee; font-size:clamp(55px,6.2vw,79px); }
        .mf-cost-caption { margin-top:8px; color:#8997aa; font:500 8px "DM Mono",monospace; letter-spacing:.07em; }
        .mf-prize-quick { display:flex; width:100%; align-items:center; justify-content:space-between; gap:10px; margin-top:auto; padding-top:20px; }
        .mf-prize-quick span { display:flex; align-items:center; gap:7px; color:#aeb9c7; font:600 8px "DM Mono",monospace; letter-spacing:.1em; }
        .mf-prize-quick span svg { color:#e0bf69; }
        .mf-prize-quick strong { color:#e0bf69; font:600 22px "Oswald",sans-serif; }
        .mf-cost-breakdown { align-self:stretch; display:flex; flex-direction:column; justify-content:center; }
        .mf-cost-labels { grid-template-columns:1fr 70px 76px 74px; gap:8px; margin:0; color:#8290a3; font-size:7px; letter-spacing:.1em; }
        .mf-cost-labels span:first-child { grid-column:2; text-align:right; }.mf-cost-labels span:nth-child(2) { grid-column:3; text-align:right; }.mf-cost-labels span:nth-child(3) { grid-column:4; text-align:right; color:#dfc271; }
        .mf-cost-row { grid-template-columns:1fr 70px 76px 74px; gap:8px; min-height:43px; border-color:var(--mf-rule); color:#ccd3dd; font-size:10px; }
        .mf-cost-row b,.mf-cost-row strong { color:#d8e0e7; font:600 13px "Oswald",sans-serif; text-align:right; white-space:nowrap; }
        .mf-cost-row i { color:#a6c9a9; font:500 11px "DM Mono",monospace; text-align:right; white-space:nowrap; }
        .mf-cost-row strong { color:#e7ca76; }
        .mf-cost-foot { display:flex; align-items:center; justify-content:space-between; margin-top:8px; border-top:1px solid var(--mf-rule); padding-top:12px; color:#97a4b6; font-size:9px; }
        .mf-cost-foot strong { color:#bad9bd; font:600 17px "Oswald",sans-serif; }
        .mf-actions { padding:19px 6%; background:#071321; border-top:1px solid #e0bf6938; }
        .mf-action-number { display:grid; width:34px; height:34px; place-items:center; border:1px solid #e0bf6955; border-radius:50%; color:#e0bf69; }
        .mf-action-context strong { font:600 16px "Oswald",sans-serif; text-transform:uppercase; letter-spacing:.03em; }
        .mf-action-context small { color:#9eabbc; font-size:9px; }
        .mf-enter { min-width:200px; border:1px solid #d74a5c; background:#b83246; color:#fff; font-size:9px; }
        .mf-enter:hover:not(:disabled) { background:#cf4053; }
        .mf-details-link { min-height:46px; border-color:#cad4df42; background:#ffffff06; color:#dce2e7; }
        .mf-details-link:hover { border-color:#e0bf69a0; background:#ffffff0c; }
        .mf-page button:focus-visible,.mf-page a:focus-visible { outline-color:#f2cf70; }
        @media (max-width:760px) {
          .mf-page { padding:0 12px 24px; }
          .mf-hero { min-height:460px; }
          .mf-hero-image { object-position:56% 50%; }
          .mf-image-shade { background:linear-gradient(90deg,#071321ef 0%,#071321c5 46%,#07132136 100%),linear-gradient(0deg,#071321e5,transparent 62%); }
          .mf-hero-meta { left:20px; right:20px; }
          .mf-hero-copy { left:22px; bottom:36px; }
          .mf-hero h1 { font-size:clamp(61px,11.8vw,91px); }
          .mf-date-stamp { right:20px; top:104px; width:115px; height:142px; transform:none; }
          .mf-date-stamp strong { font-size:69px; }
          .mf-location-strip { grid-template-columns:1fr 1fr; }
          .mf-location,.mf-status { min-height:76px; padding:12px 15px; }
          .mf-status { grid-column:1/-1; min-height:61px; border-top:1px solid var(--mf-rule); }
          .mf-timeline { padding:23px 22px 26px; }
          .mf-stakes { grid-template-columns:1fr; gap:28px; padding:28px 22px; }
          .mf-prize-feature { min-height:185px; border-top:1px solid var(--mf-rule); border-left:0; padding:24px 0 0; }
          .mf-field-visual { gap:21px; }
          .mf-entry { padding:20px 22px; }
          .mf-cost { grid-template-columns:1fr; gap:24px; padding:27px 22px; }
          .mf-prize-quick { max-width:350px; margin-top:17px; }
          .mf-actions { align-items:stretch; flex-direction:column; padding:18px 22px; }
          .mf-buttons { display:grid; grid-template-columns:1fr 1fr; }
        }
        @media (max-width:420px) {
          .mf-page { padding:0 0 16px; }
          .mf-masthead { height:45px; padding:0 15px; font-size:8px; }
          .mf-hero { min-height:421px; }
          .mf-hero-meta { top:15px; left:15px; right:15px; font-size:7px; letter-spacing:.08em; }
          .mf-hero-meta span:last-child { padding:6px; font-size:7px; }
          .mf-hero-copy { left:16px; right:16px; bottom:36px; }
          .mf-overline { max-width:220px; font-size:7px; line-height:1.6; }
          .mf-hero h1 { font-size:clamp(49px,13.2vw,59px); }
          .mf-deck { max-width:245px; font-size:10px; }
          .mf-date-stamp { top:76px; right:15px; width:83px; height:109px; }
          .mf-date-stamp strong { font-size:50px; }
          .mf-date-stamp span { font-size:17px; }
          .mf-date-stamp small { font-size:6px; }
          .mf-date-stamp small:last-child { font-size:5px; }
          .mf-photo-caption { right:14px; bottom:13px; font-size:6px; }
          .mf-location,.mf-status { gap:8px; padding:11px 9px; }
          .mf-location svg { width:14px; }
          .mf-location small,.mf-status small { font-size:6px; letter-spacing:.07em; }
          .mf-location strong { font-size:11px; }
          .mf-location em { font-size:8px; }
          .mf-status strong { font-size:10px; }
          .mf-timeline { padding:20px 14px 23px; }
          .mf-timeline-caption,.mf-section-index { font-size:7px; }
          .mf-timeline-track { gap:3px; margin-top:17px; }
          .mf-timeline-line { left:15%; right:15%; top:14px; }
          .mf-milestone { padding:0 2px; }
          .mf-milestone-dot { width:30px; height:30px; margin-bottom:4px; font-size:10px; }
          .mf-milestone small { font-size:6px; letter-spacing:.06em; }
          .mf-milestone strong { font-size:11px; }
          .mf-field-visual { align-items:center; gap:15px; margin-top:18px; }
          .mf-field-ring { width:105px; height:105px; }
          .mf-field-ring::before { inset:7px; }
          .mf-ring-copy strong { font-size:35px; }
          .mf-field-copy > small { font-size:6px; letter-spacing:.07em; }
          .mf-field-copy > strong { font-size:15px; }
          .mf-threshold { margin-top:15px; }
          .mf-threshold-label small { font-size:7px; }
          .mf-field-foot { font-size:7px; }
          .mf-prize-feature { grid-template-columns:1fr .8fr; min-height:165px; }
          .mf-prize-copy { padding-right:13px; }
          .mf-prize-copy > strong { font-size:52px; }
          .mf-prize-trophy { font-size:6px; letter-spacing:.06em; }
          .mf-prize-trophy svg { width:14px; }
          .mf-format-feature { padding-left:15px; }
          .mf-format-feature > strong { margin-top:24px; font-size:52px; }
          .mf-format-feature > small { font-size:8px; }
          .mf-entry { padding:18px 15px; }
          .mf-entry-heading { align-items:flex-start; }
          .mf-entry-grid { grid-template-columns:1fr 1fr; }
          .mf-player-state { gap:7px; padding-right:7px; }
          .mf-player-state:last-child { padding-left:8px; }
          .mf-player-state small { font-size:6px; letter-spacing:.04em; }
          .mf-player-state strong { font-size:11px; }
          .mf-open-tag { font-size:6px; }
          .mf-state-mark { width:24px; height:24px; }
          .mf-cost { padding:24px 15px; gap:20px; }
          .mf-total { font-size:60px; }
          .mf-cost-labels { grid-template-columns:1fr 47px 57px 54px; gap:5px; font-size:6px; }
          .mf-cost-labels span:first-child { grid-column:2; }
          .mf-cost-labels span:nth-child(2) { grid-column:3; }
          .mf-cost-labels span:nth-child(3) { grid-column:4; }
          .mf-cost-row { grid-template-columns:1fr 47px 57px 54px; gap:5px; min-height:39px; font-size:9px; }
          .mf-cost-row b,.mf-cost-row strong { font-size:11px; }
          .mf-cost-row i { font-size:8px; }
          .mf-cost-legend { font-size:7px; }
          .mf-prize-quick strong { font-size:20px; }
          .mf-actions { padding:16px 15px; }
          .mf-action-context strong { font-size:13px; }
          .mf-action-context small { font-size:8px; }
          .mf-buttons { grid-template-columns:1fr; }
          .mf-enter,.mf-details-link { min-height:43px; font-size:9px; }
        }
        /* Depth pass: stadium spill-light, restrained edge highlights and
           tactile data marks carry the occasion through the whole dossier. */
        .mf-page {
          background:
            radial-gradient(ellipse at 48% -7%,#1b3150 0%,#0b192b 38%,transparent 71%),
            linear-gradient(180deg,#081525 0%,#071321 62%,#050f1d 100%);
        }
        .mf-dossier {
          background:linear-gradient(180deg,#0d1c2f 0%,#0a1728 100%);
          box-shadow:0 34px 100px #020712a8,0 1px 0 #d8e5f014 inset;
        }
        .mf-masthead {
          position:relative;
          background:linear-gradient(90deg,#091827 0%,#0c1b2e 50%,#091827 100%);
          box-shadow:0 -1px 0 #e0bf6920 inset;
        }
        .mf-masthead::after {
          position:absolute; bottom:-1px; left:6%; width:112px; height:1px;
          background:linear-gradient(90deg,#c13b4d,#e0bf69,transparent); content:"";
        }
        .mf-hero {
          box-shadow:0 22px 48px #0207134d;
        }
        .mf-hero-image { filter:saturate(.95) contrast(1.12) brightness(.84); }
        .mf-image-shade {
          background:
            radial-gradient(ellipse at 79% 4%,#e2bd691e 0%,transparent 30%),
            radial-gradient(ellipse at 77% 58%,#b83a4b20 0%,transparent 37%),
            linear-gradient(90deg,#071321f5 0%,#071321df 28%,#0713218c 53%,#07132112 100%),
            linear-gradient(0deg,#071321e8 0%,transparent 52%),
            linear-gradient(180deg,#07132190 0%,transparent 27%);
        }
        .mf-hero-meta span:last-child { box-shadow:0 3px 18px #0309125c,inset 0 1px #fff2; }
        .mf-date-stamp {
          border-left:1px solid #f0d78db8;
          background:linear-gradient(90deg,#08142145,#08142112);
          box-shadow:9px 0 28px #02081225,inset 1px 0 #fff2;
        }
        .mf-date-stamp strong { text-shadow:0 5px 24px #020713aa,0 1px #fff2; }
        .mf-location-strip {
          position:relative;
          background:linear-gradient(105deg,#12243a 0%,#0d1b2f 54%,#11223a 100%);
          box-shadow:0 10px 24px #02081225,inset 0 1px #d6e1ed0c;
        }
        .mf-location-strip::after {
          position:absolute; right:0; bottom:0; left:0; height:1px;
          background:linear-gradient(90deg,transparent,#e0bf6944 50%,transparent); content:"";
        }
        .mf-location,.mf-status { text-shadow:0 1px #0004; }
        .mf-timeline {
          position:relative; overflow:hidden;
          background:
            radial-gradient(ellipse at 49% 0%,#18314e80,transparent 61%),
            linear-gradient(180deg,#0a1a2d 0%,#091626 100%);
          box-shadow:inset 0 1px #d8e5f012,inset 0 -1px #0005;
        }
        .mf-timeline::before {
          position:absolute; top:0; left:6%; width:26%; height:1px;
          background:linear-gradient(90deg,#e0bf69aa,transparent); content:"";
        }
        .mf-timeline-line {
          height:2px; border-radius:2px;
          background:linear-gradient(90deg,#e0bf6980,#e0bf692b);
          box-shadow:0 1px 5px #020712a0;
        }
        .mf-timeline-line i {
          top:-1px; height:4px; border-radius:4px;
          background:linear-gradient(90deg,#a92d44 0%,#d75255 45%,#ebce78 100%);
          box-shadow:0 0 12px #d9a95e70,0 1px #fff5 inset;
        }
        .mf-timeline-line b {
          top:-4px; width:10px; height:10px; border:2px solid #f0d27b;
          background:#101f33; box-shadow:0 0 0 3px #e0bf6924,0 0 13px #e0bf6982;
        }
        .mf-milestone-dot {
          border:1px solid #db5360;
          background:radial-gradient(circle at 33% 25%,#263b53 0%,#122238 50%,#091525 100%);
          box-shadow:0 4px 10px #02081380,inset 0 1px #fff3,inset 0 -3px #02081388;
          text-shadow:0 1px 5px #0008;
        }
        .mf-milestone:nth-of-type(2) .mf-milestone-dot {
          border-color:#d7ad5b;
          box-shadow:0 4px 10px #02081380,inset 0 1px #fff4,inset 0 -3px #02081388,0 0 13px #d6ae5b2b;
        }
        .mf-milestone-final .mf-milestone-dot {
          border-color:#f0d27b; color:#f0d27b;
          background:radial-gradient(circle at 35% 25%,#5a4b2c 0%,#252a2b 46%,#101a28 100%);
          box-shadow:0 4px 12px #0208139c,inset 0 1px #fff5,inset 0 -3px #02081388,0 0 16px #e0bf6940;
        }
        .mf-stakes {
          position:relative;
          background:
            radial-gradient(ellipse at 82% 8%,#223b5b55,transparent 46%),
            linear-gradient(110deg,#12233a 0%,#0f1e32 48%,#12233a 100%);
          box-shadow:inset 0 1px #ffffff08,inset 0 -1px #0006;
        }
        .mf-field-ring {
          background:conic-gradient(from 4deg,#c03b50 0deg 90deg,#e2c36e 90deg 315deg,#354760 315deg 360deg);
          box-shadow:0 10px 24px #0208138c,0 0 0 1px #e8d18a55,inset 0 1px #fff7;
        }
        .mf-field-ring::before {
          background:radial-gradient(circle at 37% 28%,#203652 0%,#12243a 48%,#0b192b 100%);
          box-shadow:inset 0 4px 12px #020813a6,inset 0 1px #d9e6f01f;
        }
        .mf-field-ring::after {
          position:absolute; inset:3px; border:1px solid #f1d9873b; border-radius:50%;
          box-shadow:0 1px #fff3 inset; content:"";
        }
        .mf-ring-copy strong { text-shadow:0 2px 12px #020813c9,0 1px #fff3; }
        .mf-threshold-bar {
          height:6px; background:linear-gradient(180deg,#40516a,#27374e);
          box-shadow:0 2px 4px #020813a6 inset,0 1px #ffffff10;
        }
        .mf-threshold-bar i {
          background:linear-gradient(90deg,#ad3048 0%,#d85a5d 40%,#f0d580 100%);
          box-shadow:0 0 10px #cf5b5b6e,0 1px #fff7 inset;
        }
        .mf-threshold > b {
          width:3px; border-radius:2px; background:#f6f0dc;
          box-shadow:0 0 0 2px #15253a,0 0 10px #fff9;
        }
        .mf-prize-feature {
          position:relative;
          background:radial-gradient(ellipse at 28% 52%,#c19a4520 0%,transparent 54%);
        }
        .mf-prize-copy > strong {
          color:#f0d27a;
          text-shadow:0 4px 26px #d8a94335,0 1px #fff5;
        }
        .mf-prize-trophy {
          width:100%; border-top:1px solid #e0bf6938;
          text-shadow:0 1px #0006;
        }
        .mf-prize-trophy svg { filter:drop-shadow(0 0 7px #e0bf695c); }
        .mf-format-feature > strong {
          text-shadow:0 4px 22px #d4ba6630,0 1px #fff4;
        }
        .mf-format-feature > span { text-shadow:0 0 12px #e0bf6940; }
        .mf-entry {
          position:relative;
          background:
            radial-gradient(ellipse at 8% 0%,#172d48a8,transparent 52%),
            linear-gradient(105deg,#0b192b 0%,#0a1728 100%);
          box-shadow:inset 0 1px #d7e2ef0b,inset 0 -1px #0005;
        }
        .mf-entry-grid { border-image:linear-gradient(90deg,#e0bf6948,#d8e4f020) 1; }
        .mf-state-mark {
          background:radial-gradient(circle at 35% 28%,#243953,#0b192b 76%);
          box-shadow:0 3px 8px #0208138a,inset 0 1px #fff3;
        }
        .mf-confirmed .mf-state-mark {
          background:radial-gradient(circle at 35% 28%,#28433a,#10251f 76%);
          box-shadow:0 3px 8px #0208138a,inset 0 1px #fff3;
        }
        .mf-cost {
          position:relative;
          background:
            radial-gradient(ellipse at 12% 100%,#1b3554a8 0%,transparent 43%),
            linear-gradient(110deg,#11233a 0%,#0d1a2d 55%,#12243a 100%);
          box-shadow:inset 0 1px #dce8f012;
        }
        .mf-cost::before {
          position:absolute; top:0; left:6%; width:150px; height:1px;
          background:linear-gradient(90deg,#e0bf69b3,transparent); content:"";
        }
        .mf-total {
          color:#f2f3ef;
          text-shadow:0 6px 24px #02081380,0 1px #fff4;
        }
        .mf-cost-caption { padding:5px 8px; border-left:2px solid #e0bf69; background:linear-gradient(90deg,#e0bf6916,transparent); }
        .mf-prize-quick {
          border-top:1px solid #e0bf6940;
          background:linear-gradient(90deg,#e0bf690d,transparent 78%);
        }
        .mf-prize-quick strong { text-shadow:0 2px 13px #dfb94b54,0 1px #fff4; }
        .mf-cost-labels { padding:0 0 9px; border-bottom:1px solid #dce6f02a; }
        .mf-cost-row {
          position:relative;
          background:linear-gradient(90deg,#ffffff03 0%,transparent 48%,#e0bf6908 100%);
          box-shadow:0 1px #ffffff04 inset;
        }
        .mf-cost-row strong { text-shadow:0 1px 8px #e0bf692c; }
        .mf-cost-foot {
          border-color:#e0bf6942;
          background:linear-gradient(90deg,#e0bf690d,transparent 76%);
        }
        .mf-cost-foot strong { text-shadow:0 2px 12px #91caa53a; }
        .mf-actions {
          position:relative;
          background:
            radial-gradient(ellipse at 78% 0%,#14294396,transparent 62%),
            linear-gradient(100deg,#081525,#0a192b 60%,#071321);
          box-shadow:0 -14px 28px #0208132b,inset 0 1px #e0bf6928;
        }
        .mf-action-number {
          background:radial-gradient(circle at 35% 25%,#293b50,#101d2e 75%);
          box-shadow:0 3px 11px #0208138a,inset 0 1px #fff3;
        }
        .mf-enter {
          background:linear-gradient(180deg,#cf4557 0%,#aa2e43 100%);
          box-shadow:0 5px 15px #7a1b2d4c,inset 0 1px #ffffff3d,inset 0 -2px #6e1929;
          transition:transform .18s ease,opacity .18s ease;
        }
        .mf-enter:hover:not(:disabled) { transform:translateY(-1px); background:linear-gradient(180deg,#dc5362,#b23248); }
        .mf-details-link {
          background:linear-gradient(180deg,#17283d99,#0b192a99);
          box-shadow:0 3px 10px #02081354,inset 0 1px #ffffff10;
        }
        .mf-details-link:hover { transform:translateY(-1px); }
        .mf-page :focus-visible { outline:2px solid #f2cf70; outline-offset:3px; }
        @media (max-width:760px) {
          .mf-image-shade {
            background:
              radial-gradient(ellipse at 78% 23%,#d9b45c26 0%,transparent 29%),
              linear-gradient(90deg,#071321f0 0%,#071321cf 49%,#07132136 100%),
              linear-gradient(0deg,#071321ef 0%,transparent 64%);
          }
          .mf-prize-feature { background:radial-gradient(ellipse at 18% 42%,#c19a451c 0%,transparent 61%); }
        }
        @media (max-width:420px) {
          .mf-date-stamp { background:linear-gradient(90deg,#08142178,#08142125); }
          .mf-timeline-line { box-shadow:0 1px 5px #020712a0; }
          .mf-cost-row { background:linear-gradient(90deg,#ffffff04 0%,transparent 52%,#e0bf6909 100%); }
        }
        /* Structural reframe: the schedule becomes a vertical flight rail
           beside a raised scoreboard; the venue plate now carries the details. */
        .mf-hero {
          min-height:552px;
          box-shadow:0 32px 62px #02071375,inset 0 1px #ffffff12;
        }
        .mf-hero-image { object-position:50% 45%; }
        .mf-image-shade {
          background:
            radial-gradient(ellipse at 78% 15%,#e0bd693b 0%,transparent 25%),
            radial-gradient(ellipse at 81% 55%,#bd394c38 0%,transparent 38%),
            linear-gradient(90deg,#071321fc 0%,#071321e8 27%,#0713219d 51%,#0713211a 100%),
            linear-gradient(0deg,#071321f5 0%,#0713212b 40%,transparent 76%),
            linear-gradient(180deg,#071321ad 0%,transparent 35%);
        }
        .mf-hero-copy { bottom:120px; }
        .mf-hero h1 { font-size:clamp(80px,9.4vw,135px); }
        .mf-date-stamp {
          top:112px; right:7%; width:178px; height:215px;
          border:1px solid #f0d27bc4; border-radius:50%;
          background:radial-gradient(circle at 34% 24%,#354154d9 0%,#132239df 48%,#091522ed 100%);
          box-shadow:0 18px 48px #020713ad,0 0 0 8px #e0bf691c,0 0 0 9px #fff2,inset 0 1px #fff6,inset 0 -12px 25px #02071379;
          text-shadow:0 3px 18px #020713bd;
        }
        .mf-date-stamp strong { font-size:89px; }
        .mf-date-stamp span { margin-top:2px; }
        .mf-hero-venue {
          position:absolute; z-index:2; bottom:28px; left:6%; display:flex; align-items:center; gap:12px;
          min-width:250px; padding:12px 17px; border:1px solid #dbe7f027; border-left:2px solid #e0bf69;
          background:linear-gradient(105deg,#0b192bdc,#0b192b9c);
          box-shadow:0 10px 25px #02071375,inset 0 1px #fff1; backdrop-filter:blur(7px);
          color:#e0bf69;
        }
        .mf-hero-venue > span { display:flex; min-width:0; flex-direction:column; gap:3px; }
        .mf-hero-venue small,.mf-hero-live small { color:#aeb9c7; font:600 7px "DM Mono",monospace; letter-spacing:.12em; }
        .mf-hero-venue strong { color:#f3f3ef; font:600 15px "Oswald",sans-serif; letter-spacing:.02em; }
        .mf-hero-venue em { color:#b1bdca; font-size:9px; font-style:normal; }
        .mf-hero-live {
          position:absolute; z-index:2; right:6%; bottom:39px; display:flex; align-items:center; gap:10px;
          padding:9px 13px; border:1px solid #9ecaa945; border-radius:3px;
          background:linear-gradient(110deg,#102a27e8,#0a1928df);
          box-shadow:0 8px 23px #02071370,inset 0 1px #ffffff10;
        }
        .mf-hero-live > span:last-child { display:flex; flex-direction:column; gap:3px; }
        .mf-hero-live strong { color:#b8dabc; font:600 9px "DM Mono",monospace; letter-spacing:.04em; }
        .mf-hero-live .mf-live-dot { width:8px; height:8px; box-shadow:0 0 0 4px #83b78f2b,0 0 13px #83b78f88; }
        .mf-main-grid {
          display:grid; grid-template-columns:minmax(250px,.72fr) minmax(0,1.8fr); align-items:stretch; gap:16px;
          padding:24px; background:
            radial-gradient(ellipse at 48% 0%,#172d49a0,transparent 62%),
            linear-gradient(180deg,#091727,#071321);
        }
        .mf-timeline {
          min-height:100%; padding:22px 20px 23px; border:1px solid #dce8f01b; border-left:3px solid #b6384c;
          border-radius:5px; background:
            radial-gradient(ellipse at 15% 0%,#263d5a9c,transparent 58%),
            linear-gradient(155deg,#162b46 0%,#0c1b2e 78%);
          box-shadow:0 15px 28px #02081373,inset 0 1px #ffffff0d,inset 0 -1px #0005;
        }
        .mf-timeline-heading { padding-bottom:13px; border-bottom:1px solid #dce8f01a; }
        .mf-timeline-caption { padding:4px 6px; border:1px solid #e0bf6935; color:#d6c17f; }
        .mf-timeline-track {
          display:flex; flex-direction:column; gap:25px; margin-top:21px; padding:4px 0 0;
        }
        .mf-timeline-line {
          top:18px; bottom:18px; left:17px; right:auto; width:2px; height:auto; border-radius:2px;
          background:linear-gradient(180deg,#c94b58,#e0bf69 72%,#e0bf6940);
          box-shadow:0 0 12px #d29d5b49;
        }
        .mf-timeline-line i { top:0; left:-1px; width:4px; height:100%; background:linear-gradient(180deg,#d54356,#f0d681); box-shadow:0 0 10px #d7ae5b75; }
        .mf-timeline-line b { display:none; }
        .mf-milestone,.mf-milestone:nth-of-type(2),.mf-milestone-final {
          display:grid; grid-template-columns:35px 1fr; grid-template-rows:auto auto; align-items:center;
          gap:2px 13px; padding:0; text-align:left;
        }
        .mf-milestone-dot { grid-column:1; grid-row:1 / span 2; margin:0; }
        .mf-milestone small { grid-column:2; grid-row:1; }
        .mf-milestone strong { grid-column:2; grid-row:2; }
        .mf-milestone-final .mf-milestone-dot { width:35px; height:35px; }
        .mf-stakes {
          grid-template-columns:minmax(0,.84fr) minmax(0,1.16fr); gap:18px; align-content:center;
          min-height:100%; padding:23px 22px 21px; border:1px solid #e0bf6940; border-radius:5px;
          background:
            radial-gradient(ellipse at 80% 0%,#39527770 0%,transparent 52%),
            linear-gradient(145deg,#192e49 0%,#102138 57%,#0c1a2d 100%);
          box-shadow:0 18px 34px #02081380,inset 0 1px #ffffff15,inset 0 -1px #02081380;
        }
        .mf-compact-label { color:#9cacc0; }
        .mf-field-visual { gap:16px; margin-top:28px; }
        .mf-field-ring { width:128px; height:128px; }
        .mf-field-copy > strong { font-size:17px; }
        .mf-field-foot { margin-top:12px; }
        .mf-prize-feature {
          grid-template-columns:minmax(0,1.14fr) minmax(95px,.86fr); align-self:stretch; gap:10px;
          min-width:0; padding-left:20px; border-left:1px solid #e0bf6949;
          background:radial-gradient(ellipse at 32% 44%,#c49a4630 0%,transparent 64%);
        }
        .mf-prize-copy { min-width:0; padding-right:10px; }
        .mf-prize-copy > strong { font-size:clamp(42px,4.7vw,68px); }
        .mf-prize-trophy { font-size:7px; }
        .mf-format-feature { padding-left:15px; }
        .mf-format-feature > strong { font-size:58px; }
        .mf-entry {
          padding:13px 30px; border-top:1px solid #dce8f014; border-bottom:1px solid #dce8f014;
          background:linear-gradient(90deg,#0a1829,#0d1b2c 50%,#091626);
        }
        .mf-entry-heading { margin:0 0 6px; }
        .mf-entry-grid { max-width:820px; border-top:0; }
        .mf-player-state { min-height:49px; padding-top:7px; padding-bottom:5px; }
        .mf-player-state:last-child { border-left:1px solid #dce8f01a; }
        .mf-cost {
          margin:0 24px 22px; grid-template-columns:minmax(275px,.72fr) minmax(0,1.28fr); gap:35px;
          padding:24px 26px 25px; border:1px solid #d7e3ef22; border-top:2px solid #e0bf69;
          border-radius:5px; background:
            radial-gradient(ellipse at 12% 0%,#3349698c,transparent 51%),
            linear-gradient(135deg,#172b45 0%,#102039 58%,#0b192c 100%);
          box-shadow:0 17px 30px #0208138c,inset 0 1px #ffffff14,inset 0 -1px #02081388;
        }
        .mf-cost-lead { min-width:0; }
        .mf-cost-totals { display:grid; grid-template-columns:1fr .72fr; align-items:end; width:100%; gap:14px; margin-top:11px; }
        .mf-player-total,.mf-sponsor-total { display:flex; min-width:0; flex-direction:column; align-items:flex-start; }
        .mf-player-total small,.mf-sponsor-total small { color:#9dacbd; font:600 7px "DM Mono",monospace; letter-spacing:.1em; }
        .mf-total { margin-top:4px; font-size:clamp(52px,5.1vw,69px); }
        .mf-sponsor-total { padding:0 0 6px 15px; border-left:1px solid #a8cfa14a; }
        .mf-sponsor-total strong { margin-top:6px; color:#b9d9b8; font:600 29px "Oswald",sans-serif; text-shadow:0 3px 15px #77bc844a; }
        .mf-cost-caption { margin-top:7px; }
        .mf-prize-quick { max-width:350px; margin-top:14px; padding:10px 12px; border:1px solid #e0bf6935; background:linear-gradient(100deg,#302c248c,#101f33); }
        .mf-cost-breakdown { min-width:0; padding-left:24px; border-left:1px solid #dce8f022; }
        .mf-cost-labels { grid-template-columns:minmax(85px,1fr) 68px 78px 78px; }
        .mf-cost-row { grid-template-columns:minmax(85px,1fr) 68px 78px 78px; min-height:42px; border-bottom:1px solid #dce8f016; }
        .mf-cost-row:last-of-type { border-bottom:1px solid #e0bf6929; }
        .mf-cost-foot { padding:9px 10px 0; border:0; }
        .mf-actions { margin:0 24px; border:1px solid #dce8f017; border-radius:4px 4px 0 0; }
        @media (max-width:900px) {
          .mf-main-grid { grid-template-columns:minmax(225px,.68fr) minmax(0,1.32fr); gap:11px; padding:16px; }
          .mf-stakes { grid-template-columns:1fr; gap:22px; }
          .mf-prize-feature { min-height:156px; border-top:1px solid #e0bf6935; border-left:0; padding:17px 0 0; }
          .mf-cost { margin:0 16px 16px; gap:20px; padding:21px 19px; }
          .mf-cost-breakdown { padding-left:16px; }
        }
        @media (max-width:680px) {
          .mf-hero { min-height:490px; }
          .mf-hero-copy { bottom:123px; }
          .mf-hero h1 { font-size:clamp(54px,12vw,76px); }
          .mf-date-stamp { top:91px; right:8%; width:120px; height:140px; }
          .mf-main-grid { grid-template-columns:1fr; padding:13px; }
          .mf-timeline { min-height:0; padding:18px 17px; }
          .mf-timeline-track { gap:17px; margin-top:16px; }
          .mf-stakes { grid-template-columns:minmax(0,.84fr) minmax(0,1.16fr); gap:12px; min-height:0; padding:18px 15px; }
          .mf-field-visual { flex-direction:column; align-items:flex-start; gap:12px; margin-top:19px; }
          .mf-field-ring { width:106px; height:106px; align-self:center; }
          .mf-field-copy { width:100%; }
          .mf-prize-feature { grid-template-columns:1fr; min-height:0; gap:15px; padding:13px 0 0; }
          .mf-prize-copy > small { margin-top:14px; }
          .mf-prize-copy > strong { font-size:43px; }
          .mf-prize-trophy { padding-top:10px; }
          .mf-format-feature { padding:12px 0 0; border-top:1px solid #e0bf6933; border-left:0; }
          .mf-format-feature > strong { margin-top:13px; font-size:47px; }
          .mf-entry { padding:11px 18px; }
          .mf-cost { grid-template-columns:1fr; gap:15px; margin:0 13px 13px; padding:20px 16px; }
          .mf-cost-totals { grid-template-columns:1fr .72fr; max-width:370px; }
          .mf-total { font-size:58px; }
          .mf-sponsor-total strong { font-size:27px; }
          .mf-prize-quick { margin-top:12px; }
          .mf-cost-breakdown { border-top:1px solid #dce8f022; border-left:0; padding:14px 0 0; }
          .mf-cost-labels { grid-template-columns:minmax(84px,1fr) 48px 64px 54px; gap:5px; }
          .mf-cost-row { grid-template-columns:minmax(84px,1fr) 48px 64px 54px; gap:5px; }
          .mf-actions { margin:0 13px; }
        }
        @media (max-width:420px) {
          .mf-hero { min-height:460px; }
          .mf-hero-copy { bottom:123px; }
          .mf-hero h1 { font-size:52px; }
          .mf-date-stamp { top:91px; right:17px; width:88px; height:101px; }
          .mf-date-stamp strong { font-size:43px; }
          .mf-date-stamp small:last-child { max-width:75px; text-align:center; line-height:1.35; }
          .mf-hero-venue { bottom:15px; left:14px; min-width:0; padding:8px 10px; gap:8px; }
          .mf-hero-venue svg { width:14px; }
          .mf-hero-venue strong { font-size:12px; }
          .mf-hero-venue small { font-size:6px; }
          .mf-hero-venue em { font-size:7px; }
          .mf-hero-live { right:14px; bottom:23px; gap:7px; padding:7px 8px; }
          .mf-hero-live .mf-live-dot { width:6px; height:6px; }
          .mf-hero-live small { font-size:6px; }
          .mf-hero-live strong { font-size:7px; }
          .mf-main-grid { gap:10px; padding:10px; }
          .mf-timeline { padding:16px 14px; }
          .mf-stakes { gap:9px; padding:15px 11px; }
          .mf-compact-label { font-size:6px; letter-spacing:.07em; }
          .mf-field-ring { width:90px; height:90px; }
          .mf-ring-copy strong { font-size:30px; }
          .mf-field-copy > small { font-size:5px; }
          .mf-field-copy > strong { font-size:13px; }
          .mf-threshold { margin-top:12px; }
          .mf-threshold-label strong { font-size:13px; }
          .mf-field-foot { align-items:flex-start; font-size:6px; line-height:1.4; }
          .mf-prize-copy > strong { font-size:37px; }
          .mf-prize-trophy { font-size:5px; letter-spacing:.03em; }
          .mf-prize-trophy svg { width:12px; }
          .mf-format-feature > strong { font-size:40px; }
          .mf-format-feature > small { font-size:7px; }
          .mf-entry { padding:10px 15px; }
          .mf-player-state { gap:5px; }
          .mf-player-state:last-child { padding-left:7px; }
          .mf-player-state small { font-size:5px; }
          .mf-player-state strong { font-size:10px; }
          .mf-state-mark { width:22px; height:22px; }
          .mf-open-tag { font-size:5px; }
          .mf-cost { margin:0 10px 10px; padding:17px 12px; }
          .mf-cost-totals { grid-template-columns:1fr .66fr; gap:9px; }
          .mf-player-total small,.mf-sponsor-total small { font-size:6px; letter-spacing:.07em; }
          .mf-total { font-size:53px; }
          .mf-sponsor-total { padding-left:9px; }
          .mf-sponsor-total strong { font-size:23px; }
          .mf-cost-labels { grid-template-columns:minmax(70px,1fr) 43px 57px 48px; font-size:5px; }
          .mf-cost-row { grid-template-columns:minmax(70px,1fr) 43px 57px 48px; gap:4px; font-size:8px; }
          .mf-cost-row b,.mf-cost-row strong { font-size:10px; }
          .mf-cost-row i { font-size:7px; }
          .mf-cost-foot { padding-right:4px; padding-left:4px; font-size:8px; }
          .mf-actions { margin:0 10px; padding:15px 12px; }
        }
        /* A high-contrast 3D pass: bevels, directional light, real elevation,
           and metallic focal points are intentionally visible at a glance. */
        .mf-hero {
          position:relative; isolation:isolate; overflow:hidden;
          box-shadow:0 42px 70px #020710c4,0 15px 28px #0309149e,inset 0 1px #fff2;
        }
        .mf-hero::before {
          position:absolute; z-index:0; inset:0; pointer-events:none; content:"";
          background:
            linear-gradient(112deg,transparent 10%,#d9bd6b09 32%,transparent 56%),
            linear-gradient(126deg,transparent 42%,#f0cf7840 57%,#edc9631d 64%,transparent 72%),
            linear-gradient(140deg,transparent 50%,#ffffff13 56%,transparent 65%);
          mix-blend-mode:screen;
        }
        .mf-hero::after {
          position:absolute; z-index:0; inset:0; pointer-events:none; content:"";
          background:
            radial-gradient(ellipse at 76% -12%,#ffdd8b55 0%,#f4d27a23 17%,transparent 38%),
            radial-gradient(ellipse at 93% 48%,#b73c4a40 0%,transparent 40%),
            linear-gradient(180deg,transparent 54%,#020b17a8 100%);
        }
        .mf-image-shade {
          background:
            radial-gradient(ellipse at 77% 1%,#f4d27a38 0%,transparent 24%),
            radial-gradient(ellipse at 82% 56%,#bd394c33 0%,transparent 39%),
            linear-gradient(90deg,#071321fc 0%,#071321e8 27%,#0713219d 51%,#07132115 100%),
            linear-gradient(0deg,#071321f7 0%,#07132124 44%,transparent 75%),
            linear-gradient(180deg,#071321b0 0%,transparent 37%);
        }
        .mf-hero-copy,.mf-hero-meta,.mf-date-stamp,.mf-hero-venue,.mf-hero-live { z-index:2; }
        .mf-date-stamp {
          top:82px; right:7%; isolation:isolate; overflow:visible;
          transform:perspective(850px) rotateY(-7deg) rotateX(3deg);
          border:1px solid #fff0ad; border-radius:50%;
          background:
            radial-gradient(circle at 31% 21%,#43506a 0%,#263955 28%,#162840 59%,#081626 100%);
          box-shadow:
            0 25px 42px #010711cf,0 14px 25px #020916a6,
            0 0 0 2px #a87b2f,0 0 0 6px #f2d77e,
            0 0 0 9px #744e20,0 0 0 12px #f1d9806c,
            inset 0 4px 7px #fff9,inset 0 -17px 23px #020914bb,
            inset 7px 0 12px #fff2,inset -8px 0 14px #0208139c;
        }
        .mf-date-stamp::before {
          position:absolute; z-index:-1; inset:-13px; border-radius:50%; content:"";
          border:5px solid transparent;
          background:
            linear-gradient(#0b1929,#0b1929) padding-box,
            conic-gradient(from 215deg,#61451b,#f9e9a8 15%,#9a6c23 27%,#ffeaa0 42%,#76501b 58%,#ebcb6e 74%,#5c401a 88%,#e9ce7a) border-box;
          box-shadow:0 18px 28px #0107119c,0 0 25px #f2d2733e,inset 0 1px #fff8;
        }
        .mf-date-stamp::after {
          position:absolute; inset:12px; border:1px solid #f8e6a366; border-radius:50%;
          background:linear-gradient(145deg,#ffffff12,transparent 36%,#02091429 80%);
          box-shadow:0 1px #fff4 inset,0 -2px #02081366 inset; content:""; pointer-events:none;
        }
        .mf-date-stamp > * { position:relative; z-index:1; }
        .mf-date-stamp strong {
          color:#ffe79a;
          text-shadow:0 1px #fff9,0 3px 0 #b98a35,0 5px 0 #72521e,0 10px 15px #010711b8;
        }
        .mf-date-stamp span { color:#f4d877; text-shadow:0 2px 0 #76571f,0 4px 8px #020813a8; }
        .mf-hero-venue {
          border:1px solid #e6d18d68; border-left:3px solid #f0d27b;
          background:linear-gradient(112deg,#18304bdd 0%,#0b1a2dde 65%,#071321cb 100%);
          box-shadow:0 16px 30px #0107119c,0 4px 10px #020813a6,inset 0 2px #ffffff2b,inset 0 -3px #0208138c;
          transform:perspective(700px) rotateY(3deg) translateZ(8px);
        }
        .mf-hero-live {
          border:1px solid #a9d2ac8a;
          background:linear-gradient(125deg,#1b4438 0%,#10352e 38%,#0b1c2d 100%);
          box-shadow:0 15px 28px #010711a1,0 3px 8px #020813b3,inset 0 2px #e7ffe341,inset 0 -3px #020e17a6;
        }
        .mf-main-grid {
          position:relative; isolation:isolate;
          background:
            radial-gradient(ellipse at 50% 0%,#233d5e9c 0%,transparent 56%),
            linear-gradient(180deg,#0b1c30 0%,#071321 94%);
          box-shadow:inset 0 1px #dbe7f01a,inset 0 12px 26px #02081348;
        }
        .mf-timeline {
          border:1px solid #7991ad55; border-left:4px solid #c33c50;
          background:
            linear-gradient(112deg,#ffffff13 0%,transparent 14%),
            radial-gradient(ellipse at 9% 0%,#476184 0%,#213b5b 26%,transparent 63%),
            linear-gradient(155deg,#192f4c 0%,#10233b 60%,#0b1b2f 100%);
          box-shadow:
            0 28px 43px #010813a6,0 12px 21px #020916ad,
            0 0 0 1px #d3e1f01a,inset 0 2px #fff3,inset 0 -5px #020914a6,inset 2px 0 #f2b0a224;
        }
        .mf-timeline-heading { border-bottom-color:#dbe8f032; }
        .mf-timeline-track { filter:drop-shadow(0 4px 5px #01071175); }
        .mf-timeline-line {
          width:4px; left:15px; border-radius:4px;
          background:linear-gradient(90deg,#522e33,#d59060 45%,#ffe394 54%,#8a6530 100%);
          box-shadow:0 0 13px #e0bf6970,2px 0 4px #020813a8;
        }
        .mf-timeline-line i {
          left:0; width:100%; border-radius:4px;
          background:linear-gradient(90deg,#9d3043,#e96b62 42%,#ffe291 62%,#ac7e2e);
          box-shadow:0 0 15px #e0bf69a1,0 1px #fff9 inset,0 -1px #51351e inset;
        }
        .mf-milestone-dot {
          border:2px solid #f0d27b;
          background:radial-gradient(circle at 31% 22%,#52637b 0%,#203750 38%,#0b1b2f 83%);
          box-shadow:0 9px 15px #010711aa,0 0 0 3px #e0bf692e,0 0 14px #d9b45d59,inset 0 2px #fff8,inset 0 -4px #020914b5;
          text-shadow:0 2px 5px #000b;
        }
        .mf-milestone:nth-of-type(2) .mf-milestone-dot {
          border-color:#ffc967;
          background:radial-gradient(circle at 30% 20%,#755037 0%,#3d3340 42%,#0c1a2d 85%);
          box-shadow:0 9px 15px #010711aa,0 0 0 3px #d7a64b30,0 0 16px #ecad4f70,inset 0 2px #fff8,inset 0 -4px #020914b5;
        }
        .mf-milestone-final .mf-milestone-dot {
          border-color:#fff0a0;
          background:radial-gradient(circle at 31% 22%,#827044 0%,#504225 40%,#111a29 86%);
          box-shadow:0 10px 18px #010711bb,0 0 0 4px #e0bf6940,0 0 22px #edcc6b88,inset 0 2px #fff9,inset 0 -4px #020914b8;
        }
        .mf-stakes {
          position:relative; isolation:isolate;
          border:1px solid #a6b7cc68;
          background:
            linear-gradient(110deg,#ffffff12 0%,transparent 15%),
            radial-gradient(ellipse at 76% -8%,#6882a859 0%,transparent 49%),
            linear-gradient(143deg,#233d5b 0%,#172f4b 40%,#10233a 74%,#0b1b2e 100%);
          box-shadow:
            0 31px 49px #010711b5,0 13px 23px #020916a8,
            0 0 0 1px #dbe7f023,inset 0 2px #fff5,inset 0 -6px #020914a8;
          transform:perspective(1500px) rotateY(-.45deg) translateZ(4px);
        }
        .mf-stakes::before {
          position:absolute; z-index:-1; top:0; right:12%; left:12%; height:2px; content:"";
          background:linear-gradient(90deg,transparent,#f2d886,#fff5c5,#d4a953,transparent);
          box-shadow:0 0 15px #edcb7877;
        }
        .mf-field-ring {
          border:1px solid #ffe99a;
          background:conic-gradient(from 4deg,#f16c67 0deg,#a52d47 90deg,#ffed9a 91deg,#d2a541 198deg,#ffeba0 315deg,#4f627a 316deg,#263950 360deg);
          box-shadow:
            0 16px 22px #010711b3,0 7px 14px #020813a8,
            0 0 0 4px #b991464a,0 0 0 6px #f4d87b74,0 0 18px #e8c45c6b,
            inset 0 3px #fff9,inset 0 -7px #573b21a6;
        }
        .mf-field-ring::before {
          inset:9px; border:1px solid #d9e1e942;
          background:radial-gradient(circle at 32% 22%,#526681 0%,#243c58 29%,#13273d 58%,#081727 100%);
          box-shadow:0 4px 9px #010711b8,inset 0 5px 14px #020813c9,inset 0 1px #fff8,inset 0 -4px #0208139c;
        }
        .mf-field-ring::after {
          inset:4px; border:2px solid #ffe89b82;
          box-shadow:0 2px #fff8 inset,0 -3px #553b20 inset,0 0 8px #f3d47b54;
        }
        .mf-ring-copy strong { color:#fff6d8; text-shadow:0 1px #fff9,0 3px 0 #718099,0 6px 9px #020813c9; }
        .mf-prize-feature {
          background:
            radial-gradient(circle at 36% 51%,#f1cb6b2b 0%,#bd8d3b19 29%,transparent 64%),
            linear-gradient(120deg,#ffffff05,transparent 55%);
        }
        .mf-prize-copy { isolation:isolate; }
        .mf-prize-copy::before {
          position:absolute; z-index:-1; top:52px; left:36px; width:126px; height:126px;
          border:5px solid #e7c96d; border-radius:50%; content:"";
          background:
            radial-gradient(circle at 32% 20%,#fff4bd84 0%,#dfb74858 21%,#885d2678 48%,#14243a 72%);
          box-shadow:0 16px 22px #01071185,0 0 0 3px #876323,0 0 0 5px #f4d98568,0 0 22px #f0ce6b65,inset 0 3px #fff9,inset 0 -9px 14px #020813b8;
          opacity:.68;
        }
        .mf-prize-copy > strong {
          color:#ffe394;
          text-shadow:0 1px #fff9,0 3px 0 #be9138,0 6px 0 #75511f,0 11px 17px #020813c9,0 0 24px #e5c36679;
          filter:drop-shadow(0 8px 8px #02081372);
        }
        .mf-prize-trophy { border-top-color:#f2d67c70; text-shadow:0 2px 5px #020813b3; }
        .mf-format-feature > strong {
          color:#fff4c4;
          text-shadow:0 1px #fff,0 3px 0 #8b7851,0 6px 0 #4c4a43,0 12px 18px #020813c9;
        }
        .mf-entry { box-shadow:inset 0 1px #dbe7f016,inset 0 -1px #020813a1; }
        .mf-cost {
          position:relative; isolation:isolate;
          border:1px solid #b8c5d57a; border-top:2px solid #f4dc8b;
          background:
            linear-gradient(115deg,#ffffff12 0%,transparent 18%),
            radial-gradient(ellipse at 11% -6%,#607ca47a 0%,transparent 48%),
            linear-gradient(135deg,#203a59 0%,#152c48 42%,#10223b 73%,#0b1a2d 100%);
          box-shadow:
            0 35px 58px #010711d1,0 17px 28px #020916bb,0 4px 8px #0009,
            0 0 0 1px #dbe7f02b,inset 0 2px #fff6,inset 0 -7px #020914b0;
          transform:perspective(1400px) rotateX(.65deg) translateY(-4px);
        }
        .mf-cost::before {
          z-index:2; top:0; left:4%; width:42%; height:2px;
          background:linear-gradient(90deg,transparent,#fff2b4,#f0c85b,transparent);
          box-shadow:0 0 16px #f0cc6c99;
        }
        .mf-cost::after {
          position:absolute; z-index:-1; top:13px; bottom:13px; left:0; width:3px; content:"";
          background:linear-gradient(180deg,#fff1b6,#d4a846 35%,#883a4c 76%,#273e5d);
          box-shadow:3px 0 9px #dfbb635c;
        }
        .mf-cost-totals { padding:11px 12px 13px; border:1px solid #dbe7f025; border-radius:3px; background:linear-gradient(135deg,#10233b80,#0a192c); box-shadow:0 8px 14px #02081373,inset 0 1px #fff3,inset 0 -3px #0208138c; }
        .mf-player-total small { color:#f0d57d; }
        .mf-total { color:#fff2c7; text-shadow:0 1px #fff9,0 3px 0 #8d7548,0 6px 0 #49493f,0 12px 20px #020813ce; }
        .mf-sponsor-total {
          padding:8px 0 7px 13px; border-left:1px solid #a8d2ad7a;
          background:linear-gradient(135deg,#1e443b80,#10282040);
        }
        .mf-sponsor-total strong {
          color:#c4e9c5; text-shadow:0 1px #f2fff2,0 3px 0 #56855b,0 7px 13px #020813b8;
        }
        .mf-cost-breakdown {
          border-left-color:#e1cc8f53;
          filter:drop-shadow(0 8px 9px #02081345);
        }
        .mf-cost-labels { border-bottom-color:#e7d7ad65; text-shadow:0 1px #020813; }
        .mf-cost-row {
          min-height:44px; border-bottom-color:#dbe7f024;
          background:linear-gradient(100deg,#ffffff0a 0%,#ffffff02 46%,#e0bf690e 100%);
          box-shadow:0 1px #fff1 inset,0 -1px #02081332 inset;
        }
        .mf-cost-row strong { color:#ffe292; text-shadow:0 1px #fff6,0 3px 8px #020813d1; }
        .mf-cost-row i { color:#c2e6be; text-shadow:0 1px #020813; }
        .mf-cost-foot {
          margin-top:10px; padding:10px 12px; border:1px solid #e3c66c45;
          background:linear-gradient(100deg,#2e3540,#14263b);
          box-shadow:0 8px 12px #02081370,inset 0 1px #fff3,inset 0 -2px #02081375;
        }
        .mf-cost-foot strong { color:#d0ebc9; text-shadow:0 1px #fff6,0 3px 8px #020813bd; }
        .mf-actions {
          background:linear-gradient(110deg,#0b1a2c,#14253b 52%,#091727);
          box-shadow:0 25px 45px #010711ad,inset 0 2px #fff2,inset 0 -4px #020914a8;
        }
        .mf-enter {
          border-color:#f07a78;
          background:linear-gradient(180deg,#f05b63 0%,#c5354b 48%,#96243b 100%);
          box-shadow:0 12px 20px #030914a6,0 4px 8px #7b1d31a1,inset 0 2px #fff6,inset 0 -4px #661728;
        }
        .mf-details-link { box-shadow:0 9px 16px #02081387,inset 0 2px #fff2,inset 0 -2px #0208138c; }
        @media (max-width:680px) {
          .mf-hero::before { background:linear-gradient(120deg,transparent 15%,#d9bd6b17 49%,transparent 75%); }
          .mf-date-stamp { top:91px; transform:perspective(650px) rotateY(-5deg) rotateX(2deg); }
          .mf-cost { transform:none; }
          .mf-stakes { transform:none; }
        }
        @media (max-width:420px) {
          .mf-date-stamp { top:91px; right:17px; width:88px; height:101px; }
          .mf-date-stamp::before { inset:-8px; border-width:4px; }
          .mf-date-stamp::after { inset:7px; }
          .mf-date-stamp strong { font-size:43px; }
          .mf-prize-copy::before { top:39px; left:20px; width:84px; height:84px; border-width:4px; }
          .mf-cost-totals { padding:9px 8px 10px; }
        }
        /* Fit and clarity pass: keep the raised surfaces, remove haze from
           type and trim every decorative effect back to a crisp edge. */
        .mf-page,.mf-dossier,.mf-main-grid,.mf-timeline,.mf-stakes,.mf-field,.mf-prize-feature,
        .mf-prize-copy,.mf-format-feature,.mf-cost,.mf-cost-lead,.mf-cost-breakdown,.mf-actions {
          min-width:0;
        }
        .mf-hero { box-shadow:0 18px 30px #02081382,inset 0 1px #ffffff12; }
        .mf-hero::before {
          background:linear-gradient(116deg,transparent 16%,#d9bd6b08 45%,transparent 73%);
          mix-blend-mode:normal;
        }
        .mf-hero::after {
          background:
            radial-gradient(ellipse at 76% -7%,#f5d78a2b 0%,transparent 27%),
            radial-gradient(ellipse at 89% 48%,#b73c4a21 0%,transparent 39%),
            linear-gradient(180deg,transparent 57%,#020b177a 100%);
        }
        .mf-image-shade {
          background:
            radial-gradient(ellipse at 77% 1%,#f4d27a24 0%,transparent 25%),
            radial-gradient(ellipse at 82% 56%,#bd394c1f 0%,transparent 39%),
            linear-gradient(90deg,#071321fc 0%,#071321e8 27%,#0713219d 51%,#07132115 100%),
            linear-gradient(0deg,#071321f7 0%,#07132124 44%,transparent 75%),
            linear-gradient(180deg,#071321b0 0%,transparent 37%);
        }
        .mf-date-stamp {
          transform:none;
          border:1px solid #f6e19e;
          box-shadow:0 15px 24px #020813a1,inset 0 1px #fff8,inset 0 -4px #020813a6;
        }
        .mf-date-stamp::before {
          inset:-7px; border-width:3px;
          background:
            linear-gradient(#0b1929,#0b1929) padding-box,
            conic-gradient(from 215deg,#78551f,#f2d77d 18%,#a5772c 35%,#f6e39b 52%,#79561f 72%,#e1bd60) border-box;
          box-shadow:0 5px 9px #02081380;
        }
        .mf-date-stamp::after {
          border-color:#f8e6a34a; background:linear-gradient(145deg,#ffffff0a,transparent 38%,#02091420 82%);
          box-shadow:0 1px #fff5 inset;
        }
        .mf-date-stamp strong {
          text-shadow:0 1px #fff9,0 2px 0 #8a6829,0 4px 7px #020813a8;
        }
        .mf-date-stamp span { text-shadow:0 1px #816126,0 3px 6px #02081385; }
        .mf-hero-venue {
          transform:none;
          box-shadow:0 10px 18px #02081385,inset 0 1px #ffffff20;
          backdrop-filter:none;
        }
        .mf-hero-live { box-shadow:0 8px 14px #02081380,inset 0 1px #ffffff20; }
        .mf-main-grid { overflow:hidden; }
        .mf-timeline {
          box-shadow:0 15px 24px #020813a1,inset 0 1px #ffffff18,inset 0 -2px #02081384;
        }
        .mf-timeline-track { filter:none; }
        .mf-timeline-line { box-shadow:0 1px 3px #0208138c; }
        .mf-timeline-line i { box-shadow:0 1px #fff7 inset; }
        .mf-milestone-dot,.mf-milestone:nth-of-type(2) .mf-milestone-dot,.mf-milestone-final .mf-milestone-dot {
          box-shadow:0 5px 8px #0208138f,inset 0 1px #fff8,inset 0 -2px #0208139c;
        }
        .mf-stakes {
          transform:none;
          box-shadow:0 18px 30px #020813a8,0 0 0 1px #dbe7f026,inset 0 1px #fff5,inset 0 -3px #0209148c;
        }
        .mf-stakes::before { height:1px; box-shadow:none; }
        .mf-field-ring {
          box-shadow:0 10px 17px #020813a8,0 0 0 2px #d6b251,inset 0 1px #fff9,inset 0 -4px #573b21a6;
        }
        .mf-field-ring::before {
          box-shadow:inset 0 3px 8px #020813a8,inset 0 1px #fff8,inset 0 -3px #02081380;
        }
        .mf-field-ring::after {
          border-width:1px; box-shadow:0 1px #fff8 inset,0 -1px #553b20 inset;
        }
        .mf-ring-copy strong { text-shadow:0 1px #fff9,0 2px 0 #52647b,0 4px 7px #020813a8; }
        .mf-prize-copy::before { display:none; }
        .mf-prize-copy > strong {
          font-size:clamp(40px,4.8vw,62px);
          text-shadow:0 1px #fff8,0 2px 0 #9a762c,0 4px 8px #020813a8;
          filter:none;
        }
        .mf-format-feature > strong { text-shadow:0 1px #fff9,0 2px 0 #766747,0 5px 9px #020813a1; }
        .mf-cost {
          transform:none;
          box-shadow:0 20px 34px #020813b0,0 0 0 1px #dbe7f02b,inset 0 1px #fff6,inset 0 -3px #020914a0;
        }
        .mf-cost-totals {
          box-shadow:0 7px 11px #0208137a,inset 0 1px #fff3,inset 0 -2px #02081383;
        }
        .mf-total { text-shadow:0 1px #fff8,0 2px 0 #786344,0 5px 8px #020813a8; }
        .mf-sponsor-total strong { text-shadow:0 1px #f5fff5,0 2px 0 #55785b,0 5px 8px #0208139e; }
        .mf-cost-breakdown { filter:none; }
        .mf-cost-row { box-shadow:0 1px #fff2 inset,0 -1px #02081336 inset; }
        .mf-cost-row strong { text-shadow:0 1px #fff4,0 3px 6px #0208139c; }
        .mf-cost-foot { box-shadow:0 4px 7px #02081380,inset 0 1px #fff4,inset 0 -1px #02081375; }
        .mf-actions { box-shadow:0 12px 22px #02081385,inset 0 1px #fff3,inset 0 -2px #02091494; }
        .mf-enter { box-shadow:0 7px 12px #0208139c,inset 0 1px #fff7,inset 0 -2px #661728; }
        .mf-details-link { box-shadow:0 5px 9px #02081380,inset 0 1px #fff3,inset 0 -1px #02081370; }
        .mf-details-link { flex:0 0 auto; min-width:max-content; white-space:nowrap; }
        @media (max-width:900px) {
          .mf-hero { min-height:500px; }
          .mf-hero-copy { max-width:64%; bottom:112px; }
          .mf-hero h1 { font-size:clamp(58px,8.2vw,82px); }
          .mf-date-stamp { top:82px; right:5%; width:132px; height:158px; }
          .mf-date-stamp strong { font-size:70px; }
          .mf-hero-venue { left:5%; }
          .mf-hero-live { right:5%; }
          .mf-timeline-heading { gap:5px; }
          .mf-timeline-heading .mf-section-index { font-size:7px; letter-spacing:.08em; }
          .mf-timeline-caption { font-size:7px; }
          .mf-cost-labels { grid-template-columns:minmax(0,1fr) 62px 67px 68px; gap:6px; }
          .mf-cost-row { grid-template-columns:minmax(0,1fr) 62px 67px 68px; gap:6px; }
        }
        @media (max-width:680px) {
          .mf-hero { min-height:490px; }
          .mf-hero-copy { max-width:100%; bottom:123px; }
          .mf-hero h1 { font-size:clamp(54px,12vw,76px); }
          .mf-date-stamp { top:91px; right:8%; width:120px; height:140px; transform:none; }
          .mf-date-stamp strong { font-size:60px; }
          .mf-stakes { transform:none; }
          .mf-cost { transform:none; }
          .mf-prize-copy > strong { font-size:clamp(37px,8vw,48px); }
          .mf-player-total small,.mf-sponsor-total small { font-size:7px; }
          .mf-cost-labels { grid-template-columns:minmax(0,1fr) 48px 64px 54px; gap:5px; }
          .mf-cost-row { grid-template-columns:minmax(0,1fr) 48px 64px 54px; gap:5px; }
          .mf-cost-row > span { overflow-wrap:anywhere; }
        }
        @media (max-width:420px) {
          .mf-hero { min-height:460px; }
          .mf-hero h1 { font-size:52px; }
          .mf-date-stamp { top:91px; right:17px; width:88px; height:101px; }
          .mf-date-stamp::before { inset:-6px; border-width:2px; }
          .mf-date-stamp::after { inset:7px; }
          .mf-date-stamp strong { font-size:43px; }
          .mf-milestone small { font-size:7px; }
          .mf-milestone strong { font-size:12px; }
          .mf-compact-label { font-size:7px; }
          .mf-field-copy > small { font-size:6px; }
          .mf-player-state small { font-size:7px; letter-spacing:.025em; }
          .mf-open-tag { font-size:6px; }
          .mf-cost-totals { grid-template-columns:minmax(0,1fr) minmax(0,.72fr); }
          .mf-cost-labels { grid-template-columns:minmax(0,1fr) 44px 58px 51px; gap:4px; font-size:7px; }
          .mf-cost-row { grid-template-columns:minmax(0,1fr) 44px 58px 51px; gap:4px; font-size:9px; }
          .mf-cost-row b,.mf-cost-row strong { font-size:10px; }
          .mf-cost-row i { font-size:8px; }
        }
      `}</style>
    </main>
  );
}
