import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Target } from "lucide-react";

/**
 * Lock the page behind a full-screen scorer: nothing underneath scrolls or rubber-bands while you throw (the app's own
 * scroller is .tkdl-main, the document can scroll too on phones). Restores exactly what was there on release.
 */
export function useScorerScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const els = [document.documentElement, document.body, ...Array.from(document.querySelectorAll<HTMLElement>(".tkdl-main"))];
    const before = els.map(e => [e.style.overflow, e.style.overscrollBehavior] as const);
    for (const e of els) { e.style.overflow = "hidden"; e.style.overscrollBehavior = "none"; }
    return () => els.forEach((e, i) => { e.style.overflow = before[i][0]; e.style.overscrollBehavior = before[i][1]; });
  }, [active]);
}

const StageContext = createContext<{ minimise: () => void } | null>(null);

/** "Minimise" for the scorer's own top region (inside a CareerScorerStage); renders nothing anywhere else. */
export function ScorerMinimise() {
  const stage = useContext(StageContext);
  if (!stage) return null;
  return <button type="button" className="career-scorer-minimise" onClick={stage.minimise} aria-label="Minimise the scorer and go back to your Career">
    <Minimize2 aria-hidden /> Minimise
  </button>;
}

/**
 * A Career scorer on its own screen. Starting a match slides the scorer up over the app and locks the page behind it.
 * Minimise drops back to the Career screen with the match kept exactly where it is (the scorer stays mounted, just
 * hidden), and Resume match brings it straight back. Leaving the page altogether is safe too: the server keeps the
 * dart log, so the match reopens where it was.
 *
 * Put <ScorerMinimise /> in the scorer's top region (GameScorer `topBanner`); scorers without one use `floatingControl`.
 */
export function CareerScorerStage({ children, title, floatingControl = false }: { children: ReactNode; title?: string; floatingControl?: boolean }) {
  const [minimised, setMinimised] = useState(false);
  useScorerScrollLock(!minimised);
  const resume = () => setMinimised(false);
  return <StageContext.Provider value={{ minimise: () => setMinimised(true) }}>
    {minimised && <section className="career-scorer-paused" aria-label="Match in progress">
      <span className="career-scorer-paused__icon" aria-hidden><Target /></span>
      <div><b>Match in progress</b>{title && <small>{title}</small>}<small>Everything you've thrown is saved. Pick up exactly where you left off.</small></div>
      <button type="button" className="career-btn career-btn-primary" onClick={resume}><Maximize2 aria-hidden /> Resume match</button>
    </section>}
    {createPortal(<>
      <div className="career-scorer-stage" hidden={minimised} aria-hidden={minimised || undefined}
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#06040e", overscrollBehavior: "contain", display: minimised ? "none" : undefined }}>
        {children}
        {floatingControl && <div className="career-scorer-float-control"><ScorerMinimise /></div>}
      </div>
      {minimised && <button type="button" className="career-scorer-resume" onClick={resume}><Maximize2 aria-hidden /> Resume match</button>}
    </>, document.body)}
  </StageContext.Provider>;
}
