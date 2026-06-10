import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";

// ── Scorecard helpers ─────────────────────────────────────────────────────────

type ScorecardDart  = { label: string; val: number; isDouble: boolean; isTreble: boolean; isMiss: boolean };
type ScorecardVisit = { darts: ScorecardDart[]; total: number; remaining: number; isBust: boolean; isCheckout: boolean };
type ScorecardLeg   = { legNum: number; visits: ScorecardVisit[]; dartCount: number };

function makeDartLabel(d: { seg: number; mult: number; val: number }): ScorecardDart {
  if (d.seg === 0)                    return { label: "MISS", val: 0,     isDouble: false, isTreble: false, isMiss: true  };
  if (d.seg === 25 && d.mult === 2)   return { label: "BULL", val: 50,    isDouble: true,  isTreble: false, isMiss: false };
  if (d.seg === 25)                   return { label: "25",   val: 25,    isDouble: false, isTreble: false, isMiss: false };
  if (d.mult === 3)                   return { label: `T${d.seg}`, val: d.val, isDouble: false, isTreble: true,  isMiss: false };
  if (d.mult === 2)                   return { label: `D${d.seg}`, val: d.val, isDouble: true,  isTreble: false, isMiss: false };
  return { label: String(d.seg), val: d.val, isDouble: false, isTreble: false, isMiss: false };
}

function parseX01Scorecard(darts: { seg: number; mult: number; val: number }[], startScore: number): ScorecardLeg[] {
  const legs: ScorecardLeg[] = [];
  let remaining  = startScore;
  let visitStart = startScore;
  let currentLeg: ScorecardVisit[] = [];
  let visitDarts: { d: ScorecardDart; val: number }[] = [];

  function endVisit(isBust: boolean, isCheckout: boolean, finalRemaining: number) {
    currentLeg.push({
      darts: visitDarts.map(v => v.d),
      total: visitDarts.reduce((s, v) => s + v.val, 0),
      remaining: finalRemaining, isBust, isCheckout,
    });
    visitDarts = [];
  }

  for (const dart of darts) {
    const d = makeDartLabel(dart);
    const tentative = remaining - dart.val;
    visitDarts.push({ d, val: dart.val });

    if (tentative < 0 || tentative === 1) {
      endVisit(true, false, visitStart);
      remaining = visitStart; visitStart = remaining;
    } else if (tentative === 0) {
      endVisit(false, true, 0);
      legs.push({ legNum: legs.length + 1, visits: currentLeg, dartCount: currentLeg.reduce((s, v) => s + v.darts.length, 0) });
      currentLeg = []; remaining = startScore; visitStart = startScore;
    } else {
      remaining = tentative;
      if (visitDarts.length === 3) { endVisit(false, false, remaining); visitStart = remaining; }
    }
  }

  if (visitDarts.length > 0) {
    currentLeg.push({ darts: visitDarts.map(v => v.d), total: visitDarts.reduce((s, v) => s + v.val, 0), remaining, isBust: false, isCheckout: false });
  }
  if (currentLeg.length > 0) {
    legs.push({ legNum: legs.length + 1, visits: currentLeg, dartCount: currentLeg.reduce((s, v) => s + v.darts.length, 0) });
  }
  return legs;
}

function x01StartScore(key: string): number | null {
  const m = key.match(/^(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return [101, 201, 301, 401, 501, 601, 701, 1001, 1501, 2001].includes(n) ? n : null;
}

// ── Scorecard UI ──────────────────────────────────────────────────────────────

function ScorecardLegView({ leg }: { leg: ScorecardLeg }) {
  const [open, setOpen] = useState(false);
  const checkout = leg.visits.find(v => v.isCheckout);
  const highVisit = leg.visits.reduce((best, v) => v.total > best ? v.total : best, 0);
  return (
    <div className="rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.05)", marginBottom: "4px" }}>
      {/* Leg header — always visible, click to toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 transition-colors hover:bg-white/[0.03]"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <span className="font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "#ffd24a", minWidth: "2.5rem", textAlign: "left" }}>
          Leg {leg.legNum}
        </span>
        <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: "rgba(255,255,255,0.22)" }}>
          {leg.dartCount}d
        </span>
        {highVisit === 180 && (
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.48rem", color: "#ffd24a", background: "rgba(255,210,74,0.1)", padding: "1px 4px", borderRadius: "3px" }}>180</span>
        )}
        {checkout && (
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.48rem", color: "#4ade80", background: "rgba(34,197,94,0.08)", padding: "1px 4px", borderRadius: "3px" }}>
            CO {checkout.total}
          </span>
        )}
        <span className="flex-1" />
        <ChevronDown className="w-3 h-3 shrink-0 transition-transform" style={{ color: "rgba(255,255,255,0.2)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {/* Visit rows — only when expanded */}
      {open && (
        <div className="px-2 pb-2 pt-1 space-y-0.5">
          {leg.visits.map((visit, vi) => (
            <div key={vi} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{
              background: visit.isBust ? "rgba(255,0,92,0.06)" : visit.isCheckout ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)",
            }}>
              <div className="flex gap-1 flex-1">
                {visit.darts.map((d, di) => (
                  <span key={di} className="px-1 py-0.5 rounded font-bold" style={{
                    fontFamily: "Oswald, sans-serif", fontSize: "0.62rem",
                    background: d.val === 60 ? "rgba(255,210,74,0.12)" : d.val === 50 ? "rgba(255,120,180,0.1)" : d.isDouble ? "rgba(34,197,94,0.08)" : d.isTreble ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.04)",
                    color: d.val === 60 ? "#ffd24a" : d.val === 50 ? "#ff7eb3" : d.isDouble ? "#4ade80" : d.isTreble ? "#a5b4fc" : d.isMiss ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.65)",
                    border: `1px solid ${d.val === 60 ? "rgba(255,210,74,0.14)" : d.isDouble ? "rgba(74,222,128,0.1)" : d.isTreble ? "rgba(165,180,252,0.1)" : "transparent"}`,
                  }}>
                    {d.label}
                  </span>
                ))}
                {Array.from({ length: 3 - visit.darts.length }).map((_, i) => (
                  <span key={`p${i}`} style={{ fontSize: "0.62rem", color: "transparent", userSelect: "none" }}>___</span>
                ))}
              </div>
              <span className="font-black shrink-0 text-right" style={{
                fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", minWidth: "2.8rem",
                color: visit.total === 180 ? "#ffd24a" : visit.isBust ? "#ff005c" : visit.isCheckout ? "#4ade80" : "rgba(255,255,255,0.45)",
              }}>
                {visit.isBust ? "BUST" : visit.total === 180 ? "180!" : visit.total}
              </span>
              <span className="shrink-0 text-right" style={{
                fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", minWidth: "1.8rem",
                color: visit.isCheckout ? "#4ade80" : "rgba(255,255,255,0.18)",
              }}>
                {visit.isCheckout ? "✓" : visit.remaining}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScorecardView({ session_data, game_type_key, p1_name, p2_name }: {
  session_data: any; game_type_key: string | null; p1_name?: string | null; p2_name?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const startScore = game_type_key ? x01StartScore(game_type_key) : null;
  const p1Log: { seg: number; mult: number; val: number }[] = session_data?.dartLog ?? [];
  const p2Log: { seg: number; mult: number; val: number }[] = session_data?.p2DartLog ?? [];
  if (!startScore || (!p1Log.length && !p2Log.length)) return null;
  const p1Legs = p1Log.length ? parseX01Scorecard(p1Log, startScore) : [];
  const p2Legs = p2Log.length ? parseX01Scorecard(p2Log, startScore) : [];
  const hasP2  = p2Legs.length > 0;

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 mb-2">
        <span className="font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.15em" }}>Scorecard</span>
        <span className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
        <ChevronDown className="w-3 h-3 transition-transform shrink-0" style={{ color: "rgba(255,255,255,0.2)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && (
        <div className="space-y-1 pt-1">
          {p1Legs.length > 0 && (
            <div>
              {hasP2 && <div className="font-bold uppercase mb-2" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.52rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em" }}>{p1_name ?? "P1"}</div>}
              {p1Legs.map(leg => <ScorecardLegView key={leg.legNum} leg={leg} />)}
            </div>
          )}
          {hasP2 && (
            <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <div className="font-bold uppercase mb-2" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.52rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em" }}>{p2_name ?? "P2"}</div>
              {p2Legs.map(leg => <ScorecardLegView key={leg.legNum} leg={leg} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Session card (summary row + expandable detail + scorecard) ────────────────

type SessionSummary = {
  id: number;
  game_type_key: string | null;
  game_type_name: string | null;
  detail: string | null;
  duration_seconds: number | null;
  created_at: string;
  won: boolean | null;
  darts: number | null;
  avg: string | null;
  s180s: number | null;
  co_attempts: number | null;
  co_hits: number | null;
};

const MODE_META: Record<string, { label: string; color: string }> = {
  master501: { label: "M-501", color: "#00c8a0" },
  tour:      { label: "TOUR",  color: "#ffd24a" },
  practice:  { label: "PRACTICE", color: "#a78bfa" },
};

function SessionCard({ session, accentColor = "#a78bfa" }: { session: SessionSummary; accentColor?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [detail,   setDetail]   = useState<any | null>(null);
  const [loading,  setLoading]  = useState(false);

  const won  = session.won;
  const avg  = session.avg  != null ? Number(session.avg).toFixed(1) : null;
  const coH  = Number(session.co_hits     ?? 0);
  const coA  = Number(session.co_attempts ?? 0);
  const coPct = coA > 0 ? Math.round((coH / coA) * 100) : null;

  const handleExpand = async () => {
    if (!expanded && !detail) {
      setLoading(true);
      try {
        const d = await fetch(`/api/practice/sessions/${session.id}`).then(r => r.json());
        setDetail(d);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    setExpanded(o => !o);
  };

  const mode = detail?.session_data?.mode as string | undefined;
  const modeMeta = mode ? MODE_META[mode] : undefined;

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
      <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={handleExpand}>
        <div className="w-1 h-7 rounded-full shrink-0"
          style={{ background: won === null ? "rgba(255,255,255,0.15)" : won ? "#22c55e" : "#ff005c" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.75)" }}>
              {session.game_type_name}
            </span>
            {won !== null && (
              <span className="text-xs font-black" style={{ fontFamily: "Oswald, sans-serif", color: won ? "#22c55e" : "#ff005c", fontSize: "0.62rem" }}>
                {won ? "WIN" : "LOSS"}
              </span>
            )}
            {modeMeta && (
              <span className="text-xs font-black px-1 py-0 rounded" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", background: modeMeta.color + "18", color: modeMeta.color, border: `1px solid ${modeMeta.color}30` }}>
                {modeMeta.label}
              </span>
            )}
            {session.detail && <span className="text-xs font-mono truncate max-w-[120px]" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.6rem" }}>{session.detail}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {avg  && <span className="text-xs font-mono" style={{ color: accentColor }}>{avg} avg</span>}
            {Number(session.s180s) > 0 && <span className="text-xs font-mono" style={{ color: "#ffd24a" }}>{session.s180s}×180</span>}
            {coPct !== null && <span className="text-xs font-mono" style={{ color: "#22c55e" }}>{coPct}% co</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-right" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
            {format(new Date(session.created_at), "d MMM")}
          </span>
          <ChevronDown className="w-3 h-3 transition-transform" style={{ color: "rgba(255,255,255,0.2)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1">
          {loading ? (
            <div className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Loading…</div>
          ) : detail ? (
            <div>
              {/* Stats strip */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {detail.p1_avg != null && (
                  <div className="text-center px-3 py-1.5 rounded flex-1" style={{ background: accentColor + "12", border: `1px solid ${accentColor}20` }}>
                    <div className="font-black" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", color: accentColor }}>{Number(detail.p1_avg).toFixed(2)}</div>
                    <div className="uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.42rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>3-dart avg</div>
                  </div>
                )}
                {Number(detail.p1_180s) > 0 && (
                  <div className="text-center px-3 py-1.5 rounded flex-1" style={{ background: "rgba(255,210,74,0.08)", border: "1px solid rgba(255,210,74,0.15)" }}>
                    <div className="font-black" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", color: "#ffd24a" }}>{detail.p1_180s}</div>
                    <div className="uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.42rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>180s</div>
                  </div>
                )}
                {Number(detail.p1_checkout_attempts) > 0 && (
                  <div className="text-center px-3 py-1.5 rounded flex-1" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)" }}>
                    <div className="font-black" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", color: "#22c55e" }}>
                      {Math.round((Number(detail.p1_checkout_hits) / Number(detail.p1_checkout_attempts)) * 100)}%
                    </div>
                    <div className="uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.42rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>checkout</div>
                  </div>
                )}
                {detail.p1_darts != null && (
                  <div className="text-center px-3 py-1.5 rounded flex-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="font-black" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>{detail.p1_darts}</div>
                    <div className="uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.42rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>darts</div>
                  </div>
                )}
              </div>
              {/* Context info from session_data */}
              {detail.session_data?.tierName && (
                <div className="text-xs mb-2" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", fontSize: "0.55rem" }}>
                  {detail.session_data.tierName} · Round {detail.session_data.round} · {detail.session_data.dartLimit} darts/leg
                </div>
              )}
              {detail.session_data?.tourName && (
                <div className="text-xs mb-2" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", fontSize: "0.55rem" }}>
                  {detail.session_data.tourName} · {detail.session_data.difficulty} · vs {detail.session_data.opponent}
                </div>
              )}
              {/* Scorecard */}
              <ScorecardView
                session_data={detail.session_data}
                game_type_key={detail.game_type_key}
                p1_name={detail.p1_name}
                p2_name={detail.p2_name}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── SessionHistorySection — drop-in section for any page ─────────────────────

export function SessionHistorySection({
  playerId,
  mode,
  title = "Recent Sessions",
  accentColor = "#a78bfa",
  limit = 10,
  emptyIcon,
  emptyMessage = "No sessions yet",
}: {
  playerId: number | null;
  mode?: string;
  title?: string;
  accentColor?: string;
  limit?: number;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
}) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);

  useEffect(() => {
    if (!playerId) { setSessions([]); return; }
    setLoading(true);
    const qs = mode ? `?mode=${encodeURIComponent(mode)}` : "";
    fetch(`/api/players/${playerId}/practice-sessions${qs}`)
      .then(r => r.json())
      .then((d: SessionSummary[]) => setSessions(Array.isArray(d) ? d.slice(0, limit) : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [playerId, mode, limit]);

  if (!playerId) return null;

  return (
    <div className="pdc-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center gap-2 transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
        <h2 className="font-bold uppercase text-sm tracking-wider flex-1 text-left"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
          {title}
        </h2>
        {sessions.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: accentColor + "22", color: accentColor, fontFamily: "Oswald, sans-serif" }}>
            {sessions.length}
          </span>
        )}
        <ChevronDown className="w-4 h-4 shrink-0 transition-transform"
          style={{ color: "rgba(255,255,255,0.25)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && (
        <div>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Loading…</div>
          ) : sessions.length > 0 ? (
            sessions.map(s => <SessionCard key={s.id} session={s} accentColor={accentColor} />)
          ) : (
            <div className="px-4 py-10 text-center">
              {emptyIcon && <div className="mb-3 opacity-10">{emptyIcon}</div>}
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>{emptyMessage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
