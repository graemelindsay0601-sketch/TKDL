/** Trophy ids with a physically based design (kept separate so the runner needs no WebGL to list them). */
export const FAMILY_IDS = ["silver-cup", "championship-cup", "tall-championship", "silver-bowl", "championship-plate", "traditional-shield",
  "wood-silver-shield", "crystal-column", "cut-glass", "metal-sculpture", "dart-sculpture", "international-globe", "regional-craft",
  "vault-geometric", "youth-rising-star", "double-crown", "open-masters-heritage", "sovereign"];
/** Event-specific designs (award presentation policy v2). */
export const EVENT_DESIGN_IDS = ["ec-continental-crest", "wwc-crystal-flame", "ywc-star-orb", "junior-star-cup", "open-finals-compass", "awm-globe-cup",
  "amateur-masters-tankard", "league-shield-ring", "snooker-darts-cup", "treble-triangles", "noughts-crosses-block", "cricket-scoreboard"];
export const DESIGN_IDS = [...FAMILY_IDS, ...EVENT_DESIGN_IDS];
