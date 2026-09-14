// TKDL LIVE — WagerGraphic (GRAPHIC_KIND_BY_STORY_TYPE: HIGH_STAKE_WIN,
// HIGH_STAKE_LOSS — section 8.5/8.6's own stake-simulation concept). A
// betting-slip shaped stake ticket — the stake as the hero number, the
// winner/loser either side, a bar showing how far past the high-stake
// threshold it was — instead of the old shared chip grid's guessed
// "wagerAmount"/"stakeAmount" keys, neither of which this family's own
// facts (story-detectors-result.ts) actually uses (see kit.tsx's own
// header).
//
// On kit.tsx's v3 "BigBoard" skin at `compact={false}` (major visual tier)
// and the v2 "broadcast panel" skin at `compact={true}` (quiet/featured
// tier).
import { Panel, PanelTag, PanelBar, PanelLine, BigPanel, BigPanelHeader, BigHeroNumber, BigRow, BigLine, str, num } from "./kit";
import type { GraphicData, LeagueType } from "../types";
import { LEAGUE_ACCENT } from "../theme";

const ACCENT = "#22c55e";

export function WagerGraphic({ leagueType, data, compact }: { leagueType: LeagueType | null; data: GraphicData; compact?: boolean }) {
  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : ACCENT;
  const big = !compact;
  // Editorial-desk features sharing this graphic (Risk Profile, What Would
  // You Wager?) carry their own featureTitle and their own identity shape —
  // a single subject, or a hypothetical pairing with no winner — unlike the
  // genuine HIGH_STAKE_WIN/LOSS stories' winnerName/loserName, so both are
  // read here rather than assuming every facts payload is a real result.
  const header = str(data, "featureTitle") ?? "The Wager";
  const winner = str(data, "winnerName");
  const loser = str(data, "loserName");
  const soloPlayer = str(data, "playerName");
  const firstPlayer = str(data, "firstPlayerName");
  const secondPlayer = str(data, "secondPlayerName");
  const stake = num(data, "stake");
  const threshold = num(data, "highStakeThreshold");

  if (stake === null) {
    if (big) {
      return (
        <BigPanel accent={ACCENT} fill={false}>
          <BigPanelHeader icon="💰" kind={header} leagueType={leagueType} accent={ACCENT} />
          <BigLine>No stake data for this story.</BigLine>
        </BigPanel>
      );
    }
    return (
      <Panel accent={ACCENT} compact>
        <PanelTag icon="💰" kind={header} leagueType={leagueType} accent={ACCENT} compact />
        <PanelLine>No stake data for this story.</PanelLine>
      </Panel>
    );
  }

  const overThreshold = threshold !== null && threshold > 0 ? Math.min(stake / (threshold * 2), 1) : undefined;
  const hasBar = overThreshold !== undefined && threshold !== null;
  const stakeLabel = soloPlayer ? "Average Wager" : "Points Staked";

  if (big) {
    return (
      <BigPanel accent={ACCENT} fill={hasBar}>
        <BigPanelHeader icon="💰" kind={header} leagueType={leagueType} accent={ACCENT} />
        <BigHeroNumber value={String(stake)} label={stakeLabel} accent={ACCENT} />
        {winner && loser && (
          <div className="bug-chip-in flex items-baseline gap-3" style={{ animationDelay: "160ms" }}>
            <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "1.1rem" }}>{winner}</span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.9rem" }}>beat</span>
            <span className="font-bold uppercase truncate" style={{ color: "rgba(255,255,255,0.55)", fontSize: "1.1rem" }}>{loser}</span>
          </div>
        )}
        {!winner && soloPlayer && (
          <div className="bug-chip-in" style={{ animationDelay: "160ms" }}>
            <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "1.1rem" }}>{soloPlayer}</span>
          </div>
        )}
        {!winner && !soloPlayer && firstPlayer && secondPlayer && (
          <div className="bug-chip-in flex items-baseline gap-3" style={{ animationDelay: "160ms" }}>
            <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "1.1rem" }}>{firstPlayer}</span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.9rem" }}>vs</span>
            <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "1.1rem" }}>{secondPlayer}</span>
          </div>
        )}
        {hasBar && (
          <BigRow label="Vs High-Stake Line" valueLabel={`${threshold}+`} fraction={overThreshold!} accent={ACCENT} delay={3} />
        )}
      </BigPanel>
    );
  }

  return (
    <Panel accent={ACCENT} compact>
      <PanelTag icon="💰" kind={header} leagueType={leagueType} accent={ACCENT} compact />
      <div className="badge-pop-in font-black tabular-nums" style={{ color: ACCENT, fontSize: "1.9rem" }}>{stake}<span className="uppercase font-bold ml-2" style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.6rem", letterSpacing: "0.06em" }}>{stakeLabel}</span></div>
      {winner && loser && (
        <div className="bug-chip-in flex items-baseline gap-2" style={{ animationDelay: "160ms" }}>
          <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "0.72rem" }}>{winner}</span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.66rem" }}>beat</span>
          <span className="font-bold uppercase truncate" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem" }}>{loser}</span>
        </div>
      )}
      {!winner && soloPlayer && (
        <div className="bug-chip-in" style={{ animationDelay: "160ms" }}>
          <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "0.72rem" }}>{soloPlayer}</span>
        </div>
      )}
      {!winner && !soloPlayer && firstPlayer && secondPlayer && (
        <div className="bug-chip-in flex items-baseline gap-2" style={{ animationDelay: "160ms" }}>
          <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "0.72rem" }}>{firstPlayer}</span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.66rem" }}>vs</span>
          <span className="font-black uppercase truncate" style={{ color: leagueAccent, fontSize: "0.72rem" }}>{secondPlayer}</span>
        </div>
      )}
      {hasBar && (
        <PanelBar label="Vs High-Stake Line" valueLabel={`${threshold}+`} fraction={overThreshold!} accent={ACCENT} compact />
      )}
    </Panel>
  );
}
