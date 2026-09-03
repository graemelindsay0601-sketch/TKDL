// TKDL LIVE — HeadToHeadGraphic (GRAPHIC_KIND_BY_STORY_TYPE: FIRST_H2H_WIN,
// REVENGE, H2H_DOMINANCE, RIVALRY, RIVALRY_SWING, HISTORICAL_H2H).
//
// On kit.tsx's v3 "BigBoard" skin at `compact={false}` (major visual tier
// — real user feedback, via a reference image, "go big like this, one
// story at a time") and the v2 "broadcast panel" skin at `compact={true}`
// (quiet/featured tier — the calmer, smaller treatment routine play still
// gets). Real user feedback on the earlier v1 glass-chip version: "far too
// much like you've took an actual screenshot of the stats and just pasting
// it in" — both skins below use solid-fill name plates angled toward a
// centre point, not two names floating on a translucent blurred card
// either side of a plain "VS" label.
//
// Fact-shape note: this story family's own facts (story-detectors-h2h.ts,
// story-detectors-result.ts, story-detectors-archive.ts) don't share one
// consistent pair of name keys — H2H_DOMINANCE names its two sides
// "dominantPlayer"/"dominatedPlayer", RIVALRY uses "playerA"/"playerB",
// HISTORICAL_H2H uses "entityA"/"entityB", and FIRST_H2H_WIN/REVENGE only
// ever carry a winner/loser pair — so `resolveSides` below tries each named
// pair in turn rather than assuming one.
import { Panel, PanelTag, VersusPanel, PanelLine, BigPanel, BigPanelHeader, BigVersus, BigLine, pct, str, num } from "./kit";
import type { GraphicData, LeagueType } from "../types";
import { LEAGUE_ACCENT } from "../theme";

const ACCENT = "#22c55e";
const MUTED = "#8b93a1"; // solid slate — this skin's name plates are opaque fills, so the "underdog" side needs an actual opaque colour rather than v1's translucent rgba(255,255,255,0.55) text tint

type Sides = { left: string; right: string; leftWins: number | null; rightWins: number | null };

function resolveSides(data: GraphicData): Sides | null {
  const dominant = str(data, "dominantPlayerName");
  const dominated = str(data, "dominatedPlayerName");
  if (dominant && dominated) {
    const wins = num(data, "wins");
    const played = num(data, "gamesPlayed");
    return { left: dominant, right: dominated, leftWins: wins, rightWins: played !== null && wins !== null ? played - wins : null };
  }

  const playerA = str(data, "playerAName");
  const playerB = str(data, "playerBName");
  if (playerA && playerB) return { left: playerA, right: playerB, leftWins: num(data, "aWins"), rightWins: num(data, "bWins") };

  const entityA = str(data, "entityAName");
  const entityB = str(data, "entityBName");
  if (entityA && entityB) return { left: entityA, right: entityB, leftWins: num(data, "aWins"), rightWins: num(data, "bWins") };

  const careerLeader = str(data, "careerLeaderPlayerName");
  const recentLeader = str(data, "recentLeaderPlayerName");
  if (careerLeader && recentLeader) return { left: careerLeader, right: recentLeader, leftWins: num(data, "aWins"), rightWins: num(data, "bWins") };

  const winner = str(data, "winnerName");
  const loser = str(data, "loserName");
  if (winner && loser) return { left: winner, right: loser, leftWins: null, rightWins: null };

  return null;
}

function contextLine(data: GraphicData): string | null {
  const priorLosses = num(data, "priorLossesToThisOpponent");
  if (priorLosses !== null) return `First win in ${priorLosses} meeting${priorLosses === 1 ? "" : "s"}`;

  const priorLossStreak = num(data, "consecutivePriorLosses");
  if (priorLossStreak !== null) return `Revenge after ${priorLossStreak} straight loss${priorLossStreak === 1 ? "" : "es"} to them`;

  const window = num(data, "recentWindowSize");
  if (window !== null) return `Career leader flipped over the last ${window} meetings`;

  const played = num(data, "gamesPlayed");
  if (played !== null) return `${played} meeting${played === 1 ? "" : "s"} head to head`;

  return null;
}

export function HeadToHeadGraphic({ leagueType, data, compact }: { leagueType: LeagueType | null; data: GraphicData; compact?: boolean }) {
  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : ACCENT;
  const sides = resolveSides(data);
  const context = contextLine(data);
  const big = !compact;

  const total = sides && sides.leftWins !== null && sides.rightWins !== null ? sides.leftWins + sides.rightWins : null;
  const splitFraction = total && total > 0 ? sides!.leftWins! / total : undefined;
  const splitLabel = sides && sides.leftWins !== null && sides.rightWins !== null ? `${sides.leftWins}–${sides.rightWins}` : undefined;
  const fullSplitLabel = splitLabel ? `${splitLabel}${splitFraction !== undefined ? ` · ${pct(splitFraction)}` : ""}` : undefined;

  if (big) {
    return (
      <BigPanel accent={ACCENT} fill={false}>
        <BigPanelHeader icon="⚔️" kind="Head to Head" leagueType={leagueType} accent={ACCENT} />
        {sides ? (
          <>
            <BigVersus
              leftName={sides.left}
              rightName={sides.right}
              leftAccent={leagueAccent}
              rightAccent={MUTED}
              splitFraction={splitFraction}
              splitLabel={fullSplitLabel}
            />
            {context && <BigLine>{context}</BigLine>}
          </>
        ) : (
          <BigLine>No head-to-head data for this story.</BigLine>
        )}
      </BigPanel>
    );
  }

  return (
    <Panel accent={ACCENT} compact>
      <PanelTag icon="⚔️" kind="Head to Head" leagueType={leagueType} accent={ACCENT} compact />
      {sides ? (
        <>
          <VersusPanel
            leftName={sides.left}
            rightName={sides.right}
            leftAccent={leagueAccent}
            rightAccent={MUTED}
            splitFraction={splitFraction}
            splitLabel={fullSplitLabel}
            compact
          />
          {context && <PanelLine>{context}</PanelLine>}
        </>
      ) : (
        <PanelLine>No head-to-head data for this story.</PanelLine>
      )}
    </Panel>
  );
}
