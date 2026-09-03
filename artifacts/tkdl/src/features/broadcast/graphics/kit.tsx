// TKDL LIVE — shared primitives for the bespoke per-kind graphics (real user
// feedback: the old GraphicFrame chip-grid rendered every graphic kind
// through the exact same shape — a tag pill plus a row of label/value pills
// — which reads as a data table screenshotted out of the app, not a
// broadcast graphics package. Each graphics/*.tsx file now composes its OWN
// purpose-built layout (a versus split for head-to-head, a probability bar
// for the title race, a standings ladder for the league table, a streak
// gauge for form watch...) out of these shared pieces, so the "house style"
// still holds the whole graphics package together as one consistent look,
// without every graphic being the same SHAPE.
//
// Two skins now live here, chosen per graphic by its own `compact` prop —
// the v2 "broadcast panel" skin for compact=true (quiet/featured visual
// tier) and the v3 "BigBoard" skin below it for compact=false (major tier).
// An original v1 "glass-chip" skin (GraphicTag/HeroStat/MeasureBar/
// VersusCard/MoveIndicator/Flag/EmptyNote/surfaceStyle) used to live here
// too — real user feedback on it ("far too much like you've took an actual
// screenshot of the stats and just pasting it in") is what led to v2, and
// once v2 (then v3) actually shipped across every graphics/*.tsx file, v1
// had no remaining callers — removed rather than kept as dead code.
//
// GraphicFrame.tsx (the old generic chip renderer, predating even v1) still
// exists and is used as ResultGraphic's own fallback for a facts shape none
// of its known hero-stat cases recognise — chiefly the FILLER story types
// (practice activity, Shadow Bot promo, feature spotlight), whose own
// bespoke facts shape hasn't been designed yet. Nothing else should reach
// for it.
import type { ReactNode } from "react";
import type { GraphicData, LeagueType } from "../types";
import { LEAGUE_ACCENT, LEAGUE_LABEL } from "../theme";

/** A 0-1 fraction as a whole-number percent string. Every bespoke component below knows which of its OWN fields are fraction-shaped (unlike GraphicFrame's old generic key-name-suffix heuristic), so this is just the arithmetic. */
export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// ── Defensive field access ──────────────────────────────────────────────
// GraphicData is a loosely-typed bag (the story's own already-verified
// facts, post commentary-engine.ts's buildGraphicFacts() id->name
// resolution) — every bespoke component below reaches for SPECIFIC known
// field names for its own story-type family rather than iterating every key
// generically the way the old GraphicFrame did, so a value showing up under
// a key this component doesn't recognise (a future story type, a renamed
// fact) is silently skipped rather than crashing the graphic. These two
// getters are that defensive read, once, instead of an `as` cast at every
// call site.
export function str(data: GraphicData, key: string): string | null {
  const v = data[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}
export function num(data: GraphicData, key: string): number | null {
  const v = data[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
export function bool(data: GraphicData, key: string): boolean {
  return data[key] === true;
}
export function numArray(data: GraphicData, key: string): number[] | null {
  const v = data[key];
  return Array.isArray(v) && v.every((x): x is number => typeof x === "number") ? v : null;
}

export function staggerDelay(i: number): string {
  return `${i * 80}ms`;
}

/** Appends a hex alpha suffix to a colour ONLY when it's actually hex-shaped ("#rrggbb") — several components below build a glow/tint by string-concatenating an alpha suffix onto an accent, which silently produces an invalid CSS colour (and so no colour at all — a blank bar, no glow) for any non-hex accent, e.g. "rgba(255,255,255,0.4)cc" is not a real colour. A handful of the bespoke graphics deliberately pass a de-emphasised `rgba(...)` accent for a "second place" bar/name (kit.tsx's own callers), so every place that builds a colour string this way goes through this guard instead of concatenating directly. Non-hex input is returned unchanged — safe degradation (no glow) rather than a broken swatch. */
export function withAlpha(color: string, alphaHex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alphaHex}` : color;
}

// ═══════════════════════════════════════════════════════════════════════
// ── Broadcast panel skin (v2) ─────────────────────────────────────────────
// Real user feedback after seeing the original glass-chip kit (now removed
// — see this file's own header) built and screenshotted: "far too much
// like you've took an actual screenshot of the stats and just pasting it
// in." The content shapes that kit had (versus split, probability bar,
// hero stat...) were the right call, but the CONTAINER — translucent blur,
// soft rounded corners, floating pills — was itself a generic web-app
// "glassmorphism" dashboard-card look regardless of what's inside it,
// which is exactly what read as "a snapshot of the app" rather than a TV
// graphics package. This set of primitives is a deliberately different
// skin: solid opaque panels with one hard-angled corner cut (not rounded),
// a bold flat-colour badge behind the hero number (not coloured text
// floating on blur), and a slide-in-from-the-edge entrance (not a
// fade-up-in-place) — the same difference between a browser card and an
// actual Sky Sports graphics package. Every graphics/*.tsx file now uses
// this skin at `compact={true}` (quiet/featured visual tier); major tier
// moved one step further still, onto the "BigBoard" skin below.
export function Panel({ accent, compact = true, children }: { accent: string; compact?: boolean; children: ReactNode }) {
  return (
    <div
      className="panel-slide-in inline-flex flex-col"
      style={{
        background: "linear-gradient(160deg, #14141f 0%, #050508 100%)",
        clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)",
        borderLeft: `5px solid ${accent}`,
        boxShadow: "0 18px 36px rgba(0,0,0,0.55)",
        padding: compact ? "10px 18px 12px 14px" : "16px 24px 18px 19px",
        gap: compact ? 8 : 10,
        maxWidth: compact ? 320 : 440,
      }}
    >
      {children}
    </div>
  );
}

/** The panel's own identifying caption — a solid colour "wipe" bar in place of GraphicTag's fading gradient underline, since nothing in this skin fades in from transparency. */
export function PanelTag({ icon, kind, leagueType, accent, compact = true }: { icon: string; kind: string; leagueType: LeagueType | null; accent: string; compact?: boolean }) {
  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : accent;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: compact ? "0.8rem" : "0.95rem", lineHeight: 1 }} aria-hidden="true">{icon}</span>
        <span className="font-black uppercase" style={{ color: "#fff", letterSpacing: "0.14em", fontSize: compact ? "0.62rem" : "0.68rem" }}>{kind}</span>
        {leagueType && (
          <span className="font-bold uppercase" style={{ color: leagueAccent, letterSpacing: "0.1em", fontSize: "0.56rem" }}>· {LEAGUE_LABEL[leagueType]}</span>
        )}
      </div>
      <div className="bar-wipe" style={{ height: 3, width: compact ? 38 : 54, background: accent }} />
    </div>
  );
}

/** The hero number as a solid flat-colour badge (a parallelogram, not a rounded pill) — the shape a real scoreboard graphic gives its headline number, dark text on a bright fill rather than bright text floating on blur. */
export function HeroBadge({ value, label, accent, compact = true }: { value: string; label: string; accent: string; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="badge-pop-in self-start"
        style={{ background: accent, clipPath: "polygon(7% 0, 100% 0, 93% 100%, 0% 100%)", padding: compact ? "3px 20px" : "5px 26px" }}
      >
        <span className="font-black tabular-nums" style={{ color: "#08080c", fontSize: compact ? "1.9rem" : "2.6rem", lineHeight: 1.15 }}>{value}</span>
      </div>
      <div className="uppercase font-bold" style={{ color: "rgba(255,255,255,0.55)", fontSize: compact ? "0.6rem" : "0.68rem", letterSpacing: "0.08em" }}>{label}</div>
    </div>
  );
}

/** A plain supporting line — flat text, no chip background, since this skin doesn't put every fact in its own container. */
export function PanelLine({ children }: { children: ReactNode }) {
  return <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.72rem", fontWeight: 600 }}>{children}</div>;
}

/** The versus split on this skin: two solid-fill name plates angled toward each other (a chevron meeting point) instead of two names floating on transparent background either side of a "VS" label. */
export function VersusPanel({
  leftName, rightName, leftAccent, rightAccent, splitFraction, splitLabel, compact = true,
}: { leftName: string; rightName: string; leftAccent: string; rightAccent: string; splitFraction?: number; splitLabel?: string; compact?: boolean }) {
  const namePad = compact ? "6px 10px" : "8px 14px";
  return (
    // `min-w-0` down through every level here, and `truncate` in place of a
    // bare `whitespace-nowrap`, for the same reason DeskScene's league-table
    // card overflowed on a phone (real user screenshot: text clipped off the
    // right edge in portrait) — a name plate sized to its own un-wrapped
    // text has no ceiling, so a long player/team name just pushes this
    // whole card wider than the screen instead of yielding to it.
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-stretch min-w-0" style={{ gap: 2 }}>
        <div className="min-w-0" style={{ flex: "1 1 0%", background: leftAccent, clipPath: "polygon(0 0, 100% 0, 86% 100%, 0% 100%)", padding: namePad, paddingRight: compact ? 22 : 30 }}>
          {/* `clamp()` + `overflowWrap: anywhere` in place of a bare `truncate`
              — this file's own BigVersus below hit the same problem at a
              bigger scale (see its header comment): ellipsizing a long
              player/team name at this size cut it down to almost nothing. */}
          <span className="font-black uppercase block" style={{ color: "#08080c", fontSize: compact ? "clamp(0.68rem, 3.6vw, 0.92rem)" : "clamp(0.8rem, 4vw, 1.15rem)", lineHeight: 1.2, overflowWrap: "anywhere" }}>{leftName}</span>
        </div>
        <div className="flex items-center justify-center font-black shrink-0" style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.64rem", letterSpacing: "0.05em" }}>VS</div>
        <div className="min-w-0" style={{ flex: "1 1 0%", background: rightAccent, clipPath: "polygon(14% 0, 100% 0, 100% 100%, 0% 100%)", padding: namePad, paddingLeft: compact ? 22 : 30 }}>
          <span className="font-black uppercase block" style={{ color: "#08080c", fontSize: compact ? "clamp(0.68rem, 3.6vw, 0.92rem)" : "clamp(0.8rem, 4vw, 1.15rem)", lineHeight: 1.2, overflowWrap: "anywhere" }}>{rightName}</span>
        </div>
      </div>
      {splitFraction !== undefined && (
        <div className="flex flex-col gap-1">
          <div className="flex overflow-hidden" style={{ height: compact ? 5 : 7 }}>
            <div className="bar-wipe h-full" style={{ width: `${Math.max(0, Math.min(1, splitFraction)) * 100}%`, background: leftAccent }} />
            <div className="h-full flex-1" style={{ background: rightAccent, opacity: 0.85 }} />
          </div>
          {splitLabel && <div className="text-center uppercase font-bold" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.58rem", letterSpacing: "0.08em" }}>{splitLabel}</div>}
        </div>
      )}
    </div>
  );
}

/** This skin's measured bar — a flat rectangle track with a solid-fill (not gradient) wipe, in place of MeasureBar's rounded/translucent track. */
export function PanelBar({
  label, valueLabel, fraction, accent, compact = true,
}: { label: string; valueLabel: string; fraction: number; accent: string; compact?: boolean }) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold truncate" style={{ color: "rgba(255,255,255,0.7)", fontSize: compact ? "0.64rem" : "0.7rem" }}>{label}</span>
        <span className="font-black tabular-nums shrink-0" style={{ color: accent, fontSize: compact ? "0.7rem" : "0.8rem" }}>{valueLabel}</span>
      </div>
      <div style={{ height: compact ? 5 : 7, background: "rgba(255,255,255,0.1)" }}>
        <div className="bar-wipe h-full" style={{ width: `${clamped * 100}%`, background: accent }} />
      </div>
    </div>
  );
}

/** A small solid-fill flag, this skin's version of kit.tsx's own `Flag` — a rectangle, not a rounded/bordered pill. */
export function PanelFlag({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <span className="inline-flex items-center font-black uppercase px-2 py-0.5 self-start" style={{ background: accent, color: "#08080c", fontSize: "0.56rem", letterSpacing: "0.1em" }}>
      {children}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── BigBoard skin (v3) ───────────────────────────────────────────────────
// Real user feedback, after seeing the v2 broadcast-panel skin above built
// and screenshotted on ResultGraphic/HeadToHeadGraphic: the shape was
// closer, but still not it. The user then posted a reference "TKDL LIVE
// Evening Edition" studio-screen mockup — dark navy background, glowing
// blue/red angular panels, real standings tables, thick probability bars,
// coloured badge pills, a radial gauge — and picked "go big like this, one
// story at a time" from three options: the one-story-per-segment FORMAT
// stays (hosts still talk through a single story, not a six-panel wall),
// but that one story's own graphic should now fill most of the screen
// behind them, not sit in a small corner card. This third skin is a
// deliberately larger, bolder rebuild of the v2 pieces above: a dark-navy
// (not near-black) gradient instead of v2's near-black one, a glowing
// coloured border instead of a flat 5px borderLeft, a bold uppercase
// header with its own glowing underline bar instead of a small caption, a
// numbered-row table shape for ranked/standings data instead of a bare
// bar, a THICK full-width bar (12px, glowing) instead of v2's 5-7px flat
// track, and a giant glow-shadowed number for hero-stat cases. Critically,
// none of these carry v2's `maxWidth` cap — they fill whatever width their
// caller's own wrapper gives them, and scenes/*.tsx now hands them a much
// wider one (see AnalysisScene/DeskScene/ResultScene) so the graphic can
// actually dominate the frame the way the reference image does.
//
// Used at "major" visual tier (VisualTier, theme.ts) via scenes/*.tsx's
// own `compact` prop (compact=false); compact=true segments — routine
// Supporting/quiet-tier play — stay on the smaller v2 Panel skin above.
// That's the same hierarchy-by-treatment idea theme.ts already documents
// ("quiet" is the default, the bigger treatment is spent only on the
// moment that's earned it) — this skin just raises how big "the bigger
// treatment" actually is, per the user's explicit "go big" direction,
// which now supersedes this file's own EARLIER (pre-reference-image)
// assumption that "major" tier only needed to be modestly bigger than
// "quiet." TitlePredictorGraphic.tsx and FormWatchGraphic.tsx were the
// first two rebuilt on this skin (chosen because they map most directly
// onto panels literally visible in the user's reference image — its
// "Title Predictor" bar panel and "Streaks & Upsets" badge list) as a
// direction check; every other graphics/*.tsx file now uses it too.
/**
 * `fill` (default true) stretches the panel to its wrapper's full width —
 * right for row/table-shaped content (BigRow's bars genuinely want the
 * width to read as a measured bar, not a token-sized sliver). A panel
 * whose content is just a header plus one hero number/badge has nothing
 * to put in that width, so real user feedback on an early screenshot (a
 * Win Streak panel with a big dead blank strip down its right half) is
 * this prop: `fill={false}` sizes the panel to its own content instead,
 * the same "big and dominant but not padded out with empty air" shape
 * the reference image's own "Shift Wars" hero-number panels have.
 */
export function BigPanel({ accent, fill = true, children }: { accent: string; fill?: boolean; children: ReactNode }) {
  return (
    <div
      className={`panel-slide-in flex-col min-w-0 ${fill ? "flex w-full" : "inline-flex"}`}
      style={{
        background: "linear-gradient(165deg, #141d33 0%, #0a1120 55%, #070a14 100%)",
        clipPath: "polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 0 100%)",
        border: `1px solid ${withAlpha(accent, "50")}`,
        borderLeft: `7px solid ${accent}`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.04) inset, 0 28px 64px rgba(0,0,0,0.6), 0 0 46px ${withAlpha(accent, "26")}`,
        padding: "26px 34px 30px 30px",
        gap: 18,
        // `fill=false` used to size this panel purely to its own content via
        // a bare `minWidth: 380` floor with nothing capping the top end —
        // fine for a short hero number, but a long player/team name inside
        // (BigMove/BigVersus below) simply grew the panel past the floor
        // with no ceiling, wider than the phone screen itself (real user
        // screenshot: DeskScene's league-table card clipped at the right
        // edge in portrait). `maxWidth: "100%"` never lets this panel exceed
        // whatever width its own wrapper (scenes/*.tsx's own `max-w-*` div)
        // actually has; `min(380px, 100%)` keeps the floor on anything wide
        // enough to afford it while letting it yield below 380px instead of
        // forcing that width regardless (min-width otherwise wins over
        // max-width in a conflict, which would silently undo the cap above).
        minWidth: fill ? undefined : "min(380px, 100%)",
        maxWidth: "100%",
      }}
    >
      {children}
    </div>
  );
}

/** This skin's identifying header — a real bold TV-graphics headline (not a small caption) with a glowing coloured underline bar in place of PanelTag's thin solid wipe. */
export function BigPanelHeader({ icon, kind, leagueType, accent }: { icon: string; kind: string; leagueType: LeagueType | null; accent: string }) {
  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : accent;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <span style={{ fontSize: "1.4rem", lineHeight: 1 }} aria-hidden="true">{icon}</span>
        <span className="font-black uppercase" style={{ color: "#fff", letterSpacing: "0.1em", fontSize: "1.2rem" }}>{kind}</span>
        {leagueType && (
          <span className="font-bold uppercase" style={{ color: leagueAccent, letterSpacing: "0.08em", fontSize: "0.76rem" }}>· {LEAGUE_LABEL[leagueType]}</span>
        )}
      </div>
      <div className="bar-wipe" style={{ height: 4, width: 104, background: accent, boxShadow: `0 0 14px ${withAlpha(accent, "cc")}` }} />
    </div>
  );
}

/** The hero number for this skin — a genuinely giant glow-shadowed figure (the reference image's "Shift Wars" big numbers), not a badge-sized parallelogram. */
export function BigHeroNumber({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div className="badge-pop-in flex items-baseline gap-5">
      <div className="font-black tabular-nums leading-none" style={{ fontSize: "5.4rem", color: accent, textShadow: `0 0 44px ${withAlpha(accent, "77")}, 0 0 10px ${withAlpha(accent, "dd")}` }}>{value}</div>
      <div className="uppercase font-bold" style={{ color: "rgba(255,255,255,0.62)", fontSize: "1.05rem", letterSpacing: "0.07em", maxWidth: 200, lineHeight: 1.15 }}>{label}</div>
    </div>
  );
}

/** A single ranked table row — a numbered position chip, a name, and a thick glowing measured bar — the real shape of the reference image's standings/Title-Predictor rows, in place of v1's bare MeasureBar or v2's thin PanelBar. `rank` is optional (a two-name Dead Heat doesn't need position numbers). */
export function BigRow({ rank, label, valueLabel, fraction, accent, delay = 0 }: { rank?: number; label: string; valueLabel: string; fraction: number; accent: string; delay?: number }) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <div className="bug-chip-in flex items-center gap-4" style={{ animationDelay: staggerDelay(delay) }}>
      {rank !== undefined && (
        <div className="flex items-center justify-center font-black shrink-0" style={{ width: 36, height: 36, background: withAlpha(accent, "1f"), border: `1px solid ${withAlpha(accent, "70")}`, color: accent, fontSize: "1.05rem" }}>
          {rank}
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-bold uppercase truncate" style={{ color: "#fff", fontSize: "1.08rem" }}>{label}</span>
          <span className="font-black tabular-nums shrink-0" style={{ color: accent, fontSize: "1.24rem" }}>{valueLabel}</span>
        </div>
        <div style={{ height: 12, background: "rgba(255,255,255,0.07)" }}>
          <div className="bar-wipe h-full" style={{ width: `${clamped * 100}%`, background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, "aa")})`, boxShadow: `0 0 18px ${withAlpha(accent, "80")}` }} />
        </div>
      </div>
    </div>
  );
}

/** A "before -> after" move, sized for this skin — DeskScene/ResultScene's move-shaped stories (a table-position climb, a form swing) at genuinely large scale rather than v1's ~1-1.8rem numbers. */
export function BigMove({ before, after, accent, improved }: { before: string; after: string; accent: string; improved: boolean }) {
  // This was built for short numeric moves ("P3" -> "P1", "2/5" -> "4/5"),
  // which never overflowed anything — but LeagueTableGraphic/
  // TitlePredictorGraphic also feed this arbitrary player/team NAMES for a
  // new-leader/new-favourite move, at up to 3.3rem with nothing to stop it
  // pushing this row (and BigPanel's own width above it) past a phone's
  // screen — a real user screenshot showed exactly that, a name clipped off
  // the right edge in portrait. A first fix reached for `truncate`, same as
  // every OTHER name in this file — wrong call here specifically: those are
  // short win/loss strips at ~1rem, where ellipsizing a long name still
  // leaves most of it readable; at this component's actual 2.3-3.3rem hero
  // scale the same fix cut a real name down to a single letter and an
  // ellipsis. `clamp()` (SceneShell.tsx's own SceneHeadline already sets
  // this precedent) shrinks the type itself on a narrow viewport instead,
  // and `overflowWrap: "anywhere"` lets a still-too-long name wrap onto a
  // second line rather than either overflowing or disappearing — full name
  // stays readable either way. Short numeric moves never get close to
  // wrapping at any real viewport width, so they render exactly as before.
  return (
    <div className="bug-chip-in flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
      <span className="font-bold tabular-nums min-w-0" style={{ color: "rgba(255,255,255,0.35)", fontSize: "clamp(1.1rem, 4.5vw, 2.3rem)", lineHeight: 1.15, textDecoration: "line-through", textDecorationColor: "rgba(255,255,255,0.3)", overflowWrap: "anywhere" }}>{before}</span>
      <span aria-hidden="true" className="shrink-0" style={{ color: accent, fontSize: "1.9rem" }}>{improved ? "↗" : "↘"}</span>
      <span className="font-black tabular-nums min-w-0" style={{ color: accent, fontSize: "clamp(1.3rem, 6vw, 3.3rem)", lineHeight: 1.1, textShadow: `0 0 26px ${withAlpha(accent, "70")}`, overflowWrap: "anywhere" }}>{after}</span>
    </div>
  );
}

/** A colour-filled badge pill — this skin's version of the reference image's "W5"/"UPSET"/"L3" streak badges and its "Dead Heat"/"Verified" call-out flags; one shape covers both uses. */
export function BigBadge({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <span
      className="badge-pop-in inline-flex items-center font-black uppercase self-start"
      style={{ background: accent, color: "#050810", padding: "7px 20px", fontSize: "0.88rem", letterSpacing: "0.05em", clipPath: "polygon(6% 0, 100% 0, 94% 100%, 0% 100%)", boxShadow: `0 0 20px ${withAlpha(accent, "55")}` }}
    >
      {children}
    </span>
  );
}

/** A plain supporting line at this skin's larger scale. */
export function BigLine({ children }: { children: ReactNode }) {
  return <div style={{ color: "rgba(255,255,255,0.68)", fontSize: "1.02rem", fontWeight: 600 }}>{children}</div>;
}

/** The versus split at this skin's scale — the same two-solid-plate chevron shape as v2's VersusPanel, sized up (genuinely large names, a thicker glowing split bar) for HeadToHeadGraphic's own BigBoard branch. */
export function BigVersus({
  leftName, rightName, leftAccent, rightAccent, splitFraction, splitLabel,
}: { leftName: string; rightName: string; leftAccent: string; rightAccent: string; splitFraction?: number; splitLabel?: string }) {
  // Same overflow class as BigMove above (this file's own comment there) —
  // HeadToHeadGraphic feeds this arbitrary player/team names at 1.7rem with
  // `whitespace-nowrap` and nothing to stop a long one pushing the whole
  // versus row (and BigPanel above it) past the viewport. `min-w-0` +
  // `flex: 1 1 0%` lets each name plate actually shrink; `clamp()` shrinks
  // the type itself on a narrow viewport and `overflowWrap: "anywhere"`
  // lets a still-too-long name wrap onto a second line — a bare `truncate`
  // was tried first and rejected here (see BigMove's own header): at this
  // hero scale it cut a real name down to a single letter and an ellipsis
  // rather than leaving it readable.
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-stretch min-w-0" style={{ gap: 3 }}>
        <div className="min-w-0" style={{ flex: "1 1 0%", background: leftAccent, clipPath: "polygon(0 0, 100% 0, 86% 100%, 0% 100%)", padding: "12px 20px", paddingRight: 40, boxShadow: `0 0 24px ${withAlpha(leftAccent, "44")}` }}>
          <span className="font-black uppercase block" style={{ color: "#050810", fontSize: "clamp(0.95rem, 4.6vw, 1.7rem)", lineHeight: 1.15, overflowWrap: "anywhere" }}>{leftName}</span>
        </div>
        <div className="flex items-center justify-center font-black shrink-0" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", letterSpacing: "0.06em" }}>VS</div>
        <div className="min-w-0" style={{ flex: "1 1 0%", background: rightAccent, clipPath: "polygon(14% 0, 100% 0, 100% 100%, 0% 100%)", padding: "12px 20px", paddingLeft: 40 }}>
          <span className="font-black uppercase block" style={{ color: "#050810", fontSize: "clamp(0.95rem, 4.6vw, 1.7rem)", lineHeight: 1.15, overflowWrap: "anywhere" }}>{rightName}</span>
        </div>
      </div>
      {splitFraction !== undefined && (
        <div className="flex flex-col gap-1.5">
          <div className="flex overflow-hidden" style={{ height: 10 }}>
            <div className="bar-wipe h-full" style={{ width: `${Math.max(0, Math.min(1, splitFraction)) * 100}%`, background: leftAccent, boxShadow: `0 0 14px ${withAlpha(leftAccent, "77")}` }} />
            <div className="h-full flex-1" style={{ background: rightAccent, opacity: 0.85 }} />
          </div>
          {splitLabel && <div className="text-center uppercase font-bold" style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.72rem", letterSpacing: "0.06em" }}>{splitLabel}</div>}
        </div>
      )}
    </div>
  );
}
