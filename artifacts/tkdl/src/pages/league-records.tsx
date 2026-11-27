import { Link } from "wouter";
import { BookOpen, Crosshair, Trophy, Users, Flame, History, ExternalLink, Target, ArrowLeft } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { Glow, DartboardBackdrop } from "@/components/premium/Premium";
import "./league-records.css";

type Entry = { playerId: number | null; name: string; value: number; date: string | null; matchKey: string | null; detail: string | null };
type Rec = { key: string; group: "oche" | "results" | "teams" | "games"; label: string; unit: string; better: "low" | "high"; scorer?: boolean; note?: string; entries: Entry[] };
type Broken = { id: number; title: string; unit: string; matchId: number; playerId: number; playerName: string; value: number; previous: number; previousHolder: string | null; at: string };
type Watch = { playerId: number; name: string; label: string; current: number; record: number; holder: string };
type Board = { records: Rec[]; watch: Watch[]; broken: Broken[] };

const GROUPS = [
  { key: "oche", title: "On the oche", sub: "From matches played on the TKDL scorer.", icon: Crosshair, colour: "#19c3c8" },
  { key: "results", title: "Results", sub: "From every league result.", icon: Trophy, colour: "#ffd24a" },
  { key: "games", title: "Cricket & Around the World", sub: "Wins from every result; darts and visits from games on the scorer.", icon: Target, colour: "#22c55e" },
  { key: "teams", title: "Teams", sub: "Doubles, Shift Wars and team matches.", icon: Users, colour: "#a855f7" },
] as const;

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
const fmtVal = (r: Rec, v: number) => `${Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1)}`;

function Holder({ e, className }: { e: Entry; className?: string }) {
  return e.playerId ? <Link href={`/players/${e.playerId}`} className={className}>{e.name}</Link> : <span className={className}>{e.name}</span>;
}

function RecordCard({ r, colour }: { r: Rec; colour: string }) {
  const [top, ...chasers] = r.entries;
  return (
    <article className="lr-card" style={{ ["--lr" as any]: colour }}>
      <header className="lr-card-head">
        <span>{r.label}</span>
        {r.scorer && <b className="lr-scorer" title="Needs matches played on the TKDL scorer"><Target size={10} /> Scorer</b>}
      </header>
      <div className="lr-main">
        <div className="lr-value">{fmtVal(r, top.value)}<small>{r.unit}</small></div>
        <div className="lr-holder">
          <Holder e={top} className="lr-name" />
          <div className="lr-meta">{[top.detail, fmtDate(top.date)].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      {top.matchKey && <Link href={`/match-centre/${top.matchKey}`} className="lr-match">View match <ExternalLink size={11} /></Link>}
      {chasers.length > 0 && (
        <ol className="lr-chasers">
          {chasers.map((c, i) => (
            <li key={i}><span className="lr-pos">{i + 2}</span><Holder e={c} className="lr-cname" /><span className="lr-cval">{fmtVal(r, c.value)} {r.unit}</span></li>
          ))}
        </ol>
      )}
      {r.note && <p className="lr-note">{r.note}</p>}
    </article>
  );
}

export default function LeagueRecords() {
  const { data, loading } = useFetch<Board>("/api/league-records/board");
  const recs = data?.records ?? [];
  return (
    <div className="space-y-6 pm-page lr-page">
      <div className="relative overflow-hidden lr-hero">
        <Glow x="85%" y="5%" color="#19c3c8" size={440} opacity={0.26} />
        <Glow x="5%" y="95%" color="#ffd24a" size={360} opacity={0.18} />
        <DartboardBackdrop size={460} opacity={0.08} style={{ right: -170, top: -100, transform: "rotate(8deg)" }} />
        <div className="relative p-5" style={{ zIndex: 1 }}>
          <span className="pm-lab inline-flex items-center gap-1.5" style={{ color: "#19c3c8" }}><BookOpen className="w-3.5 h-3.5" /> TKDL · The record book</span>
          <h1 className="pm-title uppercase lr-title">League Records</h1>
          <p className="text-sm mt-2" style={{ color: "#a9a4bd" }}>Written live from every result and every dart thrown on the scorer.</p>
          {recs.length > 0 && <div className="lr-strip"><span><b>{recs.length}</b> records</span><span><b>{data?.broken.length ?? 0}</b> broken lately</span><span><b>{new Set(recs.map(r => r.entries[0]?.name)).size}</b> holders</span></div>}
          <div className="flex gap-2 mt-4 flex-wrap">
            <Link href="/hall-of-fame" className="pm-chip" style={{ color: "#ffd24a", borderColor: "rgba(255,210,74,.45)" }}>Hall of Fame →</Link>
            <Link href="/hall-of-shame" className="pm-chip" style={{ color: "#ff005c", borderColor: "rgba(255,0,92,.45)" }}>Hall of Shame →</Link>
          </div>
        </div>
      </div>

      {loading && <div className="pdc-card h-40 animate-pulse" />}
      {!loading && recs.length === 0 && <div className="pdc-card p-8 text-center text-white/40">No records yet. Play some matches!</div>}

      {data && data.watch.length > 0 && (
        <section>
          <h2 className="lr-section"><Flame size={15} style={{ color: "#ff6b35" }} /> Record watch</h2>
          <div className="lr-watch">
            {data.watch.map(w => (
              <Link key={w.playerId} href={`/players/${w.playerId}`} className="lr-watch-card">
                <div className="lr-watch-top"><b>{w.name}</b><span>{w.label}</span></div>
                <div className="lr-watch-val">{w.current}<small> / {w.record}</small></div>
                <div className="lr-bar"><span style={{ width: `${Math.min(100, (w.current / w.record) * 100)}%` }} /></div>
                <div className="lr-watch-sub">{w.current >= w.record ? "Level with the record!" : `${w.record - w.current} more to match ${w.holder}`}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data && data.broken.length > 0 && (
        <section>
          <h2 className="lr-section"><History size={15} style={{ color: "#ffd24a" }} /> Recently broken</h2>
          <ol className="lr-timeline">
            {data.broken.map(b => (
              <li key={b.id}>
                <span className="lr-dot" />
                <div className="lr-tl-date">{fmtDate(b.at)}</div>
                <div className="lr-tl-title">{b.title}</div>
                <div className="lr-tl-body">
                  <Link href={`/players/${b.playerId}`} className="lr-tl-new">{b.playerName} · {b.value} {b.unit}</Link>
                  <span className="lr-tl-old">was {b.previous}{b.previousHolder ? ` (${b.previousHolder})` : ""}</span>
                </div>
                <Link href={`/match-centre/league-${b.matchId}`} className="lr-match">View match <ExternalLink size={11} /></Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {GROUPS.map(g => {
        const list = recs.filter(r => r.group === g.key);
        if (!list.length) return null;
        const Icon = g.icon;
        return (
          <section key={g.key}>
            <h2 className="lr-section"><Icon size={15} style={{ color: g.colour }} /> {g.title}<small>{g.sub}</small></h2>
            <div className="lr-grid">{list.map(r => <RecordCard key={r.key} r={r} colour={g.colour} />)}</div>
          </section>
        );
      })}

      <p className="text-xs text-white/30 text-center pb-4">Records marked Scorer only count matches played on the TKDL scorer. Results entered by hand still count for everything else.</p>
      <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}><ArrowLeft className="w-3 h-3" /> Standings</Link>
    </div>
  );
}
