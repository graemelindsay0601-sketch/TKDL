import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Wifi, Play, Square, RotateCcw, CheckCircle, AlertTriangle, Loader2, Crosshair, RefreshCw } from "lucide-react";

type DartResult = { label: string; value: number };

type AnalysisResult = {
  darts: DartResult[];
  total: number;
  annotatedImage?: string;
  calibrationPoints?: number;
  error?: string;
};

type InputMode = "camera" | "webcam";

function dartColor(label: string): string {
  if (label === "DB")          return "#ff005c";
  if (label === "SB" || label === "Bull") return "#ff6b9d";
  if (label === "miss")        return "rgba(255,255,255,0.25)";
  if (label.startsWith("T"))  return "#00d4ff";
  if (label.startsWith("D"))  return "#ffd24a";
  return "rgba(255,255,255,0.85)";
}

function dartBg(label: string): string {
  if (label === "DB")          return "rgba(255,0,92,0.12)";
  if (label === "SB")          return "rgba(255,107,157,0.10)";
  if (label === "miss")        return "rgba(255,255,255,0.04)";
  if (label.startsWith("T"))  return "rgba(0,212,255,0.10)";
  if (label.startsWith("D"))  return "rgba(255,210,74,0.10)";
  return "rgba(255,255,255,0.06)";
}

export default function AutoScorer() {
  const [mode, setMode] = useState<InputMode>("camera");
  const [webcamUrl, setWebcamUrl] = useState("192.168.1.x:8080");
  const [streaming, setStreaming] = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [committedDarts, setCommittedDarts] = useState<DartResult[]>([]);
  const [serviceState, setServiceState] = useState<"unknown" | "ok" | "starting" | "unavailable">("unknown");

  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Health check on mount
  useEffect(() => {
    fetch("/api/dart-scorer/health")
      .then(r => r.ok ? r.json() : null)
      .then((d: { ok?: boolean; ready?: boolean; starting?: boolean } | null) => {
        if (!d?.ok)       setServiceState("unavailable");
        else if (d.ready) setServiceState("ok");
        else              setServiceState("starting");
      })
      .catch(() => setServiceState("unavailable"));
  }, []);

  // Start device camera (rear-facing for phone pointed at board)
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
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
    setAutoAnalyze(false);
  }

  // Capture current frame → base64 JPEG → send to API
  const analyzeFrame = useCallback(async () => {
    if (analyzing) return;

    let base64: string | null = null;

    if (mode === "camera") {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !streaming) return;
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      // Strip "data:image/jpeg;base64," prefix
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      base64 = dataUrl.split(",")[1] ?? null;
    } else {
      // IP webcam: ask the server to snapshot for us
      try {
        const r = await fetch(
          `/api/dart-scorer/webcam-snap?url=${encodeURIComponent(webcamUrl)}`
        );
        if (!r.ok) throw new Error("Webcam snapshot failed");
        const data = await r.arrayBuffer();
        base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
      } catch {
        setResult({ darts: [], total: 0, error: "Could not reach IP webcam. Check URL and that both devices are on the same WiFi." });
        return;
      }
    }

    if (!base64) return;
    setAnalyzing(true);
    setResult(null);

    try {
      const res = await fetch("/api/dart-scorer/analyze", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ image: base64 }),
      });
      const data: AnalysisResult = await res.json();
      setResult(data);
      setServiceState("ok");
    } catch {
      setResult({ darts: [], total: 0, error: "Analysis request failed. Is the scorer service running?" });
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, mode, streaming, webcamUrl]);

  // Auto-analyze toggle
  useEffect(() => {
    if (autoAnalyze) {
      autoRef.current = setInterval(analyzeFrame, 2500);
    } else {
      if (autoRef.current) clearInterval(autoRef.current);
    }
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoAnalyze, analyzeFrame]);

  function commitVisit() {
    if (!result?.darts.length) return;
    setCommittedDarts(p => [...p, ...result!.darts]);
    setResult(null);
  }

  const sessionTotal  = committedDarts.reduce((s, d) => s + d.value, 0);
  const pendingTotal  = result?.darts.reduce((s, d) => s + d.value, 0) ?? 0;
  const isDisabled    = serviceState === "unavailable";
  const canAnalyze    = !analyzing && (streaming || mode === "webcam") && !isDisabled;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1rem 1rem 4rem" }}>

      {/* ── Header ── */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <Crosshair size={22} style={{ color: "#ff005c" }} />
          <h1 style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.8rem", letterSpacing: "0.04em", color: "#fff" }}>
            AUTO-SCORER
          </h1>
          <span style={{
            background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.4)",
            color: "#00d4ff", borderRadius: "0.3rem", padding: "0.15rem 0.5rem",
            fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.12em", fontFamily: "Oswald, sans-serif",
          }}>YOLOv8 AI</span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>
          Point your camera at the board · AI detects dart positions · scores computed automatically
        </p>
      </div>

      {/* ── Service status banner ── */}
      {serviceState === "unavailable" && (
        <div className="pdc-card p-3 mb-4 flex items-start gap-3"
          style={{ borderColor: "rgba(255,0,92,0.3)", background: "rgba(255,0,92,0.05)" }}>
          <AlertTriangle size={16} style={{ color: "#ff005c", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, color: "#ff005c", fontSize: "0.9rem", marginBottom: "0.2rem" }}>
              AI scorer service offline
            </div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.8rem", lineHeight: 1.5 }}>
              Python packages need to finish installing. Run the <strong style={{ color: "#fff" }}>API Server</strong> workflow
              and wait ~60 seconds for ultralytics + PyTorch to finish installing, then reload this page.
            </div>
            <button onClick={() => {
              setServiceState("unknown");
              fetch("/api/dart-scorer/health").then(r => r.json()).then(d => {
                setServiceState(d.ready ? "ok" : d.starting ? "starting" : "unavailable");
              }).catch(() => setServiceState("unavailable"));
            }} style={{
              marginTop: "0.5rem", padding: "0.3rem 0.8rem",
              background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.3)",
              borderRadius: "0.4rem", color: "#ff005c",
              fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.75rem",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem",
            }}>
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        </div>
      )}

      {serviceState === "starting" && (
        <div className="pdc-card p-3 mb-4 flex items-center gap-3"
          style={{ borderColor: "rgba(255,210,74,0.2)", background: "rgba(255,210,74,0.04)" }}>
          <Loader2 size={15} style={{ color: "#ffd24a", animation: "spin 1s linear infinite", flexShrink: 0 }} />
          <span style={{ color: "rgba(255,210,74,0.8)", fontSize: "0.85rem" }}>
            YOLOv8 model loading… first start takes ~20–30 seconds
          </span>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="pdc-card p-4 mb-4">
        <div style={{ fontSize: "0.65rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.6rem" }}>
          CAMERA SOURCE
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {(["camera", "webcam"] as InputMode[]).map(m => (
            <button key={m} onClick={() => { if (!streaming) setMode(m); }}
              style={{
                padding: "0.55rem", borderRadius: "0.5rem",
                border: mode === m ? "2px solid #00d4ff" : "1.5px solid rgba(255,255,255,0.08)",
                background: mode === m ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.02)",
                color: mode === m ? "#00d4ff" : "rgba(255,255,255,0.35)",
                fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.8rem",
                cursor: streaming ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              }}>
              {m === "camera" ? <Camera size={14} /> : <Wifi size={14} />}
              {m === "camera" ? "Device Camera" : "IP Webcam"}
            </button>
          ))}
        </div>

        {mode === "webcam" && (
          <div className="mb-3">
            <label style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
              IP WEBCAM ADDRESS
            </label>
            <input value={webcamUrl} onChange={e => setWebcamUrl(e.target.value)}
              placeholder="192.168.1.x:8080"
              style={{
                width: "100%", marginTop: "0.3rem", background: "rgba(255,255,255,0.05)",
                border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "0.4rem",
                padding: "0.5rem 0.75rem", color: "#fff", fontFamily: "monospace", fontSize: "0.9rem",
                outline: "none",
              }} />
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.7rem", marginTop: "0.25rem" }}>
              Install "IP Webcam" (Android) or "EpocCam" (iOS), start server, enter the IP shown
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {mode === "camera" && (
            <button onClick={streaming ? stopCamera : startCamera}
              disabled={isDisabled}
              style={{
                flex: 1, padding: "0.6rem 1rem",
                border: `1.5px solid ${streaming ? "rgba(255,0,92,0.4)" : "rgba(0,212,255,0.35)"}`,
                borderRadius: "0.5rem",
                background: streaming ? "rgba(255,0,92,0.07)" : "rgba(0,212,255,0.08)",
                color: streaming ? "#ff005c" : "#00d4ff",
                fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.9rem",
                cursor: isDisabled ? "not-allowed" : "pointer", opacity: isDisabled ? 0.4 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              }}>
              {streaming ? <><Square size={14} />Stop Camera</> : <><Camera size={14} />Start Camera</>}
            </button>
          )}

          <button onClick={analyzeFrame} disabled={!canAnalyze}
            style={{
              flex: 1, padding: "0.6rem 1rem",
              border: "1.5px solid rgba(255,210,74,0.35)", borderRadius: "0.5rem",
              background: "rgba(255,210,74,0.08)", color: "#ffd24a",
              fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.9rem",
              cursor: !canAnalyze ? "not-allowed" : "pointer", opacity: !canAnalyze ? 0.4 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            }}>
            {analyzing
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Analyzing…</>
              : <><Play size={14} />Analyze Now</>}
          </button>

          {(streaming || mode === "webcam") && (
            <button onClick={() => setAutoAnalyze(a => !a)} disabled={isDisabled}
              style={{
                padding: "0.6rem 1rem",
                border: autoAnalyze ? "1.5px solid rgba(0,210,150,0.5)" : "1.5px solid rgba(255,255,255,0.08)",
                borderRadius: "0.5rem",
                background: autoAnalyze ? "rgba(0,210,150,0.09)" : "rgba(255,255,255,0.02)",
                color: autoAnalyze ? "#00d296" : "rgba(255,255,255,0.35)",
                fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.85rem",
                cursor: isDisabled ? "not-allowed" : "pointer",
              }}>
              AUTO {autoAnalyze ? "ON" : "OFF"}
            </button>
          )}
        </div>
      </div>

      {/* ── Video + Annotated result ── */}
      <div style={{ display: "grid", gridTemplateColumns: streaming && result?.annotatedImage ? "1fr 1fr" : "1fr", gap: "1rem", marginBottom: "1rem" }}>
        {streaming && (
          <div className="pdc-card p-0 overflow-hidden" style={{ borderRadius: "0.75rem" }}>
            <div style={{
              padding: "0.35rem 0.75rem", background: "rgba(255,255,255,0.02)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              fontSize: "0.6rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d296", display: "inline-block" }} />
              LIVE FEED
              {autoAnalyze && <span style={{ marginLeft: "auto", color: "#00d296", fontSize: "0.6rem" }}>● AUTO</span>}
            </div>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", display: "block", background: "#000", maxHeight: 400, objectFit: "cover" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>
        )}

        {result?.annotatedImage && (
          <div className="pdc-card p-0 overflow-hidden" style={{ borderRadius: "0.75rem" }}>
            <div style={{
              padding: "0.35rem 0.75rem", background: "rgba(255,255,255,0.02)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              fontSize: "0.6rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <Crosshair size={10} style={{ color: "#ff005c" }} />
              DETECTED
              <span style={{ marginLeft: "auto", color: (result.calibrationPoints ?? 0) >= 4 ? "#00d296" : "#ffd24a" }}>
                {result.calibrationPoints ?? 0}/4 CAL PTS
              </span>
            </div>
            <img src={`data:image/jpeg;base64,${result.annotatedImage}`}
              alt="Annotated dartboard" style={{ width: "100%", display: "block", maxHeight: 400, objectFit: "contain" }} />
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {result?.error && (
        <div className="pdc-card p-3 mb-3 flex items-start gap-3"
          style={{ borderColor: "rgba(255,210,74,0.25)", background: "rgba(255,210,74,0.04)" }}>
          <AlertTriangle size={15} style={{ color: "#ffd24a", flexShrink: 0, marginTop: 2 }} />
          <span style={{ color: "#ffd24a", fontSize: "0.85rem", lineHeight: 1.5 }}>{result.error}</span>
        </div>
      )}

      {/* ── Detected visit ── */}
      {result && result.darts.length > 0 && (
        <div className="pdc-card p-4 mb-3">
          <div style={{ fontSize: "0.65rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.75rem" }}>
            DARTS DETECTED
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            {result.darts.map((d, i) => (
              <div key={i} style={{
                flex: 1, textAlign: "center", padding: "0.75rem 0.5rem",
                border: `1.5px solid ${dartColor(d.label)}44`,
                borderRadius: "0.5rem", background: dartBg(d.label),
              }}>
                <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.6rem", color: dartColor(d.label), lineHeight: 1.1 }}>
                  {d.label}
                </div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>{d.value}</div>
              </div>
            ))}
            <div style={{
              minWidth: 70, textAlign: "center", padding: "0.75rem 0.5rem",
              border: "1.5px solid rgba(255,210,74,0.3)", borderRadius: "0.5rem",
              background: "rgba(255,210,74,0.06)",
            }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.6rem", color: "#ffd24a", lineHeight: 1.1 }}>
                {pendingTotal}
              </div>
              <div style={{ fontSize: "0.65rem", color: "rgba(255,210,74,0.5)", fontFamily: "Oswald, sans-serif" }}>TOTAL</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={commitVisit}
              style={{
                flex: 1, padding: "0.7rem",
                border: "1.5px solid rgba(0,210,150,0.45)", borderRadius: "0.5rem",
                background: "rgba(0,210,150,0.08)", color: "#00d296",
                fontFamily: "Oswald, sans-serif", fontWeight: 800, fontSize: "0.9rem",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              }}>
              <CheckCircle size={15} /> Accept Score
            </button>
            <button onClick={() => setResult(null)}
              style={{
                padding: "0.7rem 1.2rem",
                border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem",
                background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.4)",
                fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.9rem",
                cursor: "pointer",
              }}>
              Re-scan
            </button>
          </div>
        </div>
      )}

      {/* ── No darts found ── */}
      {result && result.darts.length === 0 && !result.error && (
        <div className="pdc-card p-4 mb-3 text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
            No darts detected. Throw your darts, then analyze again.
          </div>
        </div>
      )}

      {/* ── Session history ── */}
      {committedDarts.length > 0 && (
        <div className="pdc-card p-4 mb-3">
          <div style={{
            fontSize: "0.65rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.35)", marginBottom: "0.75rem",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>SESSION DARTS</span>
            <button onClick={() => setCommittedDarts([])}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,0,92,0.5)", fontSize: "0.65rem", fontFamily: "Oswald, sans-serif", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <RotateCcw size={10} /> CLEAR
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.75rem" }}>
            {committedDarts.map((d, i) => (
              <div key={i} style={{
                padding: "0.25rem 0.55rem",
                border: `1px solid ${dartColor(d.label)}33`,
                borderRadius: "0.35rem", background: dartBg(d.label),
                fontFamily: "Oswald, sans-serif", fontWeight: 800, fontSize: "0.85rem",
                color: dartColor(d.label),
              }}>{d.label}</div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>SESSION TOTAL</div>
              <div style={{ fontSize: "2.8rem", fontWeight: 900, fontFamily: "Oswald, sans-serif", color: "#ffd24a", lineHeight: 1 }}>
                {sessionTotal}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── How it works (shown before camera started) ── */}
      {!streaming && !result && (
        <div className="pdc-card p-4">
          <div style={{ fontSize: "0.65rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.75rem" }}>
            HOW IT WORKS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.25rem" }}>
            {[
              ["1", "Point your camera at the full dartboard — all four edges visible", "#00d4ff"],
              ["2", "Throw your 3 darts as normal", "#ffd24a"],
              ["3", "Tap Analyze Now — YOLOv8 AI detects each dart's tip position", "#ff6b9d"],
              ["4", "Board calibration is automatic (corner markers of 20/6/3/11 segments)", "#00d296"],
              ["5", "Accept the detected score, or re-scan if a dart was missed", "#ffd24a"],
            ].map(([n, txt, col]) => (
              <div key={n} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: `${col}18`, border: `1.5px solid ${col}55`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "0.75rem", color: col,
                }}>{n}</div>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", paddingTop: 2, lineHeight: 1.5 }}>{txt}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "0.75rem", background: "rgba(255,210,74,0.04)", borderRadius: "0.5rem", border: "1px solid rgba(255,210,74,0.12)" }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.7rem", color: "#ffd24a", marginBottom: "0.4rem" }}>BEST RESULTS</div>
            <ul style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", paddingLeft: "1rem", margin: 0, lineHeight: 1.8 }}>
              <li>Mount phone/tablet above or beside the board — full board must be visible</li>
              <li>Good even lighting — avoid strong shadows or backlighting</li>
              <li>Use IP Webcam mode if the phone is fixed; score from a separate device</li>
              <li>The model was trained on 24,000+ real darts images — works on any board</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
