/** Shared practice stats types — kept here to avoid circular deps between scorers.tsx and game-scorer.tsx */

export type DartThrow = {
  seg: number;   // segment number (0=miss, 25=bull/outer bull)
  mult: number;  // 1=single, 2=double, 3=treble
  val: number;   // scored value
  phase: "scoring" | "checkout";  // scoring=score>170, checkout=score≤170
};

export type PracticeStats = {
  p1Darts: number;
  p1Score: number;
  p1_180s: number;
  p1CheckoutAttempts: number;
  p1CheckoutHits: number;
  dartLog: DartThrow[];
};
