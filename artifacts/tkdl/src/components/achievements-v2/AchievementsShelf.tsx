import { Link } from "wouter";
import { useAuth } from "@/context/auth";
import { Medal, FeatSeal } from "./Medal";
import { useAchievementsV2, METALS, METAL_NAME, fmt } from "./api";

const METAL_RANK = Object.fromEntries(METALS.map((m, i) => [m, i + 1])) as Record<string, number>;

/** The new achievements on a profile: points, metals and the best few medals and feats, linking to the full page. */
export function AchievementsShelf({ playerId }: { playerId: number }) {
  const { user } = useAuth();
  const { data } = useAchievementsV2(playerId, !!user?.isAdmin);
  if (!data || !("view" in data)) return null;
  const v = data.view;
  const best = v.areas.flatMap(a => a.tracks.filter(t => t.metal).map(t => ({ ...t, area: a.area })))
    .sort((a, b) => METAL_RANK[b.metal!] - METAL_RANK[a.metal!] || b.level - a.level).slice(0, 6);
  const feats = v.areas.flatMap(a => a.feats.filter(f => f.earnedAt)).sort((a, b) => b.points - a.points).slice(0, 4);
  return (
    <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(255,210,74,0.06), rgba(168,85,247,0.05))", border: "1px solid rgba(255,210,74,0.2)" }}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div>
          <h2 className="text-2xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>Achievements</h2>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            <span style={{ color: "#ffd24a" }}>{fmt(v.score)}</span> points · {v.featsEarned} feats{data.preview ? " · admin preview" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {METALS.map(m => <div key={m} className="flex items-center gap-1 text-xs font-bold"><Medal metal={m} area="LEAGUE" size={18} label={METAL_NAME[m]} />{v.metals[m]}</div>)}
        </div>
      </div>
      {best.length === 0 && feats.length === 0
        ? <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Nothing earned yet.</p>
        : <div className="flex gap-3 overflow-x-auto pb-1">
            {best.map(t => (
              <div key={t.key} className="shrink-0 w-24 flex flex-col items-center text-center gap-1">
                <Medal metal={t.metal} area={t.area} size={52} />
                <div className="text-[11px] font-bold leading-tight">{t.title}</div>
              </div>
            ))}
            {feats.map(f => (
              <div key={f.key} className="shrink-0 w-24 flex flex-col items-center text-center gap-1">
                <FeatSeal earned secret={false} size={52} />
                <div className="text-[11px] font-bold leading-tight">{f.title}</div>
              </div>
            ))}
          </div>}
      <Link href={`/achievements?player=${playerId}`} className="inline-block mt-3 text-xs font-bold uppercase" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>See all achievements →</Link>
    </div>
  );
}
