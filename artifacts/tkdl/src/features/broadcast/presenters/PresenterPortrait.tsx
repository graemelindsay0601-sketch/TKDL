// TKDL LIVE — presenter portraits. Renders the real rendered artwork the
// user supplied (TKDL_LIVE_Hosts_Pack_Final, public/broadcast/hosts/*) —
// see presenter-config.ts's own header for the full history (a monogram
// badge, then a hand-drawn SVG face, both rejected before this pack arrived)
// and presenter-state.ts for which of the 8 poses a given scene/turn uses.
//
// If a specific emotion asset ever fails, fall back to that presenter's real
// neutral human portrait. If the neutral portrait itself is unavailable,
// omit the optional visual layer rather than replacing the human presenter
// with the earlier illustrated/emoji-style face.
import { useEffect, useState } from "react";
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
  const name = PRESENTERS[speaker].name;
  const requestedSrc = presenterPortraitSrc(speaker, state);
  const neutralSrc = presenterPortraitSrc(speaker, "neutral");
  const [src, setSrc] = useState(requestedSrc);

  useEffect(() => {
    setSrc(requestedSrc);
  }, [requestedSrc]);

  if (!src) return null;

  const handleError = () => {
    setSrc(current => current !== neutralSrc ? neutralSrc : "");
  };

  if (variant === "bust") {
    const height = Math.round(size / PORTRAIT_ASPECT);
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={height}
        style={{ width: size, height, display: "block" }}
        onError={handleError}
      />
    );
  }

  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 12%" }}
        onError={handleError}
      />
    </div>
  );
}
