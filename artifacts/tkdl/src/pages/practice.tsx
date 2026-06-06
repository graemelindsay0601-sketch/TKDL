import { useState, useEffect, useRef } from "react";
import { useListPlayers } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Trophy, RotateCcw, ChevronRight, BookOpen, Info, Zap, Bot, Cpu, Users } from "lucide-react";
import { GameScorer, type GameTypeOption, type GameResult, type PracticeStats } from "@/components/game-scorer";
import { RulesModal } from "@/components/rules-modal";
import {
  BOT_PERSONAS, BOT_LEVELS, getBotConfig, numLevelConfig, numLevelLabel, numLevelColor,
  type BotPersona, type BotConfig,
} from "@/lib/bot-engine";

type Player = { id: number; name: string; points: number; elo: number; status: string };

type SoloBotMode = "level" | "pro";

type SetupData = {
  p1: Player;
  p2: Player | null;
  gameType: GameTypeOption;
  solo: boolean;
  // bot display info
  botName?: string;
  botSubtitle?: string;
  botFlag?: string;
  botColor?: string;
  botConfig?: BotConfig;
};

const TABS = [
  { key: "competitive", label: "Competitive" },
  { key: "practice",    label: "Practice"    },
  { key: "party",       label: "Party"       },
  { key: "mini-games",  label: "Mini-Games"  },
];

function GameCard({ gt, selected, onSelect, onRules }: {
  gt: GameTypeOption; selected: boolean; onSelect: () => void; onRules: () => void;
}) {
  return (
    <div onClick={onSelect} className="pdc-card p-3 cursor-pointer transition-all relative overflow-hidden"
      style={{
        borderColor: selected ? "#a78bfa" : "rgba(255,255,255,0.07)",
        background: selected ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.02)",
        boxShadow: selected ? "0 0 18px rgba(167,139,250,0.12)" : undefined,
      }}>
      {selected && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "#a78bfa" }} />}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{ fontFamily: "Oswald, sans-serif", color: selected ? "#fff" : "rgba(255,255,255,0.75)", letterSpacing: "0.05em" }}>
            {gt.name}
          </div>
          <div className="text-xs mt-0.5 leading-tight line-clamp-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            {gt.description}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onRules(); }} className="shrink-0 p-1 rounded"
          style={{ color: "rgba(255,255,255,0.25)", cursor: "pointer" }}>
          <BookOpen className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Level Bot picker (1–20) ────────────────────────────────────────────────────
function LevelBotPicker({ selected, onSelect }: {
  selected: number | null; onSelect: (n: number) => void;
}) {
  const levels = Array.from({ length: 20 }, (_, i) => i + 1);
  const hovered = selected;
  return (
    <div>
      <div className="grid grid-cols-10 gap-1.5 mb-3">
        {levels.map(n => {
          const isSelected = selected === n;
          const color = numLevelColor(n);
          return (
            <button key={n} onClick={() => onSelect(n)}
              className="aspect-square rounded-lg text-sm font-black transition-all"
              style={{
                fontFamily: "Oswald, sans-serif",
                background: isSelected ? color : `${color}18`,
                color: isSelected ? "#fff" : color,
                border: `1px solid ${isSelected ? color : `${color}44`}`,
                cursor: "pointer",
                fontSize: "0.8rem",
              }}>
              {n}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: `${numLevelColor(selected)}0e`, border: `1px solid ${numLevelColor(selected)}33` }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-xl"
            style={{ background: `${numLevelColor(selected)}22`, color: numLevelColor(selected), fontFamily: "Oswald, sans-serif" }}>
            {selected}
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm" style={{ color: numLevelColor(selected), fontFamily: "Oswald, sans-serif" }}>
              Level {selected} · {numLevelLabel(selected)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
              ~{numLevelConfig(selected).avg} avg · {Math.round(numLevelConfig(selected).checkoutPct * 100)}% checkout rate
            </div>
          </div>
          <Cpu className="w-6 h-6 shrink-0" style={{ color: numLevelColor(selected) }} />
        </div>
      )}
    </div>
  );
}

// ── Pro persona card ───────────────────────────────────────────────────────────
function PersonaCard({ persona, selected, onSelect }: {
  persona: BotPersona; selected: boolean; onSelect: () => void;
}) {
  const lvl = BOT_LEVELS[persona.level];
  return (
    <button onClick={onSelect} className="pdc-card p-3 text-left w-full transition-all relative overflow-hidden"
      style={{
        borderColor: selected ? lvl.color : "rgba(255,255,255,0.07)",
        background: selected ? `${lvl.color}14` : "rgba(255,255,255,0.02)",
        cursor: "pointer",
      }}>
      {selected && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: lvl.color }} />}
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none">{persona.flag}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: selected ? "#fff" : "rgba(255,255,255,0.85)" }}>
              {persona.name}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-md shrink-0 font-bold"
              style={{ background: `${lvl.color}22`, color: lvl.color, fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em" }}>
              {persona.nickname}
            </span>
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
            {persona.tagline}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-black leading-none" style={{ fontFamily: "Oswald, sans-serif", color: lvl.color }}>
            {persona.avg}
          </div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>avg</div>
        </div>
      </div>
    </button>
  );
}

// ── Setup Screen ───────────────────────────────────────────────────────────────
function SetupScreen({ onStart }: { onStart: (d: SetupData) => void }) {
  const { data: playersData }   = useListPlayers();
  const [gameTypes, setGameTypes] = useState<GameTypeOption[]>([]);
  const [solo, setSolo]           = useState(false);
  const [botMode, setBotMode]     = useState<SoloBotMode>("level");
  const [selectedLevel, setLevel] = useState<number | null>(null);
  const [selectedPersona, setPersona] = useState<BotPersona | null>(null);
  const [p1Id, setP1Id]           = useState("");
  const [p2Id, setP2Id]           = useState("");
  const [selectedGame, setGame]   = useState<GameTypeOption | null>(null);
  const [tab, setTab]             = useState("practice");
  const [rulesGame, setRulesGame] = useState<GameTypeOption | null>(null);

  useEffect(() => {
    fetch("/api/game-types").then(r => r.json()).then(setGameTypes).catch(() => {});
  }, []);

  const players = (playersData as Player[] | undefined)?.filter(p => p.status === "ACTIVE") ?? [];
  const p1      = players.find(p => p.id === Number(p1Id));
  const p2      = solo ? null : players.find(p => p.id === Number(p2Id));

  const botReady = solo
    ? (botMode === "level" ? selectedLevel !== null : selectedPersona !== null)
    : true;
  const canStart = !!p1 && !!selectedGame && (solo ? botReady : !!p2 && p1.id !== Number(p2Id));

  const tabGames = gameTypes.filter(g => g.category === tab && g.enabled !== false);

  function buildSetupData(): SetupData {
    if (!solo) return { p1: p1!, p2: p2!, gameType: selectedGame!, solo: false };
    if (botMode === "level" && selectedLevel !== null) {
      const color = numLevelColor(selectedLevel);
      return {
        p1: p1!, p2: null, gameType: selectedGame!, solo: true,
        botName: `Level ${selectedLevel} Bot`,
        botSubtitle: `${numLevelLabel(selectedLevel)} · ${numLevelConfig(selectedLevel).avg} avg`,
        botFlag: undefined,
        botColor: color,
        botConfig: numLevelConfig(selectedLevel),
      };
    }
    const persona = selectedPersona!;
    const lvl = BOT_LEVELS[persona.level];
    return {
      p1: p1!, p2: null, gameType: selectedGame!, solo: true,
      botName: persona.name,
      botSubtitle: `${persona.nickname} · ${lvl.label} · ${persona.avg} avg`,
      botFlag: persona.flag,
      botColor: lvl.color,
      botConfig: getBotConfig(persona.level),
    };
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)" }}>
          <Dumbbell className="w-5 h-5" style={{ color: "#a78bfa" }} />
        </div>
        <div>
          <h1 className="text-2xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>Practice</h1>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>No stakes · No leaderboard · Just reps</p>
        </div>
      </div>
      <div className="pdc-divider" />

      {/* Mode toggle */}
      <div className="flex gap-2">
        {[
          { v: false, l: "2 Players", icon: <Users className="w-4 h-4 shrink-0" /> },
          { v: true,  l: "Solo vs CPU", icon: <Bot className="w-4 h-4 shrink-0" /> },
        ].map(({ v, l, icon }) => (
          <button key={String(v)} onClick={() => setSolo(v)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            style={{
              fontFamily: "Oswald, sans-serif",
              background: solo === v ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.03)",
              border: solo === v ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.07)",
              color: solo === v ? "#a78bfa" : "rgba(255,255,255,0.3)",
              cursor: "pointer",
            }}>
            {icon}{l}
          </button>
        ))}
      </div>

      {/* Player selection */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
          {solo ? "Your Name" : "Players"}
        </h2>
        <div className={`grid gap-3 ${solo ? "" : "grid-cols-2"}`}>
          {([["p1", p1Id, p2Id], ...(solo ? [] : [["p2", p2Id, p1Id]])] as [string, string, string][]).map(([which, val, other]) => (
            <div key={which} className="pdc-card p-3"
              style={{ borderColor: val ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)" }}>
              <div className="text-xs font-bold uppercase mb-2" style={{
                fontFamily: "Oswald, sans-serif",
                color: which === "p1" ? "#22c55e" : "#ee0a78", letterSpacing: "0.1em",
              }}>
                {which === "p1" ? (solo ? "Player" : "Player 1") : "Player 2"}
              </div>
              <select value={val}
                onChange={e => {
                  const id = e.target.value;
                  if (which === "p1") { setP1Id(id); if (id === p2Id) setP2Id(""); }
                  else { setP2Id(id); if (id === p1Id) setP1Id(""); }
                }}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: val ? "#fff" : "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                <option value="" style={{ color: "#111" }}>Select…</option>
                {players.filter(p => p.id !== Number(other)).map(p => (
                  <option key={p.id} value={p.id} style={{ color: "#111" }}>{p.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* CPU Opponent (Solo mode) */}
      {solo && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
            Choose Your Opponent
          </h2>
          {/* Level Bot / Play a Pro tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {([
              { key: "level" as SoloBotMode, label: "Level Bot", icon: <Cpu className="w-3.5 h-3.5" /> },
              { key: "pro"   as SoloBotMode, label: "Play a Pro", icon: <Trophy className="w-3.5 h-3.5" /> },
            ]).map(({ key, label, icon }) => (
              <button key={key} onClick={() => setBotMode(key)}
                className="flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1.5"
                style={{
                  fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", cursor: "pointer",
                  background: botMode === key ? "rgba(167,139,250,0.15)" : "transparent",
                  color: botMode === key ? "#a78bfa" : "rgba(255,255,255,0.3)",
                  border: botMode === key ? "1px solid rgba(167,139,250,0.3)" : "1px solid transparent",
                }}>
                {icon}{label}
              </button>
            ))}
          </div>

          {botMode === "level" ? (
            <div>
              <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                Pick a difficulty from 1 (pub rookie) to 20 (world-class). Stats scale smoothly with each level.
              </p>
              <LevelBotPicker selected={selectedLevel} onSelect={setLevel} />
            </div>
          ) : (
            <div>
              {/* Tier legend */}
              <div className="flex gap-2 flex-wrap mb-3">
                {(Object.entries(BOT_LEVELS) as [string, typeof BOT_LEVELS[keyof typeof BOT_LEVELS]][])
                  .reverse()
                  .map(([key, lvl]) => (
                    <span key={key} className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: `${lvl.color}18`, color: lvl.color, fontFamily: "Oswald, sans-serif", border: `1px solid ${lvl.color}44` }}>
                      {lvl.label} · {lvl.avg}+ avg
                    </span>
                  ))}
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {BOT_PERSONAS.map(p => (
                  <PersonaCard key={p.id} persona={p}
                    selected={selectedPersona?.id === p.id}
                    onSelect={() => setPersona(p)} />
                ))}
              </div>
              {selectedPersona && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: `${BOT_LEVELS[selectedPersona.level].color}0e`, border: `1px solid ${BOT_LEVELS[selectedPersona.level].color}33` }}>
                  <span className="text-lg">{selectedPersona.flag}</span>
                  <div>
                    <span className="text-xs font-bold" style={{ color: BOT_LEVELS[selectedPersona.level].color, fontFamily: "Oswald, sans-serif" }}>
                      {selectedPersona.name}
                    </span>
                    <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                      {BOT_LEVELS[selectedPersona.level].label} · {selectedPersona.avg} avg
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Game type */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Game Type</h2>
        <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all"
              style={{
                fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", cursor: "pointer",
                background: tab === t.key ? "rgba(167,139,250,0.15)" : "transparent",
                color: tab === t.key ? "#a78bfa" : "rgba(255,255,255,0.3)",
                border: tab === t.key ? "1px solid rgba(167,139,250,0.3)" : "1px solid transparent",
              }}>
              {t.label}
            </button>
          ))}
        </div>
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
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
            <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: "#a78bfa" }} />
            <span className="text-xs font-bold" style={{ color: "#a78bfa", fontFamily: "Oswald, sans-serif" }}>{selectedGame.name}</span>
            <button onClick={() => setRulesGame(selectedGame)} className="ml-auto" style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => canStart && onStart(buildSetupData())}
        disabled={!canStart}
        className="w-full py-4 text-base font-black uppercase tracking-widest rounded-xl transition-all"
        style={{
          background: canStart ? "linear-gradient(135deg, #7c3aed, #a78bfa)" : "rgba(255,255,255,0.04)",
          color: canStart ? "#fff" : "rgba(255,255,255,0.2)",
          border: canStart ? "none" : "1px solid rgba(255,255,255,0.06)",
          fontFamily: "Oswald, sans-serif", cursor: canStart ? "pointer" : "not-allowed",
          boxShadow: canStart ? "0 8px 32px rgba(124,58,237,0.3)" : undefined,
        }}>
        {canStart
          ? solo
            ? `Start vs ${botMode === "level" ? `Level ${selectedLevel} Bot` : (selectedPersona?.name ?? "Bot")}`
            : `Start Practice — ${selectedGame?.name}`
          : solo
            ? botMode === "level"
              ? "Choose player, level & game"
              : "Choose player, opponent & game"
            : "Choose players & game"}
        {canStart && <ChevronRight className="inline ml-2 w-5 h-5" />}
      </button>

      {rulesGame && <RulesModal game={rulesGame} onClose={() => setRulesGame(null)} />}
    </div>
  );
}

// ── Practice Over Screen ───────────────────────────────────────────────────────
function PracticeOverScreen({ result, data, stats, onBack }: {
  result: GameResult; data: SetupData; stats: PracticeStats | null; onBack: () => void;
}) {
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState("");
  const startRef            = useRef(Date.now());

  useEffect(() => {
    const duration = Math.round((Date.now() - startRef.current) / 1000);
    const body: Record<string, unknown> = {
      player1Id:       data.p1.id,
      player2Id:       data.p2?.id ?? null,
      gameTypeKey:     data.gameType.key,
      gameTypeName:    data.gameType.name,
      winnerIdx:       result.winnerIdx,
      detail:          result.detail,
      durationSeconds: duration,
    };
    if (stats) {
      body.p1Darts            = stats.p1Darts;
      body.p1Score            = stats.p1Score;
      body.p1_180s            = stats.p1_180s;
      body.p1CheckoutAttempts = stats.p1CheckoutAttempts;
      body.p1CheckoutHits     = stats.p1CheckoutHits;
      if (stats.dartLog?.length) {
        body.sessionData = { dartLog: stats.dartLog };
      }
    }
    fetch("/api/practice/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(r => r.ok ? setSaved(true) : setError("Could not save session"))
      .catch(() => setError("Network error — session not saved"));
  }, []);

  const p2Label = data.botName ?? data.p2?.name ?? null;
  const winner  = result.winnerIdx === 0 ? data.p1.name : (p2Label ?? data.p1.name);
  const botColor = data.botColor ?? "#a78bfa";

  return (
    <div className="max-w-lg mx-auto space-y-6 text-center">
      <div className="pdc-divider" />
      <div>
        <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center"
          style={{ background: "rgba(167,139,250,0.15)", border: "2px solid rgba(167,139,250,0.4)" }}>
          <Trophy className="w-8 h-8" style={{ color: "#a78bfa" }} />
        </div>
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>Practice Complete</div>
        <div className="text-4xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#fff", letterSpacing: "0.08em" }}>
          {data.solo ? (result.winnerIdx === 0 ? "You Win!" : `${p2Label ?? "CPU"} Wins!`) : `${winner} Wins!`}
        </div>
        {result.detail && <div className="text-sm mt-1" style={{ color: "#a78bfa", fontFamily: "Oswald, sans-serif" }}>{result.detail}</div>}
      </div>

      <div className="pdc-card p-4 text-left space-y-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Session Summary</div>
        {([
          ["Game", data.gameType.name],
          ["Mode", data.solo ? "Solo vs CPU" : "2 Players"],
          ...(data.solo && data.botName ? [["Opponent", data.botName], ["Difficulty", data.botSubtitle ?? ""]] : []),
          ...(!data.solo && p2Label ? [["vs", p2Label]] : []),
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>{k}</span>
            <span style={{ color: "#fff", fontFamily: "Oswald, sans-serif" }}>{v}</span>
          </div>
        ))}
      </div>

      <div className="pdc-card p-3"
        style={{
          borderColor: saved ? "rgba(34,197,94,0.3)" : error ? "rgba(255,0,92,0.3)" : "rgba(255,255,255,0.07)",
          background: saved ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.02)",
        }}>
        <div className="flex items-center gap-2 justify-center text-sm"
          style={{ fontFamily: "Oswald, sans-serif", color: saved ? "#22c55e" : error ? "#ff005c" : "rgba(255,255,255,0.3)" }}>
          {saved ? "✓ Practice session saved for analytics" : error ? `⚠ ${error}` : "Saving…"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onBack} className="py-3 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}>
          <RotateCcw className="w-4 h-4" />Again
        </button>
        <a href="/" className="py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-center block"
          style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)", fontFamily: "Oswald, sans-serif", lineHeight: "1.5rem" }}>
          Dashboard
        </a>
      </div>
    </div>
  );
}

// ── Main Practice Page ─────────────────────────────────────────────────────────
export default function Practice() {
  const [phase, setPhase]             = useState<"setup" | "playing" | "done">("setup");
  const [setupData, setSetupData]     = useState<SetupData | null>(null);
  const [gameResult, setResult]       = useState<GameResult | null>(null);
  const [practiceStats, setPracticeStats] = useState<PracticeStats | null>(null);

  if (phase === "setup") {
    return <SetupScreen onStart={d => { setSetupData(d); setPhase("playing"); }} />;
  }

  if (phase === "playing" && setupData) {
    const botColor = setupData.botColor ?? "#a78bfa";
    const p2Name   = setupData.botName ?? setupData.p2?.name ?? "CPU";
    return (
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full" style={{ background: "#a78bfa" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
            PRACTICE · {setupData.gameType.name}
          </span>
        </div>
        {/* Bot info banner */}
        {setupData.solo && setupData.botName && (
          <div className="mb-3 flex items-center gap-3 px-3 py-2 rounded-lg"
            style={{ background: `${botColor}0e`, border: `1px solid ${botColor}33` }}>
            {setupData.botFlag
              ? <span className="text-xl leading-none">{setupData.botFlag}</span>
              : <Cpu className="w-5 h-5 shrink-0" style={{ color: botColor }} />}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold" style={{ color: botColor, fontFamily: "Oswald, sans-serif" }}>
                {setupData.botName}
              </div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
                {setupData.botSubtitle} · CPU auto-plays
              </div>
            </div>
          </div>
        )}
        <GameScorer
          p1Name={setupData.p1.name}
          p2Name={p2Name}
          gameType={setupData.gameType}
          botConfig={setupData.botConfig}
          onWin={r => { setResult(r); setPhase("done"); }}
          onAbandon={() => setPhase("setup")}
          onPracticeStats={s => setPracticeStats(s)}
        />
      </div>
    );
  }

  if (phase === "done" && gameResult && setupData) {
    return (
      <PracticeOverScreen
        result={gameResult}
        data={setupData}
        stats={practiceStats}
        onBack={() => { setPhase("setup"); setResult(null); setSetupData(null); setPracticeStats(null); }}
      />
    );
  }

  return null;
}
