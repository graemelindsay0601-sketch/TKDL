import { useEffect, useState, useCallback, useMemo } from "react";
import { Coins, Check, Lock, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useCosmeticsCatalog, nameStyleCSS, nameStyleClassName, bannerCSS, frameStyle, glowRowStyle, resultThemeColor, bubbleColorStyle, leaderboardTagStyle, taglineStyleCSS, postAccentStyle, stickerEmoji, checkoutEffect, scorerThemeColor, playerCardFinish, trophyCaseStyle, recapStyleCSS, rankUpEffect, accountAccentColor, RARITY_COLORS, PROFILE_ICON_MAP, AVATAR_BADGE_MAP,
  type CosmeticDefinition,
} from "@/lib/cosmetics";

type CosmeticCategory = "NAME_STYLE" | "PROFILE_ICON" | "BANNER" | "FRAME" | "GLOW" | "RESULT_THEME" | "BUBBLE_COLOR" | "AVATAR_BADGE" | "LEADERBOARD_TAG" | "TAGLINE_STYLE" | "POST_ACCENT" | "STICKER" | "CHECKOUT_EFFECT" | "SCORER_THEME" | "PLAYER_CARD_FINISH" | "TROPHY_CASE_STYLE" | "RECAP_STYLE" | "RANK_UP_EFFECT" | "ACCOUNT_ACCENT";
type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

interface CosmeticsShopProps {
  playerId: number;
  playerName: string;
}

interface OwnedState {
  ownedIds: string[];
  equippedNameStyleId: string | null;
  equippedProfileIconId: string | null;
  equippedBannerId: string | null;
  equippedFrameId: string | null;
  equippedGlowId: string | null;
  equippedResultThemeId: string | null;
  equippedBubbleColorId: string | null;
  equippedAvatarBadgeId: string | null;
  equippedLeaderboardTagId: string | null;
  equippedTaglineStyleId: string | null;
  equippedPostAccentId: string | null;
  equippedCheckoutEffectId: string | null;
  equippedScorerThemeId: string | null;
  equippedPlayerCardFinishId: string | null;
  equippedTrophyCaseStyleId: string | null;
  equippedRecapStyleId: string | null;
  equippedRankUpEffectId: string | null;
  equippedAccountAccentId: string | null;
}

// Tab order + copy for each category — the catalog grew to ~165 items across
// these 13 categories (see cosmetics-service.ts), which made the old
// "stack every category's full grid on one long page" layout a lot of
// scrolling to find any one thing. Now only the active tab's items render,
// and the toolbar below the tabs (rarity / owned / affordability / search)
// narrows that further within a category.
const CATEGORY_META: Record<CosmeticCategory, { tabLabel: string; title: string; subtitle: string; equippable?: boolean }> = {
  NAME_STYLE: {
    tabLabel: "Name", title: "Name Styles",
    subtitle: "Recolour your name wherever it's shown — your account page and your profile, as others see it. The gold & red League Champion style isn't for sale — it's awarded to whoever wins the Singles season.",
  },
  PROFILE_ICON: { tabLabel: "Icon", title: "Profile Icons", subtitle: "Swap the icon shown on your account page." },
  BANNER: { tabLabel: "Banner", title: "Profile Banners", subtitle: "Background behind your name & stats at the top of your account page." },
  FRAME: { tabLabel: "Frame", title: "Avatar Frames", subtitle: "Border & glow around your avatar square." },
  GLOW: { tabLabel: "Row Glow", title: "Leaderboard Row Glow", subtitle: "Highlight colour on your own row on the leaderboard — and now Boss Battle's ladder too." },
  RESULT_THEME: { tabLabel: "Result", title: "Result Screen Themes", subtitle: "Accent colour on your own Practice, Master 501, Tour and real-match result screens." },
  BUBBLE_COLOR: { tabLabel: "Bubble", title: "Message Bubble Colour", subtitle: "Tint on your own sent messages in your account-page DMs." },
  AVATAR_BADGE: { tabLabel: "Badge", title: "Avatar Badges", subtitle: "A small sticker pinned to the corner of your avatar square — stacks with your icon & frame." },
  LEADERBOARD_TAG: { tabLabel: "Tag", title: "Leaderboard Tags", subtitle: "A flair chip next to your name on the leaderboard — the one cosmetic everyone scanning the standings sees." },
  TAGLINE_STYLE: { tabLabel: "Tagline", title: "Tagline Styles", subtitle: "Colour treatment for your tagline — the short line under your name, shown on your account page and your public profile." },
  POST_ACCENT: { tabLabel: "Post", title: "Community Post Accent", subtitle: "Border & background tint on your own posts in the Community feed — probably the most-seen cosmetic in the shop." },
  STICKER: { tabLabel: "Sticker", title: "Chat Stickers", subtitle: "Attach one to a DM instead of (or alongside) a message — pick from your owned stickers in the composer.", equippable: false },
  CHECKOUT_EFFECT: { tabLabel: "Effect", title: "Checkout Celebration Effects", subtitle: "A particle-burst animation on your own Practice or real-match result screen when you win." },
  SCORER_THEME: { tabLabel: "Scorer", title: "Scorer Themes", subtitle: "Accent colour on your own live scoring screen, across every Practice mode." },
  PLAYER_CARD_FINISH: { tabLabel: "Finish", title: "Player Card Finishes", subtitle: "A texture overlay on your player-detail hero — layers on top of whatever banner you've got equipped." },
  TROPHY_CASE_STYLE: { tabLabel: "Trophy", title: "Trophy Case Styles", subtitle: "A background & border skin for your pinned Trophy Case strip, on your account page and your public profile." },
  RECAP_STYLE: { tabLabel: "Recap", title: "Season Recap Styles", subtitle: "A background skin for your Season Recap Card — browsable from your Season History." },
  RANK_UP_EFFECT: { tabLabel: "Rank Up", title: "Rank-Up Celebrations", subtitle: "A particle-burst animation on your real-match result screen when a win moves you up the leaderboard." },
  ACCOUNT_ACCENT: { tabLabel: "Accent", title: "Account Page Accent", subtitle: "A swatch colour for buttons & highlights on your own account page only — nobody else sees this, not on your profile, not on the leaderboard." },
};

const CATEGORY_ORDER: CosmeticCategory[] = [
  "NAME_STYLE", "PROFILE_ICON", "BANNER", "FRAME", "GLOW", "RESULT_THEME", "BUBBLE_COLOR",
  "AVATAR_BADGE", "LEADERBOARD_TAG", "TAGLINE_STYLE", "POST_ACCENT", "STICKER", "CHECKOUT_EFFECT",
  "SCORER_THEME", "PLAYER_CARD_FINISH", "TROPHY_CASE_STYLE", "RECAP_STYLE", "RANK_UP_EFFECT", "ACCOUNT_ACCENT",
];

const RARITY_ORDER: Rarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY"];

const EQUIPPED_ID_KEY: Partial<Record<CosmeticCategory, keyof OwnedState>> = {
  NAME_STYLE: "equippedNameStyleId",
  PROFILE_ICON: "equippedProfileIconId",
  BANNER: "equippedBannerId",
  FRAME: "equippedFrameId",
  GLOW: "equippedGlowId",
  RESULT_THEME: "equippedResultThemeId",
  BUBBLE_COLOR: "equippedBubbleColorId",
  AVATAR_BADGE: "equippedAvatarBadgeId",
  LEADERBOARD_TAG: "equippedLeaderboardTagId",
  TAGLINE_STYLE: "equippedTaglineStyleId",
  POST_ACCENT: "equippedPostAccentId",
  CHECKOUT_EFFECT: "equippedCheckoutEffectId",
  SCORER_THEME: "equippedScorerThemeId",
  PLAYER_CARD_FINISH: "equippedPlayerCardFinishId",
  TROPHY_CASE_STYLE: "equippedTrophyCaseStyleId",
  RECAP_STYLE: "equippedRecapStyleId",
  RANK_UP_EFFECT: "equippedRankUpEffectId",
  ACCOUNT_ACCENT: "equippedAccountAccentId",
  // STICKER deliberately omitted — not equipped to a slot, see the shop
  // section above (equippable={false}) and schema/cosmetics.ts.
};

export function CosmeticsShop({ playerId, playerName }: CosmeticsShopProps) {
  const { toast } = useToast();
  const catalog = useCosmeticsCatalog();
  const [owned, setOwned] = useState<OwnedState | null>(null);
  const [coins, setCoins] = useState<number>(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<CosmeticCategory>("NAME_STYLE");
  const [rarityFilter, setRarityFilter] = useState<"ALL" | Rarity>("ALL");
  const [ownedFilter, setOwnedFilter] = useState<"ALL" | "OWNED" | "UNOWNED">("ALL");
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">("default");
  const [search, setSearch] = useState("");

  const refresh = useCallback(() => {
    fetch(`/api/players/${playerId}/cosmetics`)
      .then(r => (r.ok ? r.json() : null))
      .then(setOwned)
      .catch(() => {});
    // Reuses the same balance endpoint CoinBalance.tsx already reads —
    // one shared coin balance, this is just a second place to spend it.
    fetch(`/api/card-clash/shop/currency/${playerId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => setCoins(data?.cardPoints ?? 0))
      .catch(() => {});
  }, [playerId]);

  useEffect(() => { refresh(); }, [refresh]);

  const isOwned = useCallback((id: string) => owned?.ownedIds.includes(id) ?? false, [owned]);

  // Per-tab owned/total counts, shown as a small badge on each tab so you
  // can tell at a glance which categories still have unclaimed items
  // without switching to each one.
  const countsByCategory = useMemo(() => {
    const counts: Partial<Record<CosmeticCategory, { owned: number; total: number }>> = {};
    for (const cat of CATEGORY_ORDER) {
      const items = catalog.filter(c => c.category === cat);
      counts[cat] = { owned: items.filter(c => isOwned(c.id)).length, total: items.length };
    }
    return counts;
  }, [catalog, isOwned]);

  const visibleItems = useMemo(() => {
    let items = catalog.filter(c => c.category === activeCategory);
    if (rarityFilter !== "ALL") items = items.filter(c => c.rarity === rarityFilter);
    if (ownedFilter !== "ALL") items = items.filter(c => (ownedFilter === "OWNED") === isOwned(c.id));
    if (affordableOnly) items = items.filter(c => isOwned(c.id) || !c.purchasable || coins >= c.price);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(c => c.name.toLowerCase().includes(q));
    }
    const sorted = [...items];
    if (sortBy === "price-asc") sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === "price-desc") sorted.sort((a, b) => b.price - a.price);
    else sorted.sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted;
  }, [catalog, activeCategory, rarityFilter, ownedFilter, affordableOnly, search, sortBy, isOwned, coins]);

  const filtersActive = rarityFilter !== "ALL" || ownedFilter !== "ALL" || affordableOnly || search.trim() !== "" || sortBy !== "default";
  const clearFilters = () => {
    setRarityFilter("ALL"); setOwnedFilter("ALL"); setAffordableOnly(false); setSearch(""); setSortBy("default");
  };

  const purchase = async (cosmetic: CosmeticDefinition) => {
    setBusyId(cosmetic.id);
    try {
      const res = await fetch(`/api/players/${playerId}/cosmetics/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cosmeticId: cosmetic.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Couldn't buy that", description: data.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      toast({ title: `${cosmetic.name} unlocked ✓`, description: "Equip it below whenever you like." });
      refresh();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const equip = async (category: CosmeticCategory, cosmeticId: string | null) => {
    setBusyId(cosmeticId ?? `unequip-${category}`);
    try {
      const res = await fetch(`/api/players/${playerId}/cosmetics/equip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category, cosmeticId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Couldn't equip that", description: data.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      toast({ title: cosmeticId ? "Equipped ✓" : "Cleared" });
      refresh();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  // Preview renderers, keyed by category — built here (not as a static
  // table) because NAME_STYLE/TAGLINE_STYLE's preview closes over
  // `playerName`. Cheap to rebuild each render; nothing here is expensive.
  const renderPreview = (c: CosmeticDefinition): React.ReactNode => {
    switch (c.category) {
      case "NAME_STYLE":
        return (
          <div className={nameStyleClassName(c)} style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 900, letterSpacing: "0.02em", ...nameStyleCSS(c) }}>
            {playerName || "Your Name"}
          </div>
        );
      case "PROFILE_ICON": {
        const Icon = (c.iconKey && PROFILE_ICON_MAP[c.iconKey]) || null;
        return Icon ? <Icon className="w-6 h-6" style={{ color: RARITY_COLORS[c.rarity] }} /> : null;
      }
      case "BANNER":
        return <div style={{ width: "100%", height: "32px", borderRadius: "6px", ...bannerCSS(c) }} />;
      case "FRAME":
        return <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#15151f", ...frameStyle(c) }} />;
      case "GLOW":
        return <div style={{ width: "100%", height: "24px", borderRadius: "6px", background: "#15151f", ...glowRowStyle(c) }} />;
      case "RESULT_THEME":
        return (
          <div style={{
            width: "24px", height: "24px", borderRadius: "50%",
            background: resultThemeColor(c, "#a78bfa"), boxShadow: `0 0 10px ${resultThemeColor(c, "#a78bfa")}88`,
          }} />
        );
      case "BUBBLE_COLOR":
        return (
          <div style={{
            padding: "4px 10px", borderRadius: "10px", fontSize: "0.6rem", fontFamily: "Oswald, sans-serif", color: "#fff",
            background: "rgba(255,0,92,0.2)", border: "1px solid rgba(255,0,92,0.35)", ...bubbleColorStyle(c),
          }}>
            Hey!
          </div>
        );
      case "AVATAR_BADGE": {
        const Icon = (c.iconKey && AVATAR_BADGE_MAP[c.iconKey]) || null;
        return Icon ? (
          <div style={{
            width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: `${c.color ?? "#fff"}22`, border: `1.5px solid ${c.color ?? "#fff"}77`,
          }}>
            <Icon className="w-3.5 h-3.5" style={{ color: c.color ?? "#fff" }} />
          </div>
        ) : null;
      }
      case "LEADERBOARD_TAG":
        return (
          <div style={{
            padding: "3px 9px", borderRadius: "999px", fontSize: "0.6rem", fontWeight: 800,
            fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em", ...leaderboardTagStyle(c),
          }}>
            {c.name}
          </div>
        );
      case "TAGLINE_STYLE":
        return (
          <div className={nameStyleClassName(c)} style={{
            fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", fontWeight: 700, fontStyle: "italic",
            letterSpacing: "0.02em", ...taglineStyleCSS(c),
          }}>
            "Sample tagline"
          </div>
        );
      case "POST_ACCENT":
        return <div style={{ width: "100%", height: "24px", borderRadius: "6px", background: "rgba(255,255,255,0.02)", ...postAccentStyle(c) }} />;
      case "STICKER":
        return <div style={{ fontSize: "1.5rem", lineHeight: 1 }}>{stickerEmoji(c)}</div>;
      case "CHECKOUT_EFFECT": {
        const effect = checkoutEffect(c);
        return effect ? <div style={{ fontSize: "1.4rem", lineHeight: 1, filter: `drop-shadow(0 0 6px ${effect.color}99)` }}>{effect.emoji}</div> : null;
      }
      case "SCORER_THEME":
        return (
          <div style={{
            width: "100%", height: "24px", borderRadius: "6px",
            background: `${scorerThemeColor(c, "#a78bfa")}1a`, border: `1.5px solid ${scorerThemeColor(c, "#a78bfa")}`,
            boxShadow: `0 0 10px ${scorerThemeColor(c, "#a78bfa")}66`,
          }} />
        );
      case "PLAYER_CARD_FINISH": {
        const finish = playerCardFinish(c);
        return finish ? (
          <div style={{
            width: "100%", height: "24px", borderRadius: "6px",
            background: `linear-gradient(120deg, ${finish.color}33, transparent 40%, ${finish.color}55 70%, transparent)`,
            border: `1px solid ${finish.color}66`,
          }} />
        ) : null;
      }
      case "TROPHY_CASE_STYLE":
        return (
          <div style={{
            width: "100%", height: "24px", borderRadius: "8px",
            display: "flex", alignItems: "center", padding: "0 8px",
            ...trophyCaseStyle(c),
          }}>
            <span style={{ fontSize: "0.9rem", lineHeight: 1 }}>🏆</span>
          </div>
        );
      case "RECAP_STYLE":
        return (
          <div style={{
            width: "100%", height: "32px", borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.1)",
            ...recapStyleCSS(c),
          }} />
        );
      case "RANK_UP_EFFECT": {
        const effect = rankUpEffect(c);
        return <div style={{ fontSize: "1.4rem", lineHeight: 1, filter: `drop-shadow(0 0 6px ${effect.color}99)` }}>{effect.emoji}</div>;
      }
      case "ACCOUNT_ACCENT":
        return <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: accountAccentColor(c, "#a78bfa"), boxShadow: `0 0 8px ${accountAccentColor(c, "#a78bfa")}77` }} />;
      default:
        return null;
    }
  };

  const meta = CATEGORY_META[activeCategory];
  const equippedKey = EQUIPPED_ID_KEY[activeCategory];
  const equippedId = owned && equippedKey ? (owned[equippedKey] as string | null) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        background: "rgba(255,212,74,0.1)", border: "1px solid rgba(255,212,74,0.3)",
        borderRadius: "0.5rem", padding: "0.75rem 1rem",
      }}>
        <Coins size={20} style={{ color: "#ffd24a" }} />
        <div>
          <div style={{ fontSize: "0.8rem", color: "rgba(255,212,74,0.7)" }}>Coins</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#ffd24a" }}>{coins}</div>
        </div>
      </div>

      {/* Category tabs — replaces the old "every category stacked on one
          long page" layout. Each tab shows an owned/total count so you can
          spot which categories still have something left to unlock. */}
      <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
        {CATEGORY_ORDER.map(cat => {
          const active = cat === activeCategory;
          const counts = countsByCategory[cat];
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px",
                fontFamily: "Oswald, sans-serif", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.04em",
                textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer",
                padding: "7px 12px", borderRadius: "999px",
                background: active ? "rgba(255,212,74,0.14)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${active ? "rgba(255,212,74,0.4)" : "rgba(255,255,255,0.08)"}`,
                color: active ? "#ffd24a" : "rgba(255,255,255,0.55)",
              }}
            >
              {CATEGORY_META[cat].tabLabel}
              {counts && (
                <span style={{
                  fontSize: "0.58rem", fontWeight: 700, padding: "1px 5px", borderRadius: "999px",
                  background: active ? "rgba(255,212,74,0.18)" : "rgba(255,255,255,0.06)",
                  color: active ? "#ffd24a" : "rgba(255,255,255,0.4)",
                }}>
                  {counts.owned}/{counts.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active category header */}
      <div>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", fontWeight: 800,
          letterSpacing: "0.06em", color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
          {meta.title}
        </div>
        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>
          {meta.subtitle}
        </div>
      </div>

      {/* Filter/sort toolbar */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          <div style={{ position: "relative" }}>
            <Search className="w-3.5 h-3.5" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search this category…"
              style={{
                fontSize: "0.72rem", fontFamily: "Oswald, sans-serif", color: "#fff",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px", padding: "6px 10px 6px 26px", width: "180px",
              }}
            />
          </div>

          <select
            value={ownedFilter}
            onChange={e => setOwnedFilter(e.target.value as typeof ownedFilter)}
            style={{
              fontSize: "0.68rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.7)",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px", padding: "6px 8px", cursor: "pointer",
            }}
          >
            <option value="ALL">All items</option>
            <option value="OWNED">Owned only</option>
            <option value="UNOWNED">Not owned</option>
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={{
              fontSize: "0.68rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.7)",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px", padding: "6px 8px", cursor: "pointer",
            }}
          >
            <option value="default">Default order</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>

          <button
            onClick={() => setAffordableOnly(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              fontSize: "0.68rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, letterSpacing: "0.02em",
              cursor: "pointer", padding: "6px 10px", borderRadius: "8px",
              background: affordableOnly ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${affordableOnly ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.1)"}`,
              color: affordableOnly ? "#22c55e" : "rgba(255,255,255,0.55)",
            }}
          >
            <Coins className="w-3 h-3" /> I can afford
          </button>

          {filtersActive && (
            <button
              onClick={clearFilters}
              style={{
                display: "flex", alignItems: "center", gap: "3px",
                fontSize: "0.65rem", fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)",
                background: "transparent", border: "none", cursor: "pointer", padding: "6px 4px",
              }}
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>

        {/* Rarity chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          <button
            onClick={() => setRarityFilter("ALL")}
            style={{
              fontSize: "0.62rem", fontFamily: "Oswald, sans-serif", fontWeight: 800, letterSpacing: "0.06em",
              padding: "4px 10px", borderRadius: "999px", cursor: "pointer",
              background: rarityFilter === "ALL" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${rarityFilter === "ALL" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}`,
              color: rarityFilter === "ALL" ? "#fff" : "rgba(255,255,255,0.45)",
            }}
          >
            ALL RARITIES
          </button>
          {RARITY_ORDER.map(r => {
            const rColor = RARITY_COLORS[r];
            const active = rarityFilter === r;
            return (
              <button
                key={r}
                onClick={() => setRarityFilter(active ? "ALL" : r)}
                style={{
                  fontSize: "0.62rem", fontFamily: "Oswald, sans-serif", fontWeight: 800, letterSpacing: "0.06em",
                  padding: "4px 10px", borderRadius: "999px", cursor: "pointer",
                  background: active ? `${rColor}22` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? rColor : "rgba(255,255,255,0.08)"}`,
                  color: active ? rColor : "rgba(255,255,255,0.45)",
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {meta.equippable !== false && equippedId && (
        <button
          onClick={() => equip(activeCategory, null)}
          disabled={busyId !== null}
          style={{
            alignSelf: "flex-start",
            fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", padding: "3px 8px",
            cursor: "pointer", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em",
          }}
        >
          Clear equipped
        </button>
      )}

      {visibleItems.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "28px 12px", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)",
          fontFamily: "Oswald, sans-serif", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "10px",
        }}>
          Nothing matches these filters.{" "}
          <button onClick={clearFilters} style={{ color: "#ffd24a", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", fontSize: "inherit" }}>
            Clear them
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px" }}>
          {visibleItems.map(c => {
            const itemOwned  = isOwned(c.id);
            const isEquipped = meta.equippable !== false && equippedId === c.id;
            const canAfford  = coins >= c.price;
            const isBusy     = busyId === c.id;
            const rColor     = RARITY_COLORS[c.rarity] ?? "#9ca3af";

            return (
              <div key={c.id} style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${isEquipped ? rColor : "rgba(255,255,255,0.08)"}`,
                borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "32px" }}>
                  {renderPreview(c)}
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: "0.58rem", color: rColor, fontWeight: 700, letterSpacing: "0.08em", marginTop: "1px" }}>
                    {c.rarity}
                  </div>
                </div>

                {meta.equippable === false && itemOwned ? (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                    fontSize: "0.65rem", color: rColor, fontWeight: 700, fontFamily: "Oswald, sans-serif", padding: "4px 0",
                  }}>
                    <Check className="w-3 h-3" /> Owned
                  </div>
                ) : isEquipped ? (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                    fontSize: "0.65rem", color: rColor, fontWeight: 700, fontFamily: "Oswald, sans-serif", padding: "4px 0",
                  }}>
                    <Check className="w-3 h-3" /> Equipped
                  </div>
                ) : itemOwned ? (
                  <button
                    onClick={() => equip(activeCategory, c.id)}
                    disabled={isBusy}
                    style={{
                      fontSize: "0.65rem", fontWeight: 700, fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em",
                      color: "#fff", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "6px", padding: "5px 0", cursor: isBusy ? "default" : "pointer", opacity: isBusy ? 0.6 : 1,
                    }}
                  >
                    Equip
                  </button>
                ) : !c.purchasable ? (
                  <div
                    title="Awarded automatically — not for sale"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                      fontSize: "0.6rem", fontWeight: 700, fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em",
                      color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.02)",
                      border: "1px dashed rgba(255,255,255,0.12)", borderRadius: "6px", padding: "5px 0",
                    }}
                  >
                    <Lock className="w-3 h-3" /> Exclusive
                  </div>
                ) : (
                  <button
                    onClick={() => canAfford && purchase(c)}
                    disabled={isBusy || !canAfford}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                      fontSize: "0.65rem", fontWeight: 700, fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em",
                      color: canAfford ? "#ffd24a" : "rgba(255,255,255,0.3)",
                      background: canAfford ? "rgba(255,212,74,0.1)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${canAfford ? "rgba(255,212,74,0.3)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: "6px", padding: "5px 0",
                      cursor: isBusy || !canAfford ? "default" : "pointer", opacity: isBusy ? 0.6 : 1,
                    }}
                  >
                    {canAfford ? <Coins className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    {c.price}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
