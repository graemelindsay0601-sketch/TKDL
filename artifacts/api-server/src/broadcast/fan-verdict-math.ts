import type { ProgrammeSegment } from "./director-math.ts";
import { dialogueHoldSeconds } from "./commentary-math.ts";

export type FanVerdictOption = { id: number; label: string; votes: number };
/** A real, already-public comment a real player wrote on the poll's own
 * community post — never anything invented for them (see this file's own
 * header on buildFanVerdictSegment's reactions handling for why that
 * distinction matters). */
export type FanVerdictReaction = { playerName: string; text: string };
export type FanVerdictPoll = {
  pollId: number;
  question: string;
  activityAt: Date;
  options: FanVerdictOption[];
  /** Up to a few of the earliest substantive real comments left on this
   * poll's own community post — fan-verdict.ts's own query already filters
   * to a minimum length and caps the count; this file only ever truncates
   * for display, never selects or invents. Empty when the poll has no
   * comments yet, which is common and not an error. */
  reactions: readonly FanVerdictReaction[];
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

  // Reaction text is real, already-public words a real player chose to post
  // on this exact poll — quoting it here, with their name attached, is
  // repeating what they already said in public, not inventing anything for
  // them. fan-verdict.ts's own query is what keeps this list short and
  // restricted to substantive comments; this function only ever truncates
  // for display and clearly frames the line as "from the comments."
  const topReaction = poll.reactions[0];
  const lineC = topReaction
    ? `One from the comments — ${clean(topReaction.playerName, 60)} wrote: "${clean(topReaction.text, 140)}"`
    : null;

  const dialogue = [
    { speaker: "A" as const, text: lineA, holdSeconds: dialogueHoldSeconds(lineA) },
    { speaker: "B" as const, text: lineB, holdSeconds: dialogueHoldSeconds(lineB) },
  ];
  if (lineC) {
    dialogue.push({ speaker: "A" as const, text: lineC, holdSeconds: dialogueHoldSeconds(lineC) });
  }

  return {
    slot: 9,
    purpose: "fan_verdict",
    importance: "featured",
    storyId: null,
    supportingStoryIds: [],
    storyType: null,
    leagueType: null,
    lifecycleAtBroadcast: null,
    dialogue,
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
      reactions: poll.reactions.map(reaction => ({
        playerName: clean(reaction.playerName, 60),
        text: clean(reaction.text, 160),
      })),
    },
  };
}
