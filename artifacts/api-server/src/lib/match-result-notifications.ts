export type MatchResultFormat = "singles" | "doubles" | "team" | "shift_wars";

export type MatchResultNotification = {
  playerId: number;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type BuildOptions = {
  format: MatchResultFormat;
  winnerLabel: string;
  loserLabel: string;
  winnerPlayerIds: number[];
  loserPlayerIds: number[];
  stake: number;
  eloChange?: number;
};

/** One result contract shared by Singles, Doubles, Team and Shift Wars. */
export function buildMatchResultNotifications(options: BuildOptions): MatchResultNotification[] {
  const {
    format, winnerLabel, loserLabel, winnerPlayerIds, loserPlayerIds, stake,
    eloChange = 0,
  } = options;
  const isSingles = format === "singles";
  const hasElo = format !== "shift_wars";
  const winTitle = format === "team" ? "Team Match Victory!" : format === "shift_wars" ? "Shift Wars Victory!" : "Victory!";
  const lossTitle = format === "team" ? "Team Match Loss" : format === "shift_wars" ? "Shift Wars Loss" : "Match Loss";
  const shared = isSingles
    ? { matchWinnerId: winnerPlayerIds[0], matchLoserId: loserPlayerIds[0], eloChange, stake }
    : { winnerTeamName: winnerLabel, loserTeamName: loserLabel, ...(hasElo ? { eloChange } : {}), stake };
  const eloWin = hasElo ? ` • +${eloChange} ELO` : "";
  const eloLoss = hasElo ? ` • -${eloChange} ELO` : "";

  return [
    ...winnerPlayerIds.map(playerId => ({
      playerId,
      title: winTitle,
      body: isSingles
        ? `You beat ${loserLabel}${eloWin} • ±${stake} pts`
        : `${winnerLabel} beat ${loserLabel}${eloWin} • ±${stake} pts`,
      data: { ...shared, result: "win" },
    })),
    ...loserPlayerIds.map(playerId => ({
      playerId,
      title: lossTitle,
      body: isSingles
        ? `Lost to ${winnerLabel}${eloLoss} • ±${stake} pts`
        : `${loserLabel} lost to ${winnerLabel}${eloLoss} • ±${stake} pts`,
      data: { ...shared, result: "loss" },
    })),
  ];
}
