import { useListAchievements } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { Lock, Star, Users, Trophy, Medal, CircuitBoard } from "lucide-react";
import { format } from "date-fns";
import { AchievementRewardModal } from "../components/AchievementRewardModal";
import { useAchievementModal } from "../utils/use-achievement-modal";

// ── Shared fetch hook ──────────────────────────────────────────────────────────

function useFetch<T>(url: string) {
  const [data, setData]     = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);
  return { data, loading };
}

// ── League achievement helpers ─────────────────────────────────────────────────

function gForRarity(rarity: string): number {
  const map: Record<string, number> = { Common: 10, Rare: 25, Epic: 50, Legendary: 100, Mythic: 200 };
  return map[rarity] ?? 10;
}

const RARITIES   = ["All", "Mythic", "Legendary", "Epic", "Rare", "Common"] as const;
const CATEGORIES = ["All", "Career", "Seasonal", "Tier", "Practice", "Format", "Rivalry", "Stakes", "Legacy", "Hidden"] as const;
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

function AchCard({ a, hovered, onHover, onClick }: { a: any; hovered: boolean; onHover: (v: boolean) => void; onClick: () => void }) {
  const isHidden = !!(a as any).hidden;
  const rm = getRarityMeta(a.rarity, isHidden);
  const unlocked = (a as any).unlockedCount ?? 0;

  return (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
      className="relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer hover:scale-105"
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
            {!isHidden && (
              <span className="font-black" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,210,74,0.55)", fontSize: "0.58rem" }}>
                {gForRarity(a.rarity)}G
              </span>
            )}
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

// ── LEAGUE TAB ─────────────────────────────────────────────────────────────────

function LeagueTab({ openAchievementModal }: { openAchievementModal: (a: any) => void }) {
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
    if (sort === "Most Unlocked") return ((b as any).unlockedCount ?? 0) - ((a as any).unlockedCount ?? 0);
    if (sort === "Hardest")       return ((a as any).unlockedCount ?? 0) - ((b as any).unlockedCount ?? 0);
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
    <div className="space-y-5">
      <p className="text-sm mt-1 flex items-center gap-3" style={{ color: "rgba(255,255,255,0.35)" }}>
        {achievements?.length ?? 0} achievements · {counts?.Hidden ?? 0} hidden · {totalUnlocked} total unlocks
      </p>

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

      <div className="flex flex-wrap gap-3 items-center">
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
              onClick={() => openAchievementModal(a)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── TOUR ACHIEVEMENTS TAB ──────────────────────────────────────────────────────

type TourAchDef = {
  id: number; key: string; name: string; description: string;
  gamerscore: number; category: string; unlocked_count: number;
};

const TOUR_CATEGORY_COLORS: Record<string, string> = {
  career:        "#ffd24a",
  format:        "#38bdf8",
  difficulty:    "#ff005c",
  completionist: "#a855f7",
  milestone:     "#34d399",
  trophy:        "#e8a020",
  specific:      "#f97316",
};
const TOUR_CATEGORY_ORDER = ["trophy", "career", "difficulty", "format", "specific", "completionist", "milestone"];

function TourTab({ openAchievementModal }: { openAchievementModal: (a: any) => void }) {
  const { data, loading } = useFetch<TourAchDef[]>("/api/tour/achievement-definitions");
  const [catFilter, setCatFilter] = useState("All");

  const categories = Array.from(new Set((data ?? []).map(d => d.category))).sort((a, b) => {
    const ai = TOUR_CATEGORY_ORDER.indexOf(a);
    const bi = TOUR_CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const filtered = (data ?? []).filter(d => catFilter === "All" || d.category === catFilter);
  const totalGs = (data ?? []).reduce((s, d) => s + d.gamerscore, 0);
  const unlockedCount = (data ?? []).reduce((s, d) => s + (d.unlocked_count > 0 ? 1 : 0), 0);

  return (
    <div className="space-y-5">
      <p className="text-sm flex items-center gap-3" style={{ color: "rgba(255,255,255,0.35)" }}>
        {data?.length ?? 0} tour achievements · {totalGs}G available · {unlockedCount} unlocked
      </p>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {["All", ...categories].map(c => {
          const color = TOUR_CATEGORY_COLORS[c] ?? "#9ca3af";
          const active = catFilter === c;
          return (
            <button key={c} onClick={() => setCatFilter(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all capitalize"
              style={{
                fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em",
                background: active ? `${color}22` : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? `${color}88` : "rgba(255,255,255,0.08)"}`,
                color: active ? color : "rgba(255,255,255,0.35)",
              }}>
              {c}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ffd24a" }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(a => {
            const color  = TOUR_CATEGORY_COLORS[a.category] ?? "#9ca3af";
            const isUnlocked = a.unlocked_count > 0;
            return (
              <div key={a.id} className="relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-default hover:-translate-y-0.5"
                style={{
                  background: `${color}07`,
                  border: `1px solid ${color}${isUnlocked ? "44" : "1a"}`,
                }}>
                <div className="h-1 w-full" style={{ background: color, opacity: isUnlocked ? 1 : 0.25 }} />
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest capitalize"
                      style={{ fontFamily: "Oswald, sans-serif", color, fontSize: "0.55rem", letterSpacing: "0.18em" }}>
                      {a.category}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,210,74,0.6)", fontSize: "0.58rem" }}>
                        {a.gamerscore}G
                      </span>
                      {isUnlocked && (
                        <span className="flex items-center gap-0.5 text-xs font-bold"
                          style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.6rem" }}>
                          <Users className="w-2.5 h-2.5" />{a.unlocked_count}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-3xl leading-none my-1 select-none">🏆</div>

                  <div className="font-black text-sm leading-tight"
                    style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.9)", letterSpacing: "0.02em" }}>
                    {a.name}
                  </div>

                  <div className="text-xs leading-relaxed flex-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {a.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SHADOW BOT TAB ─────────────────────────────────────────────────────────────

type BotAchDef = {
  key: string; name: string; description: string; icon: string;
  rarity: string; gamerscore: number; criteriaType: string; criteriaValue: number;
  unlockedCount: number;
};

const BOT_CRITERIA_LABELS: Record<string, string> = {
  TOTAL_DARTS:    "darts thrown",
  TOTAL_SESSIONS: "sessions",
  GAME_MODES:     "game modes",
  BOT_LEVEL:      "bot level",
  TOTAL_180S:     "× 180s",
  CHECKOUT_HITS:  "checkouts",
  TOTAL_SCORE:    "practice score",
};

function BotTab({ openAchievementModal }: { openAchievementModal: (a: any) => void }) {
  const { data, loading } = useFetch<BotAchDef[]>("/api/achievements/shadow-bot-definitions");
  const [rarityFilter, setRarityFilter] = useState("All");

  const RARITY_ORDER = ["Mythic", "Legendary", "Epic", "Rare", "Common"];
  const filtered = (data ?? [])
    .filter(d => rarityFilter === "All" || d.rarity === rarityFilter)
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

  const totalGs = (data ?? []).reduce((s, d) => s + d.gamerscore, 0);
  const unlockedCount = (data ?? []).filter(d => d.unlockedCount > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          {data?.length ?? 0} bot achievements · {totalGs}G available · {unlockedCount} unlocked
        </p>
        <a href="/shadow-bot" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all hover:-translate-y-0.5"
          style={{ fontFamily: "Oswald, sans-serif", background: "rgba(0,102,255,0.1)", border: "1px solid rgba(0,102,255,0.3)", color: "#0066ff", letterSpacing: "0.1em" }}>
          Open Shadow Bot →
        </a>
      </div>

      {/* Rarity filter */}
      <div className="flex gap-1.5 flex-wrap">
        {["All", ...RARITY_ORDER].map(r => {
          const rm = RARITY_META[r] ?? { color: "rgba(255,255,255,0.35)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)" };
          const active = rarityFilter === r;
          return (
            <button key={r} onClick={() => setRarityFilter(r)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all"
              style={{
                fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em",
                background: active ? rm.bg : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? rm.color + "88" : "rgba(255,255,255,0.08)"}`,
                color: active ? rm.color : "rgba(255,255,255,0.35)",
              }}>
              {r}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#0066ff" }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(a => {
            const rm = getRarityMeta(a.rarity, false);
            const isUnlocked = a.unlockedCount > 0;
            return (
              <div key={a.key}
                className="relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-default hover:-translate-y-0.5"
                style={{ background: rm.bg, border: `1px solid ${rm.border}` }}>
                <div className="h-1 w-full" style={{ background: rm.color }} />
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest"
                      style={{ fontFamily: "Oswald, sans-serif", color: rm.color, fontSize: "0.55rem", letterSpacing: "0.18em" }}>
                      {a.rarity}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,210,74,0.55)", fontSize: "0.58rem" }}>
                        {a.gamerscore}G
                      </span>
                      {isUnlocked && (
                        <span className="flex items-center gap-0.5 text-xs font-bold"
                          style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.6rem" }}>
                          <Users className="w-2.5 h-2.5" />{a.unlockedCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-3xl leading-none my-1 select-none">{a.icon}</div>

                  <div className="font-black text-sm leading-tight"
                    style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.9)", letterSpacing: "0.02em" }}>
                    {a.name.replace(/^[^\s]+\s/, "")}
                  </div>

                  <div className="text-xs leading-relaxed flex-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {a.description}
                  </div>

                  <div className="text-xs font-mono mt-1" style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.58rem" }}>
                    {a.criteriaValue.toLocaleString()} {BOT_CRITERIA_LABELS[a.criteriaType] ?? ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MASTER-501 TAB ─────────────────────────────────────────────────────────────

type M501AchDef = {
  id: number; key: string; name: string; description: string; icon: string;
  rarity: string; hidden: boolean; priority: number; unlocked_count: number;
};

function Master501Tab({ openAchievementModal }: { openAchievementModal: (a: any) => void }) {
  const { data, loading } = useFetch<M501AchDef[]>("/api/master501/achievement-definitions");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const RARITY_ORDER = ["Mythic", "Legendary", "Epic", "Rare", "Common"];
  const sorted = (data ?? []).slice().sort((a, b) => {
    if (a.hidden !== b.hidden) return a.hidden ? 1 : -1;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });

  const totalGs = (data ?? [])
    .filter(d => !d.hidden)
    .reduce((s, d) => s + (RARITY_META[d.rarity]?.order !== undefined
      ? ({ Mythic: 200, Legendary: 100, Epic: 50, Rare: 25, Common: 10 } as any)[d.rarity] ?? 10
      : 10), 0);
  const unlockedCount = (data ?? []).filter(d => d.unlocked_count > 0).length;
  const counts = data ? {
    Mythic:    data.filter(d => d.rarity === "Mythic"    && !d.hidden).length,
    Legendary: data.filter(d => d.rarity === "Legendary" && !d.hidden).length,
    Epic:      data.filter(d => d.rarity === "Epic"       && !d.hidden).length,
    Rare:      data.filter(d => d.rarity === "Rare"       && !d.hidden).length,
    Common:    data.filter(d => d.rarity === "Common"     && !d.hidden).length,
    Hidden:    data.filter(d => d.hidden).length,
  } : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          {data?.length ?? 0} achievements · {totalGs}G available · {unlockedCount} unlocked
        </p>
        <a href="/master501" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all hover:-translate-y-0.5"
          style={{ fontFamily: "Oswald, sans-serif", background: "rgba(0,200,160,0.1)", border: "1px solid rgba(0,200,160,0.3)", color: "#00c8a0", letterSpacing: "0.1em" }}>
          Open Master-501 →
        </a>
      </div>

      {counts && (
        <div className="flex flex-wrap gap-2">
          {(["Mythic", "Legendary", "Epic", "Rare", "Common", "Hidden"] as const).map(r => {
            const rm = RARITY_META[r];
            return (
              <div key={r} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase"
                style={{ background: `${rm.color}14`, border: `1px solid ${rm.color}44`, color: rm.color, fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", fontSize: "0.6rem" }}>
                {r} ×{counts[r]}
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#00c8a0" }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {sorted.map(a => (
            <AchCard
              key={a.key}
              a={{ ...a, unlockedCount: a.unlocked_count }}
              hovered={hoveredKey === a.key}
              onHover={v => setHoveredKey(v ? a.key : null)}
              onClick={() => openAchievementModal({ ...a, unlockedCount: a.unlocked_count })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── TROPHIES TAB ───────────────────────────────────────────────────────────────

type TourTrophy = {
  id: number; player_name: string; tour_name: string; tier: number;
  emoji: string; slug: string; difficulty: string; awarded_at: string;
};

const TIER_LABEL: Record<number, string> = {
  1: "Amateur", 2: "Club", 3: "County", 4: "Regional", 5: "Pro", 6: "Elite",
};
const TIER_COLORS: Record<number, string> = {
  1: "#9ca3af", 2: "#38bdf8", 3: "#34d399", 4: "#ffd24a", 5: "#f97316", 6: "#ff005c",
};
const DIFF_COLORS: Record<string, string> = {
  amateur: "#9ca3af", club: "#38bdf8", county: "#34d399", pro: "#ffd24a", elite: "#ff005c",
};

function TrophiesTab({ openAchievementModal }: { openAchievementModal: (a: any) => void }) {
  const { data, loading } = useFetch<TourTrophy[]>("/api/tour/all-trophies");

  return (
    <div className="space-y-5">
      <p className="text-sm flex items-center gap-3" style={{ color: "rgba(255,255,255,0.35)" }}>
        {data?.length ?? 0} trophies won{data && data.length > 0 ? ` by ${new Set(data.map(t => t.player_name)).size} player${new Set(data.map(t => t.player_name)).size === 1 ? "" : "s"}` : ""}
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ffd24a" }} />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="text-6xl">🏆</div>
          <div className="text-center">
            <div className="font-black uppercase text-lg" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>
              No Trophies Yet
            </div>
            <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
              Win a tour event to claim the first trophy in league history.
            </div>
          </div>
          <a href="/tour" className="px-5 py-2 rounded-xl text-xs font-black uppercase transition-all hover:-translate-y-0.5"
            style={{ background: "rgba(255,210,74,0.12)", border: "1px solid rgba(255,210,74,0.3)", color: "#ffd24a", fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
            Enter Tour →
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map(t => {
            const tierColor = TIER_COLORS[t.tier] ?? "#9ca3af";
            const diffColor = DIFF_COLORS[t.difficulty] ?? "#9ca3af";
            return (
              <div key={t.id} className="flex items-start gap-4 p-4 rounded-2xl"
                style={{ background: `${tierColor}07`, border: `1px solid ${tierColor}25` }}>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <span className="text-4xl leading-none">{t.emoji}</span>
                  <span className="text-xs font-black uppercase"
                    style={{ fontFamily: "Oswald, sans-serif", color: tierColor, fontSize: "0.5rem", letterSpacing: "0.1em" }}>
                    Tier {t.tier}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black uppercase text-sm leading-tight"
                    style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.9)", letterSpacing: "0.05em" }}>
                    {t.player_name}
                  </div>
                  <div className="text-sm font-bold mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {t.tour_name}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs font-black uppercase px-2 py-0.5 rounded-full"
                      style={{ fontFamily: "Oswald, sans-serif", background: `${diffColor}18`, color: diffColor, border: `1px solid ${diffColor}44`, fontSize: "0.6rem", letterSpacing: "0.1em" }}>
                      {t.difficulty}
                    </span>
                    <span className="text-xs font-black uppercase px-2 py-0.5 rounded-full"
                      style={{ fontFamily: "Oswald, sans-serif", background: `${tierColor}12`, color: tierColor, border: `1px solid ${tierColor}33`, fontSize: "0.6rem", letterSpacing: "0.1em" }}>
                      {TIER_LABEL[t.tier] ?? `Tier ${t.tier}`}
                    </span>
                  </div>
                  <div className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {format(new Date(t.awarded_at), "MMM d, yyyy")}
                  </div>
                </div>
                <Trophy className="w-4 h-4 shrink-0 mt-0.5" style={{ color: tierColor, opacity: 0.7 }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────

const TABS = [
  { key: "league",    label: "League",      icon: <Medal className="w-3.5 h-3.5" />,       color: "#ff005c" },
  { key: "tour",      label: "Tour",        icon: <Star className="w-3.5 h-3.5" />,         color: "#ffd24a" },
  { key: "bot",       label: "Shadow Bot",  icon: <CircuitBoard className="w-3.5 h-3.5" />, color: "#0066ff" },
  { key: "master501", label: "Master-501",  icon: <span className="text-xs">🎯</span>,      color: "#00c8a0" },
  { key: "trophies",  label: "Trophies",    icon: <Trophy className="w-3.5 h-3.5" />,       color: "#a855f7" },
] as const;
type TabKey = typeof TABS[number]["key"];

export default function Achievements() {
  const [tab, setTab] = useState<TabKey>("league");
  const { selectedAchievement, isModalOpen, openAchievementModal, closeAchievementModal } =
    useAchievementModal();

  const active = TABS.find(t => t.key === tab)!;

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />

      <div>
        <h1 className="text-4xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
          Achievement Centre
        </h1>
        <p className="text-xs mt-1 uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.14em" }}>
          League · Tour · Shadow Bot · Trophies
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => {
          const isActive = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all"
              style={{
                fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em",
                background: isActive ? `${t.color}18` : "rgba(255,255,255,0.04)",
                border: `1px solid ${isActive ? `${t.color}55` : "rgba(255,255,255,0.08)"}`,
                color: isActive ? t.color : "rgba(255,255,255,0.35)",
                borderBottom: isActive ? `2px solid ${t.color}` : undefined,
              }}>
              <span style={{ color: isActive ? t.color : "rgba(255,255,255,0.25)" }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "league"    && <LeagueTab openAchievementModal={openAchievementModal} />}
      {tab === "tour"      && <TourTab openAchievementModal={openAchievementModal} />}
      {tab === "bot"       && <BotTab openAchievementModal={openAchievementModal} />}
      {tab === "master501" && <Master501Tab openAchievementModal={openAchievementModal} />}
      {tab === "trophies"  && <TrophiesTab openAchievementModal={openAchievementModal} />}

      <AchievementRewardModal
        achievement={selectedAchievement}
        isOpen={isModalOpen}
        onClose={closeAchievementModal}
      />
    </div>
  );
}
