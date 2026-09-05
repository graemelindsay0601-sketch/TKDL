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
  str, num,
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
    return (
      <BigPanel accent={accent} fill>
        <BigPanelHeader icon="📊" kind="Table After Results" leagueType={leagueType} accent={accent} />
        <div className="w-full overflow-hidden rounded-lg border border-white/10">
          <div
            className="grid items-center gap-2 bg-white/10 px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/55"
            style={{ gridTemplateColumns: "2rem minmax(0,1fr) 2.8rem 2.8rem 3.2rem" }}
          >
            <span>Pos</span><span>Player</span><span>W</span><span>L</span><span>Pts</span>
          </div>
          {movementRows.map((row, index) => {
            const name = typeof row.name === "string" ? row.name : "Unknown";
            const afterPosition = typeof row.afterPosition === "number" ? row.afterPosition : index + 1;
            const beforePosition = typeof row.beforePosition === "number" ? row.beforePosition : afterPosition;
            const movement = row.movement === "up" || row.movement === "down" ? row.movement : "same";
            const arrow = movement === "up" ? "▲" : movement === "down" ? "▼" : "—";
            const movementColour = movement === "up" ? "#22c55e" : movement === "down" ? "#ff3b5c" : "rgba(255,255,255,0.38)";
            return (
              <div
                key={`${name}-${afterPosition}`}
                className="grid items-center gap-2 border-t border-white/10 px-3 py-2"
                style={{ gridTemplateColumns: "2rem minmax(0,1fr) 2.8rem 2.8rem 3.2rem" }}
              >
                <span className="font-black text-white">{afterPosition}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-black uppercase" style={{ color: leagueAccent }}>{name}</span>
                  <span className="text-[0.7rem] font-black" style={{ color: movementColour }} aria-label={`${name} moved ${movement}`}>
                    {arrow}{beforePosition !== afterPosition ? Math.abs(beforePosition - afterPosition) : ""}
                  </span>
                </span>
                <span className="font-bold text-white/80">{typeof row.wins === "number" ? row.wins : "—"}</span>
                <span className="font-bold text-white/80">{typeof row.losses === "number" ? row.losses : "—"}</span>
                <span className="font-black" style={{ color: accent }}>{typeof row.points === "number" ? row.points : "—"}</span>
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
