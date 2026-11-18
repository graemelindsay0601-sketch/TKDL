import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/context/auth";
import { useFetch } from "@/hooks/use-fetch";
import { Medal, FeatSeal } from "@/components/achievements-v2/Medal";
import { useAchievementsV2, METALS, METAL_NAME, fmt, seasonGoalText, type AreaView, type TrackView, type FeatView, type SeasonView } from "@/components/achievements-v2/api";

const H = { fontFamily: "Oswald, sans-serif" } as const;
const MUTED = "rgba(255,255,255,0.45)";
const CARD = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" } as const;

function Bar({ value, color = "#ffd24a" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  );
}

function TrackRow({ t, area }: { t: TrackView; area: AreaView["area"] }) {
  const done = t.nextTarget === null;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl min-w-0 overflow-hidden" style={CARD}>
      <Medal metal={t.metal} area={area} size={46} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-bold truncate">{t.title}</div>
          <div className="text-[11px] shrink-0 whitespace-nowrap" style={{ color: MUTED }}>{t.metal ? METAL_NAME[t.metal] : "Not started"} · {t.level}/{t.levels.length}</div>
        </div>
        <div className="text-xs mt-0.5 mb-1.5" style={{ color: MUTED }}>
          {done ? "Complete" : `${t.next} · ${fmt(t.value, t.unit)} / ${fmt(t.nextTarget!, t.unit)}`}
          {t.scorer && <span className="ml-1.5 px-1.5 rounded" style={{ background: "rgba(0,102,255,0.15)", color: "#7fb0ff" }}>Scorer</span>}
        </div>
        <div className="flex gap-1">
          {t.levels.map((_, i) => (
            <div key={i} className="flex-1"><Bar value={i < t.level ? 1 : i === t.level ? t.progress : 0} color={i < t.level ? "#ffd24a" : "#a855f7"} /></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatCard({ f }: { f: FeatView }) {
  const earned = !!f.earnedAt;
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl min-w-0" style={{ ...CARD, opacity: earned ? 1 : 0.75, borderColor: earned ? "rgba(255,210,74,0.35)" : CARD.border.split(" ").pop() }}>
      <FeatSeal earned={earned} secret={f.secret} />
      <div className="min-w-0">
        <div className="font-bold">{f.title}</div>
        <div className="text-xs" style={{ color: MUTED }}>{f.goal}</div>
        <div className="text-xs mt-1" style={{ color: earned ? "#ffd24a" : "rgba(255,255,255,0.3)" }}>
          {earned ? `Earned ${format(new Date(f.earnedAt!), "d MMM yyyy")}` : f.liveOnly ? "Can be earned from launch" : `${f.points} pts`}
        </div>
      </div>
    </div>
  );
}

function SeasonCard({ g }: { g: SeasonView }) {
  const target = g.targets[Math.min(g.completed, g.targets.length - 1)];
  const allDone = g.completed >= g.targets.length;
  return (
    <div className="p-3 rounded-xl min-w-0" style={{ ...CARD, borderColor: allDone ? "rgba(34,197,94,0.4)" : CARD.border.split(" ").pop() }}>
      <div className="flex justify-between gap-2"><div className="font-bold">{g.title}</div>
        <div className="text-xs" style={{ color: allDone ? "#22c55e" : MUTED }}>{allDone ? "Done" : `${fmt(Math.min(g.value, target))} / ${fmt(target)}`}</div></div>
      <div className="text-xs mb-2" style={{ color: MUTED }}>{seasonGoalText(g)}{g.targets.length > 1 ? ` (${g.completed}/${g.targets.length} steps)` : ""}</div>
      <Bar value={allDone ? 1 : Math.min(1, g.value / target)} color="#22c55e" />
      {g.seasonsCompleted > 0 && <div className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Completed in {g.seasonsCompleted} season{g.seasonsCompleted === 1 ? "" : "s"}</div>}
    </div>
  );
}

export default function AchievementsV2Page() {
  const { user } = useAuth();
  const search = new URLSearchParams(useSearch());
  const playerId = Number(search.get("player")) || user?.playerId || null;
  const { data, loading: isLoading } = useAchievementsV2(playerId, !!user?.isAdmin);
  const { data: player } = useFetch<{ name?: string }>(playerId ? `/api/players/${playerId}` : null);
  const [tab, setTab] = useState<AreaView["area"]>("LEAGUE");
  const view = data && "view" in data ? data.view : null;
  const area = useMemo(() => view?.areas.find(a => a.area === tab) ?? null, [view, tab]);
  const seasonGoals = view?.areas.flatMap(a => a.seasonGoals.filter(g => g.value > 0 || a.area === "LEAGUE")) ?? [];

  if (!playerId) return <div className="p-6" style={{ color: MUTED }}>Sign in to see your achievements. <Link href="/achievements/classics" className="underline">Classics</Link></div>;
  if (isLoading) return <div className="p-6" style={{ color: MUTED }}>Loading achievements…</div>;
  if (!view) return <div className="p-6" style={{ color: MUTED }}>The new achievements aren't live yet. <Link href="/achievements/classics" className="underline">See the Classics</Link></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 overflow-x-hidden">
      {data && "preview" in data && data.preview && (
        <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.35)" }}>
          Admin preview: worked out live from history. Players can't see this until achievements are switched on.
        </div>
      )}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase" style={H}>Achievements</h1>
          <div className="text-sm" style={{ color: MUTED }}>{player?.name ?? "Player"} · <span style={{ color: "#ffd24a" }}>{fmt(view.score)}</span> points · {view.featsEarned} feats</div>
        </div>
        <div className="flex items-center gap-3">
          {METALS.map(m => (
            <div key={m} className="flex flex-col items-center gap-1">
              <Medal metal={m} area="LEAGUE" size={30} label={METAL_NAME[m]} />
              <div className="text-xs font-bold">{view.metals[m]}</div>
            </div>
          ))}
          <Link href="/achievements/classics" className="ml-2 text-xs font-bold uppercase px-2.5 py-1.5 rounded-lg" style={{ ...H, ...CARD, color: MUTED }}>Classics</Link>
        </div>
      </header>

      {view.nearly.length > 0 && (
        <section>
          <h2 className="text-lg font-black uppercase mb-2" style={H}>Nearly there</h2>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">{view.nearly.map(t => <TrackRow key={t.key} t={t} area={t.area} />)}</div>
        </section>
      )}

      {data && "recent" in data && data.recent.length > 0 && (
        <section>
          <h2 className="text-lg font-black uppercase mb-2" style={H}>Recently earned</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {data.recent.map(u => (
              <div key={`${u.key}-${u.level}-${u.at}`} className="shrink-0 w-36 p-3 rounded-xl flex flex-col items-center text-center gap-1.5" style={CARD}>
                {u.kind === "FEAT" ? <FeatSeal earned secret={false} /> : <Medal metal={u.metal ?? "BRONZE"} area={u.area} size={40} />}
                <div className="text-sm font-bold leading-tight">{u.title}</div>
                <div className="text-[11px]" style={{ color: MUTED }}>{u.kind === "TRACK" ? `Level ${u.level} · ` : ""}+{u.coins} coins</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {seasonGoals.length > 0 && (
        <section>
          <h2 className="text-lg font-black uppercase mb-2" style={H}>This season</h2>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">{seasonGoals.map(g => <SeasonCard key={g.key} g={g} />)}</div>
        </section>
      )}

      <section>
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {view.areas.map(a => (
            <button key={a.area} onClick={() => setTab(a.area)} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
              style={{ ...H, letterSpacing: "0.04em", background: tab === a.area ? "rgba(255,210,74,0.15)" : "rgba(255,255,255,0.03)",
                color: tab === a.area ? "#ffd24a" : MUTED, border: `1px solid ${tab === a.area ? "rgba(255,210,74,0.4)" : "rgba(255,255,255,0.08)"}` }}>
              {a.name} <span style={{ opacity: 0.7 }}>{a.earned}/{a.total}</span>
            </button>
          ))}
        </div>
        {area && <>
          <h3 className="text-sm font-black uppercase mt-2 mb-2" style={{ ...H, color: MUTED }}>Tracks</h3>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">{area.tracks.map(t => <TrackRow key={t.key} t={t} area={area.area} />)}</div>
          <h3 className="text-sm font-black uppercase mt-5 mb-2" style={{ ...H, color: MUTED }}>Feats</h3>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">{[...area.feats].sort((a, b) => Number(!!b.earnedAt) - Number(!!a.earnedAt)).map(f => <FeatCard key={f.key} f={f} />)}</div>
        </>}
      </section>
    </div>
  );
}
