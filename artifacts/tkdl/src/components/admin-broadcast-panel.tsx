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
type ProgrammeMode = "NEWS" | "BALANCED" | "MAGAZINE";
type ContentBeat = "news" | "analysis" | "feature";
type ProgrammeProfile = {
  maxHeadlineTeases: number;
  maxStorySegments: number;
  estimatedRuntimeSeconds: { min: number; max: number };
  contentMix: ContentBeat[];
};

type BroadcastAdminStatus = {
  recentEditions: RecentEdition[];
  currentPublished: { id: number; slotKey: string; changeScore: number; publishedAt: string | null } | null;
  storyCounts: StoryCount[];
  predictorDiagnostics: Record<string, { generatedAt: string; modelVersion: string } | null>;
  config: { programmeProfiles: Record<ProgrammeMode, ProgrammeProfile> } & Record<string, unknown>;
};

const PROGRAMME_MODES: ProgrammeMode[] = ["NEWS", "BALANCED", "MAGAZINE"];

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
  const [creatingEpisode, setCreatingEpisode] = useState(false);
  const [cleanSweeping, setCleanSweeping] = useState(false);
  const [sweepStartDate, setSweepStartDate] = useState("2026-09-01");
  const [message, setMessage]       = useState("");
  const [msgType, setMsgType]       = useState<"success" | "error">("success");
  const [profiles, setProfiles] = useState<Record<ProgrammeMode, ProgrammeProfile> | null>(null);
  const [savingProfiles, setSavingProfiles] = useState(false);

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
      if (r.ok) {
        setStatus(d);
        setProfiles(d.config.programmeProfiles);
      }
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
        const retained = d.retainedEditionId ? ` Edition #${d.retainedEditionId} stays live.` : "";
        toast(`${d.error ?? "Rebuild failed."}${retained}`, "error");
      } else if (!d.edition) {
        toast(d.message ?? "Still couldn't clear the quality gate — check the diagnostics below", "error");
      } else {
        const runtime = typeof d.edition.runtimeSeconds === "number" ? ` · ${formatRuntime(d.edition.runtimeSeconds)}` : "";
        toast(`✅ Edition #${d.edition.id} rebuilt · ${d.edition.mode ?? "Programme"}${runtime}`, "success");
      }
      loadStatus();
    } catch { toast("Regenerate failed", "error"); } finally { setRegenerating(false); }
  };

  const createEpisode = async () => {
    try {
      setCreatingEpisode(true);
      const r = await fetch("/api/admin/broadcast/episodes", { method: "POST", headers: getAdminHeaders() });
      const d = await r.json();
      if (!r.ok) {
        const diagnostic = d.attempt?.diagnostic ? ` ${d.attempt.diagnostic}` : "";
        const retained = d.retainedEditionId ? ` Edition #${d.retainedEditionId} stays live.` : "";
        toast(`${d.error ?? "New episode failed."}${retained}${diagnostic}`, "error");
      } else {
        const runtime = typeof d.edition.runtimeSeconds === "number" ? ` · ${formatRuntime(d.edition.runtimeSeconds)}` : "";
        toast(`✅ New Episode #${d.edition.id} is live · ${d.edition.mode ?? "Programme"}${runtime}`, "success");
      }
      loadStatus();
    } catch {
      toast("New episode failed", "error");
    } finally {
      setCreatingEpisode(false);
    }
  };

  const cleanSweep = async () => {
    const confirmed = window.confirm(
      `Build one complete TKDL LIVE programme covering every active-season match from ${sweepStartDate} through now?\n\nMatch and season data will not be deleted. The new programme will replace the currently live Edition if it builds successfully.`
    );
    if (!confirmed) return;
    try {
      setCleanSweeping(true);
      const r = await fetch("/api/admin/broadcast/clean-sweep", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ startDate: sweepStartDate }),
      });
      const d = await r.json();
      if (!r.ok) {
        const diagnostic = d.attempt?.diagnostic ? ` ${d.attempt.diagnostic}` : "";
        const retained = d.retainedEditionId ? ` Edition #${d.retainedEditionId} stays live.` : "";
        toast(`${d.error ?? "Clean sweep failed."}${retained}${diagnostic}`, "error");
      } else {
        const runtime = typeof d.edition.runtimeSeconds === "number" ? ` · ${formatRuntime(d.edition.runtimeSeconds)}` : "";
        toast(`✅ Clean Sweep #${d.edition.id} is live · ${d.edition.matchResults} match results${runtime}`, "success");
      }
      loadStatus();
    } catch {
      toast("Clean sweep failed", "error");
    } finally {
      setCleanSweeping(false);
    }
  };

  const updateProfile = (mode: ProgrammeMode, update: (profile: ProgrammeProfile) => ProgrammeProfile) => {
    setProfiles(current => current ? { ...current, [mode]: update(current[mode]) } : current);
  };

  const saveProfiles = async () => {
    if (!profiles) return;
    try {
      setSavingProfiles(true);
      const r = await fetch("/api/admin/broadcast/settings", {
        method: "PATCH",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          broadcast_news_profile: JSON.stringify(profiles.NEWS),
          broadcast_balanced_profile: JSON.stringify(profiles.BALANCED),
          broadcast_magazine_profile: JSON.stringify(profiles.MAGAZINE),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        const details = d.details ? Object.values(d.details).join("; ") : d.error;
        toast(details ?? "Failed to save programme profiles", "error");
        return;
      }
      setProfiles(d.config.programmeProfiles);
      setStatus(current => current ? { ...current, config: d.config } : current);
      toast("Programme profiles saved. They will apply to the next Edition.");
    } catch {
      toast("Failed to save programme profiles", "error");
    } finally {
      setSavingProfiles(false);
    }
  };

  const latest = status?.recentEditions[0] ?? null;

  return (
    <div style={{ padding: "1.5rem", color: D.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, letterSpacing: "0.08em" }}>📺 TKDL LIVE BROADCAST</h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: D.sub }}>Produce a new live show, or rebuild the current slot for diagnostics</p>
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
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ display: "grid", gap: "3px", fontSize: "10px", color: D.sub }}>
                  Clean sweep start
                  <input
                    type="date"
                    value={sweepStartDate}
                    onChange={event => setSweepStartDate(event.target.value)}
                    disabled={cleanSweeping || creatingEpisode || regenerating}
                    style={{ background: "rgba(0,0,0,.25)", border: `1px solid ${D.border}`, borderRadius: "6px", color: D.text, padding: "6px 8px" }}
                  />
                </label>
                <button
                  onClick={cleanSweep}
                  disabled={cleanSweeping || creatingEpisode || regenerating || !sweepStartDate}
                  style={{ padding: "12px 22px", borderRadius: "8px", border: `1px solid ${D.warn}55`, background: cleanSweeping ? `${D.warn}33` : `${D.warn}18`, color: D.warn, cursor: cleanSweeping || creatingEpisode || regenerating ? "default" : "pointer", fontWeight: 800, fontSize: "13px", letterSpacing: "0.04em", whiteSpace: "nowrap" }}
                >
                  {cleanSweeping ? "Sweeping…" : "Clean Sweep"}
                </button>
                <button
                  onClick={createEpisode}
                  disabled={creatingEpisode || regenerating || cleanSweeping}
                  style={{ padding: "12px 22px", borderRadius: "8px", border: "none", background: creatingEpisode ? `${D.success}33` : `${D.success}22`, color: D.success, cursor: creatingEpisode || regenerating || cleanSweeping ? "default" : "pointer", fontWeight: 800, fontSize: "13px", letterSpacing: "0.04em", whiteSpace: "nowrap" }}
                >
                  {creatingEpisode ? "Producing…" : "● Create New Episode"}
                </button>
                <button
                  onClick={regenerate}
                  disabled={regenerating || creatingEpisode || cleanSweeping}
                  style={{ padding: "12px 22px", borderRadius: "8px", border: "none", background: regenerating ? `${D.info}33` : `${D.info}22`, color: D.info, cursor: regenerating || creatingEpisode || cleanSweeping ? "default" : "pointer", fontWeight: 800, fontSize: "13px", letterSpacing: "0.04em", whiteSpace: "nowrap" }}
                >
                  {regenerating ? "Rebuilding…" : "↻ Rebuild Current Slot"}
                </button>
              </div>
            </div>
          </div>

          {profiles && (
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: "10px", padding: "18px", marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.06em" }}>PROGRAMME FORMAT CONTROLS</div>
                  <div style={{ color: D.sub, fontSize: "11px", marginTop: "4px" }}>Tune pacing safely. Runtime must be 60–900 seconds with at least a 30-second range, and each content beat maps to one of 4–7 story segments.</div>
                </div>
                <button onClick={saveProfiles} disabled={savingProfiles} style={{ padding: "8px 14px", borderRadius: "8px", border: `1px solid ${D.info}55`, background: `${D.info}18`, color: D.info, cursor: savingProfiles ? "default" : "pointer", fontWeight: 800 }}>
                  {savingProfiles ? "Saving…" : "Save Formats"}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
                {PROGRAMME_MODES.map(mode => {
                  const profile = profiles[mode];
                  const maximumAchievableRuntime = profile.maxStorySegments * 6 * 9 + profile.maxHeadlineTeases * 3 * 9 + 3 * 2 * 9;
                  const numberField = (label: string, value: number, min: number, max: number, onChange: (value: number) => void) => (
                    <label style={{ display: "grid", gap: "4px", fontSize: "11px", color: D.sub }}>
                      {label}
                      <input type="number" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} style={{ background: "rgba(0,0,0,.25)", border: `1px solid ${D.border}`, borderRadius: "6px", color: D.text, padding: "7px" }} />
                    </label>
                  );
                  return (
                    <div key={mode} style={{ border: `1px solid ${D.border}`, borderRadius: "8px", padding: "12px" }}>
                      <div style={{ fontWeight: 900, fontSize: "13px", marginBottom: "10px", color: mode === "NEWS" ? D.danger : mode === "BALANCED" ? D.info : D.warn }}>{mode}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {numberField("Headline teases", profile.maxHeadlineTeases, 0, 5, value => updateProfile(mode, p => ({ ...p, maxHeadlineTeases: value })))}
                        {numberField("Story segments", profile.maxStorySegments, 4, 7, value => updateProfile(mode, p => {
                          const nextMix = Array.from({ length: value }, (_, i) => p.contentMix[i] ?? "feature");
                          return { ...p, maxHeadlineTeases: Math.min(p.maxHeadlineTeases, value), maxStorySegments: value, contentMix: nextMix };
                        }))}
                        {numberField("Runtime min (sec)", profile.estimatedRuntimeSeconds.min, 60, maximumAchievableRuntime, value => updateProfile(mode, p => ({ ...p, estimatedRuntimeSeconds: { ...p.estimatedRuntimeSeconds, min: value } })))}
                        {numberField("Runtime max (sec)", profile.estimatedRuntimeSeconds.max, profile.estimatedRuntimeSeconds.min + 30, 900, value => updateProfile(mode, p => ({ ...p, estimatedRuntimeSeconds: { ...p.estimatedRuntimeSeconds, max: value } })))}
                      </div>
                      <div style={{ marginTop: "10px", fontSize: "11px", color: D.sub }}>Content mix</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "5px" }}>
                        {profile.contentMix.map((beat, index) => (
                          <select key={index} value={beat} onChange={e => updateProfile(mode, p => ({ ...p, contentMix: p.contentMix.map((item, i) => i === index ? e.target.value as ContentBeat : item) }))} style={{ background: "#171923", color: D.text, border: `1px solid ${D.border}`, borderRadius: "6px", padding: "5px", fontSize: "11px" }}>
                            <option value="news">News</option>
                            <option value="analysis">Analysis</option>
                            <option value="feature">Feature</option>
                          </select>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
        <strong style={{ color: D.warn }}>Clean Sweep</strong> deliberately ignores previous broadcast coverage and produces one complete results programme from the selected date through now. It does not delete match, season, story, or Edition records, and the previous Edition stays live if the sweep fails. After a successful sweep, <strong style={{ color: D.success }}>Create New Episode</strong> and <strong style={{ color: D.info }}>Rebuild Current Slot</strong> return to normal incremental updates.
      </div>
    </div>
  );
}
