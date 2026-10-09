import {useId,type CSSProperties,type ReactNode} from "react";
import {eventIdentity} from "./presentation";
import {CAREER_KIT_BY_ID} from "./kit-catalog";

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
export function CareerTrophy({name,design=""}:{name:string;design?:string}) {
  const sovereign=/sovereign|distinctive-tall-silver-not-a-crown/.test(`${name.toLowerCase()} ${design}`);
  return <svg viewBox="0 0 100 150" className="career-trophy-svg" role="img" aria-label={`${name}${sovereign?" · tall silver sculpture, not a crown":""}`}>
    <path d="M25 130H75V140H25Z" fill="#222e3b"/><path d="M32 122H68V132H32Z" fill="#b7c5d0"/>
    {sovereign?<><path d="M40 119 34 45 42 10 52 21 62 8 67 46 60 119Z" fill="#c4d3df"/><path d="M48 117 46 39 52 23 57 39 54 117Z" fill="#f3f7fa"/><path d="M37 52 66 44 62 75 39 83Z" fill="#7b91a4"/></>:
      /globe|continental/.test(design)?<><circle cx="50" cy="48" r="29" fill="none" stroke="#c9d7e3" strokeWidth="5"/><ellipse cx="50" cy="48" rx="13" ry="29" fill="none" stroke="#c9d7e3"/><path d="M22 48H78M50 78V122" stroke="#c9d7e3" strokeWidth="6"/></>:
      /crown|arch/.test(design)?<><path d="M27 95V40Q39 5 50 40Q62 5 74 40V95ZM42 96V121H59V96" fill="none" stroke="#cbd8e5" strokeWidth="7"/></>:
      /heritage|bowl/.test(design)?<><path d="M12 46H88Q82 90 56 93V115H71V123H29V115H44V93Q18 90 12 46Z" fill="#c6d2df"/><path d="M13 52H87M27 72H73" stroke="#879cae" strokeWidth="3"/></>:
      /column|geometric|steel|tall-silver|crystal|modern-metal/.test(design)?<><path d="M32 122 26 24 51 10 75 24 67 122Z" fill="#8ba5bd"/><path d="M51 12 50 120H62L69 29Z" fill="#d6e4ef"/><path d="M29 31 50 18" stroke="#e9f0f6" strokeWidth="5"/></>:
      /plate|shield/.test(design)?<><path d="M18 28Q50 9 82 28V76Q78 94 50 114Q22 94 18 76Z" fill="#bac9d8"/><path d="M26 34Q50 21 74 34V71Q70 88 50 101Q30 88 26 71Z" fill="#30485e"/></>:
      <><path d="M25 30H75L65 77 55 90V115H66V123H34V115H45V90L35 77Z" fill="#c4d3df"/><path d="M25 37H10Q8 72 35 72M75 37H90Q92 72 65 72" fill="none" stroke="#96aebf" strokeWidth="5"/></>}
  </svg>;
}
