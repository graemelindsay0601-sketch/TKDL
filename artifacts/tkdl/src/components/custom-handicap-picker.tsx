/**
 * Custom / Handicap game type — a "type your own starting score" tile shared
 * by Play's 1v1 setup and Practice's setup. Lets Player 1 and Player 2 start
 * on independent scores (e.g. Player 1 on 501, Player 2 on 301) instead of
 * picking from the fixed 301/501/701/1001 presets, for uneven matchups.
 *
 * Unlike every other GameTypeOption, this one isn't fetched from
 * /api/game-types — it's synthesized client-side from whatever the two
 * number inputs currently hold and handed to GameScorer exactly like a real
 * DB-backed game type. It always uses the "X01" engine, so it flows through
 * the same X01Scorer as 501/301/etc — see scorers.tsx's `p1StartingScore` /
 * `p2StartingScore` config fields for the per-player half of this feature.
 *
 * Deliberately scoped to the X01 engine only (see the user's own scoping:
 * live-scored Play/Practice, not the match-result submission forms, and not
 * Master501/Board Curse/Boss Battle/Card Clash).
 */
import { useState } from "react";
import type { GameTypeOption } from "./game-scorer";

export const CUSTOM_HANDICAP_KEY = "x01_handicap";
export const CUSTOM_HANDICAP_MIN = 2;
export const CUSTOM_HANDICAP_MAX = 1001;
const DEFAULT_SCORE = 501;

export function clampHandicapScore(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.min(CUSTOM_HANDICAP_MAX, Math.max(CUSTOM_HANDICAP_MIN, n));
}

export function buildCustomHandicapGameType(p1Score: number, p2Score: number, doubleOut: boolean): GameTypeOption {
  const isHandicap = p1Score !== p2Score;
  return {
    id: -1, // synthetic — never a real game_types row
    key: CUSTOM_HANDICAP_KEY,
    name: isHandicap ? `Handicap ${p1Score} v ${p2Score}` : `Custom ${p1Score}`,
    engine: "X01",
    category: "custom",
    description: isHandicap
      ? `Player 1 starts on ${p1Score}, Player 2 starts on ${p2Score}${doubleOut ? " · Double Out" : " · Straight Out"}`
      : `Both players start on ${p1Score}${doubleOut ? " · Double Out" : " · Straight Out"}`,
    config: JSON.stringify({
      startingScore:   Math.max(p1Score, p2Score), // fallback for any code that only reads the shared field
      p1StartingScore: p1Score,
      p2StartingScore: p2Score,
      doubleOut,
    }),
    enabled: true,
    rulesText: "Custom / Handicap X01 — each player picks their own starting score (2–1001) independently, so a stronger player can spot a weaker one extra points. Standard X01 scoring and finishing rules apply otherwise.",
  };
}

export function CustomHandicapCard({
  accent, selected, onSelect, onClear,
}: {
  accent: string;
  selected: boolean;
  /** Called with a freshly-built GameTypeOption whenever the tile is activated with valid inputs. */
  onSelect: (gameType: GameTypeOption) => void;
  /** Called when this tile is (or was) the active selection and its inputs become incomplete/invalid. */
  onClear: () => void;
}) {
  const [p1Raw, setP1Raw]         = useState(String(DEFAULT_SCORE));
  const [p2Raw, setP2Raw]         = useState(String(DEFAULT_SCORE));
  const [doubleOut, setDoubleOut] = useState(true);

  const emit = (raw1: string, raw2: string, d: boolean) => {
    const a = clampHandicapScore(raw1);
    const b = clampHandicapScore(raw2);
    if (a !== null && b !== null) onSelect(buildCustomHandicapGameType(a, b, d));
    else onClear();
  };

  const p1n = clampHandicapScore(p1Raw);
  const p2n = clampHandicapScore(p2Raw);
  const invalid = p1n === null || p2n === null;

  return (
    <div
      onClick={() => emit(p1Raw, p2Raw, doubleOut)}
      className="pdc-card p-3 transition-all relative overflow-hidden sm:col-span-2"
      style={{
        borderColor: selected ? accent : "rgba(255,255,255,0.07)",
        background:  selected ? `${accent}0f` : "rgba(255,255,255,0.02)",
        boxShadow:   selected ? `0 0 18px ${accent}26` : undefined,
        cursor: "pointer",
      }}>
      {selected && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />}
      <div className="font-bold text-sm mb-0.5" style={{ fontFamily: "Oswald, sans-serif", color: selected ? "#fff" : "rgba(255,255,255,0.75)", letterSpacing: "0.05em" }}>
        🎚️ Custom / Handicap
      </div>
      <div className="text-xs mb-3 leading-tight" style={{ color: "rgba(255,255,255,0.3)" }}>
        Type each player's own starting score ({CUSTOM_HANDICAP_MIN}–{CUSTOM_HANDICAP_MAX}) — great for spotting a weaker player extra points.
      </div>
      <div className="grid grid-cols-2 gap-3" onClick={e => e.stopPropagation()}>
        <label className="block">
          <div className="text-xs font-bold uppercase mb-1" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e", letterSpacing: "0.08em" }}>Player 1</div>
          <input
            type="number" inputMode="numeric" min={CUSTOM_HANDICAP_MIN} max={CUSTOM_HANDICAP_MAX} value={p1Raw}
            onChange={e => { setP1Raw(e.target.value); emit(e.target.value, p2Raw, doubleOut); }}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "Oswald, sans-serif" }} />
        </label>
        <label className="block">
          <div className="text-xs font-bold uppercase mb-1" style={{ fontFamily: "Oswald, sans-serif", color: "#ee0a78", letterSpacing: "0.08em" }}>Player 2</div>
          <input
            type="number" inputMode="numeric" min={CUSTOM_HANDICAP_MIN} max={CUSTOM_HANDICAP_MAX} value={p2Raw}
            onChange={e => { setP2Raw(e.target.value); emit(p1Raw, e.target.value, doubleOut); }}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "Oswald, sans-serif" }} />
        </label>
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); const nv = !doubleOut; setDoubleOut(nv); emit(p1Raw, p2Raw, nv); }}
        className="mt-3 flex items-center gap-2 text-xs font-bold uppercase"
        style={{ fontFamily: "Oswald, sans-serif", color: doubleOut ? accent : "rgba(255,255,255,0.35)", cursor: "pointer" }}>
        <span style={{ width: 14, height: 14, borderRadius: 4, border: `1px solid ${doubleOut ? accent : "rgba(255,255,255,0.3)"}`, background: doubleOut ? accent : "transparent", display: "inline-block" }} />
        Double Out
      </button>
      {invalid && (
        <div className="mt-2 text-xs" style={{ color: "#ff005c" }}>
          Enter a score between {CUSTOM_HANDICAP_MIN} and {CUSTOM_HANDICAP_MAX} for both players.
        </div>
      )}
    </div>
  );
}
