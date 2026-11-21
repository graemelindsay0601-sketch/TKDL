import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { apiFetchJson } from "@/lib/api-fetch";
import { useAchievementsV2Status, METAL_NAME, type Metal, type Area } from "./api";
import { trackArt, featArt } from "./art";
import "./unlock.css";

type Unlock = { id: number; key: string; title: string; area: Area; kind: "TRACK" | "FEAT" | "SEASON"; level: number; levels: number; metal: Metal | null;
  reached: number | null; next: number | null; nextGoal: string | null; goal: string | null; showpiece: boolean; coins: number; at: string; reachedText?: string | null; cosmetic?: string | null };

/**
 * The unlock moment: a full-screen reveal for each new achievement, one after another.
 * Syncs run a few seconds after a result is saved, so this checks on page changes, when the app comes back into view,
 * and once a minute while it's open (one small request, and only once achievements are switched on).
 */
export function UnlockCelebration() {
  const { user } = useAuth();
  const enabled = useAchievementsV2Status();
  const [location, navigate] = useLocation();
  const [queue, setQueue] = useState<Unlock[]>([]);
  const shown = useRef(new Set<number>());

  const check = useCallback(async () => {
    if (!enabled || !user?.playerId || document.visibilityState !== "visible") return;
    try {
      const { unlocks } = await apiFetchJson<{ unlocks: Unlock[] }>("/api/achievements-v2/me/unseen", { credentials: "include" });
      const fresh = unlocks.filter(u => !shown.current.has(u.id)); fresh.forEach(u => shown.current.add(u.id));
      if (fresh.length) setQueue(q => [...q, ...fresh]);
    } catch { /* quiet: the next check will pick it up */ }
  }, [enabled, user?.playerId]);

  useEffect(() => { const t = setTimeout(check, 1500); return () => clearTimeout(t); }, [check, location]);
  useEffect(() => {
    const id = setInterval(check, 60_000); const onVis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVis); return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [check]);

  const done = (u: Unlock) => { void apiFetchJson("/api/achievements-v2/me/seen", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [u.id] }) }).catch(() => {}); };
  const current = queue[0];
  if (!current) return null;
  const next = () => { done(current); setQueue(q => q.slice(1)); };
  const toCabinet = () => { queue.forEach(done); setQueue([]); navigate("/achievements"); };
  const art = current.kind === "TRACK" ? trackArt(current.key, current.metal) : featArt(current.key);
  const kicker = current.showpiece ? "Showpiece unlocked" : current.kind === "TRACK" ? "New level" : current.kind === "SEASON" ? "Season goal" : "Feat unlocked";

  return createPortal(
    <div className={`av2-unlock${current.showpiece ? " showpiece" : ""}`} role="dialog" aria-label={`${kicker}: ${current.title}`}>
      <div className="bg" /><div className="rays" />
      {[[22, 22], [76, 16], [80, 36], [16, 42], [58, 10]].map(([x, y], i) => <i key={i} className="spark" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.4}s` }} />)}
      <div className="inner">
        <div className="chip">{kicker}{queue.length > 1 ? ` · 1 of ${queue.length}` : ""}</div>
        <img src={art} alt="" className={current.kind === "TRACK" || current.showpiece ? "piece" : "seal"} />
        <h2 className="pm-chrome">{current.title}</h2>
        {current.kind === "TRACK" && current.metal && <div className="metal">{METAL_NAME[current.metal]} · level {current.level} of {current.levels}</div>}
        <div className="desc">{current.kind === "TRACK" ? (current.reachedText ? `Reached ${current.reachedText}` : current.reached !== null ? `Reached ${current.reached.toLocaleString("en-GB")}` : "") : current.goal}</div>
        {current.kind === "TRACK" && <div className="nextcard">{current.nextGoal ? <><b>Next:</b> {current.nextGoal}</> : <b>Track complete</b>}</div>}
        <div className="rewards"><span className="coins"><i />+{current.coins} coins</span>{current.cosmetic && <span className="cosmetic">✦ {current.cosmetic}</span>}</div>
        <div className="buttons">
          <button className="ghost" onClick={toCabinet}>See cabinet</button>
          <button className="go" onClick={next}>{queue.length > 1 ? "Next unlock →" : "Nice one"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
