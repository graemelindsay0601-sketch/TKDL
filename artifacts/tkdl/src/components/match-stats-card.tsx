import { type PracticeStats } from "@/lib/stats-types";

type StatRowProps = {
  label: string;
  v1: string;
  v2: string;
  higherIsBetter?: boolean;
  raw1?: number;
  raw2?: number;
  accentColor: string;
  winnerIdx: 0 | 1;
};

function StatRow({ label, v1, v2, raw1, raw2, accentColor, winnerIdx }: StatRowProps) {
  const r1 = raw1 ?? 0;
  const r2 = raw2 ?? 0;
  const p1Better = r1 > r2;
  const p2Better = r2 > r1;

  return (
    <div className="flex items-center gap-2 py-2"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="flex-1 text-right">
        <span
          className="text-lg font-black tabular-nums"
          style={{
            fontFamily: "Oswald, sans-serif",
            color: p1Better ? "#fff" : "rgba(255,255,255,0.45)",
            textShadow: p1Better && winnerIdx === 0 ? `0 0 20px ${accentColor}88` : undefined,
          }}>
          {v1}
        </span>
      </div>
      <div className="w-24 text-center shrink-0">
        <span className="text-xs font-bold uppercase tracking-wider"
          style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
          {label}
        </span>
      </div>
      <div className="flex-1 text-left">
        <span
          className="text-lg font-black tabular-nums"
          style={{
            fontFamily: "Oswald, sans-serif",
            color: p2Better ? "#fff" : "rgba(255,255,255,0.45)",
            textShadow: p2Better && winnerIdx === 1 ? `0 0 20px ${accentColor}88` : undefined,
          }}>
          {v2}
        </span>
      </div>
    </div>
  );
}

export function MatchStatsCard({
  p1Name, p2Name,
  stats,
  winnerIdx,
  accentColor = "#ff005c",
}: {
  p1Name: string;
  p2Name: string;
  stats: PracticeStats;
  winnerIdx: 0 | 1;
  accentColor?: string;
}) {
  const { p1Darts, p1Score, p1_180s, p1CheckoutAttempts, p1CheckoutHits,
          p2Darts, p2Score, p2_180s, p2CheckoutAttempts, p2CheckoutHits } = stats;

  const hasX01Stats = typeof p1Darts === "number" && typeof p1Score === "number" && p1Darts > 0;
  if (!hasX01Stats) return null;

  const p1Avg = Math.round((p1Score! / p1Darts!) * 3 * 10) / 10;
  const p2Avg = (typeof p2Darts === "number" && typeof p2Score === "number" && p2Darts > 0)
    ? Math.round((p2Score / p2Darts) * 3 * 10) / 10
    : null;

  const p1CoStr = (p1CheckoutAttempts ?? 0) > 0
    ? `${p1CheckoutHits ?? 0}/${p1CheckoutAttempts} (${Math.round(((p1CheckoutHits ?? 0) / p1CheckoutAttempts!) * 100)}%)`
    : "—";
  const p2CoStr = (p2CheckoutAttempts ?? 0) > 0
    ? `${p2CheckoutHits ?? 0}/${p2CheckoutAttempts} (${Math.round(((p2CheckoutHits ?? 0) / p2CheckoutAttempts!) * 100)}%)`
    : "—";

  const p1CoPct = (p1CheckoutAttempts ?? 0) > 0 ? (p1CheckoutHits ?? 0) / p1CheckoutAttempts! : 0;
  const p2CoPct = (p2CheckoutAttempts ?? 0) > 0 ? (p2CheckoutHits ?? 0) / p2CheckoutAttempts! : 0;

  return (
    <div className="pdc-card p-4" style={{ borderColor: `${accentColor}22` }}>
      <div className="text-xs uppercase tracking-widest font-bold mb-3 text-center"
        style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.15em" }}>
        Match Stats
      </div>

      {/* Player name headers */}
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 text-right">
          <span className="text-sm font-black uppercase tracking-wide"
            style={{
              fontFamily: "Oswald, sans-serif",
              color: winnerIdx === 0 ? "#fff" : "rgba(255,255,255,0.35)",
            }}>
            {p1Name}
            {winnerIdx === 0 && <span className="ml-1.5 text-xs" style={{ color: accentColor }}>🏆</span>}
          </span>
        </div>
        <div className="w-24 shrink-0" />
        <div className="flex-1 text-left">
          <span className="text-sm font-black uppercase tracking-wide"
            style={{
              fontFamily: "Oswald, sans-serif",
              color: winnerIdx === 1 ? "#fff" : "rgba(255,255,255,0.35)",
            }}>
            {winnerIdx === 1 && <span className="mr-1.5 text-xs" style={{ color: accentColor }}>🏆</span>}
            {p2Name}
          </span>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${accentColor}22`, marginBottom: "0.25rem" }} />

      <StatRow
        label="3-Dart Avg"
        v1={p1Avg.toFixed(1)}
        v2={p2Avg !== null ? p2Avg.toFixed(1) : "—"}
        raw1={p1Avg}
        raw2={p2Avg ?? 0}
        accentColor={accentColor}
        winnerIdx={winnerIdx}
      />
      <StatRow
        label="Darts"
        v1={String(p1Darts)}
        v2={typeof p2Darts === "number" ? String(p2Darts) : "—"}
        raw1={1 / p1Darts!}
        raw2={typeof p2Darts === "number" ? 1 / p2Darts : 0}
        accentColor={accentColor}
        winnerIdx={winnerIdx}
      />
      <StatRow
        label="180s"
        v1={String(p1_180s ?? 0)}
        v2={String(p2_180s ?? 0)}
        raw1={p1_180s ?? 0}
        raw2={p2_180s ?? 0}
        accentColor={accentColor}
        winnerIdx={winnerIdx}
      />
      <StatRow
        label="Checkout"
        v1={p1CoStr}
        v2={p2CoStr}
        raw1={p1CoPct}
        raw2={p2CoPct}
        accentColor={accentColor}
        winnerIdx={winnerIdx}
      />
    </div>
  );
}
