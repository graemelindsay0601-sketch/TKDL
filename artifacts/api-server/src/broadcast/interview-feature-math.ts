import type { ProgrammeSegment } from "./director-math.ts";
import { dialogueHoldSeconds } from "./commentary-math.ts";

export type BroadcastInterviewRow = {
  id: number;
  playerId: number;
  playerName: string;
  triggerType: string;
  triggerContext: Record<string, unknown> | null;
  completedAt: Date;
  openerPresenter: string;
  openerQuestion: string;
  openerAnswer: string;
  followupPresenter: string | null;
  followupQuestion: string | null;
  followupAnswer: string | null;
};

export type SeasonLaunchVoice = BroadcastInterviewRow & {
  currentSeasonId: number;
  currentSeasonName: string;
  previousSeasonName: string;
};

const TRIGGER_LABELS: Record<string, string> = {
  MAJOR_UPSET: "a major upset",
  WIN_STREAK: "extending a winning streak",
  "180_MILESTONE": "reaching a 180 milestone",
};

function presenterId(value: string): "A" | "B" {
  return value.toLowerCase() === "ton" ? "B" : "A";
}

function cleanQuote(value: string, maxLength = 420): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trimEnd()}…` : clean;
}

export function buildInterviewSegment(row: BroadcastInterviewRow): ProgrammeSegment {
  const triggerLabel = TRIGGER_LABELS[row.triggerType] ?? "a standout TKDL moment";
  const firstSpeaker = presenterId(row.openerPresenter);
  const secondSpeaker = firstSpeaker === "A" ? "B" : "A";
  const lineA = `After ${triggerLabel}, ${row.playerName} joined us at the Interview Desk.`;
  const lineB = `These are ${row.playerName}'s own words from the post-match conversation.`;
  const matchId = Number(row.triggerContext?.matchId);

  return {
    slot: 9,
    purpose: "player_interview",
    importance: "featured",
    storyId: null,
    supportingStoryIds: [],
    storyType: null,
    leagueType: null,
    lifecycleAtBroadcast: null,
    dialogue: [
      { speaker: firstSpeaker, text: lineA, holdSeconds: dialogueHoldSeconds(lineA) },
      { speaker: secondSpeaker, text: lineB, holdSeconds: dialogueHoldSeconds(lineB) },
    ],
    validityRules: [],
    graphicKind: "ResultGraphic",
    facts: {
      featureTitle: "After the Oche",
      interviewId: row.id,
      playerId: row.playerId,
      playerName: row.playerName,
      triggerType: row.triggerType,
      triggerLabel,
      completedAt: row.completedAt.toISOString(),
      ...(Number.isInteger(matchId) && matchId > 0 ? { matchId } : {}),
      openerPresenter: row.openerPresenter,
      openerQuestion: cleanQuote(row.openerQuestion, 260),
      openerAnswer: cleanQuote(row.openerAnswer),
      followupPresenter: row.followupPresenter,
      followupQuestion: row.followupQuestion ? cleanQuote(row.followupQuestion, 260) : null,
      followupAnswer: row.followupAnswer ? cleanQuote(row.followupAnswer) : null,
    },
  };
}

export function buildSeasonLaunchSegment(rows: SeasonLaunchVoice[]): ProgrammeSegment {
  const first = rows[0];
  if (!first) throw new Error("A Season Launch segment needs at least one completed interview");
  const voices = rows.map(row => ({
    interviewId: row.id,
    playerId: row.playerId,
    playerName: row.playerName,
    openerPresenter: row.openerPresenter,
    openerQuestion: cleanQuote(row.openerQuestion, 190),
    openerAnswer: cleanQuote(row.openerAnswer, 260),
    followupPresenter: row.followupPresenter,
    followupQuestion: row.followupQuestion ? cleanQuote(row.followupQuestion, 190) : null,
    followupAnswer: row.followupAnswer ? cleanQuote(row.followupAnswer, 260) : null,
  }));
  const dialogue = rows.map((row, index) => {
    const text = index === 0
      ? `${row.playerName} leads our League Voices look ahead to ${first.currentSeasonName}.`
      : `Next, ${row.playerName} on last season and the campaign ahead.`;
    return { speaker: presenterId(row.openerPresenter), text, holdSeconds: dialogueHoldSeconds(text) };
  });

  return {
    slot: 9,
    purpose: "season_launch",
    importance: "featured",
    storyId: null,
    supportingStoryIds: [],
    storyType: null,
    leagueType: "singles",
    lifecycleAtBroadcast: null,
    dialogue,
    validityRules: [],
    graphicKind: "ResultGraphic",
    facts: {
      featureTitle: "League Voices",
      currentSeasonId: first.currentSeasonId,
      currentSeasonName: first.currentSeasonName,
      previousSeasonName: first.previousSeasonName,
      interviewIds: rows.map(row => String(row.id)),
      voices,
    },
  };
}
