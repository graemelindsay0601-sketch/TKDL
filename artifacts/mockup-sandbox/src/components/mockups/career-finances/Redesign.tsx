import { useMemo, useState } from "react";
import {
  ArrowDownLeft, BadgePoundSterling, BriefcaseBusiness,
  CalendarClock, Check, ChevronDown, ChevronRight, CircleHelp,
  Coins, Handshake, History, ReceiptText, ShieldCheck, Sparkles, Wallet,
} from "lucide-react";
import "./Redesign.css";

type LedgerEntry = { week: number; title: string; category: string; amount: number; sponsor?: number };
const ledger: LedgerEntry[] = [
  { week: 21, title: "Regional Open · prize money", category: "PRIZE", amount: 18000 },
  { week: 21, title: "Regional Open · travel", category: "TRAVEL", amount: -3800 },
  { week: 20, title: "Club Open · entry fee", category: "ENTRY_FEE", amount: -1200 },
  { week: 19, title: "Northstar · guaranteed payment", category: "SPONSOR_GUARANTEED_PAYMENT", amount: 12500 },
  { week: 18, title: "County Open · accommodation", category: "ACCOMMODATION", amount: -4600, sponsor: 4000 },
  { week: 17, title: "County Open · prize money", category: "PRIZE", amount: 7200 },
  { week: 16, title: "Northstar · event payment", category: "SPONSOR_EVENT_PAYMENT", amount: 5000 },
  { week: 15, title: "Regional qualifier · entry fee", category: "ENTRY_FEE", amount: -900 },
];
const weeklyNet = [-57, -18, 51, 22, -33, 65, 0, -16, 39, -25, 70, -29, 32, 47, -15, 0, 0, 0, 0, 0, 142];
const money = (pence: number, signed = false) => {
  const abs = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Math.abs(pence) / 100);
  return `${signed && pence > 0 ? "+" : signed && pence < 0 ? "−" : ""}${abs}`;
};
const categoryLabel = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

function SectionTitle({ index, label, title, icon: Icon }: { index: string; label: string; title: string; icon: typeof Wallet }) {
  return <div className="cf2-section-title"><span className="cf2-section-icon"><Icon size={17} /></span><div><small>{index} / {label}</small><h2>{title}</h2></div></div>;
}

export function Redesign() {
  const [filter, setFilter] = useState("All activity");
  const [selectedWeek, setSelectedWeek] = useState(21);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalName, setGoalName] = useState("Regional Masters trip");
  const [goalTarget, setGoalTarget] = useState("300");
  const [offer, setOffer] = useState<"open" | "accepted" | "declined" | "countered">("open");
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterValue, setCounterValue] = useState("200");
  const [notice, setNotice] = useState("");
  const [showAll, setShowAll] = useState(false);
  const filtered = useMemo(() => ledger.filter((row) => {
    if (filter === "Prize") return row.category === "PRIZE";
    if (filter === "Sponsor cash") return row.category.startsWith("SPONSOR");
    if (filter === "Costs") return row.amount < 0;
    return true;
  }), [filter]);

  return (
    <main className="cf2">
      <div className="cf2-shell">
        <header className="cf2-masthead">
          <div className="cf2-brand"><span className="cf2-brand-mark">TK</span><span>TKDL <i>CAREER</i></span></div>
          <div className="cf2-location">Career office <b>/</b> Finances</div>
          <span className="cf2-save-mark"><i /> Season 04 <b>·</b> Week 21</span>
        </header>

        <section className="cf2-hero">
          <div className="cf2-hero-copy">
            <div className="cf2-eyebrow"><span>01 — THE MONEY ROOM</span><i /></div>
            <h1>Built for<br /><em>the next leg.</em></h1>
            <p>Prize winnings, sponsor cash and the cost of staying on tour — each kept in its proper place.</p>
            <button className="cf2-primary-action" onClick={() => document.getElementById("cf2-ledger")?.scrollIntoView({ behavior: "smooth" })}>
              <ReceiptText size={15} /> Open the ledger <ChevronRight size={15} />
            </button>
          </div>
          <div className="cf2-balance-stage" aria-label="Current balance and available funds">
            <div className="cf2-stage-ring cf2-stage-ring--one" /><div className="cf2-stage-ring cf2-stage-ring--two" />
            <div className="cf2-instrument-mark" aria-hidden="true">
              <div className="cf2-instrument-dial">{Array.from({ length: 16 }, (_, index) => <i key={index} style={{ transform: `rotate(${index * 22.5}deg)` }} />)}<b>TK</b></div>
              <span>CAREER<br />ACCOUNT · 04</span>
            </div>
            <div className="cf2-stage-label"><span>LIVE BALANCE</span><Wallet size={17} /></div>
            <div className="cf2-balance-value">£825<span>.00</span></div>
            <div className="cf2-balance-rail"><i /></div>
            <div className="cf2-balance-breakdown"><span><i className="cf2-dot cf2-dot--gold" /> Spendable <b>£768.00</b></span><span><i className="cf2-dot cf2-dot--red" /> Travel reserved <b>£57.00</b></span></div>
          </div>
        </section>

        <section className="cf2-ledger-ribbon" aria-label="Season financial headlines">
          <div className="cf2-ribbon-intro"><small>SEASON 04 / TO DATE</small><b>Four numbers.<br />Four meanings.</b></div>
          <article className="cf2-headline cf2-headline--prize"><span><Coins size={15} /> Career earnings</span><strong>£2,460<span>.00</span></strong><small>Prize money only</small></article>
          <article className="cf2-headline cf2-headline--sponsor"><span><Handshake size={15} /> Sponsor cash</span><strong>£1,125<span>.00</span></strong><small>Received and paid to you</small></article>
          <article className="cf2-headline cf2-headline--cost"><span><ArrowDownLeft size={15} /> Career expenses</span><strong>£685<span>.00</span></strong><small>£180.00 costs covered separately</small></article>
          <div className="cf2-ribbon-foot"><ShieldCheck size={14} /> Covered costs never count as player cash.</div>
        </section>

        <div className="cf2-context-line"><CircleHelp size={15} /><p><b>Balance is not lifetime earnings.</b> Future guarantees and conditional bonuses are also kept outside received cash.</p><span>ILLUSTRATIVE SAVE VALUES</span></div>

        <section className="cf2-section cf2-planning" id="cf2-plan">
          <div className="cf2-section-head"><SectionTitle index="02" label="PLAN THE SEASON" title="Your money in motion" icon={CalendarClock} /><span className="cf2-section-meta">SAVINGS · COMMITMENTS</span></div>
          <div className="cf2-plan-grid">
            <div className="cf2-goal">
              <div className="cf2-goal-heading"><span className="cf2-micro-label">SAVINGS GOAL</span><span className="cf2-goal-status">IN PROGRESS</span></div>
              <div className="cf2-goal-name">{goalName}</div>
              <div className="cf2-goal-figures"><strong>£210</strong><span>of £{goalTarget || "0"}</span><small>free funds toward target</small></div>
              <div className="cf2-progress"><i style={{ width: `${Math.min(100, (210 / (Number(goalTarget) || 300)) * 100)}%` }} /></div>
              <div className="cf2-goal-foot"><span>Uses spendable funds</span><span>Reserved travel stays separate</span></div>
              {goalOpen ? <form className="cf2-inline-form" onSubmit={(event) => { event.preventDefault(); setGoalOpen(false); setNotice("Goal updated in this visual preview only."); }}>
                <label>Goal<input value={goalName} onChange={(event) => setGoalName(event.target.value)} /></label>
                <label>Target £<input inputMode="numeric" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value.replace(/\D/g, ""))} /></label>
                <button type="submit" aria-label="Save goal"><Check size={14} /></button>
              </form> : <button className="cf2-text-action" onClick={() => setGoalOpen(true)}>Adjust goal <ChevronRight size={14} /></button>}
            </div>
            <div className="cf2-commitments">
              <div className="cf2-commitments-head"><span className="cf2-micro-label">UPCOMING COMMITMENTS</span><span>ALREADY RESERVED</span></div>
              <div className="cf2-commit-row"><time><small>WEEK</small><b>28</b></time><div><strong>Regional Masters</strong><small>Travel reserved · Nottingham</small></div><b>£35.00</b></div>
              <div className="cf2-commit-row"><time><small>WEEK</small><b>31</b></time><div><strong>County Open</strong><small>Travel reserved · Leicester</small></div><b>£22.00</b></div>
              <p><CalendarClock size={13} /> Reserved travel is charged in the week you travel.</p>
            </div>
          </div>
        </section>

        <section className="cf2-section cf2-chart-section">
          <div className="cf2-section-head"><SectionTitle index="03" label="WEEK BY WEEK" title="Darts money" icon={Coins} /><span className="cf2-chart-season">SEASON 04 <i>·</i> THROUGH WEEK 21</span></div>
          <div className="cf2-chart-stats"><div><small>SPENT ON DARTS</small><b>£342</b></div><div><small>PRIZE MONEY WON</small><b>£617</b></div><div className="cf2-chart-net"><small>DARTS MONEY · NET</small><b>+£275</b></div><p>Sponsor cash tracked separately</p></div>
          <div className="cf2-chart">
            <div className="cf2-axis"><span>+£70</span><span>£0</span><span>−£35</span></div>
            <div className="cf2-plot">
              <i className="cf2-grid cf2-grid--top" /><i className="cf2-grid cf2-grid--zero" /><i className="cf2-grid cf2-grid--bottom" />
              {weeklyNet.map((value, index) => {
                const height = Math.max(value === 0 ? 2 : 5, Math.abs(value) * .82);
                return <button key={index} type="button" aria-label={`Week ${index + 1}: net ${value >= 0 ? "+" : "−"}£${Math.abs(value)}`} className={`cf2-bar ${value >= 0 ? "is-up" : "is-down"}${selectedWeek === index + 1 ? " is-selected" : ""}`} style={{ height: `${height}px`, top: value >= 0 ? `calc(50% - ${height}px)` : "50%", left: `${(index / 51) * 100}%` }} onClick={() => setSelectedWeek(index + 1)}><span /></button>;
              })}
              <div className="cf2-now-line"><span>NOW</span></div>
              <div className="cf2-chart-weeks"><span>Wk 1</span><span>Wk 13</span><span>Wk 26</span><span>Wk 39</span><span>Wk 52</span></div>
            </div>
          </div>
          <div className="cf2-chart-foot"><span><i className="cf2-dot cf2-dot--gold" /><b>Week {selectedWeek}</b><span>Net <strong>{weeklyNet[selectedWeek - 1] >= 0 ? "+" : "−"}£{Math.abs(weeklyNet[selectedWeek - 1])}</strong></span><small>Prize less entry, travel & accommodation</small></span><span className="cf2-chart-legend"><i />Net positive <i />Net cost</span></div>
          <p className="cf2-caption">Darts money is prize income less event entry, travel and accommodation. Sponsor money is not included in these bars.</p>
        </section>

        <section className="cf2-section cf2-support">
          <div className="cf2-section-head"><SectionTitle index="04" label="COMMERCIAL SUPPORT" title="Sponsors & manager" icon={BriefcaseBusiness} /><span className="cf2-section-meta">SIGNED TERMS · KEEP EACH VALUE DISTINCT</span></div>
          <div className="cf2-support-grid">
            <div className="cf2-sponsor-record">
              <div className="cf2-record-top"><span className="cf2-partner-monogram">N<span><Sparkles size={8} /></span></span><div><small>LOCAL PARTNER · ACTIVE</small><h3>Northstar Sport</h3></div><span className="cf2-active-tag"><i /> SIGNED</span></div>
              <div className="cf2-record-term"><span>Season 4 · Weeks 1–40</span><span>Active agreement</span></div>
              <div className="cf2-record-numbers"><div><small>Cash received</small><b>£1,125.00</b></div><div><small>Costs covered</small><b>£180.00</b></div><div><small>Guarantee still scheduled</small><b>£250.00</b><i>not received</i></div></div>
              <div className="cf2-record-note"><Sparkles size={13} /> Potential performance bonus up to £80.00 · conditional, not guaranteed</div>
            </div>
            <div className="cf2-manager">
              <div className="cf2-manager-title"><span className="cf2-micro-label">YOUR MANAGER</span><b>Alder & Pike Management</b></div>
              <p>Commission applies to sponsor deals they arrange and invitation prize money they bring. Self-entered events and self-found deals stay yours.</p>
              <div className="cf2-manager-split"><span>Sponsor deal cut <b>£34.80</b></span><span>Invitation prize cut <b>£12.00</b></span><span>Taken this season <b>£46.80</b></span></div>
            </div>
          </div>
          <div className="cf2-offer-line">
            <div className="cf2-offer-icon"><BriefcaseBusiness size={17} /></div>
            <div className="cf2-offer-copy"><small>OFFER DESK · NOT PART OF YOUR BALANCE</small><strong>Redline Flight Co. <span>Regional equipment partner</span></strong><p>Proposed: £160 signing payment · £400 guaranteed term · up to £60 costs covered · conditional bonus up to £90.</p></div>
            {offer === "open" ? <div className="cf2-offer-actions">
              <button onClick={() => { setOffer("accepted"); setNotice("Offer marked accepted in local preview only. No cash was added."); }}>Accept</button>
              <button onClick={() => setCounterOpen((value) => !value)}>Counter</button>
              <button onClick={() => { setOffer("declined"); setNotice("Offer marked declined in local preview only."); }}>Decline</button>
            </div> : <div className="cf2-offer-state"><span>{offer === "accepted" ? "Accepted in preview" : offer === "declined" ? "Declined in preview" : "Counter recorded"}</span><button onClick={() => { setOffer("open"); setCounterOpen(false); }}>Reset</button></div>}
            {counterOpen && offer === "open" && <form className="cf2-counter-form" onSubmit={(event) => { event.preventDefault(); if (+counterValue > 0) { setOffer("countered"); setCounterOpen(false); setNotice(`Counter request recorded locally: £${counterValue}. No response or payment is implied.`); } }}><label>Signing request £<input inputMode="numeric" value={counterValue} onChange={(event) => setCounterValue(event.target.value.replace(/\D/g, ""))} /></label><button type="submit" disabled={!Number(counterValue)}>Send preview</button></form>}
          </div>
          <div className="cf2-interest-line"><span className="cf2-interest-pip" /><div><small>EXPLORATORY INTEREST · NO OFFER</small><b>Harbour & Heath</b><span>Noticed your third-place finish at the Regional Open. No contract, payment or guarantee exists yet.</span></div><Handshake size={18} /></div>
        </section>

        <section className="cf2-section cf2-ledger-section" id="cf2-ledger">
          <div className="cf2-section-head"><SectionTitle index="05" label="EVERY PAYMENT IN & OUT" title="Career ledger" icon={ReceiptText} /><span className="cf2-ledger-total">8 RECENT ENTRIES</span></div>
          <div className="cf2-ledger-controls"><div role="group" aria-label="Filter ledger activity">{["All activity", "Prize", "Sponsor cash", "Costs"].map((item) => <button key={item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><span>Each line is a recorded transaction</span></div>
          <div className="cf2-table-head"><span>WEEK</span><span>TRANSACTION</span><span>CATEGORY</span><span>AMOUNT</span></div>
          <div className="cf2-ledger-list">{filtered.slice(0, showAll ? filtered.length : 5).map((entry) => <div className="cf2-ledger-row" key={`${entry.week}-${entry.title}`}><small>S4 · W{entry.week}</small><div><b>{entry.title}</b>{entry.sponsor ? <span>£40.00 sponsor-covered · separate from cash</span> : null}</div><span className="cf2-category">{categoryLabel(entry.category)}</span><strong className={entry.amount > 0 ? "is-in" : "is-out"}>{money(entry.amount, true)}</strong></div>)}
            {!filtered.length && <div className="cf2-empty">No transactions in this preview filter.</div>}
          </div>
          <button className="cf2-show-ledger" onClick={() => setShowAll((value) => !value)}>{showAll ? "Show recent entries" : "Show all entries"} <ChevronDown size={14} className={showAll ? "is-up" : ""} /></button>
        </section>

        <div className="cf2-bottom-grid">
          <section className="cf2-section cf2-history">
            <div className="cf2-section-head"><SectionTitle index="06" label="POSTED · SCHEDULED · COVERED" title="Sponsor payment history" icon={History} /></div>
            <div className="cf2-history-row"><span className="cf2-history-icon is-cash"><ArrowDownLeft size={15} /></span><div><small>S4 · W19 · CASH POSTED</small><b>Northstar · guaranteed payment received</b><span>Paid into balance · included in received sponsor cash</span></div><strong>+£125.00</strong></div>
            <div className="cf2-history-row"><span className="cf2-history-icon is-cover"><ShieldCheck size={15} /></span><div><small>S4 · W18 · COST COVERED</small><b>Northstar · travel cost covered</b><span>Paid by sponsor · not cash received</span></div><strong>£40.00</strong></div>
            <div className="cf2-history-row"><span className="cf2-history-icon is-future"><CalendarClock size={15} /></span><div><small>S4 · W27 · SCHEDULED</small><b>Northstar · guarantee instalment due</b><span>Future payment · not received or counted as earnings</span></div><strong>£250.00</strong></div>
            <div className="cf2-history-caution"><BadgePoundSterling size={14} /> Conditional bonus up to £80.00 is not guaranteed cash.</div>
          </section>
          <section className="cf2-section cf2-archive">
            <div className="cf2-section-head"><SectionTitle index="07" label="CLOSED RECORDS" title="Sponsor archive" icon={History} /></div>
            <div className="cf2-archive-row"><span className="cf2-archive-monogram">P</span><div><small>PAST OFFER · NOT SIGNED</small><b>Pine & Point Darts</b></div><span>DECLINED</span></div>
            <div className="cf2-archive-row"><span className="cf2-archive-monogram is-ended">FB</span><div><small>FORMER CONTRACT · ENDED S3 W38</small><b>Flightline Barrels</b></div><span>ENDED</span></div>
            <div className="cf2-archive-figures"><span>Cash received <b>£0.00</b></span><span>Costs covered <b>£0.00</b></span></div>
            <p>Archived agreements do not change current sponsor totals.</p>
          </section>
        </div>

        <footer className="cf2-footer"><span>TKDL CAREER <i>/</i> FINANCES</span><span>Values illustrative · Preview only</span><span>SEASON 04 / WEEK 21</span></footer>
        {notice && <div className="cf2-toast" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
      </div>
    </main>
  );
}
