// TKDL LIVE — FormWatchGraphic (GRAPHIC_KIND_BY_STORY_TYPE: WIN_STREAK,
// LOSS_STREAK, FORM_REVERSAL, QUIET_CLIMBER, FREEFALL, ABOVE_BASELINE,
// UNBEATEN_PAIR, PAIR_SURGE, SHIFT_DOMINANCE). This family's own facts
// (story-detectors-form.ts, story-detectors-doubles.ts, story-detectors-
// shift-wars.ts) come in several genuinely different shapes — a bare streak
// count, a table-position move, a rate-vs-baseline comparison, a win share
// — so rather than forcing all of them through one layout this picks the
// single most fitting mini-visual for whichever shape is actually present
// (see kit.tsx's own header for the general "stop rendering everything as
// the same chip grid" reasoning).
//
// On kit.tsx's v3 "BigBoard" skin at `compact={false}` (major visual tier —
// the other of the two graphics rebuilt as the direction check for the
// user's reference-image "go big like this, one story at a time" call:
// this family maps onto the reference's "Streaks & Upsets" badge-row
// panel) and the v2 "broadcast panel" skin at `compact={true}` (quiet/
// featured tier — the calmer, smaller treatment routine play still gets).
import type { ReactNode } from "react";
import {
  Panel, PanelTag, PanelLine,
  BigPanel, BigPanelHeader, BigHeroNumber, BigMove, BigRow, BigBadge, BigLine,
  pct, str, num,
} from "./kit";
import type { GraphicData, LeagueType } from "../types";
import { LEAGUE_ACCENT } from "../theme";

export function FormWatchGraphic({ leagueType, data, compact }: { leagueType: LeagueType | null; data: GraphicData; compact?: boolean }) {
  const accent = "#0066ff";
  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : accent;
  const subject = str(data, "playerName") ?? str(data, "teamName") ?? null;
  const big = !compact;

  const winStreak = num(data, "currentWinStreak");
  const lossStreak = num(data, "currentLossStreak");
  const recentFive = num(data, "recentFiveWins");
  const priorFive = num(data, "priorFiveWins");
  const positionBefore = num(data, "positionBefore");
  const currentPosition = num(data, "currentPosition");
  const recentRate = num(data, "recentRate");
  const seasonRate = num(data, "seasonRate");
  const winShare = num(data, "winShare");
  const wins = num(data, "wins");
  const losses = num(data, "losses");

  let body: ReactNode;
  let badge: ReactNode = null;
  // Only the two BigRow (ranked-bar) branches actually use a wide panel's
  // width — every other shape here is a single hero number/move/badge, so
  // kit.tsx's own BigPanel `fill={false}` sizes those to content instead
  // of leaving a dead blank strip down the panel's right side (real user
  // feedback on this file's first "Win Streak" screenshot).
  let fillPanel = false;

  if (winStreak !== null) {
    body = big
      ? <BigHeroNumber value={String(winStreak)} label="Match Win Streak" accent="#22c55e" />
      : <div className="bug-chip-in font-black tabular-nums" style={{ animationDelay: "120ms", color: "#22c55e", fontSize: "1.9rem" }}>{winStreak}<span className="uppercase font-bold ml-2" style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.62rem", letterSpacing: "0.06em" }}>Match Win Streak</span></div>;
    if (big) badge = <BigBadge accent="#22c55e">W{winStreak}</BigBadge>;
  } else if (lossStreak !== null) {
    body = big
      ? <BigHeroNumber value={String(lossStreak)} label="Match Loss Streak" accent="#ff005c" />
      : <div className="bug-chip-in font-black tabular-nums" style={{ animationDelay: "120ms", color: "#ff005c", fontSize: "1.9rem" }}>{lossStreak}<span className="uppercase font-bold ml-2" style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.62rem", letterSpacing: "0.06em" }}>Match Loss Streak</span></div>;
    if (big) badge = <BigBadge accent="#ff005c">L{lossStreak}</BigBadge>;
  } else if (recentFive !== null && priorFive !== null) {
    const improving = recentFive > priorFive;
    const moveAccent = improving ? "#22c55e" : "#ff005c";
    body = big
      ? <BigMove before={`${priorFive}/5`} after={`${recentFive}/5`} accent={moveAccent} improved={improving} />
      : <div className="bug-chip-in flex items-center gap-2" style={{ animationDelay: "120ms" }}><span className="font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.4)", fontSize: "1rem", textDecoration: "line-through" }}>{priorFive}/5</span><span style={{ color: moveAccent }}>{improving ? "↗" : "↘"}</span><span className="font-black tabular-nums" style={{ color: moveAccent, fontSize: "1.4rem" }}>{recentFive}/5</span></div>;
    if (big) badge = <BigBadge accent={moveAccent}>{improving ? "UP" : "DOWN"}</BigBadge>;
  } else if (positionBefore !== null && currentPosition !== null) {
    const improving = currentPosition < positionBefore;
    body = big
      ? <BigMove before={`P${positionBefore}`} after={`P${currentPosition}`} accent={accent} improved={improving} />
      : <div className="bug-chip-in flex items-center gap-2" style={{ animationDelay: "120ms" }}><span className="font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.4)", fontSize: "1rem", textDecoration: "line-through" }}>P{positionBefore}</span><span style={{ color: accent }}>{improving ? "↗" : "↘"}</span><span className="font-black tabular-nums" style={{ color: accent, fontSize: "1.4rem" }}>P{currentPosition}</span></div>;
  } else if (recentRate !== null && seasonRate !== null) {
    fillPanel = true;
    body = big ? (
      <div className="flex flex-col gap-3">
        <BigRow label="Recent Form" valueLabel={pct(recentRate)} fraction={recentRate} accent={accent} delay={0} />
        <BigRow label="Season Rate" valueLabel={pct(seasonRate)} fraction={seasonRate} accent="rgba(255,255,255,0.45)" delay={1} />
      </div>
    ) : (
      <div className="flex flex-col gap-1.5">
        <div className="bug-chip-in flex items-baseline justify-between gap-2" style={{ animationDelay: "80ms" }}>
          <span className="font-bold" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.64rem" }}>Recent Form</span>
          <span className="font-black tabular-nums" style={{ color: accent, fontSize: "0.72rem" }}>{pct(recentRate)}</span>
        </div>
        <div className="bug-chip-in flex items-baseline justify-between gap-2" style={{ animationDelay: "120ms" }}>
          <span className="font-bold" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.64rem" }}>Season Rate</span>
          <span className="font-black tabular-nums" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem" }}>{pct(seasonRate)}</span>
        </div>
      </div>
    );
  } else if (winShare !== null) {
    fillPanel = big; // BigRow wants the width; the compact PanelBar row doesn't need this flag at all
    const shareLabel = wins !== null && losses !== null ? `${wins}W – ${losses}L` : "Win Share";
    body = big
      ? <BigRow label={shareLabel} valueLabel={pct(winShare)} fraction={winShare} accent={accent} />
      : <div className="bug-chip-in flex items-baseline justify-between gap-2" style={{ animationDelay: "80ms" }}><span className="font-bold" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.64rem" }}>{shareLabel}</span><span className="font-black tabular-nums" style={{ color: accent, fontSize: "0.72rem" }}>{pct(winShare)}</span></div>;
  } else if (wins !== null) {
    body = big
      ? <BigHeroNumber value={String(wins)} label="Wins, Unbeaten" accent="#22c55e" />
      : <div className="bug-chip-in font-black tabular-nums" style={{ animationDelay: "120ms", color: "#22c55e", fontSize: "1.9rem" }}>{wins}<span className="uppercase font-bold ml-2" style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.62rem", letterSpacing: "0.06em" }}>Wins, Unbeaten</span></div>;
  } else {
    body = big ? <BigLine>No form data for this story.</BigLine> : <PanelLine>No form data for this story.</PanelLine>;
  }

  if (big) {
    return (
      <BigPanel accent={accent} fill={fillPanel}>
        <BigPanelHeader icon="📈" kind="Form Watch" leagueType={leagueType} accent={accent} />
        {subject && (
          <div className="bug-chip-in font-bold uppercase truncate" style={{ animationDelay: "80ms", color: leagueAccent, fontSize: "1.15rem", letterSpacing: "0.02em" }}>{subject}</div>
        )}
        {body}
        {badge}
      </BigPanel>
    );
  }

  return (
    <Panel accent={accent} compact>
      <PanelTag icon="📈" kind="Form Watch" leagueType={leagueType} accent={accent} compact />
      {subject && (
        <div className="bug-chip-in font-bold uppercase truncate" style={{ animationDelay: "80ms", color: leagueAccent, fontSize: "0.68rem", letterSpacing: "0.04em" }}>{subject}</div>
      )}
      {body}
    </Panel>
  );
}
