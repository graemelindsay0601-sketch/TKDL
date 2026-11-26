import { Ghost } from "lucide-react";
import { remainingTimeline } from "@/lib/ghost";

export type GhostLeg = { darts: number; playedAt: string; values: number[]; mults: number[] };

/** A slim bar inside the scorer: where your best leg was after the same number of darts. */
export function GhostBanner({ ghost, start, doubleOut, myValues, myMults }: { ghost: GhostLeg; start: number; doubleOut: boolean; myValues: number[]; myMults: number[] }) {
  const g = remainingTimeline(ghost.values, ghost.mults, start, doubleOut);
  const mine = remainingTimeline(myValues, myMults, start, doubleOut);
  const k = myValues.length, myRem = mine[mine.length - 1];
  const ghostDone = k >= ghost.darts, gRem = g[Math.min(k, g.length - 1)];
  const diff = gRem - myRem; // positive: you're ahead (less left)
  const tone = ghostDone ? "#ff5c93" : diff > 0 ? "#3ee0b4" : diff < 0 ? "#ff5c93" : "#ffd24a";
  const text = ghostDone ? `Your ghost finished in ${ghost.darts} darts`
    : k === 0 ? `Racing your best leg: ${ghost.darts} darts`
    : diff === 0 ? `Level with your ghost on ${gRem}` : diff > 0 ? `${diff} ahead of your ghost (on ${gRem})` : `${-diff} behind your ghost (on ${gRem})`;
  return (
    <div className="pm-ghost" style={{ ["--gc" as string]: tone }}>
      <Ghost className="w-4 h-4" />
      <span className="t">{text}</span>
      <span className="bar"><i style={{ width: `${Math.min(100, (k / ghost.darts) * 100)}%` }} /></span>
    </div>
  );
}
