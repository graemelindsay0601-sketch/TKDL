import { useState } from "react";
import { Crosshair, TrendingUp, UserRound } from "lucide-react";
import { SceneEyebrow, SceneHeadline, SceneShell } from "./SceneShell";
import type { GraphicData } from "../types";
import type { SceneProps } from "./scene-support";

function text(data: GraphicData, key: string, fallback: string) { const value = data[key]; return typeof value === "string" && value ? value : fallback; }
function number(data: GraphicData, key: string) { const value = Number(data[key]); return Number.isFinite(value) ? value : 0; }

export function PlayerFocusScene({ segment }: SceneProps) {
  const data = segment.graphic?.data ?? {};
  const playerId = number(data, "playerId");
  const name = text(data, "playerName", "TKDL player");
  const [imageFailed, setImageFailed] = useState(false);
  const wins = number(data, "wins");
  const losses = number(data, "losses");
  const played = wins + losses;
  const winRate = played > 0 ? Math.round(wins / played * 100) : 0;
  return <SceneShell justify="start" background="radial-gradient(circle at 18% 45%, rgba(255,0,92,0.2), transparent 33%), radial-gradient(circle at 84% 30%, rgba(0,102,255,0.18), transparent 34%)">
    <div className="flex items-center justify-between gap-3 mb-3"><SceneEyebrow label="Player Focus" color="#ffd24a" /><div className="flex items-center gap-2 rounded-full border px-3 py-1 uppercase font-bold text-white/70" style={{ borderColor: "rgba(255,210,74,.35)", background: "rgba(255,210,74,.08)", fontSize: ".62rem", letterSpacing: ".14em" }}><Crosshair size={13} color="#ffd24a" /> Inside the league</div></div>
    <div className="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-5 md:gap-9">
      <div className="relative grid h-28 w-28 place-items-center overflow-hidden rounded-full border-2 text-5xl font-black md:h-40 md:w-40" style={{ borderColor: "rgba(255,0,92,.5)", color: "#ff005c", background: "linear-gradient(145deg,rgba(255,0,92,.16),rgba(0,102,255,.13))", boxShadow: "0 0 45px rgba(255,0,92,.16)" }}>
        {!imageFailed && playerId > 0 ? <img className="h-full w-full object-cover" src={`/api/players/${playerId}/avatar-image`} alt={name} onError={() => setImageFailed(true)} /> : name.slice(0, 1).toUpperCase()}
        <span className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full bg-[#ffd24a] text-base text-[#08040d]">#{number(data, "rank")}</span>
      </div>
      <div className="min-w-0"><div className="mb-1 flex items-center gap-2 uppercase font-bold text-white/45" style={{ fontSize: ".65rem", letterSpacing: ".16em" }}><UserRound size={14} /> Singles profile</div><SceneHeadline tier="featured">{name}</SceneHeadline><div className="mt-4 grid grid-cols-3 gap-2 md:max-w-2xl">
        {[{ label: "Points", value: number(data, "points") }, { label: "Season", value: `${wins}–${losses}` }, { label: "Win rate", value: `${winRate}%` }].map(item => <div className="border-l-2 pl-3" style={{ borderColor: "#0066ff" }} key={item.label}><small className="block uppercase text-white/35" style={{ fontSize: ".58rem", letterSpacing: ".12em" }}>{item.label}</small><strong className="block text-xl text-white md:text-3xl">{item.value}</strong></div>)}
      </div><div className="mt-4 flex items-center gap-2 text-sm text-white/55"><TrendingUp size={16} color="#ffd24a" /><span>Current run: {number(data, "currentWinStreak")} wins · Career best: {number(data, "longestWinStreak")}</span></div></div>
    </div>
  </SceneShell>;
}
