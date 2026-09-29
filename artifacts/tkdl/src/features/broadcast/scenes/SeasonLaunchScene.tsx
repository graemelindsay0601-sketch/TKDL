import { Flag, Quote, Sparkles } from "lucide-react";
import { SceneEyebrow, SceneHeadline, SceneShell } from "./SceneShell";
import type { SceneProps } from "./scene-support";

type LaunchVoice = {
  interviewId: number;
  playerName: string;
  openerQuestion: string;
  openerAnswer: string;
  followupQuestion: string | null;
  followupAnswer: string | null;
};

function launchVoices(value: unknown): LaunchVoice[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.playerName !== "string" || typeof row.openerAnswer !== "string") return [];
    return [{
      interviewId: typeof row.interviewId === "number" ? row.interviewId : index,
      playerName: row.playerName,
      openerQuestion: typeof row.openerQuestion === "string" ? row.openerQuestion : "What are you aiming for?",
      openerAnswer: row.openerAnswer,
      followupQuestion: typeof row.followupQuestion === "string" ? row.followupQuestion : null,
      followupAnswer: typeof row.followupAnswer === "string" ? row.followupAnswer : null,
    }];
  });
}

export function SeasonLaunchScene({ segment, turnsPlayed }: SceneProps) {
  const data = segment.graphic?.data ?? {};
  const voices = launchVoices(data.voices);
  const voice = voices[Math.min(Math.max(turnsPlayed - 1, 0), Math.max(voices.length - 1, 0))];
  const currentSeason = typeof data.currentSeasonName === "string" ? data.currentSeasonName : "The new season";
  const previousSeason = typeof data.previousSeasonName === "string" ? data.previousSeasonName : "Last season";

  return (
    <SceneShell
      justify="start"
      background="radial-gradient(circle at 50% -15%, rgba(255,210,74,0.2), transparent 42%), radial-gradient(circle at 90% 70%, rgba(255,0,92,0.14), transparent 34%)"
    >
      <div className="flex items-center justify-between gap-3">
        <SceneEyebrow label="League Voices" color="#ffd24a" />
        <div className="flex items-center gap-2 rounded-full border border-[#ffd24a]/25 bg-[#ffd24a]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#ffe486]">
          <Flag size={13} /> Season launch
        </div>
      </div>

      <div className="mt-1 flex items-center gap-3">
        <Sparkles size={20} color="#ffd24a" />
        <SceneHeadline tier="featured">{currentSeason}</SceneHeadline>
      </div>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-white/40">Looking back at {previousSeason} · Looking ahead together</p>

      {voice && (
        <div key={voice.interviewId} className="fade-in-up mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[0.42fr_1fr] md:gap-6">
          <div className="flex min-w-0 flex-col justify-center rounded-2xl border border-[#ffd24a]/20 bg-[#ffd24a]/8 p-4 md:p-6">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd24a]">Player {Math.min(turnsPlayed, voices.length)} of {voices.length}</div>
            <div className="mt-2 font-black uppercase text-white" style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(1.7rem, 4vw, 3rem)", lineHeight: 1 }}>
              {voice.playerName}
            </div>
            <div className="mt-3 h-1 w-14 rounded-full bg-[#ff005c]" />
          </div>

          <div className="min-h-0 rounded-2xl border border-white/12 bg-black/35 p-4 shadow-2xl md:p-6">
            <div className="relative">
              <Quote className="absolute right-0 top-0 text-[#ffd24a]/20" size={38} />
              <div className="pr-9 text-xs font-bold uppercase tracking-wider text-[#54a0ff]">{voice.openerQuestion}</div>
              <p className="mt-2 pr-5 text-base font-semibold leading-relaxed text-white md:text-lg">“{voice.openerAnswer}”</p>
            </div>
            {voice.followupAnswer && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[#ff5b95]">{voice.followupQuestion}</div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-white/80 md:text-base">“{voice.followupAnswer}”</p>
              </div>
            )}
          </div>
        </div>
      )}
    </SceneShell>
  );
}
