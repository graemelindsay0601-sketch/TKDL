import type { Npc } from "./types.ts";

/** A pair's playing strength for A2: the two players' abilities, form and tendencies averaged (identity stays the captain's). */
export function teamComposite(captain: Npc, partner: Npc): Npc {
  const avg = <T extends Record<string, number>>(a: T, b: T) => Object.fromEntries(Object.keys(a).map(k => [k, (a[k] + b[k]) / 2])) as T;
  return { ...structuredClone(captain), ability: avg(captain.ability, partner.ability), form: (captain.form + partner.form) / 2, tendencies: avg(captain.tendencies, partner.tendencies) };
}
