/**
 * "2 away from…": after a result, the next achievement levels a player is closest to. Shown on result screens.
 * The sync runs a few seconds after a result is saved, so this looks again shortly after it first loads.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAchievementsV2Status, METAL_NAME, fmt, type Area, type PlayerResponse, type TrackView } from "./api";
import { trackArt, metalFor } from "./art";
import "./nearly.css";
import { nearest } from "./nearly-logic";

function PlayerNudges({ playerId, name, areas }: { playerId: number; name?: string; areas?: Area[] }) {
  const { data, refetch } = useQuery<PlayerResponse>({ queryKey: ["av2-nearly", playerId], staleTime: 0,
    queryFn: async () => { const r = await fetch(`/api/achievements-v2/players/${playerId}`, { credentials: "include" }); if (!r.ok) throw new Error(String(r.status)); return r.json(); } });
  useEffect(() => { const t = setTimeout(() => void refetch(), 12_000); return () => clearTimeout(t); }, [refetch]);
  if (!data || !("view" in data)) return null;
  const list = nearest(data.view.areas, areas);
  if (!list.length) return null;
  return <>{list.map(t => { const metal = metalFor(t.level + 1, t.levels.length);
    return (
      <Link key={`${playerId}-${t.key}`} href={`/achievements?player=${playerId}`} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "rgba(255,210,74,.05)", border: "1px solid rgba(255,210,74,.18)" }}>
        <img src={trackArt(t.key, metal)} alt="" style={{ width: 34, height: 44, objectFit: "contain", filter: "brightness(0) drop-shadow(0 0 1px rgba(255,255,255,.4))", opacity: .7 }} />
        <div className="min-w-0 text-left">
          <div className="text-xs font-black uppercase tracking-wider" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>{name ? `${name}: ` : ""}{fmt(t.left!, t.unit === "rank" ? null : t.unit)}{t.unit === "rank" ? " places" : ""} away</div>
          <div className="text-xs text-white/60 truncate">{t.title} {metal ? METAL_NAME[metal] : ""} · {t.next}</div>
          <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}><i className="block h-full" style={{ width: `${Math.round(t.progress * 100)}%`, background: "linear-gradient(90deg,#a855f7,#ffd24a)" }} /></div>
        </div>
      </Link>); })}</>;
}

/** Nudges for one or more players (e.g. both sides of a result). Renders nothing until achievements are switched on. */
export function NearlyThere({ players, areas, title = "Nearly there" }: { players: { id: number; name?: string }[]; areas?: Area[]; title?: string }) {
  const enabled = useAchievementsV2Status();
  if (!enabled || !players.length) return null;
  return (
    <div className="av2-nearly-block flex flex-col gap-2">
      <div className="text-[10px] font-black uppercase tracking-[.2em] text-white/40" style={{ fontFamily: "Oswald, sans-serif" }}>{title}</div>
      {players.slice(0, 4).map(p => <PlayerNudges key={p.id} playerId={p.id} name={players.length > 1 ? p.name : undefined} areas={areas} />)}
    </div>
  );
}
