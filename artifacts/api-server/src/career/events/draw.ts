import type { Draw, Entrant, Match, EventResult } from "./types.ts";
import { scopedRandom } from "../world/random.ts";
/** Stable bracket slots; ranked seeds are supplied, never inferred from NPC ability. */
export function createDraw(field: Entrant[], seed: string, version: number, eventId: string, seeds: string[] = []): Draw {
  if (field.length < 2 || field.length > 128 || new Set(field.map(p => p.key)).size !== field.length || field.some(p => p.status !== "ACTIVE")) throw new Error("Invalid tournament field");
  if (new Set(seeds).size !== seeds.length || seeds.some(k => !field.some(p => p.key === k))) throw new Error("Invalid supplied seed ordering");
  const rng = scopedRandom(seed, version, "draw", eventId);
  const rest = field.map(p => p.key).filter(k => !seeds.includes(k)).sort();
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const ordered = [...seeds, ...rest];
  const size = 2 ** Math.ceil(Math.log2(field.length));
  let positions = [1, 2];
  while (positions.length < size) { const total = positions.length * 2 + 1; positions = positions.flatMap(n => [n, total - n]); }
  const slots = positions.map(n => ordered[n - 1] ?? null);
  const rounds: Match[][] = [];
  for (let round = 1; round <= Math.log2(size); round++) rounds.push(Array.from({ length: size / 2 ** round }, (_, index) => ({
    id: `ko:r${round}:m${index + 1}`, round, index, a: round === 1 ? slots[index * 2] : null, b: round === 1 ? slots[index * 2 + 1] : null,
    winner: null, loser: null, firstThrow: 0, score: null, source: null, a2Key: null, receipt: null,
  })));
  return { field: structuredClone(field), slots, seeds: [...seeds], rounds };
}
export function populateRound(draw: Draw, round: number) {
  if (round === 0) return;
  const prior = draw.rounds[round - 1];
  if (prior.some(m => m.winner === null)) return;
  draw.rounds[round].forEach((m, i) => { m.a = prior[i * 2].winner; m.b = prior[i * 2 + 1].winner; });
}
export function resultFromDraw(draw: Draw): EventResult {
  const final = draw.rounds.at(-1)![0];
  if (!final.winner || !final.loser) throw new Error("Tournament not complete");
  const matches = draw.rounds.flat();
  return { champion: final.winner, runnerUp: final.loser, qualificationRecipients: [], finishes: draw.field.map(p => {
    const played = matches.filter(m => m.source !== "BYE" && (m.a === p.key || m.b === p.key));
    const loss = played.find(m => m.loser === p.key);
    return { participant: p.key, position: p.key === final.winner ? 1 : loss ? 2 ** (draw.rounds.length - loss.round) + 1 : draw.field.length,
      stage: loss?.round ?? draw.rounds.length, wins: played.filter(m => m.winner === p.key).length, losses: loss ? 1 : 0, matchIds: played.map(m => m.id) };
  }).sort((a, b) => a.position - b.position || a.participant.localeCompare(b.participant)) };
}
export const matchOperationKey = (season: number, eventId: string, matchId: string) => `s:${season}:e:${eventId}:${matchId}`;
