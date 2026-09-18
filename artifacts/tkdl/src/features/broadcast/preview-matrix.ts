import type { LiveOverlayClass, ProgrammeMode, Scene } from "./types";

export const PREVIEW_MODES: readonly ProgrammeMode[] = [
  "NEWS",
  "BALANCED",
  "MAGAZINE",
  "SEASON_REVIEW",
];

export const PREVIEW_SCENES: readonly Scene[] = [
  "desk",
  "headlines",
  "result",
  "analysis",
  "spotlight",
  "graphic",
  "breaking",
  "champion",
];

export const PREVIEW_OVERLAYS = ["none", "just_in", "breaking"] as const satisfies readonly (LiveOverlayClass | "none")[];

export type PreviewOverlay = (typeof PREVIEW_OVERLAYS)[number];

export function buildPreviewPath({
  scene,
  mode,
  turn,
  overlay = "none",
}: {
  scene: Scene;
  mode: ProgrammeMode;
  turn: number;
  overlay?: PreviewOverlay;
}) {
  const params = new URLSearchParams({
    scene,
    mode,
    turn: String(turn),
    overlay,
  });
  return `/__tkdl-live-preview?${params.toString()}`;
}

export const PREVIEW_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
} as const;