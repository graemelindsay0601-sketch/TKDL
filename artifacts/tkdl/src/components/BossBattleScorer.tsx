/**
 * BossBattleScorer — a boss fight on top of the normal scorers.
 *
 * The boss has a health bar (bossHealth): your scoring knocks it down, a leg the
 * boss wins heals it back. At ⅔ and ⅓ health it changes move (phase 2, then
 * enraged phase 3). In 501 and Cricket its moves are curses on your darts, run by
 * the Card Clash effects engine (the "card_clash_mode" flag switches that on in the
 * scorer). A 100+ visit stuns the curse for your next visit; a 180 breaks it for the
 * rest of the phase (Cricket: 6 and 9 marks in a visit). In Around the World,
 * Halve-It and Killer there are no curses: the boss throws better as it gets angry.
 *
 * The boss talks: an entrance line, then reactions to busts, big visits, legs and
 * phase changes. The human is always player 0; the boss is the CPU (player 1).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X01Scorer, CricketScorer, SequenceScorer, HalveItScorer, KillerScorer, type LiveScoreState, type BossProgress } from "@/lib/scorers";
import type { GameResult } from "./game-scorer";
import { BOT_LEVELS, type BotLevel, type ShadowProfile } from "@/lib/bot-engine";
import { moveForPhase, effectsForMove, perkEffects, pickLine, type Boss, type PerkId } from "@/lib/boss-battles-data";
import { bossHealth, phaseFor, visitImpact, type FightState } from "@/lib/darts-rules";
import type { CCEffect } from "@/lib/card-effect-engine";
import { BossHud, BossEntrance, PhaseBanner, type CurseState } from "./boss/BossHud";
import { useNewScoringUI } from "@/lib/useNewScoringUI";

export type BossFightResult = GameResult & { flawless?: boolean };

interface BossBattleScorerProps {
  boss: Boss;
  playerName: string;
  onMatchComplete: (result: BossFightResult) => void;
  onAbandon: () => void;
  ascension?: number;
  /** This week's possession: the boss throws this shadow's real darts instead of its own level (X01 only). */
  possessedBy?: ShadowProfile;
  /** The Mirror throws like the player's own shadow when they've unlocked one. */
  mirrorOf?: ShadowProfile;
  /** The perk taken into this fight. */
  perk?: PerkId | null;
}

const LEVELS: BotLevel[] = ["beginner", "amateur", "club", "county", "pro", "elite"];
const SEQ_CONFIG: Record<string, object> = {
  around_the_world: { type: "sequential", maxNumber: 20, includeBull: true },
  round_clock_doubles: { sequence: "doubles1-20" },
};
const KILLER_LIVES: Record<string, number> = { killer: 3, killer_1_life: 1 };

export function BossBattleScorer({ boss, playerName, onMatchComplete, onAbandon, ascension = 0, possessedBy, mirrorOf, perk = null }: BossBattleScorerProps) {
  const cursed = boss.gameMode === "X01" || boss.gameMode === "CRICKET";
  // 501 / Cricket follow the New Scoring UI setting; the party-game bosses always use the new layout (the boss banner lives there).
  const newScoringUI = useNewScoringUI();
  if (typeof window !== "undefined" && cursed) {
    sessionStorage.setItem("card_clash_mode", "true");
    sessionStorage.removeItem("card_clash_chaos_mode");
    sessionStorage.removeItem("card_clash_chaos_lab_mode");
    sessionStorage.setItem("card_clash_p1_cards", "[]");
    sessionStorage.setItem("card_clash_p2_cards", "[]");
  }
  useEffect(() => () => {
    sessionStorage.removeItem("card_clash_mode");
    sessionStorage.removeItem("card_clash_p1_cards");
    sessionStorage.removeItem("card_clash_p2_cards");
  }, []);

  // ── Fight state ──
  const coolHead = perk === "cool-head";
  const startPhase = phaseFor(1, ascension, coolHead);
  const [entered, setEntered] = useState(false);
  const [health, setHealth] = useState(1);
  const minHealth = useRef(1);
  const [phase, setPhase] = useState<1 | 2 | 3>(startPhase);
  const [curse, setCurse] = useState<CurseState>(cursed ? "on" : "none");
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null);
  const [mood, setMood] = useState<"idle" | "hurt" | "angry" | "talk">("idle");
  const [banner, setBanner] = useState<{ phase: 2 | 3; key: number } | null>(null);
  const [toast, setToast] = useState<{ kind: "stun" | "break" | "heal"; text: string; key: number } | null>(null);
  const [legNonce, setLegNonce] = useState(0);
  const move = moveForPhase(boss, phase);
  const entranceLine = useMemo(() => pickLine(boss.lines.entrance), [boss.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const say = useCallback((text: string, m: "hurt" | "talk" | "angry" = "talk") => {
    setBubble({ text, key: Date.now() });
    setMood(m);
    window.setTimeout(() => setMood("idle"), m === "hurt" ? 600 : 1400);
  }, []);
  useEffect(() => { if (!entered) return; const t = setTimeout(() => say(entranceLine), 300); return () => clearTimeout(t); }, [entered]); // eslint-disable-line react-hooks/exhaustive-deps

  // The curse for this phase: picked once per phase (and refreshed each leg, since the scorer
  // clears leg-long effects when a leg ends). Stunned / broken switches it off without re-rolling it.
  const phaseEffects = useMemo(() => (cursed ? effectsForMove(move) : []), [phase, legNonce]); // eslint-disable-line react-hooks/exhaustive-deps
  // Iron Will: phase 1's curse can't touch you. Perks that change your darts ride along as your own
  // effects, rebuilt at the start of each of your visits (Treble Hunter's "first treble" resets per visit).
  const [visitNonce, setVisitNonce] = useState(0);
  const ironWill = perk === "iron-will" && phase === 1;
  const cardEffects: CCEffect[] = useMemo(
    () => [
      ...phaseEffects.map(e => ({ ...e, status: (curse === "on" && !ironWill ? "active" : "expired") as CCEffect["status"] })),
      ...perkEffects(perk),
    ],
    [phaseEffects, curse, ironWill, perk, visitNonce], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onHealth = useCallback((h: number) => {
    setHealth(h);
    if (h < minHealth.current) minHealth.current = h;
    const p = Math.max(startPhase, phaseFor(minHealth.current, ascension, coolHead)) as 1 | 2 | 3;
    setPhase(prev => {
      if (p > prev) {
        setBanner({ phase: p as 2 | 3, key: Date.now() });
        say(p === 3 ? boss.lines.phase3 : boss.lines.phase2, "angry");
        if (cursed) setCurse("on");
        return p;
      }
      return prev;
    });
  }, [ascension, boss.lines.phase2, boss.lines.phase3, cursed, say, startPhase, coolHead]);

  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), 4300); return () => clearTimeout(t); }, [banner]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t); }, [toast]);

  // ── 501 / Cricket: follow the scorer's live state ──
  const prev = useRef<{ scores: [number, number]; turn: 0 | 1; legs: [number, number]; marks: [number, number]; start: [number, number] } | null>(null);
  const onLive = useCallback((s: LiveScoreState) => {
    const num = (x?: string) => Number((x ?? "0").match(/\d+/)?.[0] ?? 0);
    const legs: [number, number] = boss.gameMode === "X01" ? [num(s.detail?.[0]), num(s.detail?.[1])] : (prev.current?.legs ?? [0, 0]);
    const marks: [number, number] = boss.gameMode === "CRICKET" ? [num(s.detail?.[0]), num(s.detail?.[1])] : [0, 0];
    const p = prev.current;
    // Cricket legs aren't in the live state: a leg ended when both players' marks reset to 0.
    if (boss.gameMode === "CRICKET" && p && marks[0] + marks[1] === 0 && p.marks[0] + p.marks[1] > 0) {
      legs[0] = p.legs[0] + (p.marks[0] >= p.marks[1] ? 1 : 0);
      legs[1] = p.legs[1] + (p.marks[0] >= p.marks[1] ? 0 : 1);
    }
    const st: FightState = boss.gameMode === "X01"
      ? { mode: "X01", start: 501, mine: s.scores[0], legsWon: legs[0] }
      : { mode: "CRICKET", marks: marks[0], legsWon: legs[0] };
    onHealth(bossHealth(st));

    if (p) {
      if (legs[0] > p.legs[0]) { say(pickLine(boss.lines.legLost), "hurt"); }
      else if (legs[1] > p.legs[1]) {
        say(pickLine(boss.lines.legWon));
        setToast({ kind: "heal", text: `${boss.name} recovers`, key: Date.now() });
      } else if (s.turn !== p.turn) {
        const who = p.turn;
        // The live state updates dart by dart, so measure the visit from where it started.
        const v = boss.gameMode === "X01" ? p.start[who] - s.scores[who] : marks[who] - p.start[who];
        if (who === 0) {
          // The visit that just ended was the stunned one: the curse comes back.
          setCurse(c => (c === "stunned" ? "on" : c));
          const impact = visitImpact(v, boss.gameMode === "X01" ? "X01" : "CRICKET", perk);
          if (impact === "break" && cursed) {
            setCurse("broken");
            setToast({ kind: "break", text: `${move.name} broken!`, key: Date.now() });
            say(pickLine(boss.lines.hurt), "hurt");
          } else if (impact === "stun" && cursed) {
            setCurse(c => (c === "broken" ? c : "stunned"));
            setToast({ kind: "stun", text: `Stunned! ${move.name} off for your next visit`, key: Date.now() });
            say(pickLine(boss.lines.hurt), "hurt");
          } else if (v <= 0) say(pickLine(boss.lines.bust));
        } else if (boss.gameMode === "X01" ? v >= 100 : v >= 6) say(pickLine(boss.lines.big));
      }
    }
    // Where each player's current visit started (score in 501, closing marks in Cricket).
    const cur: [number, number] = boss.gameMode === "X01" ? [...s.scores] as [number, number] : marks;
    const legChanged = !!p && (legs[0] !== p.legs[0] || legs[1] !== p.legs[1]);
    const start: [number, number] = !p || legChanged ? cur : [...p.start] as [number, number];
    if (p && s.turn !== p.turn) { start[s.turn] = cur[s.turn]; if (s.turn === 0 && perk === "treble-hunter") setVisitNonce(n => n + 1); }
    prev.current = { scores: [...s.scores] as [number, number], turn: s.turn, legs, marks, start };
  }, [boss, cursed, move.name, onHealth, say, perk]);

  // ── Around the World / Halve-It / Killer: progress from the party scorer ──
  const prevProg = useRef<BossProgress | null>(null);
  const lastProg = useRef<BossProgress | null>(null);
  const onProgress = useCallback((pr: BossProgress) => {
    lastProg.current = pr;
    const st: FightState = boss.gameMode === "ATW" ? { mode: "ATW", mine: pr.mine, of: pr.of }
      : boss.gameMode === "KILLER" ? { mode: "KILLER", theirs: pr.theirs, of: pr.of }
      : { mode: "HALVEIT", mine: pr.mine, theirs: pr.theirs, round: pr.round ?? 0, rounds: pr.rounds ?? 1 };
    onHealth(bossHealth(st));
    const p = prevProg.current;
    if (p) {
      const myGain = pr.mine - p.mine, theirGain = pr.theirs - p.theirs;
      if (boss.gameMode === "KILLER") {
        if (theirGain < 0) say(pickLine(boss.lines.hurt), "hurt");
        else if (myGain < 0) say(pickLine(boss.lines.big));
      } else if (boss.gameMode === "ATW") {
        if (myGain >= 3) say(pickLine(boss.lines.hurt), "hurt");
        else if (theirGain >= 3) say(pickLine(boss.lines.big));
      } else {
        if (myGain < 0) say(pickLine(boss.lines.bust));
        else if (myGain >= 60) say(pickLine(boss.lines.hurt), "hurt");
        else if (theirGain >= 60) say(pickLine(boss.lines.big));
      }
    }
    prevProg.current = pr;
  }, [boss, onHealth, say]);

  // ── The boss's own throwing ──
  const baseIdx = Math.max(0, LEVELS.indexOf(boss.botLevel));
  const boost = cursed ? 0 : (move.botBoost ?? 0);
  const levelConfig = BOT_LEVELS[LEVELS[Math.min(LEVELS.length - 1, baseIdx + ascension + boost)]];
  const shadow = possessedBy ?? (boss.id === "the-mirror" ? mirrorOf : undefined);
  const botConfig = shadow && boss.gameMode === "X01" ? { ...levelConfig, shadowProfile: shadow } : levelConfig;

  const finish = (winnerIdx: 0 | 1, detail?: string) => {
    let flawless = false;
    const pr = lastProg.current;
    if (winnerIdx === 0 && pr) {
      if (boss.gameMode === "KILLER") flawless = pr.mine === pr.of;
      else if (boss.gameMode === "ATW") flawless = pr.theirs <= pr.of / 2;
      else if (boss.gameMode === "HALVEIT") flawless = pr.mine >= 2 * Math.max(1, pr.theirs);
    }
    onMatchComplete({ winnerIdx, detail, flawless });
  };

  const hud = (
    <BossHud boss={boss} health={health} phase={phase} move={move} curse={ironWill && curse === "on" ? "warded" : curse} bubble={bubble}
      mood={mood} possessedBy={possessedBy?.playerName} />
  );
  const p2Name = `${shadow && possessedBy ? "👻 " : ""}${boss.name}`;

  return (
    <div style={{ position: "relative" }}>
      {!entered && <BossEntrance boss={boss} line={entranceLine} onDone={() => setEntered(true)} possessedBy={possessedBy?.playerName} />}
      {banner && <PhaseBanner key={banner.key} boss={boss} phase={banner.phase} move={moveForPhase(boss, banner.phase)} line={banner.phase === 3 ? boss.lines.phase3 : boss.lines.phase2} />}
      {toast && <div key={toast.key} className={`bimp ${toast.kind}`}>{toast.text}</div>}
      {boss.gameMode === "X01" && (
        <X01Scorer p1Name={playerName} p2Name={p2Name} config={{ startingScore: 501, doubleOut: true }} botConfig={botConfig}
          onWin={(w, d) => finish(w as 0 | 1, d)} onAbandon={onAbandon} cardEffects={cardEffects} legs={3}
          onLegStart={() => setLegNonce(n => n + 1)} onLiveState={onLive} topBanner={hud} newScoringUI={newScoringUI} />
      )}
      {boss.gameMode === "CRICKET" && (
        <CricketScorer p1Name={playerName} p2Name={p2Name} botConfig={botConfig}
          onWin={(w, d) => finish(w as 0 | 1, d)} onAbandon={onAbandon} cardEffects={cardEffects} legs={3}
          onLegStart={() => setLegNonce(n => n + 1)} onLiveState={onLive} topBanner={hud} newScoringUI={newScoringUI} />
      )}
      {boss.gameMode === "ATW" && (
        <SequenceScorer p1Name={playerName} p2Name={p2Name} config={SEQ_CONFIG[boss.gameKey ?? "around_the_world"] ?? {}}
          gameKey={boss.gameKey ?? "around_the_world"} botConfig={botConfig} onWin={(w, d) => finish(w, d)} onAbandon={onAbandon}
          topBanner={hud} onBossProgress={onProgress} newScoringUI />
      )}
      {boss.gameMode === "HALVEIT" && (
        <HalveItScorer p1Name={playerName} p2Name={p2Name} gameKey={boss.gameKey ?? "halve_it"} botConfig={botConfig}
          onWin={(w, d) => finish(w, d)} onAbandon={onAbandon} topBanner={hud} onBossProgress={onProgress} newScoringUI />
      )}
      {boss.gameMode === "KILLER" && (
        <KillerScorer p1Name={playerName} p2Name={p2Name} lives={KILLER_LIVES[boss.gameKey ?? "killer"] ?? 3} botConfig={botConfig}
          onWin={(w, d) => finish(w, d)} onAbandon={onAbandon} topBanner={hud} onBossProgress={onProgress} newScoringUI />
      )}
    </div>
  );
}
