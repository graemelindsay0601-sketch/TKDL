import { humanizeStoryType, LEAGUE_ACCENT } from "./theme";
import type { Segment } from "./types";
import "./programme-strip.css";

/** "On now" / "Next" chips with how far through the show we are. */
export function ProgrammeStrip({ playlist, currentIndex, invalidSegmentIds }: {
  playlist: readonly Segment[];
  currentIndex: number;
  invalidSegmentIds: ReadonlySet<string>;
}) {
  const playable = playlist.map((segment, index) => ({ segment, index })).filter(item => !invalidSegmentIds.has(item.segment.id));
  const at = playable.findIndex(item => item.index >= currentIndex);
  if (at < 0) return null;
  const now = playable[at];
  const next = playable[at + 1];
  const accent = now.segment.leagueType ? LEAGUE_ACCENT[now.segment.leagueType] : "#ffd24a";
  const pct = Math.round(((at + 1) / playable.length) * 100);

  return (
    <div className="lv-onnow" aria-label="TKDL LIVE running order">
      <div className="lv-onnow__now" style={{ ["--c" as any]: accent }}>
        <span className="lv-onnow__k">On now · {at + 1} of {playable.length}</span>
        <strong>{humanizeStoryType(now.segment.type)}</strong>
        <span className="lv-onnow__bar"><i style={{ width: `${pct}%` }} /></span>
      </div>
      {next && <div className="lv-onnow__next"><span className="lv-onnow__k">Next</span><strong>{humanizeStoryType(next.segment.type)}</strong></div>}
    </div>
  );
}
