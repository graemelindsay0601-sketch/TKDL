/** Tap a piece to see it large: a live 3D model you can spin (earned pieces), with its details and every metal it comes in. */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { METAL_NAME, fmt, type FeatView, type Metal, type TrackView } from "./api";
import { trackArt, featArt, trackModel, featModel, metalFor, LOCKED } from "./art";
import "./inspect.css";

const Viewer3D = lazy(() => import("./Viewer3D"));
export type InspectItem = { kind: "track"; t: TrackView } | { kind: "feat"; f: FeatView };

export function InspectSheet({ item, onClose }: { item: InspectItem; onClose: () => void }) {
  const track = item.kind === "track" ? item.t : null, feat = item.kind === "feat" ? item.f : null;
  // each metal the track has, with the level that first reaches it
  const metals = useMemo(() => {
    if (!track) return [];
    const out: { metal: Metal; level: number; target: number }[] = [];
    track.levels.forEach((target, i) => { const m = metalFor(i + 1, track.levels.length); if (m && !out.some(o => o.metal === m)) out.push({ metal: m, level: i + 1, target }); });
    return out;
  }, [track]);
  const [metal, setMetal] = useState<Metal | null>(track?.metal ?? null);
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc); const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);

  const earned = track ? !!metal && metals.some(m => m.metal === metal && m.level <= track.level) : !!feat?.earnedAt;
  const model = track ? (metal ? trackModel(track.key, metal) : null) : feat ? featModel(feat.key) : null;
  const img = track ? trackArt(track.key, metal) : featArt(feat!.key);
  const title = track?.title ?? feat!.title;

  return createPortal(
    <div className="av2-inspect" role="dialog" aria-label={title} onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        <div className="stage">
          {earned && model && !failed
            ? <Suspense fallback={<div className="av2-3d"><div className="av2-3d-wait">Polishing the trophy…</div></div>}><Viewer3D key={`${model.id}:${model.tier}`} id={model.id} tier={model.tier} onFail={onFail} /></Suspense>
            : <img src={img} alt="" style={earned ? undefined : { ...LOCKED, opacity: 0.6 }} />}
          {earned && !failed && <div className="hint">Drag to spin · pinch to zoom</div>}
        </div>
        <div className="info">
          <div className="kicker">{track ? (metal ? METAL_NAME[metal] : "Locked") : feat?.showpiece ? "Showpiece" : "Feat"}</div>
          <h3>{title}</h3>
          {track && <>
            <div className="metals">
              {metals.map(m => { const got = m.level <= track.level;
                return <button key={m.metal} className={`${m.metal.toLowerCase()}${metal === m.metal ? " on" : ""}${got ? "" : " locked"}`} disabled={!got} onClick={() => setMetal(m.metal)}
                  title={got ? METAL_NAME[m.metal] : `${METAL_NAME[m.metal]}: ${fmt(m.target, track.unit)}`}>{got ? METAL_NAME[m.metal] : `🔒 ${METAL_NAME[m.metal]} · ${fmt(m.target, track.unit)}`}</button>; })}
            </div>
            <p className="now">{track.value > 0 ? `Now: ${fmt(track.value, track.unit)}` : "Not started yet"}</p>
            {track.next ? <><p className="goal">Next: {track.next}</p><div className="av2-bar"><i style={{ width: `${Math.round(track.progress * 100)}%` }} /></div></> : <p className="goal done">Complete. Every metal won.</p>}
          </>}
          {feat && <>
            <p className="goal">{feat.goal}</p>
            <p className="now">{feat.earnedAt ? `Earned ${format(new Date(feat.earnedAt), "d MMMM yyyy")}` : `${feat.points} points when you earn it`}</p>
            {feat.reward && <p className="rw">{feat.earnedAt ? "Unlocked" : "Unlocks"}: {feat.reward}</p>}
          </>}
        </div>
      </div>
    </div>, document.body);
}
