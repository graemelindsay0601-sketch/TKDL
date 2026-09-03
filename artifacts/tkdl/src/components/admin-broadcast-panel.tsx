import React, { useState, useEffect } from "react";

// TKDL LIVE — admin control panel for the automated broadcast show.
// Fills a real gap: edition-engine.ts only ever retries a time slot lazily,
// on the next ordinary page load, and once a slot is marked SKIPPED/FAILED
// it's "terminal" — nothing about a normal page view can ever retry it
// again. POST /api/admin/broadcast/regenerate (forceRebuildCurrentEdition)
// already existed to reclaim a terminal slot on demand, but nothing in the
// app could call it. This panel is that missing button, styled to match
// admin-feature-flags-panel.tsx's own look.

const D = {
  card:    "rgba(255,255,255,0.04)",
  border:  "rgba(255,255,255,0.08)",
  text:    "#ffffff",
  sub:     "rgba(255,255,255,0.45)",
  success: "#00ff88",
  danger:  "#ff6b6b",
  warn:    "#ffaa00",
  info:    "#00b4ff",
};

const getAdminHeaders = () => ({ "Content-Type": "application/json" });

type RecentEdition = {
  id: number;
  slotKey: string;
  slotType: string;
  status: "BUILDING" | "PUBLISHED" | "SKIPPED" | "FAILED";
  changeScore: number;
  dataCutoff: string;
  publishedAt: string | null;
  diagnostic: string | null;
  createdAt: string;
  /** Show Bible v1 §1 "Programme lengths" — real dialogue-hold-time runtime
   * and its Quiet/Normal/Busy/Exceptional band, diagnostic-only (never a
   * publish gate — see director-math.ts's own classifyEditionLength).
   * null for any row with no real programme yet (SKIPPED/FAILED/BUILDING). */
  runtimeSeconds: number | null;
  runtimeBand: "quiet" | "normal" | "busy" | "exceptional" | null;
};

type StoryCount = { lifecycle: string; leagueType: string; count: number };

type BroadcastAdminStatus = {
  recentEditions: RecentEdition[];
  currentPublished: { id: number; slotKey: string; changeScore: number; publishedAt: string | null } | null;
  storyCounts: StoryCount[];
  predictorDiagnostics: Record<string, { generatedAt: string; modelVersion: string } | null>;
  config: Record<string, unknown>;
};

const STATUS_COLOR: Record<RecentEdition["status"], string> = {
  PUBLISHED: D.success,
  BUILDING:  D.info,
  SKIPPED:   D.warn,
  FAILED:    D.danger,
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatRuntime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const RUNTIME_BAND_LABEL: Record<NonNullable<RecentEdition["runtimeBand"]>, string> = {
  quiet: "Quiet", normal: "Normal", busy: "Busy", exceptional: "Exceptional",
};
const RUNTIME_BAND_COLOR: Record<NonNullable<RecentEdition["runtimeBand"]>, string> = {
  quiet: D.sub, normal: D.info, busy: D.warn, exceptional: D.success,
};

export default function AdminBroadcastPanel() {
  const [status, setStatus]         = useState<BroadcastAdminStatus | null>(null);
  const [loading, setLoading]       = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [message, setMessage]       = useState("");
  const [msgType, setMsgType]       = useState<"success" | "error">("success");

  useEffect(() => { loadStatus(); }, []);

  const toast = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg); setMsgType(type);
    setTimeout(() => setMessage(""), 6000);
  };

  const loadStatus = async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/admin/broadcast/status", { headers: getAdminHeaders() });
      const d = await r.json();
      if (r.ok) setStatus(d);
      else toast(d.error ?? "Failed to load broadcast status", "error");
    } catch { toast("Failed to load broadcast status", "error"); } finally { setLoading(false); }
  };

  const regenerate = async () => {
    try {
      setRegenerating(true);
      const r = await fetch("/api/admin/broadcast/regenerate", { method: "POST", headers: getAdminHeaders() });
      const d = await r.json();
      if (r.status === 409) {
        toast("Already building this slot right now — try again in a moment", "error");
      } else if (!r.ok) {
        toast(d.error ?? "Regenerate failed", "error");
      } else if (!d.edition) {
        toast(d.message ?? "Still couldn't clear the quality gate — check the diagnostics below", "error");
      } else {
        toast(`✅ Edition #${d.edition.id} rebuilt — status ${d.edition.status}`, d.edition.status === "PUBLISHED" ? "success" : "error");
      }
      loadStatus();
    } catch { toast("Regenerate failed", "error"); } finally { setRegenerating(false); }
  };

  const latest = status?.recentEditions[0] ?? null;

  return (
    <div style={{ padding: "1.5rem", color: D.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, letterSpacing: "0.08em" }}>📺 TKDL LIVE BROADCAST</h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: D.sub }}>Force a fresh Edition to build right now instead of waiting for the next time slot</p>
        </div>
        <button onClick={loadStatus} style={{ padding: "7px 14px", borderRadius: "8px", border: `1px solid ${D.border}`, background: D.card, color: D.sub, cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>↻ Refresh</button>
      </div>

      {message && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", marginBottom: "1rem", fontSize: "13px", background: `${msgType === "success" ? D.success : D.danger}14`, border: `1px solid ${msgType === "success" ? D.success : D.danger}44`, color: msgType === "success" ? D.success : D.danger }}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: D.sub }}>Loading broadcast status…</div>
      ) : (
        <>
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: "10px", padding: "18px", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
              <div>
                <div style={{ fontSize: "12px", color: D.sub, marginBottom: "4px" }}>Currently live for players</div>
                {status?.currentPublished ? (
                  <div style={{ fontSize: "14px", fontWeight: 700 }}>
                    Edition #{status.currentPublished.id} <span style={{ color: D.sub, fontWeight: 400 }}>({status.currentPublished.slotKey})</span> — published {formatWhen(status.currentPublished.publishedAt)}
                  </div>
                ) : (
                  <div style={{ fontSize: "14px", fontWeight: 700, color: D.warn }}>No Edition has ever been published — players see the fallback standings screen</div>
                )}
                {latest && latest.status !== "PUBLISHED" && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: STATUS_COLOR[latest.status] }}>
                    Most recent build attempt for slot <strong>{latest.slotKey}</strong>: <strong>{latest.status}</strong>
                    {latest.diagnostic ? ` — ${latest.diagnostic}` : ""}. It won't retry on its own until the next time slot.
                  </div>
                )}
              </div>
              <button
                onClick={regenerate}
                disabled={regenerating}
                style={{ padding: "12px 22px", borderRadius: "8px", border: "none", background: regenerating ? `${D.info}33` : `${D.info}22`, color: D.info, cursor: regenerating ? "default" : "pointer", fontWeight: 800, fontSize: "13px", letterSpacing: "0.04em", whiteSpace: "nowrap" }}
              >
                {regenerating ? "Building…" : "⚡ Regenerate Now"}
              </button>
            </div>
          </div>

          {status && status.recentEditions.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: D.sub, marginBottom: "8px", letterSpacing: "0.05em" }}>RECENT BUILD ATTEMPTS</div>
              <div style={{ display: "grid", gap: "8px" }}>
                {status.recentEditions.map(e => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", background: D.card, border: `1px solid ${D.border}`, borderRadius: "8px", padding: "10px 14px", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "12px" }}>
                      <strong>#{e.id}</strong> <span style={{ color: D.sub }}>{e.slotKey} · {e.slotType} · change {e.changeScore}</span>
                      {e.runtimeSeconds !== null && <span style={{ color: D.sub }}> · {formatRuntime(e.runtimeSeconds)}</span>}
                      {e.diagnostic && <span style={{ color: D.sub }}> — {e.diagnostic}</span>}
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {e.runtimeBand && (
                        <span title="Show Bible programme-length band — diagnostic only, never a publish gate" style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: RUNTIME_BAND_COLOR[e.runtimeBand], whiteSpace: "nowrap", padding: "3px 10px", borderRadius: "10px", background: `${RUNTIME_BAND_COLOR[e.runtimeBand]}18`, border: `1px solid ${RUNTIME_BAND_COLOR[e.runtimeBand]}33` }}>
                          {RUNTIME_BAND_LABEL[e.runtimeBand]}
                        </span>
                      )}
                      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: STATUS_COLOR[e.status], whiteSpace: "nowrap", padding: "3px 10px", borderRadius: "10px", background: `${STATUS_COLOR[e.status]}18`, border: `1px solid ${STATUS_COLOR[e.status]}33` }}>
                        {e.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status && status.storyCounts.length > 0 && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: D.sub, marginBottom: "8px", letterSpacing: "0.05em" }}>STORY POOL (by league / lifecycle)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {status.storyCounts.map(sc => (
                  <span key={`${sc.leagueType}-${sc.lifecycle}`} style={{ fontSize: "11px", padding: "5px 10px", borderRadius: "8px", background: D.card, border: `1px solid ${D.border}`, color: D.sub }}>
                    {sc.leagueType} · {sc.lifecycle}: <strong style={{ color: D.text }}>{sc.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: "1.5rem", padding: "14px 16px", background: D.card, border: `1px solid ${D.border}`, borderRadius: "10px", fontSize: "12px", color: D.sub, lineHeight: 1.6 }}>
        A time slot that gets <strong style={{ color: D.warn }}>SKIPPED</strong> (too little changed) or <strong style={{ color: D.danger }}>FAILED</strong> (couldn't build a clean programme) is normally left alone until the next slot boundary — ordinary page loads never retry it. <strong style={{ color: D.info }}>Regenerate Now</strong> forces a fresh attempt immediately, ignoring the "not enough changed" threshold, so you can get an Edition live right after fixing whatever caused the last one to fail.
      </div>
    </div>
  );
}
