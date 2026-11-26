import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { PlayCircle, ChevronRight } from "lucide-react";
import { readMatchSnapshot } from "@/lib/nativeParity";

/**
 * When the phone has closed the app mid-game, it usually reopens on the Hub,
 * not the page the game was on. This slim bar points back to the saved game.
 */
const SAVES = [
  { key: "tkdl_play_snapshot", href: "/play" },
  { key: "tkdl_practice_resume", href: "/practice" },
] as const;

function findSave(location: string) {
  for (const save of SAVES) {
    if (location.startsWith(save.href)) continue;
    const data = readMatchSnapshot<{ phase?: string; setupData?: { gameType?: { name?: string } } }>(save.key);
    if (data?.setupData?.gameType?.name) {
      return { href: save.href, game: data.setupData.gameType.name, finished: data.phase === "completed" };
    }
  }
  return null;
}

export function ResumeNudge() {
  const [location] = useLocation();
  const [save, setSave] = useState(() => findSave(location));
  useEffect(() => { setSave(findSave(location)); }, [location]);
  if (!save) return null;
  return (
    <Link href={save.href}
      className="flex items-center gap-2.5 mb-3 px-3 py-2.5 rounded-xl active:scale-[.98]"
      style={{ background: "linear-gradient(180deg,rgba(255,210,74,.14),rgba(255,210,74,.05))", border: "1px solid rgba(255,210,74,.35)", boxShadow: "0 0 18px rgba(255,210,74,.12)" }}>
      <PlayCircle className="w-5 h-5 shrink-0" style={{ color: "#ffd24a" }} />
      <span className="flex-1 min-w-0 text-sm truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#fff", letterSpacing: ".03em" }}>
        {save.finished ? "Result not saved yet" : "Unfinished game"} · <span style={{ color: "#ffd24a" }}>{save.game}</span>
      </span>
      <span className="text-xs font-bold uppercase tracking-wider flex items-center" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
        {save.finished ? "Open" : "Resume"}<ChevronRight className="w-4 h-4" />
      </span>
    </Link>
  );
}
