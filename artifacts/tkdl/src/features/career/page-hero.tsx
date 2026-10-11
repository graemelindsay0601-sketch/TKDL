import type { CSSProperties, ReactNode } from "react";
import { CareerStageBackdrop, resolveAtmosphere, spectacleFor, type AtmosphereInput } from "./atmosphere";
import "./page-hero.css";

/**
 * Broadcast-style page header shared by the Career management screens. Built on the F1
 * stage backdrop (real venue plates, light layer and grade) so every screen sits in the
 * same world as tournaments, while each passes its own venue, accent and kicker for
 * character. Every value shown comes from the caller's real data; the art is decorative.
 */
export type HeroStat = { label: string; value: ReactNode; sub?: ReactNode; tone?: "gold" | "good" | "bad" | "neutral" };

export function CareerPageHero({ kicker, title, subtitle, stage, accent = "#ff005c", stats = [], portrait, actions, archival = false, watermark, children }: {
  kicker: string; title: ReactNode; subtitle?: ReactNode;
  /** Venue / level for the backdrop, e.g. { venue: { venueType: "professional-floor" }, eventClass: "PROFESSIONAL_TOUR" }. */
  stage: AtmosphereInput; accent?: string; stats?: HeroStat[]; portrait?: ReactNode; actions?: ReactNode;
  /** Documentary grade (retired careers, archives). */
  archival?: boolean;
  /** Large outlined background text, e.g. "S01 · W20" or a ranking position. Decorative. */
  watermark?: string; children?: ReactNode;
}) {
  const atmosphere = resolveAtmosphere(stage);
  const spectacle = { ...spectacleFor("ARRIVAL", atmosphere.level), spotlight: false };
  return (
    <section className={`career-page-hero${archival ? " is-archival" : ""}`} style={{ "--hero-accent": accent } as CSSProperties}>
      <div className="career-page-hero__stage">
        <CareerStageBackdrop atmosphere={atmosphere} spectacle={spectacle} documentary={archival} animate={false} eager />
        <span className="career-page-hero__sweep" aria-hidden="true" />
        {watermark && <span className="career-page-hero__watermark" aria-hidden="true">{watermark}</span>}
        <div className="career-page-hero__content">
          <div className="career-page-hero__text">
            <p className="career-page-hero__kicker"><i aria-hidden="true" />{kicker}</p>
            <h1 className="career-page-hero__title">{title}</h1>
            {subtitle && <div className="career-page-hero__subtitle">{subtitle}</div>}
            {actions && <div className="career-page-hero__actions">{actions}</div>}
            {children}
          </div>
          {portrait && <div className="career-page-hero__portrait" aria-hidden="true">{portrait}</div>}
        </div>
      </div>
      {stats.length > 0 && <dl className="career-page-hero__stats" style={{ "--hero-cols": Math.min(stats.length, 5) } as CSSProperties}>
        {stats.map(s => <div key={s.label} className={`is-${s.tone ?? "neutral"}`}><dt>{s.label}</dt><dd>{s.value}</dd>{s.sub && <small>{s.sub}</small>}</div>)}
      </dl>}
    </section>
  );
}
