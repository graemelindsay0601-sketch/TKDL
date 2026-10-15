import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Menu, X, Gamepad2, House, BookOpen, CalendarDays, Map as MapIcon, ListOrdered, Users, Trophy, Landmark, ScrollText, LayoutGrid, Activity, Medal, Sparkles, Briefcase, Coins, Target, GraduationCap, type LucideIcon } from "lucide-react";
import { useFinance, usePresentation } from "./api";
import { CareerShirt } from "./identity";
import { FormBadge } from "./quick-sim";
import { CareerStageBackdrop, PLATES, resolveAtmosphere, spectacleFor } from "./atmosphere";
import type { PlateKey } from "./atmosphere/model";
import { CAREER_NAV, formatPence } from "./model";
import type { CareerSave } from "./types";
import "./pages/play.css";

/** Play mode's header: the player on their stage (shirt, venue backdrop), when and what they have, and the Menu. */
export function PlayBar({ save }: { save: CareerSave }) {
  const finance = useFinance(save.id);
  const presentation = usePresentation(save.id).data;
  const [open, setOpen] = useState(false);
  const stage = resolveAtmosphere({ eventClass: save.hasTourCard ? "PROFESSIONAL_TOUR" : "GRASSROOTS" });
  return (
    <header className="pdc-card career-hero career-hero--stage career-playbar">
      <CareerStageBackdrop atmosphere={stage} spectacle={spectacleFor("ARRIVAL", stage.level)} animate={false} eager className="career-hero__stage" />
      <Link href="/career" className="career-playbar__back" aria-label="Back to Career saves"><ArrowLeft aria-hidden /></Link>
      {presentation && <span className="career-hero__portrait" aria-hidden="true"><CareerShirt identity={presentation.identity} sponsors={presentation.placements} name={save.careerName ?? "Player"} scale="compact" /></span>}
      <div className="career-playbar__who">
        <span className="career-playbar__kicker"><b>Career</b> S{save.currentSeason} · Wk {save.currentWeek}</span>
        <strong>{save.careerName ?? "My Career"}</strong>
        <span className="career-playbar__chips"><i>{formatPence(finance.data?.balancePence ?? save.balancePence)}</i><i>{save.hasTourCard ? "Tour Card" : "Amateur"}</i><FormBadge saveId={save.id} /></span>
      </div>
      <button type="button" className="career-playbar__menu" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label="Career menu"><Menu aria-hidden /><span className="career-playbar__menu-label">Menu</span></button>
      {open && <CareerMenu save={save} onClose={() => setOpen(false)} />}
    </header>
  );
}

type Tile = { label: string; sub: string; path: string; accent: string; plate: PlateKey; icon: LucideIcon };
const TILES: Tile[] = [
  { label: "Play", sub: "Your next move", path: "/play", accent: "#ffd24a", plate: "small-arena", icon: Gamepad2 },
  { label: "Career HQ", sub: "Goals, route, schedule", path: "", accent: "#ff3d7f", plate: "pub-club", icon: House },
  { label: "Calendar", sub: "Every event", path: "/calendar", accent: "#ffb547", plate: "professional-floor", icon: CalendarDays },
  { label: "Map", sub: "Events near you", path: "/map", accent: "#4fc3f7", plate: "conference", icon: MapIcon },
];
const ICONS: Record<string, LucideIcon> = {
  rankings: ListOrdered, players: Users, "world-events": Trophy, venues: Landmark, "world-history": ScrollText,
  overview: LayoutGrid, performance: Activity, achievements: Medal, "career-life": Sparkles, history: BookOpen, sponsors: Briefcase,
};
const ACCENT: Record<string, string> = { DARTS_WORLD: "#5ee39b", MY_CAREER: "#c99bff" };

/** Every Career screen in one side panel: big venue tiles for where you go most, then grouped pages. */
export function CareerMenu({ save, onClose }: { save: CareerSave; onClose: () => void }) {
  const presentation = usePresentation(save.id).data;
  const [location] = useLocation();
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const base = `/career/${save.id}`;
  const here = (path: string) => location === `${base}${path}` ? "page" as const : undefined;
  return createPortal(
    <div className="career-menu" role="dialog" aria-modal="true" aria-label="Career menu" onClick={onClose}>
      <nav className="career-menu__panel" onClick={e => e.stopPropagation()}>
        <div className="career-menu__head">
          {presentation && <span className="career-hero__portrait" aria-hidden="true"><CareerShirt identity={presentation.identity} sponsors={presentation.placements} name={save.careerName ?? "Player"} scale="compact" /></span>}
          <div><span>Career menu</span><strong>{save.careerName ?? "My Career"}</strong></div>
          <button type="button" onClick={onClose} aria-label="Close menu"><X aria-hidden /></button>
        </div>
        <div className="career-menu__tiles">
          {TILES.map(t => { const plate = PLATES[t.plate] ?? PLATES.neutral; const Icon = t.icon; return (
            <Link key={t.label} href={`${base}${t.path}`} onClick={onClose} aria-current={here(t.path)} className="career-menu__tile" style={{ ["--tile-accent" as string]: t.accent }}>
              <img src={plate.src} alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ objectPosition: `${plate.focal.x * 100}% ${plate.focal.y * 100}%` }} onError={e => { e.currentTarget.style.display = "none"; }} />
              <Icon aria-hidden /><strong>{t.label}</strong><small>{t.sub}</small>
            </Link>); })}
        </div>
        {CAREER_NAV.filter(s => s.items.length > 1).map(section => (
          <div key={section.layer} className="career-menu__group" style={{ ["--group-accent" as string]: ACCENT[section.layer] ?? "#d2b677" }}>
            <span>{section.label}</span>
            {section.items.map(item => { const Icon = ICONS[item.key] ?? LayoutGrid; return (
              <Link key={item.key} href={`${base}${item.path}`} onClick={onClose} aria-current={here(item.path)}><Icon aria-hidden /> {item.label}</Link>); })}
          </div>
        ))}
        <div className="career-menu__group"><span>Plan &amp; money</span>
          <Link href={`${base}/finances`} onClick={onClose} aria-current={here("/finances")}><Coins aria-hidden /> Finances</Link>
          <Link href={`${base}/goals`} onClick={onClose} aria-current={here("/goals")}><Target aria-hidden /> Goals</Link>
          <Link href={`${base}/q-school`} onClick={onClose} aria-current={here("/q-school")}><GraduationCap aria-hidden /> Q-School</Link>
          <Link href={`${base}/guide`} onClick={onClose} aria-current={here("/guide")}><BookOpen aria-hidden /> Career Guide</Link>
        </div>
      </nav>
    </div>, document.body);
}
