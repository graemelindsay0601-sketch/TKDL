import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Flame, Zap, Skull, Crown, Trophy, Rocket, Ghost, Gem, Star, Shield, Swords, Heart, Medal, BadgeCheck, ThumbsUp, PartyPopper, Target, Beer, Award, Sparkles, Anchor, type LucideIcon } from "lucide-react";

export interface CosmeticDefinition {
  id: string;
  category: "NAME_STYLE" | "PROFILE_ICON" | "BANNER" | "FRAME" | "GLOW" | "RESULT_THEME" | "BUBBLE_COLOR" | "AVATAR_BADGE" | "LEADERBOARD_TAG" | "TAGLINE_STYLE" | "POST_ACCENT" | "STICKER" | "CHECKOUT_EFFECT" | "SCORER_THEME" | "PLAYER_CARD_FINISH" | "TROPHY_CASE_STYLE" | "RECAP_STYLE" | "RANK_UP_EFFECT";
  name: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  price: number;
  color: string | null;
  gradient: string | null;
  glow: string | null;
  iconKey: string | null;
  enabled: boolean;
  purchasable: boolean;
  sortOrder: number;
}

// Whitelisted icon keys a PROFILE_ICON cosmetic can reference — the server
// only ever stores one of these short keys (see cosmetics-service.ts's
// seed), never markup or a URL, so an unrecognised key just falls back to
// the default rather than rendering nothing.
export const PROFILE_ICON_MAP: Record<string, LucideIcon> = {
  flame: Flame, zap: Zap, skull: Skull, crown: Crown,
  trophy: Trophy, rocket: Rocket, ghost: Ghost, gem: Gem,
  star: Star, shield: Shield, swords: Swords,
  target: Target, beer: Beer, award: Award, sparkles: Sparkles, anchor: Anchor,
};

// Whitelisted icon keys an AVATAR_BADGE cosmetic can reference — a separate
// map from PROFILE_ICON_MAP (different glyphs, different meaning) so a
// player equipping both a profile icon and a corner badge doesn't end up
// with two copies of the same symbol on one avatar.
export const AVATAR_BADGE_MAP: Record<string, LucideIcon> = {
  heart: Heart, medal: Medal, verified: BadgeCheck, thumbsup: ThumbsUp, party: PartyPopper, fire: Flame,
  star: Star, bolt: Zap, target: Target, crown: Crown, skull: Skull,
};

// A CHECKOUT_EFFECT cosmetic's iconKey picks which particle-burst animation
// plays — the emoji is the particle itself (rendered directly as text, same
// reasoning as STICKER below), the label is shown nowhere but here for
// documentation. See practice.tsx's <CheckoutBurst>.
export const CHECKOUT_EFFECT_MAP: Record<string, { emoji: string; label: string }> = {
  confetti:  { emoji: "🎉", label: "Confetti" },
  fireworks: { emoji: "✨", label: "Fireworks" },
  shockwave: { emoji: "💥", label: "Shockwave" },
  goldrain:  { emoji: "⭐", label: "Gold Rain" },
  hearts:    { emoji: "💖", label: "Heart Burst" },
  thunder:   { emoji: "⚡", label: "Thunderclap" },
  rainbow:   { emoji: "🌈", label: "Rainbow Burst" },
  snowburst: { emoji: "❄️", label: "Snow Burst" },
};

// A PLAYER_CARD_FINISH cosmetic's iconKey picks which surface-finish overlay
// renders on top of a player's hero banner (player-detail's "CINEMATIC
// HERO" block) — independent of/layered over whatever BANNER is equipped,
// same reasoning as CHECKOUT_EFFECT_MAP: the key is a lookup into a fixed
// set of treatments, never markup.
export const PLAYER_CARD_FINISH_MAP: Record<string, { label: string }> = {
  matte:      { label: "Matte" },
  foil:       { label: "Foil" },
  holo:       { label: "Holo" },
  prismatic:  { label: "Prismatic" },
};

// A RANK_UP_EFFECT cosmetic's iconKey picks which particle-burst animation
// plays on a player's own real-match result screen when their leaderboard
// position improves — same shape and same reasoning as CHECKOUT_EFFECT_MAP,
// reusing the shared <CheckoutBurst> component with a different emoji/tint.
export const RANK_UP_EFFECT_MAP: Record<string, { emoji: string; label: string }> = {
  arrow:  { emoji: "🔼", label: "Arrow Up" },
  rocket: { emoji: "🚀", label: "Blast Off" },
  star:   { emoji: "🌟", label: "Rising Star" },
  crown:  { emoji: "👑", label: "Crowning" },
};

export const RARITY_COLORS: Record<string, string> = {
  COMMON: "#9ca3af", RARE: "#3b82f6", EPIC: "#a855f7", LEGENDARY: "#ffd24a",
};

// A hard refresh wipes this whole module, including catalogCache below, so
// every name-style colour, badge, frame and banner on the page rendered
// unstyled for a beat and then popped into its real look once
// /api/cosmetics/catalog resolved — on every single refresh, for one of the
// most widely-used pieces of data in the app. localStorage carries the last
// successfully fetched catalog across that gap: catalogCache seeds from it
// immediately (below), so cosmetic-dependent UI renders correctly on the
// very first paint, and a real fetch still runs once per page load in the
// background to pick up anything an admin added or changed since — same
// cache-then-confirm pattern as the nav's account widget and feature flags
// (see context/auth.tsx, hooks/use-settings.ts).
const CATALOG_CACHE_KEY = "tkdl_cached_cosmetics_catalog";

function readCachedCatalog(): CosmeticDefinition[] | null {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CosmeticDefinition[]) : null;
  } catch {
    return null;
  }
}

function writeCachedCatalog(rows: CosmeticDefinition[]): void {
  try {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(rows));
  } catch {
    // best-effort — private browsing / storage disabled just means no cache
  }
}

let catalogCache: CosmeticDefinition[] | null = readCachedCatalog();
let catalogPromise: Promise<CosmeticDefinition[]> | null = null;

// Shared, module-level cache — the catalog rarely changes and several
// components on the same page (the shop, an account header, a player-detail
// hero) all need it, so this avoids a duplicate fetch per component. Only
// ever fetches once per page load (catalogPromise memoizes it) regardless
// of how many components call this.
function loadCatalog(): Promise<CosmeticDefinition[]> {
  if (!catalogPromise) {
    catalogPromise = fetch("/api/cosmetics/catalog")
      .then(r => (r.ok ? r.json() : []))
      .then((rows: CosmeticDefinition[]) => {
        if (rows.length > 0) {
          catalogCache = rows;
          writeCachedCatalog(rows);
        }
        return catalogCache ?? [];
      })
      .catch(() => catalogCache ?? []);
  }
  return catalogPromise;
}

export function useCosmeticsCatalog(): CosmeticDefinition[] {
  const [catalog, setCatalog] = useState<CosmeticDefinition[]>(catalogCache ?? []);
  useEffect(() => {
    let live = true;
    loadCatalog().then(rows => { if (live && rows.length > 0) setCatalog(rows); });
    return () => { live = false; };
  }, []);
  return catalog;
}

// CSS for a NAME_STYLE cosmetic — a solid colour, or a gradient-text
// treatment with an optional glow. Returns {} for null/unknown, which
// renders as the existing default look, unchanged.
export function nameStyleCSS(cosmetic: CosmeticDefinition | undefined | null): CSSProperties {
  if (!cosmetic) return {};
  if (cosmetic.gradient) {
    return {
      backgroundImage: cosmetic.gradient,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      color: "transparent",
      filter: cosmetic.glow ? `drop-shadow(0 0 10px ${cosmetic.glow}99)` : undefined,
    };
  }
  if (cosmetic.color) {
    return {
      color: cosmetic.color,
      textShadow: cosmetic.glow ? `0 0 14px ${cosmetic.glow}99` : undefined,
    };
  }
  return {};
}

// LEGENDARY gradients get a slow animated shimmer (index.css's
// .cosmetic-name-legendary) — everything else renders static.
export function nameStyleClassName(cosmetic: CosmeticDefinition | undefined | null): string {
  return cosmetic?.gradient && cosmetic.rarity === "LEGENDARY" ? "cosmetic-name-legendary" : "";
}

// CSS for a BANNER cosmetic — its `gradient` column is a full CSS
// background-image string. Returns {} for null/unknown, which renders as
// the existing default hero background, unchanged.
export function bannerCSS(cosmetic: CosmeticDefinition | undefined | null): CSSProperties {
  if (!cosmetic?.gradient) return {};
  return { backgroundImage: cosmetic.gradient };
}

// CSS for a FRAME cosmetic — `color` is the border colour, `glow` (if set)
// adds a matching glow. Returns {} for null/unknown, which keeps whatever
// default border the caller already applies.
export function frameStyle(cosmetic: CosmeticDefinition | undefined | null): CSSProperties {
  if (!cosmetic?.color) return {};
  return {
    border: `2px solid ${cosmetic.color}`,
    boxShadow: cosmetic.glow ? `0 0 16px ${cosmetic.glow}88` : undefined,
  };
}

// CSS for a GLOW cosmetic — its `color` overrides a leaderboard row's
// default tier/rank-based left border + background tint with a personal
// colour. Returns {} for null/unknown, which keeps the caller's existing
// default styling untouched.
export function glowRowStyle(cosmetic: CosmeticDefinition | undefined | null): CSSProperties {
  if (!cosmetic?.color) return {};
  return {
    borderLeft: `3px solid ${cosmetic.color}88`,
    background: `linear-gradient(90deg, ${cosmetic.color}12, transparent 60%)`,
  };
}

// Colour for a RESULT_THEME cosmetic — used as the accent across a
// player's own practice-mode result screens. Callers pass their existing
// hardcoded default as `fallback` so "nothing equipped" renders exactly as
// it did before this cosmetic category existed.
export function resultThemeColor(cosmetic: CosmeticDefinition | undefined | null, fallback: string): string {
  return cosmetic?.color ?? fallback;
}

// ACCOUNT_ACCENT cosmetic — a flat swatch colour applied only to a
// player's own account page (see account.tsx, which reads this once and
// sets it as a CSS custom property scoped to that page's own root wrapper
// so it can never leak into shared/other-player-visible components).
export function accountAccentColor(cosmetic: CosmeticDefinition | undefined | null, fallback: string): string {
  return cosmetic?.color ?? fallback;
}

// CSS for a BUBBLE_COLOR cosmetic — background/border tint applied only to
// a player's own outgoing DM chat bubbles. Returns {} for null/unknown,
// which keeps the caller's existing default pink bubble unchanged.
export function bubbleColorStyle(cosmetic: CosmeticDefinition | undefined | null): CSSProperties {
  if (!cosmetic?.color) return {};
  return {
    background: `${cosmetic.color}33`,
    border: `1px solid ${cosmetic.color}59`,
  };
}

// Icon + colour for an AVATAR_BADGE cosmetic — a small sticker pinned to
// the corner of the avatar square. Returns null for nothing-equipped or an
// unrecognised iconKey, which callers use to render nothing extra.
export function avatarBadgeIcon(cosmetic: CosmeticDefinition | undefined | null): { Icon: LucideIcon; color: string } | null {
  if (!cosmetic?.iconKey) return null;
  const Icon = AVATAR_BADGE_MAP[cosmetic.iconKey];
  if (!Icon) return null;
  return { Icon, color: cosmetic.color ?? "#ffffff" };
}

// A LEADERBOARD_TAG cosmetic's payload rides directly in `name` (the tag
// text, a fixed catalog string) and `color` (its tint) — no separate CSS
// helper needed, callers render <LeaderboardTag cosmetic={c} /> or look up
// .name/.color directly. Returns {} for null/unknown.
export function leaderboardTagStyle(cosmetic: CosmeticDefinition | undefined | null): CSSProperties {
  if (!cosmetic?.color) return {};
  return {
    color: cosmetic.color,
    background: `${cosmetic.color}18`,
    border: `1px solid ${cosmetic.color}40`,
  };
}

// CSS for a TAGLINE_STYLE cosmetic — identical shape to NAME_STYLE (a solid
// colour, or a gradient-text treatment with an optional glow), just applied
// to the tagline line instead of the name. Kept as its own named export
// (rather than callers reusing nameStyleCSS directly) so the two stay
// independently equippable and the call sites read clearly.
export function taglineStyleCSS(cosmetic: CosmeticDefinition | undefined | null): CSSProperties {
  return nameStyleCSS(cosmetic);
}

// CSS for a POST_ACCENT cosmetic — border/background tint on a player's own
// Community feed post card. Returns {} for null/unknown, which keeps the
// caller's existing default card styling untouched.
export function postAccentStyle(cosmetic: CosmeticDefinition | undefined | null): CSSProperties {
  if (!cosmetic?.color) return {};
  return {
    background: `${cosmetic.color}0d`,
    border: `1px solid ${cosmetic.color}33`,
  };
}

// Emoji for a STICKER cosmetic — the character itself lives in iconKey (see
// schema/cosmetics.ts's header comment on STICKER: plain unicode text, safe
// to render directly, not a lookup into a whitelisted component map like
// PROFILE_ICON/AVATAR_BADGE). Returns null for nothing/unrecognised.
export function stickerEmoji(cosmetic: CosmeticDefinition | undefined | null): string | null {
  return cosmetic?.iconKey ?? null;
}

// Emoji + colour for a CHECKOUT_EFFECT cosmetic. Returns null for
// nothing-equipped or an unrecognised iconKey, which callers use to skip
// rendering the burst entirely.
export function checkoutEffect(cosmetic: CosmeticDefinition | undefined | null): { emoji: string; color: string } | null {
  if (!cosmetic?.iconKey) return null;
  const meta = CHECKOUT_EFFECT_MAP[cosmetic.iconKey];
  if (!meta) return null;
  return { emoji: meta.emoji, color: cosmetic.color ?? "#ffd24a" };
}

// Colour for a SCORER_THEME cosmetic — accents the live scoring surface
// across practice's scorer modes (SectionCard's border/glow, and Cricket's
// title). Same shape as resultThemeColor: caller passes its existing
// hardcoded default as `fallback` so "nothing equipped" is pixel-identical
// to before this category existed.
export function scorerThemeColor(cosmetic: CosmeticDefinition | undefined | null, fallback: string): string {
  return resultThemeColor(cosmetic, fallback);
}

// Label + colour for a PLAYER_CARD_FINISH cosmetic — a texture/shimmer
// overlay layered on top of player-detail's hero block, independent of
// whatever BANNER is equipped underneath. Returns null for nothing-equipped
// or an unrecognised iconKey, which callers use to skip the overlay
// entirely.
export function playerCardFinish(cosmetic: CosmeticDefinition | undefined | null): { key: string; label: string; color: string } | null {
  if (!cosmetic?.iconKey) return null;
  const meta = PLAYER_CARD_FINISH_MAP[cosmetic.iconKey];
  if (!meta) return null;
  return { key: cosmetic.iconKey, label: meta.label, color: cosmetic.color ?? "#e5e7eb" };
}

// CSS for a TROPHY_CASE_STYLE cosmetic — background/border tint on the
// pinned Trophy Case strip (see components/TrophyCase.tsx). Returns {} for
// null/unknown, which keeps the strip's existing default gold/pink gradient
// look unchanged.
export function trophyCaseStyle(cosmetic: CosmeticDefinition | undefined | null): CSSProperties {
  if (!cosmetic?.color) return {};
  return {
    background: `linear-gradient(120deg, ${cosmetic.color}1c, ${cosmetic.color}08)`,
    border: `1px solid ${cosmetic.color}40`,
  };
}

// CSS for a RECAP_STYLE cosmetic — background skin for a Season Recap Card
// (see components/SeasonRecapCard.tsx). Returns {} for null/unknown, which
// keeps the card's existing default dark panel look unchanged.
export function recapStyleCSS(cosmetic: CosmeticDefinition | undefined | null): CSSProperties {
  if (!cosmetic?.gradient) return {};
  return {
    backgroundImage: cosmetic.gradient,
    boxShadow: cosmetic.glow ? `0 0 40px ${cosmetic.glow}22` : undefined,
  };
}

// Emoji + colour for a RANK_UP_EFFECT cosmetic — same shape as
// checkoutEffect() above, feeding the same shared <CheckoutBurst> component.
// Returns null for nothing-equipped or an unrecognised iconKey, which
// callers use to fall back to a default burst rather than skip it entirely
// (unlike CHECKOUT_EFFECT, a rank-up moment always gets *some* celebration —
// this cosmetic only ever changes its flavour, never turns it off).
export function rankUpEffect(cosmetic: CosmeticDefinition | undefined | null): { emoji: string; color: string } {
  const fallback = { emoji: "🔼", color: "#22c55e" };
  if (!cosmetic?.iconKey) return fallback;
  const meta = RANK_UP_EFFECT_MAP[cosmetic.iconKey];
  if (!meta) return fallback;
  return { emoji: meta.emoji, color: cosmetic.color ?? fallback.color };
}
