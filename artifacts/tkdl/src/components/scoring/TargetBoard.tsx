// A small dartboard that lights up the bed a player is aiming at.
// Used by the premium scorer for Around the World (and any sequence game
// that wants it): the current number glows, and the 25 / bullseye light up
// on their own when those are the target.

const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Board radii on a 0–100 scale (regulation proportions, numbers ring outside).
const R = { bull: 4, outerBull: 9.5, trebleIn: 56, trebleOut: 62, doubleIn: 94, doubleOut: 100 };

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

function wedge(r1: number, r2: number, a1: number, a2: number) {
  const [x1, y1] = polar(r2, a1), [x2, y2] = polar(r2, a2);
  const [x3, y3] = polar(r1, a2), [x4, y4] = polar(r1, a1);
  return `M${x1} ${y1} A${r2} ${r2} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`;
}

export type BoardTarget = { seg: number; mult: 1 | 2 | 3 };

export function TargetBoard({ target, size = 132, accent = "#ffd24a" }: { target?: BoardTarget | null; size?: number; accent?: string }) {
  const onBull = target?.seg === 25;
  return (
    <svg viewBox="-118 -118 236 236" width={size} height={size} role="img"
      aria-label={target ? (onBull ? (target.mult === 2 ? "Aim at the bullseye" : "Aim at the 25") : `Aim at ${target.seg}`) : "Dartboard"}
      style={{ display: "block", margin: "0 auto" }}>
      <defs>
        <filter id="tb-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle r="117" fill="#0b0b0f" />
      {ORDER.map((n, i) => {
        const a1 = i * 18 - 9, a2 = a1 + 18;
        const dark = i % 2 === 0;
        const hot = !onBull && target?.seg === n;
        const single = hot ? accent : dark ? "#1b1b20" : "#e9dfc6";
        const ring = hot ? accent : dark ? "#b3262e" : "#1f7a43";
        const dim = target && !hot ? 0.35 : 1;
        const [lx, ly] = polar(109, i * 18);
        return (
          <g key={n} opacity={dim} filter={hot ? "url(#tb-glow)" : undefined}>
            <path d={wedge(R.outerBull, R.trebleIn, a1, a2)} fill={single} opacity={hot ? 0.75 : 1} />
            <path d={wedge(R.trebleIn, R.trebleOut, a1, a2)} fill={ring} />
            <path d={wedge(R.trebleOut, R.doubleIn, a1, a2)} fill={single} opacity={hot ? 0.75 : 1} />
            <path d={wedge(R.doubleIn, R.doubleOut, a1, a2)} fill={ring} />
            <text x={lx} y={ly} fill={hot ? accent : "#cfcfd6"} fontSize={hot ? 15 : 11} fontWeight={hot ? 800 : 600}
              fontFamily="Oswald, sans-serif" textAnchor="middle" dominantBaseline="central">{n}</text>
          </g>
        );
      })}
      <circle r={R.outerBull} fill={onBull && target?.mult === 1 ? accent : "#1f7a43"}
        opacity={target && !(onBull && target.mult === 1) ? 0.35 : 1} filter={onBull && target?.mult === 1 ? "url(#tb-glow)" : undefined} />
      <circle r={R.bull} fill={onBull && target?.mult === 2 ? accent : "#b3262e"}
        opacity={target && !(onBull && target.mult === 2) ? 0.35 : 1} filter={onBull && target?.mult === 2 ? "url(#tb-glow)" : undefined} />
      {onBull && (
        <circle r={target!.mult === 2 ? R.bull + 6 : R.outerBull + 6} fill="none" stroke={accent} strokeWidth="2.5">
          <animate attributeName="r" values={`${target!.mult === 2 ? R.bull + 5 : R.outerBull + 5};${target!.mult === 2 ? R.bull + 14 : R.outerBull + 16}`} dur="1.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0" dur="1.4s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}
