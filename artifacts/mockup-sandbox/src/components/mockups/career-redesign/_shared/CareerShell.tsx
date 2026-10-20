import { useState, type ReactNode } from "react";
import { Bell, CalendarDays, House, Shield, UserRound, X, Check, ChevronRight, Radio, Map } from "lucide-react";

export type CareerPage = "Overview" | "MyCareer" | "Club";

const routes: { id: CareerPage; label: string; icon: typeof House }[] = [
  { id: "Overview", label: "Overview", icon: House },
  { id: "MyCareer", label: "My Career", icon: UserRound },
  { id: "Club", label: "Club", icon: Shield },
];

type Ping = { id: string; title: string; detail: string; action?: boolean };
const initialPings: Ping[] = [
  { id: "review", title: "Season review ready", detail: "Your Season 1 record is waiting to be acknowledged.", action: true },
  { id: "entry", title: "East Midlands Open", detail: "Entry closes this week · £18 entry fee.", action: true },
  { id: "rank", title: "First ranking recorded", detail: "A top-eight finish has put you on the county board." },
];

export function CareerShell({ page, children }: { page: CareerPage; children: ReactNode }) {
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [pings, setPings] = useState(() => {
    try {
      const read = new Set<string>(JSON.parse(localStorage.getItem("tkdl-career-pings-read") || "[]"));
      return initialPings.map(item => ({ ...item, read: read.has(item.id) }));
    } catch {
      return initialPings.map(item => ({ ...item, read: false }));
    }
  });
  const unread = pings.filter(item => !item.read).length;
  const saveReads = (next: typeof pings) => {
    try { localStorage.setItem("tkdl-career-pings-read", JSON.stringify(next.filter(item => item.read).map(item => item.id))); } catch { /* Local preview remains usable if storage is unavailable. */ }
    return next;
  };
  const markRead = (id: string) => setPings(old => saveReads(old.map(item => item.id === id ? { ...item, read: true } : item)));
  const markAll = () => setPings(old => saveReads(old.map(item => ({ ...item, read: true }))));
  return <div className="tk-career">
    <header className="tk-topbar">
      <a className="tk-brand" href="/__mockup/preview/career-redesign/Overview" aria-label="Career overview">
        <span className="tk-brand-mark"><span /></span><span>TKDL <b>CAREER</b><small>PLAYER CONTROL ROOM</small></span>
      </a>
      <div className="tk-top-meta"><span className="season-live"><i /> SEASON 2</span><span>WEEK 18</span><span className="meta-divider" /><span>THE NORTH STAR</span></div>
      <div className="tk-attention-anchor">
        <button className={`tk-attention-button ${attentionOpen ? "is-open" : ""}`} onClick={() => setAttentionOpen(!attentionOpen)} aria-expanded={attentionOpen}>
          <Bell size={17} /><span>Attention</span>{unread > 0 && <b className="tk-unread">{unread}</b>}
        </button>
        {attentionOpen && <section className="tk-attention-pop" aria-label="Career attention">
          <header><div><span className="tk-overline">CAREER INBOX</span><h2>Attention</h2><p>Your action list and latest updates.</p></div>
            <button className="tk-icon-button" aria-label="Close attention" onClick={() => setAttentionOpen(false)}><X size={17} /></button></header>
          <div className="tk-ping-list">
            <div className="tk-ping-head"><span>{unread ? `${unread} unread` : "All caught up"}</span><button onClick={markAll} disabled={!unread}>{unread ? "Mark all read" : "Done"}</button></div>
            {pings.map(ping => <button key={ping.id} className={`tk-ping ${ping.read ? "is-read" : ""}`} onClick={() => markRead(ping.id)}>
              <span className={`ping-dot ${ping.action ? "is-action" : ""}`} /><span><strong>{ping.title}</strong><small>{ping.detail}</small></span>
              {ping.read ? <Check size={15} /> : <ChevronRight size={15} />}
            </button>)}
            <p className="tk-ping-foot">Reading an update never removes an unresolved action.</p>
          </div>
        </section>}
      </div>
    </header>
    <nav className="tk-nav" aria-label="Career navigation">
      {routes.map(route => {
        const Icon = route.icon;
        return <a key={route.id} href={`/__mockup/preview/career-redesign/${route.id}`} className={`tk-nav-link ${page === route.id ? "is-active" : ""}`} aria-current={page === route.id ? "page" : undefined}>
          <Icon size={17} /><span>{route.label}</span>{page === route.id && <i />}
        </a>;
      })}
      <div className="tk-nav-context"><span><CalendarDays size={14} />SEASON 2 · WEEK 18</span><span><Map size={14} />NOTTINGHAMSHIRE</span></div>
    </nav>
    <main className="tk-content">{children}</main>
    <footer className="tk-footer"><span><Radio size={14} /> TKDL CAREER SIMULATION</span><a href="/__mockup/preview/career-redesign/Overview">Back to Career overview <ChevronRight size={14} /></a></footer>
  </div>;
}

export function Eyebrow({ children }: { children: ReactNode }) { return <span className="tk-overline">{children}</span>; }
