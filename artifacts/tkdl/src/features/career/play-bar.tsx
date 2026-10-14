import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { ArrowLeft, Menu, X, Gamepad2, House, BookOpen } from "lucide-react";
import { useFinance, usePresentation } from "./api";
import { CareerShirt } from "./identity";
import { CareerStageBackdrop, resolveAtmosphere, spectacleFor } from "./atmosphere";
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
        <span className="career-playbar__chips"><i>{formatPence(finance.data?.balancePence ?? save.balancePence)}</i><i>{save.hasTourCard ? "Tour Card" : "Amateur"}</i></span>
      </div>
      <button type="button" className="career-playbar__menu" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label="Career menu"><Menu aria-hidden /><span className="career-playbar__menu-label">Menu</span></button>
      {open && <CareerMenu saveId={save.id} onClose={() => setOpen(false)} />}
    </header>
  );
}

/** Every Career screen in one side panel, grouped as the full navigation is. */
export function CareerMenu({ saveId, onClose }: { saveId: string; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const base = `/career/${saveId}`;
  return createPortal(
    <div className="career-menu" role="dialog" aria-modal="true" aria-label="Career menu" onClick={onClose}>
      <nav className="career-menu__panel" onClick={e => e.stopPropagation()}>
        <div className="career-menu__head"><strong>Career menu</strong><button type="button" onClick={onClose} aria-label="Close menu"><X aria-hidden /></button></div>
        <Link href={`${base}/play`} onClick={onClose} className="career-menu__primary"><Gamepad2 aria-hidden /> Play</Link>
        <Link href={base} onClick={onClose} className="career-menu__primary"><House aria-hidden /> Career HQ</Link>
        <div className="career-menu__group"><span>Plan</span>
          {CAREER_NAV.filter(s => s.layer !== "HOME" && s.items.length === 1).map(s => <Link key={s.layer} href={`${base}${s.path}`} onClick={onClose}>{s.label}</Link>)}
        </div>
        {CAREER_NAV.filter(s => s.items.length > 1).map(section => (
          <div key={section.layer} className="career-menu__group">
            <span>{section.label}</span>
            {section.items.map(item => <Link key={item.key} href={`${base}${item.path}`} onClick={onClose}>{item.label}</Link>)}
          </div>
        ))}
        <div className="career-menu__group"><span>More</span>
          <Link href={`${base}/finances`} onClick={onClose}>Finances</Link>
          <Link href={`${base}/goals`} onClick={onClose}>Goals</Link>
          <Link href={`${base}/q-school`} onClick={onClose}>Q-School</Link>
          <Link href={`${base}/guide`} onClick={onClose}><BookOpen aria-hidden /> Career Guide</Link>
        </div>
      </nav>
    </div>, document.body);
}
