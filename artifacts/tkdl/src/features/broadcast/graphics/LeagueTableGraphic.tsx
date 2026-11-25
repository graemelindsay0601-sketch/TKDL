// TKDL LIVE — LeagueTableGraphic (GRAPHIC_KIND_BY_STORY_TYPE: NEW_LEADER,
// LEAD_TIGHTENS, LEAD_WIDENS, TIE_PENDING, CHAMPION, SEASON_KICKOFF,
// SHIFT_LEAD_CHANGE, SHIFT_MOMENTUM). A standings-ladder shaped visual — a
// leapfrog move for a leadership change, a gap-meter for the margin
// tightening/widening, a level-pegging row for a tie, a full-width crown
// card for a champion, a fresh-board card for a new season kicking off —
// instead of the old shared chip grid rendering "points"/"currentGap"/
// "previousGap" as unrelated label/value pills (see kit.tsx's own header).
//
// On kit.tsx's v3 "BigBoard" skin at `compact={false}` (major visual tier —
// this is the closest of all seven graphics to the reference image's own
// "Singles/Doubles Standings" table panels) and the v2 "broadcast panel"
// skin at `compact={true}` (quiet/featured tier).
import {
  Panel, PanelTag, PanelBar, PanelFlag, PanelLine,
  BigPanel, BigPanelHeader, BigRow, BigMove, BigBadge, BigLine,
  str, num, staggerDelay,
} from "./kit";
import type { GraphicData, LeagueType } from "../types";
import { LEAGUE_ACCENT } from "../theme";

const GAP_METER_MAX = 15; // points — a gap wider than this reads as "commanding," not something the meter needs to keep scaling for

export function LeagueTableGraphic({ leagueType, data, compact }: { leagueType: LeagueType | null; data: GraphicData; compact?: boolean }) {
  const accent = "#ffd24a";
  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : accent;
  const big = !compact;

  const movementRows = Array.isArray(data.rows)
    ? data.rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    : [];
  if (movementRows.length > 0) {
    // The four editorial-desk features that share this rows-shaped branch
    // (Survival Watch, Survivors Remaining, Power Five, Season Story So Far)
    // carry their own featureTitle; the genuine post-match leaderboard story
    // doesn't set one, so it keeps the "Table After Results" fallback.
    const rowsHeader = str(data, "featureTitle") ?? "Table After Results";
    return (
      <BigPanel accent={accent} fill>
        <BigPanelHeader icon="📊" kind={rowsHeader} leagueType={leagueType} accent={accent} />
        <div className="w-full flex flex-col gap-1.5">
          <div className="grid items-center gap-2 px-3" style={{ gridTemplateColumns: "2rem minmax(0,1fr) 3.4rem 3rem" }}>
            <span className="pm-lab" style={{ fontSize: 9 }}>Pos</span><span className="pm-lab" style={{ fontSize: 9 }}>Player</span><span className="pm-lab" style={{ fontSize: 9, justifyContent: "center" }}>W–L</span><span className="pm-lab" style={{ fontSize: 9, justifyContent: "flex-end" }}>Pts</span>
          </div>
          {movementRows.map((row, index) => {
            const name = typeof row.name === "string" ? row.name : "Unknown";
            const afterPosition = typeof row.afterPosition === "number" ? row.afterPosition : index + 1;
            const beforePosition = typeof row.beforePosition === "number" ? row.beforePosition : afterPosition;
            const movement = row.movement === "up" || row.movement === "down" ? row.movement : "same";
            const arrow = movement === "up" ? "▲" : movement === "down" ? "▼" : "";
            const movementColour = movement === "up" ? "#4ade80" : movement === "down" ? "#ff6b6b" : "rgba(255,255,255,0.38)";
            const coin = afterPosition === 1 ? "linear-gradient(180deg,#ffe58a,#d99a00)" : afterPosition === 2 ? "linear-gradient(180deg,#ffffff,#9aa3b8)" : afterPosition === 3 ? "linear-gradient(180deg,#f2b989,#9c5a2c)" : null;
            return (
              <div
                key={`${name}-${afterPosition}`}
                className="bug-chip-in grid items-center gap-2 px-3 py-1.5"
                style={{ gridTemplateColumns: "2rem minmax(0,1fr) 3.4rem 3rem", borderRadius: 12, background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.012))", border: `1px solid ${afterPosition === 1 ? "rgba(255,210,74,.45)" : "rgba(255,255,255,.08)"}`, animationDelay: staggerDelay(index) }}
              >
                <span className="flex items-center justify-center rounded-full" style={{ width: 26, height: 26, fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 12, color: coin ? "#1a1200" : "#cfcade", background: coin ?? "linear-gradient(180deg,#3a3550,#1c1a28)" }}>{afterPosition}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="pm-chrome truncate uppercase" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.02rem" }}>{name}</span>
                  {arrow && (
                    <span className="text-[0.7rem] font-black" style={{ color: movementColour }} aria-label={`${name} moved ${movement}`}>
                      {arrow}{beforePosition !== afterPosition ? Math.abs(beforePosition - afterPosition) : ""}
                    </span>
                  )}
                </span>
                <span className="text-center tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: "#cfcade", fontSize: "0.9rem" }}>{typeof row.wins === "number" ? row.wins : "—"}–{typeof row.losses === "number" ? row.losses : "—"}</span>
                <span className="pm-num text-right tabular-nums" style={{ color: accent, fontSize: "1.15rem", textShadow: `0 0 10px ${accent}66` }}>{typeof row.points === "number" ? row.points : "—"}</span>
              </div>
            );
          })}
        </div>
      </BigPanel>
    );
  }

  const kickoffSeasonName = str(data, "seasonName");
  const kickoffEntrantCount = num(data, "entrantCount");
  if (kickoffSeasonName) {
    if (big) {
      return (
        <BigPanel accent={accent} fill={false}>
          <BigPanelHeader icon="🆕" kind="New Season" leagueType={leagueType} accent={accent} />
          <div className="badge-pop-in font-black uppercase" style={{ color: accent, fontSize: "2.4rem", lineHeight: 1.05, textShadow: `0 0 40px ${accent}66` }}>{kickoffSeasonName}</div>
          {kickoffEntrantCount !== null && <BigLine>{kickoffEntrantCount} {kickoffEntrantCount === 1 ? "entrant" : "entrants"} back on the board</BigLine>}
        </BigPanel>
      );
    }
    return (
      <Panel accent={accent} compact>
        <PanelTag icon="🆕" kind="New Season" leagueType={leagueType} accent={accent} compact />
        <div className="badge-pop-in font-black uppercase truncate" style={{ animationDelay: "80ms", color: accent, fontSize: "1.1rem" }}>{kickoffSeasonName}</div>
        {kickoffEntrantCount !== null && <PanelLine>{kickoffEntrantCount} {kickoffEntrantCount === 1 ? "entrant" : "entrants"} back on the board</PanelLine>}
      </Panel>
    );
  }

  const championName = str(data, "championEntityName");
  if (championName) {
    if (big) {
      return (
        <BigPanel accent={accent} fill={false}>
          <BigPanelHeader icon="🏆" kind="Champion" leagueType={leagueType} accent={accent} />
          <div className="badge-pop-in font-black uppercase" style={{ color: accent, fontSize: "3.2rem", lineHeight: 1.05, textShadow: `0 0 44px ${accent}88, 0 0 10px ${accent}dd` }}>{championName}</div>
        </BigPanel>
      );
    }
    return (
      <Panel accent={accent} compact>
        <PanelTag icon="🏆" kind="Champion" leagueType={leagueType} accent={accent} compact />
        <div className="badge-pop-in font-black uppercase" style={{ color: accent, fontSize: "1.5rem", lineHeight: 1.05, textShadow: `0 0 28px ${accent}55` }}>{championName}</div>
      </Panel>
    );
  }

  const tiedNames = str(data, "tiedEntityNamesJoined");
  const tiedPoints = num(data, "points");
  if (tiedNames) {
    const names = tiedNames.split(", ");
    if (big) {
      return (
        <BigPanel accent={accent} fill={false}>
          <BigPanelHeader icon="📊" kind="League Table" leagueType={leagueType} accent={accent} />
          <div className="bug-chip-in flex flex-wrap items-baseline gap-x-3 gap-y-1" style={{ animationDelay: "80ms" }}>
            {names.map((name, i) => (
              <span key={name}>
                <span className="font-black uppercase" style={{ color: leagueAccent, fontSize: "1.6rem" }}>{name}</span>
                {i < names.length - 1 && <span style={{ color: "rgba(255,255,255,0.35)" }}> · </span>}
              </span>
            ))}
          </div>
          {tiedPoints !== null && <BigLine>Level on {tiedPoints} points</BigLine>}
          <BigBadge accent={accent}>Tiebreak</BigBadge>
        </BigPanel>
      );
    }
    return (
      <Panel accent={accent} compact>
        <PanelTag icon="📊" kind="League Table" leagueType={leagueType} accent={accent} compact />
        <div className="bug-chip-in flex flex-wrap items-baseline gap-x-2 gap-y-0.5" style={{ animationDelay: "80ms" }}>
          {names.map((name, i) => (
            <span key={name}>
              <span className="font-black uppercase" style={{ color: leagueAccent, fontSize: "1rem" }}>{name}</span>
              {i < names.length - 1 && <span style={{ color: "rgba(255,255,255,0.35)" }}> · </span>}
            </span>
          ))}
        </div>
        {tiedPoints !== null && <PanelLine>Level on {tiedPoints} points</PanelLine>}
        <PanelFlag accent={accent}>Tiebreak</PanelFlag>
      </Panel>
    );
  }

  const newLeader = str(data, "newLeaderEntityName") ?? str(data, "newLeaderTeamName");
  const previousLeader = str(data, "previousLeaderEntityName") ?? str(data, "previousLeaderTeamName");
  const points = num(data, "points");
  if (newLeader && previousLeader) {
    if (big) {
      return (
        <BigPanel accent={accent} fill={false}>
          <BigPanelHeader icon="📊" kind="New Leader" leagueType={leagueType} accent={accent} />
          <BigMove before={previousLeader} after={newLeader} accent={accent} improved />
          {points !== null && <BigLine>{points} points at the top</BigLine>}
        </BigPanel>
      );
    }
    return (
      <Panel accent={accent} compact>
        <PanelTag icon="📊" kind="New Leader" leagueType={leagueType} accent={accent} compact />
        <div className="bug-chip-in font-black uppercase truncate" style={{ animationDelay: "80ms", color: accent, fontSize: "1rem" }}>{previousLeader} → {newLeader}</div>
        {points !== null && <PanelLine>{points} points at the top</PanelLine>}
      </Panel>
    );
  }

  const leader = str(data, "leaderEntityName") ?? str(data, "leaderTeamName");
  const previousGap = num(data, "previousGap");
  const currentGap = num(data, "currentGap");
  if (leader && currentGap !== null) {
    const widening = previousGap !== null ? currentGap > previousGap : true;
    const gapAccent = widening ? "#22c55e" : "#ff005c";
    if (big) {
      return (
        <BigPanel accent={accent}>
          <BigPanelHeader icon="📊" kind="League Table" leagueType={leagueType} accent={accent} />
          <BigRow
            label={leader}
            valueLabel={`${currentGap} pts`}
            fraction={currentGap / GAP_METER_MAX}
            accent={gapAccent}
          />
          <BigLine>{widening ? "Lead widening" : "Lead tightening"}{previousGap !== null ? ` — was ${previousGap} pts` : ""}</BigLine>
        </BigPanel>
      );
    }
    return (
      <Panel accent={accent} compact>
        <PanelTag icon="📊" kind="League Table" leagueType={leagueType} accent={accent} compact />
        <div className="bug-chip-in font-black uppercase truncate" style={{ animationDelay: "80ms", color: leagueAccent, fontSize: "0.95rem" }}>{leader}</div>
        <PanelBar
          label={widening ? "Lead Widening" : "Lead Tightening"}
          valueLabel={`${currentGap} pts`}
          fraction={currentGap / GAP_METER_MAX}
          accent={gapAccent}
          compact
        />
        {previousGap !== null && <PanelLine>Was {previousGap} pts</PanelLine>}
      </Panel>
    );
  }

  if (big) {
    return (
      <BigPanel accent={accent} fill={false}>
        <BigPanelHeader icon="📊" kind="League Table" leagueType={leagueType} accent={accent} />
        <BigLine>No standings data for this story.</BigLine>
      </BigPanel>
    );
  }
  return (
    <Panel accent={accent} compact>
      <PanelTag icon="📊" kind="League Table" leagueType={leagueType} accent={accent} compact />
      <PanelLine>No standings data for this story.</PanelLine>
    </Panel>
  );
}
