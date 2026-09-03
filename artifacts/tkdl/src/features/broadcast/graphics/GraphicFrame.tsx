// TKDL LIVE — shared chrome for every graphics/*.tsx component (handover
// doc 15.1's own 7-component list, 14.5's `graphic: { kind, data }`).
//
// ── Why this — and not a bespoke layout per graphic kind ─────────────────
// `data` is exactly a story's own already-verified facts object
// (story-types.ts's own StoryCandidate comment: "Verified, display-ready
// numbers backing this story's claim") — a flat, story-type-dependent bag
// of named values, not a fixed shape per graphic kind (api-shapes.ts's own
// GRAPHIC_KIND_BY_STORY_TYPE maps ~40 individual story types across these 7
// components). Hand-authoring a bespoke visual layout for each of those ~40
// fact shapes would mean inventing ~40 new pixel-level display designs.
// Instead, every graphic kind still shares this one frame — a themed tag
// chip identifies WHICH graphic this is, a couple of "highlight" facts get
// big-number chips of their own, and every other fact renders as a small
// label/value chip. Real, complete, working for every story type it could
// ever receive.
//
// ── Score-bug, not a boxed card (real user feedback) ──────────────────────
// This used to be a bordered rounded-2xl card with a solid header bar and a
// rigid 2-column grid of rows — read back verbatim as "the big blocky
// board... just big blocks with data in it," not a broadcast. No outer
// border/card background any more: each chip is its own small pill with a
// translucent glass fill, staggering in (index.css's own bug-chip-in).
//
// ── `compact` — hierarchy by treatment, not "one size for every story" ────
// Real UK darts coverage (Sky Sports) keeps its scoring overlay small and
// restrained through routine play, and spends its bigger, more animated
// graphic treatment only on the rare milestone (a nine-darter, a big
// checkout) that actually earns it — see theme.ts's own VisualTier comment
// for the full research this is built on. `compact` is that same idea
// applied here: scene-support.tsx's renderGraphic() passes `compact: true`
// for every tier except "major", so a routine Supporting story's graphic
// shows one hero number and a couple of supporting chips — not every fact
// the story carries all lined up at full size. Nothing is lost, just
// de-emphasised: an overflow chip ("+N more") names how many extra facts
// exist without displaying them all with equal weight.
import type { CSSProperties } from "react";
import type { GraphicData, LeagueType } from "../types";
import { LEAGUE_ACCENT, LEAGUE_LABEL, humanizeFactKey, formatFactValue } from "../theme";

export type GraphicFrameProps = {
  kind: string;
  icon: string;
  accent: string;
  leagueType: LeagueType | null;
  data: GraphicData;
  /** Fact keys (if present in `data`) to render as large headline-number chips ahead of the generic ones — a best-effort guess at which key(s) this graphic kind's underlying story types most likely carry, not an exhaustive or authoritative contract. A key absent from `data` is simply skipped, never shown as a blank stat. */
  highlightKeys?: readonly string[];
  /** See this file's own header. Defaults true (the quiet, routine case) so a call site that forgets to pass it gets the restrained treatment, not the loud one. */
  compact?: boolean;
};

/** A translucent glass fill for a chip, tinted by the accent colour at low alpha. Deliberately restrained — no accent-coloured glow/inset highlight on the "strong" variant any more (real user feedback: "so large and just in your face"); the accent border and gradient alone are enough to read as themed without reaching for a neon ring. */
function chipStyle(accent: string, strong: boolean): CSSProperties {
  return {
    background: strong ? `linear-gradient(135deg, ${accent}26 0%, rgba(6,4,14,0.74) 100%)` : "rgba(6,4,14,0.6)",
    border: `1px solid ${accent}${strong ? "45" : "22"}`,
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
  };
}

export function GraphicFrame({ kind, icon, accent, leagueType, data, highlightKeys = [], compact = true }: GraphicFrameProps) {
  const entries = Object.entries(data);
  const allHighlighted = entries.filter(([key]) => highlightKeys.includes(key));
  const allRest = entries.filter(([key]) => !highlightKeys.includes(key));

  // Compact keeps this to one hero number and a couple of supporting chips
  // — a real scorebug never lines up five equal-weight stats side by side.
  const highlighted = compact ? allHighlighted.slice(0, 1) : allHighlighted;
  const restCap = compact ? 2 : allRest.length;
  const rest = allRest.slice(0, restCap);
  const overflowCount = allRest.length - rest.length + Math.max(0, allHighlighted.length - highlighted.length);

  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : accent;

  // Stagger index spans every chip this graphic renders, tag chip first —
  // a real graphics package builds itself on screen left-to-right/in order,
  // not all at once.
  let chipIndex = 0;
  const nextDelay = () => `${chipIndex++ * 70}ms`;

  const tagPad = compact ? "px-3 py-1" : "px-3.5 py-1.5";
  const tagIconSize = compact ? "0.85rem" : "1rem";
  const tagLabelSize = compact ? "0.56rem" : "0.62rem";
  const highlightPad = compact ? "px-3 py-1.5" : "px-4 py-2";
  const highlightNumSize = compact ? "1.25rem" : "1.7rem";
  const restPad = compact ? "px-2 py-1" : "px-2.5 py-1.5";
  const restValueSize = compact ? "0.66rem" : "0.72rem";

  return (
    <div className="flex flex-col gap-2" style={{ fontFamily: "Oswald, sans-serif" }}>
      {/* ── Tag chip: identifies which graphic this is, no full-width header bar ── */}
      <div className="flex items-center gap-2">
        <div
          className={`bug-chip-in flex items-center gap-2 rounded-full ${tagPad}`}
          style={{ ...chipStyle(accent, true), animationDelay: nextDelay() }}
        >
          <span style={{ fontSize: tagIconSize, lineHeight: 1 }} aria-hidden="true">{icon}</span>
          <span className="font-black uppercase" style={{ color: accent, letterSpacing: "0.16em", fontSize: tagLabelSize }}>{kind}</span>
          {leagueType && (
            <>
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }} />
              <span className="font-bold uppercase" style={{ color: leagueAccent, letterSpacing: "0.1em", fontSize: "0.56rem" }}>
                {LEAGUE_LABEL[leagueType]}
              </span>
            </>
          )}
        </div>
        <div className="bug-underline-draw h-[2px] flex-1 max-w-[56px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      </div>

      {/* ── Highlight chips: the hero number(s) ── */}
      {highlighted.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {highlighted.map(([key, value]) => (
            <div
              key={key}
              className={`bug-chip-in flex flex-col justify-center rounded-xl ${highlightPad}`}
              style={{ ...chipStyle(accent, true), animationDelay: nextDelay() }}
            >
              <div className="font-black tabular-nums leading-none" style={{ fontSize: highlightNumSize, color: accent }}>{formatFactValue(key, value)}</div>
              <div className="uppercase tracking-wide mt-0.5" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.54rem", letterSpacing: "0.08em" }}>{humanizeFactKey(key)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── A couple of supporting facts, flowing not gridded ── */}
      {rest.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {rest.map(([key, value]) => (
            <div
              key={key}
              className={`bug-chip-in flex items-center gap-1.5 rounded-lg ${restPad}`}
              style={{ ...chipStyle(accent, false), animationDelay: nextDelay() }}
            >
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.64rem" }}>{humanizeFactKey(key)}</span>
              <span className="font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.92)", fontSize: restValueSize }}>{formatFactValue(key, value)}</span>
            </div>
          ))}
          {overflowCount > 0 && (
            <div
              className="bug-chip-in flex items-center rounded-lg px-2 py-1"
              style={{ ...chipStyle(accent, false), animationDelay: nextDelay(), color: "rgba(255,255,255,0.4)", fontSize: "0.62rem" }}
            >
              +{overflowCount} more
            </div>
          )}
        </div>
      ) : highlighted.length === 0 ? (
        <div className="bug-chip-in rounded-lg px-3 py-1.5" style={{ ...chipStyle(accent, false), animationDelay: nextDelay(), color: "rgba(255,255,255,0.35)", fontSize: "0.72rem" }}>
          No supporting data for this story.
        </div>
      ) : null}
    </div>
  );
}
