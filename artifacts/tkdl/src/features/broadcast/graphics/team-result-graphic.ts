import type { GraphicData, LeagueType } from "../types";

export type TeamResultGraphicModel = {
  formatLabel: string;
  contextLabel: string;
  valueLabel: "Stake" | "Pot";
  value: number;
  winnerName: string;
  loserName: string;
  winnerCount: number;
  loserCount: number;
};

// Exported so poster-reveal-graphic.ts (PosterRevealGraphic.tsx's own data
// model) can label a plain Singles MATCH_RESULT's resultKind ("singles")
// through the exact same table, rather than keeping a second copy that
// could drift out of sync with this one.
export const FORMAT_LABELS: Record<string, string> = {
  singles: "Singles",
  uneven_team: "Uneven Player Teams",
  doubles_combined: "Combined Doubles",
  doubles_multi: "Multi-Team Doubles",
  shift_standard: "Shift Wars",
  shift_combined: "Combined Shift Wars",
  shift_multi: "Multi-Team Shift Wars",
  team_match: "Team Match",
  multi_killer: "Multi-Killer",
};

function num(data: GraphicData, key: string): number | null {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(data: GraphicData, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function buildTeamResultGraphicModel(
  leagueType: LeagueType | null,
  data: GraphicData,
): TeamResultGraphicModel | null {
  const resultKind = text(data, "resultKind");
  const winnerName = text(data, "winnerName");
  const loserName = text(data, "loserName");
  const stake = data.stake;
  if (!resultKind || !winnerName || !loserName || typeof stake !== "number" || !Number.isFinite(stake)) return null;

  // winnerCount/loserCount are plain numbers (detectTeamResult's own
  // addition) — see this file's own num() header. By the time a graphic
  // sees `data`, commentary-engine.ts's buildGraphicFacts() has already
  // replaced any "*EntityIds" array with a resolved "*NamesJoined" string
  // (its own header: a raw id can't be shown to a viewer as-is), so reading
  // an id array's own .length here would always be zero — TEAM_RESULT never
  // fired before winnerCount/loserCount existed, so there's no older
  // persisted row to fall back for.
  const winnerCount = num(data, "winnerCount") ?? 1;
  const loserCount = num(data, "loserCount") ?? 1;
  const isMulti = resultKind.includes("multi");
  const isCombined = resultKind.includes("combined");
  const noun = leagueType === "singles" ? "player" : "team";
  const contextLabel = isMulti
    ? `${countLabel(winnerCount + loserCount, noun)} contested the result`
    : isCombined
      ? `${countLabel(winnerCount, noun)} beat ${countLabel(loserCount, noun)}`
      : winnerCount !== loserCount
        ? `${countLabel(winnerCount, noun)} versus ${countLabel(loserCount, noun)}`
        : "Standard head-to-head result";

  return {
    formatLabel: FORMAT_LABELS[resultKind] ?? resultKind.replaceAll("_", " "),
    contextLabel,
    valueLabel: isMulti || isCombined ? "Pot" : "Stake",
    value: stake,
    winnerName,
    loserName,
    winnerCount,
    loserCount,
  };
}
