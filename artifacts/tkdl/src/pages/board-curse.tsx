import { useEffect, useState } from "react";
import { Flame, Swords, User, Users, Bot, Trophy, Skull, Crown, Square, Infinity as InfinityIcon, BookOpen } from "lucide-react";
import { useCurrentPlayer } from "@/context/auth";
import { LoginGate } from "@/components/LoginGate";
import { useListPlayers } from "@workspace/api-client-react";
import { BoardCurseScorer, type BoardCurseResult } from "@/components/BoardCurseScorer";
import { BOT_LEVELS, type BotLevel } from "@/lib/bot-engine";
import { getCurseCompendium, type CurseGameMode, type CurseTier } from "@/lib/board-curse-data";

type RosterPlayer = { id: number; name: string; status: string; isActive: boolean };
const GUEST_OPTION = "__guest__";

type Format = "solo" | "bot" | "local";
type MatchLegs = 1 | 3 | 5;

type Screen =
  | { kind: "setup" }
  | { kind: "fight"; gameMode: CurseGameMode; format: Format; p1Name: string; p2Name: string; botLevel?: BotLevel; legs: MatchLegs; endless: boolean }
  | { kind: "result"; gameMode: CurseGameMode; format: Format; p1Name: string; p2Name: string; result: BoardCurseResult }
  | { kind: "endless-result"; streak: number; bestStreak: number | null }
  | { kind: "leaderboard"; gameMode: CurseGameMode }
  | { kind: "compendium"; gameMode: CurseGameMode };

const TIER_LABEL: Record<CurseTier, string> = { 1: "Mild — early visits", 2: "Medium — mid-leg", 3: "Severe — late leg" };

type Record_ = { wins: number; losses: number };
type LeaderboardEntry = { playerName: string; value: number };

export default function BoardCursePage() {
  const currentPlayer = useCurrentPlayer();
  const [screen, setScreen] = useState<Screen>({ kind: "setup" });
  const [gameMode, setGameMode] = useState<CurseGameMode>("X01");
  const [format, setFormat] = useState<Format>("solo");
  const [botLevel, setBotLevel] = useState<BotLevel>("club");
  // "vs Local Player" used to be a free-text name field, disconnected from
  // the app's real player list — this pulls the actual roster instead
  // (same "casual mode only excludes INACTIVE players" rule used elsewhere,
  // e.g. play.tsx's Team Game fix), with a Guest fallback for someone not
  // in the app at all.
  const { data: playersData } = useListPlayers();
  const opponents = ((playersData as RosterPlayer[] | undefined) ?? [])
    .filter(p => p.isActive !== false && p.id !== currentPlayer?.playerId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const [opponentSelection, setOpponentSelection] = useState<string>("");
  const [guestName, setGuestName] = useState("");
  const opponentName = opponentSelection === GUEST_OPTION
    ? (guestName.trim() || "Guest")
    : (opponents.find(p => String(p.id) === opponentSelection)?.name ?? "Player 2");
  const canStart = format !== "local" || (
    opponentSelection !== "" && (opponentSelection !== GUEST_OPTION || guestName.trim() !== "")
  );
  const [matchLegs, setMatchLegs] = useState<MatchLegs>(3);
  const [endlessMode, setEndlessMode] = useState(false);
  const [bestVisits, setBestVisits] = useState<number | null>(null);
  const [bestStreak, setBestStreak] = useState<number | null>(null);
  const [record, setRecord] = useState<Record_ | null>(null);
  const [endlessStreak, setEndlessStreak] = useState(0);
  const [endlessKey, setEndlessKey] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ bestVisits: LeaderboardEntry[]; bestStreak: LeaderboardEntry[] } | null>(null);

  const loadBest = (mode: CurseGameMode) => {
    if (!currentPlayer?.playerId) return;
    fetch(`/api/board-curse/best/${currentPlayer.playerId}/${mode}`)
      .then(r => r.ok ? r.json() : { bestVisits: null, bestStreak: null })
      .then((d: { bestVisits: number | null; bestStreak: number | null }) => { setBestVisits(d.bestVisits); setBestStreak(d.bestStreak); })
      .catch(() => { setBestVisits(null); setBestStreak(null); });
  };

  const loadRecord = (fmt: "bot" | "local") => {
    if (!currentPlayer?.playerId) return;
    fetch(`/api/board-curse/record/${currentPlayer.playerId}/${fmt}`)
      .then(r => r.ok ? r.json() : { wins: 0, losses: 0 })
      .then((d: Record_) => setRecord(d))
      .catch(() => setRecord(null));
  };

  useEffect(() => { loadBest(gameMode); }, [gameMode, currentPlayer?.playerId]);
  useEffect(() => {
    if (format === "bot" || format === "local") loadRecord(format);
    else setRecord(null);
  }, [format, currentPlayer?.playerId]);

  useEffect(() => {
    if (format !== "solo") setEndlessMode(false);
  }, [format]);

  if (!currentPlayer) {
    return (
      <LoginGate
        icon="👻"
        title="Play Board Curse"
        subtitle="Every visit rolls a new curse against your throw. Log in to see what you're up against."
      />
    );
  }

  const handleStart = () => {
    const p1Name = currentPlayer.playerName;
    const p2Name = format === "bot" ? `CPU (${BOT_LEVELS[botLevel].label})` : format === "local" ? opponentName : "The Board";
    setEndlessStreak(0);
    setEndlessKey(k => k + 1);
    setScreen({
      kind: "fight", gameMode, format, p1Name, p2Name,
      botLevel: format === "bot" ? botLevel : undefined,
      legs: format === "solo" ? 1 : matchLegs,
      endless: format === "solo" && endlessMode,
    });
  };

  const reportBest = async (mode: CurseGameMode, opts: { visits?: number; streak?: number }) => {
    if (!currentPlayer?.playerId) return;
    try {
      await fetch("/api/board-curse/best", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: currentPlayer.playerId, gameType: mode, ...opts }),
      });
      loadBest(mode);
    } catch { /* best just won't update this time — not worth blocking the result screen over */ }
  };

  const handleMatchComplete = async (s: Extract<Screen, { kind: "fight" }>, result: BoardCurseResult) => {
    if (s.endless) {
      const nextStreak = endlessStreak + 1;
      setEndlessStreak(nextStreak);
      setEndlessKey(k => k + 1); // remount BoardCurseScorer fresh for the next leg
      return; // stay on the fight screen — Endless keeps going until Stop
    }
    if (s.format === "solo") {
      await reportBest(s.gameMode, { visits: result.visitsTaken });
    } else {
      if (currentPlayer?.playerId) {
        try {
          await fetch("/api/board-curse/record", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: currentPlayer.playerId, format: s.format, won: result.winnerIdx === 0 }),
          });
          loadRecord(s.format);
        } catch { /* record just won't update this time */ }
      }
    }
    setScreen({ kind: "result", gameMode: s.gameMode, format: s.format, p1Name: s.p1Name, p2Name: s.p2Name, result });
  };

  const handleStopEndless = async () => {
    if (screen.kind !== "fight") return;
    if (endlessStreak > 0) await reportBest(screen.gameMode, { streak: endlessStreak });
    setScreen({ kind: "endless-result", streak: endlessStreak, bestStreak });
  };

  const loadLeaderboard = (mode: CurseGameMode) => {
    setLeaderboard(null);
    fetch(`/api/board-curse/leaderboard/${mode}`)
      .then(r => r.ok ? r.json() : { bestVisits: [], bestStreak: [] })
      .then(setLeaderboard)
      .catch(() => setLeaderboard({ bestVisits: [], bestStreak: [] }));
  };

  const openLeaderboard = () => {
    setScreen({ kind: "leaderboard", gameMode });
    loadLeaderboard(gameMode);
  };

  if (screen.kind === "fight") {
    // Passed in as topBanner rather than rendered as a sibling above BoardCurseScorer —
    // the scorer's own layout claims the full screen height for itself on mobile, so
    // anything rendered outside/above it here would push it (and the curse readout)
    // off the bottom of the screen, forcing a scroll to reach either one.
    const endlessBanner = screen.endless ? (
      <div className="flex items-center justify-between mb-2 px-1" style={{ fontFamily: "Oswald, sans-serif" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#ff8a00" }}>
          <InfinityIcon className="inline w-4 h-4 mr-1" />Endless — Leg {endlessStreak + 1}
        </div>
        <button onClick={handleStopEndless}
          className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
          <Square className="inline w-3 h-3 mr-1" />Stop
        </button>
      </div>
    ) : null;
    return (
      <BoardCurseScorer
        key={endlessKey}
        gameMode={screen.gameMode}
        format={screen.format}
        p1Name={screen.p1Name}
        p2Name={screen.p2Name}
        botConfig={screen.botLevel ? BOT_LEVELS[screen.botLevel] : undefined}
        legs={screen.legs}
        topBanner={endlessBanner}
        onMatchComplete={(r) => handleMatchComplete(screen, r)}
        onAbandon={() => screen.endless ? handleStopEndless() : setScreen({ kind: "setup" })}
      />
    );
  }

  if (screen.kind === "endless-result") {
    const isNewBest = screen.bestStreak === null || screen.streak >= screen.bestStreak;
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center" style={{ fontFamily: "Oswald, sans-serif" }}>
        <InfinityIcon className="mx-auto mb-3" size={40} style={{ color: "#ff8a00" }} />
        <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff" }}>Streak ended at {screen.streak} leg{screen.streak === 1 ? "" : "s"}</div>
        <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: "6px" }}>
          {screen.streak === 0 ? "Didn't finish a single leg that time." : isNewBest ? "New personal best!" : `Personal best: ${screen.bestStreak} legs`}
        </div>
        <div className="flex gap-2 mt-8">
          <button onClick={() => setScreen({ kind: "setup" })}
            className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
            Back to setup
          </button>
          <button onClick={handleStart}
            className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider"
            style={{ background: "linear-gradient(135deg,#ff8a00,#8b0000)", color: "#fff" }}>
            Run it back
          </button>
        </div>
      </div>
    );
  }

  if (screen.kind === "compendium") {
    const groups = getCurseCompendium(screen.gameMode);
    return (
      <div className="max-w-md mx-auto py-8 px-4" style={{ fontFamily: "Oswald, sans-serif" }}>
        <div className="text-center mb-6">
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff" }}><BookOpen className="inline w-5 h-5 mr-1.5" style={{ color: "#ff8a00" }} />Curse Compendium</div>
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
            Every curse this mode can throw at you. Numbers shown are one example roll — the real bite is re-rolled fresh each time.
          </div>
        </div>
        <div className="flex gap-2 mb-6">
          {(["X01", "CRICKET"] as CurseGameMode[]).map(m => (
            <button key={m} onClick={() => setScreen({ kind: "compendium", gameMode: m })}
              className="flex-1 py-2 rounded-lg text-xs font-bold uppercase"
              style={{
                background: screen.gameMode === m ? "rgba(255,138,0,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${screen.gameMode === m ? "rgba(255,138,0,0.4)" : "rgba(255,255,255,0.1)"}`,
                color: screen.gameMode === m ? "#ff8a00" : "rgba(255,255,255,0.5)",
              }}>
              {m === "X01" ? "501" : "Cricket"}
            </button>
          ))}
        </div>
        {groups.map(g => (
          <div key={g.tier} className="mb-6">
            <div className="text-xs font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>{TIER_LABEL[g.tier]}</div>
            <div className="space-y-2">
              {g.curses.map(c => (
                <div key={c.name} className="px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff" }}>{c.name}</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.45)" }}>{c.sampleDescription}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button onClick={() => setScreen({ kind: "setup" })}
          className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
          Back
        </button>
      </div>
    );
  }

  if (screen.kind === "leaderboard") {
    return (
      <div className="max-w-md mx-auto py-8 px-4" style={{ fontFamily: "Oswald, sans-serif" }}>
        <div className="text-center mb-6">
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff" }}><Crown className="inline w-5 h-5 mr-1.5" style={{ color: "#ffd24a" }} />Board Curse Leaderboard</div>
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>Solo — across everyone</div>
        </div>
        <div className="flex gap-2 mb-6">
          {(["X01", "CRICKET"] as CurseGameMode[]).map(m => (
            <button key={m} onClick={() => { setScreen({ kind: "leaderboard", gameMode: m }); loadLeaderboard(m); }}
              className="flex-1 py-2 rounded-lg text-xs font-bold uppercase"
              style={{
                background: screen.gameMode === m ? "rgba(255,138,0,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${screen.gameMode === m ? "rgba(255,138,0,0.4)" : "rgba(255,255,255,0.1)"}`,
                color: screen.gameMode === m ? "#ff8a00" : "rgba(255,255,255,0.5)",
              }}>
              {m === "X01" ? "501" : "Cricket"}
            </button>
          ))}
        </div>
        {!leaderboard ? (
          <div className="text-center text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Loading…</div>
        ) : (
          <>
            <div className="mb-6">
              <div className="text-xs font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>Fewest Visits to Close Out</div>
              {leaderboard.bestVisits.length === 0 ? (
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No runs recorded yet.</div>
              ) : leaderboard.bestVisits.map((e, i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: "0.85rem", color: "#fff" }}>{i + 1}. {e.playerName}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ff8a00" }}>{e.value} visit{e.value === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
            <div className="mb-6">
              <div className="text-xs font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>Longest Endless Streak</div>
              {leaderboard.bestStreak.length === 0 ? (
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No streaks recorded yet.</div>
              ) : leaderboard.bestStreak.map((e, i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: "0.85rem", color: "#fff" }}>{i + 1}. {e.playerName}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ff8a00" }}>{e.value} leg{e.value === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <button onClick={() => setScreen({ kind: "setup" })}
          className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
          Back
        </button>
      </div>
    );
  }

  if (screen.kind === "result") {
    const { format: f, p1Name, p2Name, result } = screen;
    const won = result.winnerIdx === 0;
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center" style={{ fontFamily: "Oswald, sans-serif" }}>
        {f === "solo" ? (
          <>
            <Trophy className="mx-auto mb-3" size={40} style={{ color: "#ffd24a" }} />
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff" }}>Closed out in {result.visitsTaken} visit{result.visitsTaken === 1 ? "" : "s"}</div>
            {bestVisits !== null && (
              <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: "6px" }}>
                {result.visitsTaken <= bestVisits ? "New personal best!" : `Personal best: ${bestVisits} visits`}
              </div>
            )}
          </>
        ) : won ? (
          <>
            <Trophy className="mx-auto mb-3" size={40} style={{ color: "#ffd24a" }} />
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff" }}>{p1Name} wins!</div>
          </>
        ) : (
          <>
            <Skull className="mx-auto mb-3" size={40} style={{ color: "#ff6b6b" }} />
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff" }}>{p2Name} wins.</div>
            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: "6px" }}>The curse got the better of you this time.</div>
          </>
        )}
        <div className="flex gap-2 mt-8">
          <button onClick={() => setScreen({ kind: "setup" })}
            className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
            Back to setup
          </button>
          <button onClick={handleStart}
            className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider"
            style={{ background: "linear-gradient(135deg,#ff8a00,#8b0000)", color: "#fff" }}>
            Run it back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4" style={{ fontFamily: "Oswald, sans-serif" }}>
      <div className="text-center mb-6">
        <div style={{ fontSize: "0.7rem", letterSpacing: "0.2em", color: "rgba(255,138,0,0.6)", textTransform: "uppercase" }}>Beta</div>
        <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#fff" }}><Flame className="inline w-6 h-6 mr-1.5" style={{ color: "#ff8a00" }} />Board Curse</div>
        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
          Random curses strike as the leg goes on, and get worse the longer it runs. Arcade only — no Elo impact.
        </div>
        <div className="flex items-center justify-center gap-4 mt-3">
          <button onClick={openLeaderboard} className="text-xs font-bold uppercase" style={{ color: "#ffd24a" }}>
            <Crown className="inline w-3.5 h-3.5 mr-1" />Leaderboard
          </button>
          <button onClick={() => setScreen({ kind: "compendium", gameMode })} className="text-xs font-bold uppercase" style={{ color: "#ff8a00" }}>
            <BookOpen className="inline w-3.5 h-3.5 mr-1" />Curses
          </button>
        </div>
      </div>

      <div className="mb-5">
        <div className="text-xs font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>Game</div>
        <div className="flex gap-2">
          {(["X01", "CRICKET"] as CurseGameMode[]).map(m => (
            <button key={m} onClick={() => setGameMode(m)}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase"
              style={{
                background: gameMode === m ? "rgba(255,138,0,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${gameMode === m ? "rgba(255,138,0,0.4)" : "rgba(255,255,255,0.1)"}`,
                color: gameMode === m ? "#ff8a00" : "rgba(255,255,255,0.5)",
              }}>
              {m === "X01" ? "501" : "Cricket"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <div className="text-xs font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>Format</div>
        <div className="space-y-2">
          {([
            { key: "solo" as Format, label: "Solo", desc: "Just you vs the board — how far can you get?", icon: User },
            { key: "bot" as Format, label: "vs Bot", desc: "You vs a CPU — curses can strike either of you.", icon: Bot },
            { key: "local" as Format, label: "vs Local Player", desc: "Pass and play — curses can strike either of you.", icon: Users },
          ]).map(opt => (
            <button key={opt.key} onClick={() => setFormat(opt.key)}
              className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: format === opt.key ? "rgba(255,138,0,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${format === opt.key ? "rgba(255,138,0,0.35)" : "rgba(255,255,255,0.08)"}`,
              }}>
              <opt.icon size={18} style={{ color: format === opt.key ? "#ff8a00" : "rgba(255,255,255,0.4)" }} />
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>{opt.label}</div>
                <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)" }}>{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {format === "solo" && (
        <button onClick={() => setEndlessMode(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-5"
          style={{
            background: endlessMode ? "rgba(255,138,0,0.1)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${endlessMode ? "rgba(255,138,0,0.35)" : "rgba(255,255,255,0.08)"}`,
          }}>
          <div className="flex items-center gap-3">
            <InfinityIcon size={18} style={{ color: endlessMode ? "#ff8a00" : "rgba(255,255,255,0.4)" }} />
            <div className="text-left">
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>Endless</div>
              <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)" }}>Keep playing leg after leg until you stop — chase your longest streak.</div>
            </div>
          </div>
          <div style={{ width: "36px", height: "20px", borderRadius: "999px", background: endlessMode ? "#ff8a00" : "rgba(255,255,255,0.15)", position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: "2px", left: endlessMode ? "18px" : "2px", width: "16px", height: "16px", borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
          </div>
        </button>
      )}

      {(format === "bot" || format === "local") && (
        <div className="mb-5">
          <div className="text-xs font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>Match Length</div>
          <div className="flex gap-2">
            {([1, 3, 5] as MatchLegs[]).map(n => (
              <button key={n} onClick={() => setMatchLegs(n)}
                className="flex-1 py-2 rounded-lg text-xs font-bold"
                style={{
                  background: matchLegs === n ? "rgba(255,138,0,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${matchLegs === n ? "rgba(255,138,0,0.4)" : "rgba(255,255,255,0.1)"}`,
                  color: matchLegs === n ? "#ff8a00" : "rgba(255,255,255,0.5)",
                }}>
                Best of {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {format === "bot" && (
        <div className="mb-5">
          <div className="text-xs font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>CPU Difficulty</div>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(BOT_LEVELS) as BotLevel[]).map(lvl => (
              <button key={lvl} onClick={() => setBotLevel(lvl)}
                className="py-2 rounded-lg text-xs font-bold"
                style={{
                  background: botLevel === lvl ? `${BOT_LEVELS[lvl].color}22` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${botLevel === lvl ? BOT_LEVELS[lvl].color : "rgba(255,255,255,0.1)"}`,
                  color: botLevel === lvl ? BOT_LEVELS[lvl].color : "rgba(255,255,255,0.5)",
                }}>
                {BOT_LEVELS[lvl].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {format === "local" && (
        <div className="mb-5">
          <div className="text-xs font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>Opponent</div>
          <select value={opponentSelection} onChange={e => setOpponentSelection(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg text-sm"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: opponentSelection ? "#fff" : "rgba(255,255,255,0.35)" }}>
            <option value="" style={{ color: "#111" }}>Select a player…</option>
            {opponents.map(p => (
              <option key={p.id} value={String(p.id)} style={{ color: "#111" }}>{p.name}</option>
            ))}
            <option value={GUEST_OPTION} style={{ color: "#111" }}>Guest (not in the app)</option>
          </select>
          {opponentSelection === GUEST_OPTION && (
            <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Guest's name" autoFocus
              className="w-full px-4 py-2.5 rounded-lg text-sm mt-2"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} />
          )}
        </div>
      )}

      {format === "solo" && !endlessMode && bestVisits !== null && (
        <div className="text-center text-xs mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
          Personal best: {bestVisits} visit{bestVisits === 1 ? "" : "s"}
        </div>
      )}
      {format === "solo" && endlessMode && bestStreak !== null && (
        <div className="text-center text-xs mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
          Longest streak: {bestStreak} leg{bestStreak === 1 ? "" : "s"}
        </div>
      )}
      {(format === "bot" || format === "local") && record && (
        <div className="text-center text-xs mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
          Your record {format === "bot" ? "vs Bots" : "vs Local Players"}: {record.wins}-{record.losses}
        </div>
      )}

      <button onClick={handleStart} disabled={!canStart}
        className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider"
        style={{
          background: canStart ? "linear-gradient(135deg,#ff8a00,#8b0000)" : "rgba(255,255,255,0.06)",
          color: canStart ? "#fff" : "rgba(255,255,255,0.3)",
          cursor: canStart ? "pointer" : "not-allowed",
        }}>
        <Swords className="inline w-3.5 h-3.5 mr-1.5" />Start
      </button>
    </div>
  );
}
