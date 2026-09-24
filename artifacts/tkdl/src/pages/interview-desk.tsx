import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { LoginGate } from "@/components/LoginGate";
import { useToast } from "@/hooks/use-toast";
import { Send, X, UserX, Radio } from "lucide-react";
import { PRESENTERS, presenterPortraitSrc, type PresenterId, type PresenterState } from "@/features/broadcast/presenters/presenter-config";

// Interview Desk — player-facing answer page. TEST/PREVIEW BUILD: the only
// way a request currently reaches this page is the admin "test-fire" panel
// (admin/interview-desk-test.tsx) — nothing in real gameplay creates one
// yet. See routes/interview-desk.ts's own header for the full story.
//
// Rebuilt as a real multi-beat conversation (opener → reaction → follow-up
// → sign-off) after the first pass read as a single question-and-thanks
// rather than an interview — and now uses the SAME presenter portraits and
// accent colours as TKDL LIVE's broadcast player (presenter-config.ts),
// instead of a plain initials badge, so this actually reads as Chalky or
// Ton sitting across from you rather than a generic form.

type Beat =
  | { kind: "presenter"; speaker: PresenterId; state: PresenterState; text: string; label?: string }
  | { kind: "player"; text: string };

type RequestData = {
  id: number;
  triggerType: string;
  status: string;
  awaitingTurn: "opener" | "followup" | null;
  opener: { presenter: string; promptText: string };
  openerAnswer: { responseType: string; answerText: string | null } | null;
  reaction: { presenter: string; text: string } | null;
  followup: { presenter: string; promptText: string } | null;
  followupAnswer: { responseType: string; answerText: string | null } | null;
  signoff: { presenter: string; text: string } | null;
};

function toPresenterId(name: string): PresenterId {
  return name === "ton" ? "B" : "A";
}

function answerLabel(a: { responseType: string; answerText: string | null }): string {
  if (a.responseType === "comment") return a.answerText ?? "";
  if (a.responseType === "not_involved") return "Wasn't there tonight.";
  return "(skipped)";
}

function buildTranscript(data: RequestData): Beat[] {
  const beats: Beat[] = [
    { kind: "presenter", speaker: toPresenterId(data.opener.presenter), state: "speaking", text: data.opener.promptText },
  ];
  if (data.openerAnswer) beats.push({ kind: "player", text: answerLabel(data.openerAnswer) });
  if (data.reaction) beats.push({ kind: "presenter", speaker: toPresenterId(data.reaction.presenter), state: "listening", text: data.reaction.text });
  if (data.followup) beats.push({ kind: "presenter", speaker: toPresenterId(data.followup.presenter), state: "speaking", text: data.followup.promptText });
  if (data.followupAnswer) beats.push({ kind: "player", text: answerLabel(data.followupAnswer) });
  if (data.signoff) beats.push({ kind: "presenter", speaker: toPresenterId(data.signoff.presenter), state: "confident", text: data.signoff.text });
  return beats;
}

function PresenterAvatar({ speaker, state, size = 44 }: { speaker: PresenterId; state: PresenterState; size?: number }) {
  const p = PRESENTERS[speaker];
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div
      className="rounded-full flex items-center justify-center font-black shrink-0"
      style={{ width: size, height: size, background: `${p.accent}22`, border: `1.5px solid ${p.accent}55`, color: p.accent, fontFamily: "Oswald, sans-serif", fontSize: size * 0.32 }}
    >
      {p.monogram}
    </div>
  ) : (
    <img
      src={presenterPortraitSrc(speaker, state)}
      alt={p.name}
      onError={() => setFailed(true)}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size, border: `1.5px solid ${p.accent}55`, boxShadow: `0 0 16px ${p.accent}33` }}
    />
  );
}

export default function InterviewDeskPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [data, setData]       = useState<RequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/interview-desk/${params.id}`, { credentials: "include" });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? "Couldn't load this interview request."); return; }
      setData(body);
    } catch {
      setError("Couldn't reach the server.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, params.id]);

  if (!user) {
    return (
      <LoginGate
        icon="🎙️"
        title="Interview Desk"
        subtitle="Log in to see your interview request."
      />
    );
  }

  const submit = async (responseType: "comment" | "declined" | "not_involved") => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/interview-desk/${params.id}/answer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseType, answerText: responseType === "comment" ? answerText : undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast({ title: "Couldn't submit", description: body.error ?? "Try again.", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      setAnswerText("");
      await load();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
    setSubmitting(false);
  };

  let activePresenter: PresenterId | null = null;
  if (data?.awaitingTurn === "followup" && data.followup) {
    activePresenter = toPresenterId(data.followup.presenter);
  } else if (data?.awaitingTurn === "opener") {
    activePresenter = toPresenterId(data.opener.presenter);
  }
  const activeAccent = activePresenter ? PRESENTERS[activePresenter].accent : "#0066ff";

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <button
        onClick={() => navigate("/account")}
        className="text-xs mb-6 opacity-60 hover:opacity-100 transition-opacity"
        style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Oswald, sans-serif" }}
      >
        ← Back
      </button>

      {loading && (
        <div className="text-center py-16 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg" style={{ background: "rgba(255,0,92,0.06)", border: "1px solid rgba(255,0,92,0.2)" }}>
          <X className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ff005c" }} />
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{error}</div>
        </div>
      )}

      {!loading && data && (() => {
        const beats = buildTranscript(data);
        const isPending = data.awaitingTurn !== null;
        return (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "radial-gradient(circle at 50% 0%, rgba(0,102,255,0.08) 0%, rgba(255,0,92,0.05) 55%, rgba(10,8,18,0.97) 100%), rgba(10,8,18,0.9)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* Studio strip */}
            <div
              className="flex items-center gap-2 px-5 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.25)" }}
            >
              <Radio className="w-3.5 h-3.5" style={{ color: "#ff005c" }} />
              <span className="text-[0.62rem] font-black uppercase tracking-[0.15em]" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                Interview Desk
              </span>
              <span className="text-[0.62rem] uppercase tracking-widest ml-auto" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
                {data.triggerType.replace(/_/g, " ")}
              </span>
            </div>

            {/* Transcript */}
            <div className="px-5 py-6 space-y-4">
              {beats.map((beat, i) =>
                beat.kind === "presenter" ? (
                  <div key={i} className="flex items-start gap-3">
                    <PresenterAvatar speaker={beat.speaker} state={beat.state} />
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[0.65rem] font-bold uppercase tracking-wide mb-1"
                        style={{ color: PRESENTERS[beat.speaker].accent, fontFamily: "Oswald, sans-serif" }}
                      >
                        {PRESENTERS[beat.speaker].name}
                      </div>
                      <div
                        className="rounded-xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-snug"
                        style={{ background: `${PRESENTERS[beat.speaker].accent}14`, border: `1px solid ${PRESENTERS[beat.speaker].accent}33`, color: "rgba(255,255,255,0.92)" }}
                      >
                        {beat.text}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-end">
                    <div
                      className="rounded-xl rounded-tr-sm px-3.5 py-2.5 text-sm leading-snug max-w-[80%]"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.88)" }}
                    >
                      {beat.text}
                    </div>
                  </div>
                )
              )}

              {isPending && (
                <div className="space-y-2.5 pt-1">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Say a few words…"
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-lg px-3 py-2.5 text-sm resize-none outline-none"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.9)" }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => submit("comment")}
                      disabled={submitting || !answerText.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40"
                      style={{ background: `${activeAccent}22`, border: `1px solid ${activeAccent}55`, color: activeAccent, fontFamily: "Oswald, sans-serif" }}
                    >
                      <Send className="w-3.5 h-3.5" />Send
                    </button>
                    {data.awaitingTurn === "opener" && (
                      <button
                        onClick={() => submit("not_involved")}
                        disabled={submitting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", fontFamily: "Oswald, sans-serif" }}
                      >
                        <UserX className="w-3.5 h-3.5" />Wasn't there
                      </button>
                    )}
                    <button
                      onClick={() => submit("declined")}
                      disabled={submitting}
                      className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40"
                      style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
