import { getPersonaPool, TOUR_PERSONAS, type TourPersona } from "./tourSeed";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Participant = {
  key: string;       // "player" or persona key
  name: string;
  flag: string;
  level: string;
  avg: number;
  tagline: string;
  nickname: string;
};

export type KOMatch = {
  p1Key: string;
  p1Name: string;
  p2Key: string;
  p2Name: string;
  winnerKey: string | null;
};

export type KORound = {
  roundNum: number;
  name: string;
  matches: KOMatch[];
};

export type KOBracket = {
  format: "knockout";
  bracketSize: number;
  legsPerMatch: number;
  setsPerMatch: number | null;
  legsPerSet: number | null;
  difficulty: string;
  participants: Participant[];  // index 0 = player, rest = bots
  rounds: KORound[];
  currentRound: number;
  status: "active" | "completed" | "eliminated";
};

export type PLFixture = {
  night: number;
  opponentKey: string;
  opponentName: string;
  result: "win" | "loss" | null;
};

export type PLStanding = {
  key: string;
  name: string;
  flag: string;
  isPlayer: boolean;
  played: number;
  won: number;
  lost: number;
  points: number;
};

export type PLBracket = {
  format: "premier_league";
  legsPerMatch: number;
  difficulty: string;
  participants: Participant[];
  fixtures: PLFixture[];
  standings: PLStanding[];
  currentNight: number;
  phase: "group" | "final";
  finalOpponentKey: string | null;
  finalResult: "win" | "loss" | null;
  status: "active" | "completed" | "eliminated";
};

export type TourBracket = KOBracket | PLBracket;

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function simulateBotWinner(p1Key: string, p1Avg: number, p2Key: string, p2Avg: number): string {
  const total = p1Avg + p2Avg;
  const p1WinProb = total === 0 ? 0.5 : (p1Avg / total) * 0.7 + 0.15;
  return Math.random() < p1WinProb ? p1Key : p2Key;
}

function personaToParticipant(p: TourPersona): Participant {
  return { key: p.key, name: p.name, flag: p.flag, level: p.level, avg: p.avg, tagline: p.tagline, nickname: p.nickname };
}

const ROUND_NAMES: Record<number, Record<number, string>> = {
  8:  { 1: "Quarter-Finals", 2: "Semi-Finals", 3: "Final" },
  16: { 1: "Round of 16",    2: "Quarter-Finals", 3: "Semi-Finals", 4: "Final" },
};

// ── Knockout bracket generation ───────────────────────────────────────────────

export function generateKOBracket(
  playerName: string,
  difficulty: string,
  bracketSize: 8 | 16,
  legsPerMatch: number,
  setsPerMatch: number | null,
  legsPerSet: number | null,
): KOBracket {
  const pool = getPersonaPool(difficulty);
  const needed = bracketSize - 1;

  let opponents: TourPersona[];
  if (pool.length >= needed) {
    opponents = shuffle(pool).slice(0, needed);
  } else {
    // Repeat pool if not enough personas (rare edge case)
    const repeated = [];
    while (repeated.length < needed) repeated.push(...pool);
    opponents = shuffle(repeated).slice(0, needed);
  }

  const player: Participant = { key: "player", name: playerName, flag: "🎯", level: difficulty, avg: 70, tagline: "That's you.", nickname: "The Challenger" };
  const participants: Participant[] = [player, ...opponents.map(personaToParticipant)];

  // Build rounds — player is always at index 0
  const numRounds = Math.log2(bracketSize);
  const roundNames = ROUND_NAMES[bracketSize] ?? {};
  const rounds: KORound[] = [];

  // Simulate the full bracket, leaving the player's first match open
  // We track which participant is in each "slot" after each round
  let slots = participants.map(p => p.key); // current winner per slot

  for (let r = 1; r <= numRounds; r++) {
    const matchesThisRound = bracketSize / Math.pow(2, r);
    const matches: KOMatch[] = [];

    for (let m = 0; m < matchesThisRound; m++) {
      const p1Key = slots[m * 2];
      const p2Key = slots[m * 2 + 1];
      const p1 = participants.find(p => p.key === p1Key)!;
      const p2 = participants.find(p => p.key === p2Key)!;

      if (r === 1 && m === 0) {
        // Player's first match — leave as unresolved
        matches.push({ p1Key, p1Name: p1.name, p2Key, p2Name: p2.name, winnerKey: null });
      } else if (r === 1) {
        // Bot-vs-bot — simulate immediately
        const winnerKey = simulateBotWinner(p1Key, p1.avg, p2Key, p2.avg);
        matches.push({ p1Key, p1Name: p1.name, p2Key, p2Name: p2.name, winnerKey });
      } else {
        // Higher rounds — defer until current round resolves
        matches.push({ p1Key: "?", p1Name: "TBD", p2Key: "?", p2Name: "TBD", winnerKey: null });
      }
    }

    rounds.push({ roundNum: r, name: roundNames[r] ?? `Round ${r}`, matches });

    // Advance slots for bot-vs-bot matches in round 1
    if (r === 1) {
      const newSlots: string[] = [];
      for (const match of matches) {
        newSlots.push(match.winnerKey ?? match.p1Key); // player slot stays as player key
      }
      slots = newSlots;
    } else {
      slots = slots.map(() => "?");
    }
  }

  return {
    format: "knockout",
    bracketSize,
    legsPerMatch,
    setsPerMatch,
    legsPerSet,
    difficulty,
    participants,
    rounds,
    currentRound: 1,
    status: "active",
  };
}

// ── Advance knockout bracket after a player match result ──────────────────────

export function advanceKOBracket(bracket: KOBracket, playerWon: boolean): { bracket: KOBracket; won: boolean; eliminated: boolean } {
  const b = JSON.parse(JSON.stringify(bracket)) as KOBracket;
  const round = b.rounds[b.currentRound - 1];

  // Find player's match (always the one with p1Key or p2Key === "player")
  const playerMatchIdx = round.matches.findIndex(m => m.p1Key === "player" || m.p2Key === "player");
  const playerMatch = round.matches[playerMatchIdx];

  if (!playerMatch) return { bracket: b, won: false, eliminated: true };

  playerMatch.winnerKey = playerWon ? "player" : (playerMatch.p1Key === "player" ? playerMatch.p2Key : playerMatch.p1Key);

  const isLastRound = b.currentRound === b.rounds.length;

  if (!playerWon) {
    b.status = "eliminated";
    return { bracket: b, won: false, eliminated: true };
  }

  if (isLastRound) {
    b.status = "completed";
    return { bracket: b, won: true, eliminated: false };
  }

  // Simulate any remaining unresolved bot-vs-bot matches in this round
  for (const match of round.matches) {
    if (match.winnerKey === null && match.p1Key !== "?" && match.p2Key !== "?") {
      const p1 = b.participants.find(p => p.key === match.p1Key);
      const p2 = b.participants.find(p => p.key === match.p2Key);
      match.winnerKey = simulateBotWinner(match.p1Key, p1?.avg ?? 60, match.p2Key, p2?.avg ?? 60);
    }
  }

  // Build next round's matches
  const nextRound = b.rounds[b.currentRound];
  const winners = round.matches.map(m => m.winnerKey!);
  const nextMatches: KOMatch[] = [];

  for (let i = 0; i < nextRound.matches.length; i++) {
    const w1Key = winners[i * 2];
    const w2Key = winners[i * 2 + 1];
    const w1 = b.participants.find(p => p.key === w1Key);
    const w2 = b.participants.find(p => p.key === w2Key);

    if (w1Key === "player" || w2Key === "player") {
      nextMatches.push({ p1Key: w1Key, p1Name: w1?.name ?? "You", p2Key: w2Key, p2Name: w2?.name ?? "TBD", winnerKey: null });
    } else {
      // Bot-vs-bot — simulate now
      const winnerKey = simulateBotWinner(w1Key, w1?.avg ?? 60, w2Key, w2?.avg ?? 60);
      nextMatches.push({ p1Key: w1Key, p1Name: w1?.name ?? "TBD", p2Key: w2Key, p2Name: w2?.name ?? "TBD", winnerKey });
    }
  }

  b.rounds[b.currentRound].matches = nextMatches;
  b.currentRound += 1;

  // Continue simulating if next round's player match is bot-vs-bot (shouldn't happen but safety)
  return { bracket: b, won: false, eliminated: false };
}

// ── Premier League bracket generation ─────────────────────────────────────────

export function generatePLBracket(
  playerName: string,
  difficulty: string,
  legsPerMatch: number,
): PLBracket {
  const pool = getPersonaPool(difficulty);
  const needed = 9; // 10 players total, 9 opponents

  let opponents: TourPersona[];
  if (pool.length >= needed) {
    opponents = shuffle(pool).slice(0, needed);
  } else {
    const repeated = [];
    while (repeated.length < needed) repeated.push(...pool);
    opponents = shuffle(repeated).slice(0, needed);
  }

  const player: Participant = { key: "player", name: playerName, flag: "🎯", level: difficulty, avg: 70, tagline: "That's you.", nickname: "The Challenger" };
  const opponentParticipants = opponents.map(personaToParticipant);
  const participants: Participant[] = [player, ...opponentParticipants];

  // Generate fixtures (player faces each opponent once, in shuffled order)
  const opponentOrder = shuffle([...Array(9).keys()].map(i => opponentParticipants[i]));
  const fixtures: PLFixture[] = opponentOrder.map((opp, i) => ({
    night: i + 1,
    opponentKey: opp.key,
    opponentName: opp.name,
    result: null,
  }));

  // Initialise standings
  const standings: PLStanding[] = [
    { key: "player", name: playerName, flag: "🎯", isPlayer: true, played: 0, won: 0, lost: 0, points: 0 },
    ...opponentParticipants.map(p => ({ key: p.key, name: p.name, flag: p.flag, isPlayer: false, played: 0, won: 0, lost: 0, points: 0 })),
  ];

  // Simulate all bot-vs-bot fixtures upfront (stored in standings progression)
  // We simulate the entire bot round-robin here so standings update properly
  for (let i = 0; i < opponentParticipants.length; i++) {
    for (let j = i + 1; j < opponentParticipants.length; j++) {
      const p1 = opponentParticipants[i];
      const p2 = opponentParticipants[j];
      const winnerKey = simulateBotWinner(p1.key, p1.avg, p2.key, p2.avg);
      const loserKey = winnerKey === p1.key ? p2.key : p1.key;
      const ws = standings.find(s => s.key === winnerKey)!;
      const ls = standings.find(s => s.key === loserKey)!;
      ws.played++; ws.won++; ws.points += 2;
      ls.played++; ls.lost++;
    }
  }

  return {
    format: "premier_league",
    legsPerMatch,
    difficulty,
    participants,
    fixtures,
    standings,
    currentNight: 1,
    phase: "group",
    finalOpponentKey: null,
    finalResult: null,
    status: "active",
  };
}

// ── Advance PL bracket after a player match result ────────────────────────────

export function advancePLBracket(bracket: PLBracket, playerWon: boolean): { bracket: PLBracket; won: boolean; eliminated: boolean } {
  const b = JSON.parse(JSON.stringify(bracket)) as PLBracket;

  if (b.phase === "final") {
    b.finalResult = playerWon ? "win" : "loss";
    b.status = playerWon ? "completed" : "eliminated";
    return { bracket: b, won: playerWon, eliminated: !playerWon };
  }

  const fixture = b.fixtures[b.currentNight - 1];
  fixture.result = playerWon ? "win" : "loss";

  // Update player's standing
  const playerStanding = b.standings.find(s => s.isPlayer)!;
  playerStanding.played++;
  if (playerWon) { playerStanding.won++; playerStanding.points += 2; }
  else { playerStanding.lost++; }

  if (b.currentNight < 9) {
    b.currentNight++;
    return { bracket: b, won: false, eliminated: false };
  }

  // Group stage complete — sort standings
  b.standings.sort((a, b) => b.points - a.points || b.won - a.won);
  const top2 = b.standings.slice(0, 2);
  const playerInTop2 = top2.some(s => s.isPlayer);

  if (!playerInTop2) {
    b.status = "eliminated";
    return { bracket: b, won: false, eliminated: true };
  }

  // Player qualifies for the final
  const finalOpponent = top2.find(s => !s.isPlayer)!;
  b.phase = "final";
  b.currentNight = 10;
  b.finalOpponentKey = finalOpponent.key;
  return { bracket: b, won: false, eliminated: false };
}
