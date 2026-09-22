// ══════════════════════════════════════════════════════════════════════════════
// Party Scoring UI (v2) — shared visual primitives
// ══════════════════════════════════════════════════════════════════════════════
// Gated entirely behind the `new_scoring_ui` feature flag (admin-preview-only
// until switched live — see useNewScoringUI() and /admin's Feature Flags panel).
// These are opt-in siblings to the existing PlayerCard/SectionCard-based
// rendering in scorers.tsx — nothing here replaces or edits that shared code,
// so 501/301/Cricket and every non-party scorer render exactly as before
// regardless of this flag's state.
//
// Visual language ported from the design pass the admin approved in a mockup
// (illustrated/textured "tower" scoreboard, a real race track for chase
// games, life-pip pods for elimination games, a claimed-territory grid) —
// same green/pink player identity (P_COLOR) and Oswald type as the rest of
// the app, just with more graphic presence than a flat number in a box.

import React from "react";

export const GOLD = "#ffd24a";
export const P_COLOR = (i: number) => (i === 0 ? "#22c55e" : "#ee0a78");
const P_GLOW = (i: number) => (i === 0 ? "rgba(34,197,94,0.35)" : "rgba(238,10,120,0.35)");
const FONT = "Oswald, sans-serif";

// ── ScoreTower ──────────────────────────────────────────────────────────────
// An illustrated, gradient-filled obelisk (flat-topped, not a pointed
// pyramid) that fills from its base as a value counts down toward zero, or
// climbs toward a target — the redesign's signature visual for any
// point-based party game (Knockout's strikes-remaining, etc.)
export function ScoreTower({
  label, value, max, playerIdx, active, sub, countsDown = true,
}: {
  label: string; value: number; max: number; playerIdx: 0 | 1;
  active: boolean; sub?: string; countsDown?: boolean;
}) {
  const safeMax = Math.max(1, max);
  const progress = Math.max(0, Math.min(1, countsDown ? 1 - value / safeMax : value / safeMax));
  const fillH = progress * 140;
  const uid = `${playerIdx}-${label.replace(/[^a-zA-Z0-9]/g, "")}`;
  const color = P_COLOR(playerIdx);
  const glow = P_GLOW(playerIdx);
  const TOWER_D = "M8,140 L112,140 L84,12 Q86,4 78,4 L42,4 Q34,4 36,12 Z";

  return (
    <div
      className="pdc-card p-3 text-center relative overflow-hidden transition-all duration-200"
      style={{
        borderColor: active ? color : "rgba(255,255,255,0.06)",
        boxShadow: active ? `0 0 20px ${glow}` : undefined,
      }}
    >
      {active && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color }} />}
      <div
        className="text-xs font-bold uppercase tracking-widest mb-1"
        style={{ fontFamily: FONT, color, opacity: active ? 1 : 0.4 }}
      >
        {label}
      </div>
      <div style={{ position: "relative", display: "flex", justifyContent: "center", margin: "4px 0" }}>
        <svg
          viewBox="0 0 120 140"
          style={{
            width: "100%", maxWidth: 132, height: 104,
            filter: `drop-shadow(0 8px 14px rgba(0,0,0,0.5))${active ? ` drop-shadow(0 0 12px ${glow})` : ""}`,
          }}
        >
          <defs>
            <linearGradient id={`tw-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={playerIdx === 0 ? "#8bf5b4" : "#ff8ec4"} />
              <stop offset="55%" stopColor={color} />
              <stop offset="100%" stopColor={playerIdx === 0 ? "#0c6b34" : "#8f0a4d"} />
            </linearGradient>
            <clipPath id={`tw-clip-${uid}`}>
              <rect x="0" y={140 - fillH} width="120" height={fillH} />
            </clipPath>
          </defs>
          <path d={TOWER_D} fill="rgba(255,255,255,0.04)" />
          <path d={TOWER_D} fill={`url(#tw-fill-${uid})`} clipPath={`url(#tw-clip-${uid})`} />
          <path d={TOWER_D} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <div
          style={{
            position: "absolute", top: "46%", left: "50%", transform: "translate(-50%,-50%)",
            fontFamily: FONT, fontWeight: 800, fontSize: "1.7rem", color: "#fff",
            textShadow: "0 2px 4px rgba(0,0,0,0.9)",
          }}
        >
          {value}
        </div>
      </div>
      {sub && <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: FONT }}>{sub}</div>}
    </div>
  );
}

// ── RaceTrack ───────────────────────────────────────────────────────────────
// A real racecourse strip — dirt-post lane markers, a fill bar for the lead
// lane, and one marker per runner — for any position-on-a-path party game
// (Hare & Hounds' chase, Prisoner's clock lap, Grand National's 40-step lap).
export function RaceTrack({
  lanes, max, tickLabels,
}: {
  lanes: { label: string; pos: number; emoji: string; playerIdx: 0 | 1; leadFill?: boolean }[];
  max: number;
  tickLabels?: [string, string, string];
}) {
  const safeMax = Math.max(1, max);
  const lead = lanes.find((l) => l.leadFill) ?? lanes[0];
  return (
    <div
      style={{
        position: "relative", height: 20, borderRadius: 20,
        background: "repeating-linear-gradient(90deg, #163a1f 0 16px, #12321a 16px 32px)",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(255,255,255,0.04)",
        margin: "26px 4px 32px",
      }}
    >
      {lead && (
        <div
          style={{
            position: "absolute", left: 0, top: 0, height: "100%",
            width: `${Math.min(100, (lead.pos / safeMax) * 100)}%`, borderRadius: 20,
            background: `linear-gradient(90deg, #0c6b34, ${P_COLOR(0)})`,
            boxShadow: `0 0 14px -2px ${P_GLOW(0)}`, transition: "width .4s",
          }}
        />
      )}
      {lanes.map((l, i) => (
        <div
          key={i}
          style={{
            position: "absolute", top: "50%", left: `${Math.min(100, (l.pos / safeMax) * 100)}%`,
            transform: "translate(-50%,-50%)", fontSize: "1.3rem", transition: "left .4s",
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.7))",
          }}
        >
          {l.emoji}
          <span
            style={{
              position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)",
              fontFamily: FONT, fontSize: "0.55rem", fontWeight: 700, color: "rgba(255,255,255,0.7)",
              background: "rgba(8,8,11,0.75)", padding: "1px 5px", borderRadius: 6, whiteSpace: "nowrap",
            }}
          >
            {l.label}
          </span>
        </div>
      ))}
      {tickLabels && (
        <>
          <span style={tickStyle("left")}>{tickLabels[0]}</span>
          <span style={tickStyle("center")}>{tickLabels[1]}</span>
          <span style={tickStyle("right")}>{tickLabels[2]}</span>
        </>
      )}
    </div>
  );
}
function tickStyle(pos: "left" | "center" | "right"): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute", top: "100%", marginTop: 8,
    fontFamily: FONT, fontSize: "0.6rem", fontWeight: 600, color: "rgba(255,255,255,0.35)",
  };
  if (pos === "left") return { ...base, left: 0 };
  if (pos === "right") return { ...base, right: 0 };
  return { ...base, left: "50%", transform: "translateX(-50%)" };
}

// ── TrackStats ──────────────────────────────────────────────────────────────
// A lightweight stat-pill pair that sits above a RaceTrack — deliberately not
// another illustrated shape, so a track game doesn't carry two competing
// motifs (track + tower) for the same one number.
export function TrackStats({ items }: { items: { label: string; value: string; playerIdx: 0 | 1 }[] }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            flex: 1, padding: "9px 11px", borderRadius: 10, background: "rgba(255,255,255,0.03)",
            border: `1px solid ${P_COLOR(it.playerIdx)}4d`,
          }}
        >
          <div style={{ fontFamily: FONT, fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
            {it.label}
          </div>
          <div style={{ fontFamily: FONT, fontSize: "0.92rem", fontWeight: 700, color: P_COLOR(it.playerIdx) }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── LivesPods ───────────────────────────────────────────────────────────────
// Player pods with an avatar, a row of life pips, and an active/out state —
// for any elimination/lives party game (Killer-style: Knockout's strikes,
// Follow the Leader's lives, Blind Killers' lives).
export interface LifePod {
  id: string; name: string; initial: string;
  lives: number; maxLives: number; out: boolean; active: boolean;
  colorIdx: 0 | 1 | 2; tag: string;
}
const POD_COLORS = ["#22c55e", "#ee0a78", "#38bdf8"];
export function LivesPods({ pods }: { pods: LifePod[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {pods.map((p) => {
        const color = POD_COLORS[p.colorIdx % POD_COLORS.length];
        return (
          <div
            key={p.id}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12,
              background: "linear-gradient(160deg,#17171f,#101014)",
              border: `1px solid ${p.active ? color : "rgba(255,255,255,0.08)"}`,
              boxShadow: p.active ? `0 0 16px -6px ${color}88` : undefined,
              opacity: p.out ? 0.45 : 1, filter: p.out ? "grayscale(0.6)" : undefined,
              transition: "opacity .2s, filter .2s, border-color .2s, box-shadow .2s",
            }}
          >
            <div
              style={{
                width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "flex",
                alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 700,
                fontSize: "0.9rem", color: "#08080b",
                background: p.out ? "linear-gradient(160deg,#4a4a52,#2a2a30)" : `linear-gradient(160deg, ${color}dd, ${color})`,
              }}
            >
              {p.initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT, fontSize: "0.75rem", fontWeight: 700 }}>{p.name}</div>
              <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                {Array.from({ length: p.maxLives }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 9, height: 9, borderRadius: "50%",
                      background: i < p.lives ? GOLD : "rgba(255,255,255,0.1)",
                      boxShadow: i < p.lives ? "0 0 5px rgba(255,210,74,0.45)" : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
            <div
              style={{
                fontFamily: FONT, fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: p.out ? "#ff6078" : p.active ? GOLD : "rgba(255,255,255,0.35)",
              }}
            >
              {p.tag}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── TerritoryGrid ───────────────────────────────────────────────────────────
// A claimed-segment grid for territory party games (Battleship Darts).
export function TerritoryGrid({
  claims, lastHit, order,
}: {
  claims: Record<number, 0 | 1 | undefined>;
  lastHit?: number;
  order: number[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5 }}>
      {order.map((n) => {
        const c = claims[n];
        const color = c === 0 ? P_COLOR(0) : c === 1 ? P_COLOR(1) : undefined;
        return (
          <div
            key={n}
            style={{
              aspectRatio: "1", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: FONT, fontWeight: 700, fontSize: "0.75rem", position: "relative",
              background: color ? `linear-gradient(160deg, ${color}55, ${color}22)` : "linear-gradient(160deg,#14212b,#0c161d)",
              border: `1px solid ${color ?? "rgba(56,189,248,0.15)"}`,
              color: color ? "#fff" : "rgba(255,255,255,0.3)",
              boxShadow: color ? `0 0 8px -2px ${color}88` : undefined,
              transition: "background .2s, border-color .2s, box-shadow .2s",
            }}
          >
            {n}
            {n === lastHit && (
              <span
                style={{
                  position: "absolute", inset: -3, borderRadius: 9, border: `1.5px solid ${GOLD}`,
                  boxShadow: "0 0 10px -2px rgba(255,210,74,0.6)", pointerEvents: "none",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── MatchStrip ──────────────────────────────────────────────────────────────
// A compact games/points scoreboard chip row — for Tennis, whose scoring
// shape (love/15/30/40, games won) doesn't fit the other primitives.
export function MatchStrip({
  rows,
}: {
  rows: { label: string; playerIdx: 0 | 1; active: boolean; games: number; pointLabel: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r, i) => {
        const color = P_COLOR(r.playerIdx);
        return (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              padding: "10px 14px", borderRadius: 12, background: "linear-gradient(160deg,#17171f,#101014)",
              border: `1px solid ${r.active ? color : "rgba(255,255,255,0.08)"}`,
              boxShadow: r.active ? `0 0 16px -6px ${P_GLOW(r.playerIdx)}` : undefined,
            }}
          >
            <div style={{ fontFamily: FONT, fontSize: "0.8rem", fontWeight: 700, color: r.active ? "#fff" : "rgba(255,255,255,0.55)" }}>
              {r.label}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: FONT, fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Games</div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: "1.3rem", color }}>{r.games}</div>
              </div>
              <div style={{ textAlign: "center", minWidth: 48 }}>
                <div style={{ fontFamily: FONT, fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Points</div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: "1.3rem", color: r.active ? GOLD : "rgba(255,255,255,0.5)" }}>{r.pointLabel}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
