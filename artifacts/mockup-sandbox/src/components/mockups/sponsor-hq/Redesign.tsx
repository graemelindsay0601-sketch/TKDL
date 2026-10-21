import { useState, type CSSProperties, type ReactNode } from "react";
import { Archive, BriefcaseBusiness, CalendarDays, Camera, Clapperboard, FileCheck2, History, MapPin, MessageSquareText, PackageOpen, ShieldCheck, UsersRound, WalletCards, type LucideIcon } from "lucide-react";
import "./_group.css";
import "./Redesign.css";

type ActivityStatus = "AVAILABLE" | "ACCEPTED" | "CONFIRMED" | "COMPLETED" | "DECLINED";
type Activity = {
  id: string;
  name: string;
  sponsor: string;
  required: boolean;
  season: number;
  from: number;
  to: number;
  status: ActivityStatus;
  scheduledWeek?: number;
};

const activityIcons: Record<string, LucideIcon> = {
  shoot: Camera,
  clinic: UsersRound,
  appearance: MapPin,
  social: Clapperboard,
  launch: PackageOpen,
};

const money = (amount: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

const partners = [
  { id: "northstar", name: "Northstar Darts", initials: "ND", tier: "Premier", category: "Equipment", status: "Active", start: "S4 · W08", end: "S4 · W39", progress: 59, weeks: "Week 22 of 32", rep: "Mara Voss", role: "Partnership Director", paid: 1850, covered: 420, accent: "#d8b86f" },
  { id: "redline", name: "Redline Energy", initials: "RE", tier: "Official", category: "Performance", status: "Active", start: "S4 · W12", end: "S4 · W34", progress: 50, weeks: "Week 11 of 23", rep: "Jonah Vale", role: "Athlete Relations", paid: 975, covered: 0, accent: "#d7474b" },
];

const startingActivities: Activity[] = [
  { id: "shoot", name: "Quarterly product shoot", sponsor: "Northstar Darts", required: true, season: 4, from: 20, to: 24, status: "CONFIRMED", scheduledWeek: 22 },
  { id: "clinic", name: "Community darts clinic", sponsor: "Northstar Darts", required: true, season: 4, from: 23, to: 28, status: "AVAILABLE" },
  { id: "appearance", name: "Venue partner appearance", sponsor: "Redline Energy", required: true, season: 4, from: 24, to: 26, status: "AVAILABLE" },
  { id: "social", name: "Behind-the-scenes feature", sponsor: "Northstar Darts", required: false, season: 4, from: 21, to: 27, status: "AVAILABLE" },
  { id: "launch", name: "New range launch evening", sponsor: "Aster & Ash", required: false, season: 4, from: 25, to: 29, status: "AVAILABLE" },
];

const timeline = [
  { title: "Renewal conversation opened", copy: "Mara shared Northstar's intent to discuss a new term ahead of expiry.", time: "S4 · W21" },
  { title: "Quarterly shoot confirmed", copy: "Product photography booked for Career week 22.", time: "S4 · W20" },
  { title: "Contract signed", copy: "Northstar Darts partnership began with the agreed equipment and appearance duties.", time: "S4 · W08" },
];

export function Redesign() {
  const [activities, setActivities] = useState(startingActivities);
  const [weeks, setWeeks] = useState<Record<string, number>>({});
  const [offerStatus, setOfferStatus] = useState<Record<string, string>>({});
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [releaseStatus, setReleaseStatus] = useState("");
  const [message, setMessage] = useState("");

  const updateActivity = (id: string, action: "ACCEPT" | "DECLINE" | "SCHEDULE" | "COMPLETE", week?: number) => {
    setActivities((current) => current.map((item) => {
      if (item.id !== id) return item;
      if (action === "ACCEPT") return { ...item, status: "ACCEPTED" };
      if (action === "DECLINE") return { ...item, status: "DECLINED" };
      if (action === "SCHEDULE") return { ...item, status: "CONFIRMED", scheduledWeek: week };
      return { ...item, status: "COMPLETED" };
    }));
    setMessage(action === "SCHEDULE" ? `Activity scheduled for week ${week}.` : action === "COMPLETE" ? "Activity marked complete." : `Optional activity ${action.toLowerCase()}d.`);
  };

  const setOffer = (id: string, status: string) => {
    setOfferStatus((current) => ({ ...current, [id]: status }));
    setMessage(status === "Negotiation requested" ? "Negotiation request recorded for review." : `${status}.`);
  };

  const requestRelease = (name: string, type: string) => {
    setReleaseStatus(`${type} request recorded for ${name}.`);
    setMessage(`${type} request recorded for ${name}.`);
  };

  return (
    <main className="sponsor-room">
      <div className="room-shell">
        <header className="room-masthead">
          <div className="room-brand"><span className="room-brand-mark"><span>TK</span></span><span>Career · Commercial Office</span></div>
          <div className="room-location">Professional floor / Sponsor headquarters</div>
        </header>

        <section className="room-hero" aria-labelledby="sponsor-title">
          <img className="room-hero-art" src="/__mockup/images/sponsor-hq-hero.jpg" alt="" aria-hidden="true" />
          <div className="room-hero-board" aria-hidden="true"><i /><i /><i /><b>20</b></div>
          <div className="room-hero-content">
            <div>
              <p className="room-kicker">The partnership room</p>
              <h1 className="room-title" id="sponsor-title">Sponsor <span>Headquarters</span></h1>
              <p className="room-subtitle">A clear view of who stands behind your game: what has been paid, what is covered, what is promised, and what each agreement asks in return.</p>
            </div>
            <div className="room-hero-side">
              <div className="room-season">SEASON 4 · WEEK 22<small>Commercial desk / career mode</small></div>
              <div className="room-seal">Partner<br />Portfolio<br />TKDL</div>
            </div>
          </div>
        </section>

        <section className="room-metrics" aria-label="Commercial summary">
          <Metric label="Active partners" value="2" detail="Season 4 · Week 22" gold />
          <Metric label="Sponsor cash this season" value={money(2825)} detail="Received and paid to date" />
          <Metric label="Partner costs covered" value={money(420)} detail="Separate from cash received" />
          <Metric label="Scheduled guarantees" value={money(640)} detail="Still due under signed terms" />
        </section>

        <nav className="room-nav" aria-label="Sponsor headquarters sections">
          <a href="#portfolio">Portfolio</a>
          <a href="#decisions">Offers &amp; renewals</a>
          <a href="#compliance">Compliance &amp; releases</a>
          <a href="#activities">Duties &amp; activities</a>
          <a href="#history">Communications &amp; history</a>
        </nav>

        <RoomSection id="portfolio" number="01" title="Active sponsor portfolio" subtitle="Signed partners · live contract terms" icon={<BriefcaseBusiness size={17} />} accent="#d8b86f">
          <div className="room-grid">
            {partners.map((partner) => (
              <article className="partner-card" key={partner.id} style={{ "--brand-accent": partner.accent } as CSSProperties}>
                <div className="partner-topline"><span>{partner.tier} partner / {partner.category}</span><span className="partner-status">{partner.status}</span></div>
                <div className="partner-heading">
                  <span className="partner-mark" aria-hidden="true">{partner.initials}</span>
                  <div><h3>{partner.name}</h3><p>Term {partner.start} — {partner.end}</p></div>
                </div>
                <div className="term-block">
                  <div className="term-head"><span>Contract term</span><strong>{partner.weeks}</strong></div>
                  <div className="term-track"><i style={{ width: `${partner.progress}%` }} /></div>
                </div>
                <div className="partner-record">
                  <div><span>Representative</span><strong>{partner.rep}</strong><small>{partner.role}</small></div>
                  <div><span>Cash received</span><strong>{money(partner.paid)}</strong><small>Paid to date</small></div>
                  <div><span>Costs covered</span><strong>{money(partner.covered)}</strong><small>Not cash income</small></div>
                </div>
              </article>
            ))}
          </div>
        </RoomSection>

        <RoomSection id="decisions" number="02" title="Contract decisions" subtitle="Term countdown · persisted renewal and rival offers" icon={<FileCheck2 size={17} />} accent="#d7474b">
          <p className="room-note"><strong>Expiry &amp; renewal:</strong> countdowns use the current Career week and signed end week. Renewal status below reflects a received offer only; an approaching end date does not imply an offer.</p>
          <div className="room-grid">
            <DecisionCard name="Northstar Darts" tier="Premier · Active" signed="Signed S4 W08 · ends S4 W39" remaining="18" renewal="Offer received · expires S4 W27" rival="No persisted rival offer identifies this agreement as a conflict" />
            <DecisionCard name="Redline Energy" tier="Official · Active" signed="Signed S4 W12 · ends S4 W34" remaining="13" renewal="No persisted renewal offer available" rival="1 persisted rival offer identifies this agreement as a conflict" />
          </div>
          <div style={{ height: 14 }} />
          <div className="offer-card">
            <div>
              <span className="offer-label">Renewal offer · Northstar Darts</span>
              <h3>{offerStatus["renewal-northstar"] === "Accepted — scheduled" ? "Renewal accepted" : "A new term on the table"}</h3>
              <p>Renewal starts at the next term. Your current agreement stays active until its scheduled end; the new term's income and activities are not active yet.</p>
              <div className="offer-terms">
                <span className="term-chip cash">Guaranteed cash · {money(800)}</span>
                <span className="term-chip">Equipment cost coverage · {money(250)}</span>
                <span className="term-chip">Conditional bonus · {money(300)}</span>
                <span className="term-chip">Required duties · 2</span>
              </div>
            </div>
            <div className="offer-actions">
              <button className="room-button" onClick={() => setOffer("renewal-northstar", "Accepted — scheduled")}>Accept renewal</button>
              <button className="room-button secondary" onClick={() => setOffer("renewal-northstar", "Negotiation requested")}>Negotiate</button>
              <button className="room-button danger" onClick={() => setOffer("renewal-northstar", "Declined")}>Decline offer</button>
            </div>
          </div>
          <div style={{ height: 10 }} />
          <div className="offer-card">
            <div>
              <span className="offer-label">Rival offer · Aster &amp; Ash</span>
              <h3>{offerStatus["rival-aster"] === "Signed" ? "Partnership signed" : "An alternative partnership"}</h3>
              <p>This offer conflicts with the active Redline Energy agreement. Review the terms and any identified contract conflict before accepting.</p>
              <div className="offer-terms">
                <span className="term-chip cash">Guaranteed cash · {money(575)}</span>
                <span className="term-chip">Travel costs covered · {money(120)}</span>
                <span className="term-chip">Conditional bonus · {money(180)}</span>
                <span className="term-chip">Required duties · 1</span>
              </div>
            </div>
            <div className="offer-actions">
              <button className="room-button" onClick={() => setOffer("rival-aster", "Signed")}>Review &amp; accept</button>
              <button className="room-button secondary" onClick={() => setOffer("rival-aster", "Negotiation requested")}>Negotiate</button>
              <button className="room-button danger" onClick={() => setOffer("rival-aster", "Declined")}>Decline offer</button>
            </div>
          </div>
          <div style={{ height: 12 }} />
          <div className="room-empty"><strong>Scheduled renewal · Redline Energy</strong>Starts Season 5, Week 1 · ends Season 5, Week 24. Current agreement remains active through its scheduled end; no renewal income or activities are active yet.</div>
        </RoomSection>

        <RoomSection id="compliance" number="03" title="Compliance & contract releases" subtitle="Notices and exits are governed by signed clauses" icon={<ShieldCheck size={17} />} accent="#bd7775">
          <p className="room-note"><strong>When these apply:</strong> notices appear only for a genuinely missed required activity when the signed agreement includes a material-breach term. Release routes are limited to existing signed clauses; no agreement is changed here.</p>
          <div className="compliance-layout">
            <div className="subpanel">
              <h3>Compliance notices</h3>
              <p className="subpanel-intro">Missed required duties are tracked here. A notice does not mean a penalty or termination has been applied.</p>
              {noticeOpen ? (
                <article className="notice-card">
                  <strong>Northstar Darts · missed required activity · Open</strong>
                  <p>Career season 4, due week 19. No penalty or termination has been applied.</p>
                  <button className="room-button secondary" style={{ marginTop: 10 }} onClick={() => { setNoticeOpen(false); setMessage("Notice acknowledged."); }}>Acknowledge</button>
                </article>
              ) : <div className="room-empty"><strong>No open notices</strong>The notice has been acknowledged.</div>}
            </div>
            <div className="subpanel">
              <h3>Release options &amp; history</h3>
              <p className="subpanel-intro">Request options below reflect the release terms in each agreement. A request is not a release until confirmed where required.</p>
              <ReleaseCard name="Northstar Darts" renewal="Scheduled renewal protects this agreement" options={["Request mutual release"]} onRequest={requestRelease} />
              <ReleaseCard name="Redline Energy" renewal="No scheduled renewal" options={["Request immediate release", `Request buyout · ${money(350)}`, "Request mutual release"]} onRequest={requestRelease} />
              {releaseStatus && <article className="release-card" style={{ marginTop: 8 }}><strong>Release request · Pending</strong><p>{releaseStatus}</p><button className="room-button" style={{ marginTop: 10 }} onClick={() => { setReleaseStatus("Release accepted and recorded in Career history."); setMessage("Sponsor agreement released and recorded in Career history."); }}>Confirm offered release</button></article>}
            </div>
          </div>
        </RoomSection>

        <RoomSection id="activities" number="04" title="Contractual commitments & opportunities" subtitle="Required agreement duties are distinct from unpaid optional activities" icon={<CalendarDays size={17} />} accent="#bb7974">
          <p className="room-note"><strong>Required duties</strong> are part of the signed agreement. <strong>Optional opportunities</strong> are unpaid; declining one has no penalty. Completion is available only during the scheduled Career week.</p>
          <ActivityRunway activities={activities} />
          <div className="room-grid">
            {activities.map((activity) => {
              const currentWeek = weeks[activity.id] ?? Math.max(activity.from, 22);
              const canSchedule = activity.required ? ["AVAILABLE", "CONFIRMED"].includes(activity.status) : ["ACCEPTED", "CONFIRMED"].includes(activity.status);
              const canAccept = !activity.required && activity.status === "AVAILABLE";
              const canDecline = !activity.required && ["AVAILABLE", "ACCEPTED"].includes(activity.status);
              const weekOptions = Array.from({ length: Math.max(0, activity.to - Math.max(activity.from, 22) + 1) }, (_, index) => Math.max(activity.from, 22) + index);
              const canComplete = activity.status === "CONFIRMED" && activity.scheduledWeek === 22;
              const ActivityIcon = activityIcons[activity.id] ?? CalendarDays;
              return (
                <article className="activity-card" data-required={activity.required} key={activity.id}>
                  <div className="activity-head">
                    <div className="activity-title">
                      <span className="activity-emblem" aria-hidden="true"><ActivityIcon size={21} strokeWidth={1.8} /></span>
                      <div><span className="activity-kind">{activity.required ? "Required contract duty" : "Optional opportunity"}</span><h3>{activity.name}</h3></div>
                    </div>
                    <span className="activity-status">{label(activity.status)}</span>
                  </div>
                  <p className="activity-sponsor">{activity.sponsor}<span>Season {activity.season} · Weeks {activity.from}–{activity.to}</span></p>
                  {activity.status === "CONFIRMED" && <p>Booked for Career week {activity.scheduledWeek}; completion is available only during that week.</p>}
                  {activity.status === "COMPLETED" && <p>Completed and recorded for this Career term.</p>}
                  <div className="activity-actions">
                    {canAccept && <button className="room-button secondary" onClick={() => updateActivity(activity.id, "ACCEPT")}>Accept</button>}
                    {canDecline && <button className="room-button secondary" onClick={() => updateActivity(activity.id, "DECLINE")}>Decline</button>}
                    {canSchedule && <>
                      <label className="selection-label">Career week
                        <select className="room-select" aria-label={`Schedule ${activity.name} week`} value={currentWeek} onChange={(event) => setWeeks((current) => ({ ...current, [activity.id]: Number(event.target.value) }))}>
                          {weekOptions.map((week) => <option key={week} value={week}>Week {week}</option>)}
                        </select>
                      </label>
                      <button className="room-button" disabled={!weekOptions.length} onClick={() => updateActivity(activity.id, "SCHEDULE", currentWeek)}>{activity.status === "CONFIRMED" ? "Change week" : "Schedule"}</button>
                    </>}
                    {canComplete && <button className="room-button" onClick={() => updateActivity(activity.id, "COMPLETE")}>Complete activity</button>}
                    {activity.status === "DECLINED" && <span className="room-tag">Declined · no penalty</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </RoomSection>

        <RoomSection id="history" number="05" title="Representative communications & history" subtitle="Recent sponsor conversations alongside the record of past agreements" icon={<History size={17} />} accent="#9b8d70">
          <div className="history-grid">
            <article className="record-card communication-card" data-contact="northstar">
              <div className="record-card-head">
                <div className="history-contact">
                  <span className="history-avatar" aria-hidden="true"><strong>MV</strong><i><MessageSquareText size={12} /></i></span>
                  <div><span className="record-role"><MessageSquareText size={12} />Partnership Director</span><h3>Mara Voss</h3><p className="decision-meta">Northstar Darts · Renewal discussion</p></div>
                </div>
                <span className="room-tag">3 updates</span>
              </div>
              <ol className="timeline">
                {timeline.map((event) => <li key={event.title}><div className="timeline-entry-head"><strong>{event.title}</strong><time>{event.time}</time></div><p>{event.copy}</p></li>)}
              </ol>
            </article>
            <article className="record-card communication-card" data-contact="redline">
              <div className="record-card-head">
                <div className="history-contact">
                  <span className="history-avatar" aria-hidden="true"><strong>JV</strong><i><MessageSquareText size={12} /></i></span>
                  <div><span className="record-role"><MessageSquareText size={12} />Athlete Relations</span><h3>Jonah Vale</h3><p className="decision-meta">Redline Energy · Active agreement</p></div>
                </div>
                <span className="room-tag">2 updates</span>
              </div>
              <ol className="timeline">
                <li><div className="timeline-entry-head"><strong>Appearance window shared</strong><time>S4 · W21</time></div><p>Venue partner appearance options are available for weeks 24–26.</p></li>
                <li><div className="timeline-entry-head"><strong>Agreement signed</strong><time>S4 · W12</time></div><p>Redline Energy became an official performance partner.</p></li>
              </ol>
            </article>
            <article className="record-card archive-record">
              <div className="archive-record-head"><span className="archive-emblem" aria-hidden="true"><Archive size={18} /></span><span className="record-role">Partnership record · Ended</span><span className="archive-season">Season 3 archive</span></div>
              <h3>Harrow &amp; Finch</h3>
              <p className="decision-meta">Development partner · Season 3, week 10 to Season 3, week 42</p>
              <div className="archive-ledger">
                <div><span>Cash received</span><strong>{money(640)}</strong></div>
                <div><span>Costs covered</span><strong>{money(180)}</strong></div>
              </div>
              <p className="history-value">Cost coverage is recorded separately from cash received.</p>
            </article>
            <article className="record-card ledger-record">
              <div className="ledger-record-head">
                <span className="ledger-emblem" aria-hidden="true"><WalletCards size={18} /></span>
                <div><span className="record-role">Commercial record</span><h3>Term ledger at a glance</h3></div>
              </div>
              <p className="decision-meta">The portfolio distinguishes money already received, partner-paid costs, scheduled guarantees, and conditional bonuses.</p>
              <div className="ledger-figures">
                <div className="ledger-figure is-cash"><span>Received</span><strong>{money(2825)}</strong><small>Cash paid to date</small></div>
                <div className="ledger-figure"><span>Covered</span><strong>{money(420)}</strong><small>Partner-paid costs</small></div>
                <div className="ledger-figure is-due"><span>Guarantees due</span><strong>{money(640)}</strong><small>Scheduled under terms</small></div>
                <div className="ledger-figure"><span>Conditional bonuses</span><strong>{money(480)}</strong><small>Earned only if met</small></div>
              </div>
            </article>
          </div>
        </RoomSection>

        {message && <div className="room-toast" role="status">{message}<button aria-label="Dismiss message" onClick={() => setMessage("")} style={{ marginLeft: 12, border: 0, color: "#e4d29f", background: "transparent", cursor: "pointer" }}>Dismiss</button></div>}
        <footer className="room-footer"><span>TKDL · Career commercial office</span><span>Partnership terms · Career season 4</span></footer>
      </div>
    </main>
  );
}

function ActivityRunway({ activities }: { activities: Activity[] }) {
  const firstWeek = Math.min(...activities.map((activity) => activity.from));
  const lastWeek = Math.max(...activities.map((activity) => activity.to));
  const weekCount = lastWeek - firstWeek + 1;
  const currentWeek = 22;
  const currentPosition = ((currentWeek - firstWeek + 0.5) / weekCount) * 100;
  const weeks = Array.from({ length: weekCount }, (_, index) => firstWeek + index);

  return (
    <div className="commitment-runway">
      <header className="runway-header">
        <span className="runway-seal" aria-hidden="true"><CalendarDays size={20} /></span>
        <div className="runway-heading">
          <span>Season 4 · Sponsor schedule</span>
          <h3>Commitment runway</h3>
        </div>
        <span className="runway-now"><i />Career week {currentWeek}</span>
      </header>
      <div className="runway-scroll" role="region" aria-label="Sponsor activity windows by Career week" tabIndex={0}>
        <div className="runway-board">
          <div className="runway-axis">
            <span>Activity window</span>
            <div className="runway-weeks">{weeks.map((week) => <span key={week}>W{week}</span>)}</div>
          </div>
          {activities.map((activity) => {
            const ActivityIcon = activityIcons[activity.id] ?? CalendarDays;
            const start = ((activity.from - firstWeek) / weekCount) * 100;
            const width = ((activity.to - activity.from + 1) / weekCount) * 100;
            const scheduled = activity.scheduledWeek == null ? undefined : ((activity.scheduledWeek - firstWeek + 0.5) / weekCount) * 100;
            return (
              <div className="runway-row" data-required={activity.required} data-status={activity.status} key={activity.id}>
                <div className="runway-activity">
                  <span className="runway-mini-mark" aria-hidden="true"><ActivityIcon size={14} /></span>
                  <span><strong>{activity.name}</strong><small>{activity.required ? "Required duty" : "Optional · unpaid"}</small></span>
                </div>
                <div className="runway-track" style={{ "--runway-now": `${currentPosition}%` } as CSSProperties}>
                  <span className="runway-now-line" aria-hidden="true" />
                  <span className="runway-window" style={{ "--window-start": `${start}%`, "--window-width": `${width}%` } as CSSProperties}>
                    W{activity.from}–{activity.to}
                  </span>
                  {scheduled != null && <span className="runway-booked" style={{ left: `${scheduled}%` }} aria-label={`Booked for week ${activity.scheduledWeek}`} title={`Booked for week ${activity.scheduledWeek}`} />}
                </div>
              </div>
            );
          })}
          <div className="runway-legend">
            <span><i className="legend-required" />Signed contract duty</span>
            <span><i className="legend-optional" />Optional opportunity</span>
            <span><i className="legend-current" />Current week</span>
            <span><i className="legend-booked" />Booked activity</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label: title, value, detail, gold }: { label: string; value: string; detail: string; gold?: boolean }) {
  return <div className={`room-metric${gold ? " is-gold" : ""}`}><span className="room-metric-label">{title}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function RoomSection({ id, number, title, subtitle, icon, accent, children }: { id: string; number: string; title: string; subtitle: string; icon: ReactNode; accent: string; children: ReactNode }) {
  return (
    <section className="room-section" id={id} style={{ "--section-accent": accent } as CSSProperties}>
      <header className="room-section-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "grid", width: 34, height: 34, placeItems: "center", border: "1px solid color-mix(in srgb, var(--section-accent) 40%, transparent)", borderRadius: 6, color: "var(--section-accent)", background: "#070f1c", boxShadow: "inset 0 1px #fff2, 0 3px 8px #0006" }}>{icon}</span>
          <div><h2>{title}</h2><p>{subtitle}</p></div>
        </div>
        <span className="room-section-index"><i aria-hidden="true" />{number} <b>/ 05</b></span>
      </header>
      <div className="room-section-body">{children}</div>
    </section>
  );
}

function DecisionCard({ name, tier, signed, remaining, renewal, rival }: { name: string; tier: string; signed: string; remaining: string; renewal: string; rival: string }) {
  return (
    <article className="decision-card">
      <div className="decision-top">
        <div><span className="room-eyebrow">{tier}</span><h3>{name}</h3><p className="decision-meta">{signed}</p></div>
        <div className="expiry"><span>Weeks to end</span><strong>{remaining}</strong></div>
      </div>
      <div className="decision-pair">
        <div><small>Renewal status</small><p>{renewal}</p></div>
        <div><small>Rival status</small><p>{rival}</p></div>
      </div>
    </article>
  );
}

function ReleaseCard({ name, renewal, options, onRequest }: { name: string; renewal: string; options: string[]; onRequest: (name: string, type: string) => void }) {
  return (
    <article className="release-card">
      <strong>{name}</strong><p>{renewal}</p>
      <div className="release-options">
        {options.map((option) => <button className="room-button secondary" key={option} disabled={renewal.startsWith("Scheduled")} onClick={() => onRequest(name, option.split(" · ")[0])}>{option}</button>)}
      </div>
    </article>
  );
}
