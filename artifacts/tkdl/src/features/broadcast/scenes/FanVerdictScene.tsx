import { BarChart3, Users } from "lucide-react";
import { SceneEyebrow, SceneHeadline, SceneShell } from "./SceneShell";
import type { SceneProps } from "./scene-support";

type VerdictOption = { id: number; label: string; votes: number; percentage: number };

function verdictOptions(value: unknown): VerdictOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.label !== "string") return [];
    return [{
      id: typeof row.id === "number" ? row.id : index,
      label: row.label,
      votes: typeof row.votes === "number" ? row.votes : 0,
      percentage: typeof row.percentage === "number" ? row.percentage : 0,
    }];
  });
}

export function FanVerdictScene({ segment, turnsPlayed }: SceneProps) {
  const data = segment.graphic?.data ?? {};
  const question = typeof data.question === "string" ? data.question : "The TKDL community has had its say.";
  const totalVotes = typeof data.totalVotes === "number" ? data.totalVotes : 0;
  const options = verdictOptions(data.options);
  const leader = Math.max(...options.map(option => option.votes), 0);

  return (
    <SceneShell
      justify="start"
      background="radial-gradient(circle at 12% 15%, rgba(255,0,92,0.2), transparent 34%), radial-gradient(circle at 86% 75%, rgba(0,102,255,0.18), transparent 40%)"
    >
      <div className="flex items-center justify-between gap-3">
        <SceneEyebrow label="Fan Verdict" color="#ff005c" />
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/70">
          <Users size={14} color="#54a0ff" /> {totalVotes} votes
        </div>
      </div>

      <div className="mt-1 grid min-h-0 flex-1 grid-cols-1 gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-center md:gap-9">
        <div className="min-w-0">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff005c]/15 text-[#ff4f8d]">
            <BarChart3 size={22} />
          </div>
          <SceneHeadline tier="featured">{question}</SceneHeadline>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/55">
            Community poll results frozen when this Edition went on air.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4 shadow-2xl backdrop-blur-sm md:p-6">
          {options.map((option, index) => {
            const isLeader = option.votes === leader && leader > 0;
            return (
              <div key={option.id} className={turnsPlayed > 1 || index === 0 ? "fade-in-up" : "opacity-60"}>
                <div className="mb-1.5 flex items-end justify-between gap-4">
                  <span className="min-w-0 truncate text-sm font-bold text-white md:text-base">{option.label}</span>
                  <span className="shrink-0 font-black text-white" style={{ fontFamily: "Oswald, sans-serif" }}>{option.percentage}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(2, option.percentage)}%`,
                      background: isLeader ? "linear-gradient(90deg, #ff005c, #ff5b95)" : "linear-gradient(90deg, #0066ff, #54a0ff)",
                      boxShadow: isLeader ? "0 0 14px rgba(255,0,92,0.45)" : "none",
                    }}
                  />
                </div>
                <div className="mt-1 text-right text-[0.65rem] uppercase tracking-wider text-white/35">{option.votes} {option.votes === 1 ? "vote" : "votes"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
}
