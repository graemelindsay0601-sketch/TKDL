/**
 * Uneven Teams — the game-type tiles for play.tsx's "Uneven Teams" format
 * (any side size vs any side size, e.g. 1v2, 2v3 — see play.tsx's own
 * FORMAT_OPTIONS entry for the format itself, and scorers.tsx's
 * TeamX01Scorer/TeamCricketScorer turnOrder="full-pass" doc for the turn
 * mechanics this format relies on).
 *
 * Deliberately NOT named "Handicap" despite that being the natural word
 * for it — custom-handicap-picker.tsx already owns that name for a
 * completely different mechanic (each 1v1 player typing their own
 * DIFFERENT starting score, e.g. 501 v 301). This format's "handicap" is
 * the opposite kind: both sides start on the SAME score, and the bigger
 * side's edge comes entirely from getting more throws per round by having
 * more people to get through — not from a score head start. Two different
 * things, so two different names, to keep them from getting conflated in
 * the UI or in conversation about the app.
 *
 * Same "synthesized client-side, not fetched from /api/game-types" pattern
 * as CustomHandicapCard — see that file's own header for why. Both tiles
 * here read a single shared starting condition (one starting score for
 * X01, one cut-throat toggle for Cricket) since the format is "same target
 * for both sides, different-sized sides", not a per-player head start.
 */
import { useState } from "react";
import type { GameTypeOption } from "./game-scorer";

export const UNEVEN_X01_KEY = "uneven_teams_x01";
export const UNEVEN_CRICKET_KEY = "uneven_teams_cricket";

// 2–2001: matches the widest range already established elsewhere in the
// app for an X01 starting score — 2 is custom-handicap-picker.tsx's own
// floor, 2001 is the highest real preset (app.ts's "2001_double_out",
// "Ultra-endurance… the ultimate long-session challenge") rather than an
// arbitrary new ceiling.
export const UNEVEN_X01_MIN = 2;
export const UNEVEN_X01_MAX = 2001;
const DEFAULT_X01_SCORE = 501;

export function clampUnevenX01Score(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.min(UNEVEN_X01_MAX, Math.max(UNEVEN_X01_MIN, n));
}

export function buildUnevenX01GameType(startingScore: number, doubleOut: boolean): GameTypeOption {
  return {
    id: -1, // synthetic — never a real game_types row, same convention as CustomHandicapCard
    key: UNEVEN_X01_KEY,
    name: `Uneven Teams — ${startingScore}`,
    engine: "TeamX01",
    category: "uneven",
    description: `Any side size vs any side size, ${startingScore} each side, one shared score per side${doubleOut ? " · Double Out" : " · Straight Out"}. The bigger side gets more throws per round — everyone still gets exactly one visit before their own side hands the turn back.`,
    config: JSON.stringify({ startingScore, doubleOut }),
    enabled: true,
    rulesText: "Uneven Teams X01 — pick any number of players per side (they don't have to match). Each side shares one running score, same starting score both sides. A side's turn only passes to the other side once every one of its own players has thrown once this round — so a 2-player side naturally gets twice the darts per round of a 1-player side, purely from having more people to get through. Standard X01 scoring and finishing rules apply otherwise.",
  };
}

export function buildUnevenCricketGameType(cutThroat: boolean): GameTypeOption {
  return {
    id: -1,
    key: UNEVEN_CRICKET_KEY,
    name: cutThroat ? "Uneven Teams — Cricket (Cut-Throat)" : "Uneven Teams — Cricket",
    engine: "TeamCricket",
    category: "uneven",
    description: `Any side size vs any side size, one shared board per side.${cutThroat ? " Cut-throat: extra marks add to the OTHER side's score." : ""} The bigger side gets more throws per round.`,
    config: JSON.stringify({ cutThroat }),
    enabled: true,
    rulesText: "Uneven Teams Cricket — pick any number of players per side (they don't have to match). Each side shares one set of marks and one score. A side's turn only passes to the other side once every one of its own players has thrown once this round, the same turn-count handicap as Uneven Teams X01. Standard Cricket rules apply otherwise (close 15–20 and bull, then score on numbers the other side hasn't closed).",
  };
}

export function UnevenX01Card({
  accent, selected, onSelect, onClear,
}: {
  accent: string;
  selected: boolean;
  onSelect: (gameType: GameTypeOption) => void;
  /** Called when this tile is (or was) the active selection and its inputs become incomplete/invalid. */
  onClear: () => void;
}) {
  const [scoreRaw, setScoreRaw]   = useState(String(DEFAULT_X01_SCORE));
  const [doubleOut, setDoubleOut] = useState(true);

  const emit = (raw: string, d: boolean) => {
    const n = clampUnevenX01Score(raw);
    if (n !== null) onSelect(buildUnevenX01GameType(n, d));
    else onClear();
  };

  const invalid = clampUnevenX01Score(scoreRaw) === null;

  return (
    <div
      onClick={() => emit(scoreRaw, doubleOut)}
      className="pdc-card p-3 transition-all relative overflow-hidden sm:col-span-2"
      style={{
        borderColor: selected ? accent : "rgba(255,255,255,0.07)",
        background:  selected ? `${accent}0f` : "rgba(255,255,255,0.02)",
        boxShadow:   selected ? `0 0 18px ${accent}26` : undefined,
        cursor: "pointer",
      }}>
      {selected && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />}
      <div className="font-bold text-sm mb-0.5" style={{ fontFamily: "Oswald, sans-serif", color: selected ? "#fff" : "rgba(255,255,255,0.75)", letterSpacing: "0.05em" }}>
        🎯 Uneven Teams X01
      </div>
      <div className="text-xs mb-3 leading-tight" style={{ color: "rgba(255,255,255,0.3)" }}>
        Same starting score both sides ({UNEVEN_X01_MIN}–{UNEVEN_X01_MAX}) — the bigger side's edge comes from getting more throws per round, not a score head start.
      </div>
      <div className="grid grid-cols-2 gap-3" onClick={e => e.stopPropagation()}>
        <label className="block">
          <div className="text-xs font-bold uppercase mb-1" style={{ fontFamily: "Oswald, sans-serif", color: accent, letterSpacing: "0.08em" }}>Starting Score</div>
          <input
            type="number" inputMode="numeric" min={UNEVEN_X01_MIN} max={UNEVEN_X01_MAX} value={scoreRaw}
            onChange={e => { setScoreRaw(e.target.value); emit(e.target.value, doubleOut); }}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "Oswald, sans-serif" }} />
        </label>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); const nv = !doubleOut; setDoubleOut(nv); emit(scoreRaw, nv); }}
          className="flex items-center gap-2 text-xs font-bold uppercase self-end pb-2"
          style={{ fontFamily: "Oswald, sans-serif", color: doubleOut ? accent : "rgba(255,255,255,0.35)", cursor: "pointer" }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, border: `1px solid ${doubleOut ? accent : "rgba(255,255,255,0.3)"}`, background: doubleOut ? accent : "transparent", display: "inline-block" }} />
          Double Out
        </button>
      </div>
      {invalid && (
        <div className="mt-2 text-xs" style={{ color: "#ff005c" }}>
          Enter a starting score between {UNEVEN_X01_MIN} and {UNEVEN_X01_MAX}.
        </div>
      )}
    </div>
  );
}

export function UnevenCricketCard({
  accent, selected, onSelect,
}: {
  accent: string;
  selected: boolean;
  onSelect: (gameType: GameTypeOption) => void;
}) {
  const [cutThroat, setCutThroat] = useState(false);

  return (
    <div
      onClick={() => onSelect(buildUnevenCricketGameType(cutThroat))}
      className="pdc-card p-3 transition-all relative overflow-hidden sm:col-span-2"
      style={{
        borderColor: selected ? accent : "rgba(255,255,255,0.07)",
        background:  selected ? `${accent}0f` : "rgba(255,255,255,0.02)",
        boxShadow:   selected ? `0 0 18px ${accent}26` : undefined,
        cursor: "pointer",
      }}>
      {selected && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />}
      <div className="font-bold text-sm mb-0.5" style={{ fontFamily: "Oswald, sans-serif", color: selected ? "#fff" : "rgba(255,255,255,0.75)", letterSpacing: "0.05em" }}>
        🏏 Uneven Teams Cricket
      </div>
      <div className="text-xs mb-3 leading-tight" style={{ color: "rgba(255,255,255,0.3)" }}>
        One shared board per side. Same throw-count handicap as Uneven Teams X01.
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); const nv = !cutThroat; setCutThroat(nv); if (selected) onSelect(buildUnevenCricketGameType(nv)); }}
        className="flex items-center gap-2 text-xs font-bold uppercase"
        style={{ fontFamily: "Oswald, sans-serif", color: cutThroat ? accent : "rgba(255,255,255,0.35)", cursor: "pointer" }}>
        <span style={{ width: 14, height: 14, borderRadius: 4, border: `1px solid ${cutThroat ? accent : "rgba(255,255,255,0.3)"}`, background: cutThroat ? accent : "transparent", display: "inline-block" }} />
        Cut-Throat
      </button>
    </div>
  );
}
