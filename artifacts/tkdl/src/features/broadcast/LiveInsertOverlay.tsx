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
      data-broadcast-region="live-overlay"
      role="status"
      aria-live={overlay.overlayClass === "breaking" ? "assertive" : "polite"}
      className="fixed left-0 right-0 top-12 z-50 flex justify-center pointer-events-none"
    >
      <div
        className="flex items-stretch shadow-2xl pointer-events-auto"
        style={{
          background: "rgba(6,4,14,0.96)",
          borderBottom: `3px solid ${accent}`,
          boxShadow: `0 12px 40px rgba(0,0,0,0.8), 0 0 30px ${accent}44`,
          animation: "tkdl-live-insert-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          width: "90%",
          maxWidth: 720,
          clipPath: "polygon(0 0, 100% 0, 97% 100%, 0 100%)",
        }}
      >
        <div
          className="flex flex-col items-center justify-center pl-3 pr-5 py-3 shrink-0 sm:pl-4 sm:pr-8"
          style={{ background: accent, clipPath: "polygon(0 0, 100% 0, 85% 100%, 0 100%)" }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-white mb-1" style={{ animation: "live-pulse 1s infinite" }} />
          <span className="font-black uppercase text-white" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", letterSpacing: "0.15em" }}>
            {OVERLAY_CLASS_LABEL[overlay.overlayClass]}
          </span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center px-3 py-2 relative sm:px-5">
          <div
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: leagueAccent, fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em", fontSize: "0.6rem" }}
          >
            {LEAGUE_LABEL[overlay.leagueType]}
          </div>
          <div data-broadcast-overlay-subject className="font-black uppercase truncate text-white leading-tight text-base sm:text-xl" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.03em" }}>
            {subjects || humanizeStoryType(overlay.storyType)}
          </div>
          <div className="text-xs font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em" }}>
            {humanizeStoryType(overlay.storyType)}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="mr-3 shrink-0 w-8 h-8 flex items-center justify-center text-sm self-center hover:bg-white/10 transition-colors sm:mr-6"
          style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "50%" }}
        >
          ✕
        </button>
      </div>
      <style>{`
        @keyframes tkdl-live-insert-in {
          from { opacity: 0; transform: translateY(-20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
