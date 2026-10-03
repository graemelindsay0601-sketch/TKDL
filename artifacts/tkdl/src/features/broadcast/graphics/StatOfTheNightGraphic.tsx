// TKDL LIVE — StatOfTheNightGraphic: the "hero number" treatment a verified
// SEASON_BEST/PERSONAL_BEST record earns once the Story Engine itself has
// scored it "major" (api-shapes.ts's own graphicKindForSegment) — a step up
// from ResultGraphic's generic fact-chip card, built entirely from kit.tsx's
// shared BigBoard primitives (BigPanel/BigPanelHeader/BigHeroNumber/
// BigBadge) rather than a bespoke layout, since a single verified number IS
// exactly what BigHeroNumber was already built for.
import { LEAGUE_ACCENT } from "../theme";
import { GraphicFrame } from "./GraphicFrame";
import { Panel, PanelTag, PanelLine, BigPanel, BigPanelHeader, BigHeroNumber, BigBadge } from "./kit";
import { buildStatOfTheNightModel } from "./stat-of-the-night-graphic";
import type { GraphicData, LeagueType } from "../types";

const GOLD = "#ffd24a";

export function StatOfTheNightGraphic({
  leagueType, data, compact,
}: { leagueType: LeagueType | null; data: GraphicData; compact?: boolean }) {
  const model = buildStatOfTheNightModel(data);
  const big = !compact;
  if (!model) return <GraphicFrame kind="Stat of the Night" icon="⭐" accent={GOLD} leagueType={leagueType} data={data} compact={compact} />;

  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : GOLD;

  if (big) {
    return (
      <BigPanel accent={GOLD} fill={false}>
        <BigPanelHeader icon="⭐" kind="Stat of the Night" leagueType={leagueType} accent={GOLD} />
        <div className="bug-chip-in font-bold uppercase truncate" style={{ animationDelay: "80ms", color: leagueAccent, fontSize: "1.15rem", letterSpacing: "0.02em" }}>{model.playerName}</div>
        <BigHeroNumber value={model.valueLabel} label={model.metricLabel} accent={GOLD} />
        <BigBadge accent={GOLD}>Verified {model.scopeLabel}</BigBadge>
      </BigPanel>
    );
  }

  return (
    <Panel accent={GOLD} compact>
      <PanelTag icon="⭐" kind="Stat of the Night" leagueType={leagueType} accent={GOLD} compact />
      <div className="bug-chip-in font-bold uppercase truncate" style={{ animationDelay: "80ms", color: leagueAccent, fontSize: "0.68rem", letterSpacing: "0.04em" }}>{model.playerName}</div>
      <div className="bug-chip-in font-black tabular-nums" style={{ animationDelay: "120ms", color: GOLD, fontSize: "1.9rem" }}>
        {model.valueLabel}
        <span className="uppercase font-bold ml-2" style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.62rem", letterSpacing: "0.06em" }}>{model.metricLabel}</span>
      </div>
      <PanelLine>Verified {model.scopeLabel}</PanelLine>
    </Panel>
  );
}
