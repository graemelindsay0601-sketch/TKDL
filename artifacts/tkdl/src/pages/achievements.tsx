import { useListAchievements } from "@workspace/api-client-react";
import { useState } from "react";
import { Lock, Star, Users } from "lucide-react";

const RARITIES   = ["All", "Mythic", "Legendary", "Epic", "Rare", "Common"] as const;
const CATEGORIES = ["All", "Career", "Seasonal", "Tier", "Hidden"] as const;
const SORTS      = ["Default", "Most Unlocked", "Hardest"] as const;

type Sort = typeof SORTS[number];

const RARITY_META: Record<string, { color: string; glow: string; bg: string; border: string; order: number }> = {
  Mythic:    { color: "#ff005c", glow: "0 0 28px rgba(255,0,92,0.25)",     bg: "rgba(255,0,92,0.06)",    border: "rgba(255,0,92,0.35)",    order: 0 },
  Legendary: { color: "#ffd24a", glow: "0 0 24px rgba(255,210,74,0.2)",   bg: "rgba(255,210,74,0.05)",  border: "rgba(255,210,74,0.3)",   order: 1 },
  Epic:      { color: "#a855f7", glow: "0 0 20px rgba(168,85,247,0.18)",  bg: "rgba(168,85,247,0.05)",  border: "rgba(168,85,247,0.28)",  order: 2 },
  Rare:      { color: "#0066ff", glow: "0 0 16px rgba(0,102,255,0.15)",   bg: "rgba(0,102,255,0.04)",   border: "rgba(0,102,255,0.25)",   order: 3 },
  Common:    { color: "#9ca3af", glow: "none",                             bg: "rgba(255,255,255,0.025)", border: "rgba(255,255,255,0.08)", order: 4 },
  Hidden:    { color: "#444466", glow: "none",                             bg: "rgba(255,255,255,0.015)", border: "rgba(255,255,255,0.05)", order: 5 },
};

function getRarityMeta(rarity: string, isHidden: boolean) {
  if (isHidden) return RARITY_META.Hidden;
  return RARITY_META[rarity] ?? RARITY_META.Common;
}

function AchCard({ a, hovered, onHover }: { a: any; hovered: boolean; onHover: (v: boolean) => void }) {
  const isHidden = !!(a as any).hidden;
  const rm = getRarityMeta(a.rarity, isHidden);
  const unlocked = (a as any).unlockedCount ?? 0;

  return (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className="relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-default"
      style={{
        background: rm.bg,
        border: `1px solid ${rm.border}`,
        boxShadow: hovered ? rm.glow : "none",
        transform: hovered ? "translateY(-3px) scale(1.01)" : undefined,
      }}
    >
      <div className="h-1 w-full" style={{ background: rm.color, opacity: isHidden ? 0.3 : 1 }} />

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-widest"
            style={{ fontFamily: "Oswald, sans-serif", color: rm.color, fontSize: "0.55rem", letterSpacing: "0.18em", opacity: isHidden ? 0.5 : 1 }}>
            {a.rarity}
          </span>
          <div className="flex items-center gap-1.5">
            {!isHidden && unlocked > 0 && (
              <span className="flex items-center gap-0.5 text-xs font-bold"
                style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.6rem" }}>
                <Users className="w-2.5 h-2.5" />{unlocked}
              </span>
            )}
            {isHidden && <Lock className="w-3 h-3" style={{ color: "rgba(255,255,255,0.2)" }} />}
          </div>
        </div>

        <div className="text-4xl leading-none my-1 select-none" style={{ filter: isHidden ? "grayscale(1) brightness(0.4)" : undefined }}>
          {isHidden ? "🔒" : (a.icon || "🎯")}
        </div>

        <div className="font-black text-sm leading-tight"
          style={{ fontFamily: "Oswald, sans-serif", color: isHidden ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.9)", letterSpacing: "0.02em" }}>
          {isHidden ? "???" : a.name.replace(/^[^\s]+\s/, "")}
        </div>

        <div className="text-xs leading-relaxed flex-1" style={{ color: isHidden ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.45)" }}>
          {isHidden ? "Complete a hidden objective to reveal this achievement." : a.description}
        </div>

        {!isHidden && (a as any).category && (
          <div className="mt-auto pt-2 border-t" style={{ borderColor: `${rm.border}` }}>
            <span className="text-xs font-bold uppercase" style={{ color: rm.color, fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.12em", opacity: 0.7 }}>
              {(a as any).category}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Achievements() {
  const { data: achievements, isLoading } = useListAchievements();
  const [rarityFilter, setRarityFilter] = useState<string>("All");
  const [catFilter, setCatFilter]       = useState<string>("All");
  const [sort, setSort]                 = useState<Sort>("Default");
  const [hoveredId, setHoveredId]       = useState<number | null>(null);

  const base = [...(achievements ?? [])];

  const filtered = base.filter(a => {
    const isHidden = !!(a as any).hidden;
    const effectiveRarity = isHidden ? "Hidden" : a.rarity;
    const rMatch = rarityFilter === "All" || effectiveRarity === rarityFilter;
    const cMatch = catFilter === "All" || (a as any).category === catFilter;
    return rMatch && cMatch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "Most Unlocked") {
      return ((b as any).unlockedCount ?? 0) - ((a as any).unlockedCount ?? 0);
    }
    if (sort === "Hardest") {
      return ((a as any).unlockedCount ?? 0) - ((b as any).unlockedCount ?? 0);
    }
    // Default: rarity priority
    const ao = RARITY_META[(a as any).hidden ? "Hidden" : a.rarity]?.order ?? 99;
    const bo = RARITY_META[(b as any).hidden ? "Hidden" : b.rarity]?.order ?? 99;
    if (ao !== bo) return ao - bo;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  const counts = achievements ? {
    Mythic:    achievements.filter(a => a.rarity === "Mythic" && !(a as any).hidden).length,
    Legendary: achievements.filter(a => a.rarity === "Legendary" && !(a as any).hidden).length,
    Epic:      achievements.filter(a => a.rarity === "Epic" && !(a as any).hidden).length,
    Rare:      achievements.filter(a => a.rarity === "Rare" && !(a as any).hidden).length,
    Common:    achievements.filter(a => a.rarity === "Common" && !(a as any).hidden).length,
    Hidden:    achievements.filter(a => !!(a as any).hidden).length,
  } : null;

  const totalUnlocked = achievements?.reduce((acc, a) => acc + ((a as any).unlockedCount ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />

      <div>
        <h1 className="text-4xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
          Achievement Catalogue
        </h1>
        <p className="text-sm mt-1 flex items-center gap-3" style={{ color: "rgba(255,255,255,0.35)" }}>
          {achievements?.length ?? 0} achievements · {counts?.Hidden ?? 0} hidden · {totalUnlocked} total unlocks
        </p>
      </div>

      {/* Rarity pills */}
      {counts && (
        <div className="flex flex-wrap gap-2">
          {(["Mythic", "Legendary", "Epic", "Rare", "Common", "Hidden"] as const).map(r => {
            const rm = RARITY_META[r];
            return (
              <div key={r} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase"
                style={{ background: `${rm.color}14`, border: `1px solid ${rm.color}44`, color: rm.color, fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", fontSize: "0.6rem" }}>
                {r === "Mythic" && <Star className="w-2.5 h-2.5" />}
                {r} ×{counts[r]}
              </div>
            );
          })}
        </div>
      )}

      {/* Filters + sort */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Rarity filter */}
        <div className="flex gap-1 flex-wrap">
          {RARITIES.map(r => {
            const rm = RARITY_META[r === "All" ? "Common" : r];
            const active = rarityFilter === r;
            return (
              <button key={r} onClick={() => setRarityFilter(r)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all"
                style={{
                  fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em",
                  background: active ? (r === "All" ? "#ff005c" : rm.color) + "22" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? (r === "All" ? "#ff005c" : rm.color) + "88" : "rgba(255,255,255,0.08)"}`,
                  color: active ? (r === "All" ? "#ff005c" : rm.color) : "rgba(255,255,255,0.35)",
                }}>
                {r}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5 bg-white/10" />

        {/* Category filter */}
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all"
              style={{
                fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em",
                background: catFilter === c ? "rgba(0,102,255,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${catFilter === c ? "rgba(0,102,255,0.5)" : "rgba(255,255,255,0.08)"}`,
                color: catFilter === c ? "#0066ff" : "rgba(255,255,255,0.35)",
              }}>
              {c}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-white/10" />

        {/* Sort */}
        <div className="flex gap-1 flex-wrap">
          {SORTS.map(s => (
            <button key={s} onClick={() => setSort(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all"
              style={{
                fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em",
                background: sort === s ? "rgba(255,210,74,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${sort === s ? "rgba(255,210,74,0.5)" : "rgba(255,255,255,0.08)"}`,
                color: sort === s ? "#ffd24a" : "rgba(255,255,255,0.35)",
              }}>
              {s === "Most Unlocked" ? "👥 " : s === "Hardest" ? "💀 " : ""}{s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
          No achievements match this filter.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {sorted.map(a => (
            <AchCard
              key={a.id}
              a={a}
              hovered={hoveredId === a.id}
              onHover={v => setHoveredId(v ? a.id : null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
