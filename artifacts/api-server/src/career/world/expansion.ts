import { generateNpc } from "./generation.ts";
import { localIdentity } from "./geographical-identities.ts";
import { SUBSTITUTE_BANKS } from "./name-banks.ts";
import { scopedRandom } from "./random.ts";
import { npcSchema, type Npc, type Tier } from "./types.ts";
import { LOCALITIES } from "../calendar/geography.ts";

/**
 * Player database v4: a worldwide population. The v3 world (about 220 players plus the junior and women's
 * cohorts) left most home areas with a handful of local players and every other host country empty, so local
 * events ran short and tours abroad could not fill. v4 adds, for new saves:
 *  - a club squad in every home area (4 + 4 × the area's weight: about 8–16 players; mostly grassroots, some
 *    amateurs, about 15% women), named and living locally;
 *  - an international squad for each host country with no home pool (Denmark, Spain, Poland, …): 12 players from
 *    tour level down to club level.
 * Each new season tops every squad back up to its size (retired players are replaced by new local entrants).
 * Squad members are ordinary players in every other way. Deterministic from the world seed.
 */
export const CLUB_SQUAD = { base: 4, perWeight: 4, womenShare: 0.15, amateurShare: 0.3 } as const;
export const INTERNATIONAL_SQUAD: readonly Tier[] = ["PROFESSIONAL", "AMATEUR", "AMATEUR", "AMATEUR", "GRASSROOTS", "GRASSROOTS",
  "GRASSROOTS", "GRASSROOTS", "GRASSROOTS", "GRASSROOTS", "GRASSROOTS", "GRASSROOTS"];
export const clubSquadSize = (weight: number) => Math.round(CLUB_SQUAD.base + CLUB_SQUAD.perWeight * weight);
export const INTERNATIONAL_COUNTRIES = [...new Set(SUBSTITUTE_BANKS.map(b => b.country))];

const squadOf = (npc: Npc) => {
  const m = /^(?:women:)?(club|intl):([^:]+):/.exec(npc.worldKey);
  return m ? `${m[1]}:${m[2]}` : null;
};

export function worldExpansion(seed: string, version: number, season: number, existing: readonly Npc[], tag: string): Npc[] {
  const used = new Set(existing.map(p => `${p.firstName} ${p.surname}`));
  const active = new Map<string, number>();
  for (const p of existing) if (p.status === "ACTIVE") { const s = squadOf(p); if (s) active.set(s, (active.get(s) ?? 0) + 1); }
  const out: Npc[] = [];
  const make = (worldKey: string, tier: Tier, country: string, region: string | null, women: boolean) => {
    const identity = localIdentity(seed, worldKey, country, region, women, used);
    if (!identity) return;
    const npc = generateNpc(seed, version, worldKey, tier, season, new Set(used), false);
    out.push(npcSchema.parse({ ...npc, ...identity, nickname: null }));
  };
  for (const l of LOCALITIES) {
    const need = clubSquadSize(l.weight) - (active.get(`club:${l.key}`) ?? 0);
    for (let i = 0; i < need; i++) {
      const rng = scopedRandom(seed, version, "club-squad", l.key, tag, i);
      const women = rng() < CLUB_SQUAD.womenShare, tier: Tier = rng() < CLUB_SQUAD.amateurShare ? "AMATEUR" : "GRASSROOTS";
      make(`${women ? "women:" : ""}club:${l.key}:${tag}:${i}`, tier, l.country, l.region, women);
    }
  }
  for (const country of INTERNATIONAL_COUNTRIES) {
    const need = INTERNATIONAL_SQUAD.length - (active.get(`intl:${country}`) ?? 0);
    for (let i = 0; i < need; i++) {
      // The founding squad spans tour to club level; later entrants join at club level and develop.
      const tier = tag === "initial" ? INTERNATIONAL_SQUAD[i] : "GRASSROOTS";
      const women = scopedRandom(seed, version, "intl-squad", country, tag, i)() < CLUB_SQUAD.womenShare;
      make(`${women ? "women:" : ""}intl:${country}:${tag}:${i}`, tier, country, null, women);
    }
  }
  return out;
}
