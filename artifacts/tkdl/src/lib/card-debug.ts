/**
 * Card Clash Debug Tools
 * Provides dev-mode logging and utilities for Card Clash feature development
 */

export const CARD_CLASH_DEV_MODE = true; // Set to false for production

interface CardDebugLog {
  timestamp: string;
  component: string;
  action: string;
  data: unknown;
}

// Kept generous (a full match easily produces a few hundred entries between
// scoring, card activation, and Chaos Lab Board Mark events) so a match log
// downloaded at the end genuinely covers the whole match, not just the tail.
const MAX_LOGS = 2000;
const debugLogs: CardDebugLog[] = [];

/**
 * Log Card Clash debug message (console + memory)
 */
export function cardDebugLog(component: string, action: string, data?: unknown) {
  if (!CARD_CLASH_DEV_MODE) return;

  const timestamp = new Date().toISOString();
  const log: CardDebugLog = { timestamp, component, action, data };
  
  debugLogs.push(log);
  if (debugLogs.length > MAX_LOGS) debugLogs.shift();

  console.log(
    `%c[CARD_CLASH:${component}] ${action}`,
    "color: #ffd24a; font-weight: bold",
    data
  );
}

/**
 * Get all debug logs since start
 */
export function getCardDebugLogs(): CardDebugLog[] {
  return [...debugLogs];
}

/**
 * Clear debug logs — call at the start of a new match so each match's
 * downloadable log doesn't carry over noise from a previous one.
 */
export function clearCardDebugLogs() {
  debugLogs.length = 0;
}

/**
 * Print debug logs to console (for easy inspection)
 */
export function printCardDebugLogs() {
  console.table(debugLogs);
}

/**
 * Render the current log buffer as readable, plain-text lines — one per
 * event, in order, with a readable local timestamp. This is what gets
 * downloaded/sent to the backend as a match log: something a person can
 * read directly and paste into a bug report, not just raw JSON.
 */
export function formatCardDebugLogsAsText(): string {
  return debugLogs
    .map((l) => {
      const dataStr = l.data === undefined ? "" : ` ${safeStringify(l.data)}`;
      return `[${l.timestamp}] [${l.component}] ${l.action}${dataStr}`;
    })
    .join("\n");
}

function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

/**
 * Validate card state during match
 */
export function validateCardState(state: {
  equippedCards?: unknown[];
  cardsUsed?: unknown[];
  playerTurn?: 0 | 1;
}) {
  if (!CARD_CLASH_DEV_MODE) return true;

  const issues: string[] = [];

  if (state.equippedCards && !Array.isArray(state.equippedCards)) {
    issues.push("equippedCards is not an array");
  }

  if (state.cardsUsed && !Array.isArray(state.cardsUsed)) {
    issues.push("cardsUsed is not an array");
  }

  if (state.equippedCards && state.equippedCards.length > 4) {
    issues.push(`equippedCards has ${state.equippedCards.length} cards (max 4)`);
  }

  if (issues.length > 0) {
    cardDebugLog("Validation", "Card state issues", issues);
    return false;
  }

  return true;
}

/**
 * Format card info for logging
 */
export function formatCard(card: any) {
  if (!card) return "null";
  return `${card.name || "Unknown"}(ID:${card.id},${card.good_or_bad || "?"})`;
}

/**
 * Format card effect application for logging
 */
export function formatCardEffect(card: any, effect: any) {
  return {
    card: formatCard(card),
    effect: effect?.type || "unknown",
    value: effect?.value,
    target: effect?.target,
  };
}
