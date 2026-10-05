/** Display-only geometry, filtering and identity. Never imported by sporting code. */
export const CHAMPIONSHIP_THEMES:Record<string,{accent:string;motif:string;className:string}>={
  "the-match-trophy":{accent:"#c8d5df",motif:"Handled silver trophy",className:"match"},
  "the-double-crown":{accent:"#8ab4ee",motif:"Twin arches · double-in",className:"crown"},
  "the-open-masters":{accent:"#b3cdb6",motif:"Heritage bowl",className:"open"},
  "grand-slam-of-champions":{accent:"#d0a6af",motif:"Traditional championship",className:"grand"},
  "continental-finals":{accent:"#72d9e8",motif:"International globe",className:"continental"},
  "pro-tour-finals":{accent:"#6caaff",motif:"Modern steel trophy",className:"tour"},
  "world-championship":{accent:"#e9c77a",motif:"The Palace · Sovereign Trophy",className:"palace"},
};
export function eventIdentity(key="",circuit="",level?:string|number) {
  // Canonical catalogue keys, never a title-sponsor-derived name.
  const canonical=key==="long-format-matchplay"?"the-match-trophy":key==="double-crown"?"the-double-crown":
    key==="open-championship"?"the-open-masters":key==="pro-circuit-finals"?"pro-tour-finals":
    key==="european-championship"?"continental-finals":key==="world-darts-championship"?"world-championship":key;
  const theme=CHAMPIONSHIP_THEMES[canonical];
  if(theme)return theme;
  if(circuit==="WORLD_CHAMPIONSHIP"&&(level==="WORLD"||level===5))return CHAMPIONSHIP_THEMES["world-championship"];
  if(circuit==="VAULT")return {accent:"#b59af3",motif:"Vault Darts",className:"vault"};
  if(circuit==="PRO_CIRCUIT"||circuit==="CHALLENGER")return {accent:"#80b6f7",motif:circuit==="CHALLENGER"?"Challenger Tour":"WDU Pro Tour",className:"pro"};
  if(circuit==="EUROPEAN_SERIES")return CHAMPIONSHIP_THEMES["continental-finals"];
  return {accent:"#86c7c6",motif:"Open darts",className:"local"};
}
export const MAP_VIEWS:Record<string,{x:number;y:number;width:number;height:number}>={
  WORLD:{x:0,y:0,width:720,height:360},EUROPE:{x:330,y:35,width:170,height:130},
  UK_IRELAND:{x:335,y:52,width:32,height:30},SCOTLAND:{x:346,y:62,width:15,height:10},
};
export function projectCoordinate(latitude:number,longitude:number) {
  return {x:(Math.max(-180,Math.min(180,longitude))+180)*2,y:(90-Math.max(-90,Math.min(90,latitude)))*2};
}
export function clusterLocations<T extends {id:string;venue:{mapAnchor:{latitude:number;longitude:number}}}>(events:T[],view:typeof MAP_VIEWS[string],cell=32) {
  const groups=new Map<string,{x:number;y:number;events:T[]}>();
  for(const e of events) {
    const p=projectCoordinate(e.venue.mapAnchor.latitude,e.venue.mapAnchor.longitude);
    if(p.x<view.x||p.x>view.x+view.width||p.y<view.y||p.y>view.y+view.height)continue;
    const key=`${Math.floor((p.x-view.x)/view.width*720/cell)}:${Math.floor((p.y-view.y)/view.height*360/cell)}`;
    const g=groups.get(key);if(g){g.x=(g.x*g.events.length+p.x)/(g.events.length+1);g.y=(g.y*g.events.length+p.y)/(g.events.length+1);g.events.push(e);}
    else groups.set(key,{...p,events:[e]});
  }
  return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,g])=>({key,...g}));
}
export function mapState(e:{status:string;opportunity:{state:string;canEnter:boolean}}) {
  if(e.status==="IN_PROGRESS")return "In Progress";
  if(e.status==="COMPLETED")return "Completed";
  return e.opportunity.state.toLowerCase().split("_").map(s=>s[0]?.toUpperCase()+s.slice(1)).join(" ");
}
export function planningCosts(value:unknown) {
  if(!value||typeof value!=="object")return null;
  const v=value as Record<string,unknown>,s=v.sponsorCoverage as Record<string,unknown>|undefined;
  const keys=["entryFeePence","estimatedTravelPence","estimatedAccommodationPence","estimatedPlayerCostPence"];
  if(!s||!keys.every(k=>typeof v[k]==="number"&&Number.isFinite(v[k]))||!["entryFeePence","travelPence","accommodationPence"].every(k=>typeof s[k]==="number"&&Number.isFinite(s[k])))return null;
  return {commitment:Number(v.entryFeePence)+Number(v.estimatedTravelPence)+Number(v.estimatedAccommodationPence),
    coverage:Number(s.entryFeePence)+Number(s.travelPence)+Number(s.accommodationPence),playerCost:Number(v.estimatedPlayerCostPence)};
}
export function filterMap<T extends {status:string;content:{circuitId?:string};opportunity:{state:string;canEnter:boolean}}>(events:T[],filter:string,completed=false) {
  return events.filter(e=>(completed||!["COMPLETED","CANCELLED"].includes(e.status))&&
    (filter==="ALL"||filter==="OPPORTUNITIES"&&(e.opportunity.canEnter||["ENTERED","CONFIRMED","PLAYING","QUALIFIED"].includes(e.opportunity.state))||
     filter==="ENTERED"&&["ENTERED","CONFIRMED","PLAYING"].includes(e.opportunity.state)||e.content.circuitId===filter));
}
