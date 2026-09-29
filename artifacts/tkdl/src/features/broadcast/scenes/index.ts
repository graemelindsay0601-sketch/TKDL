// TKDL LIVE — Scene -> component dispatch table (handover doc 15.4's own
// scene state machine; BroadcastPlayer.tsx renders SCENE_COMPONENTS[segment
// .scene] rather than a hand-written switch at the render call site, the
// same dispatch-table pattern graphics/index.ts already established for
// GraphicKind).
import type { ComponentType } from "react";
import type { Scene } from "../types";
import { DeskScene } from "./DeskScene";
import { AnalysisScene } from "./AnalysisScene";
import { GraphicScene } from "./GraphicScene";
import { ResultScene } from "./ResultScene";
import { HeadlinesScene } from "./HeadlinesScene";
import { BreakingScene } from "./BreakingScene";
import { SpotlightScene } from "./SpotlightScene";
import { ChampionScene } from "./ChampionScene";
import { InterviewScene } from "./InterviewScene";
import { FanVerdictScene } from "./FanVerdictScene";
import { SeasonLaunchScene } from "./SeasonLaunchScene";
import { PlayerFocusScene } from "./PlayerFocusScene";
import { PowerRankingsScene } from "./PowerRankingsScene";
import type { SceneProps } from "./scene-support";

export const SCENE_COMPONENTS: Record<Scene, ComponentType<SceneProps>> = {
  desk: DeskScene,
  analysis: AnalysisScene,
  graphic: GraphicScene,
  result: ResultScene,
  headlines: HeadlinesScene,
  breaking: BreakingScene,
  spotlight: SpotlightScene,
  champion: ChampionScene,
  interview: InterviewScene,
  fan_verdict: FanVerdictScene,
  season_launch: SeasonLaunchScene,
  player_focus: PlayerFocusScene,
  power_rankings: PowerRankingsScene,
};

export type { SceneProps } from "./scene-support";
export {
  DeskScene, AnalysisScene, GraphicScene, ResultScene,
  HeadlinesScene, BreakingScene, SpotlightScene, ChampionScene, InterviewScene,
  FanVerdictScene, SeasonLaunchScene, PlayerFocusScene, PowerRankingsScene,
};
