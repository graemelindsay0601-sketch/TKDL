import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";

const TIER_COLORS: Record<string, string> = {
  Diamond:  "#00d4ff",
  Platinum: "#e879f9",
  Gold:     "#ffd24a",
  Silver:   "#c0c8d8",
  Bronze:   "#cd7f32",
};
const TIER_ICONS: Record<string, string> = {
  Diamond: "💎", Platinum: "⚡", Gold: "🥇", Silver: "🥈", Bronze: "🥉",
};

function useTick() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Broadcast() {
  const [standings, setStandings]   = useState<any[]>([]);
  const [recentMatches, setMatches] = useState<any[]>([]);
  const [summary, setSummary]       = useState<any>(null);
  const [featuredIdx, setFeatured]  = useState(0);
  const now = useTick();
  const tickerRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    fetch("/api/leaderboard").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setStandings(d.slice(0, 10));
    }).catch(() => {});
    fetch("/api/matches?limit=8").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setMatches(d);
    }).catch(() => {});
    fetch("/api/stats/summary").then(r => r.json()).then(setSummary).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (standings.length < 2) return;
    const t = setInterval(() => setFeatured(i => (i + 1) % Math.min(standings.length, 5)), 8000);
    return () => clearInterval(t);
  }, [standings.length]);

  const featured = standings[featuredIdx];
  const seasonName = summary?.currentSeason?.name ?? "Current Season";
  const totalMatches = summary?.totalMatches ?? 0;

  const leader = standings[0];
  const second = standings[1];
  const leaderPts = leader ? (leader.seasonPoints ?? leader.points ?? 0) : 0;
  const secondPts = second ? (second.seasonPoints ?? second.points ?? 0) : 0;
  const gap = leader && second ? leaderPts - secondPts : null;

  const tickerItems = recentMatches.map(m =>
    `${m.winnerName} def. ${m.loserName}${m.stake > 0 ? ` (+${m.stake}pts)` : ""}`
  );

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{
        background: "radial-gradient(ellipse at 20% 20%, rgba(255,0,92,0.12) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(0,102,255,0.1) 0%, transparent 55%), #06040e",
        fontFamily: "Oswald, sans-serif",
      }}
    >
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }} />

      {/* ── TOP BAR ── */}
      <div className="relative flex items-center justify-between px-8 py-4 border-b"
        style={{ borderColor: "rgba(255,0,92,0.2)", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl"
            style={{ background: "rgba(255,0,92,0.15)", border: "1px solid rgba(255,0,92,0.35)", color: "#ff005c" }}>
            🎯
          </div>
          <div>
            <div className="font-black uppercase tracking-widest leading-none text-white" style={{ fontSize: "1.1rem", letterSpacing: "0.15em" }}>
              TESCO KILBIRNIE DARTS LEAGUE
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>
              {seasonName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="font-black text-2xl tabular-nums text-white leading-none">
              {format(now, "HH:mm")}
              <span className="text-base" style={{ color: "rgba(255,255,255,0.3)" }}>:{format(now, "ss")}</span>
            </div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{format(now, "EEEE, d MMMM yyyy")}</div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(255,0,92,0.15)", border: "1px solid rgba(255,0,92,0.4)" }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#ff005c" }} />
            <span className="font-black uppercase tracking-widest text-xs" style={{ color: "#ff005c", letterSpacing: "0.15em" }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="relative flex gap-0 h-[calc(100vh-124px)]">

        {/* ── LEFT: LEADERBOARD ── */}
        <div className="w-[42%] flex flex-col border-r" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="px-6 py-3 border-b flex items-center justify-between"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
            <span className="font-black uppercase tracking-widest text-xs" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em" }}>
              SEASON STANDINGS
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{totalMatches} matches played</span>
          </div>

          {/* Header labels */}
          <div className="grid px-6 py-2" style={{ gridTemplateColumns: "2rem 1fr 3rem 3rem 5rem" }}>
            {["#", "PLAYER", "W", "L", "PTS"].map((h, i) => (
              <span key={h} className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.6rem", textAlign: i >= 2 ? "right" : "left" }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-hidden">
            {standings.map((s, i) => {
              const tierColor = TIER_COLORS[s.tier] ?? "#94a3b8";
              const tierIcon  = TIER_ICONS[s.tier] ?? "🎯";
              const isFirst   = i === 0;
              const form: string = s.form ?? "";
              return (
                <div key={s.playerId}
                  className="grid items-center px-6 py-3 border-b"
                  style={{
                    gridTemplateColumns: "2rem 1fr 3rem 3rem 5rem",
                    borderColor: "rgba(255,255,255,0.04)",
                    background: isFirst ? "rgba(255,0,92,0.05)" : "transparent",
                    borderLeft: isFirst ? "3px solid rgba(255,0,92,0.5)" : "3px solid transparent",
                  }}>
                  <div className="font-black text-center" style={{
                    color: i === 0 ? "#ffd24a" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.25)",
                    fontSize: i < 3 ? "1.1rem" : "0.85rem",
                  }}>
                    {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: "0.8rem" }}>{tierIcon}</span>
                      <span className="font-black uppercase truncate text-white leading-none" style={{ fontSize: "1rem", letterSpacing: "0.05em" }}>
                        {s.playerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs" style={{ color: tierColor, fontSize: "0.65rem" }}>{s.elo} ELO</span>
                      {form && (
                        <div className="flex gap-0.5">
                          {form.slice(0, 5).split("").map((f: string, fi: number) => (
                            <div key={fi} className="w-1.5 h-1.5 rounded-full"
                              style={{ background: f === "W" ? "#22c55e" : f === "L" ? "#ff005c" : "rgba(255,255,255,0.15)" }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-right font-mono text-sm" style={{ color: "#22c55e" }}>{s.seasonWins ?? s.wins}</span>
                  <span className="text-right font-mono text-sm" style={{ color: "#ff005c" }}>{s.seasonLosses ?? s.losses}</span>
                  <div className="text-right">
                    <span className="font-black tabular-nums" style={{ fontSize: isFirst ? "1.4rem" : "1.1rem", color: isFirst ? "#ff005c" : "rgba(255,255,255,0.85)" }}>
                      {s.seasonPoints ?? s.points}
                    </span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Title race strip */}
          {gap !== null && leader && second && (
            <div className="px-6 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              {gap <= 8 ? (
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "1rem" }}>⚡</span>
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest" style={{ color: "#ffd24a", fontSize: "0.55rem", letterSpacing: "0.12em" }}>TITLE RACE</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                      <span style={{ color: "#ffd24a", fontWeight: 700 }}>{leader.playerName}</span> leads by <span style={{ color: "#ffd24a", fontWeight: 700 }}>{gap}pts</span> — it's tight
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "1rem" }}>👑</span>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <span style={{ color: "#fff", fontWeight: 700 }}>{leader.playerName}</span> leads by <span style={{ color: "#ff005c", fontWeight: 700 }}>{gap}pts</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: RECENT MATCHES + FEATURED ── */}
        <div className="flex-1 flex flex-col">

          {/* Featured player */}
          {featured && (
            <div className="px-6 py-4 border-b flex items-center gap-5"
              style={{
                borderColor: "rgba(255,255,255,0.06)",
                background: "linear-gradient(135deg, rgba(255,0,92,0.06) 0%, rgba(255,255,255,0.01) 100%)",
                transition: "all 0.6s ease",
              }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-2xl"
                style={{
                  background: `linear-gradient(135deg, ${TIER_COLORS[featured.tier] ?? "#94a3b8"}22, ${TIER_COLORS[featured.tier] ?? "#94a3b8"}08)`,
                  border: `1px solid ${TIER_COLORS[featured.tier] ?? "#94a3b8"}35`,
                  color: TIER_COLORS[featured.tier] ?? "#94a3b8",
                }}>
                {TIER_ICONS[featured.tier] ?? "🎯"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black uppercase tracking-widest mb-0.5"
                  style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.55rem", letterSpacing: "0.15em" }}>
                  FEATURED PLAYER
                </div>
                <div className="font-black uppercase text-white leading-none" style={{ fontSize: "clamp(1.4rem, 2.5vw, 2rem)", letterSpacing: "0.06em" }}>
                  {featured.playerName}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{ background: `${TIER_COLORS[featured.tier]}18`, border: `1px solid ${TIER_COLORS[featured.tier]}35`, color: TIER_COLORS[featured.tier], fontSize: "0.6rem", fontFamily: "Oswald, sans-serif" }}>
                    {featured.tier}
                  </span>
                  <span className="text-xs font-mono" style={{ color: TIER_COLORS[featured.tier], fontSize: "0.7rem" }}>{featured.elo} ELO</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{featured.winStreak > 1 ? `🔥 ${featured.winStreak} win streak` : ""}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 shrink-0">
                {[
                  { label: "Season W", value: featured.seasonWins ?? featured.wins, color: "#22c55e" },
                  { label: "Season L", value: featured.seasonLosses ?? featured.losses, color: "#ff005c" },
                  { label: "Pts", value: featured.seasonPoints ?? featured.points, color: "#ffd24a" },
                ].map(stat => (
                  <div key={stat.label} className="text-center">
                    <div className="font-black tabular-nums text-2xl leading-none" style={{ color: stat.color }}>{stat.value}</div>
                    <div className="text-xs uppercase tracking-wide mt-0.5" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.5rem" }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              {/* Pagination dots */}
              <div className="flex flex-col gap-1 shrink-0 ml-2">
                {standings.slice(0, 5).map((_, idx) => (
                  <div key={idx} className="w-1 rounded-full transition-all duration-300"
                    style={{ height: idx === featuredIdx ? 16 : 6, background: idx === featuredIdx ? "#ff005c" : "rgba(255,255,255,0.15)" }} />
                ))}
              </div>
            </div>
          )}

          {/* Recent matches header */}
          <div className="px-6 py-2.5 border-b flex items-center justify-between"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
            <span className="font-black uppercase tracking-widest text-xs" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em" }}>
              RECENT RESULTS
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Auto-refreshes every 30s</span>
          </div>

          {/* Match list */}
          <div className="flex-1 overflow-hidden">
            {recentMatches.slice(0, 7).map((m, i) => (
              <div key={m.id} className="flex items-center px-6 py-3 border-b"
                style={{ borderColor: "rgba(255,255,255,0.04)", background: i === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                {i === 0 && <div className="w-1.5 h-1.5 rounded-full mr-3 shrink-0 animate-pulse" style={{ background: "#22c55e" }} />}
                {i > 0 && <div className="w-1.5 h-1.5 rounded-full mr-3 shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="font-black uppercase text-sm" style={{ color: "#22c55e", letterSpacing: "0.05em" }}>
                    {m.winnerName}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded font-black uppercase"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.25)", fontSize: "0.55rem", letterSpacing: "0.08em", flexShrink: 0 }}>
                    def.
                  </span>
                  <span className="font-bold uppercase text-sm truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {m.loserName}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {m.stake > 0 && (
                    <span className="font-black text-xs" style={{ color: "#ffd24a" }}>±{m.stake}pts</span>
                  )}
                  <span className="font-mono text-xs" style={{ color: "#0066ff" }}>
                    {m.eloChange > 0 ? `+${m.eloChange}` : m.eloChange} ELO
                  </span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {format(new Date(m.playedAt), "HH:mm")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TICKER ── */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center overflow-hidden border-t"
        style={{ height: 40, borderColor: "rgba(255,0,92,0.25)", background: "rgba(255,0,92,0.06)", backdropFilter: "blur(8px)" }}>
        <div className="shrink-0 px-4 font-black uppercase tracking-widest text-xs border-r h-full flex items-center"
          style={{ color: "#ff005c", borderColor: "rgba(255,0,92,0.3)", letterSpacing: "0.2em", background: "rgba(255,0,92,0.12)", fontSize: "0.6rem" }}>
          RESULTS
        </div>
        {tickerItems.length > 0 && (
          <div className="flex-1 overflow-hidden relative" ref={tickerRef}>
            <div
              className="flex items-center gap-8 whitespace-nowrap text-xs font-bold"
              style={{
                color: "rgba(255,255,255,0.6)",
                animation: "ticker 30s linear infinite",
                paddingLeft: "100%",
                fontFamily: "Oswald, sans-serif",
                letterSpacing: "0.06em",
              }}>
              {[...tickerItems, ...tickerItems].map((item, i) => (
                <span key={i} className="flex items-center gap-3">
                  <span className="text-red-500 opacity-60">●</span>
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
        <style>{`
          @keyframes ticker {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
        `}</style>
      </div>
    </div>
  );
}
