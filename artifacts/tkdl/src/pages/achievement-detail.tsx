import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Trophy, Lock, Coins, Package, Zap, Users } from "lucide-react";

type UnlockedBy = {
  playerId: number;
  playerName: string;
  unlockedAt: string;
  seasonId: number | null;
};

type AchievementDetail = {
  system: "core" | "shadow-bot" | "tour" | "card-clash";
  key: string;
  name: string;
  description: string;
  icon: string;
  rarity: string | null;
  category: string | null;
  hidden: boolean;
  reward: { coins?: number; pack?: string | null; gamerscore?: number };
  repeatable: boolean;
  totalUnlocks: number;
  unlockedBy: UnlockedBy[];
};

const RARITY_META: Record<string, { color: string; glow: string; bg: string; border: string }> = {
  Mythic:    { color: "#ff005c", glow: "0 0 40px rgba(255,0,92,0.3)",    bg: "rgba(255,0,92,0.07)",    border: "rgba(255,0,92,0.4)" },
  Legendary: { color: "#ffd24a", glow: "0 0 36px rgba(255,210,74,0.25)", bg: "rgba(255,210,74,0.06)",  border: "rgba(255,210,74,0.35)" },
  Epic:      { color: "#a855f7", glow: "0 0 30px rgba(168,85,247,0.22)", bg: "rgba(168,85,247,0.06)",  border: "rgba(168,85,247,0.32)" },
  Rare:      { color: "#0066ff", glow: "0 0 24px rgba(0,102,255,0.18)",  bg: "rgba(0,102,255,0.05)",   border: "rgba(0,102,255,0.3)" },
  Common:    { color: "#9ca3af", glow: "none",                            bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.1)" },
};

const SYSTEM_LABEL: Record<string, string> = {
  core:        "League",
  "shadow-bot": "Practice · Shadow Bot",
  tour:        "Tour",
  "card-clash": "Card Clash",
};

const SYSTEM_BACK: Record<string, { href: string; label: string }> = {
  core:        { href: "/achievements", label: "Achievements" },
  "shadow-bot": { href: "/shadow-bot", label: "Shadow Bot" },
  tour:        { href: "/tour", label: "Tour" },
  "card-clash": { href: "/card-clash", label: "Card Clash" },
};

function getRarityMeta(rarity: string | null) {
  if (!rarity) return RARITY_META.Common;
  return RARITY_META[rarity] ?? RARITY_META.Common;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function AchievementDetailPage() {
  const params = useParams<{ system: string; key: string }>();
  const { system, key } = params;

  const [data, setData]       = useState<AchievementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!system || !key) return;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/achievements/detail/${system}/${key}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then(d => { if (d) setData(d as AchievementDetail); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [system, key]);

  const back = SYSTEM_BACK[system ?? "core"] ?? SYSTEM_BACK.core;

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div className="section-card py-16 text-center animate-pulse"
          style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
          Loading trophy…
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <Link href={back.href}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.28)", letterSpacing: "0.12em" }}>
          <ArrowLeft className="w-3.5 h-3.5" />
          {back.label}
        </Link>
        <div className="section-card py-16 text-center" style={{ color: "rgba(255,0,92,0.6)", fontFamily: "Oswald, sans-serif" }}>
          Achievement not found
        </div>
      </div>
    );
  }

  const rm = getRarityMeta(data.rarity);
  const isHidden = data.hidden;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <Link href={back.href}
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider"
        style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.28)", letterSpacing: "0.12em" }}>
        <ArrowLeft className="w-3.5 h-3.5" />
        {back.label}
      </Link>

      {/* ══ TROPHY HERO ══ */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${rm.bg} 0%, rgba(9,9,15,0.98) 60%, ${rm.bg} 100%)`,
          border: `1px solid ${rm.border}`,
        }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 15% 30%, ${rm.bg} 0%, transparent 65%)` }} />
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
          <div className="flex-shrink-0 rounded-2xl flex items-center justify-center"
            style={{
              width: 96, height: 96, fontSize: 44,
              background: rm.bg, border: `2px solid ${rm.border}`, boxShadow: rm.glow,
            }}>
            {isHidden ? <Lock className="w-10 h-10" style={{ color: rm.color }} /> : (data.icon || "🏆")}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                style={{ color: rm.color, background: rm.bg, border: `1px solid ${rm.border}`, fontFamily: "Oswald, sans-serif" }}>
                {data.rarity ?? "Achievement"}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "Oswald, sans-serif" }}>
                {SYSTEM_LABEL[data.system] ?? data.system}
              </span>
              {data.category && (
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                  style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "Oswald, sans-serif" }}>
                  {data.category}
                </span>
              )}
              {data.repeatable && (
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                  style={{ color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", fontFamily: "Oswald, sans-serif" }}>
                  Re-earnable each season
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>
              {isHidden ? "Hidden Achievement" : data.name}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              {isHidden ? "Keep playing to discover how this one unlocks." : data.description}
            </p>

            <div className="flex flex-wrap gap-4 mt-4 justify-center md:justify-start">
              {!!data.reward.coins && (
                <div className="flex items-center gap-1.5 text-sm" style={{ color: "#ffd24a" }}>
                  <Coins className="w-4 h-4" /> {data.reward.coins} coins
                </div>
              )}
              {!!data.reward.pack && (
                <div className="flex items-center gap-1.5 text-sm" style={{ color: "#a855f7" }}>
                  <Package className="w-4 h-4" /> {data.reward.pack} pack
                </div>
              )}
              {!!data.reward.gamerscore && (
                <div className="flex items-center gap-1.5 text-sm" style={{ color: "#0066ff" }}>
                  <Zap className="w-4 h-4" /> {data.reward.gamerscore} G
                </div>
              )}
              <div className="flex items-center gap-1.5 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                <Users className="w-4 h-4" /> {data.totalUnlocks} {data.totalUnlocks === 1 ? "player has" : "players have"} earned this
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ UNLOCK LIST ══ */}
      <div className="section-card p-4 md:p-6">
        <h2 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>
          <Trophy className="w-3.5 h-3.5" style={{ color: rm.color }} />
          Earned by
        </h2>

        {data.unlockedBy.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
            Nobody has earned this yet — could be you.
          </div>
        )}

        <div className="space-y-2">
          {data.unlockedBy.slice().reverse().map((u, i) => (
            <Link key={`${u.playerId}-${u.unlockedAt}-${i}`} href={`/players/${u.playerId}`}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
                {u.playerName}
              </span>
              <span className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                {u.seasonId ? <span>Season {u.seasonId}</span> : null}
                {formatDate(u.unlockedAt)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
