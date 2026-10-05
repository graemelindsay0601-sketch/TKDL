export const OPPORTUNITY_STATES = ["AVAILABLE","ENTERED","QUALIFIED","QUALIFIER_AVAILABLE","NOT_QUALIFIED","INELIGIBLE","COMPLETED","MISSED_OR_CLOSED"] as const;
export type OpportunityState=typeof OPPORTUNITY_STATES[number];
type Facts={status:string;classification:string;human:{relationship:string;eligible:boolean;canEnter:boolean;denials:string[];eligibilityReasons:string[]}|null};
/** Projection of A3/A4/A5 facts, not an alternative eligibility engine. */
export function opportunity(event:Facts):{state:OpportunityState;reasons:string[];canEnter:boolean;authority:string} {
  const h=event.human, reasons=h?.denials??[];
  const qualifications=["REQUIRES_TOUR_CARD","REQUIRES_QUALIFICATION","REQUIRES_RANKING","REQUIRES_INVITATION","REQUIRES_EVENT_RESULT","REQUIRES_DEFENDING_CHAMPION"];
  let state:OpportunityState;
  if(event.status==="COMPLETED")state="COMPLETED";
  else if(h&&["ENTERED","CONFIRMED","PLAYING","COMPLETED"].includes(h.relationship))state="ENTERED";
  else if(event.status==="CANCELLED"||["LOCKED","DRAWN","IN_PROGRESS"].includes(event.status)||reasons.some(r=>["REGISTRATION_CLOSED","FIELD_LOCKED","EVENT_FINISHED"].includes(r)))state="MISSED_OR_CLOSED";
  else if(h&&!h.eligible)state=h.eligibilityReasons.some(r=>qualifications.includes(r))?"NOT_QUALIFIED":"INELIGIBLE";
  else if(h?.relationship==="QUALIFIED")state="QUALIFIED";
  else if(h?.canEnter&&event.classification==="QUALIFIER")state="QUALIFIER_AVAILABLE";
  else state="AVAILABLE";
  return {state,reasons:[...new Set([...reasons,...(h?.eligibilityReasons??[])])],canEnter:h?.canEnter??false,authority:"A3 eligibility/entries; A4 finance; A5 sporting facts"};
}
