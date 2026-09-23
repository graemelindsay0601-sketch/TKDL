import { Link } from "wouter";
import { Pin, X } from "lucide-react";
import { trophyCaseStyle, type CosmeticDefinition } from "@/lib/cosmetics";

export type PinEntry = { system: string; key: string; name?: string; icon?: string; rarity?: string | null };

const RARITY_COL: Record<string, string> = {
  Common: "#9ca3af", Rare: "#3b82f6", Epic: "#a855f7", Legendary: "#ffd24a", Mythic: "#ff005c",
};

interface TrophyCaseProps {
  pins: PinEntry[];
  /** Show each pin's remove (X) button and the "pin some achievements" empty-state CTA.
   *  True only when the viewer is looking at their own trophy case (account.tsx always;
   *  player-detail.tsx only when isOwnProfile). */
  editable: boolean;
  onTogglePin?: (system: string, key: string, display: { name: string; icon: string; rarity: string | null }) => void;
  /** TROPHY_CASE_STYLE cosmetic — background/border skin. Falls back to the
   *  existing gold/pink gradient when nothing's equipped. */
  styleCosmetic?: CosmeticDefinition | null;
  /** Tail of the empty-state hint sentence — "Pin up to 5 achievements below
   *  to build your trophy case — {emptyHintSuffix}" */
  emptyHintSuffix?: string;
  pinLimit?: number;
}

// Shared "Trophy Highlights" strip — previously duplicated inline (and
// slightly inconsistently: only player-detail linked each pin through to
// its achievement detail page) across player-detail/index.tsx and
// account.tsx. Extracted so both pages (and any future surface) render
// identically and can share the TROPHY_CASE_STYLE cosmetic skin below.
export function TrophyCase({ pins, editable, onTogglePin, styleCosmetic, emptyHintSuffix = "it shows on your profile too.", pinLimit = 5 }: TrophyCaseProps) {
  const skin = trophyCaseStyle(styleCosmetic);

  if (pins.length === 0) {
    if (!editable) return null;
    return (
      <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-xs"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }}>
        <Pin className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
        Pin up to {pinLimit} achievements below to build your trophy case — {emptyHintSuffix}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap mb-3 px-3 py-2.5 rounded-xl"
      style={{
        background: "linear-gradient(120deg, rgba(255,210,74,0.07), rgba(255,0,92,0.03))",
        border: "1px solid rgba(255,210,74,0.2)",
        ...skin,
      }}>
      <Pin className="w-3.5 h-3.5 shrink-0" style={{ color: "#ffd24a" }} />
      {pins.map(p => {
        const rc = RARITY_COL[p.rarity ?? "Common"] ?? RARITY_COL.Common;
        return (
          <div key={`${p.system}-${p.key}`}
            className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg"
            style={{ background: `${rc}1c`, border: `1px solid ${rc}40` }}>
            <Link href={`/achievements/${p.system}/${p.key}`} className="flex items-center gap-1.5">
              <span className="text-sm leading-none">{p.icon}</span>
              <span className="font-black text-xs uppercase" style={{ fontFamily: "Oswald, sans-serif", color: rc, letterSpacing: "0.02em" }}>
                {p.name}
              </span>
            </Link>
            {editable && onTogglePin && (
              <button
                onClick={() => onTogglePin(p.system, p.key, { name: p.name ?? "", icon: p.icon ?? "🏆", rarity: p.rarity ?? null })}
                title="Remove from trophy case"
                className="p-0.5 rounded transition-colors hover:bg-white/10">
                <X className="w-2.5 h-2.5" style={{ color: "rgba(255,255,255,0.35)" }} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
