import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Target, LogOut, Lock, User, TrendingUp, TrendingDown,
  Zap, Trophy, Dumbbell, CircuitBoard, Star, ChevronDown, ChevronRight,
  Award, Flame, CheckCircle, Clock,
} from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  Diamond: "#00e5ff", Platinum: "#e5e4e2", Gold: "#ffd24a", Silver: "#9ca3af", Bronze: "#cd7f32",
};

function EloSparkline({ history }: { history: { elo: number }[] }) {
  if (history.length < 2) return null;
  const elos = history.map(h => h.elo);
  const min  = Math.min(...elos) - 5;
  const max  = Math.max(...elos) + 5;
  const W = 100, H = 28;
  const pts = elos.map((e, i) => ({
    x: (i / (elos.length - 1)) * W,
    y: H - ((e - min) / (max - min || 1)) * H,
  }));
  const d     = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const trend = elos[elos.length - 1] - elos[0];
  const col   = trend >= 0 ? "#00e5a0" : "#ff005c";
  const last  = pts[pts.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <path d={d} stroke={col} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      <circle cx={last.x} cy={last.y} r={2.5} fill={col} />
    </svg>
  );
}

function FormDot({ result }: { result: "W" | "L" }) {
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center"
      style={{
        background: result === "W" ? "rgba(0,229,160,0.15)" : "rgba(255,0,92,0.12)",
        border: `1px solid ${result === "W" ? "rgba(0,229,160,0.4)" : "rgba(255,0,92,0.3)"}`,
      }}>
      <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", fontWeight: 800,
        color: result === "W" ? "#00e5a0" : "#ff005c" }}>{result}</span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, accent = "#ff005c", children, collapsible = false }: {
  title: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent?: string; children: React.ReactNode; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(8,6,18,0.9)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <button
        className="w-full flex items-center gap-2.5 px-5 py-3.5"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.05)" : undefined, cursor: collapsible ? "pointer" : "default" }}
        onClick={() => collapsible && setOpen(v => !v)}
        disabled={!collapsible}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
        <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.35)", textTransform: "uppercase", flex: 1, textAlign: "left" }}>
          {title}
        </span>
        {collapsible && (open
          ? <ChevronDown className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.2)" }} />
          : <ChevronRight className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.2)" }} />
        )}
      </button>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

export default function AccountPage() {
  const { user, logout } = useAuth();
  const [, navigate]     = useLocation();
  const { toast }        = useToast();

  const [curPwd, setCurPwd]      = useState("");
  const [newPwd, setNewPwd]      = useState("");
  const [confirmPwd, setConfirm] = useState("");
  const [pwdLoading, setPwdLoad] = useState(false);

  const [stats,        setStats]        = useState<any>(null);
  const [gamerscore,   setGamerscore]   = useState<any>(null);
  const [practiceStats, setPractice]   = useState<any>(null);
  const [m501,          setM501]        = useState<any>(null);
  const [tourTrophies,  setTrophies]    = useState<any[]>([]);
  const [tourRuns,      setTourRuns]    = useState<any[]>([]);
  const [shadowStats,   setShadow]      = useState<any>(null);
  const [achProgress,   setAchProgress] = useState<any[]>([]);
  const [eloHistory,    setEloHistory]  = useState<any[]>([]);

  useEffect(() => {
    if (!user?.playerId) return;
    const id = user.playerId;
    void Promise.all([
      fetch(`/api/players/${id}/stats`).then(r => r.ok ? r.json() : null).then(setStats),
      fetch(`/api/players/${id}/gamerscore`).then(r => r.ok ? r.json() : null).then(setGamerscore),
      fetch(`/api/players/${id}/practice-stats`).then(r => r.ok ? r.json() : null).then(setPractice),
      fetch(`/api/master501/progress/${id}`).then(r => r.ok ? r.json() : null).then(setM501),
      fetch(`/api/tour/trophies/${id}`).then(r => r.ok ? r.json() : []).then(setTrophies),
      fetch(`/api/tour/runs/${id}`).then(r => r.ok ? r.json() : []).then(setTourRuns),
      fetch(`/api/players/${id}/shadow-bot-stats`).then(r => r.ok ? r.json() : null).then(setShadow),
      fetch(`/api/players/${id}/achievement-progress`).then(r => r.ok ? r.json() : []).then(setAchProgress),
      fetch(`/api/players/${id}/elo-history`).then(r => r.ok ? r.json() : {}).then((d: any) => setEloHistory(d.history ?? [])),
    ]);
  }, [user?.playerId]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (newPwd.length < 6)     { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    setPwdLoad(true);
    try {
      const res  = await fetch("/api/auth/password", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Password updated ✓", description: "Your new password is active." });
        setCurPwd(""); setNewPwd(""); setConfirm("");
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    setPwdLoad(false);
  };

  const player     = stats?.player as any;
  const tier       = player?.tier ?? "Bronze";
  const tCol       = TIER_COLORS[tier] ?? "#aaa";
  const games      = (player?.seasonWins ?? 0) + (player?.seasonLosses ?? 0);
  const winRate    = games > 0 ? Math.round((player?.seasonWins ?? 0) / games * 100) : null;

  const recentForm: ("W" | "L")[] = useMemo(() => {
    if (!stats?.recentMatches || !user?.playerId) return [];
    return (stats.recentMatches as any[]).slice(0, 8).map((m: any) => {
      const wid = m.winnerId ?? m.winner_id;
      return wid === user.playerId ? "W" : "L";
    });
  }, [stats, user]);

  const eloTrend = useMemo(() => {
    if (eloHistory.length < 2) return 0;
    const last = eloHistory[eloHistory.length - 1]?.elo ?? 0;
    const first = eloHistory[0]?.elo ?? 0;
    return last - first;
  }, [eloHistory]);

  const unlockedAchievements = useMemo(() =>
    (stats?.achievements ?? []).slice(0, 4).map((a: any) => ({
      ...(a.achievement ?? a),
      unlockedAt: a.unlockedAt,
    })) as any[], [stats]);

  const nearMissAchievements = useMemo(() =>
    (achProgress as any[])
      .filter(a => !a.isUnlocked && a.currentProgress != null && a.criteriaValue != null && a.currentProgress > 0 && a.currentProgress < a.criteriaValue && a.currentProgress / a.criteriaValue >= 0.45)
      .sort((a: any, b: any) => (b.currentProgress / b.criteriaValue) - (a.currentProgress / a.criteriaValue))
      .slice(0, 6),
  [achProgress]);

  const m501Achievements = useMemo(() =>
    (achProgress as any[])
      .filter(a => (a.key ?? "").startsWith("M501_"))
      .sort((a: any, b: any) => {
        if (a.isUnlocked !== b.isUnlocked) return a.isUnlocked ? -1 : 1;
        const ap = a.currentProgress ?? 0, av = a.criteriaValue ?? 1;
        const bp = b.currentProgress ?? 0, bv = b.criteriaValue ?? 1;
        return (bp / bv) - (ap / av);
      }),
  [achProgress]);

  const achTotals = useMemo(() => ({
    total:    (achProgress as any[]).length,
    unlocked: (achProgress as any[]).filter(a => a.isUnlocked).length,
  }), [achProgress]);

  const activeRuns = useMemo(() => (tourRuns as any[]).filter(r => r.status === "active"), [tourRuns]);

  const insights = useMemo(() => {
    const strengths: string[] = [];
    const focuses:   string[] = [];

    if (winRate !== null && games >= 3) {
      if (winRate >= 65) strengths.push(`${winRate}% win rate this season`);
      else if (winRate < 40) focuses.push(`Win rate at ${winRate}% — pick your spots carefully`);
    }
    if (eloTrend > 25)  strengths.push(`Elo up ${eloTrend} across your last ${eloHistory.length} matches`);
    if (eloTrend < -25) focuses.push(`Elo down ${Math.abs(eloTrend)} — watch the wager sizes`);

    const ws = player?.currentWinStreak ?? player?.win_streak ?? 0;
    const ls = player?.currentLossStreak ?? player?.loss_streak ?? 0;
    if (ws >= 3) strengths.push(`${ws}-match winning streak 🔥`);
    if (ls >= 3) focuses.push(`${ls} straight losses — reset, regroup, recalibrate`);

    const total = practiceStats?.total_sessions ?? 0;
    if (total === 0) focuses.push("No practice sessions yet — solo time sharpens your game");
    else if (total >= 10) strengths.push(`${total} practice sessions — real dedication`);

    if (shadowStats?.locked) {
      const rem = (shadowStats.dartsNeeded ?? 250) - (shadowStats.totalDarts ?? 0);
      if (rem > 0) focuses.push(`${rem} more practice darts to unlock your Shadow Bot`);
    } else if (shadowStats && (shadowStats.matchWinRate ?? 0) >= 60) {
      strengths.push(`${shadowStats.matchWinRate}% win rate vs the Shadow Bot`);
    }

    if ((m501?.currentTier ?? 1) > 1) strengths.push(`Master 501 ${m501.config?.name} tier reached`);

    if (tourTrophies.length > 0) strengths.push(`${tourTrophies.length} tour ${tourTrophies.length === 1 ? "trophy" : "trophies"} in the cabinet`);

    if (nearMissAchievements.length > 0) {
      const a = nearMissAchievements[0];
      focuses.push(`Close to "${a.name}" — ${a.currentProgress}/${a.criteriaValue}`);
    }

    if (tier === "Diamond") strengths.push("Diamond tier — top of the food chain");
    else if (tier === "Platinum") strengths.push("Platinum tier — one big run from Diamond");

    if ((player?.points ?? 0) >= 60) strengths.push(`${player.points} pts on the board — dominant season`);
    else if ((player?.points ?? 0) === 0 && games >= 3) focuses.push("Points eliminated — no bankroll to lose, maximum aggression mode");

    return { strengths, focuses };
  }, [player, games, winRate, eloTrend, eloHistory, practiceStats, shadowStats, m501, tourTrophies, nearMissAchievements, tier]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-5">
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.2rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>
          You're not signed in
        </div>
        <button onClick={() => navigate("/login")}
          className="px-6 py-3 rounded-xl flex items-center gap-2 font-bold"
          style={{ background: "linear-gradient(135deg, #ff005c, rgba(255,0,92,0.7))", color: "#fff",
            fontFamily: "Oswald, sans-serif", letterSpacing: "0.15em", fontSize: "0.85rem", border: "none" }}>
          Sign In
        </button>
      </div>
    );
  }

  const gsTotal  = gamerscore?.total ?? 0;
  const gsLeague = gamerscore?.league ?? 0;
  const gsBot    = gamerscore?.shadowBot ?? 0;
  const gsTour   = (gamerscore?.tourTrophies ?? 0) + (gamerscore?.tourAchievements ?? 0);
  const gsM501   = gamerscore?.master501 ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="rounded-2xl relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${tCol}1e 0%, rgba(8,6,20,0.98) 55%)`, border: `1px solid ${tCol}35`, boxShadow: `0 0 60px ${tCol}14` }}>
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${tCol} 0%, ${tCol}55 40%, transparent 100%)` }} />

        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 relative"
              style={{ background: `linear-gradient(135deg, ${tCol}28, ${tCol}0a)`, border: `1px solid ${tCol}55` }}>
              <div className="absolute inset-0 rounded-2xl" style={{ background: `${tCol}1c`, filter: "blur(10px)" }} />
              <Target className="w-8 h-8 relative z-10" style={{ color: tCol, filter: `drop-shadow(0 0 10px ${tCol})` }} />
            </div>

            <div className="flex-1 min-w-0">
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "2rem", fontWeight: 900,
                color: "#fff", letterSpacing: "0.04em", lineHeight: 1, textShadow: "0 2px 20px rgba(0,0,0,0.9)" }} className="truncate">
                {user.playerName}
              </div>
              {player?.tagline && (
                <div className="mt-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.68rem",
                  color: tCol, letterSpacing: "0.08em", fontStyle: "italic", opacity: 0.9 }}>
                  "{player.tagline}"
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="px-2 py-0.5 rounded-md" style={{ background: `${tCol}22`, fontFamily: "Oswald, sans-serif",
                  fontSize: "0.58rem", color: tCol, letterSpacing: "0.14em", fontWeight: 800, border: `1px solid ${tCol}44` }}>
                  {tier}
                </span>
                <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>
                  ELO {player?.elo ?? "–"}
                </span>
                {player?.seasonWins !== undefined && (
                  <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>
                    {player.seasonWins}W–{player.seasonLosses}L
                  </span>
                )}
                {user.isAdmin && (
                  <span className="flex items-center gap-0.5">
                    <Shield className="w-3 h-3" style={{ color: "#ffd24a" }} />
                    <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "#ffd24a", letterSpacing: "0.1em" }}>ADMIN</span>
                  </span>
                )}
              </div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.48rem", color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em", marginTop: "0.25rem" }}>
                @{user.username}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "3rem", fontWeight: 900,
                color: "#ff005c", lineHeight: 0.85, textShadow: "0 0 28px rgba(255,0,92,0.9)" }}>
                {player?.points ?? "–"}
              </div>
              <div style={{ fontSize: "0.44rem", color: "rgba(255,255,255,0.18)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.2em", marginTop: "2px" }}>PTS</div>
              {(player?.currentWinStreak ?? player?.win_streak ?? 0) >= 3 && (
                <div className="mt-1.5 flex items-center justify-end gap-1">
                  <Flame className="w-3.5 h-3.5" style={{ color: "#ff8c00", filter: "drop-shadow(0 0 5px #ff8c00)" }} />
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", color: "#ff8c00", fontWeight: 900, letterSpacing: "0.06em" }}>
                    {player?.currentWinStreak ?? player?.win_streak} STREAK
                  </span>
                </div>
              )}
              {(player?.currentLossStreak ?? player?.loss_streak ?? 0) >= 3 && (
                <div className="mt-1.5 text-right">
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "rgba(255,0,92,0.7)", fontWeight: 700, letterSpacing: "0.08em" }}>
                    {player?.currentLossStreak ?? player?.loss_streak}L RUN
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* View Profile + Sign Out */}
          <div className="flex items-center gap-2 mt-4">
            <Link href={`/players/${user.playerId}`}
              className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.45)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", fontSize: "0.7rem" }}>
              <User className="w-3 h-3" />
              Full Profile
            </Link>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl transition-opacity hover:opacity-70"
              style={{ background: "rgba(255,0,92,0.07)", border: "1px solid rgba(255,0,92,0.18)",
                color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", fontSize: "0.7rem" }}>
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* ── Quick Actions strip ──────────────────────────────── */}
        {(() => {
          const actions = [
            { href: "/practice",                    icon: Dumbbell,     label: "Practice", col: "#4d94ff" },
            { href: `/shadow-bot/${user.playerId}`, icon: CircuitBoard, label: "My Bot",   col: "#00e5a0" },
            { href: "/master501",                   icon: Target,       label: "M·501",    col: "#00e5a0" },
            { href: "/tour",                        icon: Star,         label: "Tour",     col: "#a855f7" },
            ...(user.isAdmin ? [{ href: "/admin",   icon: Shield,       label: "Admin",    col: "#ffd24a" }] : []),
          ];
          return (
            <div className={`grid gap-2 px-4 pb-4`} style={{ gridTemplateColumns: `repeat(${actions.length}, 1fr)` }}>
              {actions.map(({ href, icon: Icon, label, col }) => (
                <Link key={href} href={href}
                  className="rounded-xl py-3 flex flex-col items-center gap-1.5 transition-all hover:opacity-85 active:scale-95"
                  style={{ background: `${col}10`, border: `1px solid ${col}28` }}>
                  <Icon className="w-4 h-4" style={{ color: col }} />
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.12em",
                    color: col, textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
                </Link>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── Gamerscore ─────────────────────────────────────────── */}
      <div className="rounded-2xl p-4"
        style={{ background: "rgba(8,6,18,0.9)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-3">
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>
            Gamerscore
          </div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "2rem", fontWeight: 900, color: "#ffd24a", lineHeight: 1, textShadow: "0 0 12px rgba(255,210,74,0.5)" }}>
            {gsTotal.toLocaleString()}<span style={{ fontSize: "0.8rem", color: "rgba(255,210,74,0.5)", marginLeft: "2px" }}>G</span>
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { label: "League",     val: gsLeague, col: "#ff005c" },
            { label: "Shadow Bot", val: gsBot,    col: "#00e5a0" },
            { label: "Tour",       val: gsTour,   col: "#a855f7" },
            { label: "M·501",      val: gsM501,   col: "#00c8a0" },
          ].map(({ label, val, col }) => (
            <div key={label} className="flex-1 rounded-xl p-2.5 text-center"
              style={{ background: `${col}0c`, border: `1px solid ${col}22` }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 800, color: col, lineHeight: 1 }}>
                {val}G
              </div>
              <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", marginTop: "2px" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Coach ─────────────────────────────────────────────── */}
      {(insights.strengths.length > 0 || insights.focuses.length > 0) && (
        <SectionCard title="Coach's Corner" icon={Zap} accent="#ffd24a">
          <div className="grid grid-cols-2 gap-3">
            {insights.strengths.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3 h-3" style={{ color: "#00e5a0" }} />
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.18em", color: "#00e5a0", textTransform: "uppercase" }}>
                    Strengths
                  </span>
                </div>
                <div className="space-y-1.5">
                  {insights.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: "#00e5a0" }} />
                      <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {insights.focuses.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="w-3 h-3" style={{ color: "#f59e0b" }} />
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.18em", color: "#f59e0b", textTransform: "uppercase" }}>
                    Focus On
                  </span>
                </div>
                <div className="space-y-1.5">
                  {insights.focuses.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <Flame className="w-3 h-3 shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                      <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── League / Season ──────────────────────────────────── */}
      <SectionCard title="This Season" icon={Trophy} accent="#ffd24a">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Points", val: player?.points ?? "–", big: true },
            { label: "Wins",   val: player?.seasonWins ?? "–" },
            { label: "Losses", val: player?.seasonLosses ?? "–" },
          ].map(({ label, val, big }) => (
            <div key={label} className="rounded-xl p-3 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: big ? "1.8rem" : "1.5rem", fontWeight: 900,
                color: big ? "#ff005c" : "#fff", lineHeight: 1, textShadow: big ? "0 0 12px rgba(255,0,92,0.5)" : undefined }}>
                {val}
              </div>
              <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif",
                letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "3px" }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Win rate + form row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
              Recent Form
            </div>
            <div className="flex items-center gap-1">
              {recentForm.length > 0
                ? recentForm.map((r, i) => <FormDot key={i} result={r} />)
                : <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.2)" }}>No matches yet</span>}
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
              Elo Trend
            </div>
            <div className="flex items-center gap-2">
              {eloHistory.length >= 2 && (
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700,
                  color: eloTrend >= 0 ? "#00e5a0" : "#ff005c" }}>
                  {eloTrend >= 0 ? "+" : ""}{eloTrend}
                </span>
              )}
              <EloSparkline history={eloHistory.slice(-12)} />
            </div>
          </div>
        </div>

        {winRate !== null && games >= 3 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>Win Rate</span>
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", fontWeight: 700,
                color: winRate >= 50 ? "#00e5a0" : "#f59e0b" }}>{winRate}%</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${winRate}%`, borderRadius: 2, transition: "width 0.8s ease",
                background: winRate >= 65 ? "#00e5a0" : winRate >= 45 ? "#ffd24a" : "#ff005c" }} />
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Master 501 ───────────────────────────────────────── */}
      <SectionCard title="Master 501" icon={Target} accent="#00e5a0">
        {m501 ? (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${m501.config?.color ?? "#94a3b8"}18`, border: `1px solid ${m501.config?.color ?? "#94a3b8"}33` }}>
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.4rem", fontWeight: 900, color: m501.config?.color ?? "#94a3b8" }}>
                T{m501.currentTier}
              </span>
            </div>
            <div className="flex-1">
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 800, color: "#fff", letterSpacing: "0.04em" }}>
                {m501.config?.name ?? "Challenger"}
              </div>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
                Round {m501.currentRound} · {m501.config?.label ?? "Best of 5"}
              </div>
              {m501.history && m501.history.length > 0 && (
                <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.25)", marginTop: "3px" }}>
                  {m501.history.length} run{m501.history.length !== 1 ? "s" : ""} completed
                </div>
              )}
            </div>
            <Link href="/master501"
              className="px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)",
                color: "#00e5a0", fontFamily: "Oswald, sans-serif", fontSize: "0.62rem", letterSpacing: "0.1em" }}>
              Play
            </Link>
          </div>
        ) : (
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Loading…</div>
        )}
      </SectionCard>

      {/* ── Master 501 Achievements ──────────────────────────── */}
      {m501Achievements.length > 0 && (
        <SectionCard title="Master 501 Achievements" icon={Target} accent="#00e5a0">
          <div className="space-y-1.5 mb-3">
            {m501Achievements.slice(0, 8).map((a: any) => (
              <div key={a.key}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                style={{ background: a.isUnlocked ? "rgba(0,229,160,0.07)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${a.isUnlocked ? "rgba(0,229,160,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                <span style={{ fontSize: "1rem", filter: a.isUnlocked ? "none" : "grayscale(1) opacity(0.35)" }}>{a.icon ?? "🎯"}</span>
                <div className="flex-1 min-w-0">
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", letterSpacing: "0.04em",
                    color: a.isUnlocked ? "#fff" : "rgba(255,255,255,0.38)" }}>
                    {a.name}
                  </div>
                  {!a.isUnlocked && (a.currentProgress ?? 0) > 0 && a.criteriaValue != null && (
                    <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginTop: "4px" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: "#00e5a0", opacity: 0.65,
                        width: `${Math.min(100, Math.round(((a.currentProgress ?? 0) / a.criteriaValue) * 100))}%`,
                        transition: "width 0.8s ease" }} />
                    </div>
                  )}
                </div>
                {a.isUnlocked ? (
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", color: "#00e5a0", fontWeight: 700, flexShrink: 0 }}>{a.gamerscore ?? 0}G</span>
                ) : (a.currentProgress ?? 0) > 0 && a.criteriaValue != null ? (
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", color: "rgba(255,255,255,0.22)", fontWeight: 700, flexShrink: 0 }}>
                    {a.currentProgress}/{a.criteriaValue}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          {m501Achievements.length > 8 && (
            <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.18)", fontFamily: "Oswald, sans-serif", marginBottom: "0.75rem" }}>
              +{m501Achievements.length - 8} more in the challenge tree
            </p>
          )}
          <Link href="/master501"
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl transition-opacity hover:opacity-75"
            style={{ background: "rgba(0,229,160,0.06)", border: "1px solid rgba(0,229,160,0.18)",
              color: "#00e5a0", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", letterSpacing: "0.12em" }}>
            <Target className="w-3.5 h-3.5" />
            Play Master 501
          </Link>
        </SectionCard>
      )}

      {/* ── Tour ─────────────────────────────────────────────── */}
      <SectionCard title="Tour Mode" icon={Star} accent="#a855f7">
        {tourTrophies.length > 0 || activeRuns.length > 0 ? (
          <div className="space-y-3">
            {tourTrophies.length > 0 && (
              <div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.15em",
                  color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Trophy Cabinet · {tourTrophies.length}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tourTrophies.slice(0, 6).map((t: any) => (
                    <div key={t.id} className="px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
                      style={{ background: "rgba(255,210,74,0.07)", border: "1px solid rgba(255,210,74,0.18)" }}>
                      <Trophy className="w-3 h-3" style={{ color: "#ffd24a" }} />
                      <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.6)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
                        {t.tourName ?? t.tour_name ?? "Tour Win"}
                      </span>
                    </div>
                  ))}
                  {tourTrophies.length > 6 && (
                    <div className="px-2.5 py-1.5 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)" }}>+{tourTrophies.length - 6} more</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeRuns.length > 0 && (
              <div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.15em",
                  color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Active Runs · {activeRuns.length}
                </div>
                {activeRuns.slice(0, 2).map((r: any) => (
                  <Link key={r.id} href={`/tour/${r.id}`}
                    className="flex items-center justify-between px-3 py-2 rounded-xl transition-opacity hover:opacity-80 mb-1.5 block"
                    style={{ background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)" }}>
                    <div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.75rem", color: "#fff", letterSpacing: "0.04em" }}>
                        {r.tourName ?? r.tour_name ?? "Tour Run"}
                      </div>
                      <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>
                        {r.difficulty} · In progress
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4" style={{ color: "#a855f7" }} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
              No trophies yet — enter a tour to start your career
            </span>
            <Link href="/tour"
              className="px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70 shrink-0"
              style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)",
                color: "#a855f7", fontFamily: "Oswald, sans-serif", fontSize: "0.62rem", letterSpacing: "0.1em" }}>
              Browse Tours
            </Link>
          </div>
        )}
      </SectionCard>

      {/* ── Shadow Bot ───────────────────────────────────────── */}
      <SectionCard title="Shadow Bot" icon={CircuitBoard} accent="#00e5a0">
        {shadowStats ? (
          shadowStats.locked ? (
            <div>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", marginBottom: "0.75rem" }}>
                Log <strong style={{ color: "#00e5a0" }}>{(shadowStats.dartsNeeded ?? 250) - (shadowStats.totalDarts ?? 0)}</strong> more practice darts to unlock your digital clone
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
                  Practice Darts
                </span>
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", color: "#00e5a0" }}>
                  {shadowStats.totalDarts ?? 0} / {shadowStats.dartsNeeded ?? 250}
                </span>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, transition: "width 0.8s ease", background: "linear-gradient(90deg, #00e5a0, #00c885)",
                  width: `${Math.min(100, ((shadowStats.totalDarts ?? 0) / (shadowStats.dartsNeeded ?? 250)) * 100)}%` }} />
              </div>
              <Link href="/practice"
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl transition-opacity hover:opacity-75"
                style={{ background: "rgba(0,229,160,0.07)", border: "1px solid rgba(0,229,160,0.2)",
                  color: "#00e5a0", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", letterSpacing: "0.12em" }}>
                <Dumbbell className="w-3.5 h-3.5" />
                Practise Now to Unlock
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Matches",  val: shadowStats.totalMatches ?? 0 },
                  { label: "Win Rate", val: `${shadowStats.matchWinRate ?? 0}%` },
                  { label: "Level",    val: shadowStats.accuracyLevel ?? shadowStats.nextLevel ?? "–" },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-xl p-2.5 text-center"
                    style={{ background: "rgba(0,229,160,0.05)", border: "1px solid rgba(0,229,160,0.12)" }}>
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 800, color: "#00e5a0", lineHeight: 1 }}>
                      {val}
                    </div>
                    <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif",
                      letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "3px" }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
              <Link href={`/shadow-bot/${user.playerId}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "linear-gradient(135deg, rgba(0,229,160,0.16), rgba(0,229,160,0.07))",
                  border: "1px solid rgba(0,229,160,0.35)", color: "#00e5a0",
                  fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", letterSpacing: "0.14em", fontWeight: 800 }}>
                <CircuitBoard className="w-3.5 h-3.5" />
                CHALLENGE YOUR CLONE ⚔️
              </Link>
            </div>
          )
        ) : (
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)" }}>Loading…</div>
        )}
      </SectionCard>

      {/* ── Practice ─────────────────────────────────────────── */}
      <SectionCard title="Practice" icon={Dumbbell} accent="#0066ff">
        {practiceStats ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-3 gap-2">
              {[
                { label: "Sessions",  val: practiceStats.total_sessions ?? 0 },
                { label: "180s",      val: practiceStats.total_180s ?? 0 },
                { label: "Best Avg",  val: practiceStats.best_session_avg ? Number(practiceStats.best_session_avg).toFixed(1) : "–" },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-xl p-2.5 text-center"
                  style={{ background: "rgba(0,102,255,0.06)", border: "1px solid rgba(0,102,255,0.14)" }}>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 800, color: "#4d94ff", lineHeight: 1 }}>
                    {val}
                  </div>
                  <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif",
                    letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "3px" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
            {practiceStats.avg_three_dart && (
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>Avg 3-Dart Score</span>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#4d94ff" }}>
                    {Number(practiceStats.avg_three_dart).toFixed(1)}
                  </span>
                </div>
              </div>
            )}
            <div className="col-span-2">
              <Link href="/practice"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "linear-gradient(135deg, rgba(77,148,255,0.14), rgba(77,148,255,0.07))",
                  border: "1px solid rgba(77,148,255,0.3)", color: "#4d94ff",
                  fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", letterSpacing: "0.14em", fontWeight: 800 }}>
                <Dumbbell className="w-3.5 h-3.5" />
                {practiceStats.total_sessions === 0 ? "START PRACTISING" : "PRACTICE NOW"} →
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)" }}>Loading…</div>
        )}
      </SectionCard>

      {/* ── Achievements ─────────────────────────────────────── */}
      <SectionCard title="Achievements" icon={Award} accent="#a855f7">
        <div className="space-y-4">
          {achTotals.total > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.15em", color: "rgba(255,255,255,0.18)", textTransform: "uppercase" }}>Total Progress</span>
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", fontWeight: 900,
                  color: achTotals.unlocked === achTotals.total && achTotals.total > 0 ? "#ffd24a" : "#a855f7" }}>
                  {achTotals.unlocked} / {achTotals.total}
                </span>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, transition: "width 0.8s ease",
                  background: "linear-gradient(90deg, #a855f7, rgba(168,85,247,0.4))",
                  width: `${Math.round((achTotals.unlocked / achTotals.total) * 100)}%` }} />
              </div>
            </div>
          )}

          {unlockedAchievements.length > 0 && (
            <div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.15em",
                color: "rgba(255,255,255,0.18)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                Recently Unlocked
              </div>
              <div className="space-y-1.5">
                {unlockedAchievements.slice(0, 5).map((a: any) => (
                  <div key={a.key ?? a.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                    style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.14)" }}>
                    <span style={{ fontSize: "1rem" }}>{a.icon ?? "🏆"}</span>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", color: "#fff", letterSpacing: "0.04em" }}>{a.name}</div>
                      <div style={{ fontSize: "0.56rem", color: "rgba(255,255,255,0.28)", marginTop: "1px" }} className="truncate">{a.description}</div>
                    </div>
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.62rem", color: "#ffd24a", fontWeight: 700, flexShrink: 0 }}>
                      {a.gamerscore ?? a.points ?? 0}G
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nearMissAchievements.length > 0 && (
            <div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.15em",
                color: "rgba(255,255,255,0.18)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                In Progress
              </div>
              <div className="space-y-2">
                {nearMissAchievements.map((a: any) => {
                  const pct = Math.round((a.currentProgress / a.criteriaValue) * 100);
                  return (
                    <div key={a.key ?? a.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.55)" }}>{a.icon ?? "🎯"} {a.name}</span>
                        <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: "#f59e0b", fontWeight: 700 }}>
                          {a.currentProgress}/{a.criteriaValue}
                        </span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, transition: "width 0.8s ease",
                          background: pct >= 80 ? "linear-gradient(90deg, #22c55e, rgba(34,197,94,0.5))" : "linear-gradient(90deg, #f59e0b, rgba(245,158,11,0.45))" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {unlockedAchievements.length === 0 && nearMissAchievements.length === 0 && (
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
              No achievements yet — play some matches to get started
            </div>
          )}

          <div className="pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <Link href="/achievements"
              className="flex items-center gap-1.5 transition-opacity hover:opacity-70 pt-2"
              style={{ color: "rgba(168,85,247,0.6)", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", letterSpacing: "0.1em" }}>
              View all{achTotals.total > 0 ? ` ${achTotals.total}` : ""} achievements
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </SectionCard>

      {/* ── Admin Panel ───────────────────────────────────────── */}
      {user.isAdmin && (
        <SectionCard title="Admin Panel" icon={Shield} accent="#ffd24a">
          <div className="space-y-3">
            <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}>
              Season management, player accounts, game types, achievement sweeps, Elo overrides, and more.
            </p>
            <Link href="/admin"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-opacity hover:opacity-80"
              style={{ background: "linear-gradient(135deg, rgba(255,210,74,0.18), rgba(255,210,74,0.07))",
                border: "1px solid rgba(255,210,74,0.35)", color: "#ffd24a",
                fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", letterSpacing: "0.14em", fontWeight: 800 }}>
              <Shield className="w-3.5 h-3.5" />
              OPEN ADMIN PANEL ⚡
            </Link>
          </div>
        </SectionCard>
      )}

      {/* ── Change Password ──────────────────────────────────── */}
      <SectionCard title="Change Password" icon={Lock} accent="rgba(255,255,255,0.2)" collapsible>
        <form onSubmit={handleChangePassword} className="space-y-3">
          {[
            { label: "Current password",  val: curPwd,     set: setCurPwd,    id: "cur",  auto: "current-password" },
            { label: "New password",       val: newPwd,     set: setNewPwd,    id: "new",  auto: "new-password" },
            { label: "Confirm new",        val: confirmPwd, set: setConfirm,   id: "conf", auto: "new-password" },
          ].map(({ label, val, set, id, auto }) => (
            <div key={id}>
              <label className="block mb-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.54rem",
                letterSpacing: "0.14em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>
                {label}
              </label>
              <input type="password" autoComplete={auto} value={val} onChange={e => set(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "#fff", fontFamily: "inherit" }}
                onFocus={e => (e.target.style.borderColor = "rgba(255,0,92,0.4)")}
                onBlur={e =>  (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                required />
            </div>
          ))}
          <button type="submit" disabled={pwdLoading}
            className="w-full py-2.5 rounded-xl font-bold transition-opacity disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em", fontSize: "0.78rem" }}>
            {pwdLoading ? "Saving…" : "Update Password"}
          </button>
        </form>
      </SectionCard>

    </div>
  );
}
