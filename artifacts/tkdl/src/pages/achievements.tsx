import { useListAchievements } from "@workspace/api-client-react";
import { useState } from "react";
import { Trophy, Lock } from "lucide-react";

const RARITIES = ["All", "Common", "Rare", "Epic", "Legendary", "Mythic"] as const;
const CATEGORIES = ["All", "Career", "Seasonal", "Tier", "Hidden"] as const;

function rarityClass(rarity: string) {
  switch (rarity.toLowerCase()) {
    case "common":    return "rarity-common";
    case "rare":      return "rarity-rare";
    case "epic":      return "rarity-epic";
    case "legendary": return "rarity-legendary";
    case "mythic":    return "rarity-mythic";
    case "hidden":    return "rarity-hidden";
    default:          return "rarity-common";
  }
}

function rarityGlow(rarity: string): string {
  switch (rarity.toLowerCase()) {
    case "legendary": return "0 0 20px rgba(255,210,74,0.12)";
    case "mythic":    return "0 0 20px rgba(255,0,92,0.15)";
    case "epic":      return "0 0 16px rgba(192,132,252,0.1)";
    default:          return "none";
  }
}

export default function Achievements() {
  const { data: achievements, isLoading } = useListAchievements();
  const [rarityFilter, setRarityFilter] = useState<string>("All");
  const [catFilter, setCatFilter] = useState<string>("All");

  const filtered = achievements?.filter(a => {
    const rMatch = rarityFilter === "All" || a.rarity.toLowerCase() === rarityFilter.toLowerCase();
    const cMatch = catFilter === "All" || (a as any).category?.toLowerCase() === catFilter.toLowerCase();
    return rMatch && cMatch;
  }) ?? [];

  const counts = achievements ? {
    common:    achievements.filter(a => a.rarity === "Common").length,
    rare:      achievements.filter(a => a.rarity === "Rare").length,
    epic:      achievements.filter(a => a.rarity === "Epic").length,
    legendary: achievements.filter(a => a.rarity === "Legendary").length,
    mythic:    achievements.filter(a => a.rarity === "Mythic").length,
  } : null;

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />
      <div>
        <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
          Achievement Catalogue
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
          {achievements?.length ?? 0} achievements · Earn them all
        </p>
      </div>

      {/* Rarity counts */}
      {counts && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Common",    count: counts.common,    cls: "rarity-common"    },
            { label: "Rare",      count: counts.rare,      cls: "rarity-rare"      },
            { label: "Epic",      count: counts.epic,      cls: "rarity-epic"      },
            { label: "Legendary", count: counts.legendary, cls: "rarity-legendary" },
            { label: "Mythic",    count: counts.mythic,    cls: "rarity-mythic"    },
          ].map(r => (
            <div key={r.label} className={`aura-badge ${r.cls}`}>
              {r.label} ×{r.count}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {RARITIES.map(r => (
          <button
            key={r}
            onClick={() => setRarityFilter(r)}
            className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all"
            style={{
              fontFamily: "Oswald, sans-serif",
              letterSpacing: "0.1em",
              background: rarityFilter === r ? "rgba(255,0,92,0.15)" : "rgba(255,255,255,0.04)",
              borderColor: rarityFilter === r ? "#ff005c" : "rgba(255,255,255,0.1)",
              border: "1px solid",
              color: rarityFilter === r ? "#ff005c" : "rgba(255,255,255,0.4)",
            }}
          >
            {r}
          </button>
        ))}
        <div className="w-px bg-white/10 mx-1" />
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all"
            style={{
              fontFamily: "Oswald, sans-serif",
              letterSpacing: "0.1em",
              background: catFilter === c ? "rgba(0,102,255,0.15)" : "rgba(255,255,255,0.04)",
              borderColor: catFilter === c ? "#0066ff" : "rgba(255,255,255,0.1)",
              border: "1px solid",
              color: catFilter === c ? "#0066ff" : "rgba(255,255,255,0.4)",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(achievement => {
            const isHidden = achievement.rarity === "Hidden" || (achievement as any).hidden;
            return (
              <div
                key={achievement.id}
                className="pdc-card p-4 flex flex-col gap-2 transition-all hover:-translate-y-0.5"
                style={{
                  boxShadow: rarityGlow(achievement.rarity),
                  borderColor: achievement.rarity === "Legendary"
                    ? "rgba(255,210,74,0.2)"
                    : achievement.rarity === "Mythic"
                    ? "rgba(255,0,92,0.2)"
                    : undefined,
                  opacity: isHidden ? 0.75 : 1,
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className={`aura-badge ${rarityClass(achievement.rarity)}`}>
                    {achievement.rarity}
                  </span>
                  {isHidden && <Lock className="w-3 h-3" style={{ color: "rgba(255,255,255,0.25)" }} />}
                </div>

                {/* Icon */}
                <div className="text-3xl leading-none my-1">
                  {isHidden ? "❓" : (achievement.icon || <Trophy className="w-7 h-7 opacity-40" />)}
                </div>

                {/* Name */}
                <div className="font-bold text-sm leading-snug" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.9)", letterSpacing: "0.02em" }}>
                  {isHidden ? "???" : achievement.name}
                </div>

                {/* Description */}
                <div className="text-xs leading-relaxed flex-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {isHidden ? "Complete hidden objective to unlock." : achievement.description}
                </div>

                {/* Threshold */}
                {!isHidden && (achievement as any).threshold != null && (
                  <div className="pt-2 mt-auto border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Req: {(achievement as any).threshold}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No achievements match this filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
