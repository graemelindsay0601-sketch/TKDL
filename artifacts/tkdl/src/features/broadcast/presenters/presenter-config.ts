// TKDL LIVE — presenter identity (handover doc 12.1: two presenters, a
// measured host/analyst and a bolder pundit; "Names and artwork are
// configuration/assets and may be changed later without code architecture
// changes."). This is that configuration.
//
// ── Where these names/colours came from ──────────────────────────────────
// The user picked "Chalky" and "Ton" over the doc's own placeholder working
// names (Alex/Mick) — both real darts vocabulary (marking the chalk/oche at
// an old-school pub board; a "ton" is 100+ on three darts), which is also
// why they read naturally alongside TKDL's own existing darts-slang bits
// elsewhere in this app. The accent colours are NOT a new invention: they
// match the two reference clips the user supplied almost exactly (the
// measured host wore blue, the pundit wore red/magenta) — and blue/magenta
// are already TKDL's own --secondary/--primary tokens (index.css), so this
// reuses the app's real palette rather than adding a third colour system.
//
// ── Portrait ───────────────────────────────────────────────────────────────
// Two earlier passes here (a monogram-in-a-circle badge, then a hand-drawn
// flat-vector SVG face) were both rejected by the user as too cheap-looking
// for what this feature is meant to be. The user then supplied a real,
// professionally-rendered asset pack (TKDL_LIVE_Hosts_Pack_Final, staged
// from their computer) — 8 expression states per presenter as transparent
// PNGs, converted to WebP and committed under
// public/broadcast/hosts/{chalky,ton}/<state>.webp (see
// PresenterPortrait.tsx for how they're rendered, and presenter-state.ts for
// which state each scene uses). The pack's own folders are named "Alex" and
// "Mick" — the handover doc's original placeholder names — rather than the
// user's actual chosen names; they map onto Chalky/Ton by ROLE, not name
// (the pack's own host_manifest.json: "Alex" = "Host / Analyst" = Chalky,
// "Mick" = "Pundit / Personality" = Ton), which is why `assetFolder` below
// is independent of `name`. `accent` remains its own separate colour used
// for the dialogue card/speech-bubble border and the portrait's active-glow
// ring — it was never about the portrait's own rendering.
export type PresenterId = "A" | "B";

/** The asset pack's own 8 states (host_manifest.json) — one WebP per state, per presenter, all on an identical canvas so swapping between them never shifts size/position. */
export type PresenterState = "neutral" | "speaking" | "explaining" | "thinking" | "amused" | "surprised" | "listening" | "confident";

export type PresenterConfig = {
  id: PresenterId;
  name: string;
  /** 12.1's own role column, kept short enough to sit under the name in a name pill. */
  role: string;
  /** One line of flavour text — not spoken dialogue (that's commentary-library.ts's job), just an "about the presenter" caption for anywhere the show introduces its cast (e.g. a future about/credits moment). */
  tagline: string;
  /** Dialogue card / speech-bubble border and active-portrait glow colour. Independent of theme.ts's LEAGUE_ACCENT — a presenter keeps their own colour no matter which league's story they're covering, the same way LiveInsertOverlay's OVERLAY_CLASS_ACCENT is its own separate palette. */
  accent: string;
  /** 2 letters — used only by PresenterPortrait's own onError fallback, if a portrait image ever fails to load (host pack README's own requirement: "the dialogue/graphics must still render"). */
  monogram: string;
  /** public/broadcast/hosts/<assetFolder>/<state>.webp — see this file's own header for why this differs from `name`. */
  assetFolder: string;
};

export const PRESENTERS: Record<PresenterId, PresenterConfig> = {
  A: {
    id: "A",
    name: "Chalky",
    role: "Host & Analyst",
    tagline: "Facts first, every time.",
    accent: "#0066ff",
    monogram: "CH",
    assetFolder: "chalky",
  },
  B: {
    id: "B",
    name: "Ton",
    role: "Pundit",
    tagline: "Never short of an opinion.",
    accent: "#ff005c",
    monogram: "TN",
    assetFolder: "ton",
  },
};

export function presenterFor(speaker: PresenterId): PresenterConfig {
  return PRESENTERS[speaker];
}

export function presenterPortraitSrc(speaker: PresenterId, state: PresenterState): string {
  return `/broadcast/hosts/${PRESENTERS[speaker].assetFolder}/${state}.webp`;
}
