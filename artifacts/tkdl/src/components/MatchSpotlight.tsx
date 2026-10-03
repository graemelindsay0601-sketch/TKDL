import { Link } from "wouter";
import { Radio, Swords } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";

type SpotlightMatch = { sessionId:string; matchKey?:string; status:"prematch"|"live"|"finished"; format:string; sides:[string[],string[]]; winnerName?:string; presentation?:{ spotlight?:{ level:"featured"|"major"; kicker:string; reason:string } } };

export function MatchSpotlight({ channel = false }: { channel?: boolean }) {
  const { data } = useFetch<{ spotlight: SpotlightMatch | null }>("/api/match-spotlight");
  const match=data?.spotlight,story=match?.presentation?.spotlight;
  if(!match||!story)return null;
  const left=match.sides[0].join(" & "),right=match.sides[1].join(" & ");
  return <section className={channel?"channel-match-spotlight":"rounded-2xl overflow-hidden"} style={!channel?{border:"1px solid rgba(255,210,74,.3)",background:"linear-gradient(110deg,rgba(255,0,92,.13),rgba(10,5,20,.96) 48%,rgba(0,102,255,.13))"}:undefined}>
    <div className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
      <div><small className="flex items-center gap-1.5 uppercase font-black" style={{color:"#ffd24a",fontFamily:"Oswald,sans-serif",letterSpacing:".16em"}}><Radio className="w-3.5 h-3.5"/>{story.kicker} · {match.status}</small><h2 className="m-0 mt-2 uppercase font-black" style={{fontFamily:"Oswald,sans-serif",fontSize:"clamp(1.35rem,4vw,2.2rem)"}}>{match.status==="finished"&&match.winnerName?`${match.winnerName} wins`:`${left} vs ${right}`}</h2><p className="m-0 mt-1 text-sm" style={{color:"rgba(255,255,255,.43)"}}>{story.reason}</p></div>
      <Link href={match.matchKey?`/match-centre/${match.matchKey}`:"/broadcast"} className="flex items-center gap-2 rounded-lg px-4 py-2.5 uppercase font-black" style={{background:"#ffd24a",color:"#160f00",fontFamily:"Oswald,sans-serif",fontSize:".68rem"}}><Swords className="w-4 h-4"/>{match.matchKey?"Open result":"Watch coverage"}</Link>
    </div>
  </section>;
}
