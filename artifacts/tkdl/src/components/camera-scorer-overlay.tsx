import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Wifi, X, CheckCircle, AlertTriangle, Loader2, Crosshair, RefreshCw, XCircle } from "lucide-react";
import { useCameraScorerCtx, type Dart } from "@/lib/dartboard";

type ApiDart = { label: string; value: number };
type AnalysisResult = {
  darts: ApiDart[];
  total: number;
  annotatedImage?: string;
  calibrationPoints?: number;
  error?: string;
};
type SvcState = "unknown" | "ok" | "starting" | "unavailable";
type Phase  = "calibrating" | "idle" | "detecting" | "committed";

const COUNTDOWN_MS      = 3000;
const ANALYZE_INTERVAL  = 1500;

function labelToDart(label: string, value: number): Dart {
  if (!label || label === "miss" || label === "Miss" || value === 0)
    return { segment: 0, multiplier: 1, value: 0, label: "miss" };
  if (label === "DB")                       return { segment: 25, multiplier: 2, value: 50, label: "DB" };
  if (label === "SB" || label === "Bull")   return { segment: 25, multiplier: 1, value: 25, label: "Bull" };
  if (label.startsWith("T")) { const s = parseInt(label.slice(1)); return { segment: isNaN(s) ? 0 : s, multiplier: 3, value, label }; }
  if (label.startsWith("D")) { const s = parseInt(label.slice(1)); return { segment: isNaN(s) ? 0 : s, multiplier: 2, value, label }; }
  const s = parseInt(label);
  return { segment: isNaN(s) ? 0 : s, multiplier: 1, value, label };
}

function dartColor(label: string) {
  if (label === "DB")                     return "#ff005c";
  if (label === "SB" || label === "Bull") return "#ff6b9d";
  if (label === "miss")                   return "rgba(255,255,255,0.25)";
  if (label.startsWith("T"))              return "#ff6b9d";
  if (label.startsWith("D"))              return "#38bdf8";
  return "rgba(255,255,255,0.85)";
}
function dartBg(label: string) {
  if (label === "DB")          return "rgba(255,0,92,0.15)";
  if (label === "SB")          return "rgba(255,107,157,0.12)";
  if (label === "miss")        return "rgba(255,255,255,0.04)";
  if (label.startsWith("T"))   return "rgba(255,107,157,0.12)";
  if (label.startsWith("D"))   return "rgba(56,189,248,0.12)";
  return "rgba(255,255,255,0.07)";
}

export const CameraScorerOverlay = React.memo(
  function CameraScorerOverlay({ onClose }: { onClose: () => void }) {
  const [inputMode,  setInputMode]  = useState<"camera" | "webcam">("camera");
  const [webcamUrl,  setWebcamUrl]  = useState("192.168.1.x:8080");
  const [streaming,  setStreaming]  = useState(false);
  const [svcState,   setSvcState]   = useState<SvcState>("unknown");
  const [phase,      setPhase]      = useState<Phase>("calibrating");
  const [analyzing,  setAnalyzing]  = useState(false);
  const [result,     setResult]     = useState<AnalysisResult | null>(null);
  const [countdown,  setCountdown]  = useState(COUNTDOWN_MS);
  const [committed,  setCommitted]  = useState<{ darts: ApiDart[]; total: number } | null>(null);

  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const analyzingRef  = useRef(false);
  const resultRef     = useRef<AnalysisResult | null>(null);
  const prevPhaseRef  = useRef<Phase>("calibrating");

  const { setPendingDarts } = useCameraScorerCtx();

  // Keep refs in sync
  useEffect(() => { resultRef.current = result; }, [result]);

  // ── Health check on mount, auto-start camera if OK ──────────────────────────
  useEffect(() => {
    checkHealth();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const healthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopHealthPoll() {
    if (healthPollRef.current) { clearInterval(healthPollRef.current); healthPollRef.current = null; }
  }

  function checkHealth() {
    setSvcState("unknown");
    fetch("/api/dart-scorer/health")
      .then(r => r.ok ? r.json() : null)
      .then((d: { ok?: boolean; ready?: boolean; error?: string } | null) => {
        if (!d?.ok) { setSvcState("unavailable"); stopHealthPoll(); }
        else if (d.ready) { setSvcState("ok"); stopHealthPoll(); }
        else if (d.error) { setSvcState("unavailable"); stopHealthPoll(); }
        else setSvcState("starting");
      })
      .catch(() => { setSvcState("unavailable"); stopHealthPoll(); });
  }

  // Poll every 5 s while the daemon is still loading
  useEffect(() => {
    if (svcState === "starting") {
      if (!healthPollRef.current) {
        healthPollRef.current = setInterval(checkHealth, 5000);
      }
    } else {
      stopHealthPoll();
    }
    return stopHealthPoll;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svcState]);

  // Auto-start camera when service comes up
  useEffect(() => {
    if (svcState === "ok" && inputMode === "camera" && !streaming) {
      void startCamera();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svcState]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setStreaming(true);
    } catch {
      setResult({ darts: [], total: 0, error: "Camera access denied. Allow camera permission in your browser." });
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  }

  // ── Single frame capture + analyze ─────────────────────────────────────────
  const captureAndAnalyze = useCallback(async () => {
    if (analyzingRef.current) return;
    let base64: string | null = null;

    if (inputMode === "camera") {
      const video = videoRef.current, canvas = canvasRef.current;
      if (!video || !canvas || !streaming) return;
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      base64 = canvas.toDataURL("image/jpeg", 0.82).split(",")[1] ?? null;
    } else {
      try {
        const r = await fetch(`/api/dart-scorer/webcam-snap?url=${encodeURIComponent(webcamUrl)}`);
        if (!r.ok) throw new Error();
        const data = await r.arrayBuffer();
        base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
      } catch { return; }
    }

    if (!base64) return;
    analyzingRef.current = true;
    setAnalyzing(true);
    try {
      const res  = await fetch("/api/dart-scorer/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      const data: AnalysisResult = await res.json();
      setResult(data);
    } catch { /* silent – retry next tick */ } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }, [inputMode, streaming, webcamUrl]);

  // ── Continuous auto-analyze loop ────────────────────────────────────────────
  useEffect(() => {
    const active = (streaming && inputMode === "camera") || inputMode === "webcam";
    if (!active || svcState !== "ok") return;
    const id = setInterval(() => { void captureAndAnalyze(); }, ANALYZE_INTERVAL);
    return () => clearInterval(id);
  }, [streaming, inputMode, svcState, captureAndAnalyze]);

  // ── Phase state machine driven by results ──────────────────────────────────
  useEffect(() => {
    if (!result) return;
    const cal       = result.calibrationPoints ?? 0;
    const dartCount = result.darts.length;
    const prev      = prevPhaseRef.current;

    let next: Phase = prev;

    if (cal < 4) {
      next = "calibrating";
    } else if (prev === "committed") {
      // Wait for player to pull darts out
      if (dartCount === 0) next = "idle";
    } else if (prev === "detecting") {
      // Darts disappeared mid-countdown → abort (false positive or bounce-out)
      if (dartCount === 0) next = "idle";
    } else {
      // calibrating | idle
      next = dartCount > 0 ? "detecting" : "idle";
    }

    if (next !== prev) {
      prevPhaseRef.current = next;
      setPhase(next);
      if (next === "detecting") setCountdown(COUNTDOWN_MS);
    }
  }, [result]);

  // ── Countdown tick ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "detecting") return;
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 100)), 100);
    return () => clearInterval(id);
  }, [phase]);

  // ── Auto-fire when countdown hits 0 ────────────────────────────────────────
  useEffect(() => {
    if (phase === "detecting" && countdown === 0) fireDarts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, phase]);

  function fireDarts() {
    const r = resultRef.current;
    if (!r?.darts.length) return;
    setPendingDarts(r.darts.map(d => labelToDart(d.label, d.value)));
    setCommitted({ darts: r.darts, total: r.total });
    prevPhaseRef.current = "committed";
    setPhase("committed");
    setCountdown(COUNTDOWN_MS);
  }

  function cancelDetecting() {
    prevPhaseRef.current = "idle";
    setPhase("idle");
    setCountdown(COUNTDOWN_MS);
    setResult(null);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const countdownPct  = countdown / COUNTDOWN_MS;
  const isUnavailable = svcState === "unavailable";

  const statusConfig: Record<Phase, { label: string; color: string; pulse: boolean }> = {
    calibrating: { label: "CALIBRATING BOARD…", color: "#ffd24a",  pulse: true  },
    idle:        { label: "READY — THROW YOUR DARTS",  color: "#00d296",  pulse: false },
    detecting:   { label: "DARTS DETECTED",            color: "#ff005c",  pulse: true  },
    committed:   { label: "SCORE APPLIED ✓",           color: "#00d296",  pulse: false },
  };
  const sc = statusConfig[phase];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "#04040a",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.65rem",
        padding: "0.65rem 1rem",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(0,0,0,0.4)",
        flexShrink: 0,
      }}>
        <Crosshair size={16} style={{ color: "#ff005c" }} />
        <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1rem", letterSpacing: "0.1em", color: "#fff", flex: 1 }}>
          AI CAMERA SCORER
        </span>
        <span style={{
          background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.35)",
          color: "#00d4ff", borderRadius: "0.25rem", padding: "0.1rem 0.4rem",
          fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", fontFamily: "Oswald, sans-serif",
        }}>YOLOv8</span>
        {analyzing && <Loader2 size={14} style={{ color: "rgba(255,255,255,0.3)", animation: "spin 1s linear infinite", flexShrink: 0 }} />}
        <button onClick={() => { stopCamera(); onClose(); }} style={{
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "0.4rem", padding: "0.4rem", cursor: "pointer", color: "rgba(255,255,255,0.5)",
          display: "flex", alignItems: "center",
        }}>
          <X size={16} />
        </button>
      </div>

      {/* ── Service unavailable banner ──────────────────────────────────────── */}
      {isUnavailable && (
        <div style={{
          padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.65rem",
          background: "rgba(255,0,92,0.08)", borderBottom: "1px solid rgba(255,0,92,0.25)",
          flexShrink: 0,
        }}>
          <AlertTriangle size={14} style={{ color: "#ff005c", flexShrink: 0 }} />
          <span style={{ color: "#ff005c", fontSize: "0.8rem", flex: 1, fontFamily: "Oswald, sans-serif" }}>
            AI scorer offline — start the API Server workflow and wait ~30s
          </span>
          <button onClick={checkHealth} style={{
            padding: "0.25rem 0.6rem", borderRadius: "0.35rem",
            background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.3)",
            color: "#ff005c", fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.7rem",
            cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem",
          }}>
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      )}

      {svcState === "starting" && (
        <div style={{
          padding: "0.6rem 1rem", display: "flex", alignItems: "center", gap: "0.6rem",
          background: "rgba(255,210,74,0.05)", borderBottom: "1px solid rgba(255,210,74,0.15)",
          flexShrink: 0,
        }}>
          <Loader2 size={13} style={{ color: "#ffd24a", animation: "spin 1s linear infinite", flexShrink: 0 }} />
          <span style={{ color: "rgba(255,210,74,0.8)", fontSize: "0.8rem", fontFamily: "Oswald, sans-serif", flex: 1 }}>
            YOLOv8 loading… checking every 5s
          </span>
          <button onClick={() => { fetch("/api/dart-scorer/restart", { method: "POST" }).catch(() => {}); checkHealth(); }}
            style={{ padding: "0.2rem 0.5rem", borderRadius: "0.3rem", background: "rgba(255,210,74,0.1)", border: "1px solid rgba(255,210,74,0.3)", color: "#ffd24a", fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.65rem", cursor: "pointer", flexShrink: 0 }}>
            Restart
          </button>
        </div>
      )}

      {/* ── Camera feed ─────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", flex: "1 1 0", minHeight: 0, background: "#000", overflow: "hidden" }}>

        {/* Video */}
        <video ref={videoRef} autoPlay playsInline muted
          style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* IP webcam mode: show last annotated frame */}
        {inputMode === "webcam" && result?.annotatedImage && (
          <img src={`data:image/jpeg;base64,${result.annotatedImage}`} alt="Detected"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        )}

        {/* Annotated overlay in camera mode (small inset, bottom-right) */}
        {inputMode === "camera" && result?.annotatedImage && phase !== "committed" && (
          <div style={{
            position: "absolute", bottom: 52, right: 8,
            width: 120, borderRadius: "0.4rem", overflow: "hidden",
            border: "1.5px solid rgba(255,0,92,0.4)", background: "#000",
          }}>
            <div style={{ padding: "0.2rem 0.4rem", background: "rgba(255,0,92,0.15)", fontSize: "0.5rem", fontFamily: "Oswald, sans-serif", color: "#ff005c", letterSpacing: "0.08em" }}>
              DETECTED
            </div>
            <img src={`data:image/jpeg;base64,${result.annotatedImage}`} alt="" style={{ width: "100%", display: "block" }} />
          </div>
        )}

        {/* Status bar overlaid on bottom of video */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "0.5rem 0.75rem",
          background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
          display: "flex", alignItems: "center", gap: "0.55rem",
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background: sc.color,
            boxShadow: sc.pulse ? `0 0 0 0 ${sc.color}` : undefined,
            animation: sc.pulse ? "statusPulse 1.4s ease-in-out infinite" : undefined,
          }} />
          <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", color: sc.color }}>
            {sc.label}
          </span>
          {phase === "calibrating" && result && (
            <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
              {result.calibrationPoints ?? 0}/4 cal pts
            </span>
          )}
        </div>
      </div>

      {/* ── Bottom action area ──────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, background: "rgba(0,0,0,0.5)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Input source switcher (collapsed row) */}
        <div style={{ display: "flex", gap: "0.4rem", padding: "0.5rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {(["camera", "webcam"] as const).map(m => (
            <button key={m} onClick={() => { if (!streaming) setInputMode(m); }}
              style={{
                padding: "0.3rem 0.65rem", borderRadius: "0.35rem",
                border: inputMode === m ? "1.5px solid rgba(0,212,255,0.5)" : "1.5px solid rgba(255,255,255,0.07)",
                background: inputMode === m ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.02)",
                color: inputMode === m ? "#00d4ff" : "rgba(255,255,255,0.25)",
                fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.7rem",
                cursor: streaming ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "0.3rem",
              }}>
              {m === "camera" ? <Camera size={11} /> : <Wifi size={11} />}
              {m === "camera" ? "Device Camera" : "IP Webcam"}
            </button>
          ))}
          {inputMode === "webcam" && (
            <input value={webcamUrl} onChange={e => setWebcamUrl(e.target.value)}
              placeholder="192.168.1.x:8080"
              style={{
                flex: 1, background: "rgba(255,255,255,0.05)",
                border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "0.35rem",
                padding: "0.3rem 0.55rem", color: "#fff", fontFamily: "monospace", fontSize: "0.75rem", outline: "none",
              }} />
          )}
        </div>

        {/* ── DETECTING: dart chips + countdown ── */}
        {phase === "detecting" && result && result.darts.length > 0 && (
          <div style={{ padding: "0.65rem 0.75rem" }}>

            {/* Dart chips + total */}
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.65rem" }}>
              {result.darts.map((d, i) => (
                <div key={i} style={{
                  flex: 1, textAlign: "center", padding: "0.55rem 0.3rem",
                  border: `1.5px solid ${dartColor(d.label)}44`,
                  borderRadius: "0.45rem", background: dartBg(d.label),
                }}>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.35rem", color: dartColor(d.label), lineHeight: 1.1 }}>
                    {d.label}
                  </div>
                  <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>{d.value}</div>
                </div>
              ))}
              <div style={{
                minWidth: 56, textAlign: "center", padding: "0.55rem 0.3rem",
                border: "1.5px solid rgba(255,210,74,0.35)", borderRadius: "0.45rem",
                background: "rgba(255,210,74,0.07)",
              }}>
                <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.35rem", color: "#ffd24a", lineHeight: 1.1 }}>
                  {result.total}
                </div>
                <div style={{ fontSize: "0.55rem", color: "rgba(255,210,74,0.5)", fontFamily: "Oswald, sans-serif" }}>TOTAL</div>
              </div>
            </div>

            {/* Countdown bar */}
            <div style={{ marginBottom: "0.6rem" }}>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  background: `linear-gradient(90deg, #ff005c, #ff6b9d)`,
                  width: `${countdownPct * 100}%`,
                  transition: "width 0.1s linear",
                }} />
              </div>
              <div style={{ marginTop: "0.3rem", textAlign: "center", fontSize: "0.65rem", fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.3)" }}>
                Scoring in {(countdown / 1000).toFixed(1)}s
              </div>
            </div>

            {/* Fire Now / Wrong buttons */}
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={fireDarts}
                style={{
                  flex: 1, padding: "0.6rem",
                  border: "1.5px solid rgba(0,210,150,0.5)", borderRadius: "0.45rem",
                  background: "rgba(0,210,150,0.1)", color: "#00d296",
                  fontFamily: "Oswald, sans-serif", fontWeight: 800, fontSize: "0.85rem",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                }}>
                <CheckCircle size={14} /> Score Now
              </button>
              <button onClick={cancelDetecting}
                style={{
                  padding: "0.6rem 1rem",
                  border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "0.45rem",
                  background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.4)",
                  fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.82rem",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem",
                }}>
                <XCircle size={13} /> Wrong
              </button>
            </div>
          </div>
        )}

        {/* ── COMMITTED: show what was scored ── */}
        {phase === "committed" && committed && (
          <div style={{ padding: "0.65rem 0.75rem" }}>
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <CheckCircle size={18} style={{ color: "#00d296", flexShrink: 0 }} />
              <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1rem", color: "#00d296", flex: 1 }}>
                SCORED — {committed.darts.map(d => d.label).join("  ")}
                <span style={{ color: "#ffd24a", marginLeft: "0.5rem" }}>= {committed.total}</span>
              </span>
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
              Pull your darts from the board to continue
            </div>
          </div>
        )}

        {/* ── IDLE / CALIBRATING: instruction strip ── */}
        {(phase === "idle" || phase === "calibrating") && (
          <div style={{ padding: "0.6rem 0.75rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {phase === "calibrating"
              ? <Loader2 size={14} style={{ color: "#ffd24a", animation: "spin 1s linear infinite", flexShrink: 0 }} />
              : <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d296", display: "inline-block", flexShrink: 0 }} />}
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.78rem", fontFamily: "Oswald, sans-serif" }}>
              {phase === "calibrating"
                ? "Make sure all four edges of the board are visible"
                : "Throw your darts — scoring is fully automatic"}
            </span>
          </div>
        )}

        {/* Error strip */}
        {result?.error && (
          <div style={{ padding: "0.5rem 0.75rem", display: "flex", gap: "0.5rem", alignItems: "center", borderTop: "1px solid rgba(255,210,74,0.15)", background: "rgba(255,210,74,0.04)" }}>
            <AlertTriangle size={13} style={{ color: "#ffd24a", flexShrink: 0 }} />
            <span style={{ color: "#ffd24a", fontSize: "0.75rem" }}>{result.error}</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 currentColor; }
          50%       { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
},
  // Only re-render if onClose changes (should rarely happen)
  (prev, next) => prev.onClose === next.onClose
);
