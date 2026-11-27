import { Glow, DartboardBackdrop, Chapter } from "@/components/premium/Premium";
import { MonthlyLeagueReports } from "@/components/monthly-league-reports";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Award, Trophy, Zap, Target, Flame, Star, Dumbbell, Medal, ArrowLeft, Skull, TrendingDown, Banknote, Crown, History, Percent, Globe2, CircleSlash, CircleDot, Swords, Crosshair } from "lucide-react";
import { TierBadge } from "@/components/tier-badge";
import { useCosmeticsCatalog, nameStyleCSS, nameStyleClassName, type CosmeticDefinition } from "@/lib/cosmetics";
import { useFetch } from "@/hooks/use-fetch";

type PlayerRecord = { id: number; name: string; careerWins: number; careerLosses: number; careerGamesPlayed: number; careerWinRate: number; careerPeakElo: number; careerPoints: number; leagueTitles: number; longestWinStreak: number; longestLossStreak: number; careerBiggestPointsFall: number; sessions: number; total180s: number; tourTrophies: number; achievements: number; eliminationsCount: number; timesEliminated: number; biggestSingleLoss: number; cricketWins?: number; atwWins?: number; nineMarkVisits?: number; trebleSkips?: number; cricketBlanks?: number; bullTrouble?: number; atwStalls?: number; bountiesClaimed?: number; calloutBest?: number; calloutsDucked?: number };
type Champion = { id: number; name: string; championId: number; championName: string; endDate: string | null };
type HofData = {
  mostTitles: PlayerRecord[]; mostWins: PlayerRecord[]; highestElo: PlayerRecord[]; mostPoints: PlayerRecord[]; longestStreak: PlayerRecord[];
  mostSessions: PlayerRecord[]; most180s: PlayerRecord[]; mostTourTrophies: PlayerRecord[]; mostAchievements: PlayerRecord[];
  lowestWinRate: PlayerRecord[]; longestLossStreak: PlayerRecord[]; biggestPointsFall: PlayerRecord[];
  mostEliminations: PlayerRecord[]; mostTimesEliminated: PlayerRecord[]; biggestSingleLoss: PlayerRecord[]; champions: Champion[];
  mostCricketWins?: PlayerRecord[]; mostAtwWins?: PlayerRecord[]; mostNineMarks?: PlayerRecord[]; mostTrebleSkips?: PlayerRecord[];
  mostCricketBlanks?: PlayerRecord[]; worstBullTrouble?: PlayerRecord[]; mostAtwStalls?: PlayerRecord[];
  mostBounties?: PlayerRecord[]; bestCalloutRun?: PlayerRecord[]; mostDucked?: PlayerRecord[];
};

const MEDAL_COLORS = ["#ffd24a", "#c0c8d8", "#cd7f32"];
const SHAME_COLORS = ["#ff005c", "#c76b8a", "#8a5a68"];

// Resolves the #1 slot's equipped NAME_STYLE for a bounded set of distinct
// record-holder ids (at most one fetch per unique player, never per card —
// the same player often tops more than one record). Only ever called with
// the positive records' winner ids (see HallOfFame below) — the wall-of-shame
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

function RecordCard({ icon, label, accent, top, valueKey, suffix = "", medals = ["🥇", "🥈", "🥉"], rankColors = MEDAL_COLORS, subtitle = "RECORD HOLDER", description, context, nameStyle }: {
  icon: React.ReactNode; label: string; accent: string;
  top: PlayerRecord[]; valueKey: keyof PlayerRecord; suffix?: string;
  medals?: string[]; rankColors?: string[]; subtitle?: string;
  description?: string; context?: (player: PlayerRecord) => string;
  nameStyle?: CosmeticDefinition;
}) {
  if (!top || top.length === 0) return null;
  const winner = top[0];
  const val    = winner[valueKey] as number;
  if (val === undefined || val === null || (val === 0 && valueKey !== "careerWinRate")) return null;
  const rankFor = (index: number) => {
    let rank = 0;
    for (let i = 1; i <= index; i++) if (top[i][valueKey] !== top[i - 1][valueKey]) rank = i;
    return Math.min(rank, 2);
  };

  return (
    <div className="pm-card overflow-hidden relative" style={{ ["--pm-acc" as any]: accent }}>
      <div className="absolute pointer-events-none" style={{ right: -60, top: -60, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${accent}2e, transparent 70%)` }} />
      <div className="relative px-4 pt-3.5 pb-1 flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: accent, background: `${accent}1c`, border: `1px solid ${accent}55`, boxShadow: `0 0 12px ${accent}33` }}>{icon}</span>
        <span className="pm-lab" style={{ color: accent, fontSize: 10.5 }}>{label}</span>
      </div>

      {/* Winner */}
      <div className="relative px-4 py-3 flex items-center gap-3">
        <div className="shrink-0 flex items-center justify-center rounded-full text-2xl" style={{ width: 46, height: 46, background: `radial-gradient(circle at 35% 30%, ${accent}40, rgba(13,11,20,.9))`, border: `1px solid ${accent}77`, boxShadow: `0 0 16px ${accent}44` }}>{medals[0]}</div>
        <div className="flex-1 min-w-0">
          <Link href={`/players/${winner.id}`}>
            <div className={`uppercase truncate cursor-pointer hover:opacity-70 transition-opacity ${nameStyle ? nameStyleClassName(nameStyle) : ""}`}
              style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 19, color: rankColors[0], letterSpacing: "0.04em", ...nameStyleCSS(nameStyle) }}>
              {winner.name}
            </div>
          </Link>
          <div className="pm-lab mt-0.5" style={{ fontSize: 9 }}>
            {top[1]?.[valueKey] === winner[valueKey] ? "JOINT RECORD HOLDER" : subtitle}{context ? ` · ${context(winner)}` : ""}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-black leading-none tabular-nums"
            style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "2.3rem", color: accent, textShadow: `0 0 22px ${accent}aa` }}>
            {val.toLocaleString()}{suffix}
          </div>
        </div>
      </div>

      {/* Runners up */}
      {top.slice(1).filter(p => (p[valueKey] as number) > 0 || valueKey === "careerWinRate").map((p, i) => (
        <div key={p.id} className="relative px-4 py-2.5 flex items-center gap-2.5 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <span className="text-base leading-none">{medals[rankFor(i + 1)]}</span>
          <Link href={`/players/${p.id}`}>
            <span className="font-bold text-xs uppercase truncate cursor-pointer hover:opacity-70 transition-opacity"
              style={{ fontFamily: "Oswald, sans-serif", color: rankColors[rankFor(i + 1)], letterSpacing: "0.04em" }}>
              {p.name}
            </span>
          </Link>
          <span className="ml-auto font-bold text-xs tabular-nums"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: 14, color: "#cfcade" }}>
            {(p[valueKey] as number).toLocaleString()}{suffix}
          </span>
          {context && <span className="hidden sm:inline text-[0.55rem]" style={{ color: "rgba(255,255,255,0.22)" }}>{context(p)}</span>}
        </div>
      ))}
      {description && <div className="relative px-4 py-2.5 border-t text-[0.66rem] leading-relaxed" style={{ borderColor: "rgba(255,255,255,0.07)", color: "#8f8aa3" }}>{description}</div>}
    </div>
  );
}

function SectionTitle({ icon, eyebrow, title, description, accent }: { icon: React.ReactNode; eyebrow: string; title: string; description: string; accent: string }) {
  return <div className="mt-8 mb-1">
    <Chapter title={title} accent={accent} aside={<span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: accent, background: `${accent}1c`, border: `1px solid ${accent}55` }}>{icon}</span>} />
    <p className="text-xs -mt-1 mb-3" style={{ color: "#8f8aa3" }}><span className="pm-lab mr-1.5" style={{ color: accent, fontSize: 9 }}>{eyebrow}</span>{description}</p>
  </div>;
}

export default function HallOfFame() { return <HallPage />; }

/** One page per board: Hall of Fame (default) or Hall of Shame (`shame`). Same data and cards. */
export function HallPage({ shame = false }: { shame?: boolean }) {
  const { data, loading } = useFetch<HofData>("/api/stats/hall-of-fame");

  // Winner ids for the positive records (never the wall-of-shame ones —
  // see usePlayerNameStyles' comment above), deduped and order-stable so the
  // fetch effect doesn't re-fire every render.
  const goodWinnerIds = data
    ? [data.mostTitles, data.mostWins, data.highestElo, data.mostPoints, data.longestStreak, data.mostEliminations, data.mostSessions, data.most180s, data.mostTourTrophies, data.mostAchievements, data.mostCricketWins, data.mostAtwWins, data.mostNineMarks, data.mostTrebleSkips, data.mostBounties, data.bestCalloutRun]
        .map(top => top?.[0]?.id).filter((id): id is number => !!id)
    : [];
  const nameStylesById = usePlayerNameStyles(goodWinnerIds);
  const cosmeticsCatalog = useCosmeticsCatalog();
  const nameStyleFor = (playerId: number | undefined) =>
    playerId ? cosmeticsCatalog.find(c => c.id === nameStylesById[playerId]) : undefined;

  return (
    <div className="space-y-6 pm-page">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Link href="/records" className="inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
            style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
            <ArrowLeft className="w-3 h-3" /> RECORDS
          </Link>
          <span className="flex-1" />
          <Link href={shame ? "/hall-of-fame" : "/hall-of-shame"} className="pm-chip" style={{ color: shame ? "#ffd24a" : "#ff005c", borderColor: shame ? "rgba(255,210,74,.45)" : "rgba(255,0,92,.45)" }}>
            {shame ? "Hall of Fame →" : "Hall of Shame →"}
          </Link>
          <Link href="/records" className="pm-chip" style={{ color: "#19c3c8", borderColor: "rgba(25,195,200,.45)" }}>League Records →</Link>
        </div>

        {shame && (
          <div className="relative overflow-hidden" style={{ borderRadius: 24, border: "1px solid rgba(255,0,92,.4)", background: "linear-gradient(160deg, rgba(255,0,92,.24) 0%, #170a14 50%, #06060b 100%)", boxShadow: "0 20px 50px rgba(0,0,0,.55), 0 0 40px rgba(255,0,92,.12)" }}>
            <Glow x="85%" y="5%" color="#ff005c" size={440} opacity={0.28} />
            <DartboardBackdrop size={460} opacity={0.07} style={{ right: -170, top: -100, transform: "rotate(8deg)" }} />
            <div className="relative p-5" style={{ zIndex: 1 }}>
              <span className="pm-lab inline-flex items-center gap-1.5" style={{ color: "#ff005c" }}><Skull className="w-3.5 h-3.5" /> TKDL · All-time</span>
              <h1 className="pm-title uppercase" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "clamp(2.4rem, 11vw, 3.6rem)", letterSpacing: "0.03em", lineHeight: 0.98, marginTop: 6, background: "linear-gradient(180deg, #ffd0dd 0%, #ff4d85 55%, #ff005c 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: "drop-shadow(0 0 18px rgba(255,0,92,.35))" }}>
                Hall of Shame
              </h1>
              <p className="text-sm mt-2" style={{ color: "#c9a3b3" }}>Every league needs a villain arc. Worn with pride, or at least denial.</p>
            </div>
          </div>
        )}

        {!shame && <div className="relative overflow-hidden" style={{ borderRadius: 24, border: "1px solid rgba(255,210,74,.35)", background: "linear-gradient(160deg, rgba(255,210,74,.2) 0%, #17112a 48%, #06060b 100%)", boxShadow: "0 20px 50px rgba(0,0,0,.55), 0 0 40px rgba(255,210,74,.1)" }}>
          <Glow x="85%" y="5%" color="#ffd24a" size={440} opacity={0.3} />
          <Glow x="5%" y="95%" color="#a855f7" size={380} opacity={0.22} />
          <DartboardBackdrop size={460} opacity={0.08} style={{ right: -170, top: -100, transform: "rotate(8deg)" }} />
          <div className="relative p-5" style={{ zIndex: 1 }}>
            <span className="pm-lab inline-flex items-center gap-1.5" style={{ color: "#ffd24a" }}><Award className="w-3.5 h-3.5" /> TKDL · All-time</span>
            <h1 className="pm-title pm-title-gold uppercase" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "clamp(2.4rem, 11vw, 3.6rem)", letterSpacing: "0.03em", lineHeight: 0.98, marginTop: 6 }}>
              Hall of Fame
            </h1>
            <p className="text-sm mt-2" style={{ color: "#a9a4bd" }}>All-time records. Permanent legacy.</p>
          </div>
        </div>}
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
        <>
          {!shame && <>
          <div data-testid="hall-legends">
          <SectionTitle icon={<Crown className="w-4 h-4"/>} eyebrow="THE HONOURS BOARD" title="League Legends" description="Championships and competitive records from the TKDL league." accent="#ffd24a" />
          {data.champions.length > 0 && <div className="pm-card overflow-hidden mb-4" style={{ ["--pm-acc" as any]: "#ffd24a" }}>
            <div className="px-4 pt-3.5 flex items-center gap-2"><History className="w-4 h-4" style={{color:"#ffd24a"}}/><span className="pm-lab" style={{color:"#ffd24a", fontSize: 10.5}}>Champions timeline</span></div>
            <div className="flex gap-3 overflow-x-auto p-4">{data.champions.map((season,index)=><div key={season.id} className="min-w-[155px] rounded-xl p-3" style={{background:index===0?"linear-gradient(160deg, rgba(255,210,74,.24), rgba(20,17,30,.95))":"linear-gradient(160deg, rgba(255,255,255,.06), rgba(20,17,30,.95))",border:`1px solid ${index===0?"rgba(255,210,74,.6)":"rgba(255,210,74,.2)"}`,boxShadow:index===0?"0 0 18px rgba(255,210,74,.2)":undefined}}><div className="text-[0.55rem] tracking-widest" style={{color:"rgba(255,210,74,.55)"}}>{season.endDate ? new Date(`${season.endDate}T12:00:00`).getFullYear() : "SEASON"}</div><div className="font-black uppercase truncate mt-1" style={{fontFamily:"Oswald, sans-serif",color:"#fff"}}>{season.name}</div><Link href={`/players/${season.championId}`}><div className="text-xs font-bold mt-2 truncate" style={{color:"#ffd24a"}}>🏆 {season.championName}</div></Link></div>)}</div>
          </div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RecordCard icon={<Crown className="w-4 h-4" />} label="Most League Titles" accent="#ffd24a" top={data.mostTitles} valueKey="leagueTitles" description="Completed Singles championships won." nameStyle={nameStyleFor(data.mostTitles?.[0]?.id)} />
            <RecordCard icon={<Trophy className="w-4 h-4" />} label="Most League Wins" accent="#22c55e" top={data.mostWins} valueKey="careerWins" context={p=>`${p.careerGamesPlayed} played`} nameStyle={nameStyleFor(data.mostWins?.[0]?.id)} />
            <RecordCard icon={<Zap className="w-4 h-4" />} label="Highest Peak Elo" accent="#0066ff" top={data.highestElo} valueKey="careerPeakElo" description="Highest rating reached at any point in a player's career." nameStyle={nameStyleFor(data.highestElo?.[0]?.id)} />
            <RecordCard icon={<Star className="w-4 h-4" />} label="Most Career Points" accent="#ffd24a" top={data.mostPoints} valueKey="careerPoints" nameStyle={nameStyleFor(data.mostPoints?.[0]?.id)} />
            <RecordCard icon={<Flame className="w-4 h-4" />} label="Longest Win Streak" accent="#ff005c" top={data.longestStreak} valueKey="longestWinStreak" nameStyle={nameStyleFor(data.longestStreak?.[0]?.id)} />
            <RecordCard icon={<Skull className="w-4 h-4" />} label="The Executioner" accent="#ff005c" top={data.mostEliminations} valueKey="eliminationsCount" subtitle="MOST OPPONENTS ELIMINATED" description="Counts opponents this player reduced to zero points." nameStyle={nameStyleFor(data.mostEliminations?.[0]?.id)} />
          </div>
          </div>

          <MonthlyLeagueReports />
          <div data-testid="hall-skill">
          <SectionTitle icon={<Target className="w-4 h-4"/>} eyebrow="BEYOND THE TABLE" title="Skill, Practice & Tour" description="Records earned across practice, achievements and Tour Mode." accent="#a78bfa" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RecordCard icon={<Dumbbell className="w-4 h-4" />} label="Most Practice Sessions" accent="#a78bfa" top={data.mostSessions} valueKey="sessions" nameStyle={nameStyleFor(data.mostSessions?.[0]?.id)} />
            <RecordCard icon={<Target className="w-4 h-4" />} label="Most 180s" accent="#ff005c" top={data.most180s} valueKey="total180s" nameStyle={nameStyleFor(data.most180s?.[0]?.id)} />
            <RecordCard icon={<Award className="w-4 h-4" />} label="Most Tour Trophies" accent="#ffd24a" top={data.mostTourTrophies} valueKey="tourTrophies" nameStyle={nameStyleFor(data.mostTourTrophies?.[0]?.id)} />
            <RecordCard icon={<Medal className="w-4 h-4" />} label="Most Achievements" accent="#a855f7" top={data.mostAchievements} valueKey="achievements" nameStyle={nameStyleFor(data.mostAchievements?.[0]?.id)} />
          </div>
          </div>

          {[data.mostCricketWins, data.mostAtwWins, data.mostNineMarks, data.mostTrebleSkips].some(t => t?.length) && <div data-testid="hall-games">
          <SectionTitle icon={<Globe2 className="w-4 h-4"/>} eyebrow="AWAY FROM 501" title="Cricket & Around the World" description="Wins count from every result. Marks and skips come from games played on the TKDL scorer." accent="#22c55e" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!!data.mostCricketWins?.length && <RecordCard icon={<Target className="w-4 h-4" />} label="Cricket King" accent="#22c55e" top={data.mostCricketWins} valueKey="cricketWins" subtitle="MOST CRICKET WINS" nameStyle={nameStyleFor(data.mostCricketWins[0]?.id)} />}
            {!!data.mostNineMarks?.length && <RecordCard icon={<Zap className="w-4 h-4" />} label="Nine-Mark Club" accent="#22c55e" top={data.mostNineMarks} valueKey="nineMarkVisits" subtitle="MOST 9-MARK VISITS" description="Three trebles on cricket numbers in one visit." nameStyle={nameStyleFor(data.mostNineMarks[0]?.id)} />}
            {!!data.mostAtwWins?.length && <RecordCard icon={<Globe2 className="w-4 h-4" />} label="Globetrotter" accent="#19c3c8" top={data.mostAtwWins} valueKey="atwWins" subtitle="MOST AROUND THE WORLD WINS" nameStyle={nameStyleFor(data.mostAtwWins[0]?.id)} />}
            {!!data.mostTrebleSkips?.length && <RecordCard icon={<Flame className="w-4 h-4" />} label="Express Route" accent="#19c3c8" top={data.mostTrebleSkips} valueKey="trebleSkips" subtitle="MOST TREBLE SKIPS" description="Trebles that jumped three numbers in Around the World." nameStyle={nameStyleFor(data.mostTrebleSkips[0]?.id)} />}
          </div>
          </div>}

          {[data.mostBounties, data.bestCalloutRun].some(t => t?.length) && <div data-testid="hall-oche">
          <SectionTitle icon={<Swords className="w-4 h-4"/>} eyebrow="OFF THE OCHE" title="Call-outs & Bounties" description="Settled on the board: call-outs won in a row and bounties claimed." accent="#ff005c" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!!data.bestCalloutRun?.length && <RecordCard icon={<Swords className="w-4 h-4" />} label="Call-out King" accent="#ff5c93" top={data.bestCalloutRun} valueKey="calloutBest" subtitle="LONGEST CALL-OUT WINNING RUN" nameStyle={nameStyleFor(data.bestCalloutRun[0]?.id)} />}
            {!!data.mostBounties?.length && <RecordCard icon={<Crosshair className="w-4 h-4" />} label="Bounty Hunter" accent="#ffd24a" top={data.mostBounties} valueKey="bountiesClaimed" subtitle="MOST BOUNTIES CLAIMED" nameStyle={nameStyleFor(data.mostBounties[0]?.id)} />}
          </div>
          </div>}

          </>}

          {shame && <div data-testid="wall-shame">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RecordCard icon={<Percent className="w-4 h-4" />} label="Cold Finish" accent="#ff005c" top={data.lowestWinRate} valueKey="careerWinRate" suffix="%" medals={["🧊","😬","😅"]} rankColors={SHAME_COLORS} subtitle="LOWEST CAREER WIN RATE" description="Minimum 10 competitive matches, so new and occasional players are not unfairly ranked." context={p=>`${p.careerGamesPlayed} played`} />
            {data.mostTimesEliminated?.length > 0 && <RecordCard icon={<Skull className="w-4 h-4" />} label="Last One Standing... Elsewhere" accent="#ff005c" top={data.mostTimesEliminated} valueKey="timesEliminated" medals={["💀","🪦","😵"]} rankColors={SHAME_COLORS} subtitle="MOST TIMES ELIMINATED" description="Counts confirmed occasions this player was reduced to zero points. Tracking begins with this update." />}
            <RecordCard icon={<TrendingDown className="w-4 h-4" />} label="The Choke Award"    accent="#ff005c" top={data.longestLossStreak}  valueKey="longestLossStreak" medals={["🫠","😬","😅"]} rankColors={SHAME_COLORS} subtitle="LONGEST LOSING STREAK" />
            <RecordCard icon={<Skull className="w-4 h-4" />}       label="The Collapse"       accent="#ff005c" top={data.biggestPointsFall}  valueKey="careerBiggestPointsFall" suffix=" pts" medals={["💀","😬","😅"]} rankColors={SHAME_COLORS} subtitle="BIGGEST FALL FROM PEAK (ALL-TIME)" />
            {!!data.worstBullTrouble?.length && <RecordCard icon={<CircleDot className="w-4 h-4" />} label="Bull Trouble" accent="#ff005c" top={data.worstBullTrouble} valueKey="bullTrouble" suffix=" darts" medals={["🐂","😬","😅"]} rankColors={SHAME_COLORS} subtitle="MOST DARTS STUCK ON THE BULLS" description="Most darts thrown at the 25 and bullseye in one Around the World game." />}
            {!!data.mostAtwStalls?.length && <RecordCard icon={<Globe2 className="w-4 h-4" />} label="Going Nowhere" accent="#ff005c" top={data.mostAtwStalls} valueKey="atwStalls" medals={["🧭","😬","😅"]} rankColors={SHAME_COLORS} subtitle="AROUND THE WORLD VISITS WITHOUT MOVING" />}
            {!!data.mostCricketBlanks?.length && <RecordCard icon={<CircleSlash className="w-4 h-4" />} label="Bowled Out" accent="#ff005c" top={data.mostCricketBlanks} valueKey="cricketBlanks" medals={["🦆","😬","😅"]} rankColors={SHAME_COLORS} subtitle="CRICKET VISITS WITH NO MARKS" />}
            {!!data.mostDucked?.length && <RecordCard icon={<Swords className="w-4 h-4" />} label="Ducked It" accent="#ff005c" top={data.mostDucked} valueKey="calloutsDucked" medals={["🦆","😬","😅"]} rankColors={SHAME_COLORS} subtitle="MOST CALL-OUTS DECLINED" />}
            <RecordCard icon={<Banknote className="w-4 h-4" />}    label="Highway Robbery"    accent="#ff005c" top={data.biggestSingleLoss}  valueKey="biggestSingleLoss" suffix=" pts" medals={["💸","😬","😅"]} rankColors={SHAME_COLORS} subtitle="BIGGEST SINGLE-MATCH LOSS" />
          </div>
          </div>}
        </>
      )}
    </div>
  );
}
