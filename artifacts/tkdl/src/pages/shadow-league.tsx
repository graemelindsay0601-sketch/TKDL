import { PageHero, Chapter } from "@/components/premium/Premium";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { CircuitBoard, Lock, Trophy, TrendingUp, Target, Zap } from "lucide-react";

const LEVEL_COLOR: Record<string, string> = {
  beginner: "#94a3b8", amateur: "#22c55e", club: "#3b82f6",
  county: "#a78bfa", pro: "#ffd24a", elite: "#ff005c",
};
const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner", amateur: "Amateur", club: "Club",
  county: "County", pro: "Pro Tour", elite: "Elite",
};

type LeagueRow = {
  player_id: number; player_name: string; sessions: number; total_darts: number;
  weighted_avg: number | null; checkout_pct: number | null; total_180s: number; level: string;
};

export default function ShadowLeague() {
  const [data, setData] = useState<{ enabled: boolean; rows: LeagueRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/shadow-bot/league")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData({ enabled: false, rows: [] }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 pb-10 pm-page">
      <PageHero kicker="Shadow Bot" icon={<CircuitBoard className="w-3.5 h-3.5" />} title="Shadow League" gold accent="#ffd24a" accent2="#22d3ee"
        sub="All shadow bots ranked by form. Rankings update automatically as players log more practice data.">
        {data?.enabled && data.rows.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { l: "Bots ranked", v: data.rows.length, c: "#7ff0ff" },
              { l: "Total 180s", v: data.rows.reduce((t, r) => t + (r.total_180s || 0), 0), c: "#ffd24a" },
              { l: "Darts logged", v: data.rows.reduce((t, r) => t + Number(r.total_darts || 0), 0).toLocaleString(), c: "#fff" },
            ].map(t => (
              <div key={t.l} className="rounded-2xl px-2 py-2.5 text-center" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.015))", border: "1px solid rgba(255,255,255,.12)" }}>
                <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22, color: t.c, textShadow: `0 0 14px ${t.c}66` }}>{t.v}</div>
                <div className="pm-lab justify-center mt-1" style={{ fontSize: 8.5, letterSpacing: ".1em" }}>{t.l}</div>
              </div>
            ))}
          </div>
        )}
      </PageHero>

      {loading ? (
        <div className="section-card py-16 text-center">
          <div className="w-6 h-6 mx-auto rounded-full border-2 border-transparent animate-spin mb-3" style={{ borderTopColor: "#ffd24a" }} />
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Loading shadow league…</p>
        </div>
      ) : !data?.enabled ? (
        <div className="pm-card relative overflow-hidden px-5 pt-6 pb-6 text-center" style={{ ["--pm-acc" as any]: "#ffd24a" }}>
          {/* Ghost podium — a preview of what the league will look like once it's switched on. */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-3 pointer-events-none" style={{ opacity: 0.16, filter: "blur(1px)" }}>
            {[{ h: 70, c: "#c0c8d8" }, { h: 100, c: "#ffd24a" }, { h: 56, c: "#cd7f32" }].map((b, i) => (
              <div key={i} style={{ width: 72, height: b.h, borderRadius: "10px 10px 0 0", background: `linear-gradient(180deg, ${b.c}, transparent)` }} />
            ))}
          </div>
          <div className="relative">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle at 35% 30%, rgba(255,210,74,.35), #120e1c)", border: "1px solid rgba(255,210,74,.6)", boxShadow: "0 0 26px rgba(255,210,74,.35)" }}>
              <Lock className="w-7 h-7" style={{ color: "#ffd24a", filter: "drop-shadow(0 0 6px rgba(255,210,74,.8))" }} />
            </div>
            <div className="pm-lab justify-center mt-4" style={{ color: "#ffd24a" }}>Coming soon</div>
            <div className="pm-chrome uppercase mt-1" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: "0.04em" }}>Not yet active</div>
            <p className="text-sm max-w-xs mx-auto mt-2" style={{ color: "#a9a4bd", lineHeight: 1.6 }}>
              The Shadow League will launch once enough players have their bots online.
              An admin can enable it from the Feature Flags panel.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5 mb-16">
              <Link href="/shadow-bot">
                <button className="px-5 rounded-full text-xs uppercase" style={{ minHeight: 40, background: "linear-gradient(180deg, #ffe58a, #e0a800)", border: "1px solid #ffd24a", color: "#1a1200", fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em", boxShadow: "0 0 16px rgba(255,210,74,.35)" }}>
                  Bot roster →
                </button>
              </Link>
              <Link href="/practice">
                <button className="px-5 rounded-full text-xs uppercase" style={{ minHeight: 40, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.16)", color: "#e4e0f0", fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
                  Practice →
                </button>
              </Link>
            </div>
          </div>
        </div>
      ) : data.rows.length === 0 ? (
        <div className="section-card p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,210,74,0.08)", border: "1px solid rgba(255,210,74,0.2)" }}>
            <CircuitBoard className="w-7 h-7" style={{ color: "rgba(255,210,74,0.4)" }} />
          </div>
          <div>
            <div className="font-black uppercase text-lg mb-2" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>
              No Bots Ranked Yet
            </div>
            <p className="text-sm max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.22)", lineHeight: 1.6 }}>
              Bots need 250+ darts of practice data before they qualify for the league table.
            </p>
          </div>
          <div className="flex items-center justify-center pt-1">
            <Link href="/practice">
              <button className="px-4 py-2 rounded-lg text-xs font-bold uppercase"
                style={{ background: "rgba(255,210,74,0.1)", border: "1px solid rgba(255,210,74,0.3)", color: "#ffd24a", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                Log a Practice Session →
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {data.rows.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 items-end pt-2">
              {[1, 0, 2].map(i => {
                const r = data.rows[i]; const c = ["#ffd24a", "#c0c8d8", "#cd7f32"][i];
                const h = i === 0 ? 118 : i === 1 ? 98 : 88;
                return (
                  <Link key={r.player_id} href={`/shadow-bot/${r.player_id}`}>
                    <div className="flex flex-col items-center text-center cursor-pointer">
                      <div className="flex items-center justify-center" style={{ width: i === 0 ? 50 : 42, height: i === 0 ? 50 : 42, borderRadius: "50%", background: ["linear-gradient(180deg,#ffe58a,#d99a00)", "linear-gradient(180deg,#ffffff,#9aa6bd)", "linear-gradient(180deg,#f0b27a,#9c5a2a)"][i], color: "#141018", fontFamily: "Oswald, sans-serif", fontSize: i === 0 ? 20 : 17, boxShadow: `0 0 18px ${c}88`, marginBottom: 6 }}>{i + 1}</div>
                      <div className="pm-lab justify-center" style={{ fontSize: 8.5, color: "#22d3ee" }}>Shadow</div>
                      <div className="w-full truncate uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: i === 0 ? 16 : 14, letterSpacing: "0.04em", color: "#fff" }}>{r.player_name}</div>
                      <div className="w-full mt-1.5 flex flex-col items-center pt-2" style={{ height: h - 50, borderRadius: "12px 12px 4px 4px", background: `linear-gradient(180deg, ${c}55, ${c}12)`, border: `1px solid ${c}77`, boxShadow: `0 0 20px ${c}33, inset 0 1px 0 rgba(255,255,255,.25)` }}>
                        <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: i === 0 ? 24 : 20, color: "#fff", textShadow: `0 0 10px ${c}` }}>{r.weighted_avg != null ? r.weighted_avg.toFixed(1) : "—"}</span>
                        <span className="pm-lab" style={{ fontSize: 8.5, color: "#e4e0f0" }}>avg</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <Chapter title="Full table" accent="#22d3ee" aside={<span className="pm-chip">{data.rows.length} bots</span>} />
          {data.rows.map((row, i) => {
            const color = LEVEL_COLOR[row.level] ?? "#94a3b8";
            const label = LEVEL_LABEL[row.level] ?? row.level;
            const medal = ["linear-gradient(180deg,#ffe58a,#d99a00)", "linear-gradient(180deg,#ffffff,#9aa6bd)", "linear-gradient(180deg,#f0b27a,#9c5a2a)"][i];
            const pc = ["#ffd24a", "#c0c8d8", "#cd7f32"][i];
            return (
              <Link key={row.player_id} href={`/shadow-bot/${row.player_id}`}>
                <div className="pm-lbrow flex items-center gap-3 rounded-2xl px-3 py-3 cursor-pointer transition-all hover:-translate-y-0.5"
                  style={{ background: i < 3 ? `linear-gradient(90deg, ${pc}26, rgba(23,20,31,.95) 50%, rgba(12,10,18,.97))` : undefined, borderColor: i < 3 ? `${pc}66` : undefined }}>
                  <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 38, height: 38, background: medal ?? "linear-gradient(180deg,#3a3550,#1d1a2b)", color: medal ? "#141018" : "#e4e0f0", fontFamily: "Oswald, sans-serif", fontSize: 15, boxShadow: medal ? `0 0 14px ${pc}66` : "inset 0 1px 0 rgba(255,255,255,.1)" }}>{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="uppercase truncate" style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, letterSpacing: "0.03em", color: "#fff" }}>
                      <span style={{ color: "#22d3ee" }}>Shadow </span>{row.player_name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="pm-chip" style={{ fontSize: 9, padding: "2px 7px", color, borderColor: `${color}66`, background: `${color}14` }}>{label}</span>
                      <span className="text-[11px]" style={{ color: "#a9a4bd", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
                        <span style={{ color: row.checkout_pct != null && row.checkout_pct >= 30 ? "#4ade80" : "#cfcade" }}>{row.checkout_pct != null ? `${row.checkout_pct}%` : "—"}</span> CO
                        {" · "}<span style={{ color: row.total_180s > 0 ? "#ffd24a" : "#cfcade" }}>{row.total_180s}</span> 180s
                        {" · "}{Number(row.total_darts).toLocaleString()} darts
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: i === 0 ? 28 : 24, color: i === 0 ? "#ffd24a" : "#7ff0ff", textShadow: i === 0 ? "0 0 16px rgba(255,210,74,.55)" : "0 0 12px rgba(34,211,238,.45)" }}>
                      {row.weighted_avg != null ? row.weighted_avg.toFixed(1) : "—"}
                    </div>
                    <div className="pm-lab justify-end" style={{ fontSize: 8.5 }}>avg</div>
                  </div>
                </div>
              </Link>
            );
          })}

          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.06em" }}>
            RANKED BY RECENCY-WEIGHTED 3-DART AVERAGE · MINIMUM 250 DARTS TO QUALIFY
          </p>
        </div>
      )}
    </div>
  );
}
