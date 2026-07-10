/**
 * Shared bot-picker UI — extracted from the Practice page's setup screen so
 * Card Clash's "Solo vs CPU" flow can present the exact same Level Bot /
 * Play a Pro / Player Clone experience instead of a separate simplified list.
 */

import { Cpu, Ghost } from "lucide-react";
import {
  BOT_LEVELS, numLevelConfig, numLevelLabel, numLevelColor,
  type BotPersona, type ShadowProfile,
} from "@/lib/bot-engine";

export type SoloBotMode = "level" | "pro" | "shadow";

export type ShadowProfileData = ShadowProfile & {
  locked?: false;
  playerName: string;
  primaryTarget: { seg: number; treblePct: number } | null;
  logDartsCount: number;
};
export type ShadowProfileLocked = { locked: true; totalDarts: number; needed: number; playerName: string };
export type ShadowProfileResult = ShadowProfileData | ShadowProfileLocked;

export interface BotPickerPlayer {
  id: number;
  name: string;
}

// ── Level Bot picker (1–20) ────────────────────────────────────────────────
export function LevelBotPicker({ selected, onSelect }: {
  selected: number | null; onSelect: (n: number) => void;
}) {
  const levels = Array.from({ length: 20 }, (_, i) => i + 1);
  return (
    <div>
      <div className="grid grid-cols-10 gap-1.5 mb-3">
        {levels.map(n => {
          const isSelected = selected === n;
          const color = numLevelColor(n);
          return (
            <button key={n} onClick={() => onSelect(n)}
              className="aspect-square rounded-lg text-sm font-black transition-all"
              style={{
                fontFamily: "Oswald, sans-serif",
                background: isSelected ? color : `${color}18`,
                color: isSelected ? "#fff" : color,
                border: `1px solid ${isSelected ? color : `${color}44`}`,
                cursor: "pointer",
                fontSize: "0.8rem",
              }}>
              {n}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: `${numLevelColor(selected)}0e`, border: `1px solid ${numLevelColor(selected)}33` }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-xl"
            style={{ background: `${numLevelColor(selected)}22`, color: numLevelColor(selected), fontFamily: "Oswald, sans-serif" }}>
            {selected}
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm" style={{ color: numLevelColor(selected), fontFamily: "Oswald, sans-serif" }}>
              Level {selected} · {numLevelLabel(selected)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
              ~{numLevelConfig(selected).avg} avg · {Math.round(numLevelConfig(selected).checkoutPct * 100)}% checkout rate
            </div>
          </div>
          <Cpu className="w-6 h-6 shrink-0" style={{ color: numLevelColor(selected) }} />
        </div>
      )}
    </div>
  );
}

// ── Pro persona card ─────────────────────────────────────────────────────────
export function PersonaCard({ persona, selected, onSelect }: {
  persona: BotPersona; selected: boolean; onSelect: () => void;
}) {
  const lvl = BOT_LEVELS[persona.level];
  return (
    <button onClick={onSelect} className="pdc-card p-3 text-left w-full transition-all relative overflow-hidden"
      style={{
        borderColor: selected ? lvl.color : "rgba(255,255,255,0.07)",
        background: selected ? `${lvl.color}14` : "rgba(255,255,255,0.02)",
        cursor: "pointer",
      }}>
      {selected && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: lvl.color }} />}
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none">{persona.flag}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: selected ? "#fff" : "rgba(255,255,255,0.85)" }}>
              {persona.name}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-md shrink-0 font-bold"
              style={{ background: `${lvl.color}22`, color: lvl.color, fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em" }}>
              {persona.nickname}
            </span>
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
            {persona.tagline}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-black leading-none" style={{ fontFamily: "Oswald, sans-serif", color: lvl.color }}>
            {persona.avg}
          </div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>avg</div>
        </div>
      </div>
    </button>
  );
}

// ── Shadow Player Picker ──────────────────────────────────────────────────────
export function ShadowPlayerPicker({ players, profiles, selected, onSelect }: {
  players: BotPickerPlayer[];
  profiles: Record<number, ShadowProfileResult>;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const NEEDED = 250;
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
      {players.length === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Loading players…</div>
      )}
      {players.map(p => {
        const prof = profiles[p.id];
        const loading = !prof;
        const locked  = !prof || (prof as ShadowProfileLocked).locked === true;
        const darts   = prof ? prof.totalDarts : 0;
        const pct     = Math.min(100, Math.round((darts / NEEDED) * 100));
        const unlocked = prof && !(prof as ShadowProfileLocked).locked;
        const data    = unlocked ? (prof as ShadowProfileData) : null;
        const isSel   = selected === p.id;
        return (
          <button key={p.id}
            onClick={() => !locked && onSelect(p.id)}
            className="w-full pdc-card p-3 text-left transition-all relative overflow-hidden"
            style={{
              borderColor: isSel ? "#a78bfa" : locked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.09)",
              background: isSel ? "rgba(167,139,250,0.1)" : locked ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.025)",
              cursor: locked ? "not-allowed" : "pointer",
              opacity: loading ? 0.4 : locked ? 0.65 : 1,
            }}>
            {isSel && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "#a78bfa" }} />}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                style={{ background: locked ? "rgba(255,255,255,0.04)" : "rgba(167,139,250,0.12)", fontFamily: "Oswald, sans-serif" }}>
                {locked ? <span style={{ fontSize: "0.9rem" }}>🔒</span> : <Ghost className="w-4 h-4" style={{ color: "#a78bfa" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: locked ? "rgba(255,255,255,0.35)" : isSel ? "#fff" : "rgba(255,255,255,0.8)" }}>
                  Shadow {p.name}
                </div>
                {locked ? (
                  loading ? (
                    <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Loading…</div>
                  ) : (
                    <div className="mt-1">
                      <div className="h-1 rounded-full overflow-hidden mb-0.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "rgba(167,139,250,0.4)" }} />
                      </div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                        {darts}/{NEEDED} darts · {NEEDED - darts} to unlock
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ fontFamily: "Oswald, sans-serif" }}>
                    {data?.primaryTarget && (
                      <span style={{ color: "#a78bfa" }}>T{data.primaryTarget.seg} · {data.primaryTarget.treblePct}% treble</span>
                    )}
                    <span style={{ color: "rgba(255,255,255,0.25)" }}>{darts} darts</span>
                  </div>
                )}
              </div>
              {data && (
                <div className="text-right shrink-0">
                  <div className="text-lg font-black leading-none" style={{ color: "#a78bfa", fontFamily: "Oswald, sans-serif" }}>
                    {Number(data.computedAvg).toFixed(0)}
                  </div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>avg</div>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
