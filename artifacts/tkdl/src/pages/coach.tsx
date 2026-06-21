import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListPlayers } from "@workspace/api-client-react";
import { useAuth } from "@/context/auth";
import { Dumbbell, Target, Zap, Flame, Rocket, Map, Trophy, ChevronDown, ChevronUp, RefreshCw, UserCircle } from "lucide-react";

type Drill = {
  id: string;
  title: string;
  icon: string;
  priority: "critical" | "high" | "normal" | "advanced";
  focus: string;
  description: string;
  drill: string;
  target: string;
  duration: string;
};

type RoutineStats = {
  avg: number | null;
  coPct: number | null;
  treblePct: number | null;
  highScoringRate: number | null;
  first9: number | null;
  totalSessions: number;
  totalDarts: number;
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; border: string; bg: string }> = {
  critical: { label: "Critical",  color: "#ff005c", border: "rgba(255,0,92,0.35)",  bg: "rgba(255,0,92,0.08)"  },
  high:     { label: "High",      color: "#ffd24a", border: "rgba(255,210,74,0.35)", bg: "rgba(255,210,74,0.06)" },
  normal:   { label: "Drill",     color: "#a78bfa", border: "rgba(167,139,250,0.3)", bg: "rgba(167,139,250,0.05)" },
  advanced: { label: "Advanced",  color: "#22c55e", border: "rgba(34,197,94,0.3)",  bg: "rgba(34,197,94,0.05)" },
};

function DrillCard({ drill, idx }: { drill: Drill; idx: number }) {
  const [open, setOpen] = useState(idx === 0 || drill.priority === "critical");
  const cfg = PRIORITY_CONFIG[drill.priority] ?? PRIORITY_CONFIG.normal;

  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={{ border: `1px solid ${cfg.border}`, background: cfg.bg }}>
      <button className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
        onClick={() => setOpen(o => !o)}>
        <span className="text-xl shrink-0 leading-none">{drill.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black uppercase text-sm tracking-wider"
              style={{ fontFamily: "Oswald, sans-serif", color: "#fff", letterSpacing: "0.05em" }}>
              {drill.title}
            </span>
            <span className="text-xs font-bold uppercase px-1.5 py-0.5 rounded"
              style={{ fontFamily: "Oswald, sans-serif", background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30`, fontSize: "0.5rem", letterSpacing: "0.1em" }}>
              {cfg.label}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.08em" }}>
              {drill.duration}
            </span>
          </div>
          {!open && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.65rem" }}>
              {drill.description}
            </p>
          )}
        </div>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
          : <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.55, fontSize: "0.8rem" }}>
            {drill.description}
          </p>
          <div className="rounded-lg px-3 py-2.5"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-xs font-bold uppercase mb-1" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", fontSize: "0.5rem", letterSpacing: "0.12em" }}>
              The Drill
            </div>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.5, fontSize: "0.8rem" }}>
              {drill.drill}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-3 h-3 shrink-0" style={{ color: cfg.color }} />
            <span className="text-xs font-bold" style={{ color: cfg.color, fontFamily: "Oswald, sans-serif", fontSize: "0.65rem" }}>
              Goal: {drill.target}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="px-3 py-2 rounded-lg text-center" style={{ background: `${color}10`, border: `1px solid ${color}28` }}>
      <div className="text-base font-black tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", color }}>{value}</div>
      <div className="text-xs mt-1 uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)", fontFamily: "Oswald, sans-serif", fontSize: "0.48rem" }}>{label}</div>
    </div>
  );
}

export default function Coach() {
  const { user } = useAuth();
  const { data: players } = useListPlayers();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [stats, setStats] = useState<RoutineStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [notEnoughData, setNotEnoughData] = useState(false);

  const activePlayers = (players ?? []).filter((p: any) => p.isActive || p.practiceEnabled || p.shadowBotEnabled);

  useEffect(() => {
    if (!user?.playerId || selectedId !== null) return;
    setSelectedId(user.playerId);
  }, [user, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setNotEnoughData(false);
    fetch(`/api/players/${selectedId}/practice-routine`)
      .then(r => r.json())
      .then((d: any) => {
        setDrills(Array.isArray(d.drills) ? d.drills : []);
        setStats(d.stats ?? null);
        setNotEnoughData((d.stats?.totalDarts ?? 0) < 50);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedId]);

  const selectedPlayer = activePlayers.find((p: any) => p.id === selectedId);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 pb-10">
      <div className="pdc-divider" />

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(9,9,15,0.99) 55%, rgba(255,0,92,0.03) 100%)",
          border: "1px solid rgba(167,139,250,0.2)",
          minHeight: 140,
        }}>
        <div className="absolute top-0 left-0 w-80 h-80 pointer-events-none"
          style={{ background: "radial-gradient(circle at 10% 40%, rgba(167,139,250,0.12), transparent 55%)" }} />
        <div className="relative p-6 md:p-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg" style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.28)" }}>
              <Dumbbell className="w-3.5 h-3.5" style={{ color: "#a78bfa" }} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest"
              style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", letterSpacing: "0.18em" }}>
              Training Coach
            </span>
          </div>
          <h1 className="font-black uppercase leading-none mb-2"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(2rem, 5vw, 3.2rem)", color: "#fff", letterSpacing: "0.04em" }}>
            Practice{" "}
            <span style={{ color: "#a78bfa", textShadow: "0 0 32px rgba(167,139,250,0.5)" }}>Routine</span>
          </h1>
          <p className="text-sm max-w-lg" style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
            Personalised drills built from your real dart DNA. Every session you play sharpens the recommendations.
          </p>
        </div>
      </div>

      {/* Player selector */}
      <div className="section-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserCircle className="w-4 h-4" style={{ color: "rgba(255,255,255,0.25)" }} />
          <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em" }}>
            Player
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {activePlayers.map((p: any) => (
            <button key={p.id}
              onClick={() => setSelectedId(p.id)}
              className="px-3 py-1.5 rounded-lg text-sm font-bold uppercase transition-all"
              style={{
                fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", fontSize: "0.75rem",
                background: selectedId === p.id ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${selectedId === p.id ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)"}`,
                color: selectedId === p.id ? "#a78bfa" : "rgba(255,255,255,0.45)",
              }}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Stats overview */}
      {stats && !loading && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {stats.avg != null && <StatPill label="3-dart avg" value={String(stats.avg)} color="#a78bfa" />}
          {stats.coPct != null && <StatPill label="Checkout %" value={`${stats.coPct}%`} color={stats.coPct >= 30 ? "#22c55e" : "#ff005c"} />}
          {stats.treblePct != null && <StatPill label="Treble %" value={`${stats.treblePct}%`} color="#ffd24a" />}
          {stats.highScoringRate != null && <StatPill label="140+ rate" value={`${stats.highScoringRate}%`} color="#f97316" />}
          {stats.first9 != null && <StatPill label="First 9" value={String(stats.first9)} color="#38bdf8" />}
        </div>
      )}

      {/* Drills */}
      {loading ? (
        <div className="section-card py-16 text-center">
          <div className="w-6 h-6 mx-auto rounded-full border-2 border-transparent animate-spin mb-3"
            style={{ borderTopColor: "#a78bfa" }} />
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
            Analysing your dart DNA…
          </p>
        </div>
      ) : !selectedId ? (
        <div className="section-card py-12 text-center">
          <Dumbbell className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.12)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Select a player to generate their routine</p>
        </div>
      ) : notEnoughData ? (
        <div className="section-card p-6 text-center space-y-3">
          <Zap className="w-8 h-8 mx-auto" style={{ color: "rgba(167,139,250,0.3)" }} />
          <div>
            <div className="font-black uppercase text-sm mb-1" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>
              Not Enough Data Yet
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)", lineHeight: 1.5 }}>
              {selectedPlayer?.name ?? "This player"} needs at least 50 darts of practice history for personalised recommendations.
              Play a few practice sessions first!
            </p>
          </div>
          <Link href="/practice">
            <button className="px-4 py-2 rounded-lg text-xs font-bold uppercase mt-2"
              style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.35)", color: "#a78bfa", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
              Go to Practice →
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4" style={{ color: "#ff005c" }} />
              <span className="font-black uppercase text-sm tracking-wider"
                style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)", letterSpacing: "0.1em" }}>
                Today's Session
              </span>
              {selectedPlayer && (
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem" }}>
                  {selectedPlayer.name}
                </span>
              )}
            </div>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
              {drills.length} drills · {drills.reduce((s, d) => s + parseInt(d.duration), 0)} min
            </span>
          </div>

          {drills.map((d, i) => <DrillCard key={d.id} drill={d} idx={i} />)}

          <div className="pt-2">
            <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", letterSpacing: "0.06em" }}>
              ROUTINE UPDATES AUTOMATICALLY AS YOUR DART DNA EVOLVES
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
