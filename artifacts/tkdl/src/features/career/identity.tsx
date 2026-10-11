import {useId,type CSSProperties,type ReactNode} from "react";
import {eventIdentity} from "./presentation";
import {CAREER_KIT_BY_ID} from "./kit-catalog";
import {PremiumTrophy,TROPHY_ART,type TrophySize} from "./trophies";

export type ShirtIdentity={shirtTemplate?:string;kitDesignId?:string;kitTintEnabled?:boolean;primaryColour?:string;secondaryColour?:string;accentColour?:string};
export type ShirtPartner={brandName:string;slot:string};
const colour=(v:string|undefined,fallback:string)=>/^#[0-9a-f]{6}$/i.test(v??"")?v!:fallback;
export function CareerShirt({identity={},sponsors=[],name="Player",scale="standard"}:{identity?:ShirtIdentity;sponsors?:ShirtPartner[];name?:string;scale?:"compact"|"standard"|"featured"|"profile"}) {
  const clip=useId().replace(/:/g,""),p=colour(identity.primaryColour,"#20334A"),s=colour(identity.secondaryColour,"#FFFFFF"),a=colour(identity.accentColour,"#C8A050");
  const torso="M32 20 53 12 67 12 88 20 112 39 98 62 85 53 85 126 35 126 35 53 22 62 8 39Z";
  const kit=identity.kitDesignId?CAREER_KIT_BY_ID.get(identity.kitDesignId):undefined;
  if(kit) {
    const image=`${import.meta.env.BASE_URL}assets/career-kit-library/${kit.image}`;
    const partnerSlots:Record<string,[number,number]>={EQUIPMENT_PARTNER:[50,34],APPAREL_PARTNER:[69,21],PRIMARY_COMMERCIAL:[50,54],SECONDARY_COMMERCIAL:[19,37],LOCAL_REGIONAL_PARTNER:[78,64]};
    const wash={"--career-kit-mask":`url("${image}")`,"--career-kit-primary":p} as CSSProperties;
    const tintEnabled=identity.kitTintEnabled!==false&&Boolean(identity.primaryColour);
    return <span className={`career-shirt career-shirt-${scale} career-shirt--library`} role="img" aria-label={`${name}'s ${kit.name} shirt${sponsors.length?`; partners: ${sponsors.map(x=>x.brandName).join(", ")}`:""}`}>
      <img className="career-shirt__artwork" src={image} alt="" aria-hidden="true"/>{tintEnabled&&<span className="career-shirt__wash" style={wash} aria-hidden="true"/>}
      {sponsors.slice(0,5).map((partner,index)=>{const pos=partnerSlots[partner.slot]??[50,72];return <span className="career-shirt__partner" key={`${partner.slot}:${partner.brandName}:${index}`} style={{left:`${pos[0]}%`,top:`${pos[1]}%`}}>{partner.brandName.slice(0,15).toUpperCase()}</span>;})}
    </span>;
  }
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
export function CareerPlayerCard({name,nickname,nationality,rank,identity,sponsors,badges=[],scale="standard"}:{name:string;nickname?:unknown;nationality?:string;rank?:number|null;identity?:ShirtIdentity;sponsors?:ShirtPartner[];badges?:string[];scale?:"compact"|"standard"|"featured"|"profile"}) {
  return <article className={`career-player career-player-${scale}`}><CareerShirt name={name} identity={identity} sponsors={sponsors} scale={scale}/><div><strong>{name}</strong>{typeof nickname==="string"&&nickname&&<p>“{nickname}”</p>}<p>{nationality}{rank?` · World #${rank}`:""}</p><div className="career-badges">{badges.slice(0,2).map(b=><span key={b}>{b}</span>)}</div></div></article>;
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
