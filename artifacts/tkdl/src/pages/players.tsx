import {
  useListPlayers,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Skull, Flame, Search } from "lucide-react";
import { useState } from "react";
import { Glow, DartboardBackdrop, Chapter } from "@/components/premium/Premium";
import { TierBadge, TIER_COLORS as TIER_ELO_COLOR } from "@/components/tier-badge";

const RANK_COLORS: Record<number, string> = {
  0: "#ffd24a", 1: "#ff008c", 2: "#00aaff", 3: "#ff5050", 4: "#00ffaa",
};

const RARITY_COLOR: Record<string, string> = {
  Common: "#9ca3af", Rare: "#3b82f6", Epic: "#a855f7", Legendary: "#ffd24a",
};

const TIER_BAND: Record<string, { min: number; max: number }> = {
  Bronze: { min: 800, max: 950 }, Silver: { min: 950, max: 1100 },
  Gold: { min: 1100, max: 1250 }, Platinum: { min: 1250, max: 1400 },
  Diamond: { min: 1400, max: 1600 },
};

function PlayerCard({ player, leaderboardRank }: { player: any; leaderboardRank?: number }) {
  const isElim = player.status === "ELIMINATED";
  const pts    = isElim ? 0 : (player.points ?? 25);
  const streak = player.currentWinStreak ?? 0;
  const rank   = leaderboardRank ?? 99;

  const rankCls = isElim ? "pc-eliminated"
    : rank === 0 ? "pc-rank-1"
    : rank === 1 ? "pc-rank-2"
    : rank === 2 ? "pc-rank-3"
    : rank === 3 ? "pc-rank-4"
    : rank === 4 ? "pc-rank-5"
    : "";

  const accentColor = isElim ? "#ff005c" : (RANK_COLORS[rank] ?? "rgba(255,255,255,0.55)");
  const nameRepeat  = `${player.name.toUpperCase()}  ·  `.repeat(8);

  const tierCol = TIER_ELO_COLOR[player.tier ?? "Bronze"] ?? "#9ca3af";
  const band = TIER_BAND[player.tier ?? "Bronze"] ?? { min: 800, max: 1000 };
  const pct  = Math.min(100, Math.max(0, ((player.elo - band.min) / (band.max - band.min)) * 100));
  const form = Array.isArray(player.recentForm) ? (player.recentForm as string[]).slice(0, 5) : [];
  const medal = ["linear-gradient(180deg,#ffe58a,#d99a00)", "linear-gradient(180deg,#ffffff,#9aa6bd)", "linear-gradient(180deg,#f0b27a,#9c5a2a)"][rank];
  void rankCls;

  return (
    <Link href={`/players/${player.id}`}>
      <div className="pm-card relative overflow-hidden cursor-pointer transition-transform hover:-translate-y-0.5"
        style={{ ["--pm-acc" as any]: isElim ? "#ff005c" : rank < 3 ? accentColor : tierCol, padding: 16, opacity: isElim ? 0.85 : 1 }}>
        <Glow x="90%" y="0%" color={isElim ? "#ff005c" : rank < 3 ? accentColor : tierCol} size={260} opacity={0.22} />
        <DartboardBackdrop size={240} opacity={0.05} style={{ right: -90, top: -70 }} />
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" style={{ zIndex: 0 }}>
          <div style={{ position: "absolute", top: "40%", whiteSpace: "nowrap", fontFamily: "Oswald, sans-serif", fontSize: "3rem", fontWeight: 900,
            color: accentColor, letterSpacing: "0.08em", opacity: 0.045, lineHeight: 1, animation: "player-name-scroll 18s linear infinite", willChange: "transform" }}>
            {nameRepeat}
          </div>
        </div>

        <div className="relative" style={{ zIndex: 2 }}>
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-full p-[2.5px]" style={{ background: isElim ? "linear-gradient(135deg,#ff005c,#4a0018)" : `conic-gradient(from 200deg, ${tierCol}, #fff8, ${tierCol}, #0000 70%, ${tierCol})`, boxShadow: `0 0 16px ${isElim ? "#ff005c55" : tierCol + "55"}` }}>
              <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "radial-gradient(circle at 35% 30%, #2a2540, #0d0b14)" }}>
                {player.avatarUpdatedAt
                  ? <img src={`/api/players/${player.id}/avatar-image?v=${encodeURIComponent(player.avatarUpdatedAt)}`} alt="" className="w-full h-full object-cover" loading="lazy" />
                  : <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 24, color: "#fff" }}>{isElim ? "☠" : player.name.charAt(0).toUpperCase()}</span>}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className={`uppercase leading-tight truncate ${isElim ? "" : "pm-chrome"}`}
                style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.45rem", letterSpacing: "0.03em", color: isElim ? "#ff7a9c" : undefined }}>
                {player.name}
              </div>
              {player.nickname && <div className="text-xs truncate" style={{ color: "#a9a4bd", fontStyle: "italic" }}>"{player.nickname}"</div>}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {player.activeTitleLabel && (
                  <span className="pm-chip" style={{ fontSize: 9.5, color: RARITY_COLOR[player.activeTitleRarity] ?? "#9ca3af", borderColor: `${RARITY_COLOR[player.activeTitleRarity] ?? "#9ca3af"}66` }}>
                    {player.activeTitleIcon} {player.activeTitleLabel}
                  </span>
                )}
                {streak >= 3 && !isElim && (
                  <span className="pm-chip" style={{ fontSize: 9.5, color: "#ff9ab8", borderColor: "rgba(255,0,92,.5)" }}><Flame className="w-3 h-3 streak-fire" />{streak}W</span>
                )}
                {isElim && <span className="pm-chip" style={{ fontSize: 9.5, color: "#ff9ab8", borderColor: "rgba(255,0,92,.5)" }}><Skull className="w-3 h-3" />Eliminated</span>}
              </div>
            </div>
            {!isElim && rank < 99 && (
              <div className="shrink-0 flex items-center justify-center rounded-full self-start"
                style={{ width: 38, height: 38, background: medal ?? "linear-gradient(180deg,#3a3550,#1d1a2b)", color: medal ? "#141018" : "#e4e0f0",
                  fontFamily: "Oswald, sans-serif", fontSize: 14, boxShadow: medal ? `0 0 14px ${accentColor}77` : "inset 0 1px 0 rgba(255,255,255,.1)" }}>
                #{rank + 1}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { l: "Points", v: isElim ? "—" : pts, c: rank === 0 && !isElim ? "#ffd24a" : "#ff7aa6" },
              { l: "ELO", v: player.elo, c: "#9cc6ff" },
              { l: "Season", v: <><span style={{ color: "#4ade80" }}>{player.seasonWins ?? 0}</span><span style={{ color: "#6b6680" }}>–</span><span style={{ color: "#ff7a9c" }}>{player.seasonLosses ?? 0}</span></>, c: "#fff" },
            ].map(t => (
              <div key={t.l} className="rounded-xl px-2 py-2 text-center" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.015))", border: "1px solid rgba(255,255,255,.09)" }}>
                <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22, color: t.c, textShadow: `0 0 12px ${t.c}55` }}>{t.v}</div>
                <div className="pm-lab mt-1" style={{ fontSize: 8.5 }}>{t.l}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-3 gap-3">
            <TierBadge tier={player.tier} />
            {form.length > 0 && (
              <div className="flex items-center gap-1">
                {form.map((r, i) => (
                  <span key={i} className="flex items-center justify-center rounded-md" style={{ width: 20, height: 20, fontFamily: "Oswald, sans-serif", fontSize: 10.5, fontWeight: 700,
                    color: "#fff", background: r === "W" ? "linear-gradient(180deg,#34d27b,#118a49)" : "linear-gradient(180deg,#ff4d86,#a3003b)",
                    boxShadow: r === "W" ? "0 0 8px rgba(52,210,123,.4)" : "0 0 8px rgba(255,0,92,.35)" }}>{r}</span>
                ))}
              </div>
            )}
          </div>

          {!isElim && (
            <div className="mt-3">
              <div className="flex justify-between mb-1">
                <span className="pm-lab" style={{ fontSize: 8.5 }}>{player.tier ?? "Bronze"} band</span>
                <span className="pm-lab" style={{ fontSize: 8.5, color: "#9cc6ff" }}>{band.min}–{band.max}</span>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${tierCol}88, ${tierCol})`, boxShadow: `0 0 10px ${tierCol}`, borderRadius: 3, transition: "width 0.5s ease" }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Players() {
  const { data: players, isLoading, isError, refetch } = useListPlayers();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"points" | "elo" | "streak" | "name">("points");

  const q = search.trim().toLowerCase();
  const matchesSearch = (p: any) =>
    q === "" || p.name.toLowerCase().includes(q) || (p.nickname ?? "").toLowerCase().includes(q);
  const searched = players?.filter(matchesSearch) ?? [];

  const active     = searched.filter(p => p.isActive && p.status !== "ELIMINATED");
  const eliminated = searched.filter(p => p.isActive && p.status === "ELIMINATED");
  const inactive   = searched.filter(p => !p.isActive);

  // Rank badges (#1, #2, ...) are always by points — that's the league
  // standing. sortBy only changes the order the cards are laid out in. This
  // dropped the Elo tiebreak that every backend rank calculation uses
  // (lib/leaderboardRank.ts's rankPlayersByPoints — season leaderboard,
  // rank-change notifications, position-change diffs), so two players tied
  // on points could show a different relative badge here than anywhere
  // else in the app, purely based on whatever order the fetch happened to
  // return them in. Matching that same points-desc/elo-desc tiebreak here
  // keeps this page's numbers consistent with the rest of the app.
  const rankMap = new Map(
    [...active]
      .sort((a, b) => (b.points ?? 25) - (a.points ?? 25) || (b.elo ?? 1000) - (a.elo ?? 1000))
      .map((p, i) => [p.id, i])
  );
  const SORTERS: Record<typeof sortBy, (a: any, b: any) => number> = {
    points: (a, b) => (b.points ?? 25) - (a.points ?? 25),
    elo:    (a, b) => (b.elo ?? 1000) - (a.elo ?? 1000),
    streak: (a, b) => (b.currentWinStreak ?? 0) - (a.currentWinStreak ?? 0),
    name:   (a, b) => a.name.localeCompare(b.name),
  };
  const activeSorted = [...active].sort(SORTERS[sortBy]);

  return (
    <div className="space-y-6 pm-page">
      <div className="relative overflow-hidden" style={{ borderRadius: 24, border: "1px solid rgba(255,0,92,.3)", background: "linear-gradient(160deg, rgba(255,0,92,.16) 0%, #14102a 45%, #06060b 100%)", boxShadow: "0 20px 50px rgba(0,0,0,.55)" }}>
        <Glow x="85%" y="10%" color="#ff005c" size={420} opacity={0.24} />
        <Glow x="8%" y="90%" color="#a855f7" size={400} opacity={0.24} />
        <DartboardBackdrop size={460} opacity={0.07} style={{ right: -170, top: -100, transform: "rotate(8deg)" }} />
        <div className="relative p-5" style={{ zIndex: 1 }}>
          <span className="pm-lab" style={{ color: "#ff7aa6" }}>The league</span>
          <h1 className="pm-title uppercase" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "clamp(2.2rem, 10vw, 3.4rem)", letterSpacing: "0.03em", lineHeight: 0.98, marginTop: 6 }}>
            Player Registry
          </h1>
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="pm-chip">{active.length} active</span>
            {eliminated.length > 0 && <span className="pm-chip" style={{ color: "#ff9ab8", borderColor: "rgba(255,0,92,.45)" }}>☠ {eliminated.length} eliminated</span>}
            {inactive.length > 0 && <span className="pm-chip" style={{ color: "#a9a4bd" }}>{inactive.length} inactive</span>}
          </div>
        </div>
      </div>

      {!isLoading && (players?.length ?? 0) > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.25)" }} />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search players…"
              className="pl-9 rounded-full h-11"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02))", border: "1px solid rgba(255,255,255,0.14)" }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs uppercase tracking-widest mr-1" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Sort</span>
            {([
              ["points", "Points"],
              ["elo", "ELO"],
              ["streak", "Streak"],
              ["name", "A–Z"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className="px-3.5 rounded-full text-xs uppercase tracking-wider transition-all"
                style={{
                  fontFamily: "Oswald, sans-serif", minHeight: 34,
                  background: sortBy === key ? "linear-gradient(180deg, #ffe58a, #e0a800)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${sortBy === key ? "#ffd24a" : "rgba(255,255,255,0.12)"}`,
                  color: sortBy === key ? "#1a1200" : "#cfcade",
                  boxShadow: sortBy === key ? "0 0 14px rgba(255,210,74,.4)" : undefined,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
        </div>
      ) : isError ? (
        // Previously a failed fetch left `players` undefined with no error
        // flag checked, so this fell into the same empty-grid render as a
        // genuinely empty roster — "0 active" with no indication anything
        // had gone wrong.
        <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.3)" }}>
          Couldn't load players.
          <button onClick={() => refetch()} className="block mx-auto mt-3 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
            style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.3)", color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
            Retry
          </button>
        </div>
      ) : searched.length === 0 && q !== "" ? (
        <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.3)" }}>
          No players match "{search}".
        </div>
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeSorted.map((player, i) => (
              <div key={player.id} className="fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                <PlayerCard player={player} leaderboardRank={rankMap.get(player.id)} />
              </div>
            ))}
          </div>

          {eliminated.length > 0 && (
            <div>
              <Chapter title="Eliminated" accent="#ff005c" aside={<span className="pm-chip" style={{ color: "#ff9ab8" }}>{eliminated.length}</span>} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {eliminated.map((player, i) => (
                  <div key={player.id} className="fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                    <PlayerCard player={player} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <Chapter title="Inactive / departed" accent="#8a84a3" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {inactive.map(player => (
                  <Link key={player.id} href={`/players/${player.id}`}>
                    <div className="pm-card p-3 cursor-pointer opacity-60 hover:opacity-90 transition-opacity" style={{ ["--pm-acc" as any]: "#8a84a3" }}>
                      <div className="text-sm uppercase truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#d8d4e6", letterSpacing: "0.04em" }}>{player.name}</div>
                      <div className="pm-lab mt-0.5" style={{ fontSize: 8.5 }}>Inactive</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
