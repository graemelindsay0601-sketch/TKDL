import "./_group.css";
import "./Current.css";
import { BriefcaseBusiness, CalendarClock, ChartNoAxesColumn, Coins, ReceiptText, ShieldCheck, Wallet } from "lucide-react";

const weeks = [42, -18, 51, 22, -33, 65, 0, -16, 39, -25, 70, -29, 32, 47, -15, 43];
const entries = [
  ["S4 · W21", "Regional Open · prize money", "PRIZE", "+£180.00", "in"],
  ["S4 · W21", "Regional Open · travel", "TRAVEL", "−£38.00", "out"],
  ["S4 · W20", "Club Open · entry fee", "ENTRY FEE", "−£12.00", "out"],
  ["S4 · W19", "Northstar · guarantee payment received", "SPONSOR GUARANTEED PAYMENT", "+£125.00", "in"],
];

export function Current() {
  return (
    <main className="finance-current">
      <header className="finance-current__hero">
        <span className="finance-current__sample">SAMPLE SAVE VALUES</span>
        <div className="finance-current__kicker">CAREER FINANCES · SEASON 4, WEEK 21</div>
        <h1>Finances</h1>
        <p>What you’ve won, what sponsors pay you and what you’ve spent.</p>
        <div className="finance-current__stats">
          <article><small>BALANCE</small><b>£825.00</b><span>£768.00 available after travel reserved</span></article>
          <article><small>CAREER EARNINGS</small><b>£2,460.00</b><span>Prize money only</span></article>
          <article><small>SPONSOR EARNINGS</small><b>£1,125.00</b><span>Paid into your balance</span></article>
          <article><small>CAREER EXPENSES</small><b>£685.00</b><span>£180.00 more covered by sponsors</span></article>
        </div>
      </header>

      <section className="finance-current__section" id="savings-goal">
        <div className="finance-current__title"><Wallet /><div><small>PERSONAL PLAN</small><h2>Savings goal</h2></div></div>
        <div className="finance-current__goal">
          <div><strong>Regional Masters trip</strong><span>Entry, travel and stay for Week 28</span></div>
          <b>£210 <i>/ £300</i></b>
          <div className="finance-current__progress"><span /></div>
          <small>£210 of £300 free to spend · £57 reserved for entered events stays separate</small>
        </div>
        <button className="finance-current__button">Change goal</button>
      </section>

      <section className="finance-current__section">
        <div className="finance-current__title"><ChartNoAxesColumn /><div><small>SEASON 4</small><h2>Darts money by week</h2></div></div>
        <div className="finance-current__chart-head"><div><b>Spent on darts <strong>£342</strong></b><b>Won <strong>£617</strong></b><b>Net <strong className="positive">+£275</strong></b></div><small>Illustrative weeks · sponsor payments excluded</small></div>
        <div className="finance-current__chart" aria-label="Illustrative weekly darts income and costs">
          <div className="finance-current__zero" />
          {weeks.map((value, index) => {
            const height = Math.max(3, Math.abs(value) * 0.65);
            return <i key={index} className={value >= 0 ? "up" : "down"} style={{ height: `${height}px`, top: value >= 0 ? `calc(50% - ${height}px)` : "50%" }} />;
          })}
        </div>
        <div className="finance-current__axis"><span>Wk 1</span><span>Wk 13</span><span>Wk 26</span><span>Wk 39</span><span>Wk 52</span></div>
        <p className="finance-current__caption">Weekly prize money minus event entry, travel and stays. Sponsor cash is tracked separately.</p>
      </section>

      <div className="finance-current__two">
        <section className="finance-current__section">
          <div className="finance-current__title"><BriefcaseBusiness /><div><small>CAREER SUPPORT</small><h2>Your manager</h2></div></div>
          <div className="finance-current__later"><ShieldCheck /><div><b>Northstar Darts · Active partner</b><p>£1,125 cash received · £180 costs covered · £250 guaranteed later this season · up to £80 conditional bonus, not guaranteed.</p></div></div>
        </section>
        <section className="finance-current__section">
          <div className="finance-current__title"><CalendarClock /><div><small>PLANNED COSTS</small><h2>Upcoming commitments</h2></div></div>
          <div className="finance-current__commit"><span><b>Regional Masters</b><small>Week 28 · Travel reserved</small></span><strong>£35.00</strong></div>
          <div className="finance-current__commit"><span><b>County Open</b><small>Week 31 · Travel reserved</small></span><strong>£22.00</strong></div>
          <small className="finance-current__caption">Reserved costs are charged when you travel, not when you enter.</small>
        </section>
      </div>

      <section className="finance-current__section">
        <div className="finance-current__title"><Coins /><div><small>COMMERCIAL TERMS</small><h2>Sponsor money · Season 4</h2></div></div>
        <div className="finance-current__commercial">
          <article><small>Cash received</small><b>£1,125.00</b><span>Paid into your balance</span></article>
          <article><small>Costs covered</small><b>£180.00</b><span>Separate from cash received</span></article>
          <article><small>Guarantees scheduled</small><b>£250.00</b><span>Not yet received</span></article>
          <article><small>Conditional bonus</small><b>Up to £80.00</b><span>Only if the target is met</span></article>
        </div>
        <div className="finance-current__commercial-note">A signed agreement can include event payments, scheduled instalments and conditional bonuses. Only completed payments count as sponsor earnings.</div>
      </section>

      <div className="finance-current__two">
        <section className="finance-current__section">
          <div className="finance-current__title"><BriefcaseBusiness /><div><small>NEW OPPORTUNITY</small><h2>Sponsor offer</h2></div></div>
          <div className="finance-current__offer">
            <div><b>Redline Energy</b><span>Performance partner · Offer expires S4 W24</span></div>
            <p>£90 signing cash · £30 scheduled instalments · up to £60 for a top-8 finish, not guaranteed.</p>
            <p className="finance-current__tradeoff">More guaranteed cash, but a longer term and a higher appearance commitment than your current deal.</p>
            <div className="finance-current__offer-actions"><button>Counter</button><button>Decline</button><button>Accept</button></div>
          </div>
        </section>
        <section className="finance-current__section">
          <div className="finance-current__title"><CalendarClock /><div><small>PARTNER RECORD</small><h2>Interest, activity & history</h2></div></div>
          <div className="finance-current__activity"><span><b>Vector Flights · Brand interest</b><small>Interest rising · profile viewed this week</small></span><i>Potential partner</i></div>
          <div className="finance-current__activity"><span><b>Quarterly shoot confirmed</b><small>Northstar Darts · S4 W20</small></span><i>Product photography booked</i></div>
          <div className="finance-current__activity"><span><b>Appearance options shared</b><small>Redline Energy · S4 W21</small></span><i>Venue options for weeks 24–26</i></div>
          <div className="finance-current__activity"><span><b>Harrow & Finch · Ended</b><small>Development partner · Season 3</small></span><i>£640 cash received · £180 costs covered</i></div>
        </section>
      </div>

      <section className="finance-current__section">
        <div className="finance-current__title"><ReceiptText /><div><small>FULL AUDIT TRAIL</small><h2>Transactions</h2></div></div>
        <div className="finance-current__filters"><button className="active">All</button><button>Prize</button><button>Money matches</button><button>Sponsor / Commercial</button><button>Costs</button></div>
        <div className="finance-current__ledger">
          {entries.map((entry) => <div className="finance-current__entry" key={entry[0] + entry[1]}><small>{entry[0]}</small><span><b>{entry[1]}</b><i>{entry[2]}</i></span><strong className={entry[4]}>{entry[3]}</strong></div>)}
        </div>
        <div className="finance-current__ledger-foot"><button>Newer</button><small>Every payment in and out</small><button>Older</button></div>
      </section>
      <footer className="finance-current__footer">Illustrative save values. Career funds are tracked in pounds; sponsor payments, covered costs, guarantees due and conditional bonuses remain separate.</footer>
    </main>
  );
}
