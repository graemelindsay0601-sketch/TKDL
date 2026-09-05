import { BroadcastPlayerPreview } from "@/features/broadcast/BroadcastPlayer";
import type {
  CurrentEdition,
  LiveOverlayClass,
  LiveOverlayItem,
  LiveTickerItem,
  Scene,
  Segment,
} from "@/features/broadcast/types";
import {
  PREVIEW_MODES,
  PREVIEW_OVERLAYS,
  PREVIEW_SCENES,
} from "@/features/broadcast/preview-matrix";

function dialogue(...lines: Array<["A" | "B", string]>) {
  return lines.map(([speaker, text]) => ({ speaker, text, holdSeconds: 12 }));
}

const SCENE_SEGMENTS: Record<Scene, Segment> = {
  desk: {
    id: "preview-desk",
    type: "OPENING",
    leagueType: null,
    storyId: null,
    importance: "utility",
    scene: "desk",
    dialogue: dialogue(
      ["A", "Good evening. The match board has been busy, and one result has changed the shape of the title race."],
      ["B", "Busy is one word for it, Alex. I had a prediction ready before that result. It is now safely in the bin."],
      ["A", "A wise editorial decision. We will start with the result that forced the rewrite."],
    ),
    graphic: null,
    championInfo: null,
    validityRules: [],
    estimatedSeconds: 36,
  },
  headlines: {
    id: "preview-headlines",
    type: "HEADLINES",
    leagueType: "singles",
    storyId: 1001,
    importance: "headline_ticker",
    scene: "headlines",
    dialogue: dialogue(
      ["A", "Richard holds the lead, but the gap has tightened after a dramatic night at the oche."],
      ["B", "And later, we look at the quiet climber turning consistency into a genuine title challenge."],
    ),
    graphic: null,
    championInfo: null,
    validityRules: [],
    estimatedSeconds: 24,
  },
  result: {
    id: "preview-result",
    type: "MAJOR_UPSET",
    leagueType: "singles",
    storyId: 1002,
    importance: "major",
    scene: "result",
    dialogue: dialogue(
      ["A", "Sean has beaten the league leader, taking a result the model rated as distinctly unlikely."],
      ["B", "That was not a lucky escape. Sean stayed in the leg, waited for the opening, and took it."],
      ["A", "The immediate consequence is a much tighter race at the top."],
      ["B", "And a considerably quieter prediction model, I would imagine."],
    ),
    graphic: {
      kind: "ResultGraphic",
      data: { winnerName: "Sean", loserName: "Richard", stake: 8, winnerProbabilityPct: 29 },
    },
    championInfo: null,
    validityRules: [],
    estimatedSeconds: 48,
  },
  analysis: {
    id: "preview-analysis",
    type: "TITLE_RACE",
    leagueType: "singles",
    storyId: 1003,
    importance: "featured",
    scene: "analysis",
    dialogue: dialogue(
      ["A", "Richard remains favourite, but the model now gives Graeme and Sean a credible route back into contention."],
      ["B", "Credible, yes. Comfortable, absolutely not. Every remaining points decision matters now."],
      ["A", "That is the tension: one favourite, two live challengers, and very little margin left."],
    ),
    graphic: {
      kind: "TitlePredictorGraphic",
      data: {
        viableEntityNamesJoined: "Richard, Graeme, Sean",
        probabilities: [0.52, 0.31, 0.17],
      },
    },
    championInfo: null,
    validityRules: [],
    estimatedSeconds: 36,
  },
  spotlight: {
    id: "preview-spotlight",
    type: "QUIET_CLIMBER",
    leagueType: "singles",
    storyId: 1004,
    importance: "featured",
    scene: "spotlight",
    dialogue: dialogue(
      ["A", "Graeme has moved into second without the noise that usually accompanies a title charge."],
      ["B", "That is because the work has been wonderfully boring: turn up, stay steady, take the available points."],
      ["A", "Boring can look very impressive when the table keeps moving in your direction."],
    ),
    graphic: {
      kind: "FormWatchGraphic",
      data: { playerName: "Graeme", positionBefore: 4, currentPosition: 2, matches: 5 },
    },
    championInfo: null,
    validityRules: [],
    estimatedSeconds: 36,
  },
  graphic: {
    id: "preview-graphic",
    type: "HISTORICAL_H2H",
    leagueType: "singles",
    storyId: 1005,
    importance: "archive",
    scene: "graphic",
    dialogue: dialogue(
      ["A", "Their meetings have remained close across the available record, with neither player able to establish lasting control."],
      ["B", "Which is the polite statistical way of saying: do not make plans for an early finish."],
      ["A", "I was going to say finely balanced, but yours is more memorable."],
    ),
    graphic: {
      kind: "HeadToHeadGraphic",
      data: { playerAName: "Richard", playerBName: "Sean", playerAWins: 4, playerBWins: 3 },
    },
    championInfo: null,
    validityRules: [],
    estimatedSeconds: 36,
  },
  breaking: {
    id: "preview-breaking",
    type: "NEW_LEADER",
    leagueType: "singles",
    storyId: 1006,
    importance: "major",
    scene: "breaking",
    dialogue: dialogue(
      ["A", "We have a change at the top. Richard moves into first place on the latest completed result."],
      ["B", "That is the sort of update that makes everyone else reach for the remaining-fixtures list."],
      ["A", "The table has changed; the response now belongs to the chasing pack."],
    ),
    graphic: {
      kind: "LeagueTableGraphic",
      data: { leaderName: "Richard", points: 81, previousLeaderName: "Graeme", lead: 10 },
    },
    championInfo: null,
    validityRules: [],
    estimatedSeconds: 36,
  },
  champion: {
    id: "preview-champion",
    type: "CHAMPION",
    leagueType: "singles",
    storyId: 1007,
    importance: "major",
    scene: "champion",
    dialogue: dialogue(
      ["A", "It is confirmed: Richard is the TKDL Singles champion."],
      ["B", "A season built on winning the important nights, and now there is no argument left for the table to settle."],
      ["A", "Richard finishes the campaign on top. A deserved champion."],
    ),
    graphic: null,
    championInfo: { championName: "Richard", seasonName: "May 2026 Singles" },
    validityRules: [],
    estimatedSeconds: 36,
  },
};

const TICKER_ITEMS: LiveTickerItem[] = [
  { matchId: 901, leagueType: "singles", winnerId: 3, loserId: 1, playedAt: "2026-09-05T18:30:00.000Z" },
  { matchId: 902, leagueType: "singles", winnerId: 2, loserId: 4, playedAt: "2026-09-05T18:42:00.000Z" },
  { matchId: 903, leagueType: "doubles", winnerId: 11, loserId: 12, playedAt: "2026-09-05T18:55:00.000Z" },
];

const NAMES = new Map([
  ["singles:1", "Richard"],
  ["singles:2", "Graeme"],
  ["singles:3", "Sean"],
  ["singles:4", "Ryan"],
  ["doubles:11", "Double Trouble"],
  ["doubles:12", "The Checkout Crew"],
]);

function enumParam<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const value = new URLSearchParams(window.location.search).get(key);
  return value && allowed.includes(value as T) ? value as T : fallback;
}

function numberParam(key: string, fallback: number, min: number, max: number): number {
  const raw = new URLSearchParams(window.location.search).get(key);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function previewOverlay(overlayClass: LiveOverlayClass | "none"): LiveOverlayItem | null {
  if (overlayClass === "none") return null;
  return {
    storyId: overlayClass === "breaking" ? 2002 : 2001,
    leagueType: "singles",
    storyType: overlayClass === "breaking" ? "NEW_LEADER" : "FORM_SURGE",
    subjectKeys: ["singles:1", "singles:3"],
    score: overlayClass === "breaking" ? 98 : 76,
    overlayClass,
  };
}

export default function TkdlLivePreview() {
  const mode = enumParam("mode", PREVIEW_MODES, "NEWS");
  const scene = enumParam("scene", PREVIEW_SCENES, "desk");
  const overlayClass = enumParam("overlay", PREVIEW_OVERLAYS, "none");
  const selected = SCENE_SEGMENTS[scene];
  const turn = numberParam("turn", selected.dialogue.length, 1, selected.dialogue.length);
  const elapsedBeforeTurnMs = selected.dialogue
    .slice(0, turn - 1)
    .reduce((total, item) => total + item.holdSeconds * 1_000, 0);
  // Park the shared programme clock one second inside the requested turn.
  // This makes screenshots deterministic while still exercising the real
  // player timing and scene composition.
  const generatedAt = new Date(Date.now() - elapsedBeforeTurnMs - 1_000).toISOString();
  const now = new Date().toISOString();
  const edition: CurrentEdition = {
    id: 9000 + PREVIEW_SCENES.indexOf(scene),
    slotKey: "development-preview",
    slotType: "manual",
    generatedAt,
    dataCutoff: now,
    title: "TKDL LIVE Development Preview",
    mode,
    headlines: [],
    segments: [selected],
  };

  return (
    <BroadcastPlayerPreview
      edition={edition}
      tickerItems={TICKER_ITEMS}
      namesByKey={NAMES}
      activeOverlay={previewOverlay(overlayClass)}
    />
  );
}