import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Award, Trophy, Zap, Target, Flame, Star, Dumbbell, Medal, ArrowLeft, Skull, TrendingDown, Frown, RotateCcw, Banknote } from "lucide-react";
import { TierBadge } from "@/components/tier-badge";
import { useCosmeticsCatalog, nameStyleCSS, nameStyleClassName, type CosmeticDefinition } from "@/lib/cosmetics";
import { useFetch } from "@/hooks/use-fetch";

type PlayerRecord = { id: number; name: string; careerWins: number; careerLosses: number; careerPeakElo: number; careerPoints: number; longestWinStreak: number; longestLossStreak: number; careerBiggestPointsFall: number; sessions: number; total180s: number; tourTrophies: number; achievements: number; eliminationsCount: number; biggestSingleLoss: number };
type HofData = {
  mostWins: PlayerRecord[]; highestElo: PlayerRecord[]; mostPoints: PlayerRecord[]; longestStreak: PlayerRecord[];
  mostSessions: PlayerRecord[]; most180s: PlayerRecord[]; mostTourTrophies: PlayerRecord[]; mostAchievements: PlayerRecord[];
  mostLosses: PlayerRecord[]; longestLossStreak: PlayerRecord[]; biggestPointsFall: PlayerRecord[];
  mostEliminations: PlayerRecord[]; biggestSingleLoss: PlayerRecord[];
};

const MEDAL_COLORS = ["#ffd24a", "#c0c8d8", "#cd7f32"];
const SHAME_COLORS = ["#ff005c", "#c76b8a", "#8a5a68"];

// Resolves the #1 slot's equipped NAME_STYLE for a bounded set of distinct
// record-holder ids (at most one fetch per unique player, never per card —
// the same player often tops more than one record). Only ever called with
// the "good" records' winner ids (see HallOfFame below) — the wall-of-shame
// cards keep their flat semantic red, same precedent as POST_ACCENT never
// overriding Community's pending/system-post colours: an existing
// meaningful colour takes precedence over a purchased cosmetic.
function usePlayerNameStyles(ids: number[]): Record<number, string | null> {
  const key = ids.join(",");
  const [byId, setById] = useState<Record<number, string | null>>({});
  useEffect(() => {
    let cancelled = false;
    const unique = Array.from(new Set(ids));
    Promise.all(unique.map(id =>
      fetch(`/api/players/${id}/cosmetics`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => [id, d?.equippedNameStyleId ?? null] as const)
        .catch(() => [id, null] as const)
    )).then(pairs => {
      if (cancelled) return;
      setById(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return byId;
}

function RecordCard({ icon, label, accent, top, valueKey, suffix = "", medals = ["🥇", "🥈", "🥉"], rankColors = MEDAL_COLORS, subtitle = "RECORD HOLDER", nameStyle }: {
  icon: React.ReactNode; label: string; accent: string;
  top: PlayerRecord[]; valueKey: keyof PlayerRecord; suffix?: string;
  medals?: string[]; rankColors?: string[]; subtitle?: string;
  nameStyle?: CosmeticDefinition;
}) {
  if (!top || top.length === 0) return null;
  const winner = top[0];
  const val    = winner[valueKey] as number;
  if (!val) return null;

  return (
    <div className="pdc-card overflow-hidden">
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.06)", background: `${accent}08` }}>
        <span style={{ color: accent }}>{icon}</span>
        <span className="font-black uppercase text-xs tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: accent, fontSize: "0.62rem", letterSpacing: "0.16em" }}>{label}</span>
      </div>

      {/* Winner */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="text-2xl leading-none">{medals[0]}</div>
        <div className="flex-1 min-w-0">
          <Link href={`/players/${winner.id}`}>
            <div className={`font-black uppercase text-sm truncate cursor-pointer hover:opacity-70 transition-opacity ${nameStyleClassName(nameStyle)}`}
              style={{ fontFamily: "Oswald, sans-serif", color: rankColors[0], letterSpacing: "0.06em", ...nameStyleCSS(nameStyle) }}>
              {winner.name}
            </div>
          </Link>
          <div className="font-black text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.6rem" }}>
            {subtitle}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-black leading-none tabular-nums"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.9rem", color: accent, textShadow: `0 0 20px ${accent}55` }}>
            {val.toLocaleString()}{suffix}
          </div>
        </div>
      </div>

      {/* Runners up */}
      {top.slice(1).filter(p => (p[valueKey] as number) > 0).map((p, i) => (
        <div key={p.id} className="px-4 py-2 flex items-center gap-2.5 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          <span className="text-base leading-none">{medals[i + 1]}</span>
          <Link href={`/players/${p.id}`}>
            <span className="font-bold text-xs uppercase truncate cursor-pointer hover:opacity-70 transition-opacity"
              style={{ fontFamily: "Oswald, sans-serif", color: rankColors[i + 1], letterSpacing: "0.04em" }}>
              {p.name}
            </span>
          </Link>
          <span className="ml-auto font-bold text-xs tabular-nums"
            style={{ fontFamily: "Share Tech Mono, monospace", color: "rgba(255,255,255,0.35)" }}>
            {(p[valueKey] as number).toLocaleString()}{suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function HallOfFame() {
  const { data, loading } = useFetch<HofData>("/api/stats/hall-of-fame");

  // Winner ids for just the 8 "good" records (never the wall-of-shame ones —
  // see usePlayerNameStyles' comment above), deduped and order-stable so the
  // fetch effect doesn't re-fire every render.
  const goodWinnerIds = data
    ? [data.mostWins, data.highestElo, data.mostPoints, data.longestStreak, data.mostSessions, data.most180s, data.mostTourTrophies, data.mostAchievements]
        .map(top => top?.[0]?.id).filter((id): id is number => !!id)
    : [];
  const nameStylesById = usePlayerNameStyles(goodWinnerIds);
  const cosmeticsCatalog = useCosmeticsCatalog();
  const nameStyleFor = (playerId: number | undefined) =>
    playerId ? cosmeticsCatalog.find(c => c.id === nameStylesById[playerId]) : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-xs mb-4 transition-opacity hover:opacity-70"
          style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
          <ArrowLeft className="w-3 h-3" /> LEAGUE
        </Link>

        <div className="relative overflow-hidden rounded-2xl px-6 py-8 mb-2"
          style={{ background: "linear-gradient(135deg, rgba(255,210,74,0.12) 0%, rgba(255,210,74,0.03) 50%, rgba(0,0,0,0) 100%)", border: "1px solid rgba(255,210,74,0.2)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffd24a' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,210,74,0.15)", border: "1px solid rgba(255,210,74,0.3)" }}>
                <Award className="w-5 h-5" style={{ color: "#ffd24a", filter: "drop-shadow(0 0 6px rgba(255,210,74,0.6))" }} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,210,74,0.5)", fontSize: "0.6rem", letterSpacing: "0.2em" }}>
                  TKDL
                </div>
                <h1 className="font-black uppercase leading-none"
                  style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(2rem, 5vw, 3.2rem)", color: "#ffd24a", letterSpacing: "0.06em", textShadow: "0 0 30px rgba(255,210,74,0.4)" }}>
                  HALL OF FAME
                </h1>
              </div>
            </div>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
              All-time records. Permanent legacy.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ffd24a" }} />
        </div>
      ) : !data ? (
        <div className="pdc-card p-8 text-center">
          <Trophy className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p style={{ color: "rgba(255,255,255,0.3)" }}>No records yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RecordCard icon={<Trophy className="w-4 h-4" />}    label="Most League Wins"    accent="#22c55e"  top={data.mostWins}         valueKey="careerWins"        nameStyle={nameStyleFor(data.mostWins?.[0]?.id)} />
          <RecordCard icon={<Zap className="w-4 h-4" />}       label="Highest Peak Elo"    accent="#0066ff"  top={data.highestElo}       valueKey="careerPeakElo"     nameStyle={nameStyleFor(data.highestElo?.[0]?.id)} />
          <RecordCard icon={<Star className="w-4 h-4" />}      label="Most Career Points"  accent="#ffd24a"  top={data.mostPoints}       valueKey="careerPoints"      nameStyle={nameStyleFor(data.mostPoints?.[0]?.id)} />
          <RecordCard icon={<Flame className="w-4 h-4" />}     label="Longest Win Streak"  accent="#ff005c"  top={data.longestStreak}    valueKey="longestWinStreak"  nameStyle={nameStyleFor(data.longestStreak?.[0]?.id)} />
          <RecordCard icon={<Dumbbell className="w-4 h-4" />}  label="Most Practice Sessions" accent="#a78bfa" top={data.mostSessions}  valueKey="sessions"          nameStyle={nameStyleFor(data.mostSessions?.[0]?.id)} />
          <RecordCard icon={<Target className="w-4 h-4" />}    label="Most 180s"           accent="#ff005c"  top={data.most180s}         valueKey="total180s"         nameStyle={nameStyleFor(data.most180s?.[0]?.id)} />
          <RecordCard icon={<Award className="w-4 h-4" />}     label="Most Tour Trophies"  accent="#ffd24a"  top={data.mostTourTrophies} valueKey="tourTrophies"      nameStyle={nameStyleFor(data.mostTourTrophies?.[0]?.id)} />
          <RecordCard icon={<Medal className="w-4 h-4" />}     label="Most Achievements"   accent="#a855f7"  top={data.mostAchievements} valueKey="achievements"      nameStyle={nameStyleFor(data.mostAchievements?.[0]?.id)} />
        </div>
      )}

      {data && (
        <div>
          <div className="relative overflow-hidden rounded-2xl px-6 py-6 mb-4 mt-8"
            style={{ background: "linear-gradient(135deg, rgba(255,0,92,0.12) 0%, rgba(255,0,92,0.03) 50%, rgba(0,0,0,0) 100%)", border: "1px solid rgba(255,0,92,0.2)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,0,92,0.15)", border: "1px solid rgba(255,0,92,0.3)" }}>
                <Skull className="w-5 h-5" style={{ color: "#ff005c", filter: "drop-shadow(0 0 6px rgba(255,0,92,0.6))" }} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,0,92,0.5)", fontSize: "0.6rem", letterSpacing: "0.2em" }}>
                  TKDL
                </div>
                <h2 className="font-black uppercase leading-none" style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(1.4rem, 3.5vw, 2.1rem)", color: "#ff005c", letterSpacing: "0.06em" }}>
                  WALL OF SHAME
                </h2>
              </div>
            </div>
            <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
              Every league needs a villain arc. Worn with pride, or at least denial.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RecordCard icon={<Frown className="w-4 h-4" />}       label="Wooden Spoon"       accent="#ff005c" top={data.mostLosses}         valueKey="careerLosses"      medals={["🥄","😬","😅"]} rankColors={SHAME_COLORS} subtitle="MOST CAREER LOSSES" />
            <RecordCard icon={<TrendingDown className="w-4 h-4" />} label="The Choke Award"    accent="#ff005c" top={data.longestLossStreak}  valueKey="longestLossStreak" medals={["🫠","😬","😅"]} rankColors={SHAME_COLORS} subtitle="LONGEST LOSING STREAK" />
            <RecordCard icon={<Skull className="w-4 h-4" />}       label="The Collapse"       accent="#ff005c" top={data.biggestPointsFall}  valueKey="careerBiggestPointsFall" suffix=" pts" medals={["💀","😬","😅"]} rankColors={SHAME_COLORS} subtitle="BIGGEST FALL FROM PEAK (ALL-TIME)" />
            <RecordCard icon={<RotateCcw className="w-4 h-4" />}   label="Frequent Flyer"     accent="#ff005c" top={data.mostEliminations}   valueKey="eliminationsCount" medals={["🔁","😬","😅"]} rankColors={SHAME_COLORS} subtitle="MOST TIMES ELIMINATED" />
            <RecordCard icon={<Banknote className="w-4 h-4" />}    label="Highway Robbery"    accent="#ff005c" top={data.biggestSingleLoss}  valueKey="biggestSingleLoss" suffix=" pts" medals={["💸","😬","😅"]} rankColors={SHAME_COLORS} subtitle="BIGGEST SINGLE-MATCH LOSS" />
          </div>
        </div>
      )}
    </div>
  );
}
