import {useId,type CSSProperties,type ReactNode} from "react";
import {eventIdentity} from "./presentation";
import {CAREER_KIT_BY_ID} from "./kit-catalog";
import {PremiumCareerShirt} from "./apparel/premium-shirt";
import {stableNpcWardrobeKitDesignId,type NpcWardrobeTier} from "./apparel/npc-wardrobe";
import {PremiumTrophy,TROPHY_ART,type TrophySize} from "./trophies";

export type ShirtIdentity={shirtTemplate?:string;kitDesignId?:string;kitTintEnabled?:boolean;primaryColour?:string;secondaryColour?:string;accentColour?:string};
/** Premium artwork for each original shirt template (classic polo, chevron, split). */
const TEMPLATE_PREMIUM_KIT:Record<string,string>={CLASSIC:"kit-50-01",CHEVRON:"kit-50-49",SPLIT:"kit-50-16"};
export type ShirtPartner={brandName:string;slot:string;brandId?:string;theme?:"light"|"dark"|"mono"};
const colour=(v:string|undefined,fallback:string)=>/^#[0-9a-f]{6}$/i.test(v??"")?v!:fallback;
export function CareerShirt({identity={},sponsors=[],name="Player",scale="standard",playerId,wardrobeTier="PROFESSIONAL"}:{identity?:ShirtIdentity;sponsors?:ShirtPartner[];name?:string;scale?:"compact"|"standard"|"featured"|"profile";playerId?:string;wardrobeTier?:NpcWardrobeTier}) {
  const clip=useId().replace(/:/g,""),p=colour(identity.primaryColour,"#20334A"),s=colour(identity.secondaryColour,"#FFFFFF"),a=colour(identity.accentColour,"#C8A050");
  // NPC wardrobe = f(stable NPC id) only. Screens pass different (stature-derived) partner lists, so letting
  // them steer the pool would give one NPC different shirts on different screens and as their ranking moves.
  // Current partners are still printed as logos; maker-range shirts are never assigned without a saved choice.
  // Players whose save predates the Kit Studio (no kitDesignId) wear the premium shirt matching their chosen
  // template instead of the old flat vector. Display only: nothing is written to the save.
  const resolvedKitId=identity.kitDesignId??(playerId?stableNpcWardrobeKitDesignId(playerId,{tier:wardrobeTier}):TEMPLATE_PREMIUM_KIT[identity.shirtTemplate??"CLASSIC"]??TEMPLATE_PREMIUM_KIT.CLASSIC);
  const kit=resolvedKitId?CAREER_KIT_BY_ID.get(resolvedKitId):undefined;
  if(kit) {
    return <PremiumCareerShirt identity={{...identity,kitDesignId:resolvedKitId}} sponsors={sponsors} name={name} scale={scale}/>;
  }
  const torso="M32 20 53 12 67 12 88 20 112 39 98 62 85 53 85 126 35 126 35 53 22 62 8 39Z";
  const slots:Record<string,[number,number]>={EQUIPMENT_PARTNER:[60,45],APPAREL_PARTNER:[77,30],PRIMARY_COMMERCIAL:[60,68],SECONDARY_COMMERCIAL:[23,44],LOCAL_REGIONAL_PARTNER:[60,95]};
  return <svg viewBox="0 0 120 140" className={`career-shirt career-shirt-${scale}`} role="img" aria-label={`${name}'s ${identity.shirtTemplate??"CLASSIC"} shirt${sponsors.length?`; partners: ${sponsors.map(x=>x.brandName).join(", ")}`:""}`}>
    <defs><clipPath id={clip}><path d={torso}/></clipPath></defs><path d={torso} fill={p} stroke="#ffffff50" strokeWidth="1.5"/>
    <g clipPath={`url(#${clip})`}>
      {identity.shirtTemplate==="CHEVRON"?<path d="M15 43 60 70 105 43 105 57 60 85 15 57Z" fill={s}/>:identity.shirtTemplate==="SPLIT"?<path d="M60 0H120V140H60Z" fill={s}/>:<path d="M25 50H38V140H25ZM82 50H95V140H82Z" fill={s}/>}
      <path d="M5 37 27 54M93 54 115 37" stroke={a} strokeWidth="7"/>
      {sponsors.slice(0,5).map((b,i)=>{const pos=slots[b.slot]??[60,105];return <g key={`${b.slot}:${i}`}><rect x={pos[0]-17} y={pos[1]-7} width="34" height="12" rx="2" fill="#10151e"/><text x={pos[0]} y={pos[1]+1} fill="white" textAnchor="middle" fontSize="4.5">{b.brandName.slice(0,15)}</text></g>;})}
    </g><path d="M53 12Q60 30 67 12L72 16Q60 38 48 16Z" fill={a}/>
  </svg>;
}
export function CareerPlayerCard({name,nickname,nationality,rank,identity,sponsors,badges=[],scale="standard",playerId}:{name:string;nickname?:unknown;nationality?:string;rank?:number|null;identity?:ShirtIdentity;sponsors?:ShirtPartner[];badges?:string[];scale?:"compact"|"standard"|"featured"|"profile";playerId?:string}) {
  return <article className={`career-player career-player-${scale}`}><CareerShirt playerId={playerId} name={name} identity={identity} sponsors={sponsors} scale={scale}/><div><strong>{name}</strong>{typeof nickname==="string"&&nickname&&<p>“{nickname}”</p>}<p>{nationality}{rank?` · World #${rank}`:""}</p><div className="career-badges">{badges.slice(0,2).map(b=><span key={b}>{b}</span>)}</div></div></article>;
}
export function CareerEventIdentity({eventKey,circuit,level,children,className=""}:{eventKey?:string;circuit?:string;level?:string|number;children:ReactNode;className?:string}) {
  const t=eventIdentity(eventKey,circuit,level);
  return <div className={`career-event-identity identity-${t.className} ${className}`} title={t.motif} style={{"--identity-accent":t.accent} as CSSProperties}>{children}</div>;
}
/** G1: the shared trophy renderer delegates to the E2 premium artwork. Callers that know their event should use
 * AwardPresentation (event-aware); this keeps name/designKey callers working with the same catalogue identity. */
export function CareerTrophy({name,design="",id,size="md",engraving}:{name:string;design?:string;id?:string;size?:TrophySize;engraving?:string}) {
  const known=Object.values(TROPHY_ART).find(a=>a.id===id||a.family&&a.designKey===design||a.name===name);
  return <PremiumTrophy trophy={{id:known?.id??id??null,name}} size={size} engraving={engraving}/>;
}
