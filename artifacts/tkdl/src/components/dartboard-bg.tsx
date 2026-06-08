import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ── Context ────────────────────────────────────────────────────────────────────
type DartEntry = { id: number; label: string; x: number; y: number; tilt: number };
type Ctx = { hitDart: (label: string) => void; darts: DartEntry[] };

const DartHitCtx = createContext<Ctx>({ hitDart: () => {}, darts: [] });
export function useDartHit() { return useContext(DartHitCtx); }

// ── Board geometry (400×400 viewBox, centre 200,200) ──────────────────────────
const CX = 200, CY = 200;
const R_NUM_OUT = 178;
const R_NUM_IN  = 162;
const R_DBL_IN  = 149;
const R_TRB_OUT = 101;
const R_TRB_IN  = 89;
const R_BULL    = 28;
const R_DB      = 12;

const NUMS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const toRad = (d: number) => d * Math.PI / 180;

function slicePath(r1: number, r2: number, a0: number, a1: number) {
  const c0 = Math.cos(toRad(a0)), s0 = Math.sin(toRad(a0));
  const c1 = Math.cos(toRad(a1)), s1 = Math.sin(toRad(a1));
  return [
    `M${CX+r2*c0},${CY+r2*s0}`,
    `A${r2},${r2} 0 0,1 ${CX+r2*c1},${CY+r2*s1}`,
    `L${CX+r1*c1},${CY+r1*s1}`,
    `A${r1},${r1} 0 0,0 ${CX+r1*c0},${CY+r1*s0} Z`,
  ].join(" ");
}

// ── Map dart label → board coordinates ────────────────────────────────────────
function dartPos(label: string) {
  const jr = () => (Math.random() - 0.5) * 2;
  if (label === "DB") return { x: CX + jr()*4, y: CY + jr()*4 };
  if (label === "Bull") {
    const a = Math.random()*360, r = R_DB*1.4 + Math.random()*(R_BULL - R_DB*1.6);
    return { x: CX + r*Math.cos(toRad(a)), y: CY + r*Math.sin(toRad(a)) };
  }
  let mult = 1, ns = label;
  if (label[0]==="T") { mult=3; ns=label.slice(1); }
  else if (label[0]==="D") { mult=2; ns=label.slice(1); }
  const seg = parseInt(ns);
  const idx = NUMS.indexOf(seg);
  if (idx===-1) return { x: CX, y: CY };
  const ca = -90 + idx*18 + jr()*8;
  let r: number;
  if (mult===3)      r = (R_TRB_OUT+R_TRB_IN)/2 + jr()*3;
  else if (mult===2) r = (R_NUM_IN+R_DBL_IN)/2  + jr()*3;
  else               r = (R_DBL_IN+R_TRB_OUT)/2 + jr()*14;
  return { x: CX + r*Math.cos(toRad(ca)), y: CY + r*Math.sin(toRad(ca)) };
}

// ── Provider ───────────────────────────────────────────────────────────────────
let nextId = 1;

export function DartBoardProvider({ children }: { children: ReactNode }) {
  const [darts, setDarts] = useState<DartEntry[]>([]);

  const hitDart = useCallback((label: string) => {
    const { x, y } = dartPos(label);
    const tilt = (Math.random()>0.5?1:-1) * (3 + Math.random()*9);
    setDarts(prev => {
      const next = [...prev, { id: nextId++, label, x, y, tilt }];
      return next.length > 3 ? next.slice(next.length-3) : next;
    });
  }, []);

  return <DartHitCtx.Provider value={{ hitDart, darts }}>{children}</DartHitCtx.Provider>;
}

// ── Single dart SVG (tip at origin, body extends up) ─────────────────────────
const FLIGHT_COLS = ["#e85500","#1a6fe8","#22c55e"];

function DartShape({ x, y, tilt, idx }: { x: number; y: number; tilt: number; idx: number }) {
  const fc = FLIGHT_COLS[idx % FLIGHT_COLS.length];
  return (
    <g transform={`translate(${x},${y}) rotate(${tilt})`}>
      <g style={{ animation: "dartThrow 0.45s cubic-bezier(0.22,0.61,0.36,1) both" }}>
        <polygon points="0,0 -1.3,-8 1.3,-8" fill="#ddd"/>
        <rect x="-3" y="-20" width="6" height="12" rx="2.8" fill="#888"/>
        <rect x="-1.6" y="-19.5" width="1.8" height="10" rx="0.9" fill="rgba(255,255,255,0.32)"/>
        <line x1="-3" y1="-13" x2="3" y2="-13" stroke="#555" strokeWidth="0.8"/>
        <line x1="-3" y1="-15.5" x2="3" y2="-15.5" stroke="#555" strokeWidth="0.8"/>
        <line x1="0" y1="-20" x2="0" y2="-44" stroke="#5c4a36" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M0,-44 L-11,-61 L-0.6,-48 Z" fill={fc} opacity="0.93"/>
        <path d="M0,-44 L11,-61 L0.6,-48 Z" fill={fc} opacity="0.93"/>
        <line x1="0" y1="-44" x2="-11" y2="-61" stroke={fc} strokeWidth="0.6" opacity="0.4"/>
        <line x1="0" y1="-44" x2="11" y2="-61" stroke={fc} strokeWidth="0.6" opacity="0.4"/>
      </g>
    </g>
  );
}

// ── Dartboard SVG background + darts ─────────────────────────────────────────
export function DartboardBackground() {
  const { darts } = useDartHit();

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none", zIndex: 0, overflow: "hidden",
    }}>
      <svg
        viewBox="0 0 400 400"
        style={{ width: "min(80vw,370px)", height: "min(80vw,370px)" }}
      >
        <defs>
          <radialGradient id="bdGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.07)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
          </radialGradient>
        </defs>

        {/* Backing shadow */}
        <circle cx={CX} cy={CY} r={R_NUM_OUT+12} fill="#090909" opacity="0.55"/>

        {/* Board segments */}
        <g opacity="0.30">
          <circle cx={CX} cy={CY} r={R_NUM_OUT} fill="#0e0e0e"/>
          {NUMS.map((num, i) => {
            const a0 = -99+i*18, a1 = a0+18;
            const even = i%2===0;
            const sin = even ? "#1c1c1c" : "#ddd6be";
            const scr = even ? "#b41e1e" : "#1c6a36";
            return (
              <g key={num}>
                <path d={slicePath(R_NUM_IN, R_NUM_OUT, a0, a1)} fill={sin}/>
                <path d={slicePath(R_DBL_IN, R_NUM_IN, a0, a1)} fill={scr}/>
                <path d={slicePath(R_TRB_OUT, R_DBL_IN, a0, a1)} fill={sin}/>
                <path d={slicePath(R_TRB_IN, R_TRB_OUT, a0, a1)} fill={scr}/>
                <path d={slicePath(R_BULL, R_TRB_IN, a0, a1)} fill={sin}/>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={R_BULL} fill="#b41e1e"/>
          <circle cx={CX} cy={CY} r={R_DB}   fill="#1c6a36"/>

          {/* Spider — concentric rings */}
          {[R_NUM_IN, R_DBL_IN, R_TRB_OUT, R_TRB_IN, R_BULL, R_DB].map(r => (
            <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="#282828" strokeWidth="0.9"/>
          ))}

          {/* Spider — radial wires */}
          {NUMS.map((_, i) => {
            const a = toRad(-99+i*18);
            return (
              <line key={i}
                x1={CX+R_BULL*Math.cos(a)} y1={CY+R_BULL*Math.sin(a)}
                x2={CX+R_NUM_OUT*Math.cos(a)} y2={CY+R_NUM_OUT*Math.sin(a)}
                stroke="#282828" strokeWidth="0.9"
              />
            );
          })}

          {/* Numbers */}
          {NUMS.map((num, i) => {
            const a = toRad(-90+i*18), r = R_NUM_OUT-12;
            return (
              <text key={num}
                x={CX+r*Math.cos(a)} y={CY+r*Math.sin(a)}
                textAnchor="middle" dominantBaseline="central"
                fill="#ddd6be" fontSize="13" fontWeight="700"
                fontFamily="Oswald, sans-serif"
              >{num}</text>
            );
          })}
        </g>

        {/* Subtle centre glow */}
        <circle cx={CX} cy={CY} r={R_NUM_OUT} fill="url(#bdGlow)" opacity="0.5"/>

        {/* Darts — higher opacity so they pop */}
        <g opacity="0.90">
          {darts.map((d, i) => (
            <DartShape key={d.id} x={d.x} y={d.y} tilt={d.tilt} idx={i}/>
          ))}
        </g>
      </svg>
    </div>
  );
}
