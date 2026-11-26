import { Link } from "wouter";
import { Flame, Play, Timer } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { useCurrentPlayer } from "@/context/auth";
import { Chapter, PmCard, Glow } from "@/components/premium/Premium";

type Drill = { key: string; title: string; goal: string; gameKey: string; better: "low" | "high"; unit: string };
type Data = { day: string; drill: Drill; leaderboard: { playerId: number; name: string; value: number }[]; players: number; me: { best: number | null; rank: number | null; streak: number } | null; resetsAt: string };

const left = (iso: string) => { const ms = Date.parse(iso) - Date.now(); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60; return ms <= 0 ? "soon" : h ? `${h}h ${m}m` : `${m}m`; };
const MEDAL = ["linear-gradient(180deg,#ffe58a,#d99a00)", "linear-gradient(180deg,#fff,#9aa6bd)", "linear-gradient(180deg,#f0b27a,#9c5a2a)"];

/** One practice target a day for everyone, with a streak and today's mini-leaderboard. */
export function DailyDrill({ chapter = true }: { chapter?: boolean }) {
  const me = useCurrentPlayer();
  const { data } = useFetch<Data>(`/api/daily-drill${me?.playerId ? `?playerId=${me.playerId}` : ""}`);
  if (!data) return null;
  const { drill } = data, mine = data.me;
  return (
    <section data-testid="daily-drill">
      {chapter && <Chapter title="Daily drill" accent="#ff7a3d" aside={<span className="pm-chip" style={{ color: "#ffc7a8", borderColor: "rgba(255,122,61,.45)" }}><Timer className="w-3.5 h-3.5" /> New in {left(data.resetsAt)}</span>} />}
      <PmCard accent="#ff7a3d" className="p-4 relative overflow-hidden">
        <Glow x="92%" y="0%" color="#ff7a3d" size={260} opacity={0.28} />
        <div className="relative" style={{ zIndex: 1 }}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="pm-lab" style={{ color: "#ffb08a" }}>Today · {new Date(data.day + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</div>
              <div className="pm-metal uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, lineHeight: 1, marginTop: 4 }}>{drill.title}</div>
              <p className="text-sm mt-1.5" style={{ color: "#d8d4e6" }}>{drill.goal}. {drill.better === "low" ? "Lowest" : "Highest"} wins.</p>
            </div>
            {mine && <div className="pm-drill-streak" title="Days in a row you've done the daily drill"><Flame className="w-4 h-4" /><b>{mine.streak}</b><span>day{mine.streak === 1 ? "" : "s"}</span></div>}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="pm-drill-stat"><b>{mine?.best ?? "—"}</b><span>{mine?.best !== null && mine?.best !== undefined ? `your best (${drill.unit})` : "not played yet"}</span></div>
            <div className="pm-drill-stat"><b>{mine?.rank ? `#${mine.rank}` : "—"}</b><span>of {data.players} today</span></div>
          </div>
          {data.leaderboard.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {data.leaderboard.slice(0, 3).map((r, i) => (
                <div key={r.playerId} className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5" style={{ background: r.playerId === me?.playerId ? "rgba(255,122,61,.12)" : "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ background: MEDAL[i], color: "#140f02", fontFamily: "Oswald, sans-serif" }}>{i + 1}</span>
                  <span className="flex-1 truncate uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#fff", letterSpacing: ".03em" }}>{r.name}</span>
                  <span className="pm-num" style={{ color: "#ffb08a", fontSize: 16 }}>{r.value} <small style={{ fontSize: 11, color: "#a9a4bd" }}>{drill.unit}</small></span>
                </div>
              ))}
            </div>
          )}
          <Link href={`/practice?game=${encodeURIComponent(drill.gameKey)}&solo=1`} className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold uppercase text-sm active:scale-[.98]"
            style={{ fontFamily: "Oswald, sans-serif", letterSpacing: ".12em", color: "#1f0a00", background: "linear-gradient(180deg,#ffb37a,#ff6a2b)", boxShadow: "0 8px 22px -8px rgba(255,106,43,.6)" }}>
            <Play className="w-4 h-4" /> {mine?.best !== null && mine?.best !== undefined ? "Beat your best" : "Play today's drill"}
          </Link>
        </div>
      </PmCard>
    </section>
  );
}
