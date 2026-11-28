import { Glow, DartboardBackdrop, Chapter, PmCard, Ring } from "@/components/premium/Premium";
import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { TraitChips, type ShadowTrait } from "@/components/BotPickers";
import { ArrowLeft, CircuitBoard, Lock, Dumbbell, Target, Zap, Trophy, ChevronRight, Ghost, TrendingUp, TrendingDown, Minus } from "lucide-react";

type GameModeRow = { gameTypeKey: string; gameTypeName: string; sessions: number; darts: number };

type TimelinePoint = { weekLabel: string; avg: number | null; darts: number };
type RivalryRow = { playerId: number; playerName: string; wins: number; losses: number; lastPlayed: string };

type ShadowBotStats = {
  playerName: string;
  locked: boolean;
  totalDarts: number;
  dartsNeeded: number;
  totalSessions: number;
  computedAvg?: number;
  doubleHitPct?: number;
  primarySeg?: number;
  checkoutSegs?: number[];
  accuracyLevel: string | null;
  nextLevel: string | null;
  progressToNext: number;
  gameModeSessions: GameModeRow[];
  thinSpots: GameModeRow[];
  practiceDarts?: number;
  matchDarts?: number;
  totalMatches?: number;
  matchWins?: number;
  matchWinRate?: number | null;
  total180s?: number;
  playerElo?: number;
};

type MatchRow = {
  id: number;
  playerId: number;
  playerName: string;
  winnerIdx: number | null;
  playerWon: boolean;
  p1Darts: number | null;
  p1Avg: number | null;
  p1CheckoutHits: number | null;
  p1_180s: number | null;
  gameTypeKey: string;
  gameTypeName: string;
  detail: string | null;
  createdAt: string;
};

const LEVEL_COLOR: Record<string, string> = {
  beginner: "#94a3b8",
  amateur:  "#22c55e",
  club:     "#3b82f6",
  county:   "#a78bfa",
  pro:      "#ffd24a",
  elite:    "#ff005c",
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner",
  amateur:  "Amateur",
  club:     "Club Player",
  county:   "County",
  pro:      "Pro Tour",
  elite:    "Elite",
};

const LEVEL_STEPS = [
  { key: "beginner", label: "Beginner", threshold: "0",    color: "#94a3b8" },
  { key: "amateur",  label: "Amateur",  threshold: "45+",  color: "#22c55e" },
  { key: "club",     label: "Club",     threshold: "62+",  color: "#3b82f6" },
  { key: "county",   label: "County",   threshold: "80+",  color: "#a78bfa" },
  { key: "pro",      label: "Pro Tour", threshold: "95+",  color: "#ffd24a" },
  { key: "elite",    label: "Elite",    threshold: "108+", color: "#ff005c" },
];

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  beginner: "Still finding its range. Feeds on every dart you log.",
  amateur:  "Developing patterns emerge. Dangerous on a good day.",
  club:     "Consistent scoring. Knows its favourite numbers.",
  county:   "High-level form. Checkout game coming together.",
  pro:      "Tour-level threat. Precision scoring and clean doubles.",
  elite:    "Peak form. Every session felt on the board.",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ShadowBotDetail() {
  const params = useParams<{ playerId: string }>();
  const playerId = Number(params.playerId);

  const [stats, setStats]         = useState<ShadowBotStats | null>(null);
  const [matches, setMatches]     = useState<MatchRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [timeline, setTimeline]   = useState<TimelinePoint[]>([]);
  const [rivalry, setRivalry]     = useState<RivalryRow[]>([]);
  const [traits, setTraits]       = useState<ShadowTrait[]>([]);
  const [haunts, setHaunts]       = useState<{ won: number; lost: number; victims: string[] } | null>(null);
  useEffect(() => {
    if (!playerId) return;
    fetch(`/api/players/${playerId}/shadow-profile`).then(r => r.json()).then(d => setTraits(Array.isArray(d?.traits) ? d.traits : [])).catch(() => setTraits([]));
    fetch(`/api/players/${playerId}/haunt-record`).then(r => r.json()).then(setHaunts).catch(() => setHaunts(null));
  }, [playerId]);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError(false);
    Promise.all([
      fetch(`/api/players/${playerId}/shadow-bot-stats`).then(r => r.json()),
      fetch(`/api/shadow-bot/${playerId}/matches`).then(r => r.json()),
      fetch(`/api/players/${playerId}/bot-improvement-timeline`).then(r => r.ok ? r.json() : { timeline: [] }),
      fetch(`/api/players/${playerId}/shadow-rivalry`).then(r => r.ok ? r.json() : []),
    ])
      .then(([s, m, tl, rv]) => {
        setStats(s as ShadowBotStats);
        setMatches(Array.isArray(m) ? m as MatchRow[] : []);
        setTimeline(Array.isArray(tl?.timeline) ? tl.timeline : []);
        setRivalry(Array.isArray(rv) ? rv as RivalryRow[] : []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [playerId]);

  if (!playerId) {
    return (
      <div className="p-6 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>Invalid bot ID</div>
    );
  }

  const lvlColor      = stats?.accuracyLevel ? (LEVEL_COLOR[stats.accuracyLevel] ?? "#ff005c") : "#ff005c";
  const lvlLabel      = stats?.accuracyLevel ? (LEVEL_LABEL[stats.accuracyLevel] ?? stats.accuracyLevel) : null;
  const nextLabel     = stats?.nextLevel ? (LEVEL_LABEL[stats.nextLevel] ?? stats.nextLevel) : null;
  const activeLevelIdx = stats?.accuracyLevel ? LEVEL_STEPS.findIndex(s => s.key === stats.accuracyLevel) : -1;
  const lvlDesc       = stats?.accuracyLevel ? (LEVEL_DESCRIPTIONS[stats.accuracyLevel] ?? "") : "";

  const matchWins     = matches.filter(m => m.playerWon === false).length;
  const matchLosses   = matches.filter(m => m.playerWon === true).length;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 pm-page">

      {/* Back link */}
      <Link href="/shadow-bot"
        className="inline-flex items-center gap-2 text-xs uppercase"
        style={{ fontFamily: "Oswald, sans-serif", color: "#a9a4bd", letterSpacing: "0.14em" }}>
        <ArrowLeft className="w-3.5 h-3.5" />
        Bot Roster
      </Link>

      {loading && (
        <div className="pm-card py-16 text-center animate-pulse"
          style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
          Loading shadow bot…
        </div>
      )}

      {error && (
        <div className="pm-card py-16 text-center"
          style={{ color: "rgba(255,0,92,0.6)", fontFamily: "Oswald, sans-serif" }}>
          Could not load bot data
        </div>
      )}

      {stats && !loading && (
        <>
          {/* ══ HERO ══ */}
          {(() => {
            const acc = stats.locked ? "#ff005c" : lvlColor;
            return (
              <div className="relative overflow-hidden" style={{ borderRadius: 24, border: `1px solid ${acc}55`, background: `linear-gradient(160deg, ${acc}2e 0%, #14102a 46%, #06060b 100%)`, boxShadow: `0 20px 50px rgba(0,0,0,.55), 0 0 40px ${acc}18` }}>
                <Glow x="88%" y="5%" color={acc} size={420} opacity={0.3} />
                <Glow x="5%" y="95%" color="#a855f7" size={360} opacity={0.2} />
                <DartboardBackdrop size={460} opacity={0.07} style={{ right: -170, top: -110, transform: "rotate(8deg)" }} />
                <div className="relative p-5" style={{ zIndex: 1 }}>
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 rounded-full p-[3px]" style={{ background: stats.locked ? "linear-gradient(135deg,#ff005c55,#2a0010)" : `conic-gradient(from 200deg, ${acc}, #fff8, ${acc}, #0000 70%, ${acc})`, boxShadow: `0 0 22px ${acc}66` }}>
                      <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center" style={{ background: `radial-gradient(circle at 35% 30%, ${acc}44, #0d0b14 70%)` }}>
                        {stats.locked
                          ? <Lock className="w-8 h-8" style={{ color: "#ff5c93", filter: "drop-shadow(0 0 8px #ff005c)" }} />
                          : <Ghost className="w-9 h-9" style={{ color: "#fff", filter: `drop-shadow(0 0 10px ${acc})` }} />}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="pm-lab" style={{ color: acc }}>Shadow bot · player clone</span>
                      <h1 className="uppercase leading-none mt-1.5" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "clamp(2rem, 9vw, 3.4rem)", letterSpacing: "0.03em" }}>
                        <span className="pm-chrome" style={{ opacity: stats.locked ? 0.55 : 1 }}>Shadow</span>{" "}
                        <span style={{ color: stats.locked ? "#8f8aa3" : acc, textShadow: stats.locked ? "none" : `0 0 24px ${acc}aa` }}>{stats.playerName}</span>
                      </h1>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {stats.locked
                          ? <span className="pm-chip" style={{ color: "#ff9ab8", borderColor: "rgba(255,0,92,.55)", background: "rgba(255,0,92,.12)" }}><Lock className="w-3 h-3" /> Offline · {stats.dartsNeeded - stats.totalDarts} darts to go</span>
                          : <span className="pm-chip" style={{ color: acc, borderColor: `${acc}88`, background: `${acc}1c` }}>{lvlLabel}</span>}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed mt-4" style={{ color: "#bdb8cf" }}>
                    {stats.locked
                      ? `A shadow bot that mirrors ${stats.playerName}'s dart-throwing DNA. Needs ${stats.dartsNeeded - stats.totalDarts} more darts of practice data before it can come online.`
                      : `A living replica of ${stats.playerName}'s form, built from ${stats.totalDarts.toLocaleString()} darts of data. ${lvlDesc}`}
                  </p>

                  {!stats.locked && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {[
                        { l: "Form avg", v: stats.computedAvg != null ? stats.computedAvg.toFixed(1) : "—", c: acc },
                        { l: "Checkout", v: stats.doubleHitPct != null ? `${Math.round(stats.doubleHitPct * 100)}%` : "—", c: "#4ade80" },
                        { l: "Darts", v: stats.totalDarts.toLocaleString(), c: "#ffd24a" },
                      ].map(t => (
                        <div key={t.l} className="rounded-2xl px-1 py-2.5 text-center" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.015))", border: "1px solid rgba(255,255,255,.12)" }}>
                          <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 24, color: t.c, textShadow: `0 0 14px ${t.c}77` }}>{t.v}</div>
                          <div className="pm-lab justify-center mt-1" style={{ fontSize: 8.5, letterSpacing: ".12em" }}>{t.l}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Level ladder */}
                  <div className="mt-4 rounded-2xl p-3" style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="pm-lab" style={{ fontSize: 9, color: acc }}>{stats.locked ? `${stats.totalDarts} / ${stats.dartsNeeded} darts` : lvlLabel}</span>
                      <span className="pm-lab" style={{ fontSize: 9 }}>{stats.locked ? `${stats.progressToNext}%` : nextLabel ? `${stats.progressToNext}% → ${nextLabel}` : "Max level"}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${stats.progressToNext}%`, background: `linear-gradient(90deg, ${acc}88, ${acc})`, boxShadow: `0 0 10px ${acc}` }} />
                    </div>
                    <div className="grid mt-3" style={{ gridTemplateColumns: `repeat(${LEVEL_STEPS.length}, minmax(0,1fr))` }}>
                      {LEVEL_STEPS.map((step, i) => {
                        const on = !stats.locked && i <= activeLevelIdx;
                        const cur = !stats.locked && i === activeLevelIdx;
                        return (
                          <div key={step.key} className="flex flex-col items-center gap-1 min-w-0">
                            <div className="rounded-full" style={{ width: cur ? 14 : 10, height: cur ? 14 : 10, background: on ? step.color : "rgba(255,255,255,.1)", boxShadow: on ? `0 0 ${cur ? 12 : 6}px ${step.color}` : "none", border: cur ? "2px solid #fff" : undefined }} />
                            {cur && (
                              <span className="whitespace-nowrap" style={{ fontFamily: "Oswald, sans-serif", fontSize: 9, letterSpacing: ".06em", textTransform: "uppercase", color: on ? step.color : "#8f8aa3" }}>{step.label}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Link href="/practice" className="flex-1 rounded-full flex items-center justify-center gap-1.5 uppercase"
                      style={{ minHeight: 42, background: "linear-gradient(180deg, #ffe58a, #e0a800)", border: "1px solid #ffd24a", color: "#1a1200", fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em", fontSize: "0.75rem", boxShadow: "0 0 16px rgba(255,210,74,.35)" }}>
                      <Dumbbell className="w-3.5 h-3.5" /> {stats.locked ? "Go practice" : "Train more"}
                    </Link>
                    <Link href={`/players/${playerId}`} className="flex-1 rounded-full flex items-center justify-center gap-1.5 uppercase"
                      style={{ minHeight: 42, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.16)", color: "#e4e0f0", fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em", fontSize: "0.75rem" }}>
                      Profile <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ══ TRAITS + HAUNTS ══ */}
          {(traits.length > 0 || (haunts && haunts.won + haunts.lost > 0)) && (
            <>
              <Chapter title="Traits" accent="#a78bfa" aside={<Ghost className="w-4 h-4" style={{ color: "#a78bfa" }} />} />
              <PmCard accent="#a78bfa">
                <div className="p-4 space-y-3">
                  <TraitChips traits={traits} size="md" />
                  {traits.length > 0 && <div className="space-y-1">{traits.map(t => (
                    <div key={t.key} className="text-xs" style={{ color: "rgba(255,255,255,.6)" }}><b style={{ color: "#fff", fontFamily: "Oswald, sans-serif", letterSpacing: ".04em" }}>{t.label}:</b> {t.why}</div>
                  ))}</div>}
                  {haunts && haunts.won + haunts.lost > 0 && (
                    <div className="text-xs pt-2" style={{ borderTop: "1px solid rgba(255,255,255,.07)", color: "rgba(255,255,255,.6)" }}>
                      <b style={{ color: "#c4b5fd", fontFamily: "Oswald, sans-serif", letterSpacing: ".06em" }}>👻 HAUNTINGS {haunts.won}-{haunts.lost}</b>
                      {haunts.victims.length > 0 && <> · beat {haunts.victims.join(", ")}</>}
                    </div>
                  )}
                </div>
              </PmCard>
            </>
          )}

          {/* ══ DART PROFILE ══ */}
          {!stats.locked && (stats.primarySeg != null || (stats.checkoutSegs && stats.checkoutSegs.length > 0)) && (
            <>
              <Chapter title="Dart profile" accent={lvlColor} aside={<Target className="w-4 h-4" style={{ color: lvlColor }} />} />
              <PmCard accent={lvlColor}>
                <div className="p-4 flex flex-wrap items-center gap-5">
                  {stats.primarySeg != null && (
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `radial-gradient(circle at 35% 30%, ${lvlColor}55, #0d0b14 75%)`, border: `1px solid ${lvlColor}aa`, boxShadow: `0 0 18px ${lvlColor}66` }}>
                        <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22, color: "#fff", textShadow: `0 0 10px ${lvlColor}` }}>T{stats.primarySeg}</span>
                      </div>
                      <div className="pm-lab" style={{ fontSize: 9 }}>Primary<br />target</div>
                    </div>
                  )}
                  {stats.checkoutSegs && stats.checkoutSegs.length > 0 && (
                    <div>
                      <div className="pm-lab mb-1.5" style={{ fontSize: 9 }}>Preferred checkouts</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {stats.checkoutSegs.map(s => (
                          <span key={s} className="rounded-full px-3 py-1" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 15, color: "#fff", background: "linear-gradient(180deg, rgba(74,222,128,.35), rgba(74,222,128,.08))", border: "1px solid rgba(74,222,128,.6)", boxShadow: "0 0 10px rgba(74,222,128,.25)" }}>D{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </PmCard>
            </>
          )}

          {/* ══ DATA SOURCES ══ */}
          <Chapter title="Built from" accent="#ffd24a" aside={<Zap className="w-4 h-4" style={{ color: "#ffd24a" }} />} />
          <div className="space-y-2">
            {[
              { icon: Dumbbell, c: "#a78bfa", l: "Practice", v: (stats.practiceDarts ?? 0).toLocaleString(), n: `darts · ${stats.totalSessions} session${stats.totalSessions !== 1 ? "s" : ""}` },
              { icon: Trophy, c: "#ffd24a", l: "League", v: `${stats.matchWins ?? 0}W–${(stats.totalMatches ?? 0) - (stats.matchWins ?? 0)}L`, n: `${stats.totalMatches ?? 0} match${(stats.totalMatches ?? 0) !== 1 ? "es" : ""}` },
              { icon: TrendingUp, c: "#7fb4ff", l: "Elo rating", v: String(stats.playerElo ?? 1000), n: "league rating" },
            ].map(r => (
              <div key={r.l} className="pm-lbrow flex items-center gap-3 rounded-2xl px-3 py-3" style={{ borderColor: `${r.c}44`, background: `linear-gradient(90deg, ${r.c}1f, rgba(18,16,26,.95) 55%)` }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${r.c}22`, border: `1px solid ${r.c}66`, boxShadow: `0 0 12px ${r.c}33` }}><r.icon className="w-4 h-4" style={{ color: r.c }} /></span>
                <div className="flex-1 min-w-0">
                  <div className="uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: 14, letterSpacing: ".06em", color: "#f2eefc" }}>{r.l}</div>
                  <div className="text-xs" style={{ color: "#8f8aa3" }}>{r.n}</div>
                </div>
                <div className="tabular-nums shrink-0" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 24, color: r.c, textShadow: `0 0 12px ${r.c}66` }}>{r.v}</div>
              </div>
            ))}
          </div>

          {/* ══ TRAINING BREAKDOWN ══ */}
          {stats.gameModeSessions.length > 0 && (
            <>
              <Chapter title="Training by game mode" accent="#ff005c" aside={<CircuitBoard className="w-4 h-4" style={{ color: "#ff005c" }} />} />
              <PmCard accent="#ff005c">
                <div className="p-4 space-y-3">
                  {stats.gameModeSessions.map(g => {
                    const maxSess = stats.gameModeSessions[0]?.sessions ?? 1;
                    const barPct  = Math.round((g.sessions / maxSess) * 100);
                    const isThin  = g.sessions < 5;
                    const c = isThin ? "#ffd24a" : lvlColor;
                    return (
                      <div key={g.gameTypeKey}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm truncate" style={{ color: "#e4e0f0", fontFamily: "Oswald, sans-serif", letterSpacing: ".03em" }}>{g.gameTypeName}</span>
                          <span className="text-xs tabular-nums shrink-0" style={{ color: c, fontFamily: "Oswald, sans-serif" }}>{g.sessions} session{g.sessions !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${c}77, ${c})`, boxShadow: `0 0 8px ${c}88` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PmCard>
            </>
          )}

          {/* ══ IMPROVEMENT TIMELINE ══ */}
          {timeline.filter(p => p.avg != null).length >= 2 && (() => {
            const points = timeline.filter(p => p.avg != null);
            const maxAvg = Math.max(...points.map(p => p.avg!));
            const minAvg = Math.min(...points.map(p => p.avg!));
            const range  = Math.max(maxAvg - minAvg, 5);
            const delta  = (points[points.length - 1]?.avg ?? 0) - (points[0]?.avg ?? 0);
            const TrendIcon = delta > 2 ? TrendingUp : delta < -2 ? TrendingDown : Minus;
            const trendColor = delta > 2 ? "#4ade80" : delta < -2 ? "#ff5c93" : "#a9a4bd";
            return (
              <>
                <Chapter title="Form trend" accent="#a78bfa" aside={<span className="pm-chip">Last {timeline.length} weeks</span>} />
                <PmCard accent="#a78bfa">
                  <div className="p-4">
                    <div className="flex items-end gap-1.5 h-24 mb-3">
                      {timeline.map((p, i) => {
                        const pct = p.avg != null ? ((p.avg - minAvg + 2) / (range + 4)) * 100 : 8;
                        const isLast = i === timeline.length - 1;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 h-full justify-end">
                            <div className="w-full rounded-t-md transition-all duration-500"
                              style={{ height: `${Math.max(pct, 8)}%`, background: p.avg == null ? "rgba(255,255,255,0.06)" : `linear-gradient(180deg, ${lvlColor}${isLast ? "" : "aa"}, ${lvlColor}22)`, boxShadow: isLast ? `0 0 14px ${lvlColor}` : undefined }} />
                            {i % 2 === 0 && <span className="leading-none" style={{ fontSize: 8, color: "#6b6680", fontFamily: "Oswald, sans-serif" }}>{p.weekLabel.replace("Wk ", "")}</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="pm-chip" style={{ color: trendColor, borderColor: `${trendColor}66` }}><TrendIcon className="w-3.5 h-3.5" />{delta > 2 ? `+${delta.toFixed(1)} improving` : delta < -2 ? `${delta.toFixed(1)} declining` : "Holding form"}</span>
                      <span className="text-xs" style={{ color: "#8f8aa3", fontFamily: "Oswald, sans-serif" }}>Low <b style={{ color: "#e4e0f0" }}>{minAvg.toFixed(1)}</b> · Peak <b style={{ color: lvlColor }}>{maxAvg.toFixed(1)}</b></span>
                    </div>
                  </div>
                </PmCard>
              </>
            );
          })()}

          {/* ══ RIVALRY TRACKER ══ */}
          {rivalry.length > 0 && (
            <>
              <Chapter title="Who beats this bot" accent="#ff005c" aside={<Ghost className="w-4 h-4" style={{ color: "#ff005c" }} />} />
              <div className="space-y-2">
                {rivalry.map(r => {
                  const total = r.wins + r.losses;
                  const winPct = total > 0 ? Math.round((r.wins / total) * 100) : 0;
                  const good = r.wins >= r.losses;
                  const c = good ? "#4ade80" : "#ff5c93";
                  return (
                    <Link key={r.playerId} href={`/players/${r.playerId}`}>
                      <div className="pm-lbrow flex items-center gap-3 rounded-2xl px-3 py-3 cursor-pointer">
                        <Ring value={winPct} color={c} size={42} width={4}><span style={{ fontFamily: "Oswald, sans-serif", fontSize: 11, color: "#fff" }}>{winPct}%</span></Ring>
                        <div className="flex-1 min-w-0 uppercase truncate" style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, letterSpacing: ".03em", color: "#fff" }}>{r.playerName}</div>
                        <div className="tabular-nums shrink-0" style={{ fontFamily: "Oswald, sans-serif", fontSize: 18 }}>
                          <span style={{ color: "#4ade80" }}>{r.wins}</span><span style={{ color: "#6b6680" }}>–</span><span style={{ color: "#ff7a9c" }}>{r.losses}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* ══ MATCH HISTORY VS THIS BOT ══ */}
          <Chapter title={`Matches vs Shadow ${stats.playerName}`} accent={lvlColor}
            aside={matches.length > 0 ? <span className="pm-chip">{matchWins}W {matchLosses}L bot</span> : undefined} />
          {matches.length === 0 ? (
            <PmCard accent={lvlColor}>
              <div className="py-10 px-5 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `radial-gradient(circle at 35% 30%, ${lvlColor}40, #0d0b14 75%)`, border: `1px solid ${lvlColor}88`, boxShadow: `0 0 20px ${lvlColor}55` }}>
                  <Ghost className="w-7 h-7" style={{ color: "#fff" }} />
                </div>
                <div className="pm-chrome uppercase mt-3" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: ".04em" }}>No matches yet</div>
                <p className="text-sm max-w-xs mt-1" style={{ color: "#a9a4bd" }}>Play against Shadow {stats.playerName} in Practice and the results will appear here.</p>
                <Link href="/practice" className="mt-4 inline-flex items-center gap-2 px-5 rounded-full uppercase"
                  style={{ minHeight: 40, fontFamily: "Oswald, sans-serif", fontSize: "0.75rem", letterSpacing: "0.12em", background: "linear-gradient(180deg, #ffe58a, #e0a800)", border: "1px solid #ffd24a", color: "#1a1200", boxShadow: "0 0 16px rgba(255,210,74,.35)" }}>
                  <Dumbbell className="w-3.5 h-3.5" /> Challenge this bot
                </Link>
              </div>
            </PmCard>
          ) : (
            <div className="space-y-2">
              {matches.map(match => {
                const c = match.playerWon ? "#22c55e" : "#ff005c";
                return (
                  <div key={match.id} className="pm-lbrow flex items-center gap-3 rounded-2xl px-3 py-3" style={{ borderColor: `${c}55`, background: `linear-gradient(90deg, ${c}22, rgba(18,16,26,.95) 50%)` }}>
                    <span className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, color: "#fff", background: match.playerWon ? "linear-gradient(180deg,#34d27b,#118a49)" : "linear-gradient(180deg,#ff4d86,#a3003b)", boxShadow: `0 0 12px ${c}66` }}>{match.playerWon ? "W" : "L"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="uppercase truncate" style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, color: "#fff", letterSpacing: ".03em" }}>{match.playerName}</div>
                      <div className="text-xs truncate" style={{ color: "#8f8aa3" }}>{match.gameTypeName}{match.detail ? ` · ${match.detail}` : ""} · {formatDate(match.createdAt)}</div>
                    </div>
                    {match.p1Avg != null && (
                      <div className="text-right shrink-0">
                        <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 20, color: "#e4e0f0" }}>{match.p1Avg.toFixed(1)}</div>
                        <div className="pm-lab justify-end" style={{ fontSize: 8 }}>avg{match.p1Darts != null ? ` · ${match.p1Darts}d` : ""}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
