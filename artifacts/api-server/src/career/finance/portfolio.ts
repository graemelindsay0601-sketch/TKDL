import { brandById, type RelationshipSlot } from "../content/brands.ts";
import type { SponsorTerms, SportingFacts } from "./sponsors.catalogue.ts";

/** Immutable old terms are interpreted, never rewritten. Unknown legacy brands occupy primary. */
export function relationship(terms: Pick<SponsorTerms, "sponsorKey"> & Partial<SponsorTerms>) {
  const b = brandById(terms.sponsorKey);
  return { slot: terms.relationshipSlot ?? b?.slot ?? "PRIMARY_COMMERCIAL" as RelationshipSlot,
    groups: terms.exclusivityGroups ?? b?.exclusivityGroups ?? ["PRIMARY_COMMERCIAL"] };
}
export function portfolioLimit(facts: SportingFacts) {
  return facts.worldRanking !== null && facts.worldRanking <= 16 ? 5 :
    facts.tourCard === true || facts.titles >= 10 ? 4 : facts.titles >= 3 ? 3 : 2;
}
export function conflicts(terms: SponsorTerms, active: readonly { id: string; sponsor_key: string; terms: SponsorTerms }[]) {
  const r = relationship(terms);
  return active.filter(c => {
    const other = relationship(c.terms);
    return c.sponsor_key === terms.sponsorKey || r.slot === other.slot || r.groups.some(g => other.groups.includes(g));
  }).map(c => c.id);
}
