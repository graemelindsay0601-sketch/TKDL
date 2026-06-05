import type { Player } from "@workspace/db";

export type Archetype =
  | "EXECUTIONER" | "KINGPIN" | "SHARPSHOOTER" | "TITAN"
  | "SURVIVOR" | "VETERAN" | "CONTENDER" | "CHALLENGER" | "COMPETITOR";

export type Aura =
  | "DOMINANT" | "UNTOUCHABLE" | "LETHAL" | "DANGEROUS"
  | "HUNTED" | "RISING" | "UNSTABLE" | "FALLEN" | "BALANCED";

export type PlayerIdentity = {
  archetype: Archetype;
  archetypeLabel: string;
  archetypeIcon: string;
  aura: Aura;
  auraLabel: string;
  auraColor: string;
  title: string;
};

const ARCHETYPE_META: Record<Archetype, { label: string; icon: string; desc: string }> = {
  EXECUTIONER:   { label: "Executioner",   icon: "☠",  desc: "Ruthless eliminator" },
  KINGPIN:       { label: "Kingpin",       icon: "👑",  desc: "Dominant points leader" },
  SHARPSHOOTER:  { label: "Sharpshooter",  icon: "🏹",  desc: "Precision win rate" },
  TITAN:         { label: "Titan",         icon: "⚡",  desc: "ELO powerhouse" },
  SURVIVOR:      { label: "Survivor",      icon: "🛡",  desc: "Never been eliminated" },
  VETERAN:       { label: "Veteran",       icon: "🎖",  desc: "Most experienced" },
  CONTENDER:     { label: "Contender",     icon: "⚔",  desc: "Rising challenger" },
  CHALLENGER:    { label: "Challenger",    icon: "🎯",  desc: "Up and coming" },
  COMPETITOR:    { label: "Competitor",    icon: "🎲",  desc: "Always in the mix" },
};

const AURA_META: Record<Aura, { label: string; color: string }> = {
  DOMINANT:    { label: "Dominant",    color: "#ff005c" },
  UNTOUCHABLE: { label: "Untouchable", color: "#ffd24a" },
  LETHAL:      { label: "Lethal",      color: "#ff005c" },
  DANGEROUS:   { label: "Dangerous",   color: "#ff6600" },
  HUNTED:      { label: "Hunted",      color: "#0066ff" },
  RISING:      { label: "Rising",      color: "#00cc88" },
  UNSTABLE:    { label: "Unstable",    color: "#ff9500" },
  FALLEN:      { label: "Fallen",      color: "#555577" },
  BALANCED:    { label: "Balanced",    color: "#888899" },
};

export function computeArchetype(player: Player): Archetype {
  const wr = player.careerGamesPlayed > 0
    ? player.careerWins / player.careerGamesPlayed : 0;

  if (player.eliminationsCount >= 3) return "EXECUTIONER";
  if (player.careerPeakElo >= 1100)  return "TITAN";
  if (player.careerGamesPlayed >= 10 && wr >= 0.70) return "SHARPSHOOTER";
  if (player.careerWins >= 12 && wr >= 0.58)        return "KINGPIN";
  if (player.careerGamesPlayed >= 20)               return "VETERAN";
  if (player.careerGamesPlayed >= 10 && player.status === "ACTIVE") return "SURVIVOR";
  if (player.careerWins >= 5)                       return "CONTENDER";
  if (player.careerGamesPlayed >= 2)                return "CHALLENGER";
  return "COMPETITOR";
}

export function computeAura(player: Player, rank: number): Aura {
  if (player.status === "ELIMINATED") return "FALLEN";
  if (player.points < 12)             return "FALLEN";
  if (player.currentWinStreak >= 3 && player.points >= 35) return "DOMINANT";
  if (rank === 1 && player.seasonGamesPlayed >= 3)         return "HUNTED";
  if (player.currentLossStreak >= 2 && player.points < 18) return "UNSTABLE";
  if (player.currentWinStreak >= 2 && player.points < 22)  return "DANGEROUS";
  if (player.currentWinStreak >= 2 && player.points >= 30) return "UNTOUCHABLE";
  if (player.currentWinStreak >= 1 && player.points > 25)  return "LETHAL";
  if (player.points > 27)                                  return "RISING";
  return "BALANCED";
}

export function computeTitle(player: Player, isChampion: boolean): string {
  if (isChampion)                                              return "The Champion";
  if (player.eliminationsCount >= 4)                          return "The Terminator";
  if (player.eliminationsCount >= 2)                          return "The Eliminator";
  const wr = player.careerGamesPlayed > 0 ? player.careerWins / player.careerGamesPlayed : 0;
  if (player.careerPeakElo >= 1100)                            return "The Elite";
  if (player.careerGamesPlayed >= 20 && wr >= 0.65)           return "The Ace";
  if (player.careerGamesPlayed >= 20)                         return "The Veteran";
  if (player.careerWins >= 15)                                return "The Contender";
  if (player.currentWinStreak >= 3)                           return "The Hot Hand";
  if (player.careerWins >= 8)                                 return "The Challenger";
  if (player.careerWins >= 4)                                 return "The Fighter";
  return "The Rookie";
}

export function computeIdentity(
  player: Player,
  rank: number,
  isChampion: boolean
): PlayerIdentity {
  const archetype = computeArchetype(player);
  const aura = computeAura(player, rank);
  return {
    archetype,
    archetypeLabel: ARCHETYPE_META[archetype].label,
    archetypeIcon:  ARCHETYPE_META[archetype].icon,
    aura,
    auraLabel:  AURA_META[aura].label,
    auraColor:  AURA_META[aura].color,
    title: computeTitle(player, isChampion),
  };
}

export { ARCHETYPE_META, AURA_META };
