import { PageHero, Chapter } from "@/components/premium/Premium";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ShadowCup } from "@/components/shadow/ShadowCup";
import { Lock, CircuitBoard, Trophy, Star, Ghost, Shield, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

type BotLeaderboardRow = {
  playerId: number;
  playerName: string;
  totalDarts: number;
  totalSessions: number;
  gameModes: number;
  locked: boolean;
  computedAvg: number | null;
  accuracyLevel: string | null;
  progressToNext: number;
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

const TOTAL_BOT_GAMERSCORE = 1130;

function BotLevelPip({ levelKey, active }: { levelKey: string; active: boolean }) {
  const color = LEVEL_COLOR[levelKey] ?? "#94a3b8";
  return (
    <div className="w-2.5 h-2.5 rounded-full transition-all" style={{
      background: active ? color : "rgba(255,255,255,0.08)",
      boxShadow: active ? `0 0 8px ${color}90` : "none",
    }} />
  );
}

export default function ShadowBot() {
  const [roster, setRoster] = useState<BotLeaderboardRow[]>([]);

  useEffect(() => {
    fetch("/api/bots/leaderboard")
      .then(r => r.json()).then(d => setRoster(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const topBots   = roster.filter(b => !b.locked).slice(0, 5);
  const onlineCount = roster.filter(r => !r.locked).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5 pm-page">

      {/* ══ HERO ══ */}
      <PageHero kicker="TKDL shadow bot protocol" icon={<CircuitBoard className="w-3.5 h-3.5" />} accent="#ff005c" accent2="#22d3ee"
        title={<><span>Play yourself.</span><br /><span style={{ WebkitTextFillColor: "#ff2f72", textShadow: "0 0 26px rgba(255,0,92,.55)" }}>Beat yourself.</span></>}
        sub={<>Every dart you throw teaches your Shadow Bot — your patterns, favourite segments and checkout targets — then turns them into an opponent you can face. <b style={{ color: "#fff" }}>250 darts to activate.</b></>}>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { v: onlineCount, l: "Bots online", c: "#ff7aa6" },
            { v: `${TOTAL_BOT_GAMERSCORE}G`, l: "Available", c: "#ffd24a" },
            { v: roster.length, l: "Roster", c: "#7ff0ff" },
          ].map(t => (
            <div key={t.l} className="rounded-2xl px-1 py-2.5 text-center" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.015))", border: "1px solid rgba(255,255,255,.12)" }}>
              <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 24, color: t.c, textShadow: `0 0 14px ${t.c}77` }}>{t.v}</div>
              <div className="pm-lab justify-center mt-1" style={{ fontSize: 8.5, letterSpacing: ".12em" }}>{t.l}</div>
            </div>
          ))}
        </div>
        {/* Level roadmap */}
        <div className="mt-4 rounded-2xl p-3" style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)" }}>
          <div className="pm-lab mb-2.5" style={{ fontSize: 9 }}>Bot levels · 3-dart avg</div>
          <div className="grid grid-cols-6 gap-2">
            {LEVEL_STEPS.map((step, i) => (
              <div key={step.key} className="flex flex-col items-center min-w-0">
                <div className="rounded-md w-full" style={{ height: 6 + i * 4, marginTop: 20 - i * 4, background: `linear-gradient(180deg, ${step.color}, ${step.color}33)`, boxShadow: `0 0 8px ${step.color}66` }} />
                <span className="whitespace-nowrap mt-1.5" style={{ fontFamily: "Oswald, sans-serif", fontSize: 8, letterSpacing: "0", textTransform: "uppercase", color: step.color }}>{step.label.replace("Pro Tour", "Pro")}</span>
                <span className="tabular-nums" style={{ fontFamily: "Oswald, sans-serif", fontSize: 9.5, color: "#8f8aa3" }}>{step.threshold}</span>
              </div>
            ))}
          </div>
        </div>
      </PageHero>

      {/* ══ TOP BOTS ══ */}
      {topBots.length > 0 && (
        <>
          <Chapter title="Top bots" accent="#ff005c" aside={<span className="pm-chip">By form</span>} />
          <div className="space-y-2">
            {topBots.map((bot, i) => {
              const color = LEVEL_COLOR[bot.accuracyLevel ?? "beginner"] ?? "#94a3b8";
              const label = LEVEL_LABEL[bot.accuracyLevel ?? "beginner"] ?? "Beginner";
              const medal = ["linear-gradient(180deg,#ffe58a,#d99a00)", "linear-gradient(180deg,#ffffff,#9aa6bd)", "linear-gradient(180deg,#f0b27a,#9c5a2a)"][i];
              const pc = ["#ffd24a", "#c0c8d8", "#cd7f32"][i];
              return (
                <Link key={bot.playerId} href={`/shadow-bot/${bot.playerId}`}>
                  <div className="pm-lbrow flex items-center gap-3 rounded-2xl px-3 py-3 cursor-pointer transition-all hover:-translate-y-0.5"
                    style={{ background: i < 3 ? `linear-gradient(90deg, ${pc}26, rgba(23,20,31,.95) 50%, rgba(12,10,18,.97))` : undefined, borderColor: i < 3 ? `${pc}66` : undefined }}>
                    <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 38, height: 38, background: medal ?? "linear-gradient(180deg,#3a3550,#1d1a2b)", color: medal ? "#141018" : "#e4e0f0", fontFamily: "Oswald, sans-serif", fontSize: 15, boxShadow: medal ? `0 0 14px ${pc}66` : "inset 0 1px 0 rgba(255,255,255,.1)" }}>{i + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="uppercase truncate" style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, letterSpacing: "0.03em", color: "#fff" }}><span style={{ color: "#ff7aa6" }}>Shadow </span>{bot.playerName}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="pm-chip" style={{ fontSize: 9, padding: "2px 7px", color, borderColor: `${color}66`, background: `${color}14` }}>{label}</span>
                        <span className="text-[11px]" style={{ color: "#a9a4bd", fontFamily: "Oswald, sans-serif" }}>{bot.totalDarts.toLocaleString()} darts</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: i === 0 ? 28 : 24, color: i === 0 ? "#ffd24a" : color, textShadow: `0 0 14px ${i === 0 ? "rgba(255,210,74,.55)" : color + "77"}` }}>{bot.computedAvg != null ? bot.computedAvg.toFixed(1) : "—"}</div>
                      <div className="pm-lab justify-end" style={{ fontSize: 8.5 }}>avg</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* ══ SHADOW CUP ══ */}
      <Chapter title="Shadow Cup" accent="#a78bfa" aside={<span className="pm-chip">Weekly</span>} />
      <ShadowCup />

      {/* ══ BOT ROSTER ══ */}
      <Chapter title="Full roster" accent="#22d3ee" aside={<span className="pm-chip">{onlineCount} / {roster.length} online</span>} />
      {roster.length === 0 ? (
        <div className="pm-card py-10 text-center">
          <div className="text-sm animate-pulse" style={{ color: "#8f8aa3" }}>Loading bots…</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {roster.map((bot, rank) => {
            const color     = bot.locked ? "#ff005c" : (LEVEL_COLOR[bot.accuracyLevel ?? "beginner"] ?? "#94a3b8");
            const label     = bot.locked ? "Offline" : (LEVEL_LABEL[bot.accuracyLevel ?? "beginner"] ?? "Beginner");
            const activeLvl = bot.accuracyLevel ? LEVEL_STEPS.findIndex(s => s.key === bot.accuracyLevel) : -1;
            const lvlIdx = activeLvl;
            const Trend = bot.locked ? null : bot.progressToNext > 70 && lvlIdx < LEVEL_STEPS.length - 1 ? TrendingUp : bot.progressToNext < 20 && lvlIdx > 0 ? TrendingDown : Minus;
            const trendC = Trend === TrendingUp ? "#4ade80" : Trend === TrendingDown ? "#ff5c93" : "#8f8aa3";
            return (
              <Link key={bot.playerId} href={`/shadow-bot/${bot.playerId}`}>
                <div className="pm-card relative overflow-hidden cursor-pointer transition-transform hover:-translate-y-0.5" style={{ ["--pm-acc" as any]: color, padding: 16, opacity: bot.locked ? 0.8 : 1 }}>
                  <div className="absolute pointer-events-none" style={{ right: -60, top: -60, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${color}2e, transparent 70%)` }} />
                  <div className="relative flex items-center gap-3">
                    <div className="shrink-0 rounded-full p-[2px]" style={{ background: bot.locked ? "linear-gradient(135deg,#ff005c55,#2a0010)" : `conic-gradient(from 200deg, ${color}, #fff8, ${color}, #0000 70%, ${color})`, boxShadow: `0 0 14px ${color}55` }}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `radial-gradient(circle at 35% 30%, ${color}40, #0d0b14 75%)` }}>
                        {bot.locked ? <Lock className="w-5 h-5" style={{ color: "#ff7aa6" }} /> : <Ghost className="w-5 h-5" style={{ color: "#fff", filter: `drop-shadow(0 0 6px ${color})` }} />}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="pm-lab" style={{ fontSize: 8.5, color: rank === 0 && !bot.locked ? "#ffd24a" : undefined }}>{rank === 0 && !bot.locked ? "🏆 Top bot · Shadow" : `Bot #${rank + 1} · Shadow`}</div>
                      <div className={`uppercase leading-tight break-words ${bot.locked ? "" : "pm-chrome"}`} style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: ".03em", color: bot.locked ? "#8f8aa3" : undefined }}>{bot.playerName}</div>
                      <span className="pm-chip mt-1" style={{ fontSize: 9, padding: "2px 7px", color, borderColor: `${color}66`, background: `${color}14` }}>{bot.locked && <Lock className="w-2.5 h-2.5" />}{label}</span>
                    </div>
                    {!bot.locked && bot.computedAvg != null && (
                      <div className="shrink-0 text-right self-start">
                        <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, color, textShadow: `0 0 14px ${color}77` }}>{bot.computedAvg.toFixed(1)}</div>
                        <div className="pm-lab justify-end" style={{ fontSize: 8.5 }}>avg</div>
                      </div>
                    )}
                  </div>

                  <div className="relative flex items-center gap-1.5 mt-3">
                    {LEVEL_STEPS.map((s, i) => (
                      <BotLevelPip key={s.key} levelKey={s.key} active={!bot.locked && i <= activeLvl} />
                    ))}
                    {Trend && <Trend className="w-3.5 h-3.5 ml-auto" style={{ color: trendC }} />}
                  </div>

                  <div className="relative flex items-center justify-between mt-2 text-xs" style={{ color: "#8f8aa3", fontFamily: "Oswald, sans-serif", letterSpacing: ".04em" }}>
                    <span>{bot.locked ? `${bot.totalDarts} / 250 darts to activate` : `${bot.totalDarts.toLocaleString()} darts · ${bot.totalSessions} sessions`}</span>
                    <span className="flex items-center gap-0.5 uppercase" style={{ color: bot.locked ? "#8f8aa3" : color }}>View <ChevronRight className="w-3 h-3" /></span>
                  </div>
                  <div className="relative h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${bot.progressToNext}%`, background: `linear-gradient(90deg, ${color}77, ${color})`, boxShadow: `0 0 8px ${color}` }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
