import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Hand, X } from "lucide-react";
import { FontLoader, type Font } from "three/addons/loaders/FontLoader.js";
import { buildClubhouse, type ClubData, type ClubInfo } from "@/components/clubhouse/scene";
import { trackModel } from "@/components/achievements-v2/art";
import type { Metal, PlayerView } from "@/components/achievements-v2/api";
import { useFeature } from "@/lib/useFeature";
import { useCurrentPlayer } from "@/context/auth";
import { WalkOnEditor } from "@/components/walkon/WalkOnEditor";
import { fetchWalkOns, hexOf, type WalkOn } from "@/components/walkon/walkon";
import "./clubhouse.css";

const RANK: Record<Metal, number> = { DIAMOND: 5, PLATINUM: 4, GOLD: 3, SILVER: 2, BRONZE: 1 };
const j = (u: string) => fetch(u, { credentials: "include" }).then(r => (r.ok ? r.json() : null)).catch(() => null);

async function loadClub(id: number): Promise<(ClubData & { walkonRaw: WalkOn | null }) | null> {
  const [player, honours, ach, rival, walkons, cos, catalog] = await Promise.all([
    j(`/api/players/${id}`), j(`/api/players/${id}/honours`),
    j(`/api/achievements-v2/players/${id}?preview=1`), j(`/api/players/${id}/nemesis`), fetchWalkOns([id]),
    j(`/api/players/${id}/cosmetics`), j(`/api/cosmetics/catalog`),
  ]);
  const roomItem = Array.isArray(catalog) ? catalog.find((c: any) => c.id === cos?.equippedClubhouseRoomId) : null;
  if (!player?.name) return null;
  const view: PlayerView | null = ach?.view ?? null;
  const tracks = (view?.areas ?? []).flatMap(a => a.tracks.map(t => ({ ...t, area: a.name })))
    .filter(t => t.metal).sort((a, b) => RANK[b.metal as Metal] - RANK[a.metal as Metal] || b.level - a.level);
  const trophies = tracks.slice(0, 6).map(t => ({ ...trackModel(t.key, t.metal as Metal), title: t.title, detail: `${t.area} · level ${t.level} · ${t.value}` }));
  const wins = Number(player.careerWins ?? 0), losses = Number(player.careerLosses ?? 0);
  const chalk = [
    { label: "Career", value: `${wins}W – ${losses}L` },
    { label: "Win rate", value: wins + losses ? `${Math.round((wins / (wins + losses)) * 100)}%` : "–" },
    { label: "Peak ELO", value: String(player.careerPeakElo ?? player.elo ?? "–") },
    { label: "Best winning run", value: String(player.longestWinStreak ?? 0) },
    { label: "Podium finishes", value: String(honours?.honours?.length ?? 0) },
    { label: "Achievement score", value: view ? String(view.score) : "–" },
  ];
  return {
    name: player.name, honours: honours?.honours ?? [], trophies, chalk,
    rival: rival?.playerName ? { name: rival.playerName, record: `${rival.winsAgainst}–${rival.losses}` } : null,
    walkon: walkons[id] ? { nickname: walkons[id].nickname, a: hexOf(walkons[id].colourA), b: hexOf(walkons[id].colourB, "#ffd24a") } : null,
    walkonRaw: walkons[id] ?? null,
    theme: roomItem?.iconKey ?? null,
  };
}

let fontP: Promise<Font | null> | null = null;
const loadFont = () => (fontP ??= new FontLoader().loadAsync("/achievements-v2/font.json").catch(() => null));

export default function Clubhouse() {
  const { id } = useParams<{ id: string }>();
  const on = useFeature("clubhouse");
  const host = useRef<HTMLDivElement>(null);
  const me = useCurrentPlayer();
  const mine = me?.playerId === Number(id);
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState<(ClubData & { walkonRaw: WalkOn | null }) | null | undefined>(undefined);
  const [pick, setPick] = useState<ClubInfo | null>(null);
  const [hint, setHint] = useState(true);
  useEffect(() => { void loadClub(Number(id)).then(setData); }, [id]);
  useEffect(() => {
    if (!data || !host.current) return;
    let dispose: (() => void) | null = null, live = true;
    void loadFont().then(font => { if (!live || !host.current) return; try { dispose = buildClubhouse(host.current, data, font, setPick); } catch { setData(null); } });
    const t = setTimeout(() => setHint(false), 3500);
    return () => { live = false; clearTimeout(t); dispose?.(); };
  }, [data]);

  return (
    <div className="ch-root">
      <div ref={host} className="ch-canvas" />
      <header className="ch-head">
        <Link href={`/players/${id}`} className="ch-back" aria-label="Back"><ArrowLeft size={18} /></Link>
        <div className="ch-title"><small>The Clubhouse</small><b>{data?.name ? `${data.name}'s room` : "Loading…"}</b></div>
        {mine && data ? <button className="ch-walk" onClick={() => { setPick(null); setEditing(true); }}>Walk-on</button> : <span className="ch-spacer" />}
      </header>
      {!on && data !== undefined && <div className="ch-note">Preview — the Clubhouse isn't switched on for everyone yet.</div>}
      {data === null && <div className="ch-note">This room couldn't be built on this device.</div>}
      {hint && data && <div className="ch-hint"><Hand size={14} /> Drag to look around · tap anything</div>}
      {editing && data && (
        <WalkOnEditor name={data.name} current={data.walkonRaw} onClose={() => setEditing(false)}
          onSaved={w => { setEditing(false); setData({ ...data, walkonRaw: w, walkon: { nickname: w.nickname, a: hexOf(w.colourA), b: hexOf(w.colourB, "#ffd24a") } }); }} />
      )}
      {pick && (
        <div className="ch-card" role="dialog">
          <button className="ch-x" aria-label="Close" onClick={() => setPick(null)}><X size={16} /></button>
          <b>{pick.title}</b>
          {pick.lines.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  );
}
