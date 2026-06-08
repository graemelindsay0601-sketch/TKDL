import { useState, useEffect } from "react";
import { useListPlayers, useSubmitMatch, getGetLeaderboardQueryKey, getGetStatsSummaryQueryKey, getGetRecentActivityQueryKey, getListMatchesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Swords, Trophy, RotateCcw, ChevronRight, BookOpen, Info, Zap, AlertCircle, Plus, Minus } from "lucide-react";
import { GameScorer, type GameTypeOption, type GameResult, type PracticeStats } from "@/components/game-scorer";
import { RulesModal } from "@/components/rules-modal";
import { MatchStatsCard } from "@/components/match-stats-card";

// ── Types ──────────────────────────────────────────────────────────────────────
type Player = { id: number; name: string; points: number; elo: number; status: string };
type GameMode = "1v1" | "doubles" | "multi-killer";

type SetupData1v1         = { mode: "1v1"; p1: Player; p2: Player; gameType: GameTypeOption; stake: number };
type SetupDataDoubles     = { mode: "doubles"; team1: [Player, Player]; team2: [Player, Player]; gameType: GameTypeOption; stakePerPerson: number };
type SetupDataMultiKiller = { mode: "multi-killer"; players: Player[]; lives: number; stake: number };
type SetupData = SetupData1v1 | SetupDataDoubles | SetupDataMultiKiller;

const MODE_TABS: { key: GameMode; label: string; icon: string }[] = [
  { key: "1v1",          label: "1 v 1",       icon: "⚔" },
  { key: "doubles",      label: "Doubles",      icon: "👥" },
  { key: "multi-killer", label: "Killer",       icon: "☠" },
];

const GAME_TABS = [
  { key: "competitive", label: "Competitive" },
  { key: "practice",    label: "Practice" },
  { key: "party",       label: "Party" },
  { key: "mini-games",  label: "Mini-Games" },
];

// ── Shared selects ─────────────────────────────────────────────────────────────
function PlayerSelect({ label, color, value, onChange, players, excludeIds }: {
  label: string; color: string; value: string;
  onChange: (v: string) => void; players: Player[]; excludeIds: string[];
}) {
  return (
    <div className="pdc-card p-3" style={{ borderColor: value ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)" }}>
      <div className="text-xs font-bold uppercase mb-2" style={{ fontFamily: "Oswald, sans-serif", color, letterSpacing: "0.1em" }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: value ? "#fff" : "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
        <option value="" style={{ color: "#111" }}>Select player…</option>
        {players.filter(p => !excludeIds.includes(String(p.id)) || p.id === Number(value)).map(p => (
          <option key={p.id} value={p.id} style={{ color: "#111" }}>{p.name} ({p.points}pts)</option>
        ))}
      </select>
      {value && <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
        {players.find(p => p.id === Number(value))?.points}pts · ELO {players.find(p => p.id === Number(value))?.elo}
      </div>}
    </div>
  );
}

function GameCard({ gt, selected, onSelect, onRules }: { gt: GameTypeOption; selected: boolean; onSelect: () => void; onRules: () => void }) {
  return (
    <div onClick={onSelect} className="pdc-card p-3 cursor-pointer transition-all relative overflow-hidden"
      style={{ borderColor: selected ? "#ff005c" : "rgba(255,255,255,0.07)", background: selected ? "rgba(255,0,92,0.06)" : "rgba(255,255,255,0.02)", boxShadow: selected ? "0 0 18px rgba(255,0,92,0.15)" : undefined }}>
      {selected && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "#ff005c" }} />}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{ fontFamily: "Oswald, sans-serif", color: selected ? "#fff" : "rgba(255,255,255,0.75)", letterSpacing: "0.05em" }}>{gt.name}</div>
          <div className="text-xs mt-0.5 leading-tight line-clamp-2" style={{ color: "rgba(255,255,255,0.3)" }}>{gt.description}</div>
        </div>
        <button onClick={e => { e.stopPropagation(); onRules(); }} className="shrink-0 p-1 rounded" style={{ color: "rgba(255,255,255,0.25)" }} title="View rules">
          <BookOpen className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Setup Screen ───────────────────────────────────────────────────────────────
function SetupScreen({ onStart }: { onStart: (d: SetupData) => void }) {
  const { data: playersData } = useListPlayers();
  const [gameTypes, setGameTypes] = useState<GameTypeOption[]>([]);
  const [mode, setMode]           = useState<GameMode>("1v1");
  const [tab, setTab]             = useState("competitive");
  const [selectedGame, setGame]   = useState<GameTypeOption | null>(null);
  const [rulesGame, setRulesGame] = useState<GameTypeOption | null>(null);

  // 1v1
  const [p1Id, setP1Id] = useState(""); const [p2Id, setP2Id] = useState("");
  const [stake, setStake] = useState("5");

  // doubles
  const [t1a, setT1a] = useState(""); const [t1b, setT1b] = useState("");
  const [t2a, setT2a] = useState(""); const [t2b, setT2b] = useState("");
  const [dStake, setDStake] = useState("5");

  // multi-killer
  const [kIds, setKIds] = useState<string[]>(["", ""]);
  const [kLives, setKLives] = useState("3");
  const [kStake, setKStake] = useState("5");

  useEffect(() => {
    fetch("/api/game-types").then(r => r.json()).then(setGameTypes).catch(() => {});
  }, []);

  // Reset game when switching modes
  useEffect(() => { setGame(null); }, [mode]);

  const players = (playersData as Player[] | undefined)?.filter(p => p.status === "ACTIVE") ?? [];
  const byId = (id: string) => players.find(p => p.id === Number(id));

  // 1v1 derived
  const p1 = byId(p1Id), p2 = byId(p2Id);
  const maxStake1v1 = p1 && p2 ? Math.min(p1.points, p2.points) : 0;
  const stakeN = parseInt(stake) || 0;
  const err1v1 = p1 && p2 ? (stakeN < 1 ? "Min 1pt" : stakeN > maxStake1v1 ? `Max ${maxStake1v1}pts` : "") : "";
  const canStart1v1 = !!p1 && !!p2 && p1.id !== p2.id && !!selectedGame && !err1v1;

  // doubles derived
  const dp = [byId(t1a), byId(t1b), byId(t2a), byId(t2b)];
  const dAll4 = dp.every(Boolean);
  const dUnique = new Set([t1a, t1b, t2a, t2b].filter(Boolean)).size === 4;
  const dStakeN = parseInt(dStake) || 0;
  const maxDStake = dAll4 ? Math.min(...dp.map(p => p!.points)) : 0;
  const errDoubles = dAll4 && dUnique ? (dStakeN < 1 ? "Min 1pt" : dStakeN > maxDStake ? `Max ${maxDStake}pts` : "") : "";
  const canStartDoubles = dAll4 && dUnique && !!selectedGame && !errDoubles;

  // multi-killer derived
  const kPlayers = kIds.map(byId).filter((p): p is Player => !!p);
  const kUnique = new Set(kIds.filter(Boolean)).size === kIds.filter(Boolean).length;
  const kStakeN = parseInt(kStake) || 0;
  const kLivesN = Math.max(1, parseInt(kLives) || 3);
  const maxKStake = kPlayers.length >= 2 ? Math.min(...kPlayers.map(p => p.points)) : 0;
  const errKiller = kPlayers.length >= 2 && kUnique ? (kStakeN < 1 ? "Min 1pt" : kStakeN > maxKStake ? `Max ${maxKStake}pts` : "") : "";
  const canStartKiller = kPlayers.length >= 2 && kUnique && !errKiller;

  const canStart = mode === "1v1" ? canStart1v1 : mode === "doubles" ? canStartDoubles : canStartKiller;

  const handleStart = () => {
    if (mode === "1v1" && canStart1v1)
      onStart({ mode: "1v1", p1: p1!, p2: p2!, gameType: selectedGame!, stake: stakeN });
    else if (mode === "doubles" && canStartDoubles)
      onStart({ mode: "doubles", team1: [dp[0]!, dp[1]!], team2: [dp[2]!, dp[3]!], gameType: selectedGame!, stakePerPerson: dStakeN });
    else if (mode === "multi-killer" && canStartKiller)
      onStart({ mode: "multi-killer", players: kPlayers, lives: kLivesN, stake: kStakeN });
  };

  const doublesIds = [t1a, t1b, t2a, t2b].filter(Boolean);
  const DOUBLES_ENGINES = new Set(["X01", "Cricket", "HalveIt", "CountUp", "Gotcha", "Sequence"]);
  const DOUBLES_CUSTOM_KEYS = new Set(["baseball", "golf_darts", "golf_darts_18"]);
  const tabGames = gameTypes.filter(g => {
    if (!g.enabled) return false;
    if (mode !== "doubles") return g.category === tab;
    if (g.engine === "Custom") return DOUBLES_CUSTOM_KEYS.has(g.key);
    return DOUBLES_ENGINES.has(g.engine);
  });

  const stakeInput = (label: string, value: string, set: (v: string) => void, max: number, err: string, note?: string) => (
    <div className="pdc-card p-4" style={{ borderColor: err ? "rgba(255,0,92,0.3)" : "rgba(255,255,255,0.07)" }}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>{label}</h2>
        {max > 0 && <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Max: {max}pts</span>}
      </div>
      <div className="flex items-center gap-3">
        <input type="number" min={1} max={max || 999} value={value} onChange={e => set(e.target.value)}
          className="flex-1 rounded-lg px-4 py-3 text-2xl font-black text-center"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "Oswald, sans-serif" }} />
        <span className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>pts</span>
      </div>
      {err && <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: "#ff005c" }}><AlertCircle className="w-3.5 h-3.5" />{err}</div>}
      {!err && note && <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>{note}</p>}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,0,92,0.15)", border: "1px solid rgba(255,0,92,0.3)" }}>
          <Swords className="w-5 h-5" style={{ color: "#ff005c" }} />
        </div>
        <div>
          <h1 className="text-2xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>Live Scorer</h1>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>Real match — results submitted to leaderboard</p>
        </div>
      </div>
      <div className="pdc-divider" />

      {/* Mode selector */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {MODE_TABS.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            className="flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all"
            style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", cursor: "pointer",
              background: mode === m.key ? "rgba(255,0,92,0.15)" : "transparent",
              color: mode === m.key ? "#ff005c" : "rgba(255,255,255,0.3)",
              border: mode === m.key ? "1px solid rgba(255,0,92,0.3)" : "1px solid transparent" }}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* ── 1v1 players ── */}
      {mode === "1v1" && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Players</h2>
          <div className="grid grid-cols-2 gap-3">
            <PlayerSelect label="Player 1" color="#22c55e" value={p1Id} onChange={v => { setP1Id(v); if (v === p2Id) setP2Id(""); }} players={players} excludeIds={[p2Id]} />
            <PlayerSelect label="Player 2" color="#ee0a78" value={p2Id} onChange={v => { setP2Id(v); if (v === p1Id) setP1Id(""); }} players={players} excludeIds={[p1Id]} />
          </div>
        </div>
      )}

      {/* ── Doubles teams ── */}
      {mode === "doubles" && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Teams</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-xs font-black uppercase tracking-widest text-center py-1 rounded-lg" style={{ color: "#22c55e", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", fontFamily: "Oswald, sans-serif" }}>Team 1</div>
              <PlayerSelect label="Player A" color="#22c55e" value={t1a} onChange={v => { setT1a(v); if ([t1b,t2a,t2b].includes(v)) { if (v===t1b) setT1b(""); if (v===t2a) setT2a(""); if (v===t2b) setT2b(""); } }} players={players} excludeIds={[t1b,t2a,t2b]} />
              <PlayerSelect label="Player B" color="#22c55e" value={t1b} onChange={v => { setT1b(v); if ([t1a,t2a,t2b].includes(v)) { if (v===t1a) setT1a(""); if (v===t2a) setT2a(""); if (v===t2b) setT2b(""); } }} players={players} excludeIds={[t1a,t2a,t2b]} />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-black uppercase tracking-widest text-center py-1 rounded-lg" style={{ color: "#ee0a78", background: "rgba(238,10,120,0.06)", border: "1px solid rgba(238,10,120,0.2)", fontFamily: "Oswald, sans-serif" }}>Team 2</div>
              <PlayerSelect label="Player A" color="#ee0a78" value={t2a} onChange={v => { setT2a(v); if ([t1a,t1b,t2b].includes(v)) { if (v===t1a) setT1a(""); if (v===t1b) setT1b(""); if (v===t2b) setT2b(""); } }} players={players} excludeIds={[t1a,t1b,t2b]} />
              <PlayerSelect label="Player B" color="#ee0a78" value={t2b} onChange={v => { setT2b(v); if ([t1a,t1b,t2a].includes(v)) { if (v===t1a) setT1a(""); if (v===t1b) setT1b(""); if (v===t2a) setT2a(""); } }} players={players} excludeIds={[t1a,t1b,t2a]} />
            </div>
          </div>
          {!dUnique && doublesIds.length === 4 && <p className="text-xs" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>Each player must appear only once.</p>}
        </div>
      )}

      {/* ── Multi-Killer players ── */}
      {mode === "multi-killer" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Players ({kIds.length})</h2>
            <div className="flex gap-2">
              {kIds.length > 2 && <button onClick={() => setKIds(ids => ids.slice(0, -1))} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}><Minus className="w-3.5 h-3.5" /></button>}
              {kIds.length < 8 && <button onClick={() => setKIds(ids => [...ids, ""])} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.3)", color: "#ff005c", cursor: "pointer" }}><Plus className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {kIds.map((id, i) => {
              const col = ["#22c55e","#ee0a78","#3b82f6","#f59e0b","#a855f7","#06b6d4","#ef4444","#84cc16"][i];
              return (
                <PlayerSelect key={i} label={`Player ${i + 1}`} color={col}
                  value={id}
                  onChange={v => setKIds(ids => ids.map((x, j) => j === i ? v : x))}
                  players={players}
                  excludeIds={kIds.filter((_, j) => j !== i)} />
              );
            })}
          </div>
          {!kUnique && kIds.filter(Boolean).length > 1 && <p className="text-xs" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>Each player must appear only once.</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="pdc-card p-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="text-xs font-bold uppercase mb-2" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Lives each</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setKLives(v => String(Math.max(1, parseInt(v)||3 - 1)))} className="w-8 h-8 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontFamily: "Oswald, sans-serif" }}>−</button>
                <div className="flex-1 text-center text-2xl font-black" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>{kLivesN}</div>
                <button onClick={() => setKLives(v => String(Math.min(9, parseInt(v)||3 + 1)))} className="w-8 h-8 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontFamily: "Oswald, sans-serif" }}>+</button>
              </div>
            </div>
            <div className="pdc-card p-3" style={{ borderColor: errKiller ? "rgba(255,0,92,0.3)" : "rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-bold uppercase" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Stake / loss</div>
                {maxKStake > 0 && <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Max {maxKStake}</span>}
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={maxKStake || 999} value={kStake} onChange={e => setKStake(e.target.value)}
                  className="flex-1 rounded-lg px-2 py-2 text-xl font-black text-center"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "Oswald, sans-serif" }} />
                <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>pts</span>
              </div>
              {errKiller && <div className="text-xs mt-1" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>{errKiller}</div>}
            </div>
          </div>
          {!errKiller && kPlayers.length >= 2 && (
            <p className="text-xs px-1" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
              Winner collects {kStakeN}pts from each eliminated player
            </p>
          )}
        </div>
      )}

      {/* Stake (1v1 + doubles) */}
      {mode === "1v1" && stakeInput("Stake", stake, setStake, maxStake1v1, err1v1, `Winner gets +${stakeN}pts from loser`)}
      {mode === "doubles" && stakeInput("Stake per person", dStake, setDStake, maxDStake, errDoubles, `Each loser pays ${dStakeN}pts · each winner earns ${dStakeN}pts`)}

      {/* Game type (1v1 + doubles) */}
      {mode !== "multi-killer" && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
            {mode === "doubles" ? "Game Type (X01 formats)" : "Game Type"}
          </h2>
          {mode === "1v1" && (
            <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {GAME_TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all"
                  style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", cursor: "pointer",
                    background: tab === t.key ? "rgba(255,0,92,0.15)" : "transparent",
                    color: tab === t.key ? "#ff005c" : "rgba(255,255,255,0.3)",
                    border: tab === t.key ? "1px solid rgba(255,0,92,0.3)" : "1px solid transparent" }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {tabGames.length === 0
              ? <div className="col-span-2 text-center py-6 text-sm" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>No games in this category</div>
              : tabGames.map(gt => (
                  <GameCard key={gt.key} gt={gt} selected={selectedGame?.key === gt.key}
                    onSelect={() => setGame(gt)} onRules={() => setRulesGame(gt)} />
                ))
            }
          </div>
          {selectedGame && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,0,92,0.06)", border: "1px solid rgba(255,0,92,0.2)" }}>
              <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: "#ff005c" }} />
              <span className="text-xs font-bold" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>{selectedGame.name}</span>
              <button onClick={() => setRulesGame(selectedGame)} className="ml-auto" style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Start button */}
      <button onClick={handleStart} disabled={!canStart}
        className="w-full py-4 text-base font-black uppercase tracking-widest rounded-xl transition-all"
        style={{ background: canStart ? "linear-gradient(135deg, #ff005c, #cc0048)" : "rgba(255,255,255,0.04)",
          color: canStart ? "#fff" : "rgba(255,255,255,0.2)",
          border: canStart ? "none" : "1px solid rgba(255,255,255,0.06)",
          fontFamily: "Oswald, sans-serif", cursor: canStart ? "pointer" : "not-allowed",
          boxShadow: canStart ? "0 8px 32px rgba(255,0,92,0.3)" : undefined }}>
        {canStart
          ? mode === "multi-killer"
            ? `Start Killer — ${kPlayers.length} Players`
            : mode === "doubles"
            ? `Start Doubles — ${selectedGame?.name}`
            : `Start — ${selectedGame?.name}`
          : mode === "multi-killer" ? "Select 2+ players" : "Select players, game & stake"}
        {canStart && <ChevronRight className="inline ml-2 w-5 h-5" />}
      </button>

      {rulesGame && <RulesModal game={rulesGame} onClose={() => setRulesGame(null)} />}
    </div>
  );
}

// ── Game Over Screen ───────────────────────────────────────────────────────────
function GameOverScreen({ result, data, stats, onBack }: {
  result: GameResult; data: SetupData; stats: PracticeStats | null; onBack: () => void;
}) {
  const { toast }  = useToast();
  const qc         = useQueryClient();
  const { mutateAsync: submitMatch, isPending } = useSubmitMatch();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState("");
  const [autoFired, setAutoFired] = useState(false);

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
    await qc.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
    await qc.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
    await qc.invalidateQueries({ queryKey: getListMatchesQueryKey() });
  };

  const submit = async () => {
    try {
      setError("");
      if (data.mode === "1v1") {
        const winner = result.winnerIdx === 0 ? data.p1 : data.p2;
        const loser  = result.winnerIdx === 0 ? data.p2 : data.p1;
        await submitMatch({ data: { winnerId: winner.id, loserId: loser.id, stake: data.stake, gameType: data.gameType.key } });
        toast({ title: "Match recorded!", description: `${winner.name} +${data.stake}pts` });
      } else if (data.mode === "doubles") {
        const winTeam  = result.winnerIdx === 0 ? data.team1 : data.team2;
        const loseTeam = result.winnerIdx === 0 ? data.team2 : data.team1;
        await fetch("/api/team-matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            winnerIds: winTeam.map(p => p.id),
            loserIds:  loseTeam.map(p => p.id),
            stakePerPerson: data.stakePerPerson,
            gameType: data.gameType.key,
          }),
        }).then(r => { if (!r.ok) throw new Error("Submit failed"); });
        toast({ title: "Team match recorded!", description: `${winTeam.map(p => p.name).join(" & ")} win!` });
      } else if (data.mode === "multi-killer") {
        const winner = data.players[result.winnerIdx];
        const losers = data.players.filter((_, i) => i !== result.winnerIdx);
        for (const loser of losers) {
          await submitMatch({ data: { winnerId: winner.id, loserId: loser.id, stake: data.stake, gameType: "killer" } });
        }
        toast({ title: "Killer match recorded!", description: `${winner.name} wins — ${losers.length} ${losers.length === 1 ? "match" : "matches"} submitted` });
      }
      await invalidateAll();
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message ?? "Failed to submit");
      toast({ title: "Error", description: "Failed to submit match", variant: "destructive" });
    }
  };

  useEffect(() => { if (!autoFired) { setAutoFired(true); void submit(); } }, []);

  // Derived display info
  const winnerLabel = (() => {
    if (data.mode === "1v1") return result.winnerIdx === 0 ? data.p1.name : data.p2.name;
    if (data.mode === "doubles") {
      const t = result.winnerIdx === 0 ? data.team1 : data.team2;
      return `${t[0].name} & ${t[1].name}`;
    }
    return data.players[result.winnerIdx]?.name ?? "—";
  })();

  const summaryRows = (() => {
    if (data.mode === "1v1") {
      const winner = result.winnerIdx === 0 ? data.p1 : data.p2;
      const loser  = result.winnerIdx === 0 ? data.p2 : data.p1;
      return [["Game", data.gameType.name], ["Winner", winner.name], ["Loser", loser.name], ["Stake", `${data.stake}pts`]];
    }
    if (data.mode === "doubles") {
      const winT = result.winnerIdx === 0 ? data.team1 : data.team2;
      const loseT= result.winnerIdx === 0 ? data.team2 : data.team1;
      return [["Game", `Doubles ${data.gameType.name}`], ["Winners", winT.map(p => p.name).join(" & ")], ["Losers", loseT.map(p => p.name).join(" & ")], ["Stake/person", `${data.stakePerPerson}pts`]];
    }
    // multi-killer
    const winner = data.players[result.winnerIdx];
    return [["Game", "Killer"], ["Winner", winner?.name ?? "—"], ["Players", String(data.players.length)], ["Stake/loss", `${data.stake}pts`]];
  })();

  return (
    <div className="max-w-lg mx-auto space-y-6 text-center">
      <div className="pdc-divider" />
      <div>
        <Trophy className="w-16 h-16 mx-auto mb-3" style={{ color: "#ffd24a", filter: "drop-shadow(0 0 20px rgba(255,210,74,0.5))" }} />
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
          {data.mode === "doubles" ? "Winning Team" : "Winner"}
        </div>
        <div className="text-4xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#fff", letterSpacing: "0.08em", textShadow: "0 0 30px rgba(255,0,92,0.4)" }}>
          {winnerLabel}
        </div>
        {result.detail && <div className="text-sm mt-1" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>{result.detail}</div>}
      </div>

      {data.mode === "1v1" && stats && (
        <MatchStatsCard p1Name={data.p1.name} p2Name={data.p2.name} stats={stats} winnerIdx={result.winnerIdx as 0|1} accentColor="#ff005c" />
      )}

      {/* Multi-killer final standings */}
      {data.mode === "multi-killer" && (
        <div className="pdc-card p-3 text-left" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Final Standings</div>
          {[data.players[result.winnerIdx], ...data.players.filter((_, i) => i !== result.winnerIdx)].map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 py-1">
              <span className="text-xs font-black w-5 text-right" style={{ color: i === 0 ? "#ffd24a" : "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>{i + 1}</span>
              <span className="text-sm font-bold flex-1" style={{ fontFamily: "Oswald, sans-serif", color: i === 0 ? "#fff" : "rgba(255,255,255,0.4)" }}>{p.name}</span>
              {i === 0 && <span className="text-xs" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>+{data.stake * (data.players.length - 1)}pts</span>}
              {i > 0   && <span className="text-xs" style={{ color: "rgba(255,0,92,0.7)", fontFamily: "Oswald, sans-serif" }}>−{data.stake}pts</span>}
            </div>
          ))}
        </div>
      )}

      <div className="pdc-card p-4 text-left space-y-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Match Summary</div>
        {summaryRows.map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>{k}</span>
            <span style={{ color: "#fff", fontFamily: "Oswald, sans-serif" }}>{v}</span>
          </div>
        ))}
      </div>

      {isPending && <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Submitting to leaderboard…</div>}
      {submitted && (
        <div className="pdc-card p-3 text-center" style={{ borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.05)" }}>
          <div className="text-sm font-bold" style={{ color: "#22c55e", fontFamily: "Oswald, sans-serif" }}>✓ Match submitted to leaderboard</div>
        </div>
      )}
      {error && <div className="text-sm" style={{ color: "#ff005c" }}>{error}<br /><button onClick={submit} style={{ textDecoration: "underline", cursor: "pointer" }}>Retry</button></div>}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onBack} className="py-3 rounded-xl font-bold uppercase tracking-widest text-sm"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}>
          <RotateCcw className="inline w-4 h-4 mr-2" />New Match
        </button>
        <a href="/" className="py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-center block"
          style={{ background: "rgba(255,0,92,0.12)", color: "#ff005c", border: "1px solid rgba(255,0,92,0.25)", fontFamily: "Oswald, sans-serif", lineHeight: "1.5rem" }}>
          Dashboard
        </a>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Play() {
  const [phase, setPhase]         = useState<"setup" | "playing" | "gameover">("setup");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [gameResult, setResult]   = useState<GameResult | null>(null);
  const [matchStats, setStats]    = useState<PracticeStats | null>(null);

  const reset = () => { setPhase("setup"); setResult(null); setSetupData(null); setStats(null); };

  if (phase === "setup") {
    return <SetupScreen onStart={d => { setSetupData(d); setPhase("playing"); }} />;
  }

  if (phase === "playing" && setupData) {
    const header = (() => {
      if (setupData.mode === "1v1")
        return `${setupData.p1.name} vs ${setupData.p2.name} · ${setupData.gameType.name} · ${setupData.stake}pt stake`;
      if (setupData.mode === "doubles")
        return `${setupData.team1[0].name} & ${setupData.team1[1].name} vs ${setupData.team2[0].name} & ${setupData.team2[1].name} · ${setupData.gameType.name} · ${setupData.stakePerPerson}pt/person`;
      return `${setupData.players.map(p => p.name).join(", ")} · Killer · ${setupData.stake}pt stake`;
    })();

    const killerGT: GameTypeOption = setupData.mode === "multi-killer"
      ? { id: -1, key: "killer", name: "Killer", engine: "Killer", category: "competitive", description: "N-player Killer", config: JSON.stringify({ lives: setupData.lives }), enabled: true }
      : (null as any);

    return (
      <div className="max-w-lg mx-auto">
        <div className="text-xs font-bold uppercase tracking-widest mb-4 truncate" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
          {header}
        </div>
        <GameScorer
          p1Name={setupData.mode === "1v1" ? setupData.p1.name : setupData.mode === "doubles" ? setupData.team1[0].name : setupData.players[0].name}
          p2Name={setupData.mode === "1v1" ? setupData.p2.name : setupData.mode === "doubles" ? setupData.team2[0].name : setupData.players[1]?.name ?? ""}
          gameType={setupData.mode === "multi-killer" ? killerGT : setupData.gameType}
          team1={setupData.mode === "doubles" ? [setupData.team1[0].name, setupData.team1[1].name] : undefined}
          team2={setupData.mode === "doubles" ? [setupData.team2[0].name, setupData.team2[1].name] : undefined}
          allPlayers={setupData.mode === "multi-killer" ? setupData.players.map(p => p.name) : undefined}
          onWin={r => { setResult(r); setPhase("gameover"); }}
          onAbandon={reset}
          onPracticeStats={s => setStats(s)}
        />
      </div>
    );
  }

  if (phase === "gameover" && gameResult && setupData) {
    return <GameOverScreen result={gameResult} data={setupData} stats={matchStats} onBack={reset} />;
  }

  return null;
}
