import { useState } from "react";

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

// Numbers arranged high-to-low, 5 per row (20 down to 1)
const GRID_NUMS = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

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
  const hit = (seg: number, mult: 1 | 2 | 3) => {
    if (disabled) return;
    let val: number;
    let label: string;
    if (seg === 25) {
      val = mult === 2 ? 50 : 25;
      label = mult === 2 ? "DB" : "Bull";
    } else {
      val = seg * mult;
      label = mult === 1 ? `${seg}` : mult === 2 ? `D${seg}` : `T${seg}`;
    }
    onDart({ segment: seg, multiplier: mult, value: val, label });
  };

  const isActive  = (n: number) => !activeSegments || activeSegments.includes(n);
  const isHigh    = (n: number) => !!highlightSegments?.includes(n);

  // Each number cell with single/double/treble as adjacent tap zones
  const renderCell = (n: number) => {
    const active = isActive(n);
    const hi = isHigh(n);
    const cellBg = hi
      ? "rgba(255,210,74,0.10)"
      : active
      ? "rgba(255,255,255,0.03)"
      : "rgba(255,255,255,0.01)";
    const cellBorder = hi
      ? "1px solid rgba(255,210,74,0.4)"
      : active
      ? "1px solid rgba(255,255,255,0.08)"
      : "1px solid rgba(255,255,255,0.03)";

    const subBtn = (mult: 1|2|3, val: number, label: string, color: string, bg: string) => (
      <button
        key={mult}
        onClick={() => active && hit(n, mult)}
        title={label}
        style={{
          flex: 1,
          padding: "0.3rem 0",
          border: "none",
          borderRadius: "0.25rem",
          background: active ? bg : "transparent",
          color: active ? color : "rgba(255,255,255,0.1)",
          fontFamily: "Oswald, sans-serif",
          fontWeight: 800,
          fontSize: "0.72rem",
          cursor: active ? "pointer" : "default",
          lineHeight: 1,
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          gap: "1px",
          transition: "background 0.1s",
          minWidth: 0,
        }}>
        <span style={{ fontSize: "0.5rem", opacity: 0.55, fontWeight: 600, letterSpacing: "0.05em" }}>
          {mult === 1 ? "S" : mult === 2 ? "D" : "T"}
        </span>
        <span>{val}</span>
      </button>
    );

    return (
      <div key={n} style={{
        background: cellBg,
        border: cellBorder,
        borderRadius: "0.45rem",
        overflow: "hidden",
        opacity: active ? 1 : 0.3,
      }}>
        {/* Number label */}
        <div style={{
          textAlign: "center",
          fontSize: "0.5rem",
          fontWeight: 700,
          fontFamily: "Oswald, sans-serif",
          color: hi ? "#ffd24a" : active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
          padding: "0.2rem 0 0.1rem",
          letterSpacing: "0.05em",
        }}>
          {n}
        </div>
        {/* S | D | T buttons */}
        <div style={{ display: "flex", gap: "1px", padding: "0 2px 2px" }}>
          {subBtn(1, n,    `${n}`,   "rgba(255,255,255,0.85)", "rgba(255,255,255,0.06)")}
          {subBtn(2, n*2, `D${n}`,  "#38bdf8",               "rgba(56,189,248,0.10)")}
          {subBtn(3, n*3, `T${n}`,  "#ff6b9d",               "rgba(255,107,157,0.10)")}
        </div>
      </div>
    );
  };

  return (
    <div style={{ opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? "none" : undefined, userSelect: "none" }}>

      {/* Multiplier legend */}
      <div style={{
        display: "flex",
        gap: "0.75rem",
        justifyContent: "center",
        marginBottom: "0.4rem",
        fontSize: "0.6rem",
        fontFamily: "Oswald, sans-serif",
        color: "rgba(255,255,255,0.3)",
        letterSpacing: "0.08em",
      }}>
        <span style={{ color: "rgba(255,255,255,0.55)" }}>S = Single</span>
        <span style={{ color: "#38bdf8" }}>D = Double</span>
        <span style={{ color: "#ff6b9d" }}>T = Treble</span>
      </div>

      {/* 5-column number grid, 20 down to 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0.25rem", marginBottom: "0.35rem" }}>
        {GRID_NUMS.map(renderCell)}
      </div>

      {/* Bull row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem", marginBottom: "0.35rem" }}>
        <button
          onClick={() => hit(25, 1)}
          style={{
            padding: "0.6rem 0",
            borderRadius: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 800,
            cursor: "pointer",
            border: isHigh(25) ? "1.5px solid #ffd24a" : "1px solid rgba(34,197,94,0.35)",
            background: isHigh(25) ? "rgba(255,210,74,0.15)" : "rgba(34,197,94,0.10)",
            color: isHigh(25) ? "#ffd24a" : "#22c55e",
            fontSize: "0.82rem",
            lineHeight: 1,
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            gap: "2px",
          }}>
          <span style={{ fontSize: "0.55rem", opacity: 0.65, fontWeight: 600 }}>SINGLE</span>
          <span>BULL · 25</span>
        </button>
        <button
          onClick={() => hit(25, 2)}
          style={{
            padding: "0.6rem 0",
            borderRadius: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 800,
            cursor: "pointer",
            border: "1px solid rgba(56,189,248,0.35)",
            background: "rgba(56,189,248,0.10)",
            color: "#38bdf8",
            fontSize: "0.82rem",
            lineHeight: 1,
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            gap: "2px",
          }}>
          <span style={{ fontSize: "0.55rem", opacity: 0.65, fontWeight: 600 }}>DOUBLE</span>
          <span>BULL'S-EYE · 50</span>
        </button>
      </div>

      {/* Miss + Undo */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
        <button
          onClick={onMiss}
          style={{
            padding: "0.65rem",
            borderRadius: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            cursor: "pointer",
            border: "1px solid rgba(255,0,92,0.25)",
            background: "rgba(255,0,92,0.07)",
            color: "rgba(255,0,92,0.8)",
            fontSize: "0.85rem",
          }}>
          MISS
        </button>
        <button
          onClick={onUndo}
          style={{
            padding: "0.65rem",
            borderRadius: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            color: "rgba(255,255,255,0.4)",
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
          padding: "0.45rem",
          borderRadius: "0.5rem",
          border: d ? `1px solid ${d.value === 0 ? "rgba(255,0,92,0.3)" : d.multiplier === 3 ? "rgba(255,107,157,0.3)" : d.multiplier === 2 ? "rgba(56,189,248,0.3)" : "rgba(255,255,255,0.15)"}` : "1px dashed rgba(255,255,255,0.08)",
          background: d ? (d.value === 0 ? "rgba(255,0,92,0.06)" : d.multiplier === 3 ? "rgba(255,107,157,0.06)" : d.multiplier === 2 ? "rgba(56,189,248,0.06)" : "rgba(255,255,255,0.06)") : "rgba(255,255,255,0.02)",
          fontFamily: "Oswald, sans-serif",
        }}>
          {d ? (
            <>
              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)" }}>D{i+1}</div>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: dartColor(d) }}>{d.label}</div>
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)" }}>{d.value}pts</div>
            </>
          ) : (
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.12)" }}>–</div>
          )}
        </div>
      ))}
      {darts.length > 0 && (
        <div style={{ textAlign: "right", paddingLeft: "0.3rem", minWidth: "2.5rem" }}>
          <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>TOTAL</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, fontFamily: "Oswald, sans-serif", color: "#ffd24a", lineHeight: 1 }}>{total}</div>
        </div>
      )}
    </div>
  );
}
