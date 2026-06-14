import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Wifi, Play, Square, X, CheckCircle, AlertTriangle, Loader2, Crosshair, RefreshCw } from "lucide-react";
import { useCameraScorerCtx, type Dart } from "@/lib/dartboard";

type ApiDart = { label: string; value: number };
type AnalysisResult = {
  darts: ApiDart[];
  total: number;
  annotatedImage?: string;
  calibrationPoints?: number;
  error?: string;
};

function labelToDart(label: string, value: number): Dart {
  if (!label || label === "miss" || label === "Miss" || value === 0)
    return { segment: 0, multiplier: 1, value: 0, label: "miss" };
  if (label === "DB") return { segment: 25, multiplier: 2, value: 50, label: "DB" };
  if (label === "SB" || label === "Bull") return { segment: 25, multiplier: 1, value: 25, label: "Bull" };
  if (label.startsWith("T")) {
    const seg = parseInt(label.slice(1));
    return { segment: isNaN(seg) ? 0 : seg, multiplier: 3, value, label };
  }
  if (label.startsWith("D")) {
    const seg = parseInt(label.slice(1));
    return { segment: isNaN(seg) ? 0 : seg, multiplier: 2, value, label };
  }
  const seg = parseInt(label);
  return { segment: isNaN(seg) ? 0 : seg, multiplier: 1, value, label };
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
  if (label === "DB")                     return "rgba(255,0,92,0.12)";
  if (label === "SB")                     return "rgba(255,107,157,0.10)";
  if (label === "miss")                   return "rgba(255,255,255,0.04)";
  if (label.startsWith("T"))              return "rgba(255,107,157,0.10)";
  if (label.startsWith("D"))              return "rgba(56,189,248,0.10)";
  return "rgba(255,255,255,0.06)";
}

export function CameraScorerOverlay({ onClose }: { onClose: () => void }) {
  const [inputMode, setInputMode]     = useState<"camera" | "webcam">("camera");
  const [webcamUrl, setWebcamUrl]     = useState("192.168.1.x:8080");
  const [streaming, setStreaming]     = useState(false);
  const [analyzing, setAnalyzing]     = useState(false);
  const [result, setResult]           = useState<AnalysisResult | null>(null);
  const [svcState, setSvcState]       = useState<"unknown" | "ok" | "starting" | "unavailable">("unknown");

  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { setPendingDarts } = useCameraScorerCtx();

  useEffect(() => {
    fetch("/api/dart-scorer/health")
      .then(r => r.ok ? r.json() : null)
      .then((d: { ok?: boolean; ready?: boolean; starting?: boolean } | null) => {
        if (!d?.ok)       setSvcState("unavailable");
        else if (d.ready) setSvcState("ok");
        else              setSvcState("starting");
      })
      .catch(() => setSvcState("unavailable"));
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

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
  }

  const analyzeFrame = useCallback(async () => {
    if (analyzing) return;
    let base64: string | null = null;

    if (inputMode === "camera") {
      const video = videoRef.current, canvas = canvasRef.current;
      if (!video || !canvas || !streaming) return;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? null;
    } else {
      try {
        const r = await fetch(`/api/dart-scorer/webcam-snap?url=${encodeURIComponent(webcamUrl)}`);
        if (!r.ok) throw new Error();
        const data = await r.arrayBuffer();
        base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
      } catch {
        setResult({ darts: [], total: 0, error: "Could not reach IP webcam." });
        return;
      }
    }
    if (!base64) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await fetch("/api/dart-scorer/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      const data: AnalysisResult = await res.json();
      setResult(data);
      setSvcState("ok");
    } catch {
      setResult({ darts: [], total: 0, error: "Analysis failed. Is the scorer service running?" });
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, inputMode, streaming, webcamUrl]);

  function acceptAndFire() {
    if (!result?.darts.length) return;
    const dartObjs: Dart[] = result.darts.map(d => labelToDart(d.label, d.value));
    setPendingDarts(dartObjs);
    stopCamera();
    onClose();
  }

  const isUnavailable = svcState === "unavailable";
  const canAnalyze    = !analyzing && (streaming || inputMode === "webcam") && !isUnavailable;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(4,4,10,0.97)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "0.75rem 1rem",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.02)",
        flexShrink: 0,
      }}>
        <Crosshair size={18} style={{ color: "#ff005c" }} />
        <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.1rem", letterSpacing: "0.08em", color: "#fff", flex: 1 }}>
          AI CAMERA SCORER
        </span>
        <span style={{
          background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.35)",
          color: "#00d4ff", borderRadius: "0.25rem", padding: "0.1rem 0.45rem",
          fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", fontFamily: "Oswald, sans-serif",
        }}>YOLOv8</span>
        <button onClick={() => { stopCamera(); onClose(); }} style={{
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "0.4rem", padding: "0.4rem", cursor: "pointer", color: "rgba(255,255,255,0.5)",
          display: "flex", alignItems: "center",
        }}>
          <X size={16} />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>

        {/* Service banners */}
        {isUnavailable && (
          <div className="pdc-card p-3 mb-3 flex items-start gap-3"
            style={{ borderColor: "rgba(255,0,92,0.3)", background: "rgba(255,0,92,0.05)" }}>
            <AlertTriangle size={15} style={{ color: "#ff005c", flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, color: "#ff005c", fontSize: "0.85rem" }}>
                AI scorer offline
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                Start the API Server workflow and wait ~60 seconds for the YOLOv8 model to load.
              </div>
              <button onClick={() => {
                setSvcState("unknown");
                fetch("/api/dart-scorer/health").then(r => r.json())
                  .then((d: { ready?: boolean; starting?: boolean }) => setSvcState(d.ready ? "ok" : d.starting ? "starting" : "unavailable"))
                  .catch(() => setSvcState("unavailable"));
              }} style={{
                marginTop: "0.5rem", padding: "0.25rem 0.65rem",
                background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.3)",
                borderRadius: "0.35rem", color: "#ff005c",
                fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.7rem",
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem",
              }}>
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          </div>
        )}

        {svcState === "starting" && (
          <div className="pdc-card p-3 mb-3 flex items-center gap-3"
            style={{ borderColor: "rgba(255,210,74,0.2)", background: "rgba(255,210,74,0.04)" }}>
            <Loader2 size={14} style={{ color: "#ffd24a", animation: "spin 1s linear infinite", flexShrink: 0 }} />
            <span style={{ color: "rgba(255,210,74,0.8)", fontSize: "0.8rem" }}>
              YOLOv8 loading… ~20–30 seconds
            </span>
          </div>
        )}

        {/* Input source selector */}
        <div className="pdc-card p-3 mb-3">
          <div style={{ fontSize: "0.6rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: "0.5rem" }}>
            CAMERA SOURCE
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.5rem" }}>
            {(["camera", "webcam"] as const).map(m => (
              <button key={m} onClick={() => { if (!streaming) setInputMode(m); }}
                style={{
                  padding: "0.45rem", borderRadius: "0.45rem",
                  border: inputMode === m ? "2px solid #00d4ff" : "1.5px solid rgba(255,255,255,0.07)",
                  background: inputMode === m ? "rgba(0,212,255,0.07)" : "rgba(255,255,255,0.02)",
                  color: inputMode === m ? "#00d4ff" : "rgba(255,255,255,0.3)",
                  fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.75rem",
                  cursor: streaming ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem",
                }}>
                {m === "camera" ? <Camera size={13} /> : <Wifi size={13} />}
                {m === "camera" ? "Device Camera" : "IP Webcam"}
              </button>
            ))}
          </div>

          {inputMode === "webcam" && (
            <div className="mb-3">
              <input value={webcamUrl} onChange={e => setWebcamUrl(e.target.value)}
                placeholder="192.168.1.x:8080"
                style={{
                  width: "100%", background: "rgba(255,255,255,0.05)",
                  border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "0.4rem",
                  padding: "0.45rem 0.65rem", color: "#fff", fontFamily: "monospace", fontSize: "0.85rem",
                  outline: "none",
                }} />
            </div>
          )}

          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {inputMode === "camera" && (
              <button onClick={streaming ? stopCamera : startCamera}
                disabled={isUnavailable}
                style={{
                  flex: 1, padding: "0.5rem 0.75rem",
                  border: `1.5px solid ${streaming ? "rgba(255,0,92,0.4)" : "rgba(0,212,255,0.35)"}`,
                  borderRadius: "0.45rem",
                  background: streaming ? "rgba(255,0,92,0.07)" : "rgba(0,212,255,0.07)",
                  color: streaming ? "#ff005c" : "#00d4ff",
                  fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.82rem",
                  cursor: isUnavailable ? "not-allowed" : "pointer",
                  opacity: isUnavailable ? 0.4 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                }}>
                {streaming ? <><Square size={13} />Stop</> : <><Camera size={13} />Start Camera</>}
              </button>
            )}
            <button onClick={analyzeFrame} disabled={!canAnalyze}
              style={{
                flex: 1, padding: "0.5rem 0.75rem",
                border: "1.5px solid rgba(255,210,74,0.35)", borderRadius: "0.45rem",
                background: "rgba(255,210,74,0.08)", color: "#ffd24a",
                fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.82rem",
                cursor: !canAnalyze ? "not-allowed" : "pointer",
                opacity: !canAnalyze ? 0.4 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              }}>
              {analyzing
                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />Analyzing…</>
                : <><Play size={13} />Analyze Board</>}
            </button>
          </div>
        </div>

        {/* Video feed + annotated result side-by-side */}
        {(streaming || result?.annotatedImage) && (
          <div style={{
            display: "grid",
            gridTemplateColumns: streaming && result?.annotatedImage ? "1fr 1fr" : "1fr",
            gap: "0.5rem", marginBottom: "0.75rem",
          }}>
            {streaming && (
              <div className="pdc-card p-0 overflow-hidden" style={{ borderRadius: "0.6rem" }}>
                <div style={{ padding: "0.3rem 0.6rem", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "0.55rem", fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00d296", display: "inline-block" }} />
                  LIVE
                </div>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", display: "block", background: "#000", maxHeight: 280, objectFit: "cover" }} />
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
            )}
            {result?.annotatedImage && (
              <div className="pdc-card p-0 overflow-hidden" style={{ borderRadius: "0.6rem" }}>
                <div style={{ padding: "0.3rem 0.6rem", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "0.55rem", fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Crosshair size={9} style={{ color: "#ff005c" }} />
                  DETECTED
                  <span style={{ marginLeft: "auto", color: (result.calibrationPoints ?? 0) >= 4 ? "#00d296" : "#ffd24a", fontSize: "0.55rem" }}>
                    {result.calibrationPoints ?? 0}/4 cal pts
                  </span>
                </div>
                <img src={`data:image/jpeg;base64,${result.annotatedImage}`} alt="Detected" style={{ width: "100%", display: "block", maxHeight: 280, objectFit: "contain" }} />
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {result?.error && (
          <div className="pdc-card p-3 mb-3 flex items-start gap-3"
            style={{ borderColor: "rgba(255,210,74,0.25)", background: "rgba(255,210,74,0.04)" }}>
            <AlertTriangle size={14} style={{ color: "#ffd24a", flexShrink: 0, marginTop: 2 }} />
            <span style={{ color: "#ffd24a", fontSize: "0.8rem", lineHeight: 1.5 }}>{result.error}</span>
          </div>
        )}

        {/* Detected darts — Accept button */}
        {result && result.darts.length > 0 && (
          <div className="pdc-card p-3 mb-3">
            <div style={{ fontSize: "0.6rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: "0.6rem" }}>
              DARTS DETECTED
            </div>
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
              {result.darts.map((d, i) => (
                <div key={i} style={{
                  flex: 1, textAlign: "center", padding: "0.6rem 0.4rem",
                  border: `1.5px solid ${dartColor(d.label)}44`,
                  borderRadius: "0.45rem", background: dartBg(d.label),
                }}>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.4rem", color: dartColor(d.label), lineHeight: 1.1 }}>
                    {d.label}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>{d.value}</div>
                </div>
              ))}
              <div style={{ minWidth: 60, textAlign: "center", padding: "0.6rem 0.4rem", border: "1.5px solid rgba(255,210,74,0.3)", borderRadius: "0.45rem", background: "rgba(255,210,74,0.06)" }}>
                <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.4rem", color: "#ffd24a", lineHeight: 1.1 }}>
                  {result.total}
                </div>
                <div style={{ fontSize: "0.6rem", color: "rgba(255,210,74,0.5)", fontFamily: "Oswald, sans-serif" }}>TOTAL</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={acceptAndFire}
                style={{
                  flex: 1, padding: "0.65rem",
                  border: "1.5px solid rgba(0,210,150,0.5)", borderRadius: "0.45rem",
                  background: "rgba(0,210,150,0.1)", color: "#00d296",
                  fontFamily: "Oswald, sans-serif", fontWeight: 800, fontSize: "0.88rem",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.45rem",
                }}>
                <CheckCircle size={14} /> Accept & Fire Darts
              </button>
              <button onClick={() => setResult(null)}
                style={{
                  padding: "0.65rem 1rem",
                  border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "0.45rem",
                  background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.4)",
                  fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.82rem",
                  cursor: "pointer",
                }}>Re-scan</button>
            </div>
          </div>
        )}

        {result && result.darts.length === 0 && !result.error && (
          <div className="pdc-card p-4 text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.85rem" }}>
              No darts detected. Throw your darts, then analyze again.
            </div>
          </div>
        )}

        {/* Instructions (idle state) */}
        {!streaming && !result && (
          <div className="pdc-card p-3">
            <div style={{ fontSize: "0.6rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: "0.6rem" }}>
              HOW TO USE
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                ["1", "Point camera at board — all four edges visible", "#00d4ff"],
                ["2", "Throw your darts, then tap Analyze Board", "#ffd24a"],
                ["3", "Review detected darts, then Accept & Fire", "#00d296"],
              ].map(([n, txt, col]) => (
                <div key={n} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: `${col}18`, border: `1.5px solid ${col}55`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "0.7rem", color: col,
                  }}>{n}</div>
                  <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.8rem", paddingTop: 1, lineHeight: 1.5 }}>{txt}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
