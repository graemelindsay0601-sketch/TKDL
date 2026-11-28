import { useEffect, useState } from "react";
import { NearlyThere } from "@/components/achievements-v2/NearlyThere";
import { Swords, Lock, Trophy, Skull, Clock, Users, Shield, Ghost, LockKeyhole, Zap, Sparkles, CheckCircle2, Heart, Gauge } from "lucide-react";
import { useCurrentPlayer } from "@/context/auth";
import { BOSSES, WORLDS, PERKS, worldOf, type Boss, type PerkId } from "@/lib/boss-battles-data";
import { BossPortrait } from "@/components/boss/BossPortrait";
import { bossUnlocked, nemesisOf, unlockedPerks, REVENGE_COINS } from "@/lib/darts-rules";
import { Link } from "wouter";
import { BookOpen, Gift, Flame } from "lucide-react";
import { BOT_LEVELS, type ShadowProfile } from "@/lib/bot-engine";
import { possessedBossIndex } from "@/lib/darts-rules";
import { BossBattleScorer, type BossFightResult } from "@/components/BossBattleScorer";
import type { GameResult } from "@/components/game-scorer";
import { useCosmeticsCatalog, glowRowStyle } from "@/lib/cosmetics";
import { AchievementRewardModal, type AchievementRewardData } from "@/components/AchievementRewardModal";
import "./boss-battle.css";

type Screen =
  | { kind: "ladder" }
  | { kind: "entrance"; boss: Boss; ascension?: number }
  | { kind: "fight"; boss: Boss; rush?: boolean; ascension?: number; possessed?: boolean; perk?: PerkId | null }
  | { kind: "result"; boss: Boss; won: boolean; elapsedSeconds?: number; cleanSweep: boolean; ascension?: number; exorcised?: boolean | null; loot?: { name: string; category: string }; revenge?: { coins: number } }
  | { kind: "rush-break"; boss: Boss; nextBoss: Boss; lives: number; wins: number }
  | { kind: "rush-result"; cleared: boolean; wins: number; elapsedSeconds: number; lives: number };

type BossStats = { attempts: number; wins: number; bestSeconds: number | null; cleanSweep: boolean; highestAscension: number };

type RosterPlayer = { id: number; name: string; status: string; isActive: boolean };

type LeaderboardData = {
  totalBosses: number;
  players: { playerId: number; playerName: string; bossesDefeated: number; fullClear: boolean; lastDefeatAt: string }[];
  fastestPerBoss: Record<string, { playerName: string; seconds: number }>;
};
type ArcadeRun = { id:number; mode:string; bossId:string|null; outcome:string; elapsedSeconds:number|null; milestoneLabel:string|null; playedAt:string };

/** mm:ss for a fight duration — best times are always well under an hour. */
function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const MODE_LABEL: Record<string, string> = { X01: "501", CRICKET: "Cricket", ATW: "Round the board", HALVEIT: "Halve-It", KILLER: "Killer" };
const tierColor = (boss: Boss) => BOT_LEVELS[boss.botLevel]?.color ?? "#ff005c";
const tierVar = (boss: Boss) => ({ "--tier": tierColor(boss), "--world": worldOf(boss.world).colour, "--world-glow": worldOf(boss.world).glow }) as React.CSSProperties;

function masteryCount(boss: Boss, defeated: Set<string>, stats?: BossStats): number {
  return Number(defeated.has(boss.id))
    + Number(stats?.cleanSweep === true)
    + Number(stats?.bestSeconds !== null && stats?.bestSeconds !== undefined && stats.bestSeconds <= boss.masterySeconds);
}

export default function BossBattlePage() {
  // Playing Boss Battle has never needed an account — pick your name from
  // the roster and go, same as Master-501/Practice/Tour. useCurrentPlayer()
  // is only consulted to default the picker to your own name when you
  // happen to be logged in; logging in is for claiming/managing an account
  // (settings, notification prefs), never a requirement to play.
  const currentPlayer = useCurrentPlayer();
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [defeated, setDefeated] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Record<string, BossStats>>({});
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>({ kind: "ladder" });
  const [fightStartedAt, setFightStartedAt] = useState<number | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [history, setHistory] = useState<ArcadeRun[]>([]);
  const [saveState, setSaveState] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [rewardQueue, setRewardQueue] = useState<AchievementRewardData[]>([]);
  const [rush, setRush] = useState<{ index: number; lives: number; wins: number; startedAt: number } | null>(null);

  const playerName = players.find(p => p.id === playerId)?.name ?? "";

  // GLOW cosmetic for "your" row in the ladder — this page's own leaderboard
  // endpoint doesn't join equipped cosmetics per row (unlike the main
  // leaderboard), so rather than a backend change this fetches just the
  // currently-selected player's own GLOW, the same one row this ladder
  // already highlights via `p.playerId === playerId`.
  const cosmeticsCatalog = useCosmeticsCatalog();
  const [myGlowId, setMyGlowId] = useState<string | null>(null);
  // Possession: the latest Shadow Cup champion's shadow takes over one boss for the week.
  const [possession, setPossession] = useState<{ week: string; playerId: number; name: string; profile: any } | null>(null);
  // The Mirror throws your own darts, if your shadow is unlocked and has real dart-by-dart data.
  const [mirror, setMirror] = useState<ShadowProfile | undefined>(undefined);
  // The perk you take into fights (remembered on this device).
  const [perk, setPerkState] = useState<PerkId | null>(() => { try { return (localStorage.getItem("tkdl:boss-perk") as PerkId) || null; } catch { return null; } });
  const setPerk = (p: PerkId | null) => { setPerkState(p); try { p ? localStorage.setItem("tkdl:boss-perk", p) : localStorage.removeItem("tkdl:boss-perk"); } catch { /* private mode */ } };
  useEffect(() => {
    setMirror(undefined);
    if (!playerId) return;
    fetch(`/api/players/${playerId}/shadow-profile?era=current`).then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.locked && !d.thin) setMirror(toShadow(playerId, d.playerName ?? "you", d)); }).catch(() => {});
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetch("/api/shadow-possession").then(r => r.ok ? r.json() : null).then(setPossession).catch(() => setPossession(null)); }, []);
  useEffect(() => {
    if (!playerId) { setMyGlowId(null); return; }
    fetch(`/api/players/${playerId}/cosmetics`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => setMyGlowId(data?.equippedGlowId ?? null))
      .catch(() => {});
  }, [playerId]);
  const myGlowCosmetic = cosmeticsCatalog.find(c => c.id === myGlowId);
  const myGlow = glowRowStyle(myGlowCosmetic);

  useEffect(() => {
    fetch("/api/players")
      .then(r => r.json())
      .then((d: RosterPlayer[]) => {
        const active = d.filter(p => p.isActive !== false);
        setPlayers(active);
        setPlayerId(prev => prev ?? (currentPlayer ? active.find(p => p.id === currentPlayer.playerId)?.id : undefined) ?? active[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  const loadProgress = () => {
    if (!playerId) { setLoading(false); return; }
    fetch(`/api/boss-battles/progress/${playerId}`)
      .then(r => r.ok ? r.json() : { defeated: [], stats: {} })
      .then((d: { defeated: string[]; stats?: Record<string, BossStats> }) => {
        setDefeated(new Set(d.defeated));
        setStats(d.stats ?? {});
      })
      .catch(() => { setDefeated(new Set()); setStats({}); })
      .finally(() => setLoading(false));
  };

  useEffect(loadProgress, [playerId]);
  const loadHistory = () => {
    if (!playerId) { setHistory([]); return; }
    fetch(`/api/arcade/history/${playerId}?limit=8`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: ArcadeRun[]) => setHistory(rows.filter(row => row.mode === "boss_battle" || row.mode === "boss_rush")))
      .catch(() => setHistory([]));
  };
  useEffect(loadHistory, [playerId]);

  const toggleLeaderboard = () => {
    setShowLeaderboard(v => !v);
    if (!leaderboard && !leaderboardLoading) {
      setLeaderboardLoading(true);
      fetch("/api/boss-battles/leaderboard")
        .then(r => r.ok ? r.json() : null)
        .then(setLeaderboard)
        .catch(() => setLeaderboard(null))
        .finally(() => setLeaderboardLoading(false));
    }
  };

  const isUnlocked = (boss: Boss) => bossUnlocked(boss.id, defeated);


  const startFight = (boss: Boss, ascension = 0, possessed = false) => {
    setSaveState("idle");
    setFightStartedAt(Date.now());
    const usable = perk && PERKS.find(x => x.id === perk)?.modes.includes(boss.gameMode) && unlockedPerks(defeated).some(x => x.id === perk) ? perk : null;
    setScreen({ kind: "fight", boss, ascension, possessed, perk: usable });
  };

  const startRush = () => {
    const firstBoss = sortedBosses[0];
    if (!firstBoss || defeatedCount < sortedBosses.length) return;
    const nextRush = { index: 0, lives: 2, wins: 0, startedAt: Date.now() };
    setRush(nextRush);
    setSaveState("idle");
    setFightStartedAt(Date.now());
    setScreen({ kind: "fight", boss: firstBoss, rush: true });
  };

  const saveRush = async (cleared: boolean, wins: number, elapsedSeconds: number) => {
    if (!playerId) return;
    try {
      await fetch("/api/boss-battles/rush", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, cleared, wins, elapsedSeconds }),
      });
      loadHistory();
    } catch { /* the individual boss results are still safely recorded */ }
  };

  const handleMatchComplete = async (boss: Boss, result: BossFightResult, ascension = 0, possessed = false) => {
    const won = result.winnerIdx === 0;
    const elapsedSeconds = fightStartedAt ? Math.round((Date.now() - fightStartedAt) / 1000) : undefined;
    // Mastery medal 2: a 2-0 in 501 / Cricket, or a flawless win in the party-game fights.
    const cleanSweep = won && (/^2[–-]0 legs$/i.test(result.detail ?? "") || !!result.flawless);
    let rewards: { loot?: { name: string; category: string }; revenge?: { coins: number } } = {};
    if (playerId) {
      setSaveState("saving");
      try {
        const response = await fetch("/api/boss-battles/attempt", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, bossId: boss.id, won, elapsedSeconds, cleanSweep, ascension }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error ?? "Result could not be saved");
        setSaveState("saved");
        if (Array.isArray(data.achievements) && data.achievements.length) setRewardQueue(data.achievements);
        rewards = { loot: data.loot, revenge: data.revenge };
        // Refetch rather than patch locally — attempts/wins/best time are
        // server-computed (upserts, min() on best time), so re-reading is
        // the only way to stay exactly in sync with what was actually saved.
        loadProgress();
        loadHistory();
      } catch { setSaveState("error"); }
    }
    setFightStartedAt(null);
    if (rush) {
      const nextLives = won ? rush.lives : rush.lives - 1;
      const nextWins = rush.wins + (won ? 1 : 0);
      const nextIndex = won ? rush.index + 1 : rush.index;
      const totalElapsed = Math.max(1, Math.round((Date.now() - rush.startedAt) / 1000));
      if (nextIndex >= sortedBosses.length || nextLives <= 0) {
        const cleared = nextIndex >= sortedBosses.length;
        void saveRush(cleared, nextWins, totalElapsed);
        setRush(null);
        setScreen({ kind: "rush-result", cleared, wins: nextWins, elapsedSeconds: totalElapsed, lives: Math.max(0, nextLives) });
      } else {
        const nextBoss = sortedBosses[nextIndex];
        setRush({ ...rush, index: nextIndex, lives: nextLives, wins: nextWins });
        setScreen({ kind: "rush-break", boss, nextBoss, lives: nextLives, wins: nextWins });
      }
      return;
    }
    let exorcised: boolean | null = null;
    if (won && possessed && possession && boss.id === possessedId) {
      exorcised = await fetch("/api/shadow-possession/exorcise", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week: possession.week, boss: boss.name }) }).then(r => r.ok ? r.json() : null).then(j => !!j?.unlocked).catch(() => null);
    }
    setScreen({ kind: "result", boss, won, elapsedSeconds, cleanSweep, ascension, exorcised, ...rewards });
  };

  const sortedBosses = [...BOSSES].sort((a, b) => a.order - b.order);
  const defeatedCount = sortedBosses.filter(b => defeated.has(b.id)).length;
  // Picked from the bosses you've unlocked, so it's always one you can actually fight. Not your own shadow.
  const possessable = sortedBosses.filter(b => b.gameMode === "X01" && isUnlocked(b));
  const possessedId = possession && possession.playerId !== playerId && possessable.length
    ? possessable[possessedBossIndex(possession.week, possessable.length)].id : null;
  const toShadow = (id: number, name: string, p: any): ShadowProfile => ({ playerId: id, playerName: name, totalDarts: p.darts ?? p.totalDarts, primarySeg: p.primarySeg, treblePct: p.treblePct,
    singlePct: p.singlePct, checkoutSegs: p.checkoutSegs, doubleHitPct: p.doubleHitPct, computedAvg: p.computedAvg, scoringDist: p.scoringDist,
    doubleRates: p.doubleRates, pressureDoubleHitPct: p.pressureDoubleHitPct, thin: p.thin, eraLabel: p.eraLabel } as ShadowProfile);
  const possessedProfile = (): ShadowProfile | undefined => possession ? toShadow(possession.playerId, possession.name, possession.profile) : undefined;
  const masteryTotal = sortedBosses.reduce((sum, boss) => sum + masteryCount(boss, defeated, stats[boss.id]), 0);
  const nemesis = nemesisOf(stats, defeated);
  const nemesisBoss = nemesis ? BOSSES.find(b => b.id === nemesis.bossId) : null;
  const myPerks = unlockedPerks(defeated);

  if (loading) {
    return <div className="bb-shell" style={{ textAlign: "center", paddingTop: "4rem", color: "rgba(255,255,255,0.3)" }}>Loading…</div>;
  }

  if (screen.kind === "fight") {
    return (
      <BossBattleScorer
        boss={screen.boss}
        playerName={playerName}
        ascension={screen.ascension}
        possessedBy={screen.possessed && !screen.rush && screen.boss.id === possessedId ? possessedProfile() : undefined}
        mirrorOf={mirror}
        perk={screen.perk ?? null}
        onMatchComplete={(r) => handleMatchComplete(screen.boss, r, screen.ascension ?? 0, !!screen.possessed)}
        onAbandon={() => {
          if (rush) void saveRush(false, rush.wins, Math.max(1, Math.round((Date.now() - rush.startedAt) / 1000)));
          setRush(null);
          setScreen({ kind: "ladder" });
        }}
      />
    );
  }

  if (screen.kind === "rush-break") {
    return (
      <div className="bb-shell"><div className="bb-result bb-rush-result" style={{ "--glow": tierColor(screen.nextBoss) } as React.CSSProperties}>
        <div className="bb-result-glow" />
        <div className="bb-result-icon"><Gauge /></div>
        <div className="bb-vs-kicker">Boss Rush · {screen.wins}/{sortedBosses.length} cleared</div>
        <h1>{screen.nextBoss.name} awaits</h1>
        <p>{screen.lives} life{screen.lives === 1 ? "" : "s"} remaining. A loss spends one life and repeats this boss.</p>
        <div className="bb-rush-lives">{[0, 1].map(i => <Heart key={i} className={i < screen.lives ? "active" : ""} />)}</div>
        <div className="bb-vs-actions">
          <button className="bb-btn-ghost" onClick={() => { if (rush) void saveRush(false, screen.wins, Math.max(1, Math.round((Date.now() - rush.startedAt) / 1000))); setRush(null); setScreen({ kind: "ladder" }); }}>Retire run</button>
          <button className="bb-btn-primary" onClick={() => { setFightStartedAt(Date.now()); setScreen({ kind: "fight", boss: screen.nextBoss, rush: true }); }}>Next fight</button>
        </div>
      </div></div>
    );
  }

  if (screen.kind === "rush-result") {
    return (
      <div className="bb-shell"><div className="bb-result bb-rush-result" style={{ "--glow": screen.cleared ? "#ffd24a" : "#ff6b6b" } as React.CSSProperties}>
        <div className="bb-result-glow" />
        <div className="bb-result-icon">{screen.cleared ? <Trophy /> : <Skull />}</div>
        <div className="bb-vs-kicker">Boss Rush Complete</div>
        <h1>{screen.cleared ? "The gauntlet is conquered" : "The gauntlet fought back"}</h1>
        <p>{screen.wins}/{sortedBosses.length} bosses · {formatSeconds(screen.elapsedSeconds)} total · {screen.lives} lives left</p>
        <div className="bb-vs-actions">
          <button className="bb-btn-ghost" onClick={() => setScreen({ kind: "ladder" })}>Ladder</button>
          <button className="bb-btn-primary" onClick={startRush}>Rush again</button>
        </div>
      </div></div>
    );
  }

  if (screen.kind === "entrance") {
    const boss = screen.boss;
    const ascension = screen.ascension ?? 0;
    const bossMastery = masteryCount(boss, defeated, stats[boss.id]);
    return (
      <div className="bb-shell">
        <div className="bb-vs world" style={tierVar(boss)}>
          <div className="bb-vs-portrait"><BossPortrait spec={boss.portrait} size={150} mood="talk" id={`vs-${boss.id}`} /></div>
          <div className="bb-vs-kicker">{worldOf(boss.world).name} · {ascension ? `Ascension ${ascension}` : `Boss ${boss.order} of ${sortedBosses.length}`}</div>
          <h1>{boss.name}</h1>
          <div className="bb-vs-tagline">"{boss.tagline}"</div>
          {boss.id === possessedId && possession && (
            <div className="bb-possessed-note">
              <Ghost /> <span><b>Possessed by Shadow {possession.name}</b> this week. Take on the possessed version and it throws {possession.name}'s real darts ({Number(possession.profile.computedAvg).toFixed(0)} avg) instead of its own, still using its moves. Beat it for the Exorcist tag. The normal fight is still there.</span>
            </div>
          )}
          <div className="bb-vs-meta">
            <span>{boss.gameMode === "X01" ? "501, double out" : MODE_LABEL[boss.gameMode]}</span>
            <span><b>{BOT_LEVELS[boss.botLevel]?.label ?? boss.botLevel}</b> tier</span>
            <span>{boss.gameMode === "X01" || boss.gameMode === "CRICKET" ? "Best of 3" : "One game"}</span>
          </div>
          {defeated.has(boss.id) && <div className="bb-ascension-picker">
            {[0, 1, 2].map(level => {
              const allowed = level < 2 || bossMastery === 3;
              return <button key={level} disabled={!allowed} className={ascension === level ? "active" : ""} onClick={() => setScreen({ kind: "entrance", boss, ascension: level })}>{level === 0 ? "Standard" : `Ascension ${level}`}{level === 2 && !allowed ? " · 3 medals required" : ""}</button>;
            })}
          </div>}
          {nemesis?.bossId === boss.id && (
            <div className="bb-nemesis-note"><Flame /> <span><b>Your Nemesis.</b> It's beaten you {nemesis.losses} times. Beat it for a revenge bonus of {REVENGE_COINS} coins.</span></div>
          )}
          <div className="bb-perks">
            <div className="bb-perks-head"><span>Perk</span><small>{myPerks.length ? "Take one into the fight" : "Beat certain bosses to unlock perks"}</small></div>
            <div className="bb-perk-row">
              <button className={`bb-perk ${!perk ? "on" : ""}`} onClick={() => setPerk(null)}><b>None</b></button>
              {PERKS.map(pk => {
                const have = myPerks.some(m => m.id === pk.id), fits = pk.modes.includes(boss.gameMode);
                return (
                  <button key={pk.id} disabled={!have || !fits} className={`bb-perk ${perk === pk.id && have && fits ? "on" : ""} ${!have ? "locked" : ""}`} onClick={() => setPerk(pk.id)}>
                    <b>{have ? pk.name : "???"}</b>
                    <small>{!have ? `Beat ${BOSSES.find(b => b.id === pk.from)?.name}` : !fits ? "Not in this game" : pk.description}</small>
                  </button>
                );
              })}
            </div>
          </div>
          {boss.id === "the-mirror" && <div className="bb-vs-hp"><b>{mirror ? "It throws your darts:" : "It borrows an elite thrower's darts"}</b> {mirror ? `your own shadow, ${Number(mirror.computedAvg).toFixed(0)} avg, with your habits.` : "until your shadow is unlocked with enough dart-by-dart data. Then it throws like you."}</div>}
          <div className="bb-vs-hp">
            <b>Health bar fight.</b> {boss.gameMode === "X01" ? "Your scoring knocks its health down; a leg it wins heals it. A 100+ visit stuns its curse for your next visit, and a 180 breaks it for the rest of the phase."
              : boss.gameMode === "CRICKET" ? "Your marks knock its health down; a leg it wins heals it. 6 marks in a visit stuns its curse for your next visit, and 9 breaks it."
              : "Your progress knocks its health down. No curses here: it just throws better as it gets angry."} It changes tactics at ⅔ and ⅓ health.
          </div>
          <div className="bb-moves">
            {boss.moves.map((m, i) => (
              <div className="bb-move-card" key={m.name}>
                <span className="bb-move-tag">{i === 0 ? "Phase 1 · full health" : "Phase 2 · below ⅔"}</span>
                <div className="bb-move-name"><Sparkles />{m.name}</div>
                <div className="bb-move-desc">{m.description}</div>
              </div>
            ))}
            {boss.enrageMove && (
              <div className="bb-move-card enrage">
                <span className="bb-move-tag">Enraged · below ⅓</span>
                <div className="bb-move-name"><Zap />{boss.enrageMove.name}</div>
                <div className="bb-move-desc">{boss.enrageMove.description}</div>
              </div>
            )}
          </div>
          <p className="bb-vs-lore">{boss.lore}</p>
          <div className="bb-vs-footnote">For bragging rights only — no Elo impact.</div>
          <div className="bb-vs-actions">
            <button className="bb-btn-ghost" onClick={() => setScreen({ kind: "ladder" })}>Back</button>
            <button className="bb-btn-primary" onClick={() => startFight(boss, ascension)}><Swords className="inline w-3.5 h-3.5 mr-1.5" />{ascension ? `Fight Ascension ${ascension}` : "Fight"}</button>
          </div>
          {boss.id === possessedId && possession && (
            <button className="bb-btn-possessed" onClick={() => startFight(boss, ascension, true)}><Ghost className="inline w-4 h-4 mr-1.5" />Fight the possessed version</button>
          )}
        </div>
      </div>
    );
  }

  if (screen.kind === "result") {
    const { boss, won, elapsedSeconds, cleanSweep, ascension = 0 } = screen;
    const next = BOSSES.find(b => b.order === boss.order + 1);
    const glow = won ? "#ffd24a" : "#ff6b6b";
    return (
      <>
      <div className="bb-shell">
        <div className="bb-result" style={{ "--glow": glow } as React.CSSProperties}>
          <div className="bb-result-glow" />
          <div className="bb-result-portrait"><BossPortrait spec={boss.portrait} size={120} mood={won ? "beaten" : "talk"} id={`res-${boss.id}`} /></div>
          <div className="bb-result-line">"{won ? boss.lines.defeated : boss.lines.victory}"</div>
          {won ? (
            <>
              <h1>{boss.name} {ascension ? `Ascension ${ascension} cleared!` : "defeated!"}</h1>
              <p>{ascension ? `Your highest cleared tier for this boss is now recorded.` : next ? `${next.name} is now unlocked.` : "That's the whole ladder beaten. Nice work."}</p>
              <div className="bb-mastery-result">
                <span className="earned"><CheckCircle2 /> Clear</span>
                <span className={cleanSweep ? "earned" : ""}><Sparkles /> {boss.gameMode === "X01" || boss.gameMode === "CRICKET" ? "2–0 sweep" : "Flawless"}</span>
                <span className={elapsedSeconds !== undefined && elapsedSeconds <= boss.masterySeconds ? "earned" : ""}><Clock /> Under {formatSeconds(boss.masterySeconds)}</span>
              </div>
              {screen.loot && (
                <div className="bb-loot-card"><Gift /> <div><small>Loot · exclusive</small><strong>{screen.loot.name}</strong><span>{screen.loot.category === "LEADERBOARD_TAG" ? "Leaderboard tag" : screen.loot.category === "FRAME" ? "Profile frame" : screen.loot.category === "NAME_STYLE" ? "Name style" : "Profile banner"} · equip it in your Locker</span></div></div>
              )}
              {screen.revenge && <div className="bb-nemesis-note"><Flame /> <span><b>Revenge!</b> You beat your Nemesis. +{screen.revenge.coins} coins.</span></div>}
              {screen.exorcised != null && possession && (
                <div className="bb-possessed-note"><Ghost /> <span><b>Shadow {possession.name} driven out.</b>{screen.exorcised ? " Unlocked: the Exorcist tag." : " You already have the Exorcist tag."}</span></div>
              )}
              {next && !ascension && (
                <div className="bb-unlock-card">
                  <CheckCircle2 size={22} />
                  <div><small>Next Up</small><strong>{next.name}</strong></div>
                </div>
              )}
            </>
          ) : (
            <>
              <h1>{boss.name} won this one.</h1>
              <p>Have another go whenever you're ready.</p>
            </>
          )}
          <div className={`bb-save-state ${saveState}`}>
            {saveState === "saving" ? "Saving arcade result…" : saveState === "saved" ? "Result saved · records and rewards updated" : saveState === "error" ? "Result shown, but it could not be saved" : "Arcade result"}
          </div>
          {playerId && <div style={{ margin: "14px 0", textAlign: "left" }}><NearlyThere players={[{ id: playerId }]} areas={["MODES"]} /></div>}
          <div className="bb-vs-actions">
            <button className="bb-btn-ghost" onClick={() => setScreen({ kind: "ladder" })}>Ladder</button>
            <button className="bb-btn-primary" onClick={() => setScreen({ kind: "entrance", boss, ascension })}>Run it back</button>
          </div>
        </div>
      </div>
      <AchievementRewardModal achievement={rewardQueue[0] ?? null} isOpen={rewardQueue.length > 0} onClose={() => setRewardQueue(queue => queue.slice(1))} />
      </>
    );
  }

  return (
    <div className="bb-shell">
      <div className="bb-hero">
        <div className="bb-hero-copy">
          <div className="bb-kicker"><i />TKDL Arcade · Campaign Protocol</div>
          <h1>Boss <span>Battle</span></h1>
          <p>Twenty bosses across four worlds: the Pub, the Shop Floor, the Arena and the Void. Knock their health down, survive their tactics, and reach The Reckoning.</p>
          <div className="bb-hero-actions">
            <button className={`bb-pill-btn ${showLeaderboard ? "active" : ""}`} onClick={toggleLeaderboard}>
              <Users className="w-3.5 h-3.5" /> Hall of Challengers
            </button>
            <Link href="/boss-battle/bestiary" className="bb-pill-btn"><BookOpen className="w-3.5 h-3.5" /> Bestiary</Link>
            {nemesisBoss && <span className="bb-pill-btn nemesis"><Flame className="w-3.5 h-3.5" /> Nemesis: {nemesisBoss.name}</span>}
            {defeatedCount === sortedBosses.length && <button className="bb-pill-btn rush" onClick={startRush}><Gauge className="w-3.5 h-3.5" /> Boss Rush</button>}
          </div>
        </div>
        <div className="bb-command-card">
          <div className="bb-command-label"><span>Campaign Status</span><Shield /></div>
          <strong>{defeatedCount === sortedBosses.length ? "LADDER CLEARED" : `${sortedBosses.length - defeatedCount} BOSS${sortedBosses.length - defeatedCount === 1 ? "" : "ES"} REMAIN`}</strong>
          <small>{playerId ? "Progress is saved against your selected player" : "Select a player to enter the arena"}</small>
          <div className="bb-progress-wrap">
            <div className="bb-progress-head"><span>Clearance</span><strong>{defeatedCount}/{sortedBosses.length}</strong></div>
            <div className="bb-progress-track"><div className="bb-progress-fill" style={{ width: `${(defeatedCount / sortedBosses.length) * 100}%` }} /></div>
          </div>
          <div className="bb-command-cells">
            <span><b>{defeatedCount}</b> Defeated</span>
            <span><b>{sortedBosses.filter(isUnlocked).length}</b> Unlocked</span>
            <span><b>{masteryTotal}/{sortedBosses.length * 3}</b> Mastery</span>
          </div>
        </div>
      </div>

      <div className="bb-arena-grid">
        <aside className="bb-control-rail">
          <div className="bb-panel-heading"><span>Challenger Check-In</span><small>01</small></div>
          {/* Player selector — no login needed, pick your name like Master-501/Practice/Tour */}
          <div className="bb-field">
            <span className="bb-field-label">Player</span>
            <select value={playerId ?? ""} onChange={e => setPlayerId(Number(e.target.value) || null)} className="bb-select">
              <option value="">Select player…</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="bb-briefing">
            <span><Zap /> Arcade Rules</span>
            <p>Boss abilities change the match as you play. Wins unlock the next fight; losses never affect league Elo.</p>
          </div>
          {defeatedCount === sortedBosses.length && <div className="bb-rush-card"><span><Gauge /> Boss Rush Unlocked</span><p>Beat all twenty in one run. You have two lives; a loss repeats the current boss.</p><button onClick={startRush}>Enter the gauntlet</button></div>}
          {history.length > 0 && <div className="bb-history"><div className="bb-lb-title">Recent Battles</div>{history.slice(0,4).map(run => <div className="bb-history-row" key={run.id}><i className={run.outcome}/><span>{run.mode === "boss_rush" ? "Boss Rush" : run.bossId?.replaceAll("-", " ")}</span><b>{run.outcome === "win" ? "W" : "L"}</b></div>)}</div>}

      {showLeaderboard && (
        <div className="bb-leaderboard-panel">
          {leaderboardLoading ? (
            <div className="bb-empty">Loading…</div>
          ) : !leaderboard || leaderboard.players.length === 0 ? (
            <div className="bb-empty">No one's beaten a boss yet — could be you.</div>
          ) : (
            <>
              <div className="bb-lb-title">Ladder Progress</div>
              {leaderboard.players.map((p, i) => {
                const isMe = p.playerId === playerId;
                // A purchased GLOW cosmetic overrides the default gold "it's
                // you" highlight with your own colour, same override
                // convention as the main leaderboard's SeasonRow/CareerRow.
                const glowColor = isMe ? myGlowCosmetic?.color ?? null : null;
                const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
                const pct = Math.round((p.bossesDefeated / leaderboard.totalBosses) * 100);
                return (
                  <div key={p.playerId} className="bb-lb-row" style={isMe ? myGlow : undefined}>
                    <span className={`bb-lb-rank ${rankClass}`}>{i + 1}</span>
                    <span className={`bb-lb-name ${isMe ? "me" : ""}`} style={isMe && glowColor ? { color: glowColor } : undefined}>
                      {p.playerName}
                      {p.fullClear && <Trophy className="w-3 h-3" style={{ color: "#ffd24a", flexShrink: 0 }} />}
                    </span>
                    <span className="bb-lb-progress"><i style={{ width: `${pct}%` }} /></span>
                    <span className="bb-lb-frac">{p.bossesDefeated}/{leaderboard.totalBosses}</span>
                  </div>
                );
              })}
              {Object.keys(leaderboard.fastestPerBoss).length > 0 && (
                <>
                  <div className="bb-lb-title" style={{ marginTop: "16px" }}>Fastest Clears</div>
                  {BOSSES.filter(b => leaderboard.fastestPerBoss[b.id]).sort((a, b) => a.order - b.order).map(b => (
                    <div key={b.id} className="bb-lb-fastest-row">
                      <span>{b.name}</span>
                      <span><Clock />{leaderboard.fastestPerBoss[b.id].playerName} · {formatSeconds(leaderboard.fastestPerBoss[b.id].seconds)}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
        </aside>

        <section className="bb-campaign-panel">
          <div className="bb-panel-heading"><span>Campaign Ladder</span><small>Choose Your Fight</small></div>
          <div className="bb-ladder">
        {WORLDS.map(w => {
          const inWorld = sortedBosses.filter(b => b.world === w.id);
          const beaten = inWorld.filter(b => defeated.has(b.id)).length;
          const open = inWorld.some(isUnlocked);
          return (
          <div key={w.id} className={`bb-world ${open ? "" : "locked"}`} style={{ "--world": w.colour, "--world-glow": w.glow } as React.CSSProperties}>
            <div className="bb-world-head">
              <div><small>World {WORLDS.indexOf(w) + 1}</small><h3>{w.name}</h3><p>{open ? w.blurb : "Beat the last boss of the world before to get in."}</p></div>
              <span className="bb-world-count">{beaten}/{inWorld.length}</span>
            </div>
        {inWorld.map(boss => {
          const unlocked = isUnlocked(boss);
          const won = defeated.has(boss.id);
          const bossStats = stats[boss.id];
          const mastery = masteryCount(boss, defeated, bossStats);
          const isFinal = boss.order === sortedBosses.length;
          return (
            <button
              key={boss.id}
              disabled={!unlocked || !playerId}
              onClick={() => setScreen({ kind: "entrance", boss })}
              className="bb-boss-row"
              style={tierVar(boss)}
            >
              <span className={`bb-node ${won ? "won" : ""}`} />
              <div className={`bb-boss-card ${won ? "won" : ""} ${!unlocked ? "locked" : ""} ${isFinal ? "final" : ""} ${boss.id === possessedId ? "possessed" : ""}`}>
                <div className="bb-boss-icon portrait">{!unlocked ? <Lock size={16} style={{ color: "rgba(255,255,255,0.3)" }} /> : <BossPortrait spec={boss.portrait} size={46} mood={won ? "idle" : "talk"} id={`lad-${boss.id}`} />}</div>
                <div className="bb-boss-body">
                  <div className="bb-boss-name">{boss.name}</div>
                  <div className="bb-boss-tag">{unlocked ? boss.tagline : "Beat the previous boss to unlock"}</div>
                  {nemesis?.bossId === boss.id && <div className="bb-nemesis-tag"><Flame size={11} /> Your Nemesis · beaten you {nemesis.losses}×</div>}
                  {boss.id === possessedId && possession && <div className="bb-possessed-tag"><Ghost size={11} /> Possessed by Shadow {possession.name} this week</div>}
                  {unlocked && bossStats && bossStats.attempts > 0 && (
                    <div className="bb-boss-stats">
                      {won && <CheckCircle2 size={11} style={{ color: "#ffd24a" }} />}
                      <span>{bossStats.attempts} attempt{bossStats.attempts === 1 ? "" : "s"}{bossStats.bestSeconds !== null && <> · best {formatSeconds(bossStats.bestSeconds)}</>}</span>
                    </div>
                  )}
                  {unlocked && (
                    <div className="bb-mastery-stars" aria-label={`${mastery} of 3 mastery medals`}>
                      {[0, 1, 2].map(star => <Sparkles key={star} className={star < mastery ? "earned" : ""} />)}
                      <span>{mastery}/3 mastery</span>
                    </div>
                  )}
                  {bossStats?.highestAscension > 0 && <div className="bb-ascension-cleared">Ascension {bossStats.highestAscension} cleared</div>}
                </div>
                <div className="bb-boss-side">
                  <span className="bb-tier-chip">{BOT_LEVELS[boss.botLevel]?.label ?? boss.botLevel}</span>
                  <span className="bb-mode-chip">{MODE_LABEL[boss.gameMode]}</span>
                </div>
              </div>
            </button>
          );
        })}
          </div>
          );
        })}
          </div>
        </section>
      </div>
    </div>
  );
}
