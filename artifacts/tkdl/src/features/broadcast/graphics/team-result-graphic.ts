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

const FORMAT_LABELS: Record<string, string> = {
  uneven_team: "Uneven Player Teams",
  doubles_combined: "Combined Doubles",
  doubles_multi: "Multi-Team Doubles",
  shift_standard: "Shift Wars",
  shift_combined: "Combined Shift Wars",
  shift_multi: "Multi-Team Shift Wars",
};

function ids(data: GraphicData, key: string): number[] {
  const value = data[key];
  return Array.isArray(value) ? value.filter((id): id is number => typeof id === "number") : [];
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

  const winnerCount = Math.max(1, ids(data, "winnerEntityIds").length);
  const loserCount = Math.max(1, ids(data, "loserEntityIds").length);
  const isMulti = resultKind.includes("multi");
  const isCombined = resultKind.includes("combined");
  const noun = leagueType === "singles" ? "player" : "team";
  const contextLabel = isMulti
    ? `${winnerCount + loserCount} teams contested the result`
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
