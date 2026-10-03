// TKDL LIVE — SeasonSpecialGraphic's own data model. One graphic kind, two
// board shapes — a gamerscore leaderboard and a Hall of Fame nods board —
// both built directly by edition-engine.ts's buildSeasonFinaleSpecialSegments
// as Season-Finale-only utility segments: real, already-verified career-wide
// numbers with no broadcast_stories row behind either one (same situation
// director-math.ts's own ProgrammeSegment.graphicKind comment documents,
// same "rows: array of plain objects" convention LeagueTableGraphic.tsx's
// own editorial-desk branch already relies on — buildGraphicFacts only ever
// touches a key ending in Id/Ids, so a plain "rows"/"nods" array of objects
// reaches this model completely untouched).
import { str } from "./kit";
import type { GraphicData } from "../types";

export type GamerscoreRow = { rank: number; name: string; gamerscore: number };
export type HallOfFameNod = { category: string; name: string; stat: string };

export type SeasonSpecialModel =
  | { kind: "gamerscore_leaderboard"; title: string; rows: GamerscoreRow[] }
  | { kind: "hall_of_fame_nods"; title: string; nods: HallOfFameNod[] };

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    : [];
}

function asGamerscoreRows(value: unknown): GamerscoreRow[] {
  return asRecordArray(value)
    .map(row => ({
      rank: typeof row.rank === "number" ? row.rank : 0,
      name: typeof row.name === "string" ? row.name : "Unknown",
      gamerscore: typeof row.gamerscore === "number" ? row.gamerscore : 0,
    }))
    .filter(row => row.rank > 0);
}

function asHallOfFameNods(value: unknown): HallOfFameNod[] {
  return asRecordArray(value)
    .map(nod => ({
      category: typeof nod.category === "string" ? nod.category : "",
      name: typeof nod.name === "string" ? nod.name : "Unknown",
      stat: typeof nod.stat === "string" ? nod.stat : "",
    }))
    .filter(nod => nod.category.length > 0);
}

export function buildSeasonSpecialModel(data: GraphicData): SeasonSpecialModel | null {
  const specialKind = str(data, "specialKind");
  const title = str(data, "title") ?? "";

  if (specialKind === "gamerscore_leaderboard") {
    const rows = asGamerscoreRows((data as Record<string, unknown>).rows);
    return rows.length > 0 ? { kind: "gamerscore_leaderboard", title, rows } : null;
  }
  if (specialKind === "hall_of_fame_nods") {
    const nods = asHallOfFameNods((data as Record<string, unknown>).nods);
    return nods.length > 0 ? { kind: "hall_of_fame_nods", title, nods } : null;
  }
  return null;
}
