import { useState } from "react";
import { useDartHit } from "@/components/dartboard-bg";

// ── Types ─────────────────────────────────────────────────────────────────────
export type Dart = {
  segment: number;
  multiplier: 1 | 2 | 3;
  value: number;
  label: string;
};

// ── Checkout table ─────────────────────────────────────────────────────────────
export const CHECKOUTS: Record<number, string> = {
  170:"T20 T20 DB",167:"T20 T19 DB",164:"T20 T18 DB",161:"T20 T17 DB",
  160:"T20 T20 D20",158:"T20 T20 D19",157:"T20 T19 D20",156:"T20 T20 D18",
  155:"T20 T19 D19",154:"T20 T18 D20",153:"T20 T19 D18",152:"T20 T20 D16",
  151:"T20 T17 D20",150:"T20 T18 D18",149:"T20 T19 D16",148:"T20 T16 D20",
  147:"T20 T17 D18",146:"T20 T18 D16",145:"T20 T15 D20",144:"T20 T20 D12",
  143:"T20 T17 D16",142:"T20 T14 D20",141:"T20 T15 D18",140:"T20 T16 D16",
  139:"T20 T13 D20",138:"T20 T18 D12",137:"T20 T15 D16",136:"T20 T20 D8",
  135:"T20 T15 D15",134:"T20 T14 D16",133:"T20 T19 D8",132:"T20 T16 D12",
  131:"T20 T13 D16",130:"T20 T18 D8",129:"T19 T16 D12",128:"T18 T14 D16",
  127:"T20 T17 D8",126:"T19 T19 D6",125:"T20 T15 D10",124:"T20 T16 D8",
  123:"T19 T16 D9",122:"T18 T18 D7",121:"T20 T11 D14",120:"T20 S20 D20",
  119:"T19 T12 D13",118:"T20 S18 D20",117:"T20 S17 D20",116:"T20 S16 D20",
  115:"T19 S18 D20",114:"T20 S14 D20",113:"T19 S16 D20",112:"T20 S12 D20",
  111:"T19 S14 D20",110:"T20 S10 D20",109:"T20 S9 D20",108:"T20 S8 D20",
  107:"T19 S10 D20",106:"T20 S6 D20",105:"T20 S5 D20",104:"T18 S10 D20",
  103:"T19 S6 D20",102:"T20 S2 D20",101:"T17 S10 D20",100:"T20 D20",
  99:"T19 S2 D20",98:"T20 D19",97:"T19 D20",96:"T20 D18",95:"T19 D19",
  94:"T18 D20",93:"T19 D18",92:"T20 D16",91:"T17 D20",90:"T18 D18",
  89:"T19 D16",88:"T20 D14",87:"T17 D18",86:"T18 D16",85:"T19 D14",
  84:"T20 D12",83:"T17 D16",82:"T14 D20",81:"T19 D12",80:"T20 D10",
  79:"T13 D20",78:"T18 D12",77:"T19 D10",76:"T20 D8",75:"T17 D12",
  74:"T14 D16",73:"T19 D8",72:"T16 D12",71:"T13 D16",70:"T18 D8",
  69:"T19 D6",68:"T20 D4",67:"T17 D8",66:"T10 D18",65:"T19 D4",
  64:"T16 D8",63:"T17 D6",62:"T10 D16",61:"T15 D8",60:"S20 D20",
  59:"S19 D20",58:"S18 D20",57:"S17 D20",56:"T16 D4",55:"S15 D20",
  54:"S14 D20",53:"S13 D20",52:"S12 D20",51:"S11 D20",50:"DB",
  49:"S9 D20",48:"S8 D20",47:"S7 D20",46:"S6 D20",45:"S5 D20",
  44:"S4 D20",43:"S3 D20",42:"S10 D16",41:"S1 D20",40:"D20",
  39:"S7 D16",38:"D19",37:"S5 D16",36:"D18",35:"S3 D16",34:"D17",
  33:"S1 D16",32:"D16",31:"S7 D12",30:"D15",29:"S5 D12",28:"D14",
  27:"S3 D12",26:"D13",25:"S1 D12",24:"D12",23:"S7 D8",22:"D11",
  21:"S5 D8",20:"D10",19:"S3 D8",18:"D9",17:"S1 D8",16:"D8",
  15:"S7 D4",14:"D7",13:"S5 D4",12:"D6",11:"S3 D4",10:"D5",
  9:"S1 D4",8:"D4",7:"S3 D2",6:"D3",5:"S1 D2",4:"D2",3:"S1 D1",2:"D1",
};

// Numbers arranged high-to-low, 5 per row
const GRID_NUMS = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

// Multiplier config
const MULT_CFG = {
  1: { label: "SINGLE", color: "rgba(255,255,255,0.95)", activeColor: "rgba(255,255,255,0.95)", bg: "rgba(255,255,255,0.10)", border: "rgba(255,255,255,0.35)" },
  2: { label: "DOUBLE", color: "#38bdf8",               activeColor: "#38bdf8",               bg: "rgba(56,189,248,0.14)", border: "rgba(56,189,248,0.5)"  },
  3: { label: "TREBLE", color: "#ff6b9d",               activeColor: "#ff6b9d",               bg: "rgba(255,107,157,0.14)", border: "rgba(255,107,157,0.5)" },
} as const;

// ── DartInputBoard ─────────────────────────────────────────────────────────────
export function DartInputBoard({
  onDart, onMiss, onUndo,
  activeSegments,
  highlightSegments,
  disabled = false,
}: {
  onDart: (dart: Dart) => void;
  onMiss: () => void;
  onUndo: () => void;
  activeSegments?: number[];
  highlightSegments?: number[];
  disabled?: boolean;
}) {
  const [mult, setMult] = useState<1 | 2 | 3>(1);

  const { hitDart } = useDartHit();

  const fire = (seg: number, forceMult?: 1 | 2 | 3) => {
    if (disabled) return;
    const m = forceMult ?? (seg === 25 && mult === 3 ? 2 : mult);
    const val = seg === 25 ? (m === 2 ? 50 : 25) : seg * m;
    const label = seg === 25
      ? (m === 2 ? "DB" : "Bull")
      : m === 1 ? `${seg}` : m === 2 ? `D${seg}` : `T${seg}`;
    hitDart(label);
    onDart({ segment: seg, multiplier: m as 1 | 2 | 3, value: val, label });
  };

  const isActive = (n: number) => !activeSegments || activeSegments.includes(n);
  const isHigh   = (n: number) => !!highlightSegments?.includes(n);

  const mc = MULT_CFG[mult];

  const numBtnStyle = (n: number): React.CSSProperties => {
    const active = isActive(n);
    const hi = isHigh(n);
    return {
      padding: "0",
      minHeight: "52px",
      border: hi
        ? "2px solid rgba(255,210,74,0.6)"
        : active && mult > 1
        ? `2px solid ${mc.border}`
        : active
        ? "1.5px solid rgba(255,255,255,0.12)"
        : "1px solid rgba(255,255,255,0.04)",
      borderRadius: "0.5rem",
      background: hi
        ? "rgba(255,210,74,0.12)"
        : active && mult > 1
        ? mc.bg
        : active
        ? "rgba(255,255,255,0.06)"
        : "rgba(255,255,255,0.02)",
      color: active ? (hi ? "#ffd24a" : mc.color) : "rgba(255,255,255,0.15)",
      fontFamily: "Oswald, sans-serif",
      fontWeight: 900,
      fontSize: "1.35rem",
      cursor: active ? "pointer" : "default",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background 0.08s, border-color 0.08s",
      WebkitTapHighlightColor: "transparent",
      touchAction: "manipulation",
      opacity: active ? 1 : 0.25,
      userSelect: "none",
    };
  };

  return (
    <div style={{ opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? "none" : undefined, userSelect: "none" }}>

      {/* ── Multiplier selector ─────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.3rem", marginBottom: "0.3rem" }}>
        {([1, 2, 3] as const).map(m => {
          const cfg = MULT_CFG[m];
          const sel = mult === m;
          return (
            <button
              key={m}
              onClick={() => setMult(m)}
              style={{
                padding: "0.7rem 0",
                border: `2px solid ${sel ? cfg.border : "rgba(255,255,255,0.07)"}`,
                borderRadius: "0.5rem",
                background: sel ? cfg.bg : "rgba(255,255,255,0.02)",
                color: sel ? cfg.color : "rgba(255,255,255,0.28)",
                fontFamily: "Oswald, sans-serif",
                fontWeight: 800,
                fontSize: "0.9rem",
                letterSpacing: "0.06em",
                cursor: "pointer",
                transition: "all 0.1s",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}>
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* ── Number grid 5×4 ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0.3rem", marginBottom: "0.3rem" }}>
        {GRID_NUMS.map(n => (
          <button key={n} onClick={() => isActive(n) && fire(n)} style={numBtnStyle(n)}>
            {n}
          </button>
        ))}
      </div>

      {/* ── Bull row ────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem", marginBottom: "0.3rem" }}>
        <button
          onClick={() => fire(25, 1)}
          style={{
            padding: "0.7rem 0",
            borderRadius: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 800,
            cursor: "pointer",
            border: isHigh(25) ? "2px solid rgba(255,210,74,0.6)" : "1.5px solid rgba(34,197,94,0.3)",
            background: isHigh(25) ? "rgba(255,210,74,0.12)" : "rgba(34,197,94,0.08)",
            color: isHigh(25) ? "#ffd24a" : "#22c55e",
            fontSize: "1rem",
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            gap: "2px",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
            minHeight: "52px",
            justifyContent: "center",
          }}>
          <span style={{ fontSize: "0.55rem", opacity: 0.6, letterSpacing: "0.1em", fontWeight: 700 }}>SINGLE</span>
          <span>BULL · 25</span>
        </button>
        <button
          onClick={() => fire(25, 2)}
          style={{
            padding: "0.7rem 0",
            borderRadius: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 800,
            cursor: "pointer",
            border: "1.5px solid rgba(56,189,248,0.35)",
            background: "rgba(56,189,248,0.10)",
            color: "#38bdf8",
            fontSize: "1rem",
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            gap: "2px",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
            minHeight: "52px",
            justifyContent: "center",
          }}>
          <span style={{ fontSize: "0.55rem", opacity: 0.6, letterSpacing: "0.1em", fontWeight: 700 }}>DOUBLE</span>
          <span>BULL'S-EYE · 50</span>
        </button>
      </div>

      {/* ── Miss + Undo ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem" }}>
        <button
          onClick={onMiss}
          style={{
            padding: "0.7rem",
            borderRadius: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            cursor: "pointer",
            border: "1.5px solid rgba(255,0,92,0.3)",
            background: "rgba(255,0,92,0.08)",
            color: "rgba(255,0,92,0.85)",
            fontSize: "0.95rem",
            letterSpacing: "0.06em",
            minHeight: "48px",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}>
          MISS
        </button>
        <button
          onClick={onUndo}
          style={{
            padding: "0.7rem",
            borderRadius: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            cursor: "pointer",
            border: "1.5px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.5)",
            fontSize: "0.95rem",
            letterSpacing: "0.06em",
            minHeight: "48px",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}>
          ← UNDO
        </button>
      </div>
    </div>
  );
}

// ── VisitDarts display ─────────────────────────────────────────────────────────
export function VisitDarts({ darts, max = 3 }: { darts: Dart[]; max?: number }) {
  const slots = Array.from({ length: max }, (_, i) => darts[i]);
  const total = darts.reduce((s, d) => s + d.value, 0);
  const dartColor = (d: Dart) => {
    if (d.value === 0) return "#ff005c";
    if (d.multiplier === 3) return "#ff6b9d";
    if (d.multiplier === 2) return "#38bdf8";
    return "#fff";
  };
  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      {slots.map((d, i) => (
        <div key={i} style={{
          flex: 1,
          textAlign: "center",
          padding: "0.5rem",
          borderRadius: "0.5rem",
          border: d
            ? `1px solid ${d.value === 0 ? "rgba(255,0,92,0.3)" : d.multiplier === 3 ? "rgba(255,107,157,0.3)" : d.multiplier === 2 ? "rgba(56,189,248,0.3)" : "rgba(255,255,255,0.15)"}`
            : "1px dashed rgba(255,255,255,0.08)",
          background: d
            ? (d.value === 0 ? "rgba(255,0,92,0.06)" : d.multiplier === 3 ? "rgba(255,107,157,0.06)" : d.multiplier === 2 ? "rgba(56,189,248,0.06)" : "rgba(255,255,255,0.06)")
            : "rgba(255,255,255,0.02)",
          fontFamily: "Oswald, sans-serif",
        }}>
          {d ? (
            <>
              <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.3)" }}>D{i + 1}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: dartColor(d) }}>{d.label}</div>
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)" }}>{d.value}</div>
            </>
          ) : (
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.12)" }}>–</div>
          )}
        </div>
      ))}
      {darts.length > 0 && (
        <div style={{ textAlign: "right", paddingLeft: "0.3rem", minWidth: "2.5rem" }}>
          <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>TOTAL</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 900, fontFamily: "Oswald, sans-serif", color: "#ffd24a", lineHeight: 1 }}>{total}</div>
        </div>
      )}
    </div>
  );
}
