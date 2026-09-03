// TKDL LIVE — presenter portraits. Renders the real rendered artwork the
// user supplied (TKDL_LIVE_Hosts_Pack_Final, public/broadcast/hosts/*) —
// see presenter-config.ts's own header for the full history (a monogram
// badge, then a hand-drawn SVG face, both rejected before this pack arrived)
// and presenter-state.ts for which of the 8 poses a given scene/turn uses.
//
// The hand-drawn SVG faces from the previous pass are kept as an onError
// fallback, not deleted — the asset pack's own README is explicit: "The
// host artwork should remain an optional visual layer. If an image ever
// fails to load, the dialogue/graphics must still render." A broken <img>
// icon would violate that; a simplified drawn face doesn't.
import { useState } from "react";
import { PRESENTERS, presenterPortraitSrc, type PresenterId, type PresenterState } from "./presenter-config";

export type PresenterPortraitProps = {
  speaker: PresenterId;
  size: number;
  state?: PresenterState;
  /** "badge": cropped to a circle for the small identity marker next to a dialogue line. "bust": the full transparent-background cutout, uncropped — the real "at the desk" presence used where there's room to show it properly (DeskScene). */
  variant?: "badge" | "bust";
};

// Portrait canvas is 1200x1600 (3:4) — see host_manifest.json. A badge crops
// to a circle from near the top of the frame (where the face actually is);
// a bust shows the whole cutout at that same aspect ratio.
const PORTRAIT_ASPECT = 1200 / 1600;

export function PresenterPortrait({ speaker, size, state = "neutral", variant = "badge" }: PresenterPortraitProps) {
  const [failed, setFailed] = useState(false);
  const name = PRESENTERS[speaker].name;

  if (failed) return <PresenterPortraitFallback speaker={speaker} size={size} />;

  if (variant === "bust") {
    const height = Math.round(size / PORTRAIT_ASPECT);
    return (
      <img
        src={presenterPortraitSrc(speaker, state)}
        alt={name}
        width={size}
        height={height}
        style={{ width: size, height, display: "block", filter: "drop-shadow(0 16px 28px rgba(0,0,0,0.55))" }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
      <img
        src={presenterPortraitSrc(speaker, state)}
        alt={name}
        width={size}
        height={size}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 12%" }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// ── onError fallback (previous hand-drawn-SVG pass, kept for resilience) ──

function ChalkyFallbackFace() {
  return (
    <>
      <path d="M20 70 Q50 50 80 70 L84 100 L16 100 Z" fill="#0066ff" />
      <path d="M32 62 Q50 72 68 62 L68 78 Q50 86 32 78 Z" fill="#e0a978" />
      <circle cx="50" cy="42" r="26" fill="#e9b98a" />
      <path d="M24 40 Q24 14 50 14 Q76 14 76 40 Q76 30 68 27 Q66 20 50 20 Q34 20 32 27 Q24 30 24 40 Z" fill="#2b2118" />
      <rect x="30" y="38" width="16" height="12" rx="4" fill="none" stroke="#1a1a1a" strokeWidth="2.4" />
      <rect x="54" y="38" width="16" height="12" rx="4" fill="none" stroke="#1a1a1a" strokeWidth="2.4" />
      <line x1="46" y1="43" x2="54" y2="43" stroke="#1a1a1a" strokeWidth="2.4" />
      <circle cx="40" cy="44" r="2.1" fill="#1a1a1a" />
      <circle cx="60" cy="44" r="2.1" fill="#1a1a1a" />
      <path d="M40 58 Q50 62 60 58" fill="none" stroke="#a3673f" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function TonFallbackFace() {
  return (
    <>
      <path d="M20 70 Q50 50 80 70 L84 100 L16 100 Z" fill="#ff005c" />
      <path d="M32 62 Q50 72 68 62 L68 78 Q50 86 32 78 Z" fill="#c98a5c" />
      <circle cx="50" cy="42" r="26" fill="#d9a074" />
      <path d="M22 38 Q26 12 50 12 Q74 10 78 34 Q68 24 58 26 Q52 16 44 24 Q34 20 30 30 Q24 30 22 38 Z" fill="#1c1410" />
      <path d="M34 34 Q40 30 46 34" fill="none" stroke="#1c1410" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M55 33 Q61 27 68 31" fill="none" stroke="#1c1410" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="40" cy="41" r="2.3" fill="#1a1a1a" />
      <circle cx="61" cy="40" r="2.3" fill="#1a1a1a" />
      <path d="M39 58 Q50 63 63 55" fill="none" stroke="#8a4a2c" strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

function PresenterPortraitFallback({ speaker, size }: { speaker: PresenterId; size: number }) {
  const ringColor = PRESENTERS[speaker].accent;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={PRESENTERS[speaker].name}>
      <defs>
        <clipPath id={`portrait-fallback-clip-${speaker}`}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="49" fill="#0d0b14" stroke={ringColor} strokeWidth="2" />
      <g clipPath={`url(#portrait-fallback-clip-${speaker})`}>
        {speaker === "A" ? <ChalkyFallbackFace /> : <TonFallbackFace />}
      </g>
    </svg>
  );
}
