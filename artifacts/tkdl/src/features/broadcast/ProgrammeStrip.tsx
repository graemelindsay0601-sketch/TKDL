import { humanizeStoryType, LEAGUE_ACCENT } from "./theme";
import type { Segment } from "./types";
import "./programme-strip.css";

export function ProgrammeStrip({ playlist, currentIndex, invalidSegmentIds }: {
  playlist: readonly Segment[];
  currentIndex: number;
  invalidSegmentIds: ReadonlySet<string>;
}) {
  const items = playlist
    .map((segment, index) => ({ segment, index }))
    .filter(item => item.index >= currentIndex && !invalidSegmentIds.has(item.segment.id))
    .slice(0, 3);
  if (items.length === 0) return null;

  return (
    <div className="programme-strip" aria-label="TKDL LIVE running order">
      <span className="programme-strip__heading">Running order</span>
      {items.map((item, visibleIndex) => {
        const accent = item.segment.leagueType ? LEAGUE_ACCENT[item.segment.leagueType] : "#ffd24a";
        return (
          <div className={`programme-strip__item ${visibleIndex === 0 ? "is-live" : ""}`} key={item.segment.id}>
            <span className="programme-strip__state">{visibleIndex === 0 ? "On now" : visibleIndex === 1 ? "Next" : "Later"}</span>
            <i style={{ background: accent }} />
            <strong>{humanizeStoryType(item.segment.type)}</strong>
          </div>
        );
      })}
    </div>
  );
}
