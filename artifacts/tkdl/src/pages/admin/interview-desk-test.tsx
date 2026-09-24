import { useEffect, useState } from "react";
import { Mic, Send, Bell, X, Check, ExternalLink, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CollapsibleAdminSection } from "./collapsible-section";

// Test/preview panel for the Interview Desk feature — the whole point is
// that firing this is the ONLY way an interview_requests row gets created
// right now. There is no hook anywhere in real gameplay yet (see
// routes/interview-desk.ts's header) — this exists so the actual built
// experience can be clicked through and approved before that hook gets
// added, without any risk to anything already live, notifications included.
type TriggerOption = { trigger_type: string; audience: "participant" | "spectator" };
type Player = { id: number; name: string };
type HistoryRow = {
  id: number;
  trigger_type: string;
  status: string;
  created_at: string;
  player_name: string;
  audience: string;
  presenter: string;
  prompt_text: string;
};
type PushResult = { ok: boolean; reason?: string; detail?: string; sentTo?: number };

function expiresIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "already closed";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m`;
}

export function InterviewDeskTest() {
  const { toast } = useToast();
  const [options, setOptions]   = useState<TriggerOption[]>([]);
  const [players, setPlayers]   = useState<Player[]>([]);
  const [history, setHistory]   = useState<HistoryRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [loading, setLoading]   = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ requestId: number; playerName: string; expiresAt: string } | null>(null);
  const [notifResult, setNotifResult] = useState<{ playerName: string; requestId: number; push: PushResult } | null>(null);

  const refreshHistory = async () => {
    try {
      const res = await fetch("/api/admin/interview-desk/test-history");
      const body = await res.json();
      if (res.ok) setHistory(body.history ?? []);
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    (async () => {
      try {
        const [optsRes, playersRes] = await Promise.all([
          fetch("/api/admin/interview-desk/trigger-types"),
          fetch("/api/players"),
        ]);
        const opts = await optsRes.json();
        const pls  = await playersRes.json();
        const optList: TriggerOption[] = opts.options ?? [];
        setOptions(optList);
        if (optList.length > 0) setSelected(`${optList[0].trigger_type}::${optList[0].audience}`);
        setPlayers(Array.isArray(pls) ? pls : (pls.players ?? []));
      } catch { /* non-fatal — panel still usable once options load */ }
      refreshHistory();
    })();
  }, []);

  const fire = async (endpoint: "test-fire" | "test-notification") => {
    if (!selected) return;
    const [triggerType, audience] = selected.split("::");
    const setBusy = endpoint === "test-fire" ? setLoading : setNotifLoading;
    setBusy(true);
    setError(null);
    if (endpoint === "test-fire") setLastResult(null); else setNotifResult(null);
    try {
      const res = await fetch(`/api/admin/interview-desk/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerType,
          audience,
          playerId: playerId ? Number(playerId) : undefined,
        }),
      });
      const body = await res.json();
      if (res.ok && body.ok) {
        if (endpoint === "test-fire") {
          setLastResult({ requestId: body.request.requestId, playerName: body.target.name, expiresAt: body.request.expiresAt });
          toast({ title: "Test interview created" });
        } else {
          const push: PushResult = body.request.notification ?? { ok: false, detail: "No result returned." };
          setNotifResult({ playerName: body.target.name, requestId: body.request.requestId, push });
          toast({ title: push.ok ? "Test notification sent" : "Notification didn't deliver", variant: push.ok ? undefined : "destructive" });
        }
        refreshHistory();
      } else {
        setError(body.detail ?? body.error ?? "Something went wrong");
        toast({ title: "Failed", variant: "destructive" });
      }
    } catch {
      setError("Couldn't reach the server.");
    }
    setBusy(false);
  };

  return (
    <CollapsibleAdminSection title="Interview Desk (Test / Preview)" icon={Mic} accent="#0066ff">
      <div className="px-4 py-4 space-y-4">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Manually fires a test interview request so you can click through the real page and see the real question bank, or just send the "hosts want a word" push on its own to confirm delivery — nothing here is wired into real matches, achievements, or the season yet.
        </p>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] uppercase font-bold tracking-wider" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Trigger</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}
            >
              {options.map((o) => (
                <option key={`${o.trigger_type}::${o.audience}`} value={`${o.trigger_type}::${o.audience}`}>
                  {o.trigger_type.replace(/_/g, " ")}{o.audience === "spectator" ? " (spectator)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] uppercase font-bold tracking-wider" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Player</label>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}
            >
              <option value="">My account</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fire("test-fire")}
            disabled={loading || notifLoading || !selected}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            style={{ background: loading ? "rgba(0,102,255,0.06)" : "rgba(0,102,255,0.14)", border: "1px solid rgba(0,102,255,0.35)", color: "#0066ff", fontFamily: "Oswald, sans-serif" }}
          >
            {loading ? (
              <><div className="w-3.5 h-3.5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#0066ff" }} />Firing…</>
            ) : (
              <><Send className="w-3.5 h-3.5" />Fire test interview</>
            )}
          </button>

          <button
            onClick={() => fire("test-notification")}
            disabled={loading || notifLoading || !selected}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            style={{ background: notifLoading ? "rgba(0,229,160,0.06)" : "rgba(0,229,160,0.12)", border: "1px solid rgba(0,229,160,0.3)", color: "#00e5a0", fontFamily: "Oswald, sans-serif" }}
          >
            {notifLoading ? (
              <><div className="w-3.5 h-3.5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#00e5a0" }} />Sending…</>
            ) : (
              <><Bell className="w-3.5 h-3.5" />Send test notification</>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,0,92,0.06)", border: "1px solid rgba(255,0,92,0.2)" }}>
            <X className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#ff005c" }} />
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{error}</div>
          </div>
        )}

        {lastResult && (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/interview-desk/${lastResult.requestId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold w-fit"
              style={{ background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.3)", color: "#00e5a0", fontFamily: "Oswald, sans-serif" }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open as {lastResult.playerName} →
            </a>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              Closes in {expiresIn(lastResult.expiresAt)} — tied to the next scheduled episode, not a fixed countdown.
            </span>
          </div>
        )}

        {notifResult && (
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
            style={{
              background: notifResult.push.ok ? "rgba(0,229,160,0.08)" : "rgba(255,210,74,0.08)",
              border: `1px solid ${notifResult.push.ok ? "rgba(0,229,160,0.25)" : "rgba(255,210,74,0.25)"}`,
            }}
          >
            {notifResult.push.ok
              ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#00e5a0" }} />
              : <X className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#ffd24a" }} />}
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
              {notifResult.push.ok
                ? `Delivered to ${notifResult.playerName} — ${notifResult.push.sentTo} device${notifResult.push.sentTo === 1 ? "" : "s"}. Check for the banner.`
                : (notifResult.push.detail ?? `Couldn't confirm delivery to ${notifResult.playerName}.`)}
              {" "}
              <a href={`/interview-desk/${notifResult.requestId}`} target="_blank" rel="noreferrer" style={{ color: "#0066ff", textDecoration: "underline" }}>
                Open it anyway →
              </a>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="pt-2 space-y-2">
            <div className="flex items-center gap-1.5 text-[0.65rem] uppercase font-bold tracking-wider" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
              <History className="w-3 h-3" />Recent test fires
            </div>
            <div className="space-y-1.5">
              {history.slice(0, 8).map((h) => (
                <a
                  key={h.id}
                  href={`/interview-desk/${h.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition-colors"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <span style={{ color: "rgba(255,255,255,0.75)" }}>
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>{h.trigger_type.replace(/_/g, " ")}</span> → {h.player_name}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full font-bold uppercase text-[0.6rem]"
                    style={{
                      color: h.status === "pending" ? "#ffd24a" : h.status === "answered" ? "#00e5a0" : "rgba(255,255,255,0.4)",
                      background: h.status === "pending" ? "rgba(255,210,74,0.1)" : h.status === "answered" ? "rgba(0,229,160,0.1)" : "rgba(255,255,255,0.05)",
                    }}
                  >
                    {h.status}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleAdminSection>
  );
}
