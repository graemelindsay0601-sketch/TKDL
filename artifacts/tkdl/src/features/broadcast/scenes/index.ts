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
};

export type { SceneProps } from "./scene-support";
export {
  DeskScene, AnalysisScene, GraphicScene, ResultScene,
  HeadlinesScene, BreakingScene, SpotlightScene, ChampionScene,
};
