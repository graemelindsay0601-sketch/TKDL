// The Bestiary: every boss's story, moves, your record against it, its loot and the perk it drops.
// Bosses you haven't reached yet stay hidden.
import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, Lock, Flame, Gift, Sparkles, Zap, Clock, CheckCircle2 } from "lucide-react";
import { useCurrentPlayer } from "@/context/auth";
import { BOSSES, WORLDS, PERKS, worldOf, type Boss } from "@/lib/boss-battles-data";
import { bossUnlocked, nemesisOf, lootFor } from "@/lib/darts-rules";
import { BossPortrait } from "@/components/boss/BossPortrait";
import "./boss-battle.css";
import "./boss-bestiary.css";

type Stats = { attempts: number; wins: number; bestSeconds: number | null; cleanSweep: boolean; highestAscension: number };
const MODE: Record<string, string> = { X01: "501", CRICKET: "Cricket", ATW: "Round the board", HALVEIT: "Halve-It", KILLER: "Killer" };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function BossBestiary() {
  const me = useCurrentPlayer();
  const search = useSearch();
  const pid = Number(new URLSearchParams(search).get("player")) || me?.playerId || null;
  const [defeated, setDefeated] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!pid) return;
    fetch(`/api/boss-battles/progress/${pid}`).then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setDefeated(new Set(d.defeated)); setStats(d.stats ?? {}); } }).catch(() => {});
  }, [pid]);
  const nemesis = nemesisOf(stats, defeated);
  const seen = (b: Boss) => bossUnlocked(b.id, defeated);
  const total = BOSSES.filter(seen).length;

  return (
    <div className="bb-shell bx">
      <Link href="/boss-battle" className="bx-back"><ArrowLeft size={15} /> Boss Battle</Link>
      <div className="bx-hero">
        <small>Boss Battle</small>
        <h1>The Bestiary</h1>
        <p>Every boss you've met: their story, their tricks, your record against them, and what they drop.</p>
        <div className="bx-count"><b>{defeated.size}</b>/20 beaten · <b>{total}</b>/20 discovered</div>
      </div>
      {WORLDS.map(w => (
        <section key={w.id} className="bx-world" style={{ ["--world" as string]: w.colour, ["--world-glow" as string]: w.glow }}>
          <h2>{w.name}</h2>
          <div className="bx-grid">
            {BOSSES.filter(b => b.world === w.id).map(b => {
              const known = seen(b), st = stats[b.id], won = defeated.has(b.id), loot = lootFor(b.id);
              const perk = PERKS.find(p => p.from === b.id);
              const isOpen = open === b.id && known;
              const medals = Number(won) + Number(!!st?.cleanSweep) + Number(st?.bestSeconds != null && st.bestSeconds <= b.masterySeconds);
              return (
                <button key={b.id} className={`bx-card ${known ? "" : "unknown"} ${isOpen ? "open" : ""} ${won ? "won" : ""}`} onClick={() => known && setOpen(o => o === b.id ? null : b.id)}>
                  <div className="bx-top">
                    <div className="bx-port">{known ? <BossPortrait spec={b.portrait} size={64} mood={won ? "idle" : "talk"} id={`bx-${b.id}`} /> : <Lock size={20} />}</div>
                    <div className="bx-id">
                      <span className="bx-num">#{String(b.order).padStart(2, "0")} · {MODE[b.gameMode]}</span>
                      <b>{known ? b.name : "???"}</b>
                      <span className="bx-tag">{known ? b.tagline : "Not reached yet"}</span>
                      {nemesis?.bossId === b.id && <span className="bx-nem"><Flame size={10} /> Nemesis</span>}
                    </div>
                    {known && <div className="bx-rec"><b>{st?.wins ?? 0}-{(st?.attempts ?? 0) - (st?.wins ?? 0)}</b><small>W-L</small></div>}
                  </div>
                  {isOpen && (
                    <div className="bx-more" onClick={e => e.stopPropagation()}>
                      <p className="bx-lore">{b.lore}</p>
                      <div className="bx-moves">
                        {[...b.moves, ...(b.enrageMove ? [b.enrageMove] : [])].map((m, i) => (
                          <div key={m.name} className={i === 2 ? "enr" : ""}><span>{i === 0 ? "Phase 1" : i === 1 ? "Phase 2" : "Enraged"}</span><b><Zap size={11} /> {m.name}</b><small>{m.description}</small></div>
                        ))}
                      </div>
                      <div className="bx-stats">
                        <span><CheckCircle2 size={12} /> {won ? "Beaten" : "Not beaten"}</span>
                        <span><Sparkles size={12} /> {medals}/3 medals</span>
                        {st?.bestSeconds != null && <span><Clock size={12} /> Best {fmt(st.bestSeconds)}</span>}
                        {(st?.highestAscension ?? 0) > 0 && <span>Ascension {st!.highestAscension}</span>}
                      </div>
                      {loot && <div className={`bx-loot ${won ? "have" : ""}`}><Gift size={14} /> <span><b>{loot.name}</b> · {loot.category === "LEADERBOARD_TAG" ? "tag" : loot.category === "FRAME" ? "frame" : loot.category === "NAME_STYLE" ? "name style" : "banner"}{won ? " · unlocked" : " · beat it to unlock"}</span></div>}
                      {perk && <div className={`bx-loot perk ${won ? "have" : ""}`}><Sparkles size={14} /> <span>Perk: <b>{perk.name}</b> — {perk.description}</span></div>}
                      <div className="bx-world-note">{worldOf(b.world).name} · {b.botLevel} tier</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
