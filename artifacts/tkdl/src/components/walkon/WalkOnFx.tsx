import type { CSSProperties } from "react";
import { hexOf, type WalkOnStyle } from "./walkon";
import "./walkon.css";

/** The entrance effect layer for one side of the walk-on (pure CSS, no audio). */
export function WalkOnFx({ style, colourA, colourB }: { style: WalkOnStyle; colourA: string; colourB: string }) {
  const vars = { "--wa": hexOf(colourA), "--wb": hexOf(colourB, "#ffd24a") } as CSSProperties;
  return (
    <div className={`wo-fx wo-fx--${style}`} style={vars} aria-hidden>
      {style === "spotlights" && <><i className="wo-beam a" /><i className="wo-beam b" /><i className="wo-beam c" /></>}
      {style === "smoke" && <><i className="wo-smoke a" /><i className="wo-smoke b" /><i className="wo-smoke c" /></>}
      {style === "sparks" && Array.from({ length: 18 }, (_, i) => <i key={i} className={`wo-spark ${i % 2 ? "r" : "l"}`} style={{ animationDelay: `${(i * 0.13) % 1.4}s`, ["--x" as any]: `${(i * 37) % 40}px` }} />)}
      {style === "confetti" && Array.from({ length: 26 }, (_, i) => <i key={i} className="wo-conf" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.17) % 2.2}s`, background: i % 3 === 0 ? "#ffd24a" : i % 3 === 1 ? "var(--wa)" : "var(--wb)" }} />)}
    </div>
  );
}

/** A small walk-on card: what an entrance looks like, used for the preview and in the Clubhouse. */
export function WalkOnCard({ name, nickname, style, colourA, colourB }: { name: string; nickname: string; style: WalkOnStyle; colourA: string; colourB: string }) {
  return (
    <div className="wo-card" style={{ "--wa": hexOf(colourA), "--wb": hexOf(colourB, "#ffd24a") } as CSSProperties}>
      <WalkOnFx style={style} colourA={colourA} colourB={colourB} />
      <div className="wo-card-in">
        <small>Now walking on</small>
        <b>{name}</b>
        {nickname && <em>“{nickname}”</em>}
        <span className="wo-stripe" />
      </div>
    </div>
  );
}
