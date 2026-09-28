import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, Award, CalendarDays, Gauge, Swords, Target, Trophy, Users } from "lucide-react";
import "./match-centre.css";

type Side={name:string;pointsDelta:number|null;eloDelta:number|null};
type Detail={key:string;mode:string;isCombined:boolean;playedAt:string;seasonName:string|null;gameType:string;notes:string|null;stake:number;winner:Side;loser:Side;participants:any[];stats:{winner:any;loser:any}|null;context?:{meetingNumber:number;winnerWinsBefore:number;loserWinsBefore:number}|null};
const labels:Record<string,string>={singles:"Singles",team:"Uneven Teams",doubles:"Doubles Event",shift_wars:"Shift Wars"};
const game=(s:string)=>s.replace(/^(team_|doubles_|shift_wars_)/,"").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const signed=(n:number|null,suffix="")=>n==null?"—":`${n>0?"+":""}${n}${suffix}`;
function checkout(x:any){if(x?.checkoutAttempts==null)return "—";if(!x.checkoutAttempts)return "0%";return `${Math.round(x.checkoutHits/x.checkoutAttempts*100)}%`;}
const PREVIEW:Detail={key:"league-1",mode:"singles",isCombined:false,playedAt:new Date().toISOString(),seasonName:"September 2026",gameType:"501",notes:"A tight league match decided by stronger finishing in the closing visits.",stake:20,winner:{name:"Graeme",pointsDelta:20,eloDelta:18},loser:{name:"Robert",pointsDelta:-20,eloDelta:-18},participants:[],stats:{winner:{darts:24,scores100:5,scores140:2,scores170:0,scores180:1,checkoutAttempts:5,checkoutHits:2},loser:{darts:27,scores100:4,scores140:1,scores170:0,scores180:0,checkoutAttempts:7,checkoutHits:1}},context:{meetingNumber:9,winnerWinsBefore:4,loserWinsBefore:4}};

export default function MatchDetail(){
  const {key}=useParams<{key:string}>(); const [data,setData]=useState<Detail|null>(null); const [error,setError]=useState("");
  useEffect(()=>{if(import.meta.env.DEV&&new URLSearchParams(location.search).get("preview")==="1"){setData(PREVIEW);return;}fetch(`/api/match-centre/${encodeURIComponent(key)}`).then(async r=>{if(!r.ok)throw new Error(r.status===404?"Match not found":"Unable to load match");return r.json();}).then(setData).catch(e=>setError(e.message));},[key]);
  if(error)return <div className="mc-shell"><Link href="/match-centre" className="md-back"><ArrowLeft size={15}/> Match Centre</Link><div className="mc-empty"><Swords/><strong>{error}</strong></div></div>;
  if(!data)return <div className="mc-shell"><div className="mc-empty">Loading match report…</div></div>;
  const statsAvailable=data.stats&&Object.values(data.stats.winner).some(v=>v!=null);
  return <div className="mc-shell md-shell">
    <Link href="/match-centre" className="md-back"><ArrowLeft size={15}/> Back to Match Centre</Link>
    <header className="md-hero">
      <div className="md-meta"><span>{labels[data.mode]??data.mode}</span>{data.isCombined&&<b>UNEVEN FORMAT</b>}<span>{game(data.gameType)}</span></div>
      <div className="md-date"><CalendarDays size={14}/>{format(new Date(data.playedAt),"EEEE, d MMMM yyyy · HH:mm")}{data.seasonName&&<> · {data.seasonName}</>}</div>
      <div className="md-scoreboard">
        <div className="md-team winner"><small>WINNER</small><Trophy/><h1>{data.winner.name}</h1><div>{signed(data.winner.pointsDelta," PTS")} {data.winner.eloDelta!=null&&<span>{signed(data.winner.eloDelta," ELO")}</span>}</div></div>
        <div className="md-result-mark"><strong>DEF.</strong><span>{data.stake}</span><small>POINT MATCH</small></div>
        <div className="md-team loser"><small>RUNNER-UP</small><Swords/><h1>{data.loser.name}</h1><div>{signed(data.loser.pointsDelta," PTS")} {data.loser.eloDelta!=null&&<span>{signed(data.loser.eloDelta," ELO")}</span>}</div></div>
      </div>
    </header>
    {statsAvailable&&<section className="md-panel"><h2><Target/> Match statistics</h2><div className="md-stat-head"><span>{data.winner.name}</span><b>STAT</b><span>{data.loser.name}</span></div>{[["Darts used","darts"],["100+ scores","scores100"],["140+ scores","scores140"],["170+ scores","scores170"],["180s","scores180"]].map(([label,k])=><div className="md-stat" key={k}><strong>{data.stats!.winner[k]??"—"}</strong><span>{label}</span><strong>{data.stats!.loser[k]??"—"}</strong></div>)}<div className="md-stat"><strong>{checkout(data.stats!.winner)}</strong><span>Checkout rate</span><strong>{checkout(data.stats!.loser)}</strong></div></section>}
    {data.context&&<section className="md-panel"><h2><Swords/> Rivalry entering the match</h2><div className="md-rivalry"><div><small>{data.winner.name}</small><strong>{data.context.winnerWinsBefore}</strong><span>previous wins</span></div><div><small>MEETING</small><strong>#{data.context.meetingNumber}</strong><span>{data.context.meetingNumber===1?"First recorded meeting":"recorded head-to-head"}</span></div><div><small>{data.loser.name}</small><strong>{data.context.loserWinsBefore}</strong><span>previous wins</span></div></div></section>}
    {data.participants.length>0&&<section className="md-panel"><h2><Users/> Result settlement</h2><div className="md-settlement">{data.participants.map((p,i)=><div key={i}><div><small>{p.team==="winner"||p.team==="solo"?"WINNING SIDE":"OPPOSITION"}</small><strong>{p.playerName}</strong>{p.fieldedCount&&<span>{p.fieldedCount} darts in rotation</span>}</div><b className={(p.pointsDelta??0)>=0?"positive":"negative"}>{signed(p.pointsDelta," pts")}</b><b>{signed(p.eloDelta," Elo")}</b></div>)}</div></section>}
    <section className="md-summary-grid"><div><Award/><small>COMPETITION</small><strong>{labels[data.mode]??data.mode}</strong></div><div><Gauge/><small>FORMAT</small><strong>{game(data.gameType)}</strong></div><div><CalendarDays/><small>SEASON</small><strong>{data.seasonName??"Historical result"}</strong></div></section>
    {data.notes&&<section className="md-panel"><h2>Match notes</h2><p className="md-notes">{data.notes}</p></section>}
  </div>;
}
