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
        background: `linear-gradient(145deg, ${accent}24, rgba(7,12,25,0.96) 65%)`,
        borderTop: `3px solid ${accent}`,
        boxShadow: `0 0 28px ${accent}18 inset`,
        padding: compact ? "10px 12px 12px" : "18px 22px 20px",
        minHeight: compact ? 92 : 142,
      }}
    >
      <div className="font-black uppercase" style={{ color: accent, fontSize: compact ? "0.58rem" : "0.72rem", letterSpacing: "0.14em" }}>{label}</div>
      <div
        className="font-black uppercase"
        style={{ color: "#fff", fontSize: compact ? "clamp(0.75rem, 3.5vw, 1rem)" : "clamp(1.05rem, 4.5vw, 1.7rem)", lineHeight: 1.1, overflowWrap: "anywhere", textShadow: `0 0 20px ${accent}45` }}
      >
        {name}
      </div>
      <div className="uppercase font-bold" style={{ color: "rgba(255,255,255,0.48)", fontSize: compact ? "0.55rem" : "0.68rem", letterSpacing: "0.08em" }}>
        {count} {count === 1 ? "side member" : "side members"}
      </div>
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
        background: "linear-gradient(160deg, #121c34 0%, #080d1a 58%, #050711 100%)",
        border: `1px solid ${leagueAccent}55`,
        borderLeft: `7px solid ${leagueAccent}`,
        boxShadow: `0 24px 60px rgba(0,0,0,0.58), 0 0 42px ${leagueAccent}22`,
        clipPath: "polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 0 100%)",
        padding: compact ? "12px 14px 14px" : "22px 28px 26px",
        gap: compact ? 9 : 15,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-black uppercase" style={{ color: "#fff", fontSize: compact ? "0.9rem" : "1.28rem", letterSpacing: "0.09em" }}>Team Result</div>
          <div className="font-bold uppercase" style={{ color: leagueAccent, fontSize: compact ? "0.58rem" : "0.76rem", letterSpacing: "0.12em" }}>{model.formatLabel}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold uppercase" style={{ color: "rgba(255,255,255,0.42)", fontSize: compact ? "0.52rem" : "0.66rem", letterSpacing: "0.12em" }}>{model.valueLabel}</div>
          <div className="font-black tabular-nums" style={{ color: "#ffd24a", fontSize: compact ? "1.25rem" : "2rem", lineHeight: 1, textShadow: "0 0 18px rgba(255,210,74,0.45)" }}>{model.value}</div>
        </div>
      </div>

      <div className="flex items-stretch min-w-0" style={{ gap: compact ? 5 : 9 }}>
        <Side name={model.winnerName} label="Winners" count={model.winnerCount} accent={WINNER_ACCENT} compact={compact} />
        <div className="flex items-center justify-center shrink-0 font-black" style={{ color: "rgba(255,255,255,0.42)", fontSize: compact ? "0.62rem" : "0.82rem", letterSpacing: "0.08em" }}>BEAT</div>
        <Side name={model.loserName} label="Opposition" count={model.loserCount} accent={LOSER_ACCENT} compact={compact} />
      </div>

      <div className="flex items-center gap-2">
        <div style={{ height: 2, width: compact ? 28 : 44, background: leagueAccent, boxShadow: `0 0 10px ${leagueAccent}` }} />
        <div className="font-bold uppercase" style={{ color: "rgba(255,255,255,0.58)", fontSize: compact ? "0.56rem" : "0.72rem", letterSpacing: "0.08em" }}>{model.contextLabel}</div>
      </div>
    </div>
  );
}
