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
    const tilt = (Math.random()>0.5?1:-1) * (4 + Math.random()*10);
    setDarts(prev => {
      const next = [...prev, { id: nextId++, label, x, y, tilt }];
      return next.length > 3 ? next.slice(next.length-3) : next;
    });
  }, []);

  return <DartHitCtx.Provider value={{ hitDart, darts }}>{children}</DartHitCtx.Provider>;
}

// ── Realistic steel-tip dart (tip at origin, body extends upward / negative Y) ─
// Anatomy: steel-tip → point → barrel (tungsten) with knurling → shaft → flights
const FLIGHT_COLS = ["#e85500","#1a6fe8","#22c55e"];

function DartShape({ x, y, tilt, idx }: { x: number; y: number; tilt: number; idx: number }) {
  const fc = FLIGHT_COLS[idx % FLIGHT_COLS.length];
  const fcDark = fc; // flight accent
  return (
    <g transform={`translate(${x},${y}) rotate(${tilt})`}>
      <g style={{ animation: "dartThrow 0.45s cubic-bezier(0.22,0.61,0.36,1) both" }}>

        {/* ── STEEL TIP — needle-sharp point ── */}
        <path d="M0,0 L-1.2,-6 L1.2,-6 Z" fill="#d8d8d8"/>
        <path d="M0,0 L0,-6" stroke="#ffffff" strokeWidth="0.4" opacity="0.55"/>

        {/* ── POINT — thin metal rod ── */}
        <rect x="-0.9" y="-12" width="1.8" height="6" rx="0.4" fill="#b0b0b0"/>
        <rect x="-0.3" y="-12" width="0.5" height="6" fill="rgba(255,255,255,0.3)"/>

        {/* ── BARREL FRONT TAPER ── */}
        <path d="M-1.2,-12 L-4.2,-16 L4.2,-16 L1.2,-12 Z" fill="#606060"/>
        <path d="M-1.2,-12 L-1.8,-14.5 L-0.5,-14.5 L-0.2,-12 Z" fill="rgba(255,255,255,0.18)"/>

        {/* ── BARREL BODY (tungsten) ── */}
        <rect x="-4.2" y="-27" width="8.4" height="11" fill="#505050"/>
        {/* Left specular highlight */}
        <rect x="-4.2" y="-27" width="2.0" height="11" rx="0.3" fill="rgba(255,255,255,0.13)"/>
        {/* Right shadow */}
        <rect x="2.8"  y="-27" width="1.4" height="11" rx="0.3" fill="rgba(0,0,0,0.25)"/>
        {/* Knurling grooves */}
        <line x1="-4.0" y1="-17.2" x2="4.0" y2="-17.2" stroke="#252525" strokeWidth="0.9"/>
        <line x1="-4.1" y1="-19.4" x2="4.1" y2="-19.4" stroke="#252525" strokeWidth="0.9"/>
        <line x1="-4.1" y1="-21.6" x2="4.1" y2="-21.6" stroke="#252525" strokeWidth="0.9"/>
        <line x1="-4.1" y1="-23.8" x2="4.1" y2="-23.8" stroke="#252525" strokeWidth="0.9"/>
        <line x1="-4.0" y1="-25.8" x2="4.0" y2="-25.8" stroke="#252525" strokeWidth="0.9"/>
        {/* Knurling ridges (lighter lines between grooves) */}
        <line x1="-4.0" y1="-18.3" x2="4.0" y2="-18.3" stroke="#686868" strokeWidth="0.4" opacity="0.6"/>
        <line x1="-4.1" y1="-20.5" x2="4.1" y2="-20.5" stroke="#686868" strokeWidth="0.4" opacity="0.6"/>
        <line x1="-4.1" y1="-22.7" x2="4.1" y2="-22.7" stroke="#686868" strokeWidth="0.4" opacity="0.6"/>
        <line x1="-4.0" y1="-24.8" x2="4.0" y2="-24.8" stroke="#686868" strokeWidth="0.4" opacity="0.6"/>

        {/* ── BARREL REAR TAPER ── */}
        <path d="M-4.2,-27 L-1.8,-31.5 L1.8,-31.5 L4.2,-27 Z" fill="#404040"/>
        <path d="M-4.2,-27 L-3.2,-29 L-1.5,-29 L-1.8,-31.5 Z" fill="rgba(255,255,255,0.1)"/>

        {/* ── SHAFT CONNECTOR (locking collar) ── */}
        <rect x="-2.2" y="-35" width="4.4" height="3.5" rx="1" fill="#2a2a2a"/>
        <rect x="-2.2" y="-35" width="1.2" height="3.5" rx="0.5" fill="rgba(255,255,255,0.08)"/>

        {/* ── SHAFT (slim nylon/aluminium rod) ── */}
        <rect x="-1.4" y="-46" width="2.8" height="11" rx="1" fill="#1e1e1e"/>
        <rect x="-1.4" y="-46" width="0.8" height="11" rx="0.5" fill="rgba(255,255,255,0.07)"/>

        {/* ── FLIGHTS — realistic kite-wing shape ── */}
        {/* Left wing: concave-edged kite */}
        <path
          d={`M-1,-46 C-5,-50 -14,-60 -13,-62 C-11,-64 -2.5,-53 -1,-47 Z`}
          fill={fcDark} opacity="0.93"
        />
        {/* Left wing inner sheen */}
        <path
          d={`M-1,-46 C-3,-49 -8,-57 -7.5,-59 C-6,-60.5 -1.5,-51 -1,-47 Z`}
          fill="rgba(255,255,255,0.18)"
        />
        {/* Right wing */}
        <path
          d={`M1,-46 C5,-50 14,-60 13,-62 C11,-64 2.5,-53 1,-47 Z`}
          fill={fcDark} opacity="0.93"
        />
        {/* Right wing inner sheen */}
        <path
          d={`M1,-46 C3,-49 8,-57 7.5,-59 C6,-60.5 1.5,-51 1,-47 Z`}
          fill="rgba(255,255,255,0.18)"
        />
        {/* Flight spine veins */}
        <line x1="-1" y1="-46" x2="-13" y2="-62" stroke={fcDark} strokeWidth="0.6" opacity="0.55"/>
        <line x1="1"  y1="-46" x2="13"  y2="-62" stroke={fcDark} strokeWidth="0.6" opacity="0.55"/>
        {/* Secondary vein lines on flights */}
        <line x1="-1" y1="-47" x2="-8"  y2="-58" stroke="rgba(255,255,255,0.18)" strokeWidth="0.4"/>
        <line x1="1"  y1="-47" x2="8"   y2="-58" stroke="rgba(255,255,255,0.18)" strokeWidth="0.4"/>

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
        style={{ width: "min(82vw,390px)", height: "min(82vw,390px)" }}
      >
        <defs>
          <radialGradient id="bdGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.09)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
          </radialGradient>
          <radialGradient id="bdEdge" cx="50%" cy="50%" r="50%">
            <stop offset="75%" stopColor="rgba(0,0,0,0)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)"/>
          </radialGradient>
          {/* Spider wire filter for slight glow */}
          <filter id="spiderGlow">
            <feGaussianBlur stdDeviation="0.4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Wooden surround / backing */}
        <circle cx={CX} cy={CY} r={R_NUM_OUT+16} fill="#1a1008"/>
        <circle cx={CX} cy={CY} r={R_NUM_OUT+16} fill="url(#bdEdge)"/>
        {/* Thin metal band at board edge */}
        <circle cx={CX} cy={CY} r={R_NUM_OUT+1} fill="none" stroke="#555" strokeWidth="2.5"/>

        {/* ── BOARD SEGMENTS (raised opacity for realistic look) ── */}
        <g opacity="0.72">
          {/* Number surround ring (black/cream alternating) */}
          <circle cx={CX} cy={CY} r={R_NUM_OUT} fill="#111"/>
          {NUMS.map((num, i) => {
            const a0 = -99+i*18, a1 = a0+18;
            const even = i%2===0;
            const sinColor  = even ? "#1a1a1a" : "#e8dfc8";   // black / cream
            const scrColor  = even ? "#c41e1e" : "#166b36";   // red / green scoring rings
            return (
              <g key={num}>
                {/* Outer number band */}
                <path d={slicePath(R_NUM_IN, R_NUM_OUT, a0, a1)} fill={sinColor}/>
                {/* Double ring */}
                <path d={slicePath(R_DBL_IN, R_NUM_IN, a0, a1)} fill={scrColor}/>
                {/* Large scoring area */}
                <path d={slicePath(R_TRB_OUT, R_DBL_IN, a0, a1)} fill={sinColor}/>
                {/* Triple ring */}
                <path d={slicePath(R_TRB_IN, R_TRB_OUT, a0, a1)} fill={scrColor}/>
                {/* Inner scoring area */}
                <path d={slicePath(R_BULL, R_TRB_IN, a0, a1)} fill={sinColor}/>
              </g>
            );
          })}

          {/* Bullseye rings */}
          <circle cx={CX} cy={CY} r={R_BULL} fill="#c41e1e"/>
          <circle cx={CX} cy={CY} r={R_DB}   fill="#166b36"/>
          {/* Bullseye highlight */}
          <circle cx={CX-2} cy={CY-2} r={R_DB*0.55} fill="rgba(255,255,255,0.12)"/>

          {/* ── Spider wires (thin bright metal look) ── */}
          <g filter="url(#spiderGlow)">
            {/* Concentric ring wires */}
            {[R_NUM_IN, R_DBL_IN, R_TRB_OUT, R_TRB_IN, R_BULL, R_DB].map(r => (
              <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="#666" strokeWidth="1.1"/>
            ))}
            {/* Radial segment wires */}
            {NUMS.map((_, i) => {
              const a = toRad(-99+i*18);
              return (
                <line key={i}
                  x1={CX+R_BULL*Math.cos(a)} y1={CY+R_BULL*Math.sin(a)}
                  x2={CX+R_NUM_OUT*Math.cos(a)} y2={CY+R_NUM_OUT*Math.sin(a)}
                  stroke="#666" strokeWidth="1.1"
                />
              );
            })}
          </g>

          {/* ── Score numbers (bright white/cream) ── */}
          {NUMS.map((num, i) => {
            const a = toRad(-90+i*18), r = R_NUM_OUT-13;
            return (
              <text key={num}
                x={CX+r*Math.cos(a)} y={CY+r*Math.sin(a)}
                textAnchor="middle" dominantBaseline="central"
                fill="#f0e8d0" fontSize="13.5" fontWeight="700"
                fontFamily="Oswald, sans-serif"
                style={{ textShadow: "0 0 4px rgba(0,0,0,0.8)" }}
              >{num}</text>
            );
          })}
        </g>

        {/* Subtle centre glow overlay */}
        <circle cx={CX} cy={CY} r={R_NUM_OUT} fill="url(#bdGlow)" opacity="0.6"/>

        {/* ── DARTS ── */}
        <g opacity="0.97">
          {darts.map((d, i) => (
            <DartShape key={d.id} x={d.x} y={d.y} tilt={d.tilt} idx={i}/>
          ))}
        </g>
      </svg>
    </div>
  );
}
