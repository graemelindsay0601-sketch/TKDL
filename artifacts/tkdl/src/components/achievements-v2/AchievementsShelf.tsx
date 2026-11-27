import { useState } from "react";
import { Chapter } from "@/components/premium/Premium";
import { Link } from "wouter";
import { InspectSheet, type InspectItem } from "./InspectSheet";
import { useAchievementsV2, METALS, METAL_NAME, fmt, type Metal } from "./api";
import { trackArt, featArt } from "./art";

const METAL_RANK: Record<Metal, number> = { BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4, DIAMOND: 5 };
const METAL_COLOUR: Record<Metal, string> = { BRONZE: "#d79a6b", SILVER: "#dde2ea", GOLD: "#ffd24a", PLATINUM: "#a9d6e5", DIAMOND: "#9ff5ff" };

/** The new achievements on a profile: a lit display case with the best five pieces (best in the middle), metals and latest feats. */
export function AchievementsShelf({ playerId }: { playerId: number }) {
  const { data } = useAchievementsV2(playerId, true);
  const [inspect, setInspect] = useState<InspectItem | null>(null);
  if (!data || !("view" in data)) return null;
  const v = data.view;
  const top = v.areas.flatMap(a => a.tracks.filter(t => t.metal)).sort((a, b) => METAL_RANK[b.metal!] - METAL_RANK[a.metal!] || b.level - a.level).slice(0, 5);
  const order = [3, 1, 0, 2, 4].map(i => top[i]).filter(Boolean);           // best in the middle, falling away to the sides
  const sizes = order.length === 5 ? [78, 88, 112, 88, 78] : order.map((_, i) => (i === Math.floor(order.length / 2) ? 112 : 88));
  const showpieces = v.areas.flatMap(a => a.feats.filter(f => f.showpiece && f.earnedAt));
  const feats = v.areas.flatMap(a => a.feats.filter(f => f.earnedAt && !f.showpiece)).sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? "")).slice(0, 4);
  return (
    <div>
      <Chapter title="Trophy cabinet" accent="#ffd24a" aside={<span className="pm-chip" style={{ color: "#ffe9a3", borderColor: "rgba(255,210,74,.45)" }}>{fmt(v.score)} pts{data.preview ? " · preview" : ""}</span>} />
      <div style={{ position: "relative", borderRadius: 18, padding: "14px 12px 0", overflow: "hidden", background: "linear-gradient(180deg,#221830,#100b18)",
        border: "1px solid rgba(255,210,74,.22)", boxShadow: "inset 0 0 50px rgba(0,0,0,.6), 0 0 30px rgba(255,210,74,.06)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "60%", background: "linear-gradient(180deg,rgba(255,255,255,.06),transparent)", pointerEvents: "none" }} />
        {order.length === 0 && showpieces.length === 0
          ? <p style={{ position: "relative", padding: "24px 4px 30px", textAlign: "center", color: "rgba(255,255,255,.4)", fontSize: 13 }}>Nothing on the shelf yet.</p>
          : <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", padding: "0 2px 12px", position: "relative" }}>
              {showpieces.slice(0, 1).map(f => <img key={f.key} className="av2-tap" onClick={() => setInspect({ kind: "feat", f })} src={featArt(f.key)} alt={f.title} title={f.title} style={{ width: 96, height: 124, objectFit: "contain", filter: "drop-shadow(0 10px 8px rgba(0,0,0,.6)) drop-shadow(0 0 14px rgba(255,200,90,.3))" }} />)}
              {order.map((t, i) => <img key={t!.key} className="av2-tap" onClick={() => setInspect({ kind: "track", t: t! })} src={trackArt(t!.key, t!.metal)} alt={t!.title} title={`${t!.title} · ${METAL_NAME[t!.metal!]}`}
                style={{ width: sizes[i] * 0.78, height: sizes[i], objectFit: "contain", filter: "drop-shadow(0 10px 8px rgba(0,0,0,.6))" }} />)}
            </div>}
        <div style={{ height: 14, margin: "0 -12px", background: "linear-gradient(#5a3a22,#2e1c10)", boxShadow: "inset 0 1px 0 rgba(255,220,180,.25)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 4px 12px", fontSize: 11, position: "relative" }}>
          {METALS.map(m => <span key={m}><b style={{ color: METAL_COLOUR[m] }}>{v.metals[m]}</b> <span style={{ color: "rgba(255,255,255,.45)" }}>{METAL_NAME[m]}</span></span>)}
        </div>
      </div>
      {feats.length > 0 && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "12px 0 4px" }}>
          {feats.map(f => <img key={f.key} className="av2-tap" onClick={() => setInspect({ kind: "feat", f })} src={featArt(f.key)} alt={f.title} title={f.title} style={{ width: 48, height: 52, objectFit: "contain" }} />)}
          <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 12 }}><b>{v.featsEarned} feats</b><div style={{ color: "rgba(255,255,255,.45)" }}>latest: {feats[0].title}</div></div>
        </div>
      )}
      <Link href={`/achievements?player=${playerId}`} className="inline-block mt-2 text-xs font-bold uppercase" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>See the full cabinet →</Link>
      {inspect && <InspectSheet item={inspect} onClose={() => setInspect(null)} />}
    </div>
  );
}
