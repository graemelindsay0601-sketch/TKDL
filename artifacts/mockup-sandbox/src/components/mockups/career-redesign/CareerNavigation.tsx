import type { CSSProperties } from "react";
import { CalendarDays, House, Map, Moon, Shield, UserRound, Car, Star, Video, Radio, Coins, type LucideIcon } from "lucide-react";
import "./_group.css";

function DartboardIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2.4" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1-2.1" />
  </svg>;
}

const sections: { name: string; icon: LucideIcon | typeof DartboardIcon; accent: string }[] = [
  { name: "Home", icon: House, accent: "#ff3d7f" },
  { name: "Map", icon: Map, accent: "#4fc3f7" },
  { name: "Calendar", icon: CalendarDays, accent: "#ffb547" },
  { name: "Nights Out", icon: Moon, accent: "#e08a5b" },
  { name: "Darts World", icon: DartboardIcon, accent: "#5ee39b" },
  { name: "My Career", icon: UserRound, accent: "#c99bff" },
];
const nightLinks: { name: string; icon: LucideIcon }[] = [
  { name: "This week", icon: Moon }, { name: "Club", icon: Shield }, { name: "Money matches", icon: Coins },
  { name: "Road trips", icon: Car }, { name: "Pro-Am", icon: Star }, { name: "Webcam league", icon: Video }, { name: "DartCast", icon: Radio },
];

/** Static extraction of CareerNav's six destination segments and current Nights Out sub-navigation. */
export function CareerNavigation() {
  return <nav aria-label="Career" className="career-navigation career-navigation--premium" style={{ "--dest-accent": "#e08a5b" } as CSSProperties}>
    <div className="career-primary-nav">
      {sections.map((section, i) => {
        const Icon = section.icon;
        const active = section.name === "Nights Out";
        return <a href="#career-preview" key={section.name} className="career-nav-link" aria-label={section.name}
          style={{ "--tab-accent": section.accent } as CSSProperties} aria-current={active ? "true" : undefined}>
          <span className="career-destination-icon" aria-hidden><Icon size={18} /></span>
          <span className="career-nav-label-full">{section.name}</span>
          <span className="career-nav-label-short">{["Home", "Map", "Calendar", "Nights", "World", "Career"][i]}</span>
        </a>;
      })}
    </div>
    <div className="career-context-nav" aria-label="Nights Out pages" role="group">
      {nightLinks.map(item => {
        const Icon = item.icon;
        return <a href="#career-preview" key={item.name} className="career-subnav-link" aria-current={item.name === "Club" ? "page" : undefined}>
          <Icon size={14} aria-hidden className="career-subnav-icon" />{item.name}
        </a>;
      })}
    </div>
  </nav>;
}
