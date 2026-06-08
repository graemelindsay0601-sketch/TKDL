import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { createPortal } from "react-dom";
import { ArrowLeft, Trophy, Swords, ChevronRight, Crown } from "lucide-react";
import { GameScorer, type GameTypeOption } from "@/components/game-scorer";
import { BOT_LEVELS, type BotLevel } from "@/lib/bot-engine";

const TIER_COLORS: Record<number, string> = {
  1: "#94a3b8", 2: "#4ade80", 3: "#38bdf8",
  4: "#ffd24a", 5: "#ff005c", 6: "#c084fc",
};

const DIFF_COLORS: Record<string, string> = {
  amateur: "#94a3b8", club: "#4ade80", county: "#38bdf8",
  pro: "#ffd24a", elite: "#ff005c",
};

// Map tour persona level to frontend BotLevel
const PERSONA_TO_BOT_LEVEL: Record<string, BotLevel> = {
  beginner: "beginner", amateur: "amateur", club: "club",
  county: "county",     pro: "pro",         elite: "elite",
};

type Participant = {
  key: string; name: string; flag: string; level: string; avg: number; tagline: string; nickname: string;
};

type KOMatch = {
  p1Key: string; p1Name: string; p2Key: string; p2Name: string; winnerKey: string | null;
};

type KOBracket = {
  format: "knockout";
  bracketSize: number; legsPerMatch: number; setsPerMatch: number | null; legsPerSet: number | null;
  difficulty: string; participants: Participant[];
  rounds: { roundNum: number; name: string; matches: KOMatch[] }[];
  currentRound: number; status: string;
};

type PLFixture = { night: number; opponentKey: string; opponentName: string; result: "win" | "loss" | null };
type PLStanding = { key: string; name: string; flag: string; isPlayer: boolean; played: number; won: number; lost: number; points: number };
type PLBracket = {
  format: "premier_league";
  legsPerMatch: number; difficulty: string; participants: Participant[];
  fixtures: PLFixture[]; standings: PLStanding[];
  currentNight: number; phase: "group" | "final";
  finalOpponentKey: string | null; finalResult: "win" | "loss" | null; status: string;
};

type RunData = {
  id: number; player_id: number; tour_id: number; difficulty: string; status: string;
  bracket: KOBracket | PLBracket;
  tour_name: string; emoji: string; tier: number; game_type_key: string; format: string; slug: string;
  legs_per_match: number; sets_per_match: number | null; legs_per_set: number | null;
};

// ── Knockout bracket visualisation ────────────────────────────────────────────

function KOMatchCard({ match, participants, isPlayer, isActive, isFuture }: {
  match: KOMatch; participants: Participant[]; isPlayer: boolean; isActive: boolean; isFuture: boolean;
}) {
  const p1 = participants.find(p => p.key === match.p1Key);
  const p2 = participants.find(p => p.key === match.p2Key);
  const winner = participants.find(p => p.key === match.winnerKey);

  if (isFuture) {
    return (
      <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
        TBD
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden"
      style={{ border: `1px solid ${isActive ? "rgba(255,0,92,0.4)" : "rgba(255,255,255,0.07)"}`, background: isActive ? "rgba(255,0,92,0.05)" : "rgba(255,255,255,0.025)" }}>
      {[{ key: match.p1Key, name: match.p1Name, p: p1 }, { key: match.p2Key, name: match.p2Name, p: p2 }].map(({ key, name, p }, i) => {
        const isWinner = match.winnerKey === key;
        const isLoser = match.winnerKey && !isWinner;
        const isMe = key === "player";
        return (
          <div key={i} className={`px-3 py-1.5 flex items-center gap-2 ${i === 0 ? "border-b" : ""}`}
            style={{ borderColor: "rgba(255,255,255,0.06)", background: isWinner ? "rgba(34,197,94,0.07)" : undefined }}>
            <span className="text-sm shrink-0">{p?.flag ?? "🎯"}</span>
            <span className="text-xs font-bold flex-1 truncate"
              style={{
                fontFamily: "Oswald, sans-serif",
                color: isLoser ? "rgba(255,255,255,0.25)" : isMe ? "#ff005c" : "rgba(255,255,255,0.85)",
                textDecoration: isLoser ? "line-through" : undefined,
              }}>
              {isMe ? "YOU" : name}
            </span>
            {isWinner && <span className="text-xs font-black" style={{ color: "#22c55e", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem" }}>WIN</span>}
          </div>
        );
      })}
    </div>
  );
}

function KOBracketView({ bracket, onPlay }: { bracket: KOBracket; onPlay: () => void }) {
  const { rounds, currentRound, participants, status } = bracket;
  const tierColor = "#ff005c";

  return (
    <div>
      {/* Status banner */}
      {status === "eliminated" && (
        <div className="pdc-card px-4 py-3 mb-4 text-center text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.2)" }}>
          Eliminated
        </div>
      )}
      {status === "completed" && (
        <div className="pdc-card px-4 py-3 mb-4 text-center flex items-center justify-center gap-2" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <Crown className="w-4 h-4" style={{ color: "#ffd24a" }} />
          <span className="font-black uppercase tracking-widest text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e" }}>Tournament Won!</span>
        </div>
      )}

      {/* Play button for active */}
      {status === "active" && (
        <div className="mb-4">
          <button onClick={onPlay}
            className="w-full py-3 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ fontFamily: "Oswald, sans-serif", background: "#ff005c", color: "#fff", fontSize: "0.85rem", letterSpacing: "0.12em" }}>
            <Swords className="w-4 h-4" />
            Play Next Match
          </button>
        </div>
      )}

      {/* Rounds */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4" style={{ minWidth: `${rounds.length * 180}px` }}>
          {rounds.map((round, ri) => {
            const isPastRound = round.roundNum < currentRound;
            const isCurrentRound = round.roundNum === currentRound;

            return (
              <div key={round.roundNum} className="flex-1 min-w-[160px]">
                <div className="text-center mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest"
                    style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: isCurrentRound && status === "active" ? "#ff005c" : "rgba(255,255,255,0.3)" }}>
                    {round.name}
                  </span>
                </div>
                <div className="space-y-2">
                  {round.matches.map((match, mi) => {
                    const isFuture = !isPastRound && !isCurrentRound;
                    const isPlayerMatch = match.p1Key === "player" || match.p2Key === "player";
                    const isActive = isCurrentRound && isPlayerMatch && match.winnerKey === null;
                    return (
                      <KOMatchCard key={mi} match={match} participants={participants}
                        isPlayer={isPlayerMatch} isActive={isActive} isFuture={isFuture} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── PL bracket visualisation ─────────────────────────────────────────────────

function PLBracketView({ bracket, onPlay }: { bracket: PLBracket; onPlay: () => void }) {
  const { standings, fixtures, currentNight, phase, finalOpponentKey, finalResult, status, participants } = bracket;
  const finalOpp = participants.find(p => p.key === finalOpponentKey);

  return (
    <div className="space-y-4">
      {/* Status */}
      {status === "eliminated" && (
        <div className="pdc-card px-4 py-3 text-center text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.2)" }}>
          {phase === "group" ? "Eliminated — missed the final" : "Eliminated in the final"}
        </div>
      )}
      {status === "completed" && (
        <div className="pdc-card px-4 py-3 text-center flex items-center justify-center gap-2" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <Crown className="w-4 h-4" style={{ color: "#ffd24a" }} />
          <span className="font-black uppercase tracking-widest text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e" }}>Premier League Champion!</span>
        </div>
      )}

      {/* Play button */}
      {status === "active" && (
        <button onClick={onPlay}
          className="w-full py-3 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:opacity-90"
          style={{ fontFamily: "Oswald, sans-serif", background: "#ff005c", color: "#fff", fontSize: "0.85rem", letterSpacing: "0.12em" }}>
          <Swords className="w-4 h-4" />
          {phase === "final" ? `Play Final vs ${finalOpp?.name ?? "TBD"}` : `Play Night ${currentNight}`}
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Standings */}
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="font-black uppercase tracking-widest text-xs" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.5)", fontSize: "0.6rem" }}>Standings</span>
            {phase === "final" && <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", background: "rgba(255,210,74,0.15)", color: "#ffd24a" }}>FINAL</span>}
          </div>
          <div>
            {/* header row */}
            <div className="grid px-4 py-1.5 border-b" style={{ gridTemplateColumns: "auto 1fr auto auto auto auto", borderColor: "rgba(255,255,255,0.05)" }}>
              {["#","","P","W","L","Pts"].map((h, i) => (
                <span key={i} className="text-xs text-right" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", textAlign: i <= 1 ? "left" : "right" }}>{h}</span>
              ))}
            </div>
            {standings.map((s, i) => {
              const isTop2 = i < 2 && phase === "group" && currentNight > 9;
              const qual = (finalOpponentKey && (s.isPlayer || s.key === finalOpponentKey));
              return (
                <div key={s.key} className="grid px-4 py-2 border-b items-center" style={{ gridTemplateColumns: "auto 1fr auto auto auto auto", borderColor: "rgba(255,255,255,0.04)", background: s.isPlayer ? "rgba(255,0,92,0.05)" : undefined }}>
                  <span className="text-xs mr-3 font-bold" style={{ fontFamily: "Oswald, sans-serif", color: i < 2 ? "#ffd24a" : "rgba(255,255,255,0.25)", fontSize: "0.65rem" }}>{i + 1}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{s.flag}</span>
                    <span className="text-xs font-bold truncate" style={{ fontFamily: "Oswald, sans-serif", color: s.isPlayer ? "#ff005c" : "rgba(255,255,255,0.8)", fontSize: "0.7rem" }}>
                      {s.isPlayer ? "YOU" : s.name}
                    </span>
                    {qual && <span className="text-xs font-black" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: "#ffd24a" }}>▶ FINAL</span>}
                  </div>
                  {[s.played, s.won, s.lost, s.points].map((v, vi) => (
                    <span key={vi} className="text-right text-xs font-mono" style={{ color: vi === 3 ? "#ffd24a" : "rgba(255,255,255,0.45)", fontWeight: vi === 3 ? 800 : 400, fontSize: "0.65rem" }}>{v}</span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Fixtures */}
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="font-black uppercase tracking-widest text-xs" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.5)", fontSize: "0.6rem" }}>Your Fixtures</span>
          </div>
          <div>
            {fixtures.map((f, i) => {
              const isCurrent = f.night === currentNight && status === "active" && phase === "group";
              return (
                <div key={i} className="px-4 py-2.5 border-b flex items-center gap-3" style={{ borderColor: "rgba(255,255,255,0.04)", background: isCurrent ? "rgba(255,0,92,0.05)" : undefined }}>
                  <span className="text-xs font-bold w-14 shrink-0" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", fontSize: "0.62rem" }}>
                    Night {f.night}
                  </span>
                  <span className="text-sm shrink-0">{participants.find(p => p.key === f.opponentKey)?.flag ?? "🎯"}</span>
                  <span className="text-xs font-bold flex-1" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>{f.opponentName}</span>
                  {f.result && (
                    <span className="text-xs font-black" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: f.result === "win" ? "#22c55e" : "#ff005c" }}>
                      {f.result === "win" ? "WIN" : "LOSS"}
                    </span>
                  )}
                  {isCurrent && !f.result && (
                    <span className="text-xs font-black animate-pulse" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "#ff005c" }}>NOW</span>
                  )}
                </div>
              );
            })}

            {/* Final row */}
            {phase === "final" && (
              <div className="px-4 py-2.5 border-b flex items-center gap-3" style={{ borderColor: "rgba(255,255,255,0.04)", background: "rgba(255,210,74,0.04)" }}>
                <span className="text-xs font-bold w-14 shrink-0" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", fontSize: "0.62rem" }}>FINAL</span>
                <span className="text-sm shrink-0">{finalOpp?.flag ?? "🎯"}</span>
                <span className="text-xs font-bold flex-1" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>{finalOpp?.name ?? "TBD"}</span>
                {finalResult && (
                  <span className="text-xs font-black" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: finalResult === "win" ? "#22c55e" : "#ff005c" }}>
                    {finalResult === "win" ? "WIN" : "LOSS"}
                  </span>
                )}
                {!finalResult && status === "active" && (
                  <span className="text-xs font-black animate-pulse" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "#ffd24a" }}>NOW</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Result banner ─────────────────────────────────────────────────────────────

function ResultBanner({ won, eliminated, onContinue, onReturnToLobby }: {
  won: boolean; eliminated: boolean; onContinue: () => void; onReturnToLobby: () => void;
}) {
  if (!won && !eliminated) return null;
  return (
    <div className="pdc-card p-5 text-center mb-4" style={{ border: `1px solid ${won ? "rgba(34,197,94,0.3)" : "rgba(255,0,92,0.3)"}`, background: won ? "rgba(34,197,94,0.06)" : "rgba(255,0,92,0.06)" }}>
      <div className="text-3xl mb-2">{won ? "🏆" : "💔"}</div>
      <div className="font-black uppercase tracking-widest mb-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", color: won ? "#22c55e" : "#ff005c" }}>
        {won ? "You Won!" : "Eliminated"}
      </div>
      <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
        {won ? "Trophy and Gamerscore awarded." : "Better luck next time."}
      </p>
      <div className="flex gap-2 justify-center">
        <button onClick={onReturnToLobby} className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:bg-white/[0.08]"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
          Tour Lobby
        </button>
        {won && (
          <button onClick={onContinue} className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-90"
            style={{ fontFamily: "Oswald, sans-serif", background: "#ff005c", color: "#fff" }}>
            View Bracket
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TourRun() {
  const { runId } = useParams<{ runId: string }>();
  const [, navigate] = useLocation();

  const [run, setRun] = useState<RunData | null>(null);
  const [gameTypes, setGameTypes] = useState<GameTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [lastResult, setLastResult] = useState<{ won: boolean; eliminated: boolean } | null>(null);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    if (!runId) return;
    fetch(`/api/tour/runs/run/${runId}`)
      .then(r => r.json())
      .then(data => { setRun(data); setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/game-types")
      .then(r => r.json())
      .then(setGameTypes)
      .catch(() => {});
  }, [runId]);

  const getCurrentOpponent = useCallback((): Participant | null => {
    if (!run) return null;
    const b = run.bracket;
    if (b.format === "knockout") {
      const round = b.rounds[b.currentRound - 1];
      if (!round) return null;
      const playerMatch = round.matches.find(m => m.p1Key === "player" || m.p2Key === "player");
      if (!playerMatch) return null;
      const oppKey = playerMatch.p1Key === "player" ? playerMatch.p2Key : playerMatch.p1Key;
      return b.participants.find(p => p.key === oppKey) ?? null;
    } else {
      // PL
      if (b.phase === "final") {
        return b.participants.find(p => p.key === b.finalOpponentKey) ?? null;
      }
      const fixture = b.fixtures[b.currentNight - 1];
      if (!fixture) return null;
      return b.participants.find(p => p.key === fixture.opponentKey) ?? null;
    }
  }, [run]);

  async function handleMatchResult(playerWon: boolean) {
    if (!run) return;
    setScoring(false);
    setAdvancing(true);
    try {
      const res = await fetch(`/api/tour/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: run.player_id, playerWon }),
      });
      const data = await res.json();
      setRun(prev => prev ? { ...prev, bracket: data.bracket, status: data.status } : prev);
      if (data.won || data.eliminated) {
        setLastResult({ won: data.won, eliminated: data.eliminated });
      }
    } catch {
      alert("Failed to record result");
    } finally {
      setAdvancing(false);
    }
  }

  if (loading) return <div className="py-20 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Loading tournament…</div>;
  if (!run) return <div className="py-20 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Run not found.</div>;

  const bracket = run.bracket;
  const tierColor = TIER_COLORS[run.tier] ?? "#ff005c";
  const diffColor = DIFF_COLORS[run.difficulty] ?? "#94a3b8";
  const opponent = getCurrentOpponent();
  const gameType = gameTypes.find(g => g.key === run.game_type_key);

  // Render GameScorer overlay
  if (scoring && opponent && gameType) {
    const botLevel = PERSONA_TO_BOT_LEVEL[opponent.level] ?? "amateur";
    const botConfig = BOT_LEVELS[botLevel];
    const playerParticipant = bracket.participants.find(p => p.key === "player");

    return createPortal(
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#06040e" }}>
        <GameScorer
          p1Name={playerParticipant?.name ?? "You"}
          p2Name={`${opponent.flag} ${opponent.name}`}
          gameType={gameType}
          botConfig={botConfig}
          legs={run.legs_per_match}
          setsToWin={run.sets_per_match ?? undefined}
          legsToWinSet={run.legs_per_set ?? undefined}
          onWin={result => {
            const playerWon = result.winnerIdx === 0;
            handleMatchResult(playerWon);
          }}
          onAbandon={() => setScoring(false)}
        />
      </div>,
      document.body
    );
  }

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="pdc-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate("/tour")} className="p-1.5 rounded-lg transition-all hover:bg-white/[0.07]"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xl">{run.emoji}</span>
            <div>
              <div className="font-black uppercase tracking-wide" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1rem", color: "#fff" }}>
                {run.tour_name}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", background: "rgba(255,255,255,0.06)", color: diffColor }}>
                  {run.difficulty.toUpperCase()}
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.62rem" }}>
                  Tier {run.tier} · {bracket.format === "premier_league" ? "Premier League" : `${(bracket as KOBracket).bracketSize}-player Knockout`}
                </span>
              </div>
            </div>
          </div>
          {/* Status pill */}
          <div className="shrink-0">
            <span className="text-xs font-black px-2 py-1 rounded-full uppercase"
              style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.1em",
                background: run.status === "completed" ? "rgba(34,197,94,0.15)" : run.status === "eliminated" ? "rgba(255,0,92,0.15)" : "rgba(255,255,255,0.06)",
                color: run.status === "completed" ? "#22c55e" : run.status === "eliminated" ? "#ff005c" : "rgba(255,255,255,0.4)",
              }}>
              {run.status}
            </span>
          </div>
        </div>

        {/* Opponent preview */}
        {opponent && run.status === "active" && (
          <div className="rounded-lg px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,0,92,0.06)", border: "1px solid rgba(255,0,92,0.15)" }}>
            <span className="text-2xl">{opponent.flag}</span>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", color: "#fff" }}>
                {opponent.name}
              </div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.62rem" }}>{opponent.tagline}</div>
            </div>
            <div className="text-right">
              <div className="font-black" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", fontSize: "1.1rem" }}>{opponent.avg}</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.55rem" }}>avg</div>
            </div>
          </div>
        )}
      </div>

      {/* Result banner */}
      {lastResult && (
        <ResultBanner
          won={lastResult.won}
          eliminated={lastResult.eliminated}
          onContinue={() => setLastResult(null)}
          onReturnToLobby={() => navigate("/tour")}
        />
      )}

      {/* Bracket / PL view */}
      {advancing ? (
        <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Recording result…</div>
      ) : bracket.format === "knockout" ? (
        <div className="pdc-card p-4">
          <KOBracketView
            bracket={bracket as KOBracket}
            onPlay={() => {
              if (!gameType) { alert("Game type not found"); return; }
              setScoring(true);
            }}
          />
        </div>
      ) : (
        <PLBracketView
          bracket={bracket as PLBracket}
          onPlay={() => {
            if (!gameType) { alert("Game type not found"); return; }
            setScoring(true);
          }}
        />
      )}

      {/* No game type warning */}
      {!gameType && run.status === "active" && (
        <div className="pdc-card px-4 py-3 text-center text-xs" style={{ color: "#ffd24a" }}>
          ⚠ Game type "{run.game_type_key}" not found — check game types are seeded.
        </div>
      )}
    </div>
  );
}
