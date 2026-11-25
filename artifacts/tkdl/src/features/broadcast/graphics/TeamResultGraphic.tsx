import type { GraphicData, LeagueType } from "../types";
import { LEAGUE_ACCENT } from "../theme";
import { GraphicFrame } from "./GraphicFrame";
import { buildTeamResultGraphicModel } from "./team-result-graphic";

const WINNER_ACCENT = "#00e0a4";
const LOSER_ACCENT = "#ff4d78";

function Side({
  name, label, count, accent, compact,
}: {
  name: string;
  label: string;
  count: number;
  accent: string;
  compact: boolean;
}) {
  return (
    <div
      className="min-w-0 flex-1 flex flex-col justify-between"
      style={{
        // Hub-style tile: colour gradient edge, dark tinted fill.
        borderRadius: compact ? 14 : 18,
        border: `1px solid ${accent}66`,
        background: `linear-gradient(180deg, ${accent}1f, #0b0910 75%)`,
        boxShadow: `0 0 22px ${accent}14`,
        padding: compact ? "10px 12px 12px" : "16px 20px 18px",
        minHeight: compact ? 92 : 136,
        gap: 6,
      }}
    >
      <span className="pm-lab" style={{ color: accent, fontSize: compact ? 9 : 10.5 }}>{label}</span>
      <div
        className="pm-chrome uppercase"
        style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: compact ? "clamp(0.8rem, 3.5vw, 1.05rem)" : "clamp(1.1rem, 4.5vw, 1.75rem)", lineHeight: 1.08, overflowWrap: "anywhere" }}
      >
        {name}
      </div>
      <span className="pm-lab" style={{ fontSize: compact ? 8.5 : 10 }}>
        {count} {count === 1 ? "side member" : "side members"}
      </span>
    </div>
  );
}

export function TeamResultGraphic({ leagueType, data, compact = true }: { leagueType: LeagueType | null; data: GraphicData; compact?: boolean }) {
  const model = buildTeamResultGraphicModel(leagueType, data);
  if (!model) return <GraphicFrame kind="Team Result" icon="◆" accent={WINNER_ACCENT} leagueType={leagueType} data={data} compact={compact} />;

  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : WINNER_ACCENT;
  return (
    <div
      className="panel-slide-in flex flex-col w-full min-w-0"
      style={{
        // Premium hero card, matching kit.tsx's v4 skin.
        background: `radial-gradient(120% 80% at 100% 0%, ${leagueAccent}33, transparent 55%), linear-gradient(160deg, ${leagueAccent}22 0%, #14102a 42%, #06060b 100%)`,
        border: `1px solid ${leagueAccent}55`,
        borderRadius: compact ? 18 : 24,
        boxShadow: `0 20px 50px rgba(0,0,0,0.55), 0 0 50px ${leagueAccent}18`,
        padding: compact ? "12px 14px 14px" : "22px 28px 26px",
        gap: compact ? 9 : 15,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="live-dot" style={{ width: 6, height: 6, background: leagueAccent }} /><span className="pm-lab" style={{ color: "#ffd24a" }}>{model.formatLabel}</span></div>
          <div className="pm-metal uppercase" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: compact ? "1.15rem" : "clamp(1.6rem, 3.4vw, 2.4rem)", lineHeight: 1, marginTop: 4 }}>Team Result</div>
        </div>
        <div className="shrink-0 text-right">
          <span className="pm-lab" style={{ justifyContent: "flex-end" }}>{model.valueLabel}</span>
          <div className="font-black tabular-nums" style={{ color: "#ffd24a", fontSize: compact ? "1.25rem" : "2rem", lineHeight: 1, textShadow: "0 0 18px rgba(255,210,74,0.45)" }}>{model.value}</div>
        </div>
      </div>

      <div className="flex items-stretch min-w-0" style={{ gap: compact ? 5 : 9 }}>
        <Side name={model.winnerName} label="Winners" count={model.winnerCount} accent={WINNER_ACCENT} compact={compact} />
        <div className="flex items-center justify-center shrink-0"><span className="pm-lab" style={{ fontSize: compact ? 9 : 11 }}>def.</span></div>
        <Side name={model.loserName} label="Opposition" count={model.loserCount} accent={LOSER_ACCENT} compact={compact} />
      </div>

      <div className="flex items-center gap-2">
        <div style={{ height: 2, width: compact ? 28 : 44, background: leagueAccent, boxShadow: `0 0 10px ${leagueAccent}` }} />
        <span className="pm-lab" style={{ color: "#b9b3cc" }}>{model.contextLabel}</span>
      </div>
    </div>
  );
}
