import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { LoginGate } from "@/components/LoginGate";
import { useToast } from "@/hooks/use-toast";
import { Mic, Send, X, UserX, CheckCircle2 } from "lucide-react";

// Interview Desk — player-facing answer page. TEST/PREVIEW BUILD: the only
// way a request currently reaches this page is the admin "test-fire" panel
// (admin/interview-desk-test.tsx) — nothing in real gameplay creates one
// yet. See routes/interview-desk.ts's own header for the full story. This
// page itself is the real thing though, not a mock: it hits the real
// GET/POST /api/interview-desk/:id routes, with real server-side ownership
// checks, so what you're trying here is exactly what a player would see
// once this is switched on for real.

const PRESENTER_META: Record<string, { name: string; role: string; accent: string; monogram: string }> = {
  chalky: { name: "Chalky", role: "Host & Analyst", accent: "#0066ff", monogram: "CH" },
  ton:    { name: "Ton",    role: "Pundit",         accent: "#ff005c", monogram: "TN" },
};

type RequestData = {
  id: number;
  triggerType: string;
  status: string;
  presenter: string;
  promptText: string;
  answer: { responseType: string; answerText: string | null } | null;
};

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
      toast({ title: responseType === "comment" ? "Sent — thanks!" : "Noted, thanks." });
      await load();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
    setSubmitting(false);
  };

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
        const presenter = PRESENTER_META[data.presenter] ?? PRESENTER_META.chalky;
        const isPending = data.status === "pending";
        return (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${presenter.accent}33` }}
          >
            {/* Presenter header */}
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{ background: `linear-gradient(135deg, ${presenter.accent}22, transparent)`, borderBottom: `1px solid ${presenter.accent}22` }}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-black text-sm shrink-0"
                style={{ background: `${presenter.accent}22`, border: `1.5px solid ${presenter.accent}55`, color: presenter.accent, fontFamily: "Oswald, sans-serif" }}
              >
                {presenter.monogram}
              </div>
              <div className="min-w-0">
                <div className="font-black text-sm uppercase tracking-wide" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.95)" }}>
                  {presenter.name}
                </div>
                <div className="text-[0.68rem]" style={{ color: "rgba(255,255,255,0.45)" }}>{presenter.role} · Interview Desk</div>
              </div>
              <Mic className="w-4 h-4 ml-auto shrink-0" style={{ color: presenter.accent, opacity: 0.6 }} />
            </div>

            <div className="px-5 py-5">
              <div
                className="text-[0.65rem] uppercase font-bold tracking-widest mb-2"
                style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}
              >
                {data.triggerType.replace(/_/g, " ")}
              </div>
              <p className="text-base leading-snug mb-5" style={{ color: "rgba(255,255,255,0.92)" }}>
                {data.promptText}
              </p>

              {isPending && (
                <div className="space-y-3">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Say a few words…"
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-lg px-3 py-2.5 text-sm resize-none outline-none"
                    style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)" }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => submit("comment")}
                      disabled={submitting || !answerText.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40"
                      style={{ background: `${presenter.accent}22`, border: `1px solid ${presenter.accent}55`, color: presenter.accent, fontFamily: "Oswald, sans-serif" }}
                    >
                      <Send className="w-3.5 h-3.5" />Send
                    </button>
                    <button
                      onClick={() => submit("not_involved")}
                      disabled={submitting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", fontFamily: "Oswald, sans-serif" }}
                    >
                      <UserX className="w-3.5 h-3.5" />Wasn't there
                    </button>
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

              {!isPending && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: "rgba(0,229,160,0.06)", border: "1px solid rgba(0,229,160,0.2)" }}>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#00e5a0" }} />
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
                    {data.answer?.responseType === "comment"
                      ? `You said: "${data.answer.answerText}"`
                      : data.answer?.responseType === "not_involved"
                        ? "You said you weren't involved in this one."
                        : "Skipped."}
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
