import type { CSSProperties, ReactNode } from "react";
import {
  LEVEL_PROFILE, momentEyebrow, resolveAtmosphere, spectacleFor, victoryVariant,
  type AtmosphereInput, type AtmosphereLevel, type MatchStage, type MomentKind, type ResolvedAtmosphere, type Spectacle,
} from "./model";
import { LAYERS, PLATES, SPOTLIGHT_POOL } from "./manifest";
import "./atmosphere.css";

/**
 * Workstream F1 — broadcast atmosphere components. Presentation only.
 * Every visible fact comes from the props (real event, venue and moment data);
 * the art is decorative (aria-hidden), sits behind content and never takes pointer events.
 */

const pct = (n: number) => `${+(n * 100).toFixed(2)}%`;

/** Art layers only. Place inside a positioned container; content goes above it. */
export function CareerStageBackdrop({ atmosphere, spectacle, documentary = false, animate = true, eager = false, className = "" }: {
  atmosphere: ResolvedAtmosphere; spectacle: Spectacle; documentary?: boolean; animate?: boolean; eager?: boolean; className?: string;
}) {
  const plate = PLATES[atmosphere.plate] ?? PLATES.neutral;
  const level = atmosphere.level;
  const shift = { x: plate.stage.x - SPOTLIGHT_POOL.x, y: plate.stage.y - SPOTLIGHT_POOL.y };
  const loading = eager ? "eager" : "lazy";
  const img = (src: string, cls: string, style?: CSSProperties) =>
    <img className={`ca-layer ${cls}`} src={src} alt="" draggable={false} loading={loading} decoding="async" style={style}
      onError={e => { e.currentTarget.style.display = "none"; }} />;
  return (
    <div className={`ca-backdrop ca-level-${(level ?? "none").toLowerCase()} ca-intensity-${spectacle.intensity}${animate ? " ca-anim" : ""}${documentary ? " ca-doc" : ""} ${className}`}
      aria-hidden="true" data-plate={plate.key} data-plate-source={atmosphere.plateSource} data-level={level ?? "NONE"}>
      {spectacle.intensity > 0 && img(plate.src, "ca-plate", { objectPosition: `${pct(plate.focal.x)} ${pct(plate.focal.y)}` })}
      <span className="ca-grade" />
      {spectacle.light && img(LAYERS[spectacle.light], "ca-light")}
      {spectacle.spotlight && img(LAYERS.spotlight, "ca-spot", { transform: `translate(${pct(shift.x)}, ${pct(shift.y)})` })}
      {spectacle.pyro && img(LAYERS.pyro, "ca-pyro")}
      {spectacle.celebration !== "none" && img(LAYERS[spectacle.celebration], "ca-confetti")}
      {documentary && <span className="ca-grain" style={{ backgroundImage: `url(${LAYERS.grain})` }} />}
      <span className="ca-scrim" />
    </div>
  );
}

const LevelChip = ({ level }: { level: AtmosphereLevel | null }) =>
  <span className="ca-chip">{level ? LEVEL_PROFILE[level].label : "Career"}</span>;

/**
 * Event identity with its venue atmosphere (arrival treatment). Wraps existing
 * content: pass the screen's own facts as children.
 */
export function CareerEventAtmosphere({ event, children, animate = true, headingLevel = 2, className = "" }: {
  event: AtmosphereInput; children?: ReactNode; animate?: boolean; headingLevel?: 2 | 3; className?: string;
}) {
  const a = resolveAtmosphere(event);
  const sp = spectacleFor("ARRIVAL", a.level);
  const H = `h${headingLevel}` as "h2";
  const venueLine = [a.venueName, a.venueCity].filter(Boolean).join(" · ");
  return (
    <section className={`ca-scene ca-scale-${sp.scale} ${className}`} aria-label={`${event.eventName ?? "Event"} atmosphere`}
      data-level={a.level ?? "NONE"} data-level-source={a.levelSource}>
      <CareerStageBackdrop atmosphere={a} spectacle={sp} animate={animate} eager />
      <div className="ca-content">
        <p className="ca-eyebrow"><LevelChip level={a.level} /><span>{a.level ? LEVEL_PROFILE[a.level].kicker : "Career event"}</span></p>
        {event.eventName && <H className="ca-title">{event.eventName}</H>}
        {venueLine && <p className="ca-venue">{venueLine}</p>}
        {children}
      </div>
    </section>
  );
}

export type MomentFact = { label: string; value: string };
/**
 * A Career moment with level-appropriate spectacle. The victory variant (tournament,
 * Major, World) is derived from the event itself; callers cannot claim a bigger stage.
 */
export function CareerMomentScene({ moment, event, headline, facts = [], matchStage = null, participants, animate = true, headingLevel = 2, className = "", children }: {
  moment: MomentKind; event?: AtmosphereInput | null; headline?: string | null; facts?: MomentFact[]; matchStage?: MatchStage;
  participants?: [string, string] | null; animate?: boolean; headingLevel?: 2 | 3; className?: string; children?: ReactNode;
}) {
  const a = resolveAtmosphere(event);
  const sp = spectacleFor(moment, a.level, { matchStage });
  const eyebrow = momentEyebrow(moment, a);
  const title = headline ?? event?.eventName ?? null;
  const H = `h${headingLevel}` as "h2";
  const vv = moment === "VICTORY" ? victoryVariant(a) : null;
  return (
    <section className={`ca-scene ca-moment ca-moment-${moment.toLowerCase()} ca-scale-${sp.scale}${vv ? ` ca-victory-${vv.toLowerCase()}` : ""} ${className}`}
      aria-label={[eyebrow, title].filter(Boolean).join(": ")} data-moment={moment} data-level={a.level ?? "NONE"} data-intensity={sp.intensity}
      {...(vv ? { "data-victory": vv } : {})}>
      {sp.scale !== "inline" && <CareerStageBackdrop atmosphere={a} spectacle={sp} animate={animate} documentary={moment === "DOCUMENTARY_CHAPTER"} eager={sp.intensity >= 3} />}
      <div className="ca-content">
        <p className="ca-eyebrow"><LevelChip level={a.level} /><span>{eyebrow}</span></p>
        {title && <H className="ca-title">{title}</H>}
        {participants && <p className="ca-versus"><span>{participants[0]}</span><b aria-label="versus">v</b><span>{participants[1]}</span></p>}
        {event?.eventName && title !== event.eventName && <p className="ca-venue">{[event.eventName, a.venueName].filter(Boolean).join(" · ")}</p>}
        {facts.length > 0 && <dl className="ca-facts">{facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>}
        {children}
      </div>
    </section>
  );
}

export function spectacleSummary(s: Spectacle) {
  return [s.light && `light:${s.light}`, s.spotlight && "spotlight", s.celebration !== "none" && `celebration:${s.celebration}`, s.pyro && "pyro"].filter(Boolean).join(" · ") || "card only";
}
