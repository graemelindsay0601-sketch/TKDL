// TKDL LIVE — MatchContextGraphic (GRAPHIC_KIND_BY_STORY_TYPE: UPSET,
// MAJOR_UPSET, MODEL_SHOCK, LEADER_BEATEN, STREAK_BREAKER, PAIR_UPSET,
// SHIFT_COMEBACK, LAST_MEETING). A result-strip shaped visual — a W/L pair
// with the specific context that made the result notable (an upset
// probability, a broken streak length, a recovered deficit, a last-meeting
// date) — instead of the old shared chip grid rendering "score"/
// "modelProbability"/"gap" as label/value pills that were never actually
// present under those guessed names (see kit.tsx's own header).
//
// On kit.tsx's v3 "BigBoard" skin at `compact={false}` (major visual tier)
// and the v2 "broadcast panel" skin at `compact={true}` (quiet/featured
// tier). None of this family's shapes are row/table-like, so every
// BigPanel below is `fill={false}` (sized to its own content — see
// BigPanel's own comment on why).
import { Panel, PanelTag, PanelLine, BigPanel, BigPanelHeader, BigMove, BigLine, pct, str, num, WinnerBeat } from "./kit";
import type { GraphicData, LeagueType } from "../types";
import { LEAGUE_ACCENT } from "../theme";

const ACCENT = "#ff005c";

function WinLoseStrip({ winner, loser, compact }: { winner: string; loser: string; leagueAccent: string; compact?: boolean }) {
  return <WinnerBeat winner={winner} loser={loser} big={!compact} />;
}

function BigWinLoseStrip({ winner, loser }: { winner: string; loser: string; leagueAccent: string }) {
  return <WinnerBeat winner={winner} loser={loser} big />;
}

export function MatchContextGraphic({ leagueType, data, compact }: { leagueType: LeagueType | null; data: GraphicData; compact?: boolean }) {
  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : ACCENT;
  const big = !compact;

  const winner = str(data, "winnerName") ?? str(data, "winnerTeamName");
  const loser = str(data, "loserName") ?? str(data, "loserTeamName");
  if (winner && loser) {
    let context: string | null = null;
    const winnerProbability = num(data, "winnerProbability");
    const brokenWinStreak = num(data, "brokenWinStreak");
    const endedLossStreak = num(data, "endedLossStreak");
    const leaderPointsBefore = num(data, "leaderPointsBefore");
    if (winnerProbability !== null) context = `${pct(winnerProbability)} chance going in`;
    else if (brokenWinStreak !== null) context = `Ended a ${brokenWinStreak}-match win streak`;
    else if (endedLossStreak !== null) context = `Snapped a ${endedLossStreak}-match losing run`;
    else if (leaderPointsBefore !== null) context = `Beat the table leader (${leaderPointsBefore} pts)`;

    if (big) {
      return (
        <BigPanel accent={ACCENT} fill={false}>
          <BigPanelHeader icon="🎯" kind="Match Context" leagueType={leagueType} accent={ACCENT} />
          <BigWinLoseStrip winner={winner} loser={loser} leagueAccent={leagueAccent} />
          {context && <BigLine>{context}</BigLine>}
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="🎯" kind="Match Context" leagueType={leagueType} accent={ACCENT} compact />
        <WinLoseStrip winner={winner} loser={loser} leagueAccent={leagueAccent} compact />
        {context && <PanelLine>{context}</PanelLine>}
      </Panel>
    );
  }

  // LAST_MEETING — no direct winner/loser fact, just the two entities and who won last time.
  const entityA = str(data, "entityAName");
  const entityB = str(data, "entityBName");
  const lastWinner = str(data, "lastMeetingWinnerName");
  const playedAt = str(data, "lastMeetingPlayedAt");
  if (entityA && entityB) {
    // Was `{ day: "numeric", month: "short" }` — omitting the year entirely,
    // so "12 Jan" rendered identically whether that meeting was 3 months or
    // 3 years ago. This is the one archive graphic that DOES carry real
    // date data (lastMeetingPlayedAt), so hiding the year was actively
    // hiding the one thing that would tell a viewer how old "last meeting"
    // really is — part of a real user report about archive/retrospective
    // content being impossible to place in time.
    const date = playedAt ? new Date(playedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
    if (big) {
      return (
        <BigPanel accent={ACCENT} fill={false}>
          <BigPanelHeader icon="🎯" kind="Last Meeting" leagueType={leagueType} accent={ACCENT} />
          <div className="bug-chip-in font-black uppercase" style={{ animationDelay: "80ms", color: leagueAccent, fontSize: "1.6rem" }}>{entityA} <span style={{ color: "rgba(255,255,255,0.3)" }}>vs</span> {entityB}</div>
          {lastWinner && <BigLine>Won by {lastWinner}{date ? ` · ${date}` : ""}</BigLine>}
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="🎯" kind="Last Meeting" leagueType={leagueType} accent={ACCENT} compact />
        <div className="bug-chip-in font-black uppercase" style={{ animationDelay: "80ms", color: leagueAccent, fontSize: "0.85rem" }}>{entityA} <span style={{ color: "rgba(255,255,255,0.3)" }}>vs</span> {entityB}</div>
        {lastWinner && <PanelLine>Won by {lastWinner}{date ? ` · ${date}` : ""}</PanelLine>}
      </Panel>
    );
  }

  // SHIFT_COMEBACK — a shrinking deficit.
  const teamName = str(data, "teamName");
  const deficitBefore = num(data, "deficitBefore");
  const deficitNow = num(data, "deficitNow");
  if (teamName && deficitBefore !== null && deficitNow !== null) {
    if (big) {
      return (
        <BigPanel accent={ACCENT} fill={false}>
          <BigPanelHeader icon="🎯" kind="The Comeback" leagueType={leagueType} accent={ACCENT} />
          <div className="bug-chip-in font-black uppercase truncate" style={{ animationDelay: "80ms", color: leagueAccent, fontSize: "1.3rem" }}>{teamName}</div>
          <BigMove before={`-${deficitBefore}`} after={`-${deficitNow}`} accent="#22c55e" improved />
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="🎯" kind="The Comeback" leagueType={leagueType} accent={ACCENT} compact />
        <div className="bug-chip-in font-black uppercase truncate" style={{ animationDelay: "80ms", color: leagueAccent, fontSize: "0.9rem" }}>{teamName}</div>
        <div className="bug-chip-in flex items-center gap-2" style={{ animationDelay: "120ms" }}>
          <span className="font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.4)", fontSize: "1rem", textDecoration: "line-through" }}>-{deficitBefore}</span>
          <span style={{ color: "#22c55e" }}>↗</span>
          <span className="font-black tabular-nums" style={{ color: "#22c55e", fontSize: "1.4rem" }}>-{deficitNow}</span>
        </div>
      </Panel>
    );
  }

  if (big) {
    return (
      <BigPanel accent={ACCENT} fill={false}>
        <BigPanelHeader icon="🎯" kind="Match Context" leagueType={leagueType} accent={ACCENT} />
        <BigLine>No match context for this story.</BigLine>
      </BigPanel>
    );
  }
  return (
    <Panel accent={ACCENT} compact>
      <PanelTag icon="🎯" kind="Match Context" leagueType={leagueType} accent={ACCENT} compact />
      <PanelLine>No match context for this story.</PanelLine>
    </Panel>
  );
}
