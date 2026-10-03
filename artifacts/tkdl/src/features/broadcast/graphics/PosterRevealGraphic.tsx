// TKDL LIVE — PosterRevealGraphic: the broadcast's own translation of the
// Match Poster Library's dedicated artwork (lib/match-poster-art.ts) into a
// live-rendered graphics/*.tsx component. api-shapes.ts routes a MATCH_RESULT
// or TEAM_RESULT story here instead of ResultGraphic/TeamResultGraphic only
// when the Story Engine itself scored it "major" — the same small, genuinely-
// dramatic set of moments theme.ts's own VisualTier research already reserves
// the loudest treatment for. Every other result keeps the quieter card.
//
// This deliberately echoes match-poster-art.ts's own visual grammar — dark
// charcoal glow, broadcast-style L corner brackets, a faint dartboard ring
// watermark, a dominant WINNER name over a muted DEFEATED name, a circular
// stake medallion — rather than reusing GraphicFrame's generic chip-row
// layout (the same "custom composition, not the shared frame" call
// TeamResultGraphic.tsx already made for its own asymmetric winner/loser
// shape). It's a from-scratch CSS/SVG re-draw, not a literal call into that
// canvas renderer: a live scene graphic has to mount instantly off data
// that's already on the page, with no async canvas-to-Blob round trip and
// no <canvas> element fighting the rest of this screen's DOM-based layout
// and fade-in choreography.
import { LEAGUE_ACCENT } from "../theme";
import { GraphicFrame } from "./GraphicFrame";
import { buildPosterRevealModel } from "./poster-reveal-graphic";
import type { GraphicData, LeagueType } from "../types";

const GOLD = "#ffd24a";

function CornerBrackets({ accent }: { accent: string }) {
  const arm = 22;
  const base = { position: "absolute" as const, width: arm, height: arm, pointerEvents: "none" as const };
  return (
    <>
      <div style={{ ...base, top: 8, left: 8, borderTop: `3px solid ${accent}`, borderLeft: `3px solid ${accent}` }} />
      <div style={{ ...base, top: 8, right: 8, borderTop: `3px solid ${accent}`, borderRight: `3px solid ${accent}` }} />
      <div style={{ ...base, bottom: 8, left: 8, borderBottom: `3px solid ${accent}`, borderLeft: `3px solid ${accent}` }} />
      <div style={{ ...base, bottom: 8, right: 8, borderBottom: `3px solid ${accent}`, borderRight: `3px solid ${accent}` }} />
    </>
  );
}

/** CSS equivalent of match-poster-art.ts's drawRingWatermark() — concentric
 * rings + spokes, bottom-right, kept to very low opacity so it stays pure
 * background texture and never competes with the winner/loser type over it. */
function RingWatermark({ accent }: { accent: string }) {
  const rings = [1, 2, 3, 4, 5, 6];
  const spokes = Array.from({ length: 10 }, (_, i) => (i * 360) / 10);
  return (
    <div aria-hidden className="absolute pointer-events-none" style={{ right: -70, bottom: -70, width: 240, height: 240, opacity: 0.14 }}>
      {rings.map(r => (
        <div
          key={r}
          className="absolute rounded-full"
          style={{
            left: "50%", top: "50%", width: `${(r / 6) * 100}%`, height: `${(r / 6) * 100}%`,
            transform: "translate(-50%, -50%)",
            border: `${r === 6 ? 2 : 1}px solid ${r % 2 === 0 ? accent : "#ffffff"}`,
          }}
        />
      ))}
      {spokes.map(angle => (
        <div
          key={angle}
          className="absolute"
          style={{
            left: "50%", top: "50%", width: "50%", height: 1, background: "#ffffff",
            transformOrigin: "0 0", transform: `rotate(${angle}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function PosterRevealGraphic({
  leagueType, data, compact = false,
}: { leagueType: LeagueType | null; data: GraphicData; compact?: boolean }) {
  const accent = leagueType ? LEAGUE_ACCENT[leagueType] : "#ff005c";
  const model = buildPosterRevealModel(data);
  if (!model) return <GraphicFrame kind="Result" icon="★" accent={accent} leagueType={leagueType} data={data} compact={compact} />;

  return (
    <div
      className="panel-slide-in relative w-full min-w-0 overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #0b0e16 0%, #05070c 58%, #03040a 100%)",
        border: `1px solid ${accent}55`,
        boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 48px ${accent}22`,
        padding: compact ? "14px 16px 16px" : "26px 32px 28px",
      }}
    >
      <RingWatermark accent={accent} />
      <CornerBrackets accent={accent} />

      <div className="relative flex items-center justify-between gap-3">
        <div className="font-black uppercase" style={{ fontSize: compact ? "0.82rem" : "1.1rem", letterSpacing: "0.1em" }}>
          <span style={{ color: "#fff" }}>TKDL </span><span style={{ color: accent }}>LIVE</span>
        </div>
        <div
          className="font-black uppercase rounded-full shrink-0"
          style={{
            fontSize: compact ? "0.48rem" : "0.6rem", letterSpacing: "0.12em", color: GOLD,
            background: `${GOLD}1f`, border: `1px solid ${GOLD}80`, padding: compact ? "4px 9px" : "6px 14px",
          }}
        >
          Result of the Night
        </div>
      </div>

      <div className="relative mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }} />

      <div className="relative mt-4 min-w-0">
        <div className="font-black uppercase" style={{ color: accent, fontSize: compact ? "0.58rem" : "0.74rem", letterSpacing: "0.14em" }}>Winner</div>
        <div
          className="font-black uppercase truncate"
          style={{ color: "#fff", fontSize: compact ? "1.3rem" : "clamp(1.6rem, 4.5vw, 2.5rem)", lineHeight: 1.08, textShadow: `0 0 26px ${accent}55` }}
        >
          {model.winnerName}
        </div>
        <div style={{ height: 4, width: compact ? 56 : 90, background: accent, boxShadow: `0 0 10px ${accent}`, marginTop: 10, marginBottom: 12 }} />
        <div className="font-bold uppercase" style={{ color: `${accent}cc`, fontSize: compact ? "0.5rem" : "0.6rem", letterSpacing: "0.1em" }}>Defeated</div>
        <div className="font-bold uppercase truncate" style={{ color: "rgba(255,255,255,0.5)", fontSize: compact ? "0.85rem" : "1.15rem" }}>{model.loserName}</div>
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-4">
        <div className="font-bold uppercase min-w-0" style={{ color: "rgba(255,255,255,0.4)", fontSize: compact ? "0.5rem" : "0.64rem", letterSpacing: "0.1em" }}>
          {model.formatLabel}
        </div>
        <div className="flex flex-col items-center justify-center rounded-full shrink-0" style={{
          width: compact ? 58 : 88, height: compact ? 58 : 88,
          border: `2px solid ${GOLD}8c`, boxShadow: `0 0 20px ${GOLD}35, inset 0 0 14px ${GOLD}1f`,
        }}>
          <div className="font-black tabular-nums" style={{ color: GOLD, fontSize: compact ? "1.1rem" : "1.6rem", lineHeight: 1 }}>{model.stake}</div>
          <div className="font-bold uppercase" style={{ color: "rgba(255,255,255,0.45)", fontSize: compact ? "0.32rem" : "0.4rem", letterSpacing: "0.06em", marginTop: 2 }}>
            {model.stake === 1 ? "Point" : "Points"}
          </div>
        </div>
      </div>

      <div className="relative mt-4 font-bold uppercase" style={{ color: "rgba(255,255,255,0.22)", fontSize: compact ? "0.42rem" : "0.52rem", letterSpacing: "0.1em" }}>
        The Kingdom Darts League · Official Result Graphic
      </div>
    </div>
  );
}
