import { useState, type CSSProperties, type ReactNode } from "react";
import { Briefcase, CalendarCheck, FileSignature, History as HistoryIcon, ShieldCheck, X } from "lucide-react";
import "./_group.css";
import "./sponsor-hq.css";

const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const OSWALD = { fontFamily: "Oswald, sans-serif" };

const portfolio = [
  {
    id: "contract-northstar", sponsorKey: "northstar", tier: "ELITE", category: "Equipment",
    status: "ACTIVE", start: { season: 4, week: 3 }, end: { season: 5, week: 52 },
    name: "Northstar Darts", accent: "#74c9dc", representative: "Mara Ellison",
    paid: 1850000, covered: 420000,
  },
  {
    id: "contract-ember", sponsorKey: "ember", tier: "PROFESSIONAL", category: "Performance",
    status: "ACTIVE", start: { season: 4, week: 12 }, end: { season: 4, week: 52 },
    name: "Ember Performance", accent: "#e58b5b", representative: "Callum Price",
    paid: 625000, covered: 185000,
  },
];

function CareerSection({ title, id, icon, accent, children }: { title: string; id?: string; icon: ReactNode; accent: string; children: ReactNode }) {
  return <section className="pdc-card career-section overflow-hidden" id={id} style={{ ["--section-accent" as string]: accent }}>
    <div className="career-section-head flex items-center gap-2">
      <span aria-hidden="true" style={{ color: accent }}>{icon}</span>
      <h2 className="text-white/85">{title}</h2>
    </div>
    {children}
  </section>;
}

function TermBar({ start, end, done, total }: { start: number; end: number; done: number; total: number }) {
  return <div className="sponsor-hq__term" aria-label={`Contract term: week ${done} of ${total}`}>
    <div className="sponsor-hq__term-head"><span>Contract term</span><strong>Week {done} <small>of {total}</small></strong></div>
    <div className="sponsor-hq__term-track"><i style={{ width: `${((done - start + 1) / (end - start + 1)) * 100}%` }} /></div>
  </div>;
}

function PartnerCard({ contract, done, total }: { contract: typeof portfolio[number]; done: number; total: number }) {
  return <article className="sponsor-hq__partner" style={{ "--partner-accent": contract.accent } as CSSProperties}>
    <div className="sponsor-hq__partner-topline">
      <span>{label(contract.tier)} partner <i aria-hidden="true">/</i> {label(contract.category)}</span>
      <span className="sponsor-hq__partner-status">{label(contract.status)}</span>
    </div>
    <div className="sponsor-hq__partner-heading">
      <span className="sponsor-hq__partner-monogram" aria-hidden="true">{contract.name.split(" ").map(part => part[0]).join("").slice(0, 2)}</span>
      <div><h3 style={OSWALD}>{contract.name}</h3><p>Season {contract.start.season}, week {contract.start.week} — season {contract.end.season}, week {contract.end.week}</p></div>
    </div>
    <TermBar start={1} end={total} done={done} total={total} />
    <div className="sponsor-hq__partner-record">
      <div><span>Representative</span><strong>{contract.representative}</strong><small>Commercial contact</small></div>
      <div><span>Cash received</span><strong>{money(contract.paid)}</strong><small>Paid to date</small></div>
      <div><span>Costs covered</span><strong>{money(contract.covered)}</strong><small>Separate from cash</small></div>
    </div>
  </article>;
}

function OfferCard({ onAction }: { onAction: (message: string) => void }) {
  return <article className="career-sponsor-offer" style={{ "--sponsor-accent": "#d8b669" } as CSSProperties}>
    <header className="career-sponsor-offer__hero">
      <div className="career-sponsor-offer__topline"><span className="career-sponsor-offer__eyebrow">Career partnership</span><span>Expires · S4 W31</span></div>
      <div className="career-sponsor-offer__identity">
        <span className="career-sponsor-offer__emblem" aria-hidden="true">AV</span>
        <div className="career-sponsor-offer__brand-copy"><span className="career-sponsor-offer__tier">Elite partner</span><h3>Apex Velocity</h3><span className="career-sponsor-offer__kind">New partnership</span><span>Offer terms · v3</span></div>
      </div>
      <div className="career-sponsor-offer__headline-terms">
        <div><span>Signing bonus</span><strong>£4,500</strong></div><div><span>Contract term</span><strong>2 seasons</strong></div><div><span>Per event played</span><strong>£350</strong></div>
      </div>
    </header>
    <div className="career-sponsor-offer__body">
      <section className="career-sponsor-offer__decision" aria-label="Active deal and proposal comparison">
        <div className="career-sponsor-offer__decision-head"><div><span className="career-sponsor-offer__eyebrow">SP-E1 · DECISION DESK</span><h4>Keep the current deal or sign this proposal</h4></div><div className="career-sponsor-offer__decision-meta"><b>NEW PARTNER</b><br /><span>Offered S4 W24 · expires S4 W31</span></div></div>
        <div className="career-sponsor-offer__decision-grid">
          <article className="career-sponsor-offer__decision-side is-current"><div className="career-sponsor-offer__decision-sidehead"><span>Current portfolio</span><strong>No matching active deal</strong></div><p>Your active deals are not identified as a renewal or conflict for this proposal.</p></article>
          <article className="career-sponsor-offer__decision-side is-proposed"><div className="career-sponsor-offer__decision-sidehead"><span>Proposed partnership</span><strong>Apex Velocity</strong></div><p>Term · 2 seasons from signing</p>
            <div className="career-sponsor-offer__proposal-facts"><div><span>At signing</span><b>£4,500</b></div><div><span>Guaranteed cash</span><b>2 scheduled terms</b></div><div><span>Performance rewards</span><b>1 conditional term</b></div><div><span>Cost coverage</span><b>1 coverage term</b></div></div>
            <ul className="career-sponsor-offer__decision-terms"><li>Guaranteed £2,000 per Career season · 4 scheduled instalments</li></ul>
            <p className="career-sponsor-offer__obligations">Obligations · 1 required and 1 optional activity clause · Bonuses remain conditional; cost coverage is not cash.</p>
          </article>
        </div>
      </section>
      <section className="career-sponsor-offer__meaning" aria-label="What this means for you"><div className="career-sponsor-offer__section-heading"><span className="career-sponsor-offer__index">TERMS</span><h4>What this means for you</h4></div>
        <ul><li>The agreement runs for 2 seasons from signing.</li><li>A one-off £4,500 signing payment is credited when the contract is signed.</li><li>Receive £350 for each eligible event played.</li><li>Partners cover 60% of eligible travel costs.</li></ul>
      </section>
      <section className="career-sponsor-offer__subsection"><div className="career-sponsor-offer__section-heading"><span className="career-sponsor-offer__index">01</span><h4>Appearance payment</h4></div><div className="career-sponsor-offer__detail-row"><div><strong>£350 for each event played</strong><small>Up to 18 events per season · PDC and WDF</small></div><span className="career-sponsor-offer__detail-value">PER EVENT</span></div></section>
      <section className="career-sponsor-offer__subsection"><div className="career-sponsor-offer__section-heading"><span className="career-sponsor-offer__index">02</span><h4>Tour support</h4></div><div className="career-sponsor-offer__detail-row"><div><strong>60% of travel costs</strong><small>Up to £1,800 season limit</small></div></div></section>
      <footer className="career-sponsor-offer__actions"><button className="career-btn career-btn-primary" onClick={() => onAction("Signed with Apex Velocity.")}>Accept offer</button><button className="career-btn" onClick={() => onAction("Offer declined.")}>Decline offer</button></footer>
    </div>
  </article>;
}

export function Current() {
  const [notice, setNotice] = useState("");
  const act = (message: string) => setNotice(message);
  return <main className="sponsor-hq min-h-screen space-y-5 px-4 py-5 sm:px-6" style={{ maxWidth: 1120, margin: "0 auto" }}>
    <section className="career-page-hero" style={{ "--hero-accent": "#d8b669" } as CSSProperties}>
      <div className="career-page-hero__stage"><span className="career-page-hero__sweep" aria-hidden="true" /><span className="career-page-hero__watermark" aria-hidden="true">S04 · W24</span>
        <div className="career-page-hero__content"><div className="career-page-hero__text">
          <p className="career-page-hero__kicker"><i aria-hidden="true" />Commercial office</p><h1 className="career-page-hero__title">The partner portfolio</h1>
          <div className="career-page-hero__subtitle"><p>Your sponsors: what they pay, what they want from you and who might sign you next.</p></div>
          <nav className="sponsor-hq__jump-nav" aria-label="Sponsor headquarters sections"><a href="#sponsor-portfolio">Portfolio</a><a href="#sponsor-decisions">Offers &amp; renewals</a><a href="#sponsor-activities">Activities</a><a href="#sponsor-history">History</a></nav>
          <nav className="sponsor-hq__cross-nav" aria-label="Commercial career tools"><a href="#sponsor-history">Finances &amp; ledger</a><a href="#sponsor-portfolio">Equipment &amp; products</a><a href="#sponsor-history">Who other players are sponsored by</a><a href="#sponsor-history">Commercial legacy</a></nav>
        </div></div>
      </div>
      <dl className="career-page-hero__stats">
        <div className="is-gold"><dt>Active partners</dt><dd>2</dd><small>Season 4 · Week 24</small></div>
        <div className="is-good"><dt>Sponsor cash this season</dt><dd>{money(1235000)}</dd><small>Received</small></div>
        <div><dt>Costs covered by partners</dt><dd>{money(285000)}</dd><small>Separate from cash</small></div>
        <div><dt>Scheduled guarantees</dt><dd>{money(180000)}</dd><small>Still to be paid</small></div>
      </dl>
    </section>

    <CareerSection title="Active sponsor portfolio" id="sponsor-portfolio" icon={<Briefcase size={15} />} accent="#d8b669">
      <div className="sponsor-hq__body"><div className="sponsor-hq__portfolio sponsor-hq__grid">
        <PartnerCard contract={portfolio[0]} done={74} total={104} /><PartnerCard contract={portfolio[1]} done={65} total={93} />
      </div></div>
    </CareerSection>

    <CareerSection title="Contract decisions" id="sponsor-decisions" icon={<FileSignature size={15} />} accent="#69b8ec">
      <div className="px-4 py-3">
        <details className="career-note"><summary>How expiry and renewals are shown</summary><p>Expiry is calculated from your current Career week to each signed end week. Renewal status below reflects persisted offers only; no offer is assumed from an approaching end date.</p></details>
        <div className="mt-3 sponsor-hq__grid">
          {portfolio.map(contract => <article key={contract.id} className="rounded-lg border border-white/10 bg-black/20 p-3" data-testid={`contract-decision-${contract.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] uppercase tracking-[.15em] text-white/45">{label(contract.tier)} · {label(contract.status)}</p><h3 className="mt-1 text-lg text-white" style={OSWALD}>{contract.name}</h3><p className="mt-1 text-xs text-white/55">Signed S{contract.start.season} W{contract.start.week} · ends S{contract.end.season} W{contract.end.week}</p></div>
              <div className={`sponsor-expiry-countdown${contract.id === "contract-ember" ? " is-near" : ""}`} aria-label={contract.id === "contract-ember" ? "29 contract weeks remaining" : "81 contract weeks remaining"}><span>WEEKS TO END</span><strong>{contract.id === "contract-ember" ? "29" : "81"}</strong></div></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded border border-white/[.07] bg-white/[.025] px-2.5 py-2"><p className="text-[9px] uppercase tracking-widest text-white/40">Renewal status</p><p className="mt-1 text-xs text-white">No persisted renewal offer available</p></div><div className="rounded border border-white/[.07] bg-white/[.025] px-2.5 py-2"><p className="text-[9px] uppercase tracking-widest text-white/40">Rival status</p><p className="mt-1 text-xs text-white">No persisted rival offer identifies this contract as a conflict</p></div></div>
          </article>)}
        </div>
      </div>
      <div className="career-sponsor-offers__stack border-t border-white/[.07]"><OfferCard onAction={act} /></div>
    </CareerSection>

    <CareerSection title="Compliance and contract releases" icon={<ShieldCheck size={15} />} accent="#5ee39b">
      <div className="sponsor-hq__body">
        <details className="career-note mb-3"><summary>When notices and releases apply</summary><p>Notices appear only when a required activity was genuinely missed and the signed agreement explicitly includes a material-breach term. Releases are limited to signed clauses; no existing agreement is changed.</p></details>
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-lg border border-white/10 bg-black/20 p-3" aria-label="Compliance notices"><h3 className="text-sm text-white" style={OSWALD}>Compliance notices</h3><p className="mt-2 text-xs text-white/55">No warnings from your sponsors.</p></section>
          <section className="rounded-lg border border-white/10 bg-black/20 p-3" aria-label="Contract release decisions"><h3 className="text-sm text-white" style={OSWALD}>Release options and history</h3>
            <div className="mt-2 space-y-2">{portfolio.map(contract => <article key={contract.id} className="rounded border border-white/[.08] p-3"><p className="text-xs text-white">{contract.name} · No scheduled renewal</p><div className="mt-2 flex flex-wrap gap-2"><button className="career-button-secondary" onClick={() => act("Release request recorded.")}>Request mutual release</button><button className="career-button-secondary" onClick={() => act("Release request recorded.")}>Request buyout · {money(250000)}</button></div></article>)}</div>
          </section>
        </div>
      </div>
    </CareerSection>

    <CareerSection title="Contractual commitments and opportunities" id="sponsor-activities" icon={<CalendarCheck size={15} />} accent="#eb8b59">
      <div className="sponsor-hq__body">
        <details className="career-note mb-3"><summary>Duties and optional activities</summary><p>Required duties are included in the agreement. Optional activities are unpaid and declining them has no penalty.</p></details>
        <div className="sponsor-hq__grid">
          <article className="pdc-card sponsor-hq__activity space-y-3 p-4" data-required="true"><div className="flex items-start justify-between gap-3"><div><p className="cc-eyebrow text-[10px] tracking-[.15em] text-white/45">REQUIRED CONTRACT DUTY</p><h3 className="text-lg text-white" style={OSWALD}>Promotional Appearance</h3><p className="text-xs text-white/60">Northstar Darts · Season 4 · Weeks 22–28</p></div><span className="rounded border border-white/15 px-2 py-1 text-[10px] uppercase text-amber-200">Available</span></div><div className="flex flex-wrap items-center gap-2"><label className="text-xs text-white/60">Career week <select aria-label="Schedule promotional appearance week" className="ml-2 rounded bg-slate-900 px-2 py-1 text-white"><option>Week 26</option><option>Week 27</option><option>Week 28</option></select></label><button className="career-button-primary" onClick={() => act("Sponsor activity updated.")}>Schedule</button></div></article>
          <article className="pdc-card sponsor-hq__activity space-y-3 p-4" data-required="false"><div className="flex items-start justify-between gap-3"><div><p className="cc-eyebrow text-[10px] tracking-[.15em] text-white/45">OPTIONAL OPPORTUNITY</p><h3 className="text-lg text-white" style={OSWALD}>Community Clinic</h3><p className="text-xs text-white/60">Ember Performance · Season 4 · Weeks 25–32</p></div><span className="rounded border border-white/15 px-2 py-1 text-[10px] uppercase text-amber-200">Available</span></div><div className="flex flex-wrap items-center gap-2"><button className="career-button-secondary" onClick={() => act("Sponsor activity updated.")}>Accept</button><button className="career-button-secondary" onClick={() => act("Sponsor activity updated.")}>Decline</button></div></article>
        </div>
      </div>
    </CareerSection>

    <CareerSection title="Representative communications and sponsor history" id="sponsor-history" icon={<HistoryIcon size={15} />} accent="#a98bff">
      <div className="grid gap-3 p-4 lg:grid-cols-2">
        <article className="pdc-card p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] uppercase tracking-widest text-cyan-200">Partnership director</p><h3 className="mt-1 text-lg text-white" style={OSWALD}>Apex Velocity</h3><p className="text-xs text-white/50">Nadia Shah · Offer made</p></div><span className="text-xs text-white/45">3 updates</span></div><ol className="mt-3 space-y-2 border-l border-white/10 pl-3"><li><p className="text-xs font-medium text-white">Apex Velocity has prepared a partnership proposal.</p><p className="mt-0.5 text-xs text-white/55">Nadia Shah would like to discuss your next season · Season 4, week 24</p></li><li><p className="text-xs font-medium text-white">Initial approach recorded</p><p className="mt-0.5 text-xs text-white/55">Your recent tour performances caught the brand's attention · Season 4, week 22</p></li></ol></article>
        <article className="pdc-card p-4"><p className="text-[10px] uppercase tracking-widest text-white/45">Partnership record · Completed</p><h3 className="mt-1 text-lg text-white" style={OSWALD}>Redline Sportswear</h3><p className="mt-1 text-xs text-white/55">Professional · Season 3 week 8 to season 3 week 52</p><p className="mt-2 text-xs text-white/55">Received {money(960000)} · Covered {money(170000)}</p></article>
      </div>
    </CareerSection>
    {notice && <p role="status" className="pdc-card p-3 text-sm text-white">{notice}<button className="ml-3 text-white/60" aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={14} /></button></p>}
  </main>;
}
