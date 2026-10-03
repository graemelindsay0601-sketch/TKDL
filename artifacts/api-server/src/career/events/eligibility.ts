import type { Rule, SportingFacts, Entrant, EventSnapshot } from "./types.ts";
export type Explanation = { eligible: boolean; routesSatisfied: string[]; routesAvailable: string[]; blockingReasons: string[] };
export function evaluate(rule: Rule, who: Entrant, facts: SportingFacts, entitlement: boolean): Explanation {
  function check(r: Rule): { ok: boolean; known: boolean; reasons: string[] } {
    if (r.op === "ALL_OF" || r.op === "ANY_OF") {
      const children = r.rules.map(check);
      const ok = r.op === "ALL_OF" ? children.every(c => c.ok) : children.some(c => c.ok);
      return { ok, known: r.op === "ALL_OF" ? children.every(c => c.known) : ok || children.every(c => c.known), reasons: ok ? [] : children.flatMap(c => c.reasons) };
    }
    if (r.op === "NOT") { const c = check(r.rule); return { ok: c.known && !c.ok, known: c.known, reasons: c.known && !c.ok ? [] : ["NEGATED_RULE_NOT_SATISFIED"] }; }
    let ok = false, known = true;
    switch (r.op) {
      case "OPEN_ENTRY": ok = true; break;
      case "ENTITLEMENT": ok = entitlement; break;
      case "INVITATION": ok = facts.invited === true; break;
      case "DEFENDING_CHAMPION": ok = facts.defendingChampion === true; break;
      case "COUNTRY": ok = r.values.includes(who.country); break;
      case "REGION": ok = r.values.includes(who.region); break;
      case "STATUS": ok = who.professionalStatus === r.value; break;
      case "TOUR_CARD": case "NON_TOUR_CARD": known = typeof facts.tourCard === "boolean"; ok = known && facts.tourCard === (r.op === "TOUR_CARD"); break;
      case "RANK": known = facts.ranks?.[r.category] !== undefined; ok = known && facts.ranks![r.category]! <= r.maximum && facts.ranks![r.category]! > 0; break;
      case "PREVIOUS_RESULT": ok = (facts.previous?.[r.family] ?? Infinity) <= r.maximum; break;
    }
    return { ok, known, reasons: ok ? [] : [known ? `REQUIRES_${r.op}` : `PROVIDER_UNAVAILABLE_${r.op}`] };
  }
  const r = check(rule);
  if (who.status !== "ACTIVE") return { eligible: false, routesSatisfied: [], routesAvailable: [], blockingReasons: ["RETIRED_PARTICIPANT"] };
  return { eligible: r.ok, routesSatisfied: r.ok ? [rule.op] : [], routesAvailable: r.ok ? [] : [rule.op], blockingReasons: [...new Set(r.reasons)] };
}
export const overlaps = (a: Pick<EventSnapshot, "startDay" | "endDay">, b: Pick<EventSnapshot, "startDay" | "endDay">) => a.startDay <= b.endDay && b.startDay <= a.endDay;
