import { useId, type CSSProperties } from "react";

const colours = ["#f43f5e", "#38bdf8", "#fbbf24"];

/** Original vector artwork for cosmetic equipment; deliberately has no gameplay attributes. */
export function EquipmentProductArt({ name, type, brand, accent = colours[0], barrel = "STRAIGHT", stem = "MEDIUM", flight = "STANDARD", pattern = "CHEVRON" }: {
  name: string; type: string; brand?: string; accent?: string; barrel?: string; stem?: string; flight?: string; pattern?: string;
}) {
  const signature = type.includes("DART");
  const patternId = `equipment-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const style = { "--equipment-accent": accent } as CSSProperties;
  const barrelPaths:Record<string,string>={STRAIGHT:"M52 -7H139L148 -4V4L139 7H52Z",TORPEDO:"M52 -4Q60 -9 72 -9H121Q138 -7 148 0Q138 7 121 9H72Q60 9 52 4Z",SCALLOPED:"M52 -7H70L75 -4 80 -7H91L96 -4 101 -7H112L117 -4 122 -7H139L148 -4V4L139 7H122L117 4 112 7H101L96 4 91 7H80L75 4 70 7H52Z",TAPERED:"M52 -4L86 -8H132L148 -4V4L132 8H86L52 4Z"};
  const flightPaths:Record<string,string>={STANDARD:"M0 0 28 -17 25 0 28 17Z",SLIM:"M0 0 28 -10 26 0 28 10Z",KITE:"M0 0 14 -17 29 -12 22 0 29 12 14 17Z",NO2:"M0 0 28 -13 25 0 28 13Z"};
  const shaft=stem==="SHORT"?22:stem==="INTERMEDIATE"?34:46;
  const flightPath=flightPaths[flight]??flightPaths.STANDARD;
  return <div className="relative isolate flex h-36 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_20%,rgba(244,63,94,.18),transparent_65%),linear-gradient(145deg,#111d2e,#050a12)]" style={style} aria-label={`${type.replaceAll("_", " ").toLowerCase()} artwork for ${name}`}>
    <div className="absolute left-3 top-3 text-[9px] font-black uppercase tracking-[.22em] text-white/45">{brand ?? "TKDL EQUIPMENT"}</div>
    <div className="absolute bottom-3 right-3 text-[9px] font-bold uppercase tracking-[.15em] text-white/45">{signature?`${barrel} · ${stem} STEM`:"Career Edition"}</div>
    {signature ? <svg viewBox="0 0 320 140" className="h-full w-full" role="img" aria-hidden="true">
      <defs><linearGradient id={patternId} x1="0" x2="1"><stop stopColor="#f8fafc"/><stop offset=".45" stopColor="#64748b"/><stop offset=".7" stopColor="#e2e8f0"/><stop offset="1" stopColor="#334155"/></linearGradient></defs>
      {[0,1,2].map((n)=><g key={n} transform={`translate(${24+n*7} ${29+n*34}) rotate(7 145 0)`}>
        <path d="M15 0 52 -2 54 0 52 2Z" fill="#dbeafe"/>
        <path d={barrelPaths[barrel]??barrelPaths.STRAIGHT} fill={`url(#${patternId})`} stroke="#fff" strokeOpacity=".42"/>
        <path d="M70 -5H133" stroke="var(--equipment-accent)" strokeWidth="2" opacity=".8"/>
        <path d="M86 -6v12m8-12v12m8-12v12m8-12v12m8-12v12" stroke="#0f172a" strokeOpacity=".55" strokeWidth="1.5"/>
        <path d={`M148 0h${shaft}`} stroke="var(--equipment-accent)" strokeWidth="3"/>
        <path d={flightPath} transform={`translate(${148+shaft} 0)`} fill="var(--equipment-accent)" stroke="#fff" strokeOpacity=".58"/>
        {pattern==="GRID"&&<path d={`M${154+shaft} -7v14m6-17v20`} stroke="#fff" strokeOpacity=".68" strokeWidth="1.5"/>}
        {pattern==="RINGS"&&<circle cx={160+shaft} r="5" fill="none" stroke="#fff" strokeWidth="2"/>}
        {pattern==="CHEVRON"&&<path d={`m${155+shaft} -5 7 5-7 5`} fill="none" stroke="#fff" strokeWidth="2"/>}
      </g>)}
    </svg> : <svg viewBox="0 0 320 140" className="h-full w-full" role="img" aria-hidden="true">
      <path d="M160 42 92 17l7 62 61 19 61-19 7-62z" fill="#101a2b" stroke="var(--equipment-accent)" strokeWidth="2"/>
      <path d="M160 42 99 17l61 11 61-11z" fill="var(--equipment-accent)" opacity=".92"/>
      <path d="m160 42-61 37 61 19 61-19z" fill="var(--equipment-accent)" opacity=".5"/>
      <path d="m117 47 43 17 43-17M123 57l37 15 37-15" fill="none" stroke="#fff" strokeOpacity=".82" strokeWidth="3"/>
      <text x="160" y="89" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="800" letterSpacing="2">SIGNATURE SERIES</text>
    </svg>}
    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5"/>
  </div>;
}
