import React, { useState, useEffect, useCallback } from "react";
import { useCurrentPlayer } from "@/context/auth";
import { CardShopUI } from "@/components/CardShopUI";
import { CardClashMatchLauncher } from "@/components/CardClashMatchLauncher";
import { CardClashMockGame } from "@/components/CardClashMockGame";
import { PlayerChallenges } from "@/components/PlayerChallenges";
import { TKDLCard } from "@/components/TKDLCard";
import { ALL_CARDS } from "@/lib/cards-data";
import type { CardData, Category, Rarity } from "@/lib/cards-data";

type Tab = "hub" | "collection" | "shop" | "play" | "practice" | "standings" | "achievements" | "rules" | "admin";

const CATEGORIES: Category[] = ["X01 GOOD","X01 BAD","CRICKET GOOD","CRICKET BAD","WILDCARD GOOD","WILDCARD BAD"];
const RARITIES: Rarity[] = ["COMMON","RARE","LEGENDARY"];
const CAT_COLOR: Record<Category,string> = {"X01 GOOD":"#00b4ff","X01 BAD":"#ff3b3b","CRICKET GOOD":"#00cc66","CRICKET BAD":"#9933ff","WILDCARD GOOD":"#ffaa00","WILDCARD BAD":"#cc1111"};
const RAR_COLOR: Record<Rarity,string> = { COMMON:"#9ab0c4", RARE:"#c084fc", LEGENDARY:"#ffd24a" };

interface Stats { coins:number; cardsOwned:number; matchesPlayed:number; wins:number; losses:number; }
interface Standing { player_id:number; player_name:string; wins:number; losses:number; total_matches:number; points:number; }

// ── TCG-style Pack Art ────────────────────────────────────────────────────────
const PACKS = [
  {
    id:"single", name:"Standard Pull", label:"STANDARD PULL", sub:"1 CARD",
    cost:50, ribbon:null,
    // Steel blue — precision/skill
    bg1:"#050f1c", bg2:"#0e2240", bg3:"#1a3a68",
    strip1:"#040c18", strip2:"#081525",
    foot1:"#061224", foot2:"#0a1e3c",
    acc:"#6ab4e0", accB:"#a8d8f5", glow:"rgba(106,180,224,0.55)",
    artBg:"#0a1928", artAcc:"#4fa3d4", artAcc2:"#8ecbee",
    tier:"silver" as const,
  },
  {
    id:"five", name:"Kilbirnie Night", label:"KILBIRNIE NIGHT", sub:"5 CARDS",
    cost:200, ribbon:"MOST POPULAR",
    // Pub gold — warm, champion
    bg1:"#160a00", bg2:"#2e1400", bg3:"#4a2200",
    strip1:"#100800", strip2:"#261100",
    foot1:"#130900", foot2:"#321600",
    acc:"#f5a623", accB:"#ffd06b", glow:"rgba(245,166,35,0.6)",
    artBg:"#1a0d00", artAcc:"#d4890a", artAcc2:"#f5c842",
    tier:"gold" as const,
  },
  {
    id:"ten", name:"Legend Vault", label:"LEGEND VAULT", sub:"10 CARDS",
    cost:350, ribbon:"BEST VALUE",
    // Cosmic purple — mythic
    bg1:"#060010", bg2:"#130030", bg3:"#22005a",
    strip1:"#04000c", strip2:"#0e0028",
    foot1:"#07001a", foot2:"#1a0048",
    acc:"#b44bff", accB:"#de88ff", glow:"rgba(180,75,255,0.62)",
    artBg:"#0a0020", artAcc:"#9933ee", artAcc2:"#cc77ff",
    tier:"legendary" as const,
  },
];

// ── SVG dartboard "illustration" art panel ────────────────────────────────────
function DartboardArt({ pack, W, H }: { pack: typeof PACKS[0]; W: number; H: number }) {
  const cx = W / 2, cy = H / 2;
  const uid = `db-${pack.id}-${W}`;
  const rings = [0.38, 0.50, 0.62, 0.74, 0.86, 0.94];
  const sectorAngles = Array.from({length:20},(_,i)=> i*18);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:"block",overflow:"hidden"}}>
      <defs>
        <radialGradient id={`artbg-${uid}`} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={pack.artAcc} stopOpacity="0.22"/>
          <stop offset="100%" stopColor={pack.artBg} stopOpacity="0"/>
        </radialGradient>
        {pack.tier === "legendary" && (
          <linearGradient id={`holo-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="rgba(255,0,80,0.18)"/>
            <stop offset="25%"  stopColor="rgba(80,255,100,0.14)"/>
            <stop offset="50%"  stopColor="rgba(0,180,255,0.18)"/>
            <stop offset="75%"  stopColor="rgba(255,80,255,0.14)"/>
            <stop offset="100%" stopColor="rgba(255,200,0,0.18)"/>
          </linearGradient>
        )}
        <clipPath id={`artclip-${uid}`}><rect width={W} height={H}/></clipPath>
        <radialGradient id={`bulleye-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={pack.accB}/>
          <stop offset="100%" stopColor={pack.acc}/>
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width={W} height={H} fill={pack.artBg}/>
      {/* Subtle glow centre */}
      <rect width={W} height={H} fill={`url(#artbg-${uid})`}/>

      {/* Subtle crowd silhouette strip at bottom (just tinted shapes) */}
      {[...Array(14)].map((_,i) => {
        const bx = (i/(13)) * W;
        const bh = 12 + (i%3)*6 + ((i%5)*3);
        return <rect key={i} x={bx-5} y={H-bh} width={14} height={bh} rx="4" fill={pack.acc} opacity="0.06"/>;
      })}

      {/* Dartboard sectors (alternating dark/light wedges) */}
      <g clipPath={`url(#artclip-${uid})`} transform={`translate(${cx},${cy})`}>
        {sectorAngles.map((angle,i) => {
          const r1 = cx * 0.86, r2 = 0;
          const a1 = (angle - 9) * Math.PI/180;
          const a2 = (angle + 9) * Math.PI/180;
          const x1 = Math.cos(a1)*r1, y1 = Math.sin(a1)*r1;
          const x2 = Math.cos(a2)*r1, y2 = Math.sin(a2)*r1;
          return (
            <path key={i}
              d={`M0,0 L${x1},${y1} A${r1},${r1} 0 0,1 ${x2},${y2} Z`}
              fill={i%2===0 ? pack.acc : "rgba(0,0,0,0.55)"}
              opacity={i%2===0 ? 0.055 : 0.04}
            />
          );
        })}

        {/* Concentric rings */}
        {rings.map((r,i) => (
          <circle key={i} r={cx*r} fill="none"
            stroke={pack.acc}
            strokeWidth={i===rings.length-1 ? 1.5 : 0.7}
            opacity={i===rings.length-1 ? 0.55 : 0.22}
          />
        ))}

        {/* Triple ring highlight band */}
        <circle r={cx*0.68} fill="none" stroke={pack.accB} strokeWidth="5" opacity="0.1"/>
        <circle r={cx*0.56} fill="none" stroke={pack.accB} strokeWidth="5" opacity="0.1"/>

        {/* Bullseye */}
        <circle r={cx*0.14} fill={pack.acc} opacity="0.18"/>
        <circle r={cx*0.14} fill="none" stroke={pack.accB} strokeWidth="1.2" opacity="0.55"/>
        <circle r={cx*0.07} fill={`url(#bulleye-${uid})`} opacity="0.8"
          style={{filter:`drop-shadow(0 0 6px ${pack.acc})`}}/>

        {/* Dart in bullseye */}
        <g transform="rotate(-42)">
          {/* flight */}
          <path d={`M0,${cx*0.55} L${cx*-0.06},${cx*0.72} L0,${cx*0.62} L${cx*0.06},${cx*0.72}Z`}
            fill={pack.accB} opacity="0.7"/>
          {/* shaft */}
          <rect x={-cx*0.022} y={cx*0.12} width={cx*0.044} height={cx*0.43} rx={cx*0.012}
            fill={pack.acc} opacity="0.55"/>
          {/* barrel */}
          <rect x={-cx*0.045} y={-cx*0.08} width={cx*0.09} height={cx*0.2} rx={cx*0.025}
            fill={pack.accB} opacity="0.88"
            style={{filter:`drop-shadow(0 0 4px ${pack.acc})`}}/>
          {/* grip rings */}
          {[-0.04,0,0.04].map((dy,i) => (
            <line key={i} x1={-cx*0.045} y1={dy*cx} x2={cx*0.045} y2={dy*cx}
              stroke="rgba(0,0,0,0.4)" strokeWidth="1.5"/>
          ))}
          {/* tip */}
          <path d={`M${-cx*0.02},${-cx*0.08} L0,${-cx*0.22} L${cx*0.02},${-cx*0.08}Z`}
            fill={pack.accB} opacity="0.95"/>
        </g>

        {/* Impact star sparks */}
        {[0,72,144,216,288].map((a,i) => {
          const sr = cx * (0.1 + (i%2)*0.05);
          const x = Math.cos(a*Math.PI/180)*sr;
          const y = Math.sin(a*Math.PI/180)*sr;
          return <line key={i} x1="0" y1="0" x2={x} y2={y} stroke={pack.accB} strokeWidth="0.8" opacity="0.35"/>;
        })}
      </g>

      {/* Legendary holographic overlay */}
      {pack.tier==="legendary" && <rect width={W} height={H} fill={`url(#holo-${uid})`}/>}

      {/* Vignette */}
      <radialGradient id={`vig-${uid}`} cx="50%" cy="50%" r="60%">
        <stop offset="60%" stopColor="transparent"/>
        <stop offset="100%" stopColor="rgba(0,0,0,0.7)"/>
      </radialGradient>
      <rect width={W} height={H} fill={`url(#vig-${uid})`}/>
    </svg>
  );
}

// ── Full booster-pack SVG ─────────────────────────────────────────────────────
function PackSVG({ packId, scale = 1 }: { packId: string; scale?: number }) {
  const p = PACKS.find(x=>x.id===packId) ?? PACKS[1];
  // Real booster pack proportions: ~2.5 : 4.5 ≈ width:height
  const W = Math.round(148 * scale), H = Math.round(236 * scale);
  const uid = `pk-${packId}-${scale}`;
  const STRIP_H  = Math.round(H * 0.2);   // tear strip
  const ART_H    = Math.round(H * 0.48);  // art panel
  const ART_Y    = STRIP_H;
  const FOOT_H   = H - STRIP_H - ART_H;   // bottom info
  const FOOT_Y   = STRIP_H + ART_H;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:"block",overflow:"visible"}}>
      <defs>
        <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.bg1}/>
          <stop offset="45%" stopColor={p.bg2}/>
          <stop offset="100%" stopColor={p.bg3}/>
        </linearGradient>
        <linearGradient id={`strip-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={p.strip1}/>
          <stop offset="50%" stopColor={p.strip2}/>
          <stop offset="100%" stopColor={p.strip1}/>
        </linearGradient>
        <linearGradient id={`foot-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.foot1}/>
          <stop offset="100%" stopColor={p.foot2}/>
        </linearGradient>
        <linearGradient id={`sheen-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)"/>
          <stop offset="38%" stopColor="rgba(255,255,255,0.07)"/>
          <stop offset="55%" stopColor="rgba(255,255,255,0.18)"/>
          <stop offset="72%" stopColor="rgba(255,255,255,0.07)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </linearGradient>
        <clipPath id={`cl-${uid}`}><rect x="1" y="1" width={W-2} height={H-2} rx="8"/></clipPath>
        <clipPath id={`art-clip-${uid}`}><rect x="1" y={ART_Y} width={W-2} height={ART_H}/></clipPath>
        <clipPath id={`strip-clip-${uid}`}><rect x="1" y="1" width={W-2} height={STRIP_H-1} rx="8"/></clipPath>
        {p.tier==="legendary" && (
          <linearGradient id={`holo2-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="rgba(255,30,80,0.15)"/>
            <stop offset="20%"  stopColor="rgba(80,255,100,0.12)"/>
            <stop offset="40%"  stopColor="rgba(0,160,255,0.15)"/>
            <stop offset="60%"  stopColor="rgba(200,60,255,0.15)"/>
            <stop offset="80%"  stopColor="rgba(255,180,0,0.12)"/>
            <stop offset="100%" stopColor="rgba(255,30,80,0.15)"/>
          </linearGradient>
        )}
      </defs>

      {/* Base body */}
      <rect x="1" y="1" width={W-2} height={H-2} rx="8" fill={`url(#body-${uid})`}/>

      {/* Art panel */}
      <g clipPath={`url(#art-clip-${uid})`}>
        <DartboardArt pack={p} W={W-2} H={ART_H}/>
        {/* Offset to correct position */}
        <rect x="1" y={ART_Y} width={W-2} height={ART_H} fill="transparent"/>
      </g>

      {/* Art panel separator lines */}
      <line x1="1" y1={ART_Y} x2={W-1} y2={ART_Y} stroke={p.acc} strokeWidth="0.8" opacity="0.35"/>
      <line x1="1" y1={FOOT_Y} x2={W-1} y2={FOOT_Y} stroke={p.acc} strokeWidth="0.8" opacity="0.35"/>

      {/* Tear strip */}
      <g clipPath={`url(#strip-clip-${uid})`}>
        <rect x="1" y="1" width={W-2} height={STRIP_H-1} fill={`url(#strip-${uid})`}/>
      </g>

      {/* Perforation dots along tear line */}
      {Array.from({length:Math.floor(W/7)},(_,i)=>(
        <rect key={i} x={4+i*7} y={STRIP_H-2} width={4} height="2" rx="1" fill={p.acc} opacity="0.45"/>
      ))}

      {/* TKDL text in strip */}
      <text x={W/2} y={STRIP_H*0.48} textAnchor="middle" fontSize={Math.round(W*0.14)}
        fontWeight="900" fontFamily="'Arial Black',Impact,Arial,sans-serif"
        fill={p.accB} letterSpacing="4"
        style={{filter:`drop-shadow(0 0 5px ${p.acc})`}}>TKDL</text>
      <text x={W/2} y={STRIP_H*0.76} textAnchor="middle" fontSize={Math.round(W*0.065)}
        fill={p.acc} opacity="0.6" letterSpacing="2" fontFamily="Arial,sans-serif">CARD CLASH</text>

      {/* Footer */}
      <rect x="1" y={FOOT_Y} width={W-2} height={FOOT_H} fill={`url(#foot-${uid})`}/>

      {/* Pack name in footer */}
      <text x={W/2} y={FOOT_Y + FOOT_H*0.38} textAnchor="middle"
        fontSize={Math.min(10, Math.round(W * 0.078))} fontWeight="900"
        fontFamily="'Arial Black',Impact,Arial,sans-serif"
        fill={p.accB} letterSpacing="1.5">{p.label}</text>
      <text x={W/2} y={FOOT_Y + FOOT_H*0.68} textAnchor="middle"
        fontSize={Math.round(W * 0.058)}
        fill={p.acc} opacity="0.55" letterSpacing="1.2" fontFamily="Arial,sans-serif">{p.sub}</text>

      {/* Ribbon badge */}
      {p.ribbon && (
        <>
          <rect x={W*0.08} y={FOOT_Y + FOOT_H*0.78} width={W*0.84} height={FOOT_H*0.18} rx={FOOT_H*0.09}
            fill={p.acc} opacity="0.2"/>
          <text x={W/2} y={FOOT_Y + FOOT_H*0.91} textAnchor="middle"
            fontSize={Math.round(W*0.048)} fontWeight="800"
            fill={p.accB} letterSpacing="1.2" fontFamily="Arial,sans-serif">{p.ribbon}</text>
        </>
      )}

      {/* Holographic overlay for Legend Vault */}
      {p.tier==="legendary" && (
        <rect x="1" y="1" width={W-2} height={H-2} rx="8" fill={`url(#holo2-${uid})`}/>
      )}

      {/* Metallic sheen */}
      <rect x="1" y="1" width={W-2} height={H-2} rx="8" fill={`url(#sheen-${uid})`}/>

      {/* Border */}
      <rect x="1" y="1" width={W-2} height={H-2} rx="8" fill="none"
        stroke={p.acc} strokeWidth="1.2" opacity="0.5"/>
      {/* Inner highlight */}
      <rect x="3" y="3" width={W-6} height={H-6} rx="6" fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth="0.8"/>
    </svg>
  );
}

// ── Hub navigation bubble ─────────────────────────────────────────────────────
function HubBubble({
  icon, label, color, glow, onClick, badge, disabled
}: {
  icon:string; label:string; color:string; glow:string;
  onClick:()=>void; badge?:number|string; disabled?:boolean;
}) {
  const [hover,setHover] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{
        all:"unset", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        gap:"10px", padding:"22px 16px", borderRadius:"20px", cursor:disabled?"not-allowed":"pointer",
        position:"relative", transition:"all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        background: hover ? `linear-gradient(135deg,${color}18,${color}08)` : `linear-gradient(135deg,${color}0d,rgba(0,0,0,0))`,
        border:`1.5px solid ${hover ? color+"70" : color+"28"}`,
        boxShadow: hover ? `0 0 28px ${glow}, 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)` : `0 2px 16px rgba(0,0,0,0.3)`,
        transform: hover ? "translateY(-4px) scale(1.04)" : "scale(1)",
        opacity: disabled ? 0.35 : 1,
        minHeight:"110px",
      }}
    >
      {badge && (
        <div style={{
          position:"absolute", top:"10px", right:"10px",
          background:`linear-gradient(135deg,${color},${glow})`,
          color:"#000", fontSize:"10px", fontWeight:900, padding:"2px 8px",
          borderRadius:"10px", letterSpacing:"0.06em", boxShadow:`0 0 10px ${glow}`,
        }}>{badge}</div>
      )}
      <div style={{fontSize:"36px", filter:`drop-shadow(0 0 12px ${glow})`}}>{icon}</div>
      <div style={{
        fontSize:"11px", fontWeight:900, letterSpacing:"0.14em", color: hover ? "#fff" : color,
        fontFamily:"'Arial Black',Impact,Arial,sans-serif", textTransform:"uppercase",
        textShadow: hover ? `0 0 14px ${glow}` : "none", transition:"all 0.18s",
      }}>{label}</div>
    </button>
  );
}

export default function CardClashPage() {
  const currentPlayer = useCurrentPlayer();
  const playerId = currentPlayer?.playerId;

  const [activeTab, setActiveTab] = useState<Tab>("hub");
  const [stats, setStats]         = useState<Stats|null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [ownedNames, setOwnedNames]     = useState<Set<string>>(new Set());
  const [newCardNames, setNewCardNames] = useState<Set<string>>(new Set());
  const [collLoading, setCollLoading]   = useState(true);
  const [achievements, setAchievements] = useState<any>(null);
  const [packInventory, setPackInventory] = useState<any[]>([]);
  const [dupCards, setDupCards]           = useState<any[]>([]);
  const [sellingCard, setSellingCard]     = useState<string|null>(null);
  const [search, setSearch]       = useState("");
  const [catFilter, setCatFilter] = useState<Category|"ALL">("ALL");
  const [rarFilter, setRarFilter] = useState<Rarity|"ALL">("ALL");
  const [showOwned, setShowOwned] = useState<"all"|"owned"|"unowned">("all");
  const [enlargedCard, setEnlargedCard] = useState<CardData|null>(null);
  // Admin
  const [adminPin, setAdminPin]     = useState("");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPinError, setAdminPinError] = useState(false);
  const [adminAction, setAdminAction] = useState<string|null>(null);
  const [adminResult, setAdminResult] = useState<{ok:boolean;message:string;details?:string[]}|null>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!playerId) return;
    const key = `tkdl_new_cards_${playerId}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const stored: Record<string,number> = JSON.parse(raw);
      const cutoff = Date.now() - 24*60*60*1000;
      const fresh = new Set(Object.entries(stored).filter(([,ts])=>ts>cutoff).map(([n])=>n));
      const pruned: Record<string,number> = {};
      for (const [n,ts] of Object.entries(stored)) { if(ts>cutoff) pruned[n]=ts; }
      localStorage.setItem(key, JSON.stringify(pruned));
      setNewCardNames(fresh);
    } catch {}
  }, [playerId]);

  const handleCardsReceived = (cardNames: string[]) => {
    if (!playerId || !cardNames.length) return;
    const key = `tkdl_new_cards_${playerId}`;
    try {
      const raw = localStorage.getItem(key);
      const stored: Record<string,number> = raw ? JSON.parse(raw) : {};
      const now = Date.now();
      for (const n of cardNames) stored[n]=now;
      localStorage.setItem(key,JSON.stringify(stored));
      setNewCardNames(prev=>new Set([...prev,...cardNames]));
    } catch {}
    loadData();
  };

  const loadData = useCallback(async () => {
    if (!playerId) return;
    try {
      const [statsR,invR,standR,achR,packR] = await Promise.all([
        fetch(`/api/card-clash/player/${playerId}/stats`).then(r=>r.ok?r.json():null),
        fetch(`/api/card-clash/inventory/${playerId}`).then(r=>r.ok?r.json():[]),
        fetch("/api/card-clash/standings").then(r=>r.ok?r.json():[]),
        fetch(`/api/card-clash/achievements/${playerId}`).then(r=>r.ok?r.json():null),
        fetch(`/api/card-clash/pack-inventory/${playerId}`).then(r=>r.ok?r.json():[]),
      ]);
      if(statsR) setStats(statsR);
      const inv = Array.isArray(invR)?invR:[];
      setOwnedNames(new Set(inv.map((c:any)=>c.cardName??c.name??"")));
      setDupCards(inv.filter((c:any)=>(c.quantity??1)>1));
      setStandings(Array.isArray(standR)?standR:[]);
      if(achR) setAchievements(achR);
      setPackInventory(Array.isArray(packR)?packR:[]);
    } catch {} finally { setCollLoading(false); }
  }, [playerId]);

  useEffect(()=>{ loadData(); },[loadData]);

  if (!currentPlayer || !playerId) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#030812"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:"52px",marginBottom:"1rem"}}>🎴</div>
        <div style={{color:"rgba(255,255,255,0.45)",marginBottom:"1.5rem",fontFamily:"Arial,sans-serif"}}>Log in to access Card Clash</div>
        <button onClick={()=>window.location.href="/login"} style={{padding:"12px 28px",background:"linear-gradient(135deg,#ffd24a,#ff8c00)",border:"none",borderRadius:"6px",color:"#000",fontSize:"13px",fontWeight:800,cursor:"pointer"}}>Go to Login</button>
      </div>
    </div>
  );

  const filteredCards = ALL_CARDS.filter(c=>{
    if(catFilter!=="ALL"&&c.category!==catFilter) return false;
    if(rarFilter!=="ALL"&&c.rarity!==rarFilter) return false;
    if(showOwned==="owned"&&!ownedNames.has(c.name)) return false;
    if(showOwned==="unowned"&&ownedNames.has(c.name)) return false;
    if(search&&!c.name.toLowerCase().includes(search.toLowerCase())&&!c.effect.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const winRate  = stats&&stats.matchesPlayed>0 ? Math.round((stats.wins/stats.matchesPlayed)*100) : 0;
  const totalOwned = ALL_CARDS.filter(c=>ownedNames.has(c.name)).length;
  const completionPct = Math.round((totalOwned/ALL_CARDS.length)*100);
  const playerName = (currentPlayer as any)?.name||(currentPlayer as any)?.playerName||"Player";

  const goTo = (tab: Tab) => setActiveTab(tab);

  // ── Page shell ──────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"#030812",color:"#fff",fontFamily:"Arial,sans-serif",position:"relative",overflowX:"hidden"}}>
      <style>{`
        @keyframes floatA{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-22px) scale(1.02)}}
        @keyframes floatB{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes glowPulse{0%,100%{opacity:0.6}50%{opacity:1}}
        @keyframes titleShimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes packShimmer{0%{transform:translateX(-140%) skewX(-18deg)}100%{transform:translateX(320%) skewX(-18deg)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes rainbow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes particleFloat{0%{transform:translateY(0) translateX(0);opacity:0.7}100%{transform:translateY(-80px) translateX(30px);opacity:0}}
      `}</style>

      {/* ── FIXED BACKGROUND GLOWS ── */}
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none"}}>
        <div style={{position:"absolute",top:"-15%",left:"-8%",width:"55%",height:"55%",background:"radial-gradient(ellipse,rgba(0,120,255,0.08) 0%,transparent 68%)",animation:"glowPulse 9s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:"-18%",right:"-8%",width:"50%",height:"50%",background:"radial-gradient(ellipse,rgba(255,140,0,0.07) 0%,transparent 68%)",animation:"glowPulse 11s ease-in-out infinite 2s"}}/>
        <div style={{position:"absolute",top:"38%",left:"38%",width:"32%",height:"32%",background:"radial-gradient(ellipse,rgba(160,0,255,0.05) 0%,transparent 68%)",animation:"glowPulse 14s ease-in-out infinite 4s"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(rgba(255,255,255,0.025) 1px,transparent 1px)",backgroundSize:"32px 32px"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px)",backgroundSize:"96px 96px"}}/>
      </div>

      {/* ── CONTENT ── */}
      <div style={{position:"relative",zIndex:1,maxWidth:"1200px",margin:"0 auto",padding:"0 20px 80px"}}>

        {/* ── HUB / HOME ── */}
        {activeTab==="hub" && (
          <div style={{animation:"slideUp 0.3s ease"}}>

            {/* Hero section */}
            <div style={{textAlign:"center",padding:"3rem 0 2.5rem",position:"relative"}}>
              {/* Particle ring (decorative) */}
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-54%)",width:"420px",height:"420px",borderRadius:"50%",border:"1px solid rgba(255,210,74,0.07)",pointerEvents:"none"}}/>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-54%)",width:"320px",height:"320px",borderRadius:"50%",border:"1px solid rgba(255,210,74,0.05)",pointerEvents:"none"}}/>

              {/* Badge */}
              <div style={{display:"inline-flex",alignItems:"center",gap:"8px",background:"rgba(255,210,74,0.1)",border:"1px solid rgba(255,210,74,0.28)",borderRadius:"24px",padding:"6px 18px",marginBottom:"1.5rem"}}>
                <span style={{display:"inline-block",width:"6px",height:"6px",borderRadius:"50%",background:"#ffd24a",boxShadow:"0 0 10px #ffd24a",animation:"glowPulse 2s ease-in-out infinite"}}/>
                <span style={{color:"#ffd24a",fontSize:"10px",fontWeight:900,letterSpacing:"0.22em",fontFamily:"'Arial Black',Arial,sans-serif"}}>TESCO KILBIRNIE DARTS LEAGUE</span>
              </div>

              {/* Main title */}
              <div style={{lineHeight:0.88,marginBottom:"1.5rem"}}>
                <div style={{
                  fontSize:"clamp(52px,8vw,96px)",fontWeight:900,
                  fontFamily:"'Arial Black',Impact,Arial,sans-serif",
                  letterSpacing:"0.06em",textTransform:"uppercase",
                  background:"linear-gradient(135deg,#fff 0%,#aadcff 30%,#fff 55%,#cceeff 100%)",
                  backgroundSize:"200% 200%",
                  WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",
                  animation:"titleShimmer 5s ease-in-out infinite",
                }}>CARD</div>
                <div style={{
                  fontSize:"clamp(52px,8vw,96px)",fontWeight:900,
                  fontFamily:"'Arial Black',Impact,Arial,sans-serif",
                  letterSpacing:"0.06em",textTransform:"uppercase",
                  background:"linear-gradient(135deg,#ffaa00 0%,#ffd24a 35%,#fff5a0 55%,#ff9500 100%)",
                  backgroundSize:"200% 200%",
                  WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",
                  animation:"titleShimmer 4s ease-in-out infinite 1s",
                  textShadow:"none",
                  filter:"drop-shadow(0 0 30px rgba(255,210,74,0.25))",
                }}>CLASH</div>
              </div>

              <p style={{margin:"0 auto 2rem",fontSize:"14px",color:"rgba(255,255,255,0.4)",maxWidth:"340px",lineHeight:1.6}}>
                100 cards · Real darts chaos · Mid-match power-ups
              </p>

              {/* HUD stats row */}
              <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap",marginBottom:"0.5rem"}}>
                <HudStat icon="🪙" label="Coins"    value={stats?.coins??"—"} color="#ffd24a"/>
                <HudStat icon="🃏" label={`${totalOwned}/${ALL_CARDS.length}`} value={`${completionPct}%`} color="#00e5ff"/>
                <HudStat icon="⚡" label="Wins"     value={stats?.wins??"—"} color="#00ff88"/>
                <HudStat icon="🎯" label="Win Rate"  value={stats?`${winRate}%`:"—"} color="#c084fc"/>
              </div>
            </div>

            {/* Navigation bubbles grid */}
            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fill,minmax(148px,1fr))",
              gap:"14px",
              marginBottom:"2.5rem",
            }}>
              <HubBubble icon="🃏" label="Collection"   color="#00b4ff" glow="rgba(0,180,255,0.35)"  onClick={()=>goTo("collection")}   badge={newCardNames.size>0?newCardNames.size:undefined}/>
              <HubBubble icon="🛍️" label="Shop"         color="#ffd24a" glow="rgba(255,210,74,0.4)"  onClick={()=>goTo("shop")}         badge={packInventory.length>0?packInventory.length:undefined}/>
              <HubBubble icon="⚡" label="Play"         color="#00ff88" glow="rgba(0,255,136,0.4)"  onClick={()=>goTo("play")}/>
              <HubBubble icon="🎲" label="Practice"     color="#ff6b35" glow="rgba(255,107,53,0.35)" onClick={()=>goTo("practice")}/>
              <HubBubble icon="🏆" label="Standings"    color="#c084fc" glow="rgba(192,132,252,0.4)" onClick={()=>goTo("standings")}/>
              <HubBubble icon="🎖️" label="Achievements" color="#ff9500" glow="rgba(255,149,0,0.4)"  onClick={()=>goTo("achievements")}/>
              <HubBubble icon="📖" label="Rules"        color="#9ab0c4" glow="rgba(154,176,196,0.3)" onClick={()=>goTo("rules")}/>
              <HubBubble icon="⚙️" label="Admin"        color="#ff4466" glow="rgba(255,68,102,0.35)" onClick={()=>goTo("admin")}/>
            </div>

            {/* Pack showcase strip */}
            <div style={{textAlign:"center",marginBottom:"1rem"}}>
              <div style={{fontSize:"10px",color:"rgba(255,255,255,0.22)",letterSpacing:"0.18em",marginBottom:"18px"}}>AVAILABLE PACKS — TAP SHOP TO OPEN</div>
              <div style={{display:"flex",gap:"28px",justifyContent:"center",alignItems:"flex-end",flexWrap:"wrap"}}>
                {PACKS.map((p,i)=>(
                  <div key={p.id} onClick={()=>goTo("shop")} style={{cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"12px",animation:`floatA ${3.2+i*0.6}s ease-in-out infinite ${i*0.8}s`}}>
                    <div style={{
                      filter:`drop-shadow(0 0 20px ${p.glow}) drop-shadow(0 0 40px ${p.glow.replace("0.","0.1")})`,
                      transition:"all 0.2s",
                      position:"relative",overflow:"hidden",
                    }}>
                      <PackSVG packId={p.id} scale={1}/>
                      {/* Shimmer sweep */}
                      <div style={{position:"absolute",top:0,left:0,width:"35px",height:"100%",background:`linear-gradient(90deg,transparent,${p.accB}18,transparent)`,animation:"packShimmer 3.5s linear infinite",pointerEvents:"none"}}/>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:"11px",fontWeight:700,color:p.accB,letterSpacing:"0.04em",marginBottom:"2px"}}>{p.name}</div>
                      <div style={{fontSize:"14px",fontWeight:900,color:"#ffd24a",fontFamily:"'Arial Black',Arial,sans-serif"}}>🪙 {p.cost}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION SHELL ── for non-hub tabs */}
        {activeTab!=="hub" && (
          <div style={{animation:"slideUp 0.25s ease"}}>
            {/* Back bar */}
            <div style={{display:"flex",alignItems:"center",gap:"14px",padding:"1.5rem 0 1rem",borderBottom:"1px solid rgba(255,255,255,0.06)",marginBottom:"1.75rem"}}>
              <button onClick={()=>goTo("hub")} style={{all:"unset",display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",padding:"8px 16px",borderRadius:"8px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",color:"rgba(255,255,255,0.45)",fontSize:"12px",fontWeight:700,letterSpacing:"0.07em",transition:"all 0.15s"}}>
                ← HUB
              </button>
              <div style={{fontSize:"11px",color:"rgba(255,255,255,0.22)",letterSpacing:"0.12em",textTransform:"uppercase"}}>
                {activeTab.toUpperCase()}
              </div>
              <div style={{marginLeft:"auto"}}>
                <div style={{fontSize:"14px",fontWeight:700,color:"#ffd24a"}}>🪙 {stats?.coins??"—"}</div>
              </div>
            </div>

            {/* ── COLLECTION ── */}
            {activeTab==="collection" && (
              <div>
                <SectionHeader title="🃏 Your Collection" subtitle={`${totalOwned} of ${ALL_CARDS.length} cards unlocked · ${completionPct}% complete`}/>

                {/* Progress bar */}
                <div style={{height:"4px",background:"rgba(255,255,255,0.06)",borderRadius:"2px",overflow:"hidden",marginBottom:"1.5rem"}}>
                  <div style={{height:"100%",width:`${completionPct}%`,background:"linear-gradient(90deg,#00e5ff,#ffd24a)",borderRadius:"2px",transition:"width 0.8s",boxShadow:"0 0 8px rgba(0,229,255,0.5)"}}/>
                </div>

                {/* Filters */}
                <div style={{display:"flex",flexWrap:"wrap",gap:"8px",marginBottom:"1.5rem",alignItems:"center"}}>
                  <input type="text" placeholder="🔍 Search…" value={search} onChange={e=>setSearch(e.target.value)}
                    style={{padding:"8px 14px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"#fff",fontSize:"13px",outline:"none",minWidth:"140px"}}/>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                    <Chip label="ALL" active={catFilter==="ALL"} color="#aaa" onClick={()=>setCatFilter("ALL")}/>
                    {CATEGORIES.map(cat=><Chip key={cat} label={cat.replace(" GOOD","+ ").replace(" BAD","−")} active={catFilter===cat} color={CAT_COLOR[cat]} onClick={()=>setCatFilter(cat===catFilter?"ALL":cat)}/>)}
                  </div>
                  <div style={{display:"flex",gap:"5px"}}>
                    <Chip label="ALL" active={rarFilter==="ALL"} color="#aaa" onClick={()=>setRarFilter("ALL")}/>
                    {RARITIES.map(r=><Chip key={r} label={r} active={rarFilter===r} color={RAR_COLOR[r]} onClick={()=>setRarFilter(r===rarFilter?"ALL":r)}/>)}
                  </div>
                  <div style={{display:"flex",gap:"5px"}}>
                    {(["all","owned","unowned"] as const).map(v=>(
                      <button key={v} onClick={()=>setShowOwned(v)} style={{padding:"5px 12px",borderRadius:"7px",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",fontSize:"11px",fontWeight:600,background:showOwned===v?"rgba(255,255,255,0.1)":"transparent",color:showOwned===v?"#fff":"rgba(255,255,255,0.3)"}}>
                        {v==="all"?"All":v==="owned"?"✓ Owned":"○ Missing"}
                      </button>
                    ))}
                  </div>
                  <div style={{marginLeft:"auto",fontSize:"12px",color:"rgba(255,255,255,0.2)"}}>{filteredCards.length} cards</div>
                </div>

                {collLoading ? (
                  <div style={{textAlign:"center",padding:"4rem",color:"rgba(255,255,255,0.25)"}}>Loading…</div>
                ) : (
                  <div style={{display:"flex",flexWrap:"wrap",gap:"14px"}}>
                    {filteredCards.map(card=>{
                      const owned=ownedNames.has(card.name);
                      return (
                        <div key={card.id} onClick={()=>setEnlargedCard(card)}
                          style={{cursor:"pointer",transition:"transform 0.18s",flexShrink:0,position:"relative"}}
                          onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.06) translateY(-5px)")}
                          onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")}
                        >
                          <TKDLCard card={card} size="sm" locked={!owned}/>
                          {newCardNames.has(card.name)&&(
                            <div style={{position:"absolute",top:"4px",right:"4px",background:"linear-gradient(135deg,#ff3b3b,#ff6b00)",color:"#fff",fontSize:"9px",fontWeight:900,padding:"2px 6px",borderRadius:"8px",boxShadow:"0 2px 8px rgba(255,60,60,0.55)",zIndex:5}}>NEW</div>
                          )}
                        </div>
                      );
                    })}
                    {filteredCards.length===0&&(
                      <div style={{width:"100%",textAlign:"center",padding:"4rem",color:"rgba(255,255,255,0.25)"}}>
                        <div style={{fontSize:"44px",marginBottom:"1rem"}}>🃏</div>
                        <div>No cards match your filters</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── SHOP ── */}
            {activeTab==="shop" && (
              <div style={{maxWidth:"680px",margin:"0 auto"}}>
                <SectionHeader title="🛍️ Card Shop" subtitle="Open packs. Build your arsenal. All 100 cards waiting."/>
                <div style={{padding:"22px 24px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:"16px",marginBottom:"1.5rem"}}>
                  <CardShopUI playerId={playerId} onCardsReceived={handleCardsReceived} freePacks={packInventory} onFreePackOpened={loadData}/>
                </div>
                {dupCards.length>0&&(
                  <div style={{padding:"20px 22px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"14px"}}>
                    <div style={{fontSize:"11px",fontWeight:900,color:"rgba(255,255,255,0.5)",letterSpacing:"0.13em",marginBottom:"6px",textTransform:"uppercase"}}>♻️ Sell Duplicates</div>
                    <p style={{margin:"0 0 14px",fontSize:"12px",color:"rgba(255,255,255,0.28)",fontFamily:"Arial,sans-serif"}}>Common: 10🪙 · Rare: 30🪙 · Legendary: 100🪙</p>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"8px"}}>
                      {dupCards.map((c:any)=>{
                        const rar=(c.rarity??"COMMON").toUpperCase();
                        const prices:Record<string,number>={COMMON:10,RARE:30,LEGENDARY:100};
                        const price=prices[rar]??10;
                        const rc=rar==="LEGENDARY"?"#ffd24a":rar==="RARE"?"#c084fc":"rgba(255,255,255,0.4)";
                        const cid=c.cardId??c.card_id??c.id;
                        return (
                          <div key={cid} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:"rgba(255,255,255,0.03)",border:`1px solid ${rc}20`,borderRadius:"8px"}}>
                            <div>
                              <div style={{fontWeight:700,fontSize:"13px",color:"#fff"}}>{c.cardName??c.name}</div>
                              <div style={{fontSize:"11px",color:rc,marginTop:"2px"}}>{rar} · ×{c.quantity}</div>
                            </div>
                            <button disabled={sellingCard===cid} onClick={async()=>{
                              setSellingCard(cid);
                              try{ const r=await fetch("/api/card-clash/sell-card",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({playerId,cardId:cid})}); if(r.ok)loadData(); }
                              finally{setSellingCard(null);}
                            }} style={{padding:"5px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"6px",color:sellingCard===cid?"rgba(255,255,255,0.2)":"#ffd24a",fontWeight:700,fontSize:"11px",cursor:sellingCard===cid?"not-allowed":"pointer",whiteSpace:"nowrap"}}>
                              {sellingCard===cid?"…":`+${price}🪙`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PLAY ── */}
            {activeTab==="play" && (
              <div>
                <SectionHeader title="⚡ Enter the Clash" subtitle="Pick your opponent · Equip up to 4 cards · Play"/>
                <CardClashMatchLauncher currentPlayerId={playerId} currentPlayerName={playerName} onMatchComplete={()=>{goTo("collection");loadData();}}/>
                <div style={{marginTop:"2.5rem"}}>
                  <div style={{fontSize:"11px",fontWeight:900,color:"rgba(255,255,255,0.4)",letterSpacing:"0.13em",textTransform:"uppercase",marginBottom:"1rem"}}>Your Challenges</div>
                  <PlayerChallenges playerId={playerId}/>
                </div>
              </div>
            )}

            {/* ── PRACTICE ── */}
            {activeTab==="practice" && (
              <div>
                <SectionHeader title="🎲 Practice Mode" subtitle="No coins · No cards consumed · Test your strategies risk-free"/>
                <CardClashMockGame playerId={playerId} playerName={playerName} onDone={()=>goTo("collection")}/>
              </div>
            )}

            {/* ── STANDINGS ── */}
            {activeTab==="standings" && (
              <div>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:"12px",marginBottom:"1.75rem"}}>
                  <SectionHeader title="🏆 Standings" subtitle="Ranked by total Card Clash wins" noMargin/>
                  <button onClick={loadData} style={{padding:"8px 16px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:"7px",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:"12px"}}>↻ Refresh</button>
                </div>
                {standings.length>0?(
                  <div style={{padding:0,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:"14px",overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"14px"}}>
                      <thead>
                        <tr style={{background:"rgba(255,255,255,0.03)"}}>
                          {["#","Player","W","L","Played","Pts"].map(h=>(
                            <th key={h} style={{padding:"12px 18px",textAlign:h==="Player"||h==="#"?"left":"center",color:"rgba(255,255,255,0.3)",fontWeight:700,fontSize:"10px",letterSpacing:"0.12em",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((row,idx)=>{
                          const isMe=row.player_id===playerId;
                          return (
                            <tr key={row.player_id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:isMe?"rgba(0,180,255,0.06)":idx%2===0?"rgba(255,255,255,0.01)":"transparent"}}>
                              <td style={{padding:"14px 18px",color:idx<3?["#ffd24a","#c0c0c0","#cd7f32"][idx]:"rgba(255,255,255,0.3)",fontWeight:900,fontSize:"15px"}}>{idx===0?"🥇":idx===1?"🥈":idx===2?"🥉":idx+1}</td>
                              <td style={{padding:"14px 18px",fontWeight:isMe?700:400,color:isMe?"#00b4ff":"#fff"}}>{row.player_name}{isMe&&<span style={{fontSize:"10px",color:"rgba(0,180,255,0.45)",marginLeft:"7px"}}>(you)</span>}</td>
                              <td style={{padding:"14px 18px",textAlign:"center",color:"#00ff88",fontWeight:700}}>{row.wins}</td>
                              <td style={{padding:"14px 18px",textAlign:"center",color:"#ff6b6b"}}>{row.losses}</td>
                              <td style={{padding:"14px 18px",textAlign:"center",color:"rgba(255,255,255,0.4)"}}>{row.total_matches}</td>
                              <td style={{padding:"14px 18px",textAlign:"center",color:"#00e5ff",fontWeight:700}}>{row.points??0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ):(
                  <div style={{textAlign:"center",padding:"4rem",color:"rgba(255,255,255,0.25)"}}>
                    <div style={{fontSize:"44px",marginBottom:"1rem"}}>🏆</div>
                    <div>No matches yet — play some Card Clash games!</div>
                  </div>
                )}
              </div>
            )}

            {/* ── ACHIEVEMENTS ── */}
            {activeTab==="achievements" && (
              <div>
                <SectionHeader title="🎖️ Achievements" subtitle="Complete challenges to earn coins and free packs"/>
                {achievements?.stats&&(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:"10px",marginBottom:"2rem"}}>
                    {[
                      {label:"Matches",value:achievements.stats.matchesPlayed,icon:"🃏",color:"#00b4ff"},
                      {label:"Wins",value:achievements.stats.matchesWon,icon:"⚡",color:"#00ff88"},
                      {label:"Cards",value:achievements.stats.cardsOwned,icon:"🎴",color:"#ffd24a"},
                      {label:"Packs",value:achievements.stats.packsOpened,icon:"📦",color:"#c084fc"},
                      {label:"Streak",value:`${achievements.stats.loginStreak}d`,icon:"🔥",color:"#ff9500"},
                    ].map(s=>(
                      <div key={s.label} style={{padding:"16px 14px",background:`linear-gradient(135deg,${s.color}0d,${s.color}05)`,border:`1px solid ${s.color}25`,borderRadius:"12px",textAlign:"center"}}>
                        <div style={{fontSize:"22px",marginBottom:"7px"}}>{s.icon}</div>
                        <div style={{fontSize:"22px",fontWeight:900,color:s.color,fontFamily:"'Arial Black',Arial,sans-serif",lineHeight:1}}>{s.value}</div>
                        <div style={{fontSize:"9px",color:"rgba(255,255,255,0.3)",marginTop:"5px",textTransform:"uppercase",letterSpacing:"0.1em"}}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}
                {achievements?.achievements?(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"10px"}}>
                    {achievements.achievements.map((a:any)=>{
                      const rarColors:Record<string,string>={Common:"#9ca3af",Rare:"#c084fc",Epic:"#818cf8",Legendary:"#ffd24a"};
                      const rc=rarColors[a.rarity]??"#9ca3af";
                      return (
                        <div key={a.key} style={{padding:"14px 16px",background:a.earned?`linear-gradient(135deg,${rc}08,rgba(0,0,0,0))`:"rgba(255,255,255,0.02)",border:`1px solid ${a.earned?rc+"40":"rgba(255,255,255,0.06)"}`,borderRadius:"12px",opacity:a.earned?1:0.62}}>
                          <div style={{display:"flex",alignItems:"flex-start",gap:"12px"}}>
                            <div style={{fontSize:"28px",lineHeight:1,filter:a.earned?"none":"grayscale(1)",flexShrink:0}}>{a.icon}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap",marginBottom:"5px"}}>
                                <span style={{fontWeight:700,fontSize:"13px",color:a.earned?"#fff":"rgba(255,255,255,0.42)"}}>{a.name}</span>
                                <span style={{fontSize:"9px",fontWeight:700,padding:"2px 8px",borderRadius:"8px",background:rc+"1c",color:rc,letterSpacing:"0.08em"}}>{a.rarity?.toUpperCase()}</span>
                                {a.earned&&<span style={{fontSize:"10px",color:"#00ff88",fontWeight:700}}>✓ EARNED</span>}
                              </div>
                              <div style={{fontSize:"12px",color:"rgba(255,255,255,0.36)",marginBottom:"8px",lineHeight:1.5}}>{a.description}</div>
                              {!a.earned&&(
                                <div style={{marginBottom:"8px"}}>
                                  <div style={{height:"3px",background:"rgba(255,255,255,0.07)",borderRadius:"2px",overflow:"hidden"}}>
                                    <div style={{height:"100%",width:`${Math.min(100,(a.progress/a.statValue)*100)}%`,background:`linear-gradient(90deg,${rc}88,${rc})`,borderRadius:"2px"}}/>
                                  </div>
                                  <div style={{fontSize:"10px",color:"rgba(255,255,255,0.26)",marginTop:"3px"}}>{Math.min(a.progress,a.statValue)} / {a.statValue}</div>
                                </div>
                              )}
                              <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
                                <span style={{fontSize:"11px",color:"#ffd24a",fontWeight:700}}>🪙 {a.coinReward}</span>
                                {a.packName&&<span style={{fontSize:"11px",color:"#00b4ff"}}>📦 {a.packName}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ):(
                  <div style={{textAlign:"center",padding:"4rem",color:"rgba(255,255,255,0.25)"}}>Loading achievements…</div>
                )}
              </div>
            )}

            {/* ── RULES ── */}
            {activeTab==="rules" && (
              <div>
                <SectionHeader title="📖 How to Play" subtitle="The complete guide to TKDL Card Clash"/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:"10px"}}>
                  {([
                    {icon:"🃏",h:"What is Card Clash?",body:"TKDL's exclusive meta-game. Collect 100 unique cards, equip them before a match, and trigger tactical effects during real darts games."},
                    {icon:"🪙",h:"Earning Coins",body:"Log in daily (streak bonuses!), complete achievements, sell duplicate cards, and win Card Clash matches."},
                    {icon:"📦",h:"Packs & Drop Rates",body:"Standard Pull — 50 coins · 1 card\nKilbirnie Night — 200 coins · 5 cards\nLegend Vault — 350 coins · 10 cards\n\n75% Common · 20% Rare · 5% Legendary\nGuaranteed Legendary after 50 pulls."},
                    {icon:"✨",h:"Card Rarities",body:"Common — solid, reliable effects\nRare — stronger or niche tactics\nLegendary — the most powerful cards in the game"},
                    {icon:"🎯",h:"Card Categories",body:"X01, Cricket, or Wildcard — each works in its matching game mode. Wildcards work everywhere.\n\nGood cards benefit you. Bad cards curse your opponent."},
                    {icon:"⚡",h:"Equipping Cards",body:"In the Play section, select your opponent and game mode, then optionally equip up to 4 cards (2 Good + 2 Bad). Cards are always optional."},
                    {icon:"🎖️",h:"Achievements",body:"Complete milestones to earn coins and free packs. Earned packs appear in the Shop and can be opened any time."},
                    {icon:"🔥",h:"Login Streak",body:"7 days = 200 coins + 1 Standard Pull\n30 days = 1000 coins + Kilbirnie Night Pack"},
                    {icon:"♻️",h:"Selling Duplicates",body:"Common → 10 coins\nRare → 30 coins\nLegendary → 100 coins\n\nSell spares from the Shop section."},
                  ] as {icon:string;h:string;body:string}[]).map(s=>(
                    <div key={s.h} style={{padding:"18px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"12px"}}>
                      <h3 style={{margin:"0 0 9px",fontSize:"12px",fontWeight:900,color:"#ffd24a",fontFamily:"'Arial Black',Arial,sans-serif",letterSpacing:"0.07em",textTransform:"uppercase"}}>{s.icon} {s.h}</h3>
                      <p style={{margin:0,fontSize:"12px",color:"rgba(255,255,255,0.44)",lineHeight:1.75,whiteSpace:"pre-line"}}>{s.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ADMIN ── */}
            {activeTab==="admin" && (
              <div style={{maxWidth:"540px",margin:"0 auto"}}>
                <SectionHeader title="⚙️ Admin Panel" subtitle="Launch prep tools — PIN protected"/>
                {!adminAuthed?(
                  <div style={{padding:"32px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"16px",textAlign:"center"}}>
                    <div style={{fontSize:"40px",marginBottom:"18px"}}>🔐</div>
                    <div style={{fontSize:"13px",color:"rgba(255,255,255,0.35)",marginBottom:"18px"}}>Enter admin PIN to continue</div>
                    <input type="password" inputMode="numeric" placeholder="••••" value={adminPin}
                      onChange={e=>{setAdminPin(e.target.value);setAdminPinError(false);}}
                      onKeyDown={e=>{if(e.key==="Enter"){if(adminPin==="0601"){setAdminAuthed(true);setAdminPinError(false);}else{setAdminPinError(true);setAdminPin("");}}}}
                      style={{padding:"12px 20px",background:adminPinError?"rgba(255,60,60,0.08)":"rgba(255,255,255,0.06)",border:`1px solid ${adminPinError?"rgba(255,60,60,0.4)":"rgba(255,255,255,0.14)"}`,borderRadius:"8px",color:"#fff",fontSize:"22px",textAlign:"center",outline:"none",width:"140px",letterSpacing:"0.3em",marginBottom:"12px"}}/>
                    {adminPinError&&<div style={{fontSize:"12px",color:"#ff5566",marginBottom:"12px"}}>Incorrect PIN</div>}
                    <br/>
                    <button onClick={()=>{if(adminPin==="0601"){setAdminAuthed(true);setAdminPinError(false);}else{setAdminPinError(true);setAdminPin("");}}}
                      style={{padding:"10px 28px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:"8px",color:"#fff",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>
                      Unlock
                    </button>
                  </div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
                    {adminResult&&(
                      <div style={{padding:"14px 18px",borderRadius:"10px",background:adminResult.ok?"rgba(0,255,136,0.07)":"rgba(255,60,60,0.07)",border:`1px solid ${adminResult.ok?"rgba(0,255,136,0.28)":"rgba(255,60,60,0.28)"}`}}>
                        <div style={{fontWeight:700,color:adminResult.ok?"#00ff88":"#ff5566",marginBottom:"6px"}}>{adminResult.ok?"✅":"❌"} {adminResult.message}</div>
                        {adminResult.details?.map((d,i)=><div key={i} style={{fontSize:"12px",color:"rgba(255,255,255,0.36)",lineHeight:1.6}}>{d}</div>)}
                      </div>
                    )}
                    <div style={{padding:"20px 22px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:"14px"}}>
                      <div style={{fontSize:"11px",fontWeight:900,color:"#00b4ff",letterSpacing:"0.13em",marginBottom:"8px"}}>🗑️ CLEAR CHALLENGES</div>
                      <p style={{margin:"0 0 14px",fontSize:"12px",color:"rgba(255,255,255,0.35)",lineHeight:1.6}}>Removes daily &amp; weekly challenge progress. Templates are preserved — players get fresh challenges on next visit.</p>
                      <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
                        <button disabled={!!adminAction} onClick={async()=>{
                          setAdminAction("clearMine");setAdminResult(null);
                          try{const r=await fetch("/api/card-clash/admin/challenges/clear",{method:"POST",headers:{"Content-Type":"application/json","x-admin-pin":"0601"},body:JSON.stringify({playerId})});
                          const d=await r.json();setAdminResult({ok:r.ok,message:d.message??(r.ok?"Done":d.error),details:[]});if(r.ok)loadData();}
                          catch(e:any){setAdminResult({ok:false,message:e.message});}finally{setAdminAction(null);}
                        }} style={{padding:"10px 18px",background:"rgba(0,180,255,0.08)",border:"1px solid rgba(0,180,255,0.3)",borderRadius:"8px",color:"#00b4ff",fontWeight:700,fontSize:"12px",cursor:adminAction?"not-allowed":"pointer"}}>
                          {adminAction==="clearMine"?"…":"Clear MY Challenges"}
                        </button>
                        <button disabled={!!adminAction} onClick={async()=>{
                          if(!window.confirm("Clear challenges for ALL players?"))return;
                          setAdminAction("clearAll");setAdminResult(null);
                          try{const r=await fetch("/api/card-clash/admin/challenges/clear",{method:"POST",headers:{"Content-Type":"application/json","x-admin-pin":"0601"},body:JSON.stringify({})});
                          const d=await r.json();setAdminResult({ok:r.ok,message:d.message??(r.ok?"Done":d.error),details:[]});}
                          catch(e:any){setAdminResult({ok:false,message:e.message});}finally{setAdminAction(null);}
                        }} style={{padding:"10px 18px",background:"rgba(255,165,0,0.08)",border:"1px solid rgba(255,165,0,0.3)",borderRadius:"8px",color:"#ffaa00",fontWeight:700,fontSize:"12px",cursor:adminAction?"not-allowed":"pointer"}}>
                          {adminAction==="clearAll"?"…":"Clear ALL Players"}
                        </button>
                      </div>
                    </div>
                    <div style={{padding:"20px 22px",background:"rgba(255,30,30,0.03)",border:"1px solid rgba(255,60,60,0.22)",borderRadius:"14px"}}>
                      <div style={{fontSize:"11px",fontWeight:900,color:"#ff5566",letterSpacing:"0.13em",marginBottom:"8px"}}>☢️ NUCLEAR RESET</div>
                      <p style={{margin:"0 0 10px",fontSize:"12px",color:"rgba(255,255,255,0.35)",lineHeight:1.6}}>Wipes <strong style={{color:"rgba(255,255,255,0.55)"}}>all</strong> player data: cards, matches, achievements, packs, challenges, streaks. Coins reset to <strong style={{color:"#ffd24a"}}>200</strong>. Card definitions preserved.</p>
                      <p style={{margin:"0 0 14px",fontSize:"12px",color:"#ff9999"}}>Use immediately before real launch so everyone starts fresh.</p>
                      <div style={{marginBottom:"12px"}}>
                        <div style={{fontSize:"11px",color:"rgba(255,255,255,0.3)",marginBottom:"6px"}}>Type LAUNCH to confirm:</div>
                        <input type="text" placeholder="LAUNCH" value={confirmText} onChange={e=>setConfirmText(e.target.value.toUpperCase())}
                          style={{padding:"9px 14px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,60,60,0.25)",borderRadius:"7px",color:"#fff",fontSize:"14px",outline:"none",width:"140px",letterSpacing:"0.14em"}}/>
                      </div>
                      <button disabled={confirmText!=="LAUNCH"||!!adminAction} onClick={async()=>{
                        setAdminAction("nuke");setAdminResult(null);setConfirmText("");
                        try{const r=await fetch("/api/card-clash/admin/full-reset",{method:"POST",headers:{"Content-Type":"application/json","x-admin-pin":"0601"},body:JSON.stringify({})});
                        const d=await r.json();setAdminResult({ok:r.ok,message:d.message??(r.ok?"Reset complete":d.error),details:d.results});if(r.ok)loadData();}
                        catch(e:any){setAdminResult({ok:false,message:e.message});}finally{setAdminAction(null);}
                      }} style={{padding:"12px 28px",background:confirmText==="LAUNCH"?"linear-gradient(135deg,#c0392b,#e74c3c)":"rgba(255,255,255,0.04)",border:`1px solid ${confirmText==="LAUNCH"?"rgba(255,60,60,0.6)":"rgba(255,255,255,0.08)"}`,borderRadius:"9px",color:confirmText==="LAUNCH"?"#fff":"rgba(255,255,255,0.2)",fontWeight:900,fontSize:"13px",cursor:confirmText==="LAUNCH"&&!adminAction?"pointer":"not-allowed",letterSpacing:"0.08em",boxShadow:confirmText==="LAUNCH"?"0 4px 22px rgba(231,76,60,0.35)":"none",transition:"all 0.2s"}}>
                        {adminAction==="nuke"?"⏳ Resetting…":"☢️ NUCLEAR RESET — LAUNCH READY"}
                      </button>
                    </div>
                    <button onClick={()=>{setAdminAuthed(false);setAdminPin("");setAdminResult(null);setConfirmText("");}} style={{padding:"8px 18px",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"7px",color:"rgba(255,255,255,0.28)",fontSize:"12px",cursor:"pointer",alignSelf:"flex-start"}}>
                      🔒 Lock Admin Panel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CARD MODAL ── */}
      {enlargedCard&&(
        <div onClick={()=>setEnlargedCard(null)} style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.92)",backdropFilter:"blur(14px)"}}>
          <div onClick={e=>e.stopPropagation()} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"22px",padding:"20px"}}>
            <div style={{display:"flex",gap:"32px",alignItems:"flex-start",flexWrap:"wrap",justifyContent:"center"}}>
              <TKDLCard card={enlargedCard} size="lg" locked={!ownedNames.has(enlargedCard.name)}/>
              <div style={{maxWidth:"280px",paddingTop:"8px"}}>
                <h2 style={{fontSize:"22px",fontWeight:900,color:"#fff",margin:"0 0 12px",fontFamily:"'Arial Black',sans-serif"}}>{enlargedCard.name}</h2>
                <div style={{display:"flex",gap:"7px",marginBottom:"16px",flexWrap:"wrap"}}>
                  <Badge color={CAT_COLOR[enlargedCard.category]}>{enlargedCard.category}</Badge>
                  <Badge color={RAR_COLOR[enlargedCard.rarity]}>{enlargedCard.rarity}</Badge>
                  {ownedNames.has(enlargedCard.name)?<Badge color="#00ff88">✓ OWNED</Badge>:<Badge color="rgba(255,255,255,0.28)">NOT OWNED</Badge>}
                </div>
                <p style={{fontSize:"14px",color:"rgba(255,255,255,0.8)",lineHeight:1.65,margin:"0 0 14px"}}>{enlargedCard.effect}</p>
                {enlargedCard.flavourText&&<p style={{fontSize:"12px",color:"rgba(255,255,255,0.3)",fontStyle:"italic",lineHeight:1.5,margin:0,borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:"12px"}}>"{enlargedCard.flavourText}"</p>}
                {!ownedNames.has(enlargedCard.name)&&(
                  <button onClick={()=>{setEnlargedCard(null);setActiveTab("shop");}} style={{marginTop:"18px",padding:"10px 22px",background:"rgba(255,210,74,0.12)",border:"1px solid rgba(255,210,74,0.35)",borderRadius:"8px",color:"#ffd24a",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>
                    🛍️ Buy in Shop
                  </button>
                )}
              </div>
            </div>
            <button onClick={()=>setEnlargedCard(null)} style={{padding:"8px 24px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"6px",color:"rgba(255,255,255,0.45)",cursor:"pointer",fontSize:"13px"}}>✕ Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────
function HudStat({icon,label,value,color}:{icon:string;label:string;value:any;color:string}) {
  return (
    <div style={{background:`linear-gradient(135deg,${color}10,${color}06)`,border:`1px solid ${color}28`,borderRadius:"12px",padding:"10px 18px",textAlign:"center",minWidth:"80px"}}>
      <div style={{fontSize:"18px",marginBottom:"4px"}}>{icon}</div>
      <div style={{fontSize:"16px",fontWeight:900,color,fontFamily:"'Arial Black',Arial,sans-serif",lineHeight:1}}>{value}</div>
      <div style={{fontSize:"9px",color:"rgba(255,255,255,0.3)",marginTop:"4px",letterSpacing:"0.1em",textTransform:"uppercase"}}>{label}</div>
    </div>
  );
}
function Chip({label,active,color,onClick}:{label:string;active:boolean;color:string;onClick:()=>void}) {
  return (
    <button onClick={onClick} style={{padding:"4px 11px",borderRadius:"14px",cursor:"pointer",fontSize:"10px",fontWeight:700,letterSpacing:"0.04em",transition:"all 0.14s",border:"1px solid",whiteSpace:"nowrap",background:active?`${color}1c`:"transparent",color:active?color:"rgba(255,255,255,0.28)",borderColor:active?`${color}50`:"rgba(255,255,255,0.08)",boxShadow:active?`0 0 10px ${color}22`:"none"}}>
      {label}
    </button>
  );
}
function Badge({children,color}:{children:React.ReactNode;color:string}) {
  return <span style={{fontSize:"10px",fontWeight:700,padding:"3px 9px",borderRadius:"14px",background:`${color}1c`,color,border:`1px solid ${color}3c`,letterSpacing:"0.04em"}}>{children}</span>;
}
function SectionHeader({title,subtitle,noMargin}:{title:string;subtitle?:string;noMargin?:boolean}) {
  return (
    <div style={{marginBottom:noMargin?0:"2rem"}}>
      <h2 style={{margin:"0 0 5px",fontSize:"22px",fontWeight:900,color:"#fff",letterSpacing:"0.04em",fontFamily:"'Arial Black',Impact,Arial,sans-serif"}}>{title}</h2>
      {subtitle&&<p style={{margin:0,fontSize:"13px",color:"rgba(255,255,255,0.36)"}}>{subtitle}</p>}
    </div>
  );
}
