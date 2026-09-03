// TKDL LIVE — which of the asset pack's 8 poses fits each of our 8 Scene
// kinds. host_manifest.json (from the user's TKDL_LIVE_Hosts_Pack_Final)
// ships its own "recommended_state_mapping": desk_intro/analysis/banter/
// breaking_or_upset/other_host_speaking, each naming two poses "for reliable
// visual variety." Those categories don't line up 1:1 with our own Scene
// union (api-shapes.ts's sceneForSegment), so this is the deliberate mapping
// between the two: desk + headlines (both presenter-led, conversational)
// get the calm intro pair; analysis/graphic/result (all data-driven
// check-ins) get the explaining/thinking pair; spotlight + champion
// (personality-forward moments) get the amused/confident pair; breaking
// keeps the pack's own dedicated pair. The currently-speaking presenter
// alternates between their scene's two poses by turn index (deterministic,
// not random, so the same segment always renders the same way); whichever
// presenter ISN'T speaking uses the pack's own "other_host_speaking" ->
// "listening" pose.
import type { Scene } from "../types";
import type { PresenterState } from "./presenter-config";

const SCENE_STATE_PAIR: Record<Scene, readonly [PresenterState, PresenterState]> = {
  desk: ["neutral", "speaking"],
  headlines: ["neutral", "speaking"],
  analysis: ["explaining", "thinking"],
  graphic: ["explaining", "thinking"],
  result: ["explaining", "thinking"],
  breaking: ["surprised", "speaking"],
  spotlight: ["amused", "confident"],
  champion: ["amused", "confident"],
};

export function activeStateForScene(scene: Scene, turnIndex: number): PresenterState {
  return SCENE_STATE_PAIR[scene][turnIndex % 2];
}

export const LISTENING_STATE: PresenterState = "listening";
