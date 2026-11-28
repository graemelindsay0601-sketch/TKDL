// Boss portraits: original SVG faces, ten styles, coloured per boss.
import type React from "react";
// `mood` animates them: hurt shakes, angry glows (phase 3), beaten greys out.
import type { PortraitSpec } from "@/lib/boss-battles-data";
import "./boss.css";

export function BossPortrait({ spec, size = 96, mood = "idle", id }: { spec: PortraitSpec; size?: number; mood?: "idle" | "hurt" | "angry" | "beaten" | "talk"; id: string }) {
  const { primary: p, secondary: s, eye: e } = spec;
  const g = `bp-${id}`;
  const eyes = (y: number, gap = 18, r = 6) => (
    <g className="bp-eyes">
      <ellipse cx={60 - gap} cy={y} rx={r + 2} ry={r} fill={e} filter={`url(#${g}-glow)`} />
      <ellipse cx={60 + gap} cy={y} rx={r + 2} ry={r} fill={e} filter={`url(#${g}-glow)`} />
      <circle cx={60 - gap} cy={y} r={r * 0.4} fill={s} /><circle cx={60 + gap} cy={y} r={r * 0.4} fill={s} />
    </g>
  );
  const angryBrows = (y: number, gap = 18) => (
    <g stroke={s} strokeWidth={4} strokeLinecap="round">
      <line x1={60 - gap - 10} y1={y - 4} x2={60 - gap + 8} y2={y + 2} /><line x1={60 + gap + 10} y1={y - 4} x2={60 + gap - 8} y2={y + 2} />
    </g>
  );
  let face: React.ReactElement;
  switch (spec.face) {
    case "brick":
      face = (<g>
        <rect x={22} y={22} width={76} height={80} rx={6} fill={`url(#${g}-fill)`} />
        {[34, 50, 66, 82].map((y, i) => <line key={y} x1={22} y1={y} x2={98} y2={y} stroke={s} strokeWidth={2} opacity={0.7} />)}
        {[[40, 22, 34], [70, 22, 34], [55, 34, 50], [85, 34, 50], [40, 66, 82], [70, 66, 82], [55, 82, 102], [85, 82, 102], [30, 82, 102]].map(([x, a, b], i) => <line key={i} x1={x} y1={a} x2={x} y2={b} stroke={s} strokeWidth={2} opacity={0.6} />)}
        {eyes(52, 17, 5)}{angryBrows(46, 17)}
        <rect x={42} y={72} width={36} height={6} rx={2} fill={s} />
      </g>); break;
    case "hood":
      face = (<g>
        <path d="M60 10 C 24 14 14 50 18 108 L 102 108 C 106 50 96 14 60 10 Z" fill={`url(#${g}-fill)`} />
        <path d="M60 30 C 38 32 32 56 34 96 L 86 96 C 88 56 82 32 60 30 Z" fill="#05030a" />
        {eyes(62, 13, 4.5)}
        <path d="M48 82 Q60 76 72 82" stroke={e} strokeWidth={2} fill="none" opacity={0.6} />
      </g>); break;
    case "skull":
      face = (<g>
        <path d="M60 14 C 28 14 18 40 22 66 C 24 78 32 82 36 84 L 38 100 L 82 100 L 84 84 C 88 82 96 78 98 66 C 102 40 92 14 60 14 Z" fill={`url(#${g}-fill)`} />
        <path d="M30 56 Q42 44 54 56 Q44 70 30 56 Z M66 56 Q78 44 90 56 Q76 70 66 56 Z" fill="#05030a" />
        <ellipse cx={42} cy={58} rx={4} ry={4} fill={e} filter={`url(#${g}-glow)`} className="bp-eyes" /><ellipse cx={78} cy={58} rx={4} ry={4} fill={e} filter={`url(#${g}-glow)`} className="bp-eyes" />
        <path d="M60 66 L54 78 L66 78 Z" fill="#05030a" />
        {[46, 54, 62, 70].map(x => <rect key={x} x={x} y={86} width={5} height={12} fill={s} />)}
      </g>); break;
    case "crown":
      face = (<g>
        <circle cx={60} cy={66} r={36} fill={`url(#${g}-fill)`} />
        <path d="M30 40 L36 14 L48 30 L60 8 L72 30 L84 14 L90 40 Z" fill={e} stroke={s} strokeWidth={2} />
        <circle cx={60} cy={22} r={3.5} fill={s} />
        {eyes(64, 14, 5)}{angryBrows(57, 14)}
        <path d="M46 84 Q60 94 74 84" stroke={s} strokeWidth={4} fill="none" strokeLinecap="round" />
      </g>); break;
    case "visor":
      face = (<g>
        <path d="M24 34 Q60 6 96 34 L96 96 Q60 112 24 96 Z" fill={`url(#${g}-fill)`} />
        <rect x={28} y={50} width={64} height={18} rx={9} fill="#05030a" />
        <rect x={32} y={55} width={56} height={8} rx={4} fill={e} filter={`url(#${g}-glow)`} className="bp-eyes bp-scan" />
        {[36, 48, 60, 72, 84].map(x => <rect key={x} x={x - 2} y={80} width={4} height={12} rx={2} fill={s} />)}
      </g>); break;
    case "mask":
      face = (<g>
        <path d="M60 14 C 30 14 22 40 24 64 C 26 92 44 106 60 106 C 76 106 94 92 96 64 C 98 40 90 14 60 14 Z" fill={`url(#${g}-fill)`} />
        <path d="M60 14 L60 106" stroke={s} strokeWidth={2} opacity={0.5} />
        <path d="M32 54 L52 50 L52 62 L34 62 Z M88 54 L68 50 L68 62 L86 62 Z" fill="#05030a" />
        <circle cx={44} cy={57} r={3.5} fill={e} filter={`url(#${g}-glow)`} className="bp-eyes" /><circle cx={76} cy={57} r={3.5} fill={e} filter={`url(#${g}-glow)`} className="bp-eyes" />
        <path d="M44 84 L76 84" stroke={s} strokeWidth={4} strokeLinecap="round" />
      </g>); break;
    case "horns":
      face = (<g>
        <path d="M30 40 C 16 30 12 12 16 4 C 24 16 32 22 42 26 Z M90 40 C 104 30 108 12 104 4 C 96 16 88 22 78 26 Z" fill={e} opacity={0.85} />
        <path d="M60 20 C 32 20 24 44 26 66 C 28 90 44 104 60 104 C 76 104 92 90 94 66 C 96 44 88 20 60 20 Z" fill={`url(#${g}-fill)`} />
        <rect x={56} y={20} width={8} height={40} fill={s} opacity={0.6} />
        {eyes(62, 16, 5)}{angryBrows(55, 16)}
        <path d="M44 86 L52 82 L60 88 L68 82 L76 86" stroke={s} strokeWidth={3} fill="none" />
      </g>); break;
    case "cyclops":
      face = (<g>
        <circle cx={60} cy={62} r={40} fill={`url(#${g}-fill)`} />
        <circle cx={60} cy={56} r={18} fill="#05030a" />
        <circle cx={60} cy={56} r={13} fill={e} filter={`url(#${g}-glow)`} className="bp-eyes" />
        <circle cx={60} cy={56} r={5} fill={s} />
        <path d="M44 86 Q60 80 76 86" stroke={s} strokeWidth={3} fill="none" />
      </g>); break;
    case "screen":
      face = (<g>
        <rect x={20} y={24} width={80} height={66} rx={10} fill={`url(#${g}-fill)`} />
        <rect x={27} y={31} width={66} height={52} rx={6} fill="#05030a" />
        <rect x={38} y={46} width={12} height={10} rx={2} fill={e} filter={`url(#${g}-glow)`} className="bp-eyes" />
        <rect x={70} y={46} width={12} height={10} rx={2} fill={e} filter={`url(#${g}-glow)`} className="bp-eyes" />
        <path d="M44 70 L76 70" stroke={e} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
        <rect x={50} y={90} width={20} height={10} fill={s} /><rect x={38} y={100} width={44} height={6} rx={3} fill={s} />
      </g>); break;
    case "void":
    default:
      face = (<g>
        <circle cx={60} cy={60} r={44} fill={`url(#${g}-void)`} />
        <circle cx={60} cy={60} r={44} fill="none" stroke={p} strokeWidth={2} opacity={0.5} className="bp-ring" />
        <circle cx={60} cy={60} r={32} fill="none" stroke={e} strokeWidth={1} opacity={0.3} strokeDasharray="4 6" className="bp-ring rev" />
        {eyes(56, 15, 4)}
        <path d="M48 76 Q60 84 72 76" stroke={e} strokeWidth={2} fill="none" opacity={0.7} />
      </g>);
  }
  return (
    <svg className={`bp bp-${mood}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Boss portrait">
      <defs>
        <radialGradient id={`${g}-bg`} cx="50%" cy="40%" r="70%"><stop offset="0%" stopColor={p} stopOpacity={0.55} /><stop offset="100%" stopColor="#05030a" stopOpacity={0} /></radialGradient>
        <linearGradient id={`${g}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={p} /><stop offset="100%" stopColor={s} /></linearGradient>
        <radialGradient id={`${g}-void`} cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#000" /><stop offset="80%" stopColor={s} /><stop offset="100%" stopColor={p} /></radialGradient>
        <filter id={`${g}-glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <circle cx={60} cy={60} r={58} fill={`url(#${g}-bg)`} />
      <g className="bp-face">{face}</g>
    </svg>
  );
}
