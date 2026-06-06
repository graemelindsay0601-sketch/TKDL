import { useState, useEffect, useRef } from "react";
import { useListPlayers, useSubmitMatch, getGetLeaderboardQueryKey, getGetStatsSummaryQueryKey, getGetRecentActivityQueryKey, getListMatchesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Swords, Trophy, RotateCcw, ChevronRight, BookOpen, Info, Zap, AlertCircle } from "lucide-react";
import { GameScorer, type GameTypeOption, type GameResult } from "@/components/game-scorer";
import { RulesModal } from "@/components/rules-modal";

// ── Types ──────────────────────────────────────────────────────────────────────
type Player = { id: number; name: string; points: number; elo: number; status: string };
type SetupData = { p1: Player; p2: Player; gameType: GameTypeOption; stake: number };

// ── Category tabs config ────────────────────────────────────────────────────────
const TABS = [
  { key: "competitive", label: "Competitive" },
  { key: "practice",    label: "Practice"    },
  { key: "party",       label: "Party"       },
  { key: "mini-games",  label: "Mini-Games"  },
];

// ── Game type card ─────────────────────────────────────────────────────────────
function GameCard({ gt, selected, onSelect, onRules }: {
  gt: GameTypeOption; selected: boolean;
  onSelect: () => void; onRules: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="pdc-card p-3 cursor-pointer transition-all relative overflow-hidden"
      style={{
        borderColor: selected ? "#ff005c" : "rgba(255,255,255,0.07)",
        background: selected ? "rgba(255,0,92,0.06)" : "rgba(255,255,255,0.02)",
        boxShadow: selected ? "0 0 18px rgba(255,0,92,0.15)" : undefined,
      }}>
      {selected && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "#ff005c" }} />}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{ fontFamily: "Oswald, sans-serif", color: selected ? "#fff" : "rgba(255,255,255,0.75)", letterSpacing: "0.05em" }}>
            {gt.name}
          </div>
          <div className="text-xs mt-0.5 leading-tight line-clamp-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            {gt.description}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onRules(); }}
          className="shrink-0 p-1 rounded"
          style={{ color: "rgba(255,255,255,0.25)", background: "transparent" }}
          title="View rules">
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
  const [p1Id, setP1Id]           = useState("");
  const [p2Id, setP2Id]           = useState("");
  const [selectedGame, setGame]   = useState<GameTypeOption | null>(null);
  const [stake, setStake]         = useState("5");
  const [tab, setTab]             = useState("competitive");
  const [rulesGame, setRulesGame] = useState<GameTypeOption | null>(null);

  useEffect(() => {
    fetch("/api/game-types").then(r => r.json()).then(setGameTypes).catch(() => {});
  }, []);

  const players  = (playersData as Player[] | undefined)?.filter(p => p.status === "ACTIVE") ?? [];
  const p1       = players.find(p => p.id === Number(p1Id));
  const p2       = players.find(p => p.id === Number(p2Id));
  const maxStake = p1 && p2 ? Math.min(p1.points, p2.points) : 0;
  const stakeN   = parseInt(stake) || 0;
  const stakeErr = p1 && p2 ? (stakeN < 1 ? "Min stake is 1pt" : stakeN > maxStake ? `Max is ${maxStake}pts (lowest balance)` : "") : "";
  const canStart = !!p1 && !!p2 && p1.id !== p2.id && !!selectedGame && !stakeErr;

  const tabGames = gameTypes.filter(g => g.category === tab && g.enabled !== false);

  const select = (id: string, which: "p1" | "p2") => {
    if (which === "p1") { setP1Id(id); if (id === p2Id) setP2Id(""); }
    else { setP2Id(id); if (id === p1Id) setP1Id(""); }
  };

  const pSelect = (which: "p1" | "p2", val: string, other: string) => (
    <div className="pdc-card p-3" style={{ borderColor: val ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)" }}>
      <div className="text-xs font-bold uppercase mb-2" style={{ fontFamily: "Oswald, sans-serif", color: which === "p1" ? "#22c55e" : "#ee0a78", letterSpacing: "0.1em" }}>
        Player {which === "p1" ? "1" : "2"}
      </div>
      <select
        value={val}
        onChange={e => select(e.target.value, which)}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: val ? "#fff" : "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
        <option value="" style={{ color: "#111" }}>Select player…</option>
        {players.filter(p => p.id !== Number(other)).map(p => (
          <option key={p.id} value={p.id} style={{ color: "#111" }}>{p.name} ({p.points}pts)</option>
        ))}
      </select>
      {val && players.find(p => p.id === Number(val)) && (
        <div className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
          {players.find(p => p.id === Number(val))!.points}pts · ELO {players.find(p => p.id === Number(val))!.elo}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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

      {/* Players */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Players</h2>
        <div className="grid grid-cols-2 gap-3">
          {pSelect("p1", p1Id, p2Id)}
          {pSelect("p2", p2Id, p1Id)}
        </div>
      </div>

      {/* Stake */}
      <div className="pdc-card p-4" style={{ borderColor: stakeErr ? "rgba(255,0,92,0.3)" : "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Stake</h2>
          {p1 && p2 && <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Max: {maxStake}pts</span>}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number" min={1} max={maxStake || 999} value={stake}
            onChange={e => setStake(e.target.value)}
            className="flex-1 rounded-lg px-4 py-3 text-2xl font-black text-center"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "Oswald, sans-serif" }} />
          <span className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>pts</span>
        </div>
        {stakeErr && <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: "#ff005c" }}><AlertCircle className="w-3.5 h-3.5" />{stakeErr}</div>}
        {!stakeErr && p1 && p2 && (
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
            Winner gets +{stakeN}pts from loser
          </p>
        )}
      </div>

      {/* Game type selection */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Game Type</h2>
        {/* Tabs */}
        <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all"
              style={{
                fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em",
                background: tab === t.key ? "rgba(255,0,92,0.15)" : "transparent",
                color: tab === t.key ? "#ff005c" : "rgba(255,255,255,0.3)",
                border: tab === t.key ? "1px solid rgba(255,0,92,0.3)" : "1px solid transparent",
                cursor: "pointer",
              }}>
              {t.label}
            </button>
          ))}
        </div>
        {/* Game grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {tabGames.length === 0 && (
            <div className="col-span-2 text-center py-8 text-sm" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
              No games in this category
            </div>
          )}
          {tabGames.map(gt => (
            <GameCard key={gt.key} gt={gt}
              selected={selectedGame?.key === gt.key}
              onSelect={() => setGame(gt)}
              onRules={() => setRulesGame(gt)} />
          ))}
        </div>
        {selectedGame && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,0,92,0.06)", border: "1px solid rgba(255,0,92,0.2)" }}>
            <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: "#ff005c" }} />
            <span className="text-xs font-bold" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>{selectedGame.name}</span>
            <button onClick={() => setRulesGame(selectedGame)} className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Start button */}
      <button
        onClick={() => canStart && onStart({ p1: p1!, p2: p2!, gameType: selectedGame!, stake: stakeN })}
        disabled={!canStart}
        className="w-full py-4 text-base font-black uppercase tracking-widest rounded-xl transition-all"
        style={{
          background: canStart ? "linear-gradient(135deg, #ff005c, #cc0048)" : "rgba(255,255,255,0.04)",
          color: canStart ? "#fff" : "rgba(255,255,255,0.2)",
          border: canStart ? "none" : "1px solid rgba(255,255,255,0.06)",
          fontFamily: "Oswald, sans-serif",
          cursor: canStart ? "pointer" : "not-allowed",
          boxShadow: canStart ? "0 8px 32px rgba(255,0,92,0.3)" : undefined,
        }}>
        {canStart ? `Start — ${selectedGame?.name}` : "Select players, game & stake"}
        {canStart && <ChevronRight className="inline ml-2 w-5 h-5" />}
      </button>

      {rulesGame && <RulesModal game={rulesGame} onClose={() => setRulesGame(null)} />}
    </div>
  );
}

// ── Game Over Screen ───────────────────────────────────────────────────────────
function GameOverScreen({ result, data, onBack }: {
  result: GameResult; data: SetupData; onBack: () => void;
}) {
  const { toast }   = useToast();
  const qc          = useQueryClient();
  const { mutateAsync: submitMatch, isPending } = useSubmitMatch();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState("");
  const [autoFired, setAutoFired] = useState(false);

  const winner = result.winnerIdx === 0 ? data.p1 : data.p2;
  const loser  = result.winnerIdx === 0 ? data.p2 : data.p1;

  const submit = async () => {
    try {
      setError("");
      await submitMatch({
        data: {
          winnerId: winner.id, loserId: loser.id,
          stake: data.stake, gameType: data.gameType.key,
        },
      });
      await qc.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
      await qc.invalidateQueries({ queryKey: getListMatchesQueryKey() });
      setSubmitted(true);
      toast({ title: "Match recorded!", description: `${winner.name} +${data.stake}pts` });
    } catch (e: any) {
      setError(e.message ?? "Failed to submit");
      toast({ title: "Error", description: "Failed to submit match", variant: "destructive" });
    }
  };

  // Auto-submit on mount
  useEffect(() => {
    if (!autoFired) { setAutoFired(true); void submit(); }
  }, []);

  return (
    <div className="max-w-lg mx-auto space-y-6 text-center">
      <div className="pdc-divider" />
      <div>
        <Trophy className="w-16 h-16 mx-auto mb-3" style={{ color: "#ffd24a", filter: "drop-shadow(0 0 20px rgba(255,210,74,0.5))" }} />
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>Winner</div>
        <div className="text-5xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#fff", letterSpacing: "0.08em", textShadow: "0 0 30px rgba(255,0,92,0.4)" }}>
          {winner.name}
        </div>
        {result.detail && (
          <div className="text-sm mt-1" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>{result.detail}</div>
        )}
      </div>

      <div className="pdc-card p-4 text-left space-y-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Match Summary</div>
        {[
          ["Game", data.gameType.name],
          ["Winner", `${winner.name}`],
          ["Loser", `${loser.name}`],
          ["Stake", `${data.stake} pts`],
          ["Points Change", `${winner.name} +${data.stake} · ${loser.name} -${data.stake}`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>{k}</span>
            <span style={{ color: "#fff", fontFamily: "Oswald, sans-serif" }}>{v}</span>
          </div>
        ))}
      </div>

      {isPending && (
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Submitting to leaderboard…</div>
      )}
      {submitted && (
        <div className="pdc-card p-3 text-center" style={{ borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.05)" }}>
          <div className="text-sm font-bold" style={{ color: "#22c55e", fontFamily: "Oswald, sans-serif" }}>✓ Match submitted to leaderboard</div>
        </div>
      )}
      {error && <div className="text-sm" style={{ color: "#ff005c" }}>{error}<br /><button onClick={submit} style={{ textDecoration: "underline" }}>Retry</button></div>}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onBack} className="py-3 rounded-xl font-bold uppercase tracking-widest text-sm"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}>
          <RotateCcw className="inline w-4 h-4 mr-2" />New Match
        </button>
        <a href="/" className="py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-center"
          style={{ background: "rgba(255,0,92,0.12)", color: "#ff005c", border: "1px solid rgba(255,0,92,0.25)", fontFamily: "Oswald, sans-serif", display: "block", lineHeight: "1.5rem" }}>
          Dashboard
        </a>
      </div>
    </div>
  );
}

// ── Main Play Page ─────────────────────────────────────────────────────────────
export default function Play() {
  const [phase, setPhase]         = useState<"setup" | "playing" | "gameover">("setup");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [gameResult, setResult]   = useState<GameResult | null>(null);

  if (phase === "setup") {
    return <SetupScreen onStart={d => { setSetupData(d); setPhase("playing"); }} />;
  }

  if (phase === "playing" && setupData) {
    return (
      <div className="max-w-lg mx-auto">
        {/* Match header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
            {setupData.p1.name} vs {setupData.p2.name} · {setupData.gameType.name} · {setupData.stake}pt stake
          </div>
        </div>
        <GameScorer
          p1Name={setupData.p1.name}
          p2Name={setupData.p2.name}
          gameType={setupData.gameType}
          onWin={r => { setResult(r); setPhase("gameover"); }}
          onAbandon={() => setPhase("setup")}
        />
      </div>
    );
  }

  if (phase === "gameover" && gameResult && setupData) {
    return <GameOverScreen result={gameResult} data={setupData} onBack={() => { setPhase("setup"); setResult(null); setSetupData(null); }} />;
  }

  return null;
}
