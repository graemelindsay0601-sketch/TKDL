// TKDL LIVE — the JUST_IN / BREAKING insert banner (handover doc 11.4).
// This is the temporary, mid-programme interrupt itself — NOT a scene
// (scenes/*.tsx, paused pending host-design collaboration since they
// compose the presenter cast): a self-contained banner that can be dropped
// over whatever the player is currently showing, using a plain data card
// rather than any presenter portrait or studio background. Auto-dismisses
// after a fixed on-screen hold (8-12s for JUST_IN per 11.4's own range;
// BREAKING holds a little longer, being the more significant class) unless
// the caller unmounts it sooner.
import { useEffect, useRef } from "react";
import type { LiveOverlayItem } from "./types";
import { LEAGUE_ACCENT, LEAGUE_LABEL, OVERLAY_CLASS_LABEL, OVERLAY_CLASS_ACCENT, humanizeStoryType } from "./theme";

export type LiveInsertOverlayProps = {
  overlay: LiveOverlayItem;
  /** `${leagueType}:${entityId}` -> display name for the entities in `overlay.subjectKeys` (see LiveTicker's own namesByKey for why resolving names is the caller's job, not this component's — and why both share one map built by useEntityNames()). subjectKeys already use this exact composite-key format (story-engine-math.ts's own subjectKey()). */
  namesBySubjectKey: ReadonlyMap<string, string>;
  onDismiss: () => void;
};

const HOLD_MS: Record<LiveOverlayItem["overlayClass"], number> = { just_in: 10_000, breaking: 14_000 };

export function LiveInsertOverlay({ overlay, namesBySubjectKey, onDismiss }: LiveInsertOverlayProps) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), HOLD_MS[overlay.overlayClass]);
    return () => clearTimeout(timer);
    // Re-arms only when this is genuinely a different overlay (by storyId) — not on every onDismiss identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay.storyId, overlay.overlayClass]);

  const accent = OVERLAY_CLASS_ACCENT[overlay.overlayClass];
  const leagueAccent = LEAGUE_ACCENT[overlay.leagueType];
  const subjects = overlay.subjectKeys.map(key => namesBySubjectKey.get(key) ?? key).join(" & ");

  return (
    <div
      role="status"
      aria-live={overlay.overlayClass === "breaking" ? "assertive" : "polite"}
      className="fixed left-1/2 top-8 z-50 -translate-x-1/2 flex items-center gap-4 rounded-xl px-6 py-4 shadow-2xl"
      style={{
        background: "rgba(6,4,14,0.94)",
        border: `2px solid ${accent}`,
        boxShadow: `0 0 40px ${accent}55`,
        fontFamily: "Oswald, sans-serif",
        animation: "tkdl-live-insert-in 0.35s ease-out",
        maxWidth: "min(90vw, 640px)",
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg shrink-0"
        style={{ background: `${accent}22`, border: `1px solid ${accent}` }}
      >
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} />
        <span className="font-black uppercase text-xs" style={{ color: accent, letterSpacing: "0.18em" }}>
          {OVERLAY_CLASS_LABEL[overlay.overlayClass]}
        </span>
      </div>
      <div className="min-w-0">
        <div
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: leagueAccent, letterSpacing: "0.12em", fontSize: "0.6rem" }}
        >
          {LEAGUE_LABEL[overlay.leagueType]}
        </div>
        <div className="font-black uppercase truncate text-white leading-tight" style={{ fontSize: "1.1rem", letterSpacing: "0.03em" }}>
          {subjects || humanizeStoryType(overlay.storyType)}
        </div>
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
          {humanizeStoryType(overlay.storyType)}
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ml-2 shrink-0 rounded-full w-6 h-6 flex items-center justify-center text-xs"
        style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.15)" }}
      >
        ✕
      </button>
      <style>{`
        @keyframes tkdl-live-insert-in {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
