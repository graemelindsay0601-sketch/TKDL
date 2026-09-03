// TKDL LIVE — GraphicKind -> component dispatch table, so a future renderer
// (BroadcastPlayer.tsx/scenes/*, paused pending host-design collaboration)
// can go straight from a Segment's own `graphic.kind` string to the right
// component without a hand-written switch at every call site.
import type { ComponentType } from "react";
import type { GraphicData, GraphicKind, LeagueType } from "../types";
import { LeagueTableGraphic } from "./LeagueTableGraphic";
import { TitlePredictorGraphic } from "./TitlePredictorGraphic";
import { MatchContextGraphic } from "./MatchContextGraphic";
import { HeadToHeadGraphic } from "./HeadToHeadGraphic";
import { FormWatchGraphic } from "./FormWatchGraphic";
import { WagerGraphic } from "./WagerGraphic";
import { ResultGraphic } from "./ResultGraphic";

/** `compact` — see GraphicFrame.tsx's own header on hierarchy-by-treatment. Optional (defaults true, GraphicFrame's own restrained default) so an older call site that hasn't been updated to thread a real tier through still gets the quiet treatment, never the loud one. */
export type GraphicComponentProps = { leagueType: LeagueType | null; data: GraphicData; compact?: boolean };

export const GRAPHIC_COMPONENTS: Record<GraphicKind, ComponentType<GraphicComponentProps>> = {
  LeagueTableGraphic,
  TitlePredictorGraphic,
  MatchContextGraphic,
  HeadToHeadGraphic,
  FormWatchGraphic,
  WagerGraphic,
  ResultGraphic,
};

export {
  LeagueTableGraphic, TitlePredictorGraphic, MatchContextGraphic,
  HeadToHeadGraphic, FormWatchGraphic, WagerGraphic, ResultGraphic,
};
