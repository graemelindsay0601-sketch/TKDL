import type { EventDefinition } from "../calendar/catalogue.ts";

/** Current annual 40-team World Cup format, applied only to future unentered editions. */
export const V29_CALENDAR_REFRESH_KEYS = ["world-cup-of-darts"] as const;

export function buildCatalogueV29(v28: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v28.map(original => {
    const definition = { ...structuredClone(original), eventDatabaseVersion: 29 };
    if (definition.key === "world-cup-of-darts") {
      definition.fieldSize = 80;
      definition.minimumEntrants = 80;
      definition.npcFill = [0, 0];
      definition.format = {
        gameType: "X01", startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE",
        scoringUnit: "LEGS", legsPerSet: null, structure: "WORLD_CUP",
        stages: [
          { key: "groups", kind: "GROUP", bestOfByRound: [7], groupSize: 3, advancePerGroup: 1 },
          { key: "knockout", kind: "KNOCKOUT", bestOfByRound: [15, 15, 15, 19] },
        ],
        days: 4, firstThrowMethod: "BULL_UP", sideSize: 2, pairing: "NATION", matchContext: "major",
      };
      if (!definition.content) throw new Error("World Cup event content is missing");
      definition.content = { ...definition.content,
        summary: "The annual World Cup brings 40 national teams together. Four top-ranked nations enter the last 16; the other teams play in twelve groups of three, with each group winner advancing. Every tie is doubles: best of 7 legs in the groups, best of 15 in the last 16 and quarter-finals and semi-finals, and best of 19 in the final." };
    }
    return definition;
  }));
}
