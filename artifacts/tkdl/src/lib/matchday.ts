export const MATCHDAY_DRAFT_KEY="tkdl_matchday_draft";
export type MatchdayCompetition="singles"|"doubles"|"shift-wars";
export type MatchdayDraft={competition:MatchdayCompetition;sideAId:number;sideBId:number;sideAName:string;sideBName:string;sessionId:string;createdAt:number};
export function saveMatchdayDraft(draft:MatchdayDraft){try{sessionStorage.setItem(MATCHDAY_DRAFT_KEY,JSON.stringify(draft));}catch{/* optional convenience */}}
export function readMatchdayDraft():MatchdayDraft|null{try{const raw=sessionStorage.getItem(MATCHDAY_DRAFT_KEY);if(!raw)return null;const value=JSON.parse(raw) as MatchdayDraft;if(!["singles","doubles","shift-wars"].includes(value.competition)||!Number.isInteger(value.sideAId)||!Number.isInteger(value.sideBId)||value.sideAId===value.sideBId)return null;return value;}catch{return null}}
export function clearMatchdayDraft(){try{sessionStorage.removeItem(MATCHDAY_DRAFT_KEY)}catch{/* ignore */}}
