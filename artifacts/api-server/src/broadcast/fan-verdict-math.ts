import type { ProgrammeSegment } from "./director-math.ts";
import { dialogueHoldSeconds } from "./commentary-math.ts";

export type FanVerdictOption = { id: number; label: string; votes: number };
export type FanVerdictPoll = {
  pollId: number;
  question: string;
  activityAt: Date;
  options: FanVerdictOption[];
};

function clean(value: string, max = 240): string {
  const result = value.replace(/\s+/g, " ").trim();
  return result.length > max ? `${result.slice(0, max - 1).trimEnd()}…` : result;
}

export function buildFanVerdictSegment(poll: FanVerdictPoll): ProgrammeSegment {
  const totalVotes = poll.options.reduce((sum, option) => sum + Math.max(0, option.votes), 0);
  const highest = Math.max(...poll.options.map(option => option.votes), 0);
  const leaders = poll.options.filter(option => option.votes === highest && highest > 0);
  const leaderLabel = leaders.length > 1
    ? leaders.map(option => clean(option.label, 80)).join(" and ")
    : clean(leaders[0]?.label ?? "No clear winner", 100);
  const lineA = `The votes are in on our latest Fan Verdict: ${clean(poll.question, 150)}`;
  const lineB = leaders.length > 1
    ? `${totalVotes} votes counted, and it finishes level between ${leaderLabel}.`
    : `${totalVotes} votes counted, with ${leaderLabel} leading the response.`;

  return {
    slot: 9,
    purpose: "fan_verdict",
    importance: "featured",
    storyId: null,
    supportingStoryIds: [],
    storyType: null,
    leagueType: null,
    lifecycleAtBroadcast: null,
    dialogue: [
      { speaker: "A", text: lineA, holdSeconds: dialogueHoldSeconds(lineA) },
      { speaker: "B", text: lineB, holdSeconds: dialogueHoldSeconds(lineB) },
    ],
    validityRules: [],
    graphicKind: "ResultGraphic",
    facts: {
      featureTitle: "Fan Verdict",
      pollId: poll.pollId,
      question: clean(poll.question),
      totalVotes,
      leaderLabel,
      isTie: leaders.length > 1,
      activityAt: poll.activityAt.toISOString(),
      options: poll.options.map(option => ({
        id: option.id,
        label: clean(option.label, 100),
        votes: Math.max(0, option.votes),
        percentage: totalVotes > 0 ? Math.round((Math.max(0, option.votes) / totalVotes) * 100) : 0,
      })),
    },
  };
}
