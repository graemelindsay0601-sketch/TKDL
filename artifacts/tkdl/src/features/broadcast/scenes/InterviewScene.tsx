import { Mic2, Quote } from "lucide-react";
import { SceneEyebrow, SceneHeadline, SceneShell } from "./SceneShell";
import type { GraphicData } from "../types";
import type { SceneProps } from "./scene-support";

function textFact(data: GraphicData, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function presenterName(value: string | null): string {
  return value?.toLowerCase() === "ton" ? "Ton" : "Chalky";
}

export function InterviewScene({ segment, turnsPlayed }: SceneProps) {
  const data = segment.graphic?.data ?? {};
  const playerName = textFact(data, "playerName") ?? "TKDL player";
  const triggerLabel = textFact(data, "triggerLabel") ?? "a standout TKDL moment";
  const openerQuestion = textFact(data, "openerQuestion");
  const openerAnswer = textFact(data, "openerAnswer");
  const followupQuestion = textFact(data, "followupQuestion");
  const followupAnswer = textFact(data, "followupAnswer");
  const showFollowup = turnsPlayed > 1 && followupQuestion && followupAnswer;
  const question = showFollowup ? followupQuestion : openerQuestion;
  const answer = showFollowup ? followupAnswer : openerAnswer;
  const presenter = presenterName(textFact(data, showFollowup ? "followupPresenter" : "openerPresenter"));

  return (
    <SceneShell
      justify="start"
      background="radial-gradient(circle at 80% 20%, rgba(0,102,255,0.16), transparent 38%), radial-gradient(circle at 8% 80%, rgba(255,0,92,0.2), transparent 42%)"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <SceneEyebrow label="After the Oche" color="#ff005c" />
        <div
          className="flex items-center gap-2 rounded-full border px-3 py-1 uppercase font-bold text-white/80"
          style={{ borderColor: "rgba(0,102,255,0.45)", background: "rgba(0,102,255,0.13)", fontFamily: "Oswald, sans-serif", fontSize: "0.62rem", letterSpacing: "0.14em" }}
        >
          <Mic2 size={13} color="#54a0ff" /> Post-match
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] md:gap-7">
        <div className="flex min-w-0 flex-col justify-center border-l-4 pl-4 md:pl-6" style={{ borderColor: "#ff005c" }}>
          <div className="mb-2 uppercase font-bold text-white/50" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.66rem", letterSpacing: "0.16em" }}>
            Player reaction
          </div>
          <SceneHeadline tier="featured">{playerName}</SceneHeadline>
          <p className="mt-2 max-w-md text-sm leading-snug text-white/65 md:text-base">
            Speaking after {triggerLabel}.
          </p>
        </div>

        <div
          key={showFollowup ? "followup" : "opener"}
          className="fade-in-up min-h-0 rounded-2xl border p-4 shadow-2xl md:p-6"
          style={{
            borderColor: "rgba(255,255,255,0.16)",
            background: "linear-gradient(145deg, rgba(12,17,32,0.94), rgba(24,15,35,0.9))",
            boxShadow: "0 22px 50px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div className="mb-3 flex items-start gap-3">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: "rgba(0,102,255,0.17)", color: "#54a0ff" }}>
              <Mic2 size={16} />
            </div>
            <div className="min-w-0">
              <div className="uppercase font-black text-[#54a0ff]" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", letterSpacing: "0.14em" }}>
                {presenter} asks
              </div>
              <p className="mt-1 text-sm font-semibold leading-snug text-white/85 md:text-base">{question ?? "How did that feel?"}</p>
            </div>
          </div>

          <div className="relative border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            <Quote className="absolute -top-1 right-0 text-[#ff005c]/25" size={48} aria-hidden="true" />
            <p className="relative pr-7 text-base font-semibold leading-relaxed text-white md:text-xl">
              “{answer ?? "The player chose not to add a comment."}”
            </p>
            <div className="mt-3 uppercase font-black text-[#ff005c]" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.66rem", letterSpacing: "0.14em" }}>
              {playerName}
            </div>
          </div>
        </div>
      </div>
    </SceneShell>
  );
}
