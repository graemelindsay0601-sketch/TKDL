import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildInterviewSegment, buildSeasonLaunchSegment, type BroadcastInterviewRow, type SeasonLaunchVoice } from "../interview-feature-math.ts";

function interview(overrides: Partial<BroadcastInterviewRow> = {}): BroadcastInterviewRow {
  return {
    id: 14,
    playerId: 16,
    playerName: "Graeme",
    triggerType: "WIN_STREAK",
    triggerContext: { matchId: 91 },
    completedAt: new Date("2026-09-28T18:00:00.000Z"),
    openerPresenter: "chalky",
    openerQuestion: "What clicked tonight?",
    openerAnswer: "I stayed patient on the doubles.",
    followupPresenter: "ton",
    followupQuestion: "What comes next?",
    followupAnswer: "Keep the pressure on.",
    ...overrides,
  };
}

describe("buildInterviewSegment", () => {
  test("freezes a completed interview into a featured broadcast segment", () => {
    const segment = buildInterviewSegment(interview());
    assert.equal(segment.purpose, "player_interview");
    assert.equal(segment.storyId, null);
    assert.equal(segment.importance, "featured");
    assert.equal(segment.dialogue[0]?.speaker, "A");
    assert.equal(segment.dialogue[1]?.speaker, "B");
    assert.equal(segment.facts?.playerName, "Graeme");
    assert.equal(segment.facts?.matchId, 91);
    assert.equal(segment.facts?.followupAnswer, "Keep the pressure on.");
  });

  test("normalises whitespace, truncates long answers, and respects Ton as opener", () => {
    const segment = buildInterviewSegment(interview({
      openerPresenter: "Ton",
      openerAnswer: `  ${"answer ".repeat(90)}  `,
    }));
    assert.equal(segment.dialogue[0]?.speaker, "B");
    assert.equal(segment.dialogue[1]?.speaker, "A");
    assert.ok(String(segment.facts?.openerAnswer).length <= 420);
    assert.ok(String(segment.facts?.openerAnswer).endsWith("…"));
    assert.doesNotMatch(String(segment.facts?.openerAnswer), /\s{2,}/);
  });
});

describe("buildSeasonLaunchSegment", () => {
  test("groups several player interviews into one launch-week montage", () => {
    const rows: SeasonLaunchVoice[] = [
      { ...interview({ id: 21, playerName: "Graeme", triggerType: "SEASON_LAUNCH" }), currentSeasonId: 8, currentSeasonName: "October 2026", previousSeasonName: "September 2026" },
      { ...interview({ id: 22, playerId: 9, playerName: "Sean", triggerType: "SEASON_LAUNCH" }), currentSeasonId: 8, currentSeasonName: "October 2026", previousSeasonName: "September 2026" },
    ];
    const segment = buildSeasonLaunchSegment(rows);
    assert.equal(segment.purpose, "season_launch");
    assert.equal(segment.dialogue.length, 2);
    assert.deepEqual(segment.facts?.interviewIds, ["21", "22"]);
    assert.equal((segment.facts?.voices as unknown[]).length, 2);
  });
});
