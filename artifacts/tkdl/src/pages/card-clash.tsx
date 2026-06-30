import { useState, useEffect, useCallback } from "react";
import { useCurrentPlayer } from "@/context/auth";
import { CardShopUI } from "@/components/CardShopUI";
import { FreePackDisplay } from "@/components/FreePackDisplay";
import { FeaturedCardShop } from "@/components/FeaturedCardShop";
import { VirtualizedLeaderboard } from "@/components/VirtualizedLeaderboard";
import { VirtualizedCollection } from "@/components/VirtualizedCollection";
import { getDynamicBuzzMessage, BuzzMessageDisplay, getTimeBasedBuzzMessage } from "@/utils/buzzMessages";
import { AchievementsDisplay } from "@/components/AchievementsDisplay";
import { AdvancedAdminTools } from "@/components/AdvancedAdminTools";
import type { PlayerStats } from "@/utils/achievements";
import { CardClashMatchLauncher } from "@/components/CardClashMatchLauncher";
import { CardClashPracticeUI } from "@/components/CardClashPracticeUI";
import { CardClashPracticeContainer } from "@/components/CardClashPracticeContainer";
import { AdminCardClashSettingsPanel } from "@/components/AdminCardClashSettingsPanel";
import { RulesUI } from "@/components/RulesUI";
import { TKDLCard } from "@/components/TKDLCard";
import { ALL_CARDS } from "@/lib/cards-data";
import type { CardData, Category, Rarity } from "@/lib/cards-data";
import { CollectionIcon, ShopIcon, PlayIcon, PracticeIcon, StandingsIcon, AchievementsIcon, RulesIcon, AdminIcon, LeaderboardIcon, ChampionIcon, TrophyIcon } from "@/components/CardClashIcons";

type Tab = "hub" | "collection" | "shop" | "play" | "practice" | "cc-practice" | "standings" | "achievements" | "rules" | "admin";

const CATEGORIES: Category[] = ["X01 GOOD","X01 BAD","CRICKET GOOD","CRICKET BAD","WILDCARD GOOD","WILDCARD BAD"];
const RARITIES: Rarity[] = ["COMMON","RARE","LEGENDARY"];
const CAT_COLOR: Record<Category,string> = {"X01 GOOD":"#00b4ff","X01 BAD":"#ff3b3b","CRICKET GOOD":"#00cc66","CRICKET BAD":"#9933ff","WILDCARD GOOD":"#ffaa00","WILDCARD BAD":"#cc1111"};
const RAR_COLOR: Record<Rarity,string> = { COMMON:"#9ab0c4", RARE:"#c084fc", LEGENDARY:"#ffd24a" };

interface Stats { coins:number; cardsOwned:number; matchesPlayed:number; wins:number; losses:number; }
interface Standing { player_id:number; player_name:string; wins:number; losses:number; total_matches:number; win_percentage?:number; cards_unlocked_count?:number; coins?:number; cards_owned?:number; updated_at?:string; }

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


  // ── Dartboard sector path helper ─────────────────────────────────────────────
  function sP(cx:number,cy:number,ro:number,ri:number,sa:number,ea:number):string{
    const x1=cx+ro*Math.cos(sa),y1=cy+ro*Math.sin(sa);
    const x2=cx+ro*Math.cos(ea),y2=cy+ro*Math.sin(ea);
    const x3=cx+ri*Math.cos(ea),y3=cy+ri*Math.sin(ea);
    const x4=cx+ri*Math.cos(sa),y4=cy+ri*Math.sin(sa);
    return `M${x1},${y1} A${ro},${ro} 0 0,1 ${x2},${y2} L${x3},${y3} A${ri},${ri} 0 0,0 ${x4},${y4}Z`;
  }

  // ── Pack image ────────────────────────────────────────────────────────────────
    function PackSVG({ packId, scale = 1 }: { packId: string; scale?: number }) {
      const W = Math.round(148 * scale), H = Math.round(236 * scale);
      const PACK_IMGS: Record<string,string> = {
        single: "/assets/pack-league-front.png",
        five:   "/assets/pack-gold-front.png",
        ten:    "/assets/pack-purple-front.png",
      };
      const src = PACK_IMGS[packId] ?? PACK_IMGS.single;
      return (
        <div style={{
          width: W, height: H, position: "relative", overflow: "hidden",
          borderRadius: Math.round(7 * scale),
          boxShadow: `0 ${Math.round(8*scale)}px ${Math.round(32*scale)}px rgba(0,0,0,0.7)`,
        }}>
          <img src={src} alt={packId} loading="lazy"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", maxWidth: "none" }}
          />
        </div>
      );
    }
  

  // ── Hub icon components ───────────────────────────────────────────────────────
  // OPTIMIZATION: SVG icons extracted to CardClashIcons.tsx and memoized
  // This prevents unnecessary re-creation on every render (-10-20ms per render)

  // ── Stat card ─────────────────────────────────────────────────────────────────
  function StatCard({icon,value,label,color}:{icon:string;value:any;label:string;color:string}){
    return(
      <div style={{padding:"14px 6px",borderRadius:"12px",textAlign:"center",background:`linear-gradient(160deg,${color}0e 0%,rgba(2,2,12,0.97) 100%)`,border:`1px solid ${color}28`,boxShadow:`inset 0 1px 0 rgba(255,255,255,0.04),0 6px 22px rgba(0,0,0,0.45)`}}>
        <div style={{fontSize:"22px",marginBottom:"4px"}}>{icon}</div>
        <div style={{fontSize:"clamp(18px,3.5vw,24px)",fontWeight:900,color,fontFamily:"'Arial Black',Arial,sans-serif",lineHeight:1,marginBottom:"4px"}}>{value}</div>
        <div style={{fontSize:"9px",color:"rgba(255,255,255,0.28)",letterSpacing:"0.1em",textTransform:"uppercase"}}>{label}</div>
      </div>
    );
  }
  // ── Hub card ─────────────────────────────────────────────────────────────────
    const HUB_IMGS: Record<string,string> = {
      collection:   "/assets/hub-collection.png",
      shop:         "/assets/hub-shop.png",
      play:         "/assets/hub-play.png",
      practice:     "/assets/hub-practice.png",
      standings:    "/assets/hub-standings.png",
      achievements: "/assets/hub-achievements.png",
      rules:        "/assets/hub-rules.png",
      admin:        "/assets/hub-admin.png",
    };

    function HubCard({label,sublabel,color,glow,onClick,badge,disabled=false,delay=0}:{label:string;sublabel:string;color:string;glow:string;onClick:()=>void;badge?:number|string;disabled?:boolean;delay?:number;icon?:React.ReactNode}){
      const [hov,setHov]=useState(false);
      const key=label.toLowerCase().replace(/[\s/]+/g,"");
      const imgSrc=HUB_IMGS[key];
      return(
        <button onClick={disabled?undefined:onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
          style={{
            all:"unset",display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"flex-end",gap:"4px",padding:"0 10px 12px",
            borderRadius:"14px",cursor:disabled?"not-allowed":"pointer",
            position:"relative",overflow:"hidden",
            transition:"all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
            border:`1px solid ${hov?color+"55":color+"22"}`,
            boxShadow:hov?`0 0 0 1px ${color}28,0 0 35px 6px ${glow},0 18px 40px rgba(0,0,0,0.75)`:`0 0 0 1px ${color}12,0 8px 28px rgba(0,0,0,0.55)`,
            transform:hov?"translateY(-5px) scale(1.025)":"scale(1)",
            opacity:disabled?0.3:1,minHeight:"158px",
            animation:`hubCardFloat 4s ease-in-out infinite ${delay}s`,
          }}>
          <div style={{position:"absolute",inset:0,borderRadius:"14px",overflow:"hidden"}}>
            {imgSrc&&<div style={{
              position:"absolute",inset:0,
              backgroundImage:`url(${imgSrc})`,
              backgroundSize:"cover",
              backgroundPosition:"center center",
              opacity:hov?0.92:0.82,
              transition:"opacity 0.22s",
            }}/>}
            <div style={{position:"absolute",inset:0,background:"linear-gradient(0deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.05) 45%,rgba(0,0,0,0.38) 100%)"}}/>
            <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 50% 110%,${color}28 0%,transparent 65%)`}}/>
          </div>
          {badge!==undefined&&(
            <div style={{position:"absolute",top:"10px",right:"10px",zIndex:10,background:"linear-gradient(135deg,#ff3a5c,#dd0028)",color:"#fff",fontSize:"11px",fontWeight:900,minWidth:"22px",height:"22px",borderRadius:"11px",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 5px",boxShadow:"0 0 14px rgba(255,50,80,0.7)",border:"1.5px solid rgba(255,255,255,0.25)"}}>{badge}</div>
          )}
          <div style={{fontSize:"13px",fontWeight:900,letterSpacing:"0.13em",color:hov?"#fff":color,fontFamily:"'Arial Black',Impact,Arial,sans-serif",textTransform:"uppercase",textShadow:hov?`0 0 22px ${glow},0 0 44px ${glow}`:`0 0 12px ${glow}`,transition:"all 0.2s",zIndex:1,position:"relative"}}>{label}</div>
          <div style={{fontSize:"9px",fontWeight:600,letterSpacing:"0.07em",color:"rgba(255,255,255,0.3)",textTransform:"uppercase",textAlign:"center",lineHeight:1.5,zIndex:1,position:"relative"}}>{sublabel}</div>
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
        fetch("/api/card-clash/leaderboard").then(r=>r.ok?r.json():[]),
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
      <div style={{minHeight:"100vh",background:"#020008",color:"#fff",fontFamily:"Arial,sans-serif",position:"relative",overflowX:"hidden"}}>
        <style>{`
          @keyframes floatA{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-20px) scale(1.02)}}
          @keyframes titleShimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
          @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
          @keyframes packShimmer{0%{left:-60%}100%{left:160%}}
          @keyframes auroraDrift1{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(30px,-20px) scale(1.08)}70%{transform:translate(-20px,25px) scale(0.95)}}
          @keyframes auroraDrift2{0%,100%{transform:translate(0,0) scale(1)}35%{transform:translate(-40px,30px) scale(1.06)}65%{transform:translate(25px,-15px) scale(0.97)}}
          @keyframes auroraDrift3{0%,100%{transform:translate(0,0)}50%{transform:translate(15px,-25px)}}
          @keyframes hubCardFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
          @keyframes glowPulse{0%,100%{opacity:0.7}50%{opacity:1}}
        `}</style>

        {/* ── BACKGROUND IMAGE ── */}
        <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,backgroundImage:"url(/assets/card-clash-bg.png)",backgroundSize:"cover",backgroundPosition:"center top"}}/>
          <div style={{position:"absolute",inset:0,background:"rgba(2,0,8,0.70)"}}/>
          <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(rgba(255,255,255,0.012) 1px,transparent 1px)",backgroundSize:"30px 30px"}}/>
        </div>

        {/* ── CONTENT ── */}
        <div style={{position:"relative",zIndex:1,maxWidth:"980px",margin:"0 auto",padding:"0 16px 80px"}}>

          {/* ── HUB / HOME ── */}
          {activeTab==="hub" && (
            <div style={{animation:"slideUp 0.3s ease"}}>

              {/* Hero */}
              <div style={{textAlign:"center",padding:"2.5rem 0 1.5rem",position:"relative"}}>
                {/* TESCO KILBIRNIE DARTS LEAGUE banner */}
                <div style={{display:"inline-flex",alignItems:"center",gap:"10px",marginBottom:"1.1rem"}}>
                  <div style={{width:"32px",height:"1px",background:"linear-gradient(90deg,transparent,#ffd24a)"}}/>
                  <div style={{background:"linear-gradient(135deg,rgba(255,210,74,0.14),rgba(255,210,74,0.06))",border:"1px solid rgba(255,210,74,0.32)",borderRadius:"20px",padding:"5px 18px"}}>
                    <span style={{color:"#ffd24a",fontSize:"9px",fontWeight:900,letterSpacing:"0.22em",fontFamily:"'Arial Black',Arial,sans-serif"}}>TESCO KILBIRNIE DARTS LEAGUE</span>
                  </div>
                  <div style={{width:"32px",height:"1px",background:"linear-gradient(90deg,#ffd24a,transparent)"}}/>
                </div>

                {/* CARD CLASH title */}
                <div style={{lineHeight:0.86,marginBottom:"0.5rem"}}>
                  <div style={{fontSize:"clamp(64px,10vw,112px)",fontWeight:900,fontFamily:"'Arial Black',Impact,Arial,sans-serif",letterSpacing:"0.06em",textTransform:"uppercase",color:"#ffffff",textShadow:"0 0 60px rgba(100,120,255,0.4),0 0 120px rgba(80,80,255,0.2),0 4px 20px rgba(0,0,0,0.8)"}}>CARD</div>
                  <div style={{fontSize:"clamp(64px,10vw,112px)",fontWeight:900,fontFamily:"'Arial Black',Impact,Arial,sans-serif",letterSpacing:"0.06em",textTransform:"uppercase",background:"linear-gradient(135deg,#ff9000 0%,#ffd24a 35%,#fffaa0 52%,#ffd24a 68%,#ff8800 100%)",backgroundSize:"200% 200%",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",animation:"titleShimmer 4s ease-in-out infinite",filter:"drop-shadow(0 0 40px rgba(255,160,0,0.5))"}}>CLASH</div>
                </div>

                {/* Mini dartboard icon */}
                <div style={{display:"inline-block",marginBottom:"1rem",opacity:0.75}}>
                  <svg width="50" height="50" viewBox="0 0 50 50">
                    {Array.from({length:20},(_,i)=>{const sa=(i/20)*Math.PI*2-Math.PI/2-Math.PI/20,ea=((i+1)/20)*Math.PI*2-Math.PI/2-Math.PI/20,ev=i%2===0;return(<path key={i} d={sP(25,25,22,15,sa,ea)} fill={ev?"#006622":"#cc0000"} stroke="rgba(0,0,0,0.5)" strokeWidth="0.4"/>);})}
                    {Array.from({length:20},(_,i)=>{const sa=(i/20)*Math.PI*2-Math.PI/2-Math.PI/20,ea=((i+1)/20)*Math.PI*2-Math.PI/2-Math.PI/20,ev=i%2===0;return(<path key={`s${i}`} d={sP(25,25,13,4,sa,ea)} fill={ev?"#181008":"#ddd0a8"} stroke="rgba(0,0,0,0.4)" strokeWidth="0.3"/>);})}
                    <circle cx="25" cy="25" r="4" fill="#006622"/><circle cx="25" cy="25" r="1.8" fill="#cc0000"/>
                    <circle cx="25" cy="25" r="22" fill="none" stroke="rgba(255,210,74,0.35)" strokeWidth="1"/>
                  </svg>
                </div>

                {/* Tagline */}
                <p style={{margin:"0 auto 1.6rem",fontSize:"11px",color:"rgba(255,255,255,0.35)",letterSpacing:"0.18em",textTransform:"uppercase"}}>100 CARDS · REAL DARTS CHAOS · MID-MATCH POWER-UPS</p>

                {/* Buzz Message */}
                {stats && (
                  <div style={{maxWidth:"500px",margin:"0 auto 1.6rem"}}>
                    <BuzzMessageDisplay message={getDynamicBuzzMessage({
                      coinBalance: stats.coins || 0,
                      cardsCollected: ownedNames.size,
                      matchesWon: stats.wins || 0,
                      dayStreak: stats.streak || 0,
                      hasUnclaimedPacks: packInventory.length > 0
                    })} />
                  </div>
                )}

                {/* Premium Coins Card */}
                <div style={{
                  marginBottom: "1.5rem",
                  padding: "20px 24px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg,#ffd24a15 0%,#ffb70015 50%,#ffd24a08 100%)",
                  border: "2px solid #ffd24a4d",
                  boxShadow: "inset 0 1px 12px rgba(255,210,74,0.2), 0 12px 40px rgba(255,210,74,0.15)",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {/* Gradient accent */}
                  <div style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: "200px",
                    height: "200px",
                    background: "radial-gradient(circle, rgba(255,210,74,0.15) 0%, transparent 70%)",
                    borderRadius: "50%",
                    filter: "blur(40px)",
                    pointerEvents: "none",
                  }} />
                  
                  <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Current Balance</div>
                      <div style={{ fontSize: "clamp(28px, 6vw, 48px)", fontWeight: 900, color: "#ffd24a", fontFamily: "'Arial Black', Arial, sans-serif", letterSpacing: "-0.02em", textShadow: "0 0 20px rgba(255,210,74,0.4)" }}>
                        {stats?.coins ?? "—"}
                      </div>
                      <div style={{ fontSize: "11px", color: "rgba(255,210,74,0.6)", marginTop: "4px" }}>🪙 Coins available for card packs</div>
                    </div>
                    <div style={{ fontSize: "64px", opacity: 0.3, filter: "drop-shadow(0 0 12px rgba(255,210,74,0.2))" }}>🪙</div>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"0.5rem"}}>
                  <StatCard icon="🃏" value={`${completionPct}%`} label={`${totalOwned}/${ALL_CARDS.length}`} color="#00ccff"/>
                  <StatCard icon="⚡" value={stats?.wins??"—"} label="WINS" color="#00ff88"/>
                  <StatCard icon="🎯" value={stats?`${winRate}%`:"—"} label="WIN RATE" color="#c084fc"/>
                </div>
              </div>

              {/* Hub cards grid — 2 columns */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"2.5rem"}}>
                <HubCard label="Collection" sublabel="Browse & manage your cards" color="#0088ff" glow="rgba(0,136,255,0.35)" delay={0} onClick={()=>goTo("collection")} badge={newCardNames.size>0?newCardNames.size:undefined} icon={<CollectionIcon/>}/>
                <HubCard label="Shop" sublabel="Buy packs & special offers" color="#ffd24a" glow="rgba(255,210,74,0.4)" delay={0.4} onClick={()=>goTo("shop")} badge={packInventory.length>0?packInventory.length:undefined} icon={<ShopIcon/>}/>
                <HubCard label="Play" sublabel="Jump into the action" color="#00ff88" glow="rgba(0,255,136,0.4)" delay={0.8} onClick={()=>goTo("play")} icon={<PlayIcon/>}/>
                <HubCard label="Practice" sublabel="Test your card deck" color="#00ff88" glow="rgba(0,255,136,0.4)" delay={1.2} onClick={()=>goTo("cc-practice")} icon={<PracticeIcon/>}/>
                <HubCard label="Standings" sublabel="See who's on top" color="#c084fc" glow="rgba(192,132,252,0.4)" delay={1.6} onClick={()=>goTo("standings")} icon={<StandingsIcon/>}/>
                <HubCard label="Achievements" sublabel="Earn & unlock rewards" color="#ff8800" glow="rgba(255,136,0,0.4)" delay={2.0} onClick={()=>goTo("achievements")} icon={<AchievementsIcon/>}/>
                <HubCard label="Rules" sublabel="Learn the game" color="#00ccff" glow="rgba(0,204,255,0.35)" delay={2.4} onClick={()=>goTo("rules")} icon={<RulesIcon/>}/>
                <HubCard label="Admin" sublabel="League management" color="#ff2244" glow="rgba(255,34,68,0.4)" delay={2.8} onClick={()=>goTo("admin")} icon={<AdminIcon/>}/>
              </div>

              {/* Pack showcase */}
              <div style={{textAlign:"center",marginBottom:"1rem"}}>
                <div style={{fontSize:"9px",color:"rgba(255,255,255,0.18)",letterSpacing:"0.18em",marginBottom:"18px",textTransform:"uppercase"}}>Available Packs — Tap Shop to Open</div>
                <div style={{display:"flex",gap:"24px",justifyContent:"center",alignItems:"flex-end",flexWrap:"wrap"}}>
                  {PACKS.map((p,i)=>(
                    <div key={p.id} onClick={()=>goTo("shop")} style={{cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"10px",animation:`floatA ${3.0+i*0.7}s ease-in-out infinite ${i*0.9}s`}}>
                      <div style={{filter:`drop-shadow(0 0 22px ${p.glow}) drop-shadow(0 0 50px ${p.glow.replace("0.","0.12")})`,transition:"filter 0.2s",position:"relative",overflow:"hidden"}}>
                        <PackSVG packId={p.id} scale={0.95}/>
                        <div style={{position:"absolute",top:0,bottom:0,width:"36px",background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)",animation:"packShimmer 3.2s linear infinite",pointerEvents:"none",left:"-36px"}}/>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontSize:"10px",fontWeight:700,color:p.accB,letterSpacing:"0.04em",marginBottom:"2px"}}>{p.name}</div>
                        <div style={{fontSize:"13px",fontWeight:900,color:"#ffd24a",fontFamily:"'Arial Black',Arial,sans-serif"}}>🪙 {p.cost}</div>
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
                <div style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg,#ffd24a15,#ffb70010)",
                  border: "1.5px solid #ffd24a40",
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#ffd24a",
                  fontFamily: "'Arial Black', Arial, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  textShadow: "0 0 8px rgba(255,210,74,0.3)",
                  boxShadow: "0 4px 12px rgba(255,210,74,0.15)",
                }}>
                  🪙 {stats?.coins??"—"}
                </div>
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
                ) : filteredCards.length > 0 ? (
                  <VirtualizedCollection 
                    cards={filteredCards.map(card => ({
                      id: card.id,
                      cardId: card.id,
                      name: card.name,
                      rarity: card.rarity,
                      quantity: 1
                    }))}
                    containerHeight="600px"
                  />
                ) : (
                  <div style={{width:"100%",textAlign:"center",padding:"4rem",color:"rgba(255,255,255,0.25)"}}>
                    <div style={{fontSize:"44px",marginBottom:"1rem"}}>🃏</div>
                    <div>No cards match your filters</div>
                  </div>
                )}
              </div>
            )}

            {/* ── SHOP ── */}
            {activeTab==="shop" && (
              <div style={{maxWidth:"680px",margin:"0 auto"}}>
                <SectionHeader title="🛍️ Card Shop" subtitle="Open packs. Build your arsenal. All 100 cards waiting."/>
                <div style={{marginBottom:"20px"}}>
                  <FreePackDisplay playerId={playerId} onClaimPack={loadData} />
                </div>
                <div style={{padding:"22px 24px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:"16px",marginBottom:"1.5rem"}}>
                  <FeaturedCardShop playerId={playerId} playerCoins={stats?.coins || 0} onPurchaseSuccess={loadData} />
                </div>
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
                {/* Challenges moved to player profile "Challenges" tab */}
              </div>
            )}

            {/* ── PRACTICE ── */}
              {activeTab==="practice" && (
                <PracticeTab playerId={playerId} playerName={playerName} standings={standings}/>
              )}

              {activeTab==="cc-practice" && playerId && (
                <CardClashPracticeContainer playerId={playerId} playerName={playerName}/>
              )}

            {activeTab==="standings" && (
              <div>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:"12px",marginBottom:"1.75rem"}}>
                  <SectionHeader title="🏆 Leaderboard" subtitle="All-time Card Clash rankings" noMargin/>
                  <button onClick={loadData} style={{padding:"8px 16px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:"7px",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:"12px"}}>↻ Refresh</button>
                </div>
                {standings.length>0?(
                  <VirtualizedLeaderboard standings={standings} playerId={playerId} containerHeight="600px" />
                ):(
                  <div style={{textAlign:"center",padding:"4rem 1rem",color:"rgba(255,255,255,0.25)"}}>
                    <div style={{fontSize:"44px",marginBottom:"1rem"}}>🏆</div>
                    <div style={{marginBottom:"1rem"}}>Waiting for players to join Card Clash...</div>
                    <div style={{fontSize:"12px",color:"rgba(255,255,255,0.15)"}}>Inactive players will appear here soon</div>
                  </div>
                )}
              </div>
            )}

            {/* ── ACHIEVEMENTS ── */}
            {activeTab==="achievements" && (
              <div>
                <SectionHeader title="🎖️ Achievements" subtitle="Complete challenges to earn coins and free packs"/>
                {stats && (
                  <AchievementsDisplay 
                    playerStats={{
                      cardsOwned: ownedNames.size,
                      totalCardsInGame: ALL_CARDS.length,
                      matchesWon: stats.wins || 0,
                      matchesLost: (stats.losses || 0),
                      totalMatches: (stats.wins || 0) + (stats.losses || 0),
                      totalCoinsEarned: stats.totalCoinsEarned || 0,
                      currentCoinBalance: stats.coins || 0,
                      dayLoginStreak: stats.streak || 0,
                      cardsLegendary: Array.from(ownedNames).filter(name => ALL_CARDS.find(c => c.name === name)?.rarity === 'LEGENDARY').length,
                      cardsRare: Array.from(ownedNames).filter(name => ALL_CARDS.find(c => c.name === name)?.rarity === 'RARE').length,
                      cardsCommon: Array.from(ownedNames).filter(name => ALL_CARDS.find(c => c.name === name)?.rarity === 'COMMON').length,
                      perfectMatches: stats.perfectMatches || 0,
                      practiceMatches: stats.practiceMatches || 0,
                      highestWinStreak: stats.winStreak || 0,
                      allCardsCollected: ownedNames.size === ALL_CARDS.length,
                      allLegendariesCollected: Array.from(ownedNames).filter(name => ALL_CARDS.find(c => c.name === name)?.rarity === 'LEGENDARY').length === ALL_CARDS.filter(c => c.rarity === 'LEGENDARY').length,
                      allRaresCollected: Array.from(ownedNames).filter(name => ALL_CARDS.find(c => c.name === name)?.rarity === 'RARE').length === ALL_CARDS.filter(c => c.rarity === 'RARE').length,
                    }}
                  />
                )}
              </div>
            )}

            {/* ── RULES ── */}
            {activeTab==="rules" && (
              <div>
                <RulesUI />
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
                    <AdminCardClashSettingsPanel adminPin="0601" />
                    <AdvancedAdminTools playerId={playerId} adminPin="0601" />
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


  // ── Practice Tab ─────────────────────────────────────────────────────────────
  const PRACTICE_GAMES = [
    {id:"atw",  name:"Around the World",            desc:"Hit 1–20 in order, then bull to win.",                             icon:"🌍", players:"1–2 PLAYERS", diff:"BEGINNER",     diffC:"#00cc66", type:"practice"},
    {id:"atwr", name:"Round the World (Trebles)",   desc:"As above, but must hit the treble of each number.",                icon:"✕3", players:"1–2 PLAYERS", diff:"INTERMEDIATE", diffC:"#0077ff", type:"practice"},
    {id:"rtc",  name:"Round the Clock",             desc:"Hit 1–20 in order. No bull required.",                             icon:"🕐", players:"1–2 PLAYERS", diff:"BEGINNER",     diffC:"#00cc66", type:"practice"},
    {id:"shanghai",name:"Shanghai",                  desc:"Rounds 1–7. Hit single, double, and treble of the round number to win.", icon:"🎯", players:"1–2 PLAYERS", diff:"ADVANCED",     diffC:"#ff4466", type:"practice"},
    {id:"cricket",  name:"Cricket",                  desc:"Close 15–20 and bull before your opponent.",                      icon:"🏏", players:"2 PLAYERS",   diff:"INTERMEDIATE", diffC:"#0077ff", type:"competitive"},
    {id:"killer",   name:"Killer",                   desc:"Assign a number via double, then eliminate others.",              icon:"⚡", players:"2–6 PLAYERS", diff:"ADVANCED",     diffC:"#ff4466", type:"party"},
    {id:"bob",      name:"Bob's 27",                 desc:"Start with 27 points. Hit each double in order.",                icon:"🎰", players:"1–2 PLAYERS", diff:"INTERMEDIATE", diffC:"#0077ff", type:"mini"},
    {id:"halfit",   name:"Half-It",                  desc:"Miss a target and your score is halved.",                         icon:"½",  players:"1–4 PLAYERS", diff:"INTERMEDIATE", diffC:"#0077ff", type:"party"},
  ] as const;
  type PGame = typeof PRACTICE_GAMES[number];

  function PracticeTab({playerId,playerName,standings}:{playerId:number|undefined;playerName:string;standings:Standing[]}){
    const [practiceType,setPracticeType]=useState<"regular"|"cardclash">("regular");
    const [mode,setMode]=useState<"2p"|"cpu"|"solo">("2p");
    const [gt,setGt]=useState<"practice"|"competitive"|"party"|"mini">("practice");
    const [p2Id,setP2Id]=useState<number|null>(null);
    const [saved,setSaved]=useState<Set<string>>(new Set());
    const [launching,setLaunching]=useState(false);
    const [practiceMatchId,setPracticeMatchId]=useState<number|null>(null);

    const opp=standings.filter(s=>s.player_id!==playerId);
    const filtered=PRACTICE_GAMES.filter(g=>g.type===gt);

    const MODES=[
      {id:"2p"  as const, label:"2 PLAYERS",   sub:"Head to Head",   emoji:"👥"},
      {id:"cpu" as const, label:"SOLO VS CPU", sub:"Test your skills",emoji:"🤖"},
      {id:"solo"as const, label:"SOLO PLAY",   sub:"Practice alone",  emoji:"🚶"},
    ];
    const GTS=[
      {id:"practice"    as const, label:"PRACTICE",    emoji:"🎯"},
      {id:"competitive" as const, label:"COMPETITIVE", emoji:"🏆"},
      {id:"party"       as const, label:"PARTY",       emoji:"🎉"},
      {id:"mini"        as const, label:"MINI-GAMES",  emoji:"🎲"},
    ];
    const DIFF_COLOR={BEGINNER:"#00cc66",INTERMEDIATE:"#0077ff",ADVANCED:"#ff4466"} as Record<string,string>;

    if(launching){
      if(practiceType === "cardclash" && practiceMatchId) {
        return(
          <CardClashPracticeGame
            playerId={playerId}
            playerName={playerName}
            practiceMatchId={practiceMatchId}
            onDone={() => {
              setLaunching(false);
              setPracticeMatchId(null);
            }}
          />
        );
      }
      return(
        <div>
          <button onClick={()=>setLaunching(false)} style={{all:"unset",display:"inline-flex",alignItems:"center",gap:"8px",padding:"9px 18px",borderRadius:"8px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.45)",fontSize:"12px",fontWeight:700,letterSpacing:"0.07em",cursor:"pointer",marginBottom:"1.5rem"}}>← BACK</button>
          <div style={{padding:"20px",textAlign:"center",color:"rgba(255,255,255,0.5)"}}>Loading practice match...</div>
        </div>
      );
    }

    return(
      <div style={{paddingBottom:"2rem"}}>

        {/* ── PRACTICE TYPE TOGGLE ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"1.75rem"}}>
          <button
            onClick={()=>setPracticeType("regular")}
            style={{
              all:"unset",
              padding:"14px 16px",
              borderRadius:"12px",
              cursor:"pointer",
              background:practiceType==="regular"?"linear-gradient(135deg,rgba(124,58,237,0.35),rgba(76,29,149,0.45))":"rgba(255,255,255,0.03)",
              border:`1.5px solid ${practiceType==="regular"?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`,
              color:practiceType==="regular"?"#e9d5ff":"rgba(255,255,255,0.45)",
              fontSize:"13px",
              fontWeight:700,
              letterSpacing:"0.06em",
              textAlign:"center",
              transition:"all 0.2s",
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              gap:"8px"
            }}
          >
            🎯 Regular Practice
          </button>
          <button
            onClick={()=>setPracticeType("cardclash")}
            style={{
              all:"unset",
              padding:"14px 16px",
              borderRadius:"12px",
              cursor:"pointer",
              background:practiceType==="cardclash"?"linear-gradient(135deg,rgba(0,200,150,0.35),rgba(0,150,120,0.45))":"rgba(255,255,255,0.03)",
              border:`1.5px solid ${practiceType==="cardclash"?"rgba(0,200,150,0.5)":"rgba(255,255,255,0.08)"}`,
              color:practiceType==="cardclash"?"#7eebd5":"rgba(255,255,255,0.45)",
              fontSize:"13px",
              fontWeight:700,
              letterSpacing:"0.06em",
              textAlign:"center",
              transition:"all 0.2s",
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              gap:"8px"
            }}
          >
            🎴 Card Clash Practice
          </button>
        </div>

        {/* ── CARD CLASH PRACTICE ── */}
        {practiceType==="cardclash"&&playerId&&(
          <CardClashPractice
            playerId={playerId}
            playerName={playerName}
            onMatchCreated={(matchId, playerEquipment, botEquipment)=>{
              setPracticeMatchId(matchId);
              setLaunching(true);
            }}
          />
        )}

        {/* ── REGULAR PRACTICE ── */}
        {practiceType==="regular"&&(
        <div style={{position:"relative",borderRadius:"16px",overflow:"hidden",marginBottom:"1.5rem",padding:"28px 22px 20px"}}>
          {/* Background layers */}
          <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,#0d0020 0%,#06001a 40%,#0a0030 100%)"}}/>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 80% 30%,rgba(180,60,255,0.28) 0%,transparent 60%)"}}/>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 20% 70%,rgba(0,100,255,0.18) 0%,transparent 55%)"}}/>
          {/* Stadium silhouette hint at bottom */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:"60px",background:"linear-gradient(0deg,rgba(255,80,0,0.08) 0%,transparent 100%)"}}/>
          {/* Content */}
          <div style={{position:"relative",display:"flex",alignItems:"center",gap:"16px"}}>
            <div style={{width:"54px",height:"54px",borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed 0%,#4c1d95 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px",boxShadow:"0 0 28px rgba(124,58,237,0.65)",border:"1.5px solid rgba(167,139,250,0.4)",flexShrink:0}}>⚙️</div>
            <div>
              <h1 style={{margin:0,fontSize:"clamp(28px,5vw,40px)",fontWeight:900,fontFamily:"'Arial Black',Impact,Arial,sans-serif",letterSpacing:"0.07em",color:"#fff",textShadow:"0 0 40px rgba(167,139,250,0.5)"}}>PRACTICE</h1>
              <p style={{margin:"3px 0 0",fontSize:"12px",color:"rgba(255,255,255,0.38)",letterSpacing:"0.05em"}}>No stakes. No leaderboard. Just reps.</p>
            </div>
          </div>
          {/* Decorative glow line */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:"2px",background:"linear-gradient(90deg,#7c3aed,#4c1d95,#7c3aed)"}}/>
        </div>
        )}

        {/* ── MODE SELECTOR ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"1.75rem"}}>
          {MODES.map(m=>{
            const sel=mode===m.id;
            return(
              <button key={m.id} onClick={()=>setMode(m.id)} style={{
                all:"unset",display:"flex",flexDirection:"column",gap:"5px",
                padding:"14px 12px 12px",borderRadius:"12px",cursor:"pointer",position:"relative",overflow:"hidden",
                background:sel?"linear-gradient(145deg,rgba(124,58,237,0.45) 0%,rgba(76,29,149,0.55) 100%)":"rgba(255,255,255,0.03)",
                border:`1.5px solid ${sel?"rgba(167,139,250,0.65)":"rgba(255,255,255,0.08)"}`,
                boxShadow:sel?"0 0 24px rgba(124,58,237,0.45),inset 0 1px 0 rgba(167,139,250,0.2)":"inset 0 1px 0 rgba(255,255,255,0.03)",
                transition:"all 0.2s",
              }}>
                {sel&&<div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 0%,rgba(167,139,250,0.15) 0%,transparent 70%)",pointerEvents:"none"}}/>}
                <div style={{display:"flex",alignItems:"center",gap:"8px",position:"relative"}}>
                  <span style={{fontSize:"16px"}}>{m.emoji}</span>
                  <span style={{fontSize:"11px",fontWeight:900,letterSpacing:"0.08em",color:sel?"#e9d5ff":"rgba(255,255,255,0.45)",fontFamily:"'Arial Black',sans-serif"}}>{m.label}</span>
                </div>
                <span style={{fontSize:"9px",color:sel?"rgba(233,213,255,0.55)":"rgba(255,255,255,0.22)",letterSpacing:"0.04em",position:"relative"}}>{m.sub}</span>
                {sel&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:"2px",background:"linear-gradient(90deg,transparent,#a78bfa,transparent)"}}/>}
              </button>
            );
          })}
        </div>

        {/* ── PLAYERS ── (2P only) */}
        {mode==="2p"&&(
          <div style={{marginBottom:"1.75rem"}}>
            <div style={{fontSize:"10px",fontWeight:900,color:"rgba(255,255,255,0.35)",letterSpacing:"0.2em",marginBottom:"10px"}}>PLAYERS</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 44px 1fr",gap:"8px",alignItems:"center"}}>
              {/* P1 */}
              <div style={{borderRadius:"12px",padding:"14px",background:"rgba(0,200,80,0.06)",border:"1.5px solid rgba(0,200,80,0.45)",boxShadow:"0 0 20px rgba(0,200,80,0.12)"}}>
                <div style={{fontSize:"9px",fontWeight:900,color:"#00cc66",letterSpacing:"0.18em",marginBottom:"10px"}}>PLAYER 1</div>
                <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"9px 11px",borderRadius:"8px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}}>
                  <div style={{width:"30px",height:"30px",borderRadius:"50%",background:"linear-gradient(135deg,#22cc55,#008833)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:"13px",color:"#fff",flexShrink:0}}>
                    {(playerName||"?")[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontSize:"12px",fontWeight:700,color:"#fff"}}>{playerName||"You"}</div>
                    <div style={{fontSize:"9px",color:"rgba(255,255,255,0.28)"}}>Level {standings.find(s=>s.player_id===playerId)?.wins??0}</div>
                  </div>
                  <div style={{marginLeft:"auto",color:"rgba(255,255,255,0.25)",fontSize:"12px"}}>∨</div>
                </div>
              </div>
              {/* VS badge */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{width:"38px",height:"38px",borderRadius:"50%",background:"linear-gradient(135deg,#4c1d95,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:900,color:"#e9d5ff",boxShadow:"0 0 18px rgba(124,58,237,0.55)",border:"1px solid rgba(167,139,250,0.35)"}}>VS</div>
              </div>
              {/* P2 */}
              <div style={{borderRadius:"12px",padding:"14px",background:"rgba(255,50,80,0.06)",border:"1.5px solid rgba(255,50,80,0.45)",boxShadow:"0 0 20px rgba(255,50,80,0.12)"}}>
                <div style={{fontSize:"9px",fontWeight:900,color:"#ff4466",letterSpacing:"0.18em",marginBottom:"10px"}}>PLAYER 2</div>
                <div style={{padding:"9px 11px",borderRadius:"8px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}}>
                  <select value={p2Id??""} onChange={e=>setP2Id(e.target.value?Number(e.target.value):null)} style={{width:"100%",background:"transparent",border:"none",color:p2Id?"#fff":"rgba(255,255,255,0.3)",fontSize:"12px",fontWeight:p2Id?700:400,outline:"none",cursor:"pointer"}}>
                    <option value="" style={{background:"#0a0020"}}>Select player...</option>
                    {opp.map(o=><option key={o.player_id} value={o.player_id} style={{background:"#0a0020"}}>{o.player_name}</option>)}
                  </select>
                  <div style={{fontSize:"9px",color:"rgba(255,255,255,0.22)",marginTop:"3px"}}>Choose your opponent</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── GAME TYPE FILTER ── */}
        <div style={{marginBottom:"1.25rem"}}>
          <div style={{fontSize:"10px",fontWeight:900,color:"rgba(255,255,255,0.35)",letterSpacing:"0.2em",marginBottom:"10px"}}>GAME TYPE</div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            {GTS.map(g=>{
              const sel=gt===g.id;
              return(
                <button key={g.id} onClick={()=>setGt(g.id)} style={{
                  all:"unset",display:"flex",alignItems:"center",gap:"6px",
                  padding:"8px 16px",borderRadius:"20px",cursor:"pointer",
                  background:sel?"rgba(255,255,255,0.09)":"rgba(255,255,255,0.04)",
                  border:`1px solid ${sel?"rgba(255,255,255,0.22)":"rgba(255,255,255,0.08)"}`,
                  color:sel?"#fff":"rgba(255,255,255,0.35)",
                  fontSize:"11px",fontWeight:sel?700:500,letterSpacing:"0.07em",
                  boxShadow:sel?"0 2px 14px rgba(0,0,0,0.35)":"none",
                  transition:"all 0.15s",whiteSpace:"nowrap",position:"relative",
                }}>
                  <span style={{fontSize:"13px"}}>{g.emoji}</span>
                  {g.label}
                  {sel&&<div style={{position:"absolute",bottom:"-1px",left:"50%",transform:"translateX(-50%)",width:"40%",height:"2px",background:"linear-gradient(90deg,transparent,#a78bfa,transparent)",borderRadius:"2px"}}/>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── GAME LIST ── */}
        <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"1.75rem"}}>
          {filtered.map((g:PGame)=>{
            const isSaved=saved.has(g.id);
            return(
              <button key={g.id} onClick={()=>setLaunching(true)} style={{
                all:"unset",display:"flex",alignItems:"center",gap:"14px",
                padding:"16px 16px",borderRadius:"12px",cursor:"pointer",textAlign:"left",
                background:"rgba(255,255,255,0.03)",
                border:"1px solid rgba(255,255,255,0.07)",
                position:"relative",overflow:"hidden",
                transition:"all 0.18s",
              }}
              onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background="rgba(124,58,237,0.12)";el.style.borderColor="rgba(124,58,237,0.38)";}}
              onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background="rgba(255,255,255,0.03)";el.style.borderColor="rgba(255,255,255,0.07)";}}>
                {/* Left accent bar */}
                <div style={{position:"absolute",left:0,top:"20%",bottom:"20%",width:"3px",borderRadius:"3px",background:`linear-gradient(180deg,${DIFF_COLOR[g.diff]},${DIFF_COLOR[g.diff]}88)`}}/>
                {/* Icon circle */}
                <div style={{width:"50px",height:"50px",borderRadius:"50%",background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(76,29,149,0.6))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0,border:"1.5px solid rgba(124,58,237,0.4)",boxShadow:"0 0 16px rgba(124,58,237,0.25)"}}>
                  {g.icon}
                </div>
                {/* Text */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"14px",fontWeight:800,color:"#fff",marginBottom:"3px",letterSpacing:"0.02em"}}>{g.name}</div>
                  <div style={{fontSize:"11px",color:"rgba(255,255,255,0.35)",lineHeight:1.4,marginBottom:"8px"}}>{g.desc}</div>
                  <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                    <span style={{fontSize:"9px",fontWeight:600,color:"rgba(255,255,255,0.3)",letterSpacing:"0.05em"}}>👥 {g.players}</span>
                    <span style={{fontSize:"9px",fontWeight:700,letterSpacing:"0.06em",color:DIFF_COLOR[g.diff],background:`${DIFF_COLOR[g.diff]}18`,padding:"2px 9px",borderRadius:"10px",border:`1px solid ${DIFF_COLOR[g.diff]}40`}}>{g.diff}</span>
                  </div>
                </div>
                {/* Right side */}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"14px",flexShrink:0}}>
                  <button onClick={e=>{e.stopPropagation();setSaved(p=>{const n=new Set(p);n.has(g.id)?n.delete(g.id):n.add(g.id);return n;})}}
                    style={{all:"unset",cursor:"pointer",fontSize:"16px",opacity:isSaved?1:0.25,color:isSaved?"#ffd24a":"#fff",transition:"all 0.15s"}}>
                    🔖
                  </button>
                  <span style={{color:"rgba(255,255,255,0.25)",fontSize:"18px",fontWeight:300}}>›</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Card Clash Practice CTA ── */}
        <div style={{borderRadius:"14px",background:"linear-gradient(135deg,rgba(0,255,136,0.08),rgba(0,200,100,0.04))",border:"1px solid rgba(0,255,136,0.2)",padding:"18px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"14px",boxShadow:"0 0 24px rgba(0,255,136,0.06)"}}>
          <div>
            <div style={{fontSize:"14px",fontWeight:900,color:"#00ff88",letterSpacing:"0.05em",marginBottom:"4px",fontFamily:"'Arial Black',sans-serif"}}>⚡ CARD CLASH PRACTICE</div>
            <div style={{fontSize:"11px",color:"rgba(255,255,255,0.32)"}}>No coins spent · No cards consumed · Test your deck</div>
          </div>
          <button onClick={()=>setLaunching(true)} style={{all:"unset",padding:"10px 22px",borderRadius:"8px",cursor:"pointer",background:"linear-gradient(135deg,#00cc66,#008833)",color:"#fff",fontSize:"12px",fontWeight:900,letterSpacing:"0.07em",boxShadow:"0 4px 20px rgba(0,200,100,0.4)",flexShrink:0,transition:"all 0.15s"}}>PLAY NOW</button>
        </div>

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
