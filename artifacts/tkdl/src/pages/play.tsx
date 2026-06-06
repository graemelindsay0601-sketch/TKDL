import { useState, useEffect, useCallback } from "react";
import { useListPlayers, useSubmitMatch, getGetLeaderboardQueryKey, getGetStatsSummaryQueryKey, getGetRecentActivityQueryKey, getListMatchesQueryKey, getGetPlayerStatsQueryKey, getGetPlayerQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Target, Swords, Trophy, ChevronRight, RotateCcw, AlertTriangle, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// ── Checkout table (remaining → suggested route) ──────────────────────────────
const CHECKOUTS: Record<number, string> = {
  170:"T20 T20 DB",167:"T20 T19 DB",164:"T20 T18 DB",161:"T20 T17 DB",
  160:"T20 T20 D20",158:"T20 T20 D19",157:"T20 T19 D20",156:"T20 T20 D18",
  155:"T20 T19 D19",154:"T20 T18 D20",153:"T20 T19 D18",152:"T20 T20 D16",
  151:"T20 T17 D20",150:"T20 T18 D18",149:"T20 T19 D16",148:"T20 T16 D20",
  147:"T20 T17 D18",146:"T20 T18 D16",145:"T20 T15 D20",144:"T20 T20 D12",
  143:"T20 T17 D16",142:"T20 T14 D20",141:"T20 T15 D18",140:"T20 T16 D16",
  139:"T20 T13 D20",138:"T20 T18 D12",137:"T20 T15 D16",136:"T20 T20 D8",
  135:"T20 T15 D15",134:"T20 T14 D16",133:"T20 T19 D8",132:"T20 T16 D12",
  131:"T20 T13 D16",130:"T20 T18 D8",129:"T19 T16 D12",128:"T18 T14 D16",
  127:"T20 T17 D8",126:"T19 T19 D6",125:"T20 T15 D10",124:"T20 T16 D8",
  123:"T19 T16 D9",122:"T18 T18 D7",121:"T20 T11 D14",120:"T20 S20 D20",
  119:"T19 T12 D13",118:"T20 S18 D20",117:"T20 S17 D20",116:"T20 S16 D20",
  115:"T19 S18 D20",114:"T20 S14 D20",113:"T19 S16 D20",112:"T20 S12 D20",
  111:"T19 S14 D20",110:"T20 S10 D20",109:"T20 S9 D20",108:"T20 S8 D20",
  107:"T19 S10 D20",106:"T20 S6 D20",105:"T20 S5 D20",104:"T18 S10 D20",
  103:"T19 S6 D20",102:"T20 S2 D20",101:"T17 S10 D20",100:"T20 D20",
  99:"T19 S2 D20",98:"T20 D19",97:"T19 D20",96:"T20 D18",95:"T19 D19",
  94:"T18 D20",93:"T19 D18",92:"T20 D16",91:"T17 D20",90:"T18 D18",
  89:"T19 D16",88:"T20 D14",87:"T17 D18",86:"T18 D16",85:"T19 D14",
  84:"T20 D12",83:"T17 D16",82:"T14 D20",81:"T19 D12",80:"T20 D10",
  79:"T13 D20",78:"T18 D12",77:"T19 D10",76:"T20 D8",75:"T17 D12",
  74:"T14 D16",73:"T19 D8",72:"T16 D12",71:"T13 D16",70:"T18 D8",
  69:"T19 D6",68:"T20 D4",67:"T17 D8",66:"T10 D18",65:"T19 D4",
  64:"T16 D8",63:"T17 D6",62:"T10 D16",61:"T15 D8",60:"S20 D20",
  59:"S19 D20",58:"S18 D20",57:"S17 D20",56:"T16 D4",55:"S15 D20",
  54:"S14 D20",53:"S13 D20",52:"S12 D20",51:"S11 D20",50:"DB",
  49:"S9 D20",48:"S8 D20",47:"S7 D20",46:"S6 D20",45:"S5 D20",
  44:"S4 D20",43:"S3 D20",42:"S10 D16",41:"S1 D20",40:"D20",
  39:"S7 D16",38:"D19",37:"S5 D16",36:"D18",35:"S3 D16",34:"D17",
  33:"S1 D16",32:"D16",31:"S7 D12",30:"D15",29:"S5 D12",28:"D14",
  27:"S3 D12",26:"D13",25:"S1 D12",24:"D12",23:"S7 D8",22:"D11",
  21:"S5 D8",20:"D10",19:"S3 D8",18:"D9",17:"S1 D8",16:"D8",
  15:"S7 D4",14:"D7",13:"S5 D4",12:"D6",11:"S3 D4",10:"D5",
  9:"S1 D4",8:"D4",7:"S3 D2",6:"D3",5:"S1 D2",4:"D2",3:"S1 D1",2:"D1",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type GameTypeOption = {
  id: number; key: string; name: string; engine: string;
  category: string; description: string; config: string | null;
};
type TurnRecord = { playerIdx: 0 | 1; scored: number; remaining: number; bust: boolean };
type Phase = "setup" | "playing" | "gameover";

// ── X01 config parser ─────────────────────────────────────────────────────────
function parseX01Config(configStr: string | null): { startingScore: number; doubleOut: boolean } {
  try { const c = JSON.parse(configStr ?? "{}"); return { startingScore: c.startingScore ?? 501, doubleOut: c.doubleOut ?? true }; }
  catch { return { startingScore: 501, doubleOut: true }; }
}

// ── Setup Screen ──────────────────────────────────────────────────────────────
function SetupScreen({
  players, gameTypes, onStart,
}: {
  players: any[];
  gameTypes: GameTypeOption[];
  onStart: (p1id: number, p2id: number, gt: GameTypeOption, stake: number) => void;
}) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [gt, setGt] = useState("");
  const [stake, setStake] = useState(5);

  const activePlayers = players.filter(p => p.isActive && p.status !== "ELIMINATED");
  const selectedGT = gameTypes.find(g => g.key === gt);
  const player1 = activePlayers.find(p => String(p.id) === p1);
  const player2 = activePlayers.find(p => String(p.id) === p2);
  const maxStake = player1 && player2 ? Math.min(player1.points ?? 0, player2.points ?? 0) : 100;
  const canStart = p1 && p2 && p1 !== p2 && gt && stake >= 1 && stake <= maxStake;

  const grouped = gameTypes.reduce<Record<string, GameTypeOption[]>>((acc, g) => {
    if (!acc[g.category]) acc[g.category] = [];
    acc[g.category].push(g);
    return acc;
  }, {});
  const catOrder = ["competitive", "practice", "party"];

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="pdc-divider" />
      <div>
        <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
          Live Scorer
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
          Score in real-time — results post to the leaderboard automatically
        </p>
      </div>

      <div className="pdc-card p-6 space-y-5" style={{ borderColor: "rgba(255,0,92,0.15)" }}>
        <div className="flex items-center gap-2 mb-2">
          <Swords className="w-4 h-4" style={{ color: "#ff005c" }} />
          <span className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
            Match Setup
          </span>
        </div>

        {/* Players */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22c55e", fontFamily: "Oswald, sans-serif" }}>Player 1</label>
            <Select value={p1} onValueChange={setP1}>
              <SelectTrigger className="h-12" style={{ background: "rgba(34,197,94,0.07)", borderColor: "rgba(34,197,94,0.25)", color: "rgba(255,255,255,0.9)" }}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {activePlayers.map(p => (
                  <SelectItem key={p.id} value={String(p.id)} disabled={String(p.id) === p2}>
                    {p.name} — {p.points}pts
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-center pb-3">
            <span className="text-xl font-black italic" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)" }}>VS</span>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>Player 2</label>
            <Select value={p2} onValueChange={setP2}>
              <SelectTrigger className="h-12" style={{ background: "rgba(255,0,92,0.07)", borderColor: "rgba(255,0,92,0.25)", color: "rgba(255,255,255,0.9)" }}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {activePlayers.map(p => (
                  <SelectItem key={p.id} value={String(p.id)} disabled={String(p.id) === p1}>
                    {p.name} — {p.points}pts
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Game type */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>Game Type</label>
          <Select value={gt} onValueChange={setGt}>
            <SelectTrigger className="h-12" style={{ background: "rgba(255,210,74,0.05)", borderColor: "rgba(255,210,74,0.2)", color: "rgba(255,255,255,0.9)" }}>
              <SelectValue placeholder="Choose a game…" />
            </SelectTrigger>
            <SelectContent>
              {catOrder.map(cat => {
                const items = grouped[cat];
                if (!items?.length) return null;
                return (
                  <div key={cat}>
                    <div className="px-2 py-1 text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {cat}
                    </div>
                    {items.map(g => <SelectItem key={g.key} value={g.key}>{g.name}</SelectItem>)}
                  </div>
                );
              })}
            </SelectContent>
          </Select>
          {selectedGT && (
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{selectedGT.description}</p>
          )}
        </div>

        {/* Stake */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
              Stake (Points)
            </label>
            {player1 && player2 && (
              <span className="text-xs font-mono" style={{ color: "rgba(255,210,74,0.5)" }}>max {maxStake}</span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 3, 5, 10, 25].map(v => (
              <button key={v} onClick={() => setStake(Math.min(v, maxStake))}
                className="py-2.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  fontFamily: "Oswald, sans-serif",
                  background: stake === v ? "rgba(255,210,74,0.18)" : "rgba(255,255,255,0.04)",
                  border: stake === v ? "1px solid rgba(255,210,74,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  color: stake === v ? "#ffd24a" : "rgba(255,255,255,0.4)",
                }}>
                {v}
              </button>
            ))}
          </div>
          {player1 && player2 && stake > 0 && (
            <div className="grid grid-cols-2 gap-3 text-sm pdc-card p-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div>
                <div style={{ color: "#22c55e", fontSize: "0.7rem" }}>Winner gains</div>
                <div className="font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e" }}>+{stake} pts</div>
              </div>
              <div>
                <div style={{ color: "#ff005c", fontSize: "0.7rem" }}>Loser loses</div>
                <div className="font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>−{stake} pts</div>
              </div>
            </div>
          )}
        </div>

        <button
          disabled={!canStart}
          onClick={() => {
            const p1obj = activePlayers.find(p => String(p.id) === p1)!;
            const p2obj = activePlayers.find(p => String(p.id) === p2)!;
            onStart(p1obj.id, p2obj.id, selectedGT!, stake);
          }}
          className="w-full h-14 text-lg font-bold uppercase tracking-widest rounded-xl transition-all"
          style={{
            fontFamily: "Oswald, sans-serif",
            background: canStart ? "#ff005c" : "rgba(255,255,255,0.06)",
            color: canStart ? "#fff" : "rgba(255,255,255,0.2)",
            border: "none",
            cursor: canStart ? "pointer" : "not-allowed",
          }}>
          Start Match <ChevronRight className="inline w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ── Numpad ────────────────────────────────────────────────────────────────────
function Numpad({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const append = (d: string) => { if (value.length >= 3) return; onChange(value + d); };
  const del = () => onChange(value.slice(0, -1));

  const btnStyle = (v: string) => ({
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Oswald, sans-serif",
    fontSize: "1.5rem",
    fontWeight: 700,
    borderRadius: "0.75rem",
    height: "3.5rem",
    cursor: "pointer",
    transition: "all 0.12s",
  });

  const keys = ["1","2","3","4","5","6","7","8","9","⌫","0","✓"];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.5rem" }}>
      {keys.map(k => (
        <button key={k}
          onClick={() => { if (k === "⌫") del(); else if (k === "✓") onSubmit(); else append(k); }}
          style={{
            ...btnStyle(k),
            ...(k === "✓" ? { background: "rgba(34,197,94,0.18)", borderColor: "rgba(34,197,94,0.4)", color: "#22c55e" } : {}),
            ...(k === "⌫" ? { color: "rgba(255,255,255,0.4)" } : {}),
          }}>
          {k}
        </button>
      ))}
    </div>
  );
}

// ── X01 Scorer ────────────────────────────────────────────────────────────────
function X01Scorer({
  p1Name, p2Name, startScore, doubleOut,
  onWin, onAbandon,
}: {
  p1Name: string; p2Name: string; startScore: number; doubleOut: boolean;
  onWin: (winnerIdx: 0 | 1, turns: TurnRecord[]) => void;
  onAbandon: () => void;
}) {
  const [scores, setScores] = useState<[number, number]>([startScore, startScore]);
  const [turn, setTurn]     = useState<0 | 1>(0);
  const [input, setInput]   = useState("");
  const [bust, setBust]     = useState(false);
  const [history, setHistory] = useState<TurnRecord[]>([]);

  const names = [p1Name, p2Name];
  const checkout = scores[turn] <= 170 ? CHECKOUTS[scores[turn]] : undefined;

  const submitScore = useCallback(() => {
    const scored = parseInt(input || "0", 10);
    if (isNaN(scored) || scored < 0 || scored > 180) { setInput(""); return; }
    const next = scores[turn] - scored;

    if (next < 0 || (doubleOut && next === 1)) {
      setBust(true);
      setInput("");
      setTimeout(() => {
        setBust(false);
        setTurn(t => t === 0 ? 1 : 0);
      }, 1000);
      setHistory(h => [...h, { playerIdx: turn, scored, remaining: scores[turn], bust: true }]);
      return;
    }

    const newScores: [number, number] = [...scores] as [number, number];
    newScores[turn] = next;
    setScores(newScores);
    setBust(false);
    const rec: TurnRecord = { playerIdx: turn, scored, remaining: next, bust: false };
    const newHistory = [...history, rec];
    setHistory(newHistory);
    setInput("");

    if (next === 0) { onWin(turn, newHistory); return; }
    setTurn(t => t === 0 ? 1 : 0);
  }, [input, scores, turn, doubleOut, history, onWin]);

  const pColor = (idx: number) => idx === 0 ? "#22c55e" : "#ff005c";
  const isActive = (idx: number) => turn === idx && !bust;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="pdc-divider" />

      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map(idx => (
          <div key={idx} className="pdc-card p-4 text-center relative overflow-hidden"
            style={{
              borderColor: isActive(idx) ? pColor(idx) : "rgba(255,255,255,0.06)",
              boxShadow: isActive(idx) ? `0 0 24px ${pColor(idx)}22` : undefined,
              transition: "all 0.2s",
            }}>
            {isActive(idx) && (
              <div className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: pColor(idx) }} />
            )}
            <div className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ fontFamily: "Oswald, sans-serif", color: pColor(idx), opacity: isActive(idx) ? 1 : 0.4 }}>
              {names[idx]}
            </div>
            <div className="font-black leading-none"
              style={{ fontFamily: "Oswald, sans-serif", fontSize: "3.5rem", color: isActive(idx) ? "#fff" : "rgba(255,255,255,0.3)" }}>
              {scores[idx]}
            </div>
            {isActive(idx) && checkout && (
              <div className="mt-1 text-xs font-mono px-2 py-0.5 rounded-full inline-block"
                style={{ background: "rgba(255,210,74,0.12)", color: "#ffd24a", border: "1px solid rgba(255,210,74,0.25)" }}>
                {checkout}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Turn indicator / bust */}
      <div className="text-center">
        {bust ? (
          <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase"
            style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
            <AlertTriangle className="w-4 h-4" /> BUST — Turn passes
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm"
            style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
            <Zap className="w-3.5 h-3.5" style={{ color: pColor(turn) }} />
            <span style={{ color: pColor(turn), fontWeight: 700 }}>{names[turn]}</span>
            <span className="uppercase tracking-wider text-xs">— enter your score</span>
          </div>
        )}
      </div>

      {/* Score input display */}
      <div className="pdc-card p-4" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="text-center mb-3">
          <div className="text-5xl font-black" style={{ fontFamily: "Oswald, sans-serif", color: input ? "#fff" : "rgba(255,255,255,0.12)", minHeight: "4rem", lineHeight: 1 }}>
            {input || "0"}
          </div>
          {input && (
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              → leaves {Math.max(0, scores[turn] - parseInt(input, 10))}
            </div>
          )}
        </div>
        <Numpad value={input} onChange={setInput} onSubmit={submitScore} />
      </div>

      {/* Recent history */}
      {history.length > 0 && (
        <div className="pdc-card p-4 space-y-1.5" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
            Recent Turns
          </div>
          {[...history].reverse().slice(0, 6).map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span style={{ color: pColor(r.playerIdx), fontFamily: "Oswald, sans-serif", fontSize: "0.75rem" }}>
                {names[r.playerIdx]}
              </span>
              <span style={{ color: r.bust ? "#ff005c" : "rgba(255,255,255,0.6)", fontFamily: "Oswald, sans-serif" }}>
                {r.bust ? `${r.scored} — BUST` : `+${r.scored}`}
              </span>
              <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                {r.bust ? r.remaining : r.remaining} left
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Abandon */}
      <button onClick={onAbandon}
        className="w-full text-xs py-2 rounded-lg uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.2)", background: "transparent", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}>
        Abandon Match
      </button>
    </div>
  );
}

// ── Manual Scorer (non-X01 games) ─────────────────────────────────────────────
function ManualScorer({
  p1Name, p2Name, gameName,
  onWin, onAbandon,
}: {
  p1Name: string; p2Name: string; gameName: string;
  onWin: (winnerIdx: 0 | 1) => void;
  onAbandon: () => void;
}) {
  const pColor = (idx: number) => idx === 0 ? "#22c55e" : "#ff005c";
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="pdc-divider" />
      <div>
        <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>Live Scorer</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{gameName}</p>
      </div>
      <div className="pdc-card p-6 text-center" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
          Play your game — declare the winner when done
        </p>
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map(idx => (
            <button key={idx} onClick={() => onWin(idx as 0 | 1)}
              className="py-8 rounded-xl font-bold uppercase text-xl transition-all"
              style={{
                fontFamily: "Oswald, sans-serif",
                background: `rgba(${idx === 0 ? "34,197,94" : "255,0,92"},0.1)`,
                border: `2px solid ${pColor(idx)}44`,
                color: pColor(idx),
                cursor: "pointer",
              }}>
              <Trophy className="w-8 h-8 mx-auto mb-2" />
              {idx === 0 ? p1Name : p2Name}
              <div className="text-xs mt-1 opacity-60">Won</div>
            </button>
          ))}
        </div>
      </div>
      <button onClick={onAbandon}
        className="w-full text-xs py-2 rounded-lg uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.2)", background: "transparent", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}>
        Abandon Match
      </button>
    </div>
  );
}

// ── Game Over Screen ──────────────────────────────────────────────────────────
function GameOverScreen({
  winnerName, loserName, winnerId, loserId, stake, gameType,
  p1Score, p2Score, turns,
  onPlayAgain, onDone,
}: {
  winnerName: string; loserName: string; winnerId: number; loserId: number;
  stake: number; gameType: string;
  p1Score?: number; p2Score?: number; turns?: TurnRecord[];
  onPlayAgain: () => void; onDone: () => void;
}) {
  const submitMutation = useSubmitMatch();
  const queryClient    = useQueryClient();
  const { toast }      = useToast();
  const [, navigate]   = useLocation();
  const [submitted, setSubmitted] = useState(false);

  const dartsThrown  = turns ? turns.filter(t => !t.bust).length * 3 : undefined;
  const avgPerVisit  = turns
    ? Math.round(turns.filter(t => !t.bust && t.playerIdx === 0 || !t.bust && t.playerIdx === 1)
        .reduce((s, r) => s + r.scored, 0) / Math.max(1, turns.filter(t => !t.bust).length))
    : undefined;

  function submit() {
    submitMutation.mutate(
      { data: { winnerId, loserId, stake, gameType } },
      {
        onSuccess: (data: any) => {
          setSubmitted(true);
          toast({ title: "Result Posted ✓", description: `${data.winnerName} def. ${data.loserName} — ±${stake} pts` });
          queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(winnerId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(loserId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(winnerId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(loserId) });
        },
        onError: (err: any) => { toast({ title: "Error", description: err.message ?? "Failed to post result", variant: "destructive" }); },
      }
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="pdc-divider" />

      {/* Winner banner */}
      <div className="pdc-card p-8 text-center relative overflow-hidden" style={{ borderColor: "rgba(255,210,74,0.3)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,210,74,0.08) 0%, transparent 70%)" }} />
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, transparent, #ffd24a, transparent)" }} />
        <Trophy className="w-12 h-12 mx-auto mb-3" style={{ color: "#ffd24a", filter: "drop-shadow(0 0 12px rgba(255,210,74,0.6))" }} />
        <div className="text-xs uppercase tracking-widest mb-1 font-bold" style={{ color: "rgba(255,210,74,0.6)", fontFamily: "Oswald, sans-serif" }}>
          Winner
        </div>
        <div className="text-5xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", textShadow: "0 0 30px rgba(255,210,74,0.4)" }}>
          {winnerName}
        </div>
        <div className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          def. {loserName}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="pdc-card p-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>Stake</div>
            <div className="font-black text-xl" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>±{stake}pts</div>
          </div>
          {turns && (
            <>
              <div className="pdc-card p-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>Turns</div>
                <div className="font-black text-xl" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>
                  {turns.length}
                </div>
              </div>
              <div className="pdc-card p-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>Avg/Visit</div>
                <div className="font-black text-xl" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>
                  {avgPerVisit ?? "—"}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Points preview */}
      <div className="pdc-card p-4 grid grid-cols-2 gap-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "#22c55e", fontFamily: "Oswald, sans-serif" }}>
            {winnerName} gains
          </div>
          <div className="text-2xl font-black" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e" }}>+{stake} pts</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
            {loserName} loses
          </div>
          <div className="text-2xl font-black" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>−{stake} pts</div>
        </div>
      </div>

      {/* Actions */}
      {!submitted ? (
        <button onClick={submit} disabled={submitMutation.isPending}
          className="w-full h-14 text-lg font-bold uppercase tracking-widest rounded-xl transition-all"
          style={{ fontFamily: "Oswald, sans-serif", background: "#ff005c", color: "#fff", border: "none", cursor: "pointer", letterSpacing: "0.1em" }}>
          {submitMutation.isPending ? "Posting…" : "Post to Leaderboard →"}
        </button>
      ) : (
        <div className="text-center py-3">
          <div className="text-sm font-bold uppercase tracking-widest" style={{ color: "#22c55e", fontFamily: "Oswald, sans-serif" }}>
            ✓ Posted to Leaderboard
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onPlayAgain}
          className="py-3 rounded-xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2"
          style={{ fontFamily: "Oswald, sans-serif", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
          <RotateCcw className="w-4 h-4" /> Play Again
        </button>
        <button onClick={onDone}
          className="py-3 rounded-xl text-sm font-bold uppercase tracking-widest"
          style={{ fontFamily: "Oswald, sans-serif", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Play() {
  const { data: players = [] } = useListPlayers();
  const [, navigate]           = useLocation();

  const [gameTypes, setGameTypes] = useState<GameTypeOption[]>([]);
  useEffect(() => {
    fetch("/api/game-types")
      .then(r => r.ok ? r.json() : [])
      .then(setGameTypes)
      .catch(() => {});
  }, []);

  // Match state
  const [phase, setPhase] = useState<Phase>("setup");
  const [p1Id, setP1Id]   = useState<number>(0);
  const [p2Id, setP2Id]   = useState<number>(0);
  const [selectedGT, setSelectedGT] = useState<GameTypeOption | null>(null);
  const [stake, setStake]   = useState(5);
  const [winnerIdx, setWinnerIdx] = useState<0 | 1 | null>(null);
  const [turns, setTurns]   = useState<TurnRecord[]>([]);

  const p1 = players.find(p => p.id === p1Id);
  const p2 = players.find(p => p.id === p2Id);
  const isX01 = selectedGT?.engine === "X01";
  const x01Config = selectedGT ? parseX01Config(selectedGT.config ?? null) : { startingScore: 501, doubleOut: true };

  function handleStart(p1id: number, p2id: number, gt: GameTypeOption, s: number) {
    setP1Id(p1id); setP2Id(p2id); setSelectedGT(gt); setStake(s);
    setWinnerIdx(null); setTurns([]);
    setPhase("playing");
  }

  function handleWin(idx: 0 | 1, history?: TurnRecord[]) {
    setWinnerIdx(idx);
    if (history) setTurns(history);
    setPhase("gameover");
  }

  function handleAbandon() { setPhase("setup"); }

  function handlePlayAgain() {
    setWinnerIdx(null); setTurns([]);
    setPhase("playing");
  }

  const winner = winnerIdx === 0 ? p1 : p2;
  const loser  = winnerIdx === 0 ? p2 : p1;

  return (
    <div>
      {phase === "setup" && (
        <SetupScreen players={players} gameTypes={gameTypes} onStart={handleStart} />
      )}
      {phase === "playing" && p1 && p2 && selectedGT && (
        isX01 ? (
          <X01Scorer
            p1Name={p1.name} p2Name={p2.name}
            startScore={x01Config.startingScore}
            doubleOut={x01Config.doubleOut}
            onWin={(idx, history) => handleWin(idx, history)}
            onAbandon={handleAbandon}
          />
        ) : (
          <ManualScorer
            p1Name={p1.name} p2Name={p2.name}
            gameName={selectedGT.name}
            onWin={idx => handleWin(idx)}
            onAbandon={handleAbandon}
          />
        )
      )}
      {phase === "gameover" && winner && loser && selectedGT && (
        <GameOverScreen
          winnerName={winner.name} loserName={loser.name}
          winnerId={winner.id} loserId={loser.id}
          stake={stake} gameType={selectedGT.name}
          turns={turns}
          onPlayAgain={handlePlayAgain}
          onDone={() => navigate("/")}
        />
      )}
    </div>
  );
}
