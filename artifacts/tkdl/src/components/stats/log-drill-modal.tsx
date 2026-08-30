import { useState } from "react";
import { X, Dumbbell } from "lucide-react";

export interface LoggableDrill {
  id: string;
  title: string;
  duration?: string; // e.g. "15 min" — used only to prefill the duration field
}

interface LogDrillModalProps {
  playerId: number;
  drill: LoggableDrill;
  onClose: () => void;
  onLogged: () => void;
}

const DIFFICULTIES: { value: "easy" | "medium" | "hard" | "master"; label: string }[] = [
  { value: "easy",   label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard",   label: "Hard" },
  { value: "master", label: "Master" },
];

// Pulls the leading integer out of strings like "15 min" — falls back to 10.
function parseDurationMinutes(duration?: string): number {
  const match = duration?.match(/\d+/);
  return match ? parseInt(match[0], 10) : 10;
}

export function LogDrillModal({ playerId, drill, onClose, onLogged }: LogDrillModalProps) {
  const [score, setScore]           = useState(70);
  const [durationMinutes, setDur]   = useState(parseDurationMinutes(drill.duration));
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "master">("medium");
  const [notes, setNotes]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/players/${playerId}/drills/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drillId: drill.id,
          drillTitle: drill.title,
          durationMinutes,
          score,
          difficulty,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onLogged();
    } catch (e: any) {
      setError(e.message ?? "Failed to log drill");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1100, padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "rgba(8,6,18,0.98)", border: "1px solid rgba(0,200,160,0.25)",
          borderRadius: "16px", width: "100%", maxWidth: "420px", padding: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Dumbbell size={16} style={{ color: "#00c8a0" }} />
            <div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.8rem", fontWeight: 700, color: "#fff" }}>
                Log Drill Completion
              </div>
              <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>
                {drill.title}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
            <span>How'd it go?</span>
            <span style={{ color: "#00c8a0", fontWeight: 700 }}>{score}/100</span>
          </div>
          <input
            type="range" min={0} max={100} value={score}
            onChange={(e) => setScore(parseInt(e.target.value, 10))}
            style={{ width: "100%", accentColor: "#00c8a0" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.55rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>
              Duration (min)
            </label>
            <input
              type="number" min={1} value={durationMinutes}
              onChange={(e) => setDur(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "0.75rem" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.55rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "0.75rem" }}
            >
              {DIFFICULTIES.map(d => (
                <option key={d.value} value={d.value} style={{ color: "#111" }}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "0.55rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything worth remembering about this session…"
            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "0.72rem", resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {error && <div style={{ fontSize: "0.65rem", color: "#ff005c", marginBottom: "10px" }}>{error}</div>}

        <button
          onClick={submit}
          disabled={submitting}
          style={{
            width: "100%", padding: "11px", background: "rgba(0,200,160,0.15)",
            border: "1px solid rgba(0,200,160,0.35)", color: "#00c8a0", borderRadius: "8px",
            fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Saving…" : "Save Completion"}
        </button>
      </div>
    </div>
  );
}
