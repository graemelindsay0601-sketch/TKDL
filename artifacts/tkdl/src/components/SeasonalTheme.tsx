import { useEffect, useMemo } from "react";

/** Seasonal touches by London date: a coloured strip under the header, a small badge on the Hub and, for a few, gentle
 *  falling particles. Purely decorative: nothing changes how the app works. */
export type SeasonTheme = { key: string; label: string; colors: string[]; particles?: "snow" | "sparks" | "hearts" };
const LONDON = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "numeric", day: "numeric" });
export function themeFor(d: Date): SeasonTheme | null {
  const p = Object.fromEntries(LONDON.formatToParts(d).map(x => [x.type, Number(x.value)])), m = p.month, day = p.day;
  if (m === 10 && day >= 25) return { key: "halloween", label: "Halloween week", colors: ["#ff7a1a", "#8b2cff"], particles: "sparks" };
  if (m === 11 && day >= 24) return { key: "st-andrews", label: "St Andrew's week", colors: ["#0065bd", "#ffffff"] };
  if (m === 12 && day <= 26) return { key: "christmas", label: "Festive season", colors: ["#d4202c", "#1f8a4c", "#ffd24a"], particles: "snow" };
  if ((m === 12 && day >= 27) || (m === 1 && day <= 2)) return { key: "hogmanay", label: "Hogmanay", colors: ["#ffd24a", "#ff5c93", "#4fa8ff"], particles: "sparks" };
  if (m === 1 && day >= 20 && day <= 26) return { key: "burns", label: "Burns week", colors: ["#1b5e3a", "#c8102e", "#0b3d91", "#ffd24a"] };
  if (m === 2 && day >= 10 && day <= 14) return { key: "valentines", label: "Valentine's week", colors: ["#ff3d7f", "#ffb3c9"], particles: "hearts" };
  return null;
}
/** `tkdl:season-preview` (a date, e.g. 2026-12-20) in localStorage previews another time of year on this device. */
const today = () => { try { const p = localStorage.getItem("tkdl:season-preview"); if (p && !Number.isNaN(Date.parse(p))) return new Date(p); } catch { /* storage blocked */ } return new Date(); };
export const useSeasonTheme = () => useMemo(() => themeFor(today()), []);

export function SeasonalTheme() {
  const t = useSeasonTheme();
  useEffect(() => {
    if (!t) return;
    document.body.classList.add(`season-${t.key}`);
    return () => document.body.classList.remove(`season-${t.key}`);
  }, [t]);
  if (!t) return null;
  const strip = t.key === "burns"
    ? `repeating-linear-gradient(90deg, ${t.colors[0]} 0 14px, ${t.colors[1]} 14px 18px, ${t.colors[2]} 18px 30px, ${t.colors[3]} 30px 32px)`
    : `linear-gradient(90deg, ${t.colors.join(", ")}, ${t.colors[0]})`;
  return (
    <>
      <div className="pm-season-strip" style={{ background: strip }} aria-hidden />
      {t.particles && (
        <div className={`pm-season-fx ${t.particles}`} aria-hidden>
          {Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.7) % 12}s`, animationDuration: `${10 + (i % 5) * 3}s`, ["--c" as string]: t.colors[i % t.colors.length] }} />)}
        </div>
      )}
    </>
  );
}

/** A small badge for the Hub hero. */
export function SeasonBadge() {
  const t = useSeasonTheme();
  if (!t) return null;
  return <span className="pm-chip pm-season-badge" style={{ ["--s1" as string]: t.colors[0], ["--s2" as string]: t.colors[1] ?? t.colors[0] }}>{t.label}</span>;
}
