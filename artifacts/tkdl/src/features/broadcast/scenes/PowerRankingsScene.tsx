import { ArrowDown, ArrowUp, Flame, Minus, Radio } from "lucide-react";
import { SceneEyebrow, SceneHeadline, SceneShell } from "./SceneShell";
import type { SceneProps } from "./scene-support";

type RankingRow = {
  id: number; name: string; rank: number; score: number; movement: number | null;
  recentForm: Array<"W" | "L">; wins: number; losses: number; pointsDelta: number;
};

function rankingRows(value: unknown): RankingRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.name !== "string" || typeof row.rank !== "number" || typeof row.score !== "number") return [];
    return [{
      id: typeof row.id === "number" ? row.id : row.rank,
      name: row.name,
      rank: row.rank,
      score: row.score,
      movement: typeof row.movement === "number" ? row.movement : null,
      recentForm: Array.isArray(row.recentForm) ? row.recentForm.filter((result): result is "W" | "L" => result === "W" || result === "L") : [],
      wins: typeof row.wins === "number" ? row.wins : 0,
      losses: typeof row.losses === "number" ? row.losses : 0,
      pointsDelta: typeof row.pointsDelta === "number" ? row.pointsDelta : 0,
    }];
  }).sort((a, b) => a.rank - b.rank);
}

function Movement({ movement }: { movement: number | null }) {
  if (movement === null) return <span className="text-[#ffd24a]"><Flame size={12} /> New</span>;
  if (movement > 0) return <span className="text-emerald-300"><ArrowUp size={12} /> {movement}</span>;
  if (movement < 0) return <span className="text-rose-300"><ArrowDown size={12} /> {Math.abs(movement)}</span>;
  return <span className="text-white/40"><Minus size={12} /> Hold</span>;
}

export function PowerRankingsScene({ segment, turnsPlayed }: SceneProps) {
  const data = segment.graphic?.data ?? {};
  const rows = rankingRows(data.rows);
  const label = typeof data.leagueLabel === "string" ? data.leagueLabel : "League";
  const revealed = Math.min(rows.length, Math.max(0, turnsPlayed - 1));
  const revealFromRank = rows.length - revealed + 1;

  return <SceneShell justify="start" background="radial-gradient(circle at 14% 18%, rgba(255,0,92,.22), transparent 32%), radial-gradient(circle at 88% 70%, rgba(0,102,255,.22), transparent 38%)">
    <div className="flex items-center justify-between gap-3">
      <SceneEyebrow label="Power Rankings: On Air" color="#ff4f8d" />
      <div className="flex items-center gap-2 rounded-full border border-[#0066ff]/40 bg-[#0066ff]/10 px-3 py-1 text-[.62rem] font-black uppercase tracking-[.16em] text-blue-200"><Radio size={13} /> {label}</div>
    </div>
    <div className="mt-1 grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[minmax(0,.72fr)_minmax(0,1.28fr)] md:items-center md:gap-8">
      <div className="min-w-0">
        <SceneHeadline tier="featured">Who is in form right now?</SceneHeadline>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">Latest five results, opponent strength, points movement and streaks. The countdown reveals fifth place through to number one.</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/55"><Flame size={15} color="#ffd24a" /> {revealed === rows.length ? "Number one revealed" : `${revealed} of ${rows.length} revealed`}</div>
      </div>
      <div className="space-y-1.5 rounded-2xl border border-white/10 bg-black/30 p-3 shadow-2xl backdrop-blur-sm md:p-4">
        {rows.map(row => {
          const isRevealed = row.rank >= revealFromRank;
          return <div key={row.id} className={`grid grid-cols-[2.2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-500 ${isRevealed ? "fade-in-up border-white/10 bg-white/[.055]" : "border-white/[.04] bg-black/20 opacity-45"}`}>
            <strong className={`text-xl ${isRevealed && row.rank === 1 ? "text-[#ffd24a]" : "text-white/70"}`} style={{ fontFamily: "Oswald, sans-serif" }}>#{row.rank}</strong>
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-white md:text-base">{isRevealed ? row.name : "Awaiting reveal"}</div>
              {isRevealed && <div className="mt-1 flex items-center gap-1.5">{row.recentForm.map((result, index) => <i key={index} className={`grid h-4 w-4 place-items-center rounded text-[.55rem] font-black not-italic ${result === "W" ? "bg-emerald-400/20 text-emerald-200" : "bg-rose-400/20 text-rose-200"}`}>{result}</i>)}<small className="ml-1 text-[.6rem] text-white/35">{row.pointsDelta >= 0 ? "+" : ""}{row.pointsDelta} pts</small></div>}
            </div>
            {isRevealed ? <div className="text-right"><b className="block text-lg text-white">{row.score}</b><Movement movement={row.movement} /></div> : <span className="text-lg font-black text-white/15">—</span>}
          </div>;
        })}
      </div>
    </div>
  </SceneShell>;
}
