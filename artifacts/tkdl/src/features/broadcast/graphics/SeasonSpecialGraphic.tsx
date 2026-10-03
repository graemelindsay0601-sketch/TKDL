// TKDL LIVE — SeasonSpecialGraphic: the Season Finale / Awards Night
// special's own two ceremony boards (gamerscore leaderboard, Hall of Fame
// nods) — real user ask, named alongside the champion crowning and the
// season's biggest upset as its own distinct special-edition content, not
// just another LeagueTableGraphic standings card. Built from kit.tsx's
// shared BigBoard primitives at a deliberately gold-forward "ceremony"
// treatment (BroadcastPlayer.tsx's own ShowTitleBar special treatment uses
// the same gold) rather than each league's own LEAGUE_ACCENT colour — this
// board is never about one league, it's a whole-club career-wide shoutout.
import { GraphicFrame } from "./GraphicFrame";
import { Panel, PanelTag, PanelLine, BigPanel, BigPanelHeader, BigRow, staggerDelay, withAlpha } from "./kit";
import { buildSeasonSpecialModel } from "./season-special-graphic";
import type { GraphicData, LeagueType } from "../types";

const GOLD = "#ffd24a";

export function SeasonSpecialGraphic({
  leagueType, data, compact,
}: { leagueType: LeagueType | null; data: GraphicData; compact?: boolean }) {
  const model = buildSeasonSpecialModel(data);
  const big = !compact;
  if (!model) return <GraphicFrame kind="Season Finale" icon="🏆" accent={GOLD} leagueType={leagueType} data={data} compact={compact} />;

  const icon = model.kind === "gamerscore_leaderboard" ? "🎮" : "🏆";

  if (model.kind === "gamerscore_leaderboard") {
    const topScore = model.rows[0]?.gamerscore ?? 0;
    const rows = big ? model.rows : model.rows.slice(0, 3);
    if (big) {
      return (
        <BigPanel accent={GOLD} fill dense>
          <BigPanelHeader icon={icon} kind={model.title} leagueType={null} accent={GOLD} />
          <div className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <div key={row.name}>
                <BigRow
                  rank={row.rank}
                  label={row.name}
                  valueLabel={`${row.gamerscore.toLocaleString()} GS`}
                  fraction={topScore > 0 ? row.gamerscore / topScore : 0}
                  accent={GOLD}
                  delay={index}
                  dense
                />
              </div>
            ))}
          </div>
        </BigPanel>
      );
    }
    return (
      <Panel accent={GOLD} compact>
        <PanelTag icon={icon} kind={model.title} leagueType={null} accent={GOLD} compact />
        <div className="flex flex-col gap-1.5">
          {rows.map((row, index) => (
            <div key={row.name} className="bug-chip-in flex items-baseline justify-between gap-2" style={{ animationDelay: staggerDelay(index) }}>
              <span className="font-bold truncate" style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.68rem" }}>{row.rank}. {row.name}</span>
              <span className="font-black tabular-nums shrink-0" style={{ color: GOLD, fontSize: "0.72rem" }}>{row.gamerscore.toLocaleString()} GS</span>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  // hall_of_fame_nods
  const nods = big ? model.nods : model.nods.slice(0, 2);
  if (big) {
    return (
      <BigPanel accent={GOLD} fill dense>
        <BigPanelHeader icon={icon} kind={model.title} leagueType={null} accent={GOLD} />
        <div className="flex flex-col gap-3">
          {nods.map((nod, index) => (
            <div key={nod.category} className="bug-chip-in flex flex-col gap-0.5" style={{ animationDelay: staggerDelay(index), borderLeft: `3px solid ${withAlpha(GOLD, "70")}`, paddingLeft: 12 }}>
              <span className="font-bold uppercase" style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.62rem", letterSpacing: "0.08em" }}>{nod.category}</span>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-black uppercase truncate" style={{ color: "#fff", fontSize: "1.1rem" }}>{nod.name}</span>
                <span className="font-black tabular-nums shrink-0" style={{ color: GOLD, fontSize: "0.92rem" }}>{nod.stat}</span>
              </div>
            </div>
          ))}
        </div>
      </BigPanel>
    );
  }
  return (
    <Panel accent={GOLD} compact>
      <PanelTag icon={icon} kind={model.title} leagueType={null} accent={GOLD} compact />
      {nods.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {nods.map((nod, index) => (
            <div key={nod.category} className="bug-chip-in flex flex-col gap-0.5" style={{ animationDelay: staggerDelay(index) }}>
              <span className="font-bold uppercase" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.56rem", letterSpacing: "0.07em" }}>{nod.category}</span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold truncate" style={{ color: "#fff", fontSize: "0.72rem" }}>{nod.name}</span>
                <span className="font-black tabular-nums shrink-0" style={{ color: GOLD, fontSize: "0.68rem" }}>{nod.stat}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <PanelLine>No Hall of Fame nods yet this season.</PanelLine>
      )}
    </Panel>
  );
}
