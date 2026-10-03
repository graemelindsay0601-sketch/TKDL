import { useEffect, useState } from "react";
import { Flame, Swords, User, Users, Bot, Trophy, Skull, Crown, Square, Infinity as InfinityIcon, BookOpen, CalendarDays } from "lucide-react";
import { useCurrentPlayer } from "@/context/auth";
import { useListPlayers } from "@workspace/api-client-react";
import { BoardCurseScorer, type BoardCurseResult } from "@/components/BoardCurseScorer";
import { BOT_LEVELS, type BotLevel } from "@/lib/bot-engine";
import { getCurseCompendium, type CurseGameMode, type CurseTier } from "@/lib/board-curse-data";
import { AchievementRewardModal, type AchievementRewardData } from "@/components/AchievementRewardModal";
import { dailyVisitLimit, endlessVisitLimit } from "@/lib/board-curse-survival";
import "./board-curse.css";

type RosterPlayer = { id: number; name: string; status: string; isActive: boolean };
const GUEST_OPTION = "__guest__";

type Format = "solo" | "bot" | "local";
type MatchLegs = 1 | 3 | 5;

type Screen =
  | { kind: "setup" }
  | { kind: "fight"; gameMode: CurseGameMode; format: Format; p1Name: string; p2Name: string; botLevel?: BotLevel; legs: MatchLegs; endless: boolean; daily: boolean }
  | { kind: "result"; gameMode: CurseGameMode; format: Format; p1Name: string; p2Name: string; result: BoardCurseResult }
  | { kind: "endless-result"; streak: number; bestStreak: number | null; failed: boolean; visitLimit: number; decisiveCurse?: string }
  | { kind: "leaderboard"; gameMode: CurseGameMode }
  | { kind: "compendium"; gameMode: CurseGameMode };

const TIER_LABEL: Record<CurseTier, string> = { 1: "Mild — early visits", 2: "Medium — mid-leg", 3: "Severe — late leg" };
// Escalating severity ramp (amber → flame orange → red) — distinct from
// boss-battle.tsx's difficulty-tier colors, since curse tiers describe how
// nasty a single curse's bite is, not a CPU skill level.
const TIER_COLOR: Record<CurseTier, string> = { 1: "#fbbf24", 2: "#ff8a00", 3: "#ef4444" };

type Record_ = { wins: number; losses: number };
type LeaderboardEntry = { playerName: string; value: number; outcome?: string };
type ArcadeRun = { id:number; mode:string; gameType:string|null; format:string|null; opponentLabel:string|null; outcome:string; visits:number|null; streak:number|null; milestoneLabel:string|null; playedAt:string };

export default function BoardCursePage() {
  // Playing Board Curse has never needed an account — pick your name from
  // the roster and go, same as Master-501/Practice/Tour. useCurrentPlayer()
  // is only consulted to default the picker to your own name when you
  // happen to be logged in; logging in is for claiming/managing an account,
  // never a requirement to play.
  const currentPlayer = useCurrentPlayer();
  const [screen, setScreen] = useState<Screen>({ kind: "setup" });
  const [gameMode, setGameMode] = useState<CurseGameMode>("X01");
  const [format, setFormat] = useState<Format>("solo");
  const [botLevel, setBotLevel] = useState<BotLevel>("club");
  const { data: playersData } = useListPlayers();
  const roster = ((playersData as RosterPlayer[] | undefined) ?? []).filter(p => p.isActive !== false);
  const [playerId, setPlayerId] = useState<number | null>(null);
  useEffect(() => {
    if (playerId !== null || roster.length === 0) return;
    setPlayerId((currentPlayer ? roster.find(p => p.id === currentPlayer.playerId)?.id : undefined) ?? roster[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.length]);
  const playerName = roster.find(p => p.id === playerId)?.name ?? "";
  // "vs Local Player" pulls the actual roster (same "casual mode only
  // excludes INACTIVE players" rule used elsewhere, e.g. play.tsx's Team
  // Game fix), excluding whoever is picked as "You" above, with a Guest
  // fallback for someone not in the app at all.
  const opponents = roster
    .filter(p => p.id !== playerId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const [opponentSelection, setOpponentSelection] = useState<string>("");
  const [guestName, setGuestName] = useState("");
  const opponentName = opponentSelection === GUEST_OPTION
    ? (guestName.trim() || "Guest")
    : (opponents.find(p => String(p.id) === opponentSelection)?.name ?? "Player 2");
  const canStart = !!playerId && (format !== "local" || (
    opponentSelection !== "" && (opponentSelection !== GUEST_OPTION || guestName.trim() !== "")
  ));
  const [matchLegs, setMatchLegs] = useState<MatchLegs>(3);
  const [endlessMode, setEndlessMode] = useState(false);
  const [dailyMode, setDailyMode] = useState(false);
  const [bestVisits, setBestVisits] = useState<number | null>(null);
  const [bestStreak, setBestStreak] = useState<number | null>(null);
  const [record, setRecord] = useState<Record_ | null>(null);
  const [endlessStreak, setEndlessStreak] = useState(0);
  const [endlessKey, setEndlessKey] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ bestVisits: LeaderboardEntry[]; bestStreak: LeaderboardEntry[]; daily?: LeaderboardEntry[] } | null>(null);
  const [history, setHistory] = useState<ArcadeRun[]>([]);
  const [saveState, setSaveState] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [rewardQueue, setRewardQueue] = useState<AchievementRewardData[]>([]);
  const [wardAvailable, setWardAvailable] = useState(true);

  const loadHistory = () => {
    if (!playerId) { setHistory([]); return; }
    fetch(`/api/arcade/history/${playerId}?limit=10`).then(r => r.ok ? r.json() : [])
      .then((rows: ArcadeRun[]) => setHistory(rows.filter(row => row.mode === "board_curse" || row.mode === "board_curse_daily")))
      .catch(() => setHistory([]));
  };
  useEffect(loadHistory, [playerId]);

  const loadBest = (mode: CurseGameMode) => {
    if (!playerId) return;
    fetch(`/api/board-curse/best/${playerId}/${mode}`)
      .then(r => r.ok ? r.json() : { bestVisits: null, bestStreak: null })
      .then((d: { bestVisits: number | null; bestStreak: number | null }) => { setBestVisits(d.bestVisits); setBestStreak(d.bestStreak); })
      .catch(() => { setBestVisits(null); setBestStreak(null); });
  };

  const loadRecord = (fmt: "bot" | "local") => {
    if (!playerId) return;
    fetch(`/api/board-curse/record/${playerId}/${fmt}`)
      .then(r => r.ok ? r.json() : { wins: 0, losses: 0 })
      .then((d: Record_) => setRecord(d))
      .catch(() => setRecord(null));
  };

  useEffect(() => { loadBest(gameMode); }, [gameMode, playerId]);
  useEffect(() => {
    if (format === "bot" || format === "local") loadRecord(format);
    else setRecord(null);
  }, [format, playerId]);

  useEffect(() => {
    if (format !== "solo") { setEndlessMode(false); setDailyMode(false); }
  }, [format]);

  const handleStart = () => {
    setSaveState("idle");
    const p1Name = playerName;
    const p2Name = format === "bot" ? `CPU (${BOT_LEVELS[botLevel].label})` : format === "local" ? opponentName : "The Board";
    setEndlessStreak(0);
    setWardAvailable(true);
    setEndlessKey(k => k + 1);
    setScreen({
      kind: "fight", gameMode, format, p1Name, p2Name,
      botLevel: format === "bot" ? botLevel : undefined,
      legs: format === "solo" ? 1 : matchLegs,
      endless: format === "solo" && endlessMode,
      daily: format === "solo" && dailyMode,
    });
  };

  const reportBest = async (mode: CurseGameMode, opts: { visits?: number; streak?: number; outcome?: "win" | "loss" }) => {
    if (!playerId) return false;
    try {
      setSaveState("saving");
      const response = await fetch("/api/board-curse/best", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, gameType: mode, ...opts }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Result could not be saved");
      setSaveState("saved");
      if (Array.isArray(data.achievements) && data.achievements.length) setRewardQueue(queue => [...queue, ...data.achievements]);
      loadBest(mode);
      loadHistory();
      return true;
    } catch { setSaveState("error"); return false; }
  };

  const handleMatchComplete = async (s: Extract<Screen, { kind: "fight" }>, result: BoardCurseResult) => {
    if (s.daily) {
      if (playerId) {
        setSaveState("saving");
        try {
          const response = await fetch("/api/board-curse/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId, gameType: s.gameMode, won: !result.endedByVisitLimit, visits: result.visitsTaken }) });
          if (!response.ok) throw new Error("Daily result could not be saved");
          setSaveState("saved"); loadHistory();
        } catch { setSaveState("error"); }
      }
      setScreen({ kind: "result", gameMode: s.gameMode, format: s.format, p1Name: s.p1Name, p2Name: s.p2Name, result });
      return;
    }
    if (s.endless) {
      const limit = endlessVisitLimit(s.gameMode, endlessStreak);
      if (result.endedByVisitLimit) {
        await reportBest(s.gameMode, { streak: endlessStreak, visits: result.visitsTaken, outcome: "loss" });
        setScreen({ kind: "endless-result", streak: endlessStreak, bestStreak, failed: true, visitLimit: limit, decisiveCurse: result.decisiveCurse });
        return;
      }
      const nextStreak = endlessStreak + 1;
      setEndlessStreak(nextStreak);
      setEndlessKey(k => k + 1); // remount BoardCurseScorer fresh for the next leg
      return; // stay on the fight screen — Endless keeps going until Stop
    }
    if (s.format === "solo") {
      await reportBest(s.gameMode, { visits: result.visitsTaken });
    } else {
      if (playerId) {
        try {
          setSaveState("saving");
          const response = await fetch("/api/board-curse/record", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, format: s.format, won: result.winnerIdx === 0, gameType: s.gameMode, opponentLabel: s.p2Name, visits: result.visitsTaken }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data?.error ?? "Result could not be saved");
          setSaveState("saved");
          if (Array.isArray(data.achievements) && data.achievements.length) setRewardQueue(queue => [...queue, ...data.achievements]);
          loadRecord(s.format);
          loadHistory();
        } catch { setSaveState("error"); }
      }
    }
    setScreen({ kind: "result", gameMode: s.gameMode, format: s.format, p1Name: s.p1Name, p2Name: s.p2Name, result });
  };

  const handleStopEndless = async () => {
    if (screen.kind !== "fight") return;
    if (endlessStreak > 0) await reportBest(screen.gameMode, { streak: endlessStreak });
    setScreen({ kind: "endless-result", streak: endlessStreak, bestStreak, failed: false, visitLimit: endlessVisitLimit(screen.gameMode, endlessStreak) });
  };

  const loadLeaderboard = (mode: CurseGameMode) => {
    setLeaderboard(null);
    fetch(`/api/board-curse/leaderboard/${mode}`)
      .then(r => r.ok ? r.json() : { bestVisits: [], bestStreak: [], daily: [] })
      .then(setLeaderboard)
      .catch(() => setLeaderboard({ bestVisits: [], bestStreak: [], daily: [] }));
  };

  const openLeaderboard = () => {
    setScreen({ kind: "leaderboard", gameMode });
    loadLeaderboard(gameMode);
  };

  if (screen.kind === "fight") {
    const visitLimit = screen.daily ? dailyVisitLimit(screen.gameMode) : screen.endless ? endlessVisitLimit(screen.gameMode, endlessStreak) : undefined;
    const challengeDate = new Date().toISOString().slice(0, 10);
    // Passed in as topBanner rather than rendered as a sibling above BoardCurseScorer —
    // the scorer's own layout claims the full screen height for itself on mobile, so
    // anything rendered outside/above it here would push it (and the curse readout)
    // off the bottom of the screen, forcing a scroll to reach either one.
    const endlessBanner = screen.daily ? (
      <div className="bc-endless-banner daily"><span><CalendarDays size={16} />Daily Curse · {visitLimit} visits</span><small>Same curses for everyone</small></div>
    ) : screen.endless ? (
      <div className="bc-endless-banner">
        <span><InfinityIcon size={16} />Leg {endlessStreak + 1} · {visitLimit} visit limit</span>
        <button onClick={handleStopEndless}><Square className="inline w-3 h-3 mr-1" />Cash out</button>
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
        visitLimit={visitLimit}
        wardAvailable={wardAvailable}
        onWardUsed={() => setWardAvailable(false)}
        challengeSeed={screen.daily ? `${challengeDate}:${screen.gameMode}` : undefined}
        onMatchComplete={(r) => handleMatchComplete(screen, r)}
        onAbandon={() => screen.endless ? handleStopEndless() : setScreen({ kind: "setup" })}
      />
    );
  }

  if (screen.kind === "endless-result") {
    const isNewBest = screen.bestStreak === null || screen.streak >= screen.bestStreak;
    return (
      <>
      <div className="bc-shell">
        <div className="bc-result" style={{ "--glow": "#ff8a00" } as React.CSSProperties}>
          <div className="bc-result-glow" />
          <div className="bc-result-icon"><InfinityIcon /></div>
          <h1>{screen.failed ? "The curse ended your run" : "Streak banked"} · {screen.streak} leg{screen.streak === 1 ? "" : "s"}</h1>
          <p>{screen.failed
            ? `The ${screen.visitLimit}-visit limit expired${screen.decisiveCurse ? ` under ${screen.decisiveCurse}` : ""}.`
            : screen.streak === 0 ? "No completed leg was banked." : isNewBest ? "New personal best!" : `Personal best: ${screen.bestStreak} legs`}</p>
          <div className={`bc-save-state ${saveState}`}>{saveState === "saving" ? "Saving run…" : saveState === "saved" ? "Run saved · records and rewards updated" : saveState === "error" ? "Run shown, but it could not be saved" : "Arcade run"}</div>
          <div className="bc-result-actions">
            <button className="bc-btn-ghost" onClick={() => setScreen({ kind: "setup" })}>Back to setup</button>
            <button className="bc-btn-primary" onClick={handleStart}>Run it back</button>
          </div>
        </div>
      </div>
      <AchievementRewardModal achievement={rewardQueue[0] ?? null} isOpen={rewardQueue.length > 0} onClose={() => setRewardQueue(queue => queue.slice(1))} />
      </>
    );
  }

  if (screen.kind === "compendium") {
    const groups = getCurseCompendium(screen.gameMode);
    return (
      <div className="bc-shell">
        <div className="text-center mb-6">
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff" }}><BookOpen className="inline w-5 h-5 mr-1.5" style={{ color: "#ff8a00" }} />Curse Compendium</div>
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
            Every curse this mode can throw at you. Numbers shown are one example roll — the real bite is re-rolled fresh each time.
          </div>
        </div>
        <div className="bc-tabs mb-6">
          {(["X01", "CRICKET"] as CurseGameMode[]).map(m => (
            <button key={m} className={`bc-tab ${screen.gameMode === m ? "active" : ""}`} onClick={() => setScreen({ kind: "compendium", gameMode: m })}>
              {m === "X01" ? "501" : "Cricket"}
            </button>
          ))}
        </div>
        {groups.map(g => (
          <div key={g.tier} className="bc-tier-section" style={{ "--tier": TIER_COLOR[g.tier] } as React.CSSProperties}>
            <div className="bc-tier-head"><span className="bc-tier-dot" /><span>{TIER_LABEL[g.tier]}</span></div>
            <div className="bc-curse-grid">
              {g.curses.map(c => (
                <div key={c.name} className="bc-curse-card">
                  <div className="bc-curse-name">{c.name}</div>
                  <div className="bc-curse-desc">{c.sampleDescription}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button className="bc-btn-ghost" style={{ width: "100%" }} onClick={() => setScreen({ kind: "setup" })}>Back</button>
      </div>
    );
  }

  if (screen.kind === "leaderboard") {
    return (
      <div className="bc-shell">
        <div className="text-center mb-6">
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff" }}><Crown className="inline w-5 h-5 mr-1.5" style={{ color: "#ffd24a" }} />Board Curse Leaderboard</div>
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>Solo — across everyone</div>
        </div>
        <div className="bc-tabs mb-6">
          {(["X01", "CRICKET"] as CurseGameMode[]).map(m => (
            <button key={m} className={`bc-tab ${screen.gameMode === m ? "active" : ""}`} onClick={() => { setScreen({ kind: "leaderboard", gameMode: m }); loadLeaderboard(m); }}>
              {m === "X01" ? "501" : "Cricket"}
            </button>
          ))}
        </div>
        {!leaderboard ? (
          <div className="bc-empty">Loading…</div>
        ) : (
          <div className="pdc-card p-4">
            <div className="bc-lb-section">
              <div className="bc-lb-title">Today's Daily Curse</div>
              {!leaderboard.daily?.length ? <div className="bc-empty">Nobody has challenged today's board yet.</div> : leaderboard.daily.map((e, i) => (
                <div key={`daily-${i}`} className="bc-lb-row"><span className={`bc-lb-rank ${i === 0 ? "gold" : ""}`}>{i + 1}</span><span className="bc-lb-name">{e.playerName}</span><span className="bc-lb-value">{e.outcome === "win" ? `${e.value} visits` : "DNF"}</span></div>
              ))}
            </div>
            <div className="bc-lb-section">
              <div className="bc-lb-title">Fewest Visits to Close Out</div>
              {leaderboard.bestVisits.length === 0 ? (
                <div className="bc-empty">No runs recorded yet.</div>
              ) : leaderboard.bestVisits.map((e, i) => (
                <div key={i} className="bc-lb-row">
                  <span className={`bc-lb-rank ${i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : ""}`}>{i + 1}</span>
                  <span className="bc-lb-name">{e.playerName}</span>
                  <span className="bc-lb-value">{e.value} visit{e.value === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
            <div className="bc-lb-section" style={{ marginBottom: 0 }}>
              <div className="bc-lb-title">Longest Endless Streak</div>
              {leaderboard.bestStreak.length === 0 ? (
                <div className="bc-empty">No streaks recorded yet.</div>
              ) : leaderboard.bestStreak.map((e, i) => (
                <div key={i} className="bc-lb-row">
                  <span className={`bc-lb-rank ${i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : ""}`}>{i + 1}</span>
                  <span className="bc-lb-name">{e.playerName}</span>
                  <span className="bc-lb-value">{e.value} leg{e.value === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button className="bc-btn-ghost" style={{ width: "100%", marginTop: "16px" }} onClick={() => setScreen({ kind: "setup" })}>Back</button>
      </div>
    );
  }

  if (screen.kind === "result") {
    const { format: f, p1Name, p2Name, result } = screen;
    const won = result.winnerIdx === 0;
    const glow = (f === "solo" || won) ? "#ffd24a" : "#ff6b6b";
    return (
      <>
      <div className="bc-shell">
        <div className="bc-result" style={{ "--glow": glow } as React.CSSProperties}>
          <div className="bc-result-glow" />
          {f === "solo" && result.endedByVisitLimit ? (
            <><div className="bc-result-icon"><Skull /></div><h1>The board survived</h1><p>The visit limit expired after {result.visitsTaken} visits{result.decisiveCurse ? ` under ${result.decisiveCurse}` : ""}.</p></>
          ) : f === "solo" ? (
            <>
              <div className="bc-result-icon"><Trophy /></div>
              <h1>Closed out in {result.visitsTaken} visit{result.visitsTaken === 1 ? "" : "s"}</h1>
              {bestVisits !== null && <p>{result.visitsTaken <= bestVisits ? "New personal best!" : `Personal best: ${bestVisits} visits`}</p>}
            </>
          ) : won ? (
            <>
              <div className="bc-result-icon"><Trophy /></div>
              <h1>{p1Name} wins!</h1>
            </>
          ) : (
            <>
              <div className="bc-result-icon"><Skull /></div>
              <h1>{p2Name} wins.</h1>
              <p>The curse got the better of you this time.</p>
            </>
          )}
          <div className={`bc-save-state ${saveState}`}>{saveState === "saving" ? "Saving match…" : saveState === "saved" ? "Match saved · records and rewards updated" : saveState === "error" ? "Match shown, but it could not be saved" : "Arcade match"}</div>
          <div className="bc-result-actions">
            <button className="bc-btn-ghost" onClick={() => setScreen({ kind: "setup" })}>Back to setup</button>
            <button className="bc-btn-primary" onClick={handleStart}>Run it back</button>
          </div>
        </div>
      </div>
      <AchievementRewardModal achievement={rewardQueue[0] ?? null} isOpen={rewardQueue.length > 0} onClose={() => setRewardQueue(queue => queue.slice(1))} />
      </>
    );
  }

  return (
    <div className="bc-shell">
      <div className="bc-hero">
        <div className="bc-hero-copy">
          <div className="bc-kicker"><i />TKDL Arcade · Anomaly Detected</div>
          <h1><Flame />Board <span>Curse</span></h1>
          <p>The board fights back. Random curses corrupt the leg, change the rules and grow more severe with every visit.</p>
          <div className="bc-hero-actions">
            <button className="bc-pill-btn" onClick={openLeaderboard}><Crown className="w-3.5 h-3.5" style={{ color: "#ffd24a" }} />Survivors</button>
            <button className="bc-pill-btn" onClick={() => setScreen({ kind: "compendium", gameMode })}><BookOpen className="w-3.5 h-3.5" />Curse Archive</button>
          </div>
        </div>
        <div className="bc-signal-card">
          <div className="bc-signal-head"><span>Curse Signal</span><b>LIVE</b></div>
          <div className="bc-signal-orb"><Flame /><i /><i /><i /></div>
          <strong>{gameMode === "X01" ? "501 BOARD ONLINE" : "CRICKET BOARD ONLINE"}</strong>
          <small>Severity escalates from mild interference to a full board takeover.</small>
          <div className="bc-severity-track"><i /><i /><i /></div>
          {(bestVisits !== null || bestStreak !== null) && (
            <div className="bc-stat-row">
              <div className="bc-stat-tile"><strong>{bestVisits ?? "—"}</strong><span>Best Visits</span></div>
              <div className="bc-stat-tile"><strong>{bestStreak ?? "—"}</strong><span>Longest Streak</span></div>
            </div>
          )}
        </div>
      </div>

      <div className="bc-arena-grid">
        <aside className="bc-control-rail">
          <div className="bc-panel-heading"><span>Player Terminal</span><small>01</small></div>
          <div className="bc-field">
            <span className="bc-field-label">You</span>
            <select value={playerId ?? ""} onChange={e => setPlayerId(Number(e.target.value) || null)} className="bc-select">
              <option value="" style={{ color: "#111" }}>Select player…</option>
              {roster.map(p => <option key={p.id} value={p.id} style={{ color: "#111" }}>{p.name}</option>)}
            </select>
          </div>
          <div className="bc-contract-card">
            <span>Active Contract</span>
            <strong>{format === "solo" ? (dailyMode ? "Daily Curse" : endlessMode ? "Endless Survival" : "Solo Survival") : format === "bot" ? `CPU Duel · ${BOT_LEVELS[botLevel].label}` : "Local Duel"}</strong>
            <p>{gameMode === "X01" ? "501" : "Cricket"} · {format === "solo" ? (dailyMode ? `Today's shared ${dailyVisitLimit(gameMode)}-visit challenge` : endlessMode ? `Survive ${endlessVisitLimit(gameMode, 0)} visits, then the limit tightens` : "One leg") : `Best of ${matchLegs}`}</p>
            <div><i /><small>No Elo or league points at risk</small></div>
          </div>
          {history.length > 0 && <div className="bc-history"><div className="bc-lb-title">Recent Curses</div>{history.slice(0,4).map(run => <div className="bc-history-row" key={run.id}><i className={run.outcome}/><span>{run.mode === "board_curse_daily" ? `Daily · ${run.visits ?? "—"} visits` : run.format === "solo" ? run.streak ? `${run.streak} leg streak` : `${run.visits ?? "—"} visits` : run.opponentLabel}</span><b>{run.outcome === "win" ? "W" : "L"}</b></div>)}</div>}
        </aside>

        <section className="bc-setup-panel">
          <div className="bc-panel-heading"><span>Configure The Encounter</span><small>02</small></div>
      <div className="bc-field">
        <span className="bc-field-label">Game</span>
        <div className="bc-tabs">
          {(["X01", "CRICKET"] as CurseGameMode[]).map(m => (
            <button key={m} className={`bc-tab ${gameMode === m ? "active" : ""}`} onClick={() => setGameMode(m)}>
              {m === "X01" ? "501" : "Cricket"}
            </button>
          ))}
        </div>
      </div>

      <div className="bc-field">
        <span className="bc-field-label">Format</span>
        <div className="bc-format-grid">
          {([
            { key: "solo" as Format, label: "Solo", desc: "Just you vs the board — how far can you get?", icon: User },
            { key: "bot" as Format, label: "vs Bot", desc: "You vs a CPU — curses can strike either of you.", icon: Bot },
            { key: "local" as Format, label: "vs Local Player", desc: "Pass and play — curses can strike either of you.", icon: Users },
          ]).map(opt => (
            <button key={opt.key} onClick={() => setFormat(opt.key)} className={`bc-format-card ${format === opt.key ? "active" : ""}`}>
              <span className="bc-format-icon"><opt.icon size={18} /></span>
              <div><div className="bc-format-name">{opt.label}</div><div className="bc-format-desc">{opt.desc}</div></div>
            </button>
          ))}
        </div>
      </div>

      {format === "solo" && (
        <div className="bc-field">
          <button onClick={() => { setEndlessMode(v => !v); setDailyMode(false); }} className={`bc-toggle-row ${endlessMode ? "active" : ""}`}>
            <span className="bc-toggle-left">
              <InfinityIcon size={18} />
              <span><div className="bc-format-name">Endless Survival</div><div className="bc-format-desc">Clear each leg before its visit limit; the limit tightens as your streak grows.</div></span>
            </span>
            <span className={`bc-switch ${endlessMode ? "on" : ""}`}><i /></span>
          </button>
          <button onClick={() => { setDailyMode(v => !v); setEndlessMode(false); }} className={`bc-toggle-row ${dailyMode ? "active" : ""}`} style={{ marginTop: 8 }}>
            <span className="bc-toggle-left"><CalendarDays size={18} /><span><div className="bc-format-name">Daily Curse</div><div className="bc-format-desc">One shared curse sequence and visit limit for the whole league each day.</div></span></span>
            <span className={`bc-switch ${dailyMode ? "on" : ""}`}><i /></span>
          </button>
        </div>
      )}

      {(format === "bot" || format === "local") && (
        <div className="bc-field">
          <span className="bc-field-label">Match Length</span>
          <div className="bc-pill-row">
            {([1, 3, 5] as MatchLegs[]).map(n => (
              <button key={n} className={`bc-pill ${matchLegs === n ? "active" : ""}`} onClick={() => setMatchLegs(n)}>Best of {n}</button>
            ))}
          </div>
        </div>
      )}

      {format === "bot" && (
        <div className="bc-field">
          <span className="bc-field-label">CPU Difficulty</span>
          <div className="bc-diff-grid">
            {(Object.keys(BOT_LEVELS) as BotLevel[]).map(lvl => (
              <button key={lvl} className="bc-diff-pill" onClick={() => setBotLevel(lvl)}
                style={{
                  background: botLevel === lvl ? `${BOT_LEVELS[lvl].color}22` : undefined,
                  borderColor: botLevel === lvl ? BOT_LEVELS[lvl].color : undefined,
                  color: botLevel === lvl ? BOT_LEVELS[lvl].color : undefined,
                }}>
                {BOT_LEVELS[lvl].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {format === "local" && (
        <div className="bc-field">
          <span className="bc-field-label">Opponent</span>
          <select value={opponentSelection} onChange={e => setOpponentSelection(e.target.value)} className="bc-select">
            <option value="" style={{ color: "#111" }}>Select a player…</option>
            {opponents.map(p => (
              <option key={p.id} value={String(p.id)} style={{ color: "#111" }}>{p.name}</option>
            ))}
            <option value={GUEST_OPTION} style={{ color: "#111" }}>Guest (not in the app)</option>
          </select>
          {opponentSelection === GUEST_OPTION && (
            <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Guest's name" autoFocus
              className="bc-select" style={{ marginTop: "8px" }} />
          )}
        </div>
      )}

      {format === "solo" && !endlessMode && bestVisits !== null && <div className="bc-note">Personal best: {bestVisits} visit{bestVisits === 1 ? "" : "s"}</div>}
      {format === "solo" && endlessMode && bestStreak !== null && <div className="bc-note">Longest streak: {bestStreak} leg{bestStreak === 1 ? "" : "s"}</div>}
      {(format === "bot" || format === "local") && record && (
        <div className="bc-note">Your record {format === "bot" ? "vs Bots" : "vs Local Players"}: {record.wins}-{record.losses}</div>
      )}

      <button onClick={handleStart} disabled={!canStart} className="bc-start-btn">
        <Swords className="inline w-3.5 h-3.5 mr-1.5" />Start
      </button>
        </section>
      </div>
    </div>
  );
}
