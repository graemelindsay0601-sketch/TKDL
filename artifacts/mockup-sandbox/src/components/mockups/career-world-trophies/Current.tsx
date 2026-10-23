import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CircleDot, Trophy } from "lucide-react";

type CabinetWin = {
  eventId: string;
  eventName: string;
  season: number;
  venue: string | null;
  awardName: string;
  trophyImage?: string;
};

const titles: CabinetWin[] = [];
const titleCount = titles.length;
const physicalTitles = titles.filter((win) => Boolean(win.trophyImage));
const resultTitles = titles.filter((win) => !win.trophyImage);
const silverwareWins = physicalTitles.length;
const trophyDesigns = new Set(physicalTitles.map((win) => win.trophyImage)).size;
const resultOnlyWins = resultTitles.length;

export function Current() {
  const [offset, setOffset] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const visibleTitles = titles.slice(offset, offset + 50);

  return (
    <main className="tc-current">
      <style>{`
        .tc-current{--tc-bg:#090c14;--tc-panel:#111725;--tc-gold:#e9c77a;--tc-red:#a82638;min-height:100dvh;padding:clamp(14px,3vw,30px);color:#f4f1e9;background:radial-gradient(ellipse at 92% 0%,#4b26321c,transparent 35%),#090c14;font-family:'DM Sans',sans-serif}
        .tc-current *{box-sizing:border-box}.tc-current__wrap{width:min(1120px,100%);margin:0 auto;display:grid;gap:14px}
        .tc-current__hero{position:relative;overflow:hidden;border-radius:18px;padding:24px 24px 20px;border:1px solid #f2c15a40;background:radial-gradient(60% 120% at 85% 0%,#f2c15a26,transparent 60%),radial-gradient(50% 90% at 10% 100%,#3a5a9a22,transparent 60%),linear-gradient(135deg,#141a26,#090c14)}
        .tc-current__hero:after{content:"";position:absolute;right:-12px;top:-20px;width:190px;height:190px;border:1px solid #e9c77a12;border-radius:50%;box-shadow:0 0 0 18px #e9c77a06,0 0 0 38px #e9c77a04;pointer-events:none}
        .tc-current__eyebrow{font-family:Oswald,'Arial Narrow',sans-serif;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#f2c15a}
        .tc-current h1{font-family:Oswald,'Arial Narrow',sans-serif;font-size:clamp(1.75rem,5vw,2.6rem);text-transform:uppercase;line-height:1;margin:5px 0 8px;color:#fff;font-weight:600}
        .tc-current__hero p{color:#ffffffb3;font-size:.9rem;max-width:62ch;margin:0}
        .tc-current__stats{display:flex;gap:0;flex-wrap:wrap;margin-top:24px;border-top:1px solid #ffffff17;padding-top:14px}
        .tc-current__stat{min-width:130px;padding:0 20px 0 0;margin-right:20px;border-right:1px solid #ffffff17}.tc-current__stat:last-child{border:0}
        .tc-current__stat b{display:block;font-family:Oswald,sans-serif;color:#e9c77a;font-size:1.35rem;font-weight:500;line-height:1.1;font-variant-numeric:tabular-nums}
        .tc-current__stat span{font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;color:#ffffff8c}
        .tc-current__cabinet{position:relative;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:14px;padding:18px;border-radius:18px;background:linear-gradient(180deg,#0d1220,#070a12);border:1px solid #ffffff12;box-shadow:inset 0 1px 0 #ffffff0d}
        .tc-current__empty{grid-column:1/-1;min-height:188px;display:grid;place-items:center;text-align:center;padding:24px 18px;border:1px dashed #ffffff22;border-radius:14px;color:#ffffffa6}
        .tc-current__empty-inner{max-width:390px}.tc-current__empty-mark{width:48px;height:48px;margin:0 auto 12px;border:1px solid #e9c77a49;border-radius:50%;display:grid;place-items:center;color:#e9c77a;background:radial-gradient(circle,#e9c77a1a,transparent 72%)}
        .tc-current__empty strong{display:block;font-family:Oswald,sans-serif;text-transform:uppercase;font-size:1.05rem;letter-spacing:.04em;color:#f2ead8;margin-bottom:5px}
        .tc-current__empty p{margin:0;font-size:.82rem;line-height:1.55}
        .tc-current__section{overflow:hidden;border-radius:16px;background:linear-gradient(180deg,#131a28,#0d111b);border:1px solid #ffffff12}
        .tc-current__section-head{display:flex;align-items:center;gap:10px;padding:15px 18px;border-bottom:1px solid #ffffff12}
        .tc-current__section-head h2{font:500 1rem Oswald,sans-serif;text-transform:uppercase;letter-spacing:.06em;margin:0;color:#fff}
        .tc-current__section-head small{margin-left:auto;color:#e9c77a;font:600 .65rem 'DM Sans',sans-serif;text-transform:uppercase;letter-spacing:.11em}
        .tc-current__explain{padding:13px 18px 15px;margin:0;color:#ffffff99;font-size:.82rem;line-height:1.55}
        .tc-current__empty-records{margin:0 14px 14px;padding:12px 14px;border-radius:10px;background:#ffffff06;border:1px solid #ffffff0c;color:#ffffff9e;font-size:.8rem}
        .tc-current__disclosure{border-top:1px solid #ffffff12;padding:0 18px}
        .tc-current__disclosure summary{cursor:pointer;list-style:none;padding:13px 0;color:#e9c77a;font-size:.78rem;display:flex;align-items:center;gap:8px}
        .tc-current__disclosure summary::-webkit-details-marker{display:none}.tc-current__disclosure summary svg{transition:transform .2s}
        .tc-current__disclosure[open] summary svg{transform:rotate(180deg)}.tc-current__disclosure p{font-size:.78rem;color:#ffffff9a;margin:0 0 14px;line-height:1.55}
        .tc-current__pager{display:flex;justify-content:flex-end;gap:8px;padding:4px 2px}
        .tc-current__pager button{display:inline-flex;align-items:center;gap:6px;border:1px solid #ffffff22;background:#111725;color:#f1ecdf;border-radius:9px;padding:9px 12px;font:600 .76rem 'DM Sans',sans-serif}
        .tc-current__pager button:disabled{opacity:.38;cursor:not-allowed}.tc-current__pager button:not(:disabled){cursor:pointer}
        @media(max-width:560px){.tc-current__hero{padding:19px 17px}.tc-current__stats{gap:12px 0}.tc-current__stat{min-width:45%;margin-right:0;padding-right:10px}.tc-current__stat:nth-child(2){border:0}.tc-current__cabinet{padding:12px}.tc-current__empty{min-height:160px}}
      `}</style>
      <div className="tc-current__wrap">
        <header className="tc-current__hero">
          <div className="tc-current__eyebrow">Trophy cabinet</div>
          <h1>{titleCount} recorded titles</h1>
          <p>{silverwareWins ? `${silverwareWins} brought home silverware.` : "No silverware yet."} Every title here is a real win; repeat wins stay separate.</p>
          <div className="tc-current__stats" aria-label="Cabinet summary">
            <div className="tc-current__stat"><b>{titleCount}</b><span>Titles</span></div>
            <div className="tc-current__stat"><b>{silverwareWins}</b><span>With silverware</span></div>
            <div className="tc-current__stat"><b>{trophyDesigns}</b><span>Trophy designs</span></div>
            <div className="tc-current__stat"><b>{resultOnlyWins}</b><span>Result-only wins</span></div>
          </div>
        </header>

        <section className="tc-current__cabinet" aria-label="Silverware">
          {visibleTitles.filter((win) => win.trophyImage).map((win) => (
            <article className="tc-current__empty" key={win.eventId}>
              <div className="tc-current__empty-inner">
                <img src={win.trophyImage} alt={win.awardName} />
                <strong>{win.eventName}</strong>
                <p>{win.awardName} · 1 recorded win</p>
                <details className="tc-current__disclosure">
                  <summary>Inspect individual wins <ChevronDown size={14} /></summary>
                  <p><a href={`#${win.eventId}`}>Season {win.season} · {win.venue ?? "Venue not recorded"} · {win.awardName}</a></p>
                </details>
              </div>
            </article>
          ))}
          {!visibleTitles.some((win) => win.trophyImage) && (
            <div className="tc-current__empty">
              <div className="tc-current__empty-inner">
                <div className="tc-current__empty-mark"><Trophy size={20} strokeWidth={1.4} /></div>
                <strong>Silverware appears here</strong>
                <p>Silverware appears here when you win an event that awards a trophy, plaque or medal.</p>
              </div>
            </div>
          )}
        </section>

        {resultOnlyWins > 0 && <section className="tc-current__section">
          <div className="tc-current__section-head"><CircleDot size={16} color="#e9c77a" /><h2>Titles without silverware</h2><small>{resultOnlyWins} wins</small></div>
          <p className="tc-current__explain">Weekly fixtures, qualifiers and Q-School sessions are recorded wins with result and prize only.</p>
          {visibleTitles.filter((win) => !win.trophyImage).map((win) => <p className="tc-current__empty-records" key={win.eventId}><a href={`#${win.eventId}`}>{win.eventName}</a> · Season {win.season} · {win.awardName}</p>)}
        </section>}
        {titleCount === 0 && <p className="tc-current__empty-records">No titles invented. Your first actual win will appear here.</p>}
        <details className="tc-current__disclosure" open={notesOpen} onToggle={(event) => setNotesOpen(event.currentTarget.open)}>
          <summary>How the cabinet works <ChevronDown size={14} /></summary>
          <p>Only recorded wins appear here. A trophy, plaque or medal is shown only when that event awards one; result-only wins are kept separate.</p>
        </details>
        <nav className="tc-current__pager" aria-label="Trophy cabinet pages">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}><ChevronLeft size={15} />Previous</button>
          <button disabled={offset + 50 >= titles.length} onClick={() => setOffset(offset + 50)}>Next<ChevronRight size={15} /></button>
        </nav>
      </div>
    </main>
  );
}
