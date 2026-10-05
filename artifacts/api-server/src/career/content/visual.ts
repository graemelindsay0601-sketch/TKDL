/** Stable cosmetic identity; no sporting random stream, ability or seed input. */
export function npcShirt(id:string) {
  let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  const palettes=[["#20334A","#FFFFFF","#C8A050"],["#253C36","#ECDFBD","#90C8AB"],["#372C4A","#E4DCEE","#AF99DF"],["#23394C","#DCE7ED","#7ABAD4"]];
  const p=palettes[hash%palettes.length];
  return {shirtTemplate:["CLASSIC","CHEVRON","SPLIT"][hash%3],primaryColour:p[0],secondaryColour:p[1],accentColour:p[2]};
}
