/** Shared practice stats types — kept here to avoid circular deps between scorers.tsx and game-scorer.tsx */

export type DartThrow = {
  seg: number;   // segment number (0=miss, 25=bull/outer bull)
  mult: number;  // 1=single, 2=double, 3=treble
  val: number;   // scored value
  phase: "scoring" | "checkout";  // scoring=score>170, checkout=score≤170
};

export type PracticeStats = {
  // X01-specific (all optional — not all modes have these concepts)
  p1Darts?: number;
  p1Score?: number;
  p1_180s?: number;
  p1CheckoutAttempts?: number;
  p1CheckoutHits?: number;
  dartLog?: DartThrow[];
  // P2 stats — only populated in human-vs-human sessions (no bot)
  p2Darts?: number;
  p2Score?: number;
  p2_180s?: number;
  p2CheckoutAttempts?: number;
  p2CheckoutHits?: number;
  p2DartLog?: DartThrow[];
  // Mode-specific stats stored as JSON — e.g. Cricket marks, Golf strokes, etc.
  sessionData?: Record<string, unknown>;
};
