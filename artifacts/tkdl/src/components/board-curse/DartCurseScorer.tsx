// Board Curse for Around the World and Halve-It: a fresh curse each visit for whoever's throwing,
// applied by rewriting their darts (lib/board-curse-dart.ts).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flame } from "lucide-react";
import { SequenceScorer, HalveItScorer } from "@/lib/scorers";
import type { BotConfig } from "@/lib/bot-engine";
import type { Dart } from "@/lib/dartboard";
import { createCurseRandom, type CurseTier } from "@/lib/board-curse-data";
import { applyDartCurse, dartTierFor, rollDartCurse, type DartCurse, type DartCurseMode } from "@/lib/board-curse-dart";
import type { BoardCurseResult } from "@/components/BoardCurseScorer";
import "./curse-run.css";

const TIER_COLOR: Record<CurseTier, string> = { 1: "#ffb400", 2: "#ff6a00", 3: "#ff1744" };

export function DartCurseScorer({ gameMode, format, p1Name, p2Name, botConfig, seed, topBanner, onMatchComplete, onAbandon }: {
  gameMode: DartCurseMode; format: "solo" | "bot" | "local"; p1Name: string; p2Name: string; botConfig?: BotConfig;
  seed?: string; topBanner?: React.ReactNode;
  onMatchComplete: (r: BoardCurseResult & { finalScore?: number }) => void; onAbandon: () => void;
}) {
  const rng = useRef<() => number>(seed ? createCurseRandom(seed) : Math.random);
  const visits = useRef<[number, number]>([0, 0]);
  const recent = useRef<string[]>([]);
  const roll = (who: 0 | 1) => {
    visits.current[who] += 1;
    const c = rollDartCurse(gameMode, dartTierFor(visits.current[who]), recent.current, rng.current);
    recent.current = [c.id, ...recent.current].slice(0, 3);
    return c;
  };
  const [curse, setCurse] = useState<{ c: DartCurse; who: 0 | 1 }>(() => ({ c: roll(0), who: 0 }));
  const curseRef = useRef(curse);
  const [flash, setFlash] = useState<{ c: DartCurse; who: 0 | 1 } | null>(curse);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 3200); return () => clearTimeout(t); }, [flash]);
  const done = useRef(false);
  const names: [string, string] = [p1Name, p2Name];
  const who = (t: 0 | 1) => format === "solo" ? "you" : names[t];

  const dartFilter = (d: Dart, index: number, turn: 0 | 1): Dart => {
    const out = applyDartCurse(curseRef.current.c, d, index);
    if (index === 2) {
      // Visit over: the next thrower gets a fresh curse.
      const next: 0 | 1 = format === "solo" ? 0 : turn === 0 ? 1 : 0;
      const n = { c: roll(next), who: next };
      curseRef.current = n; setCurse(n); setFlash(n);
    }
    return out;
  };

  const finish = (winnerIdx: 0 | 1, detail?: string) => {
    if (done.current) return; done.current = true;
    const score = detail && /^-?\d+ points$/.test(detail) ? parseInt(detail, 10) : undefined;
    onMatchComplete({ winnerIdx, detail, visitsTaken: visits.current[0], cursesFaced: [], finalScore: score });
  };

  const color = TIER_COLOR[curse.c.tier];
  const banner = (
    <>
      {topBanner}
      <div className="dc-readout" style={{ "--c": color } as React.CSSProperties}>
        <Flame size={18} />
        <div><small>Active curse ({who(curse.who)})</small><strong>{curse.c.name}</strong></div>
        <p>{curse.c.description}</p>
      </div>
    </>
  );

  return (
    <div style={{ position: "relative" }}>
      {flash && typeof document !== "undefined" && createPortal(
        <div className="dc-flash" style={{ "--c": TIER_COLOR[flash.c.tier] } as React.CSSProperties}>
          <small><Flame size={13} />New curse — hits {who(flash.who)}<Flame size={13} /></small>
          <strong>{flash.c.name}</strong>
          <p>{flash.c.description}</p>
        </div>, document.body)}
      {gameMode === "ATW" ? (
        <SequenceScorer soloMode={format === "solo"} p1Name={p1Name} p2Name={p2Name} config={{ type: "sequential", maxNumber: 20, includeBull: true }}
          gameKey="around_the_world" botConfig={botConfig} onWin={finish} onAbandon={onAbandon} topBanner={banner} newScoringUI dartFilter={dartFilter} />
      ) : (
        <HalveItScorer soloMode={format === "solo"} p1Name={p1Name} p2Name={p2Name} gameKey="halve_it" botConfig={botConfig}
          onWin={finish} onAbandon={onAbandon} topBanner={banner} newScoringUI dartFilter={dartFilter} />
      )}
    </div>
  );
}
