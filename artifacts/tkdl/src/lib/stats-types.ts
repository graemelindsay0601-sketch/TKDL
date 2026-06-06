/** Shared practice stats types — kept here to avoid circular deps between scorers.tsx and game-scorer.tsx */
export type PracticeStats = {
  p1Darts: number;
  p1Score: number;
  p1_180s: number;
  p1CheckoutAttempts: number;
  p1CheckoutHits: number;
};
