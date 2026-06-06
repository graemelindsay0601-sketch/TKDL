import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type Dart = {
  segment: number;   // 1-20, 25 for bull/db, 0 for miss
  multiplier: 1 | 2 | 3;
  value: number;     // actual score
  label: string;     // "T20", "D5", "Bull", "DB", "Miss"
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

// ── DartInputBoard ─────────────────────────────────────────────────────────────
// highlightSegments: these numbers glow (e.g. current sequence target)
// activeSegments: only these are clickable (others dimmed). undefined = all active
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
  const [mode, setMode] = useState<1 | 2 | 3>(1);

  const hit = (seg: number, forceMult?: 1 | 2 | 3) => {
    if (disabled) return;
    const m = forceMult ?? (seg === 25 && mode === 3 ? 1 : mode);
    let val: number;
    let label: string;
    if (seg === 0) { val = 0; label = "Miss"; }
    else if (seg === 25) {
      val = m === 2 ? 50 : 25;
      label = m === 2 ? "DB" : "Bull";
    } else {
      val = seg * m;
      label = m === 1 ? `${seg}` : m === 2 ? `D${seg}` : `T${seg}`;
    }
    onDart({ segment: seg, multiplier: m as 1 | 2 | 3, value: val, label });
    setMode(1);
  };

  const nums = Array.from({ length: 20 }, (_, i) => i + 1);
  const isActive  = (n: number) => !activeSegments || activeSegments.includes(n);
  const isHigh    = (n: number) => !!highlightSegments?.includes(n);

  const numLabel  = (n: number) =>
    mode === 1 ? `${n}` : mode === 2 ? `D${n}` : `T${n}`;
  const numValue  = (n: number) => mode === 1 ? n : mode === 2 ? n*2 : n*3;

  const modeBtn = (m: 1|2|3, label: string, color: string) => (
    <button
      key={m}
      onClick={() => setMode(m)}
      style={{
        flex: 1,
        padding: "0.6rem 0",
        borderRadius: "0.5rem",
        fontFamily: "Oswald, sans-serif",
        fontWeight: 700,
        fontSize: "0.85rem",
        letterSpacing: "0.1em",
        cursor: "pointer",
        border: mode === m ? `1.5px solid ${color}` : "1px solid rgba(255,255,255,0.08)",
        background: mode === m ? `${color}22` : "rgba(255,255,255,0.03)",
        color: mode === m ? color : "rgba(255,255,255,0.3)",
        transition: "all 0.12s",
      }}>
      {label}
    </button>
  );

  const numBtnStyle = (n: number): React.CSSProperties => {
    const active = isActive(n);
    const hi = isHigh(n);
    return {
      padding: "0.55rem 0",
      borderRadius: "0.45rem",
      fontFamily: "Oswald, sans-serif",
      fontWeight: hi ? 900 : 700,
      fontSize: "0.78rem",
      cursor: active ? "pointer" : "not-allowed",
      border: hi
        ? "1.5px solid #ffd24a"
        : active
        ? "1px solid rgba(255,255,255,0.1)"
        : "1px solid rgba(255,255,255,0.04)",
      background: hi
        ? "rgba(255,210,74,0.15)"
        : active
        ? mode === 2 ? "rgba(56,189,248,0.08)" : mode === 3 ? "rgba(255,0,92,0.08)" : "rgba(255,255,255,0.05)"
        : "rgba(255,255,255,0.015)",
      color: hi
        ? "#ffd24a"
        : active
        ? mode === 2 ? "#38bdf8" : mode === 3 ? "#ff6b9d" : "rgba(255,255,255,0.85)"
        : "rgba(255,255,255,0.15)",
      transition: "all 0.1s",
    };
  };

  return (
    <div style={{ opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? "none" : undefined }}>
      {/* Modifier row */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
        {modeBtn(1, "SINGLE", "rgba(255,255,255,0.7)")}
        {modeBtn(2, "DOUBLE", "#38bdf8")}
        {modeBtn(3, "TREBLE", "#ff6b9d")}
      </div>

      {/* Numbers 1-10 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: "0.3rem", marginBottom: "0.3rem" }}>
        {nums.slice(0,10).map(n => (
          <button key={n} onClick={() => isActive(n) && hit(n)} style={numBtnStyle(n)}>
            <div style={{ fontSize: "0.65rem", opacity: 0.5 }}>{numLabel(n)}</div>
            <div>{numValue(n)}</div>
          </button>
        ))}
      </div>

      {/* Numbers 11-20 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: "0.3rem", marginBottom: "0.5rem" }}>
        {nums.slice(10,20).map(n => (
          <button key={n} onClick={() => isActive(n) && hit(n)} style={numBtnStyle(n)}>
            <div style={{ fontSize: "0.65rem", opacity: 0.5 }}>{numLabel(n)}</div>
            <div>{numValue(n)}</div>
          </button>
        ))}
      </div>

      {/* Bull row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <button
          onClick={() => hit(25, 1)}
          style={{
            padding: "0.65rem",
            borderRadius: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            cursor: "pointer",
            border: isHigh(25) ? "1.5px solid #ffd24a" : "1px solid rgba(34,197,94,0.3)",
            background: isHigh(25) ? "rgba(255,210,74,0.15)" : "rgba(34,197,94,0.08)",
            color: isHigh(25) ? "#ffd24a" : "#22c55e",
            fontSize: "0.85rem",
          }}>
          BULL · 25
        </button>
        <button
          onClick={() => hit(25, 2)}
          style={{
            padding: "0.65rem",
            borderRadius: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            cursor: "pointer",
            border: "1px solid rgba(56,189,248,0.3)",
            background: "rgba(56,189,248,0.08)",
            color: "#38bdf8",
            fontSize: "0.85rem",
          }}>
          BULL'S-EYE · 50
        </button>
      </div>

      {/* Miss + Undo */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        <button onClick={onMiss}
          style={{
            padding: "0.65rem",
            borderRadius: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            cursor: "pointer",
            border: "1px solid rgba(255,0,92,0.25)",
            background: "rgba(255,0,92,0.06)",
            color: "rgba(255,0,92,0.7)",
            fontSize: "0.85rem",
          }}>
          MISS
        </button>
        <button onClick={onUndo}
          style={{
            padding: "0.65rem",
            borderRadius: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            color: "rgba(255,255,255,0.35)",
            fontSize: "0.85rem",
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
  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      {slots.map((d, i) => (
        <div key={i} style={{
          flex: 1,
          textAlign: "center",
          padding: "0.45rem",
          borderRadius: "0.5rem",
          border: d ? "1px solid rgba(255,255,255,0.15)" : "1px dashed rgba(255,255,255,0.08)",
          background: d ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
          fontFamily: "Oswald, sans-serif",
        }}>
          {d ? (
            <>
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)" }}>D{i+1}</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: d.value === 0 ? "#ff005c" : "#fff" }}>{d.label}</div>
              <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>{d.value}pts</div>
            </>
          ) : (
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.15)" }}>–</div>
          )}
        </div>
      ))}
      {darts.length > 0 && (
        <div style={{ textAlign: "right", paddingLeft: "0.3rem" }}>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>TOTAL</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 900, fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>{total}</div>
        </div>
      )}
    </div>
  );
}
