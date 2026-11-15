import { SPONSOR_TIERS, evaluateRequirement, sponsorCatalogue, CURRENT_SPONSOR_DATABASE_VERSION, type Requirement, type SponsorTier, type SportingFacts } from "./sponsors.catalogue.ts";

const CIRCUIT_NAMES: Record<string, string> = { CHALLENGER: "Challenger Tour", VAULT: "Vault", MAJOR: "a major", WORLD_CHAMPIONSHIP: "the World Championship",
  GRASSROOTS: "a local event", REGIONAL: "a regional event", OPEN: "an open event", COUNTY: "a county event", PRO_CIRCUIT: "a Pro Tour event" };
const place = (p: number) => p === 1 ? "win" : p === 2 ? "reach the final of" : `finish top ${p} in`;

/** A sponsor requirement in plain words, whether you meet it, and how close you are. */
export function describeRequirement(rule: Requirement, facts: SportingFacts): { text: string; met: boolean; progress: string | null } {
  if ("all" in rule) { const parts = rule.all.map(r => describeRequirement(r, facts));
    return { text: parts.map(p => p.text).join(" and "), met: parts.every(p => p.met), progress: parts.map(p => p.progress).filter(Boolean).join(" · ") || null }; }
  if ("any" in rule) { const parts = rule.any.map(r => describeRequirement(r, facts));
    return { text: parts.map(p => p.text).join(", or "), met: parts.some(p => p.met), progress: parts.map(p => p.progress).filter(Boolean).join(" · ") || null }; }
  const met = evaluateRequirement(rule, facts) === true;
  switch (rule.fact) {
    case "careerStarted": return { text: "start your career", met, progress: null };
    case "titles": return { text: `win ${rule.min} title${rule.min === 1 ? "" : "s"} (any event)`, met, progress: `${facts.titles} of ${rule.min} won` };
    case "circuitFinish": return { text: `${place(rule.maxPosition)} ${rule.circuits.map(c => CIRCUIT_NAMES[c] ?? c.toLowerCase()).join(" or ")}`, met,
      progress: (() => { const best = Math.min(...rule.circuits.map(c => facts.bestFinishByCircuit[c] ?? Infinity)); return Number.isFinite(best) ? `best so far: ${best === 1 ? "won" : `top ${best}`}` : null; })() };
    case "qualification": return { text: "qualify for the right event", met, progress: null };
    case "professional": return { text: "turn professional", met, progress: null };
    case "tourCard": return { text: "hold a Tour Card", met, progress: null };
    case "worldRanking": return { text: `be ranked in the world's top ${rule.maxPosition}`, met, progress: facts.worldRanking && facts.worldRanking < 100_000 ? `you're #${facts.worldRanking}` : "not ranked yet" };
    case "localTeamRecord": return { text: `play ${rule.minAppearances} team matches and win ${rule.minWins}`, met,
      progress: facts.localTeamRecord ? `${facts.localTeamRecord.appearances} played, ${facts.localTeamRecord.wins} won` : null };
  }
}

const TIER_NAMES: Record<SponsorTier, string> = { LOCAL: "Local sponsors", REGIONAL: "Regional sponsors", PROFESSIONAL: "Professional partners", ELITE: "Elite brands" };
/**
 * Who could sign you next, tier by tier: what that tier's sponsors want and how close you are. Offers arrive by
 * themselves once you meet a requirement (and you have room in your portfolio); this just shows the way.
 */
export function sponsorProspects(facts: SportingFacts, activeTiers: readonly string[]) {
  const catalogue = sponsorCatalogue(CURRENT_SPONSOR_DATABASE_VERSION);
  return SPONSOR_TIERS.map(tier => {
    const defs = catalogue.filter(d => d.terms.tier === tier);
    // The easiest requirement in the tier (the one you're closest to meeting first).
    const options = defs.map(d => ({ d, r: describeRequirement(d.offerRequirement, facts) }));
    const pick = options.find(o => o.r.met) ?? options.sort((a, b) => a.r.text.length - b.r.text.length)[0];
    const bonus = Math.max(0, ...defs.map(d => d.terms.signingBonusPence));
    return { tier, name: TIER_NAMES[tier], sponsors: defs.length, met: !!pick?.r.met, requirement: pick?.r.text ?? null, progress: pick?.r.progress ?? null,
      signed: activeTiers.includes(tier), topSigningBonusPence: bonus, example: pick?.d.terms.displayName ?? null };
  });
}
