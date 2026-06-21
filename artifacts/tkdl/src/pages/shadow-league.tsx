import { useState, useEffect } from "react";
import { Link } from "wouter";
import { CircuitBoard, Lock, Trophy, TrendingUp, Target, Zap } from "lucide-react";

const LEVEL_COLOR: Record<string, string> = {
  beginner: "#94a3b8", amateur: "#22c55e", club: "#3b82f6",
  county: "#a78bfa", pro: "#ffd24a", elite: "#ff005c",
};
const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner", amateur: "Amateur", club: "Club",
  county: "County", pro: "Pro Tour", elite: "Elite",
};

type LeagueRow = {
  player_id: number; player_name: string; sessions: number; total_darts: number;
  weighted_avg: number | null; checkout_pct: number | null; total_180s: number; level: string;
};

export default function ShadowLeague() {
  const [data, setData] = useState<{ enabled: boolean; rows: LeagueRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/shadow-bot/league")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData({ enabled: false, rows: [] }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 pb-10">
      <div className="pdc-divider" />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(255,210,74,0.07) 0%, rgba(9,9,15,0.99) 55%, rgba(255,0,92,0.03) 100%)",
          border: "1px solid rgba(255,210,74,0.18)",
          minHeight: 140,
        }}>
        <div className="absolute top-0 left-0 w-80 h-80 pointer-events-none"
          style={{ background: "radial-gradient(circle at 10% 40%, rgba(255,210,74,0.1), transparent 55%)" }} />
        <div className="relative p-6 md:p-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg" style={{ background: "rgba(255,210,74,0.1)", border: "1px solid rgba(255,210,74,0.25)" }}>
              <CircuitBoard className="w-3.5 h-3.5" style={{ color: "#ffd24a" }} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest"
              style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", letterSpacing: "0.18em" }}>
              Shadow Bot
            </span>
          </div>
          <h1 className="font-black uppercase leading-none mb-2"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(2rem, 5vw, 3.2rem)", color: "#fff", letterSpacing: "0.04em" }}>
            Shadow{" "}
            <span style={{ color: "#ffd24a", textShadow: "0 0 32px rgba(255,210,74,0.5)" }}>League</span>
          </h1>
          <p className="text-sm max-w-lg" style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
            All shadow bots ranked by form. Rankings update automatically as players log more practice data.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="section-card py-16 text-center">
          <div className="w-6 h-6 mx-auto rounded-full border-2 border-transparent animate-spin mb-3" style={{ borderTopColor: "#ffd24a" }} />
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Loading shadow league…</p>
        </div>
      ) : !data?.enabled ? (
        <div className="section-card p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,210,74,0.08)", border: "1px solid rgba(255,210,74,0.2)" }}>
            <Lock className="w-7 h-7" style={{ color: "rgba(255,210,74,0.4)" }} />
          </div>
          <div>
            <div className="font-black uppercase text-lg mb-2" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>
              Not Yet Active
            </div>
            <p className="text-sm max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.22)", lineHeight: 1.6 }}>
              The Shadow League will launch once enough players have their bots online.
              An admin can enable it from the Feature Flags panel.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            <Link href="/shadow-bot">
              <button className="px-4 py-2 rounded-lg text-xs font-bold uppercase"
                style={{ background: "rgba(255,210,74,0.1)", border: "1px solid rgba(255,210,74,0.3)", color: "#ffd24a", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                Bot Roster →
              </button>
            </Link>
            <Link href="/practice">
              <button className="px-4 py-2 rounded-lg text-xs font-bold uppercase"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                Practice →
              </button>
            </Link>
          </div>
        </div>
      ) : data.rows.length === 0 ? (
        <div className="section-card py-12 text-center">
          <CircuitBoard className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>No bots have enough data yet (250+ darts required).</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,210,74,0.15)", background: "rgba(255,210,74,0.02)" }}>
            {/* Header */}
            <div className="grid px-4 py-2.5" style={{
              gridTemplateColumns: "2.5rem 1fr 7rem 4.5rem 5rem 4.5rem 4.5rem",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              {["#", "Bot", "Form", "Avg", "CO%", "180s", "Darts"].map(h => (
                <div key={h} className="text-xs font-black uppercase tracking-widest text-right first:text-left"
                  style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em", fontSize: "0.5rem" }}>
                  {h}
                </div>
              ))}
            </div>

            {data.rows.map((row, i) => {
              const color = LEVEL_COLOR[row.level] ?? "#94a3b8";
              const label = LEVEL_LABEL[row.level] ?? row.level;
              const isTop = i === 0;
              return (
                <Link key={row.player_id} href={`/shadow-bot/${row.player_id}`}>
                  <div className="grid px-4 py-3 cursor-pointer transition-all hover:bg-white/[0.025]"
                    style={{
                      gridTemplateColumns: "2.5rem 1fr 7rem 4.5rem 5rem 4.5rem 4.5rem",
                      borderBottom: i < data.rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      background: isTop ? `${color}06` : undefined,
                    }}>
                    {/* Rank */}
                    <div className="font-black text-sm self-center"
                      style={{ fontFamily: "Oswald, sans-serif", color: isTop ? "#ffd24a" : "rgba(255,255,255,0.22)" }}>
                      {isTop ? "👑" : i + 1}
                    </div>
                    {/* Name */}
                    <div className="self-center min-w-0">
                      <div className="font-black text-sm truncate"
                        style={{ fontFamily: "Oswald, sans-serif", color: isTop ? "#fff" : "rgba(255,255,255,0.8)", letterSpacing: "0.02em" }}>
                        Shadow {row.player_name}
                      </div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem" }}>
                        {row.sessions} sessions
                      </div>
                    </div>
                    {/* Level */}
                    <div className="self-center text-right">
                      <span className="font-black text-xs uppercase px-2 py-0.5 rounded"
                        style={{ fontFamily: "Oswald, sans-serif", background: `${color}14`, color, border: `1px solid ${color}28`, fontSize: "0.5rem", letterSpacing: "0.06em" }}>
                        {label}
                      </span>
                    </div>
                    {/* Avg */}
                    <div className="self-center text-right font-black text-sm"
                      style={{ fontFamily: "Oswald, sans-serif", color: isTop ? color : "rgba(255,255,255,0.85)" }}>
                      {row.weighted_avg != null ? row.weighted_avg.toFixed(1) : "—"}
                    </div>
                    {/* CO% */}
                    <div className="self-center text-right text-xs font-bold"
                      style={{ fontFamily: "Oswald, sans-serif", color: row.checkout_pct != null && row.checkout_pct >= 30 ? "#22c55e" : "rgba(255,255,255,0.35)" }}>
                      {row.checkout_pct != null ? `${row.checkout_pct}%` : "—"}
                    </div>
                    {/* 180s */}
                    <div className="self-center text-right text-xs font-bold"
                      style={{ fontFamily: "Oswald, sans-serif", color: row.total_180s > 0 ? "#ffd24a" : "rgba(255,255,255,0.2)" }}>
                      {row.total_180s > 0 ? row.total_180s : "—"}
                    </div>
                    {/* Darts */}
                    <div className="self-center text-right text-xs"
                      style={{ color: "rgba(255,255,255,0.28)", fontFamily: "Oswald, sans-serif" }}>
                      {Number(row.total_darts).toLocaleString()}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.06em" }}>
            RANKED BY RECENCY-WEIGHTED 3-DART AVERAGE · MINIMUM 250 DARTS TO QUALIFY
          </p>
        </div>
      )}
    </div>
  );
}
