// TKDL LIVE — frontend types (handover doc sections 14.4/14.5). These
// deliberately MIRROR the backend's response shapes exactly
// (artifacts/api-server/src/broadcast/api-shapes.ts and live-events.ts) —
// there is no shared package between the two apps for this feature, so
// keeping them hand-in-sync here is the same trade-off the rest of this
// frontend already makes for its other hand-rolled `fetch()`-based features
// (card-clash, challenges, etc. all define their own local response types
// rather than importing backend types directly).

export type LeagueType = "singles" | "doubles" | "shift_wars";

// ── 14.5 segment shape ──────────────────────────────────────────────────

export type Scene = "desk" | "analysis" | "graphic" | "result" | "headlines" | "breaking" | "spotlight" | "champion";

export type GraphicKind =
  | "LeagueTableGraphic" | "TitlePredictorGraphic" | "MatchContextGraphic"
  | "HeadToHeadGraphic" | "FormWatchGraphic" | "WagerGraphic" | "ResultGraphic";

export type DialogueTurn = { speaker: "A" | "B"; text: string; pose?: string; holdSeconds: number };

/** The story's own already-verified facts backing this segment's claim (api-shapes.ts's own graphic.data contract) — a flat, story-type-dependent bag of named numbers/strings, not a fixed per-kind shape. */
export type GraphicData = Record<string, unknown>;

export type Segment = {
  id: string;
  type: string;
  leagueType: LeagueType | null;
  storyId: number | null;
  /** The real underlying Treatment value (director-math.ts) — can be "major" | "featured" | "supporting" | "headline_ticker" | "archive" | "utility", not only the four 14.5 illustrates. */
  importance: string;
  scene: Scene;
  dialogue: DialogueTurn[];
  graphic: { kind: GraphicKind; data: GraphicData } | null;
  /**
   * CHAMPION-only — mirrors api-shapes.ts's own ApiSegment.championInfo.
   * CHAMPION never carries `graphic` (StudioSet.tsx/ChampionScene.tsx's own
   * "no card" design — see api-shapes.ts's comment), so this is the only
   * place the champion's actual name (and, once available, which season)
   * ever reaches the frontend. `seasonName` is null for a champion crowned
   * before this field existed and never revisited since.
   */
  championInfo: { championName: string; seasonName: string | null } | null;
  /** Opaque from the frontend's own point of view — only ever compared by identity against `invalidSegmentIds` (11.6), never interpreted client-side. */
  validityRules: unknown[];
  estimatedSeconds: number;
};

export type SlotType = "midday" | "evening" | "night" | "manual";

// ── 14.4 current-edition response ───────────────────────────────────────

export type CurrentEdition = {
  id: number;
  slotKey: string;
  slotType: SlotType;
  generatedAt: string;
  dataCutoff: string;
  title: string;
  headlines: Segment[];
  segments: Segment[];
};

export type BroadcastChannel = { nextLogicalSlot: string; programmeVersion: number; commentaryVersion: number };

export type CurrentEditionResponse = {
  /** null per 17's own "No previous Edition exists" fallback row — nothing has cleared the quality gate yet; the player should show a live standings/results view instead of an empty programme. */
  edition: CurrentEdition | null;
  channel: BroadcastChannel;
  live: { pollSeconds: number };
};

// ── 11.4/11.5/11.6 live payload (GET /api/broadcast/live) ───────────────

export type LiveLeader = { entityId: number; name: string; points: number } | null;
export type LiveLeaders = { singles: LiveLeader; doubles: LiveLeader; shift_wars: LiveLeader };

export type LiveTickerItem = { matchId: number; leagueType: LeagueType; winnerId: number; loserId: number; playedAt: string };

export type LiveOverlayClass = "just_in" | "breaking";
export type LiveOverlayItem = {
  storyId: number;
  leagueType: LeagueType;
  storyType: string;
  subjectKeys: string[];
  score: number;
  overlayClass: LiveOverlayClass;
};

export type LivePayload = {
  leaders: LiveLeaders;
  tickerItems: LiveTickerItem[];
  overlays: LiveOverlayItem[];
  /** Segment ids (api-shapes.ts's `slot-N` scheme) the player must skip if it hasn't played them yet — 11.6/15.4. */
  invalidSegmentIds: string[];
};

// ── Title Predictor snapshot (GET /api/broadcast/predictor/:league) ─────

export type StoredStandingSnapshot = {
  entityId: number;
  points: number;
  wins: number;
  losses: number;
  titleProbability: number;
  isEliminated: boolean;
};

export type PredictorResponse = {
  league: LeagueType;
  generatedAt: string | null;
  modelVersion: string | null;
  standings: StoredStandingSnapshot[];
};

// ── Feature-status (GET /api/broadcast/status) — same shape every other
// beta feature's status endpoint already returns (see useFeatureFlags.tsx) ─

export type BroadcastFeatureStatus = {
  available: boolean;
  liveForAll: boolean;
  adminTestMode: boolean;
  isAdmin?: boolean;
};
