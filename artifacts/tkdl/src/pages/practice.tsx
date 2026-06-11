import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useListPlayers } from "@workspace/api-client-react";
import { useCurrentPlayer } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Trophy, RotateCcw, ChevronRight, BookOpen, Info, Zap, Bot, Cpu, Users, Ghost, User } from "lucide-react";
import { GameScorer, type GameTypeOption, type GameResult, type PracticeStats } from "@/components/game-scorer";
import { RulesModal } from "@/components/rules-modal";
import { MatchStatsCard } from "@/components/match-stats-card";
import {
  BOT_PERSONAS, BOT_LEVELS, getBotConfig, numLevelConfig, numLevelLabel, numLevelColor,
  type BotPersona, type BotConfig, type ShadowProfile,
} from "@/lib/bot-engine";

type Player = { id: number; name: string; points: number; elo: number; status: string };

type SoloBotMode = "level" | "pro" | "shadow";

type ShadowProfileData = ShadowProfile & {
  locked?: false;
  playerName: string;
  primaryTarget: { seg: number; treblePct: number } | null;
  logDartsCount: number;
};
type ShadowProfileLocked = { locked: true; totalDarts: number; needed: number; playerName: string };
type ShadowProfileResult = ShadowProfileData | ShadowProfileLocked;

type SetupData = {
  p1: Player;
  p2: Player | null;
  gameType: GameTypeOption;
  solo: boolean;
  soloPlay?: boolean;
  botName?: string;
  botSubtitle?: string;
  botFlag?: string;
  botColor?: string;
  botConfig?: BotConfig;
  legs?: number;
  setsToWin?: number;
  legsToWinSet?: number;
  bullUp?: boolean;
  shadowPlayerId?: number;
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

// ── Shadow Player Picker ────────────────────────────────────────────────────────
function ShadowPlayerPicker({ players, profiles, selected, onSelect }: {
  players: Player[];
  profiles: Record<number, ShadowProfileResult>;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const NEEDED = 250;
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
      {players.length === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Loading players…</div>
      )}
      {players.map(p => {
        const prof = profiles[p.id];
        const loading = !prof;
        const locked  = !prof || (prof as ShadowProfileLocked).locked === true;
        const darts   = prof ? prof.totalDarts : 0;
        const pct     = Math.min(100, Math.round((darts / NEEDED) * 100));
        const unlocked = prof && !(prof as ShadowProfileLocked).locked;
        const data    = unlocked ? (prof as ShadowProfileData) : null;
        const isSel   = selected === p.id;
        return (
          <button key={p.id}
            onClick={() => !locked && onSelect(p.id)}
            className="w-full pdc-card p-3 text-left transition-all relative overflow-hidden"
            style={{
              borderColor: isSel ? "#a78bfa" : locked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.09)",
              background: isSel ? "rgba(167,139,250,0.1)" : locked ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.025)",
              cursor: locked ? "not-allowed" : "pointer",
              opacity: loading ? 0.4 : locked ? 0.65 : 1,
            }}>
            {isSel && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "#a78bfa" }} />}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                style={{ background: locked ? "rgba(255,255,255,0.04)" : "rgba(167,139,250,0.12)", fontFamily: "Oswald, sans-serif" }}>
                {locked ? <span style={{ fontSize: "0.9rem" }}>🔒</span> : <Ghost className="w-4 h-4" style={{ color: "#a78bfa" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: locked ? "rgba(255,255,255,0.35)" : isSel ? "#fff" : "rgba(255,255,255,0.8)" }}>
                  Shadow {p.name}
                </div>
                {locked ? (
                  loading ? (
                    <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Loading…</div>
                  ) : (
                    <div className="mt-1">
                      <div className="h-1 rounded-full overflow-hidden mb-0.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "rgba(167,139,250,0.4)" }} />
                      </div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                        {darts}/{NEEDED} darts · {NEEDED - darts} to unlock
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ fontFamily: "Oswald, sans-serif" }}>
                    {data?.primaryTarget && (
                      <span style={{ color: "#a78bfa" }}>T{data.primaryTarget.seg} · {data.primaryTarget.treblePct}% treble</span>
                    )}
                    <span style={{ color: "rgba(255,255,255,0.25)" }}>{darts} darts</span>
                  </div>
                )}
              </div>
              {data && (
                <div className="text-right shrink-0">
                  <div className="text-lg font-black leading-none" style={{ color: "#a78bfa", fontFamily: "Oswald, sans-serif" }}>
                    {Number(data.computedAvg).toFixed(0)}
                  </div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>avg</div>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Setup Screen ───────────────────────────────────────────────────────────────
function SetupScreen({ onStart }: { onStart: (d: SetupData) => void }) {
  const { data: playersData }   = useListPlayers();
  const currentPlayer           = useCurrentPlayer();
  const [gameTypes, setGameTypes] = useState<GameTypeOption[]>([]);
  const [mode, setMode]           = useState<"2p" | "bot" | "solo">("2p");
  const [botMode, setBotMode]     = useState<SoloBotMode>("level");
  const [selectedLevel, setLevel] = useState<number | null>(null);
  const [selectedPersona, setPersona] = useState<BotPersona | null>(null);
  const [selectedShadowId, setShadowId] = useState<number | null>(null);
  const [shadowProfiles, setShadowProfiles] = useState<Record<number, ShadowProfileResult>>({});
  const [p1Id, setP1Id]           = useState("");
  const [p2Id, setP2Id]           = useState("");
  const [selectedGame, setGame]   = useState<GameTypeOption | null>(null);
  const [tab, setTab]             = useState("practice");
  const [rulesGame, setRulesGame] = useState<GameTypeOption | null>(null);
  const [formatMode, setFormatMode] = useState<"legs" | "sets">("legs");
  const [selectedLegs, setSelectedLegs] = useState(1);
  const [selectedSets, setSelectedSets] = useState({ sets: 3, legsPerSet: 3 });
  const [bullUp, setBullUp]             = useState(false);
  const [gameLb, setGameLb]             = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/game-types").then(r => r.json()).then(setGameTypes).catch(() => {});
  }, []);

  useEffect(() => {
    const key = selectedGame?.key;
    if (!key) { setGameLb([]); return; }
    fetch(`/api/practice/game-leaderboard?gameTypeKey=${encodeURIComponent(key)}`)
      .then(r => r.json())
      .then(setGameLb)
      .catch(() => setGameLb([]));
  }, [selectedGame]);

  const players = (playersData as Player[] | undefined)?.filter(p => p.status === "ACTIVE") ?? [];

  useEffect(() => {
    if (players.length === 0 || p1Id) return;
    const defaultId = currentPlayer ? players.find(p => p.id === currentPlayer.playerId)?.id : null;
    if (defaultId) setP1Id(String(defaultId));
    else if (players[0]) setP1Id(String(players[0].id));
  }, [players.length]);

  const p1      = players.find(p => p.id === Number(p1Id));
  const p2      = mode === "2p" ? (players.find(p => p.id === Number(p2Id)) ?? null) : null;

  // Load shadow profiles when Player Clone tab is selected
  useEffect(() => {
    if (botMode !== "shadow" || mode !== "bot" || players.length === 0) return;
    const needed = players.filter(p => !(p.id in shadowProfiles));
    if (needed.length === 0) return;
    Promise.all(needed.map(p =>
      fetch(`/api/players/${p.id}/shadow-profile`).then(r => r.json())
        .then((d: ShadowProfileResult) => ({ id: p.id, data: d }))
        .catch(() => ({ id: p.id, data: null as unknown as ShadowProfileResult }))
    )).then(results => {
      setShadowProfiles(prev => {
        const next = { ...prev };
        for (const r of results) if (r.data) next[r.id] = r.data;
        return next;
      });
    });
  }, [botMode, mode, players.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const botReady = mode === "bot" ? (
    botMode === "level" ? selectedLevel !== null :
    botMode === "pro"   ? selectedPersona !== null :
    /* shadow */          (selectedShadowId !== null && shadowProfiles[selectedShadowId] && !(shadowProfiles[selectedShadowId] as ShadowProfileLocked).locked)
  ) : true;
  const canStart = !!p1 && !!selectedGame && (
    mode === "2p" ? (!!p2 && p1.id !== Number(p2Id)) :
    mode === "bot" ? botReady :
    true
  );

  const tabGames = gameTypes.filter(g => g.category === tab && g.enabled !== false);

  function formatProps() {
    const isX01 = selectedGame?.key?.startsWith("x01") || selectedGame?.key?.startsWith("501") || selectedGame?.key?.startsWith("301");
    if (!isX01) return {};
    if (formatMode === "sets") {
      return { legs: selectedSets.legsPerSet, setsToWin: selectedSets.sets, legsToWinSet: selectedSets.legsPerSet };
    }
    if (selectedLegs > 1) return { legs: selectedLegs };
    return {};
  }

  function buildSetupData(): SetupData {
    const fmt = formatProps();
    if (mode === "2p") return { p1: p1!, p2: p2!, gameType: selectedGame!, solo: false, bullUp, ...fmt };
    if (mode === "solo") return { p1: p1!, p2: null, gameType: selectedGame!, solo: true, soloPlay: true, ...fmt };
    if (botMode === "level" && selectedLevel !== null) {
      const color = numLevelColor(selectedLevel);
      return {
        p1: p1!, p2: null, gameType: selectedGame!, solo: true, bullUp,
        botName: `Level ${selectedLevel} Bot`,
        botSubtitle: `${numLevelLabel(selectedLevel)} · ${numLevelConfig(selectedLevel).avg} avg`,
        botFlag: undefined,
        botColor: color,
        botConfig: numLevelConfig(selectedLevel),
        ...fmt,
      };
    }
    if (botMode === "shadow" && selectedShadowId !== null) {
      const prof = shadowProfiles[selectedShadowId] as ShadowProfileData;
      const shadowPlayer = players.find(p => p.id === selectedShadowId)!;
      const sp: ShadowProfile = {
        playerId: selectedShadowId,
        playerName: shadowPlayer.name,
        totalDarts: prof.totalDarts,
        primarySeg: prof.primarySeg,
        treblePct: prof.treblePct,
        singlePct: prof.singlePct,
        checkoutSegs: prof.checkoutSegs,
        doubleHitPct: prof.doubleHitPct,
        computedAvg: prof.computedAvg,
      };
      return {
        p1: p1!, p2: null, gameType: selectedGame!, solo: true, bullUp,
        botName: `Shadow ${shadowPlayer.name}`,
        botSubtitle: `Player Clone · ${Number(prof.computedAvg).toFixed(1)} avg`,
        botFlag: "👻",
        botColor: "#a78bfa",
        botConfig: { ...getBotConfig("club"), shadowProfile: sp },
        shadowPlayerId: selectedShadowId,
        ...fmt,
      };
    }
    const persona = selectedPersona!;
    const lvl = BOT_LEVELS[persona.level];
    return {
      p1: p1!, p2: null, gameType: selectedGame!, solo: true, bullUp,
      botName: persona.name,
      botSubtitle: `${persona.nickname} · ${lvl.label} · ${persona.avg} avg`,
      botFlag: persona.flag,
      botColor: lvl.color,
      botConfig: getBotConfig(persona.level),
      ...fmt,
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
        {([
          { v: "2p"   as const, l: "2 Players",   icon: <Users className="w-4 h-4 shrink-0" /> },
          { v: "bot"  as const, l: "Solo vs CPU",  icon: <Bot  className="w-4 h-4 shrink-0" /> },
          { v: "solo" as const, l: "Solo Play",    icon: <User className="w-4 h-4 shrink-0" /> },
        ]).map(({ v, l, icon }) => (
          <button key={v} onClick={() => setMode(v)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            style={{
              fontFamily: "Oswald, sans-serif",
              background: mode === v ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.03)",
              border: mode === v ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.07)",
              color: mode === v ? "#a78bfa" : "rgba(255,255,255,0.3)",
              cursor: "pointer",
            }}>
            {icon}{l}
          </button>
        ))}
      </div>

      {/* Player selection */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
          {mode !== "2p" ? "Your Name" : "Players"}
        </h2>
        <div className={`grid gap-3 ${mode === "2p" ? "grid-cols-2" : ""}`}>
          {([["p1", p1Id, p2Id], ...(mode === "2p" ? [["p2", p2Id, p1Id]] : [])] as [string, string, string][]).map(([which, val, other]) => (
            <div key={which} className="pdc-card p-3"
              style={{ borderColor: val ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)" }}>
              <div className="text-xs font-bold uppercase mb-2" style={{
                fontFamily: "Oswald, sans-serif",
                color: which === "p1" ? "#22c55e" : "#ee0a78", letterSpacing: "0.1em",
              }}>
                {which === "p1" ? (mode !== "2p" ? "Player" : "Player 1") : "Player 2"}
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

      {/* Solo Play info */}
      {mode === "solo" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
          <User className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#a78bfa" }} />
          <div>
            <div className="text-xs font-black uppercase tracking-widest mb-0.5" style={{ fontFamily: "Oswald, sans-serif", color: "#a78bfa" }}>Solo Practice Mode</div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              No opponent. Just you and the board. Track your darts, checkout rate, and three-dart average on X01 games.
            </p>
          </div>
        </div>
      )}

      {/* CPU Opponent (Bot mode) */}
      {mode === "bot" && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
            Choose Your Opponent
          </h2>
          {/* Level Bot / Play a Pro / Player Clone tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {([
              { key: "level"  as SoloBotMode, label: "Level Bot",     icon: <Cpu   className="w-3.5 h-3.5" /> },
              { key: "pro"    as SoloBotMode, label: "Play a Pro",    icon: <Trophy className="w-3.5 h-3.5" /> },
              { key: "shadow" as SoloBotMode, label: "Player Clone",  icon: <Ghost  className="w-3.5 h-3.5" /> },
            ]).map(({ key, label, icon }) => (
              <button key={key} onClick={() => setBotMode(key)}
                className="flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1.5"
                style={{
                  fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", cursor: "pointer",
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
          ) : botMode === "pro" ? (
            <div>
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
          ) : (
            <div>
              <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                Play against a bot that mirrors how a real player actually throws — same target, same miss pattern, same preferred doubles. Unlocks at 250 combined darts.
              </p>
              <ShadowPlayerPicker
                players={players}
                profiles={shadowProfiles}
                selected={selectedShadowId}
                onSelect={setShadowId}
              />
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
        {selectedGame && gameLb.length > 0 && (
          <div className="mt-2 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="px-3 py-1.5" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald,sans-serif", fontSize: "0.6rem" }}>
                TOP PLAYERS — {selectedGame.name.toUpperCase()}
              </span>
            </div>
            {gameLb.map((row: any, i: number) => (
              <div key={row.player_id} className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: i < gameLb.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <span style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Oswald,sans-serif", fontSize: "0.65rem", width: 14, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                <span className="flex-1 text-xs font-bold truncate" style={{ fontFamily: "Oswald,sans-serif", color: "rgba(255,255,255,0.7)" }}>{row.player_name}</span>
                <span className="text-xs font-black" style={{ fontFamily: "Oswald,sans-serif", color: "#a78bfa" }}>{row.wins}W</span>
                <span className="text-xs" style={{ fontFamily: "Oswald,sans-serif", color: "rgba(255,255,255,0.3)", minWidth: 32, textAlign: "right" }}>
                  {row.games_played}G
                </span>
                {row.avg != null && (
                  <span className="text-xs" style={{ fontFamily: "Oswald,sans-serif", color: "rgba(255,255,255,0.35)", minWidth: 44, textAlign: "right" }}>
                    {row.avg} avg
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Format picker — only for X01 games */}
      {selectedGame && (selectedGame.key?.startsWith("x01") || selectedGame.key?.startsWith("501") || selectedGame.key?.startsWith("301")) && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Format</h2>
          <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {([
              { key: "legs" as const, label: "Best of Legs" },
              { key: "sets" as const, label: "Sets" },
            ]).map(({ key, label }) => (
              <button key={key} onClick={() => setFormatMode(key)}
                className="flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all"
                style={{
                  fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", cursor: "pointer",
                  background: formatMode === key ? "rgba(167,139,250,0.15)" : "transparent",
                  color: formatMode === key ? "#a78bfa" : "rgba(255,255,255,0.3)",
                  border: formatMode === key ? "1px solid rgba(167,139,250,0.3)" : "1px solid transparent",
                }}>
                {label}
              </button>
            ))}
          </div>

          {formatMode === "legs" ? (
            <div>
              <div className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                Best of how many legs?
              </div>
              <div className="flex gap-2 flex-wrap">
                {[1, 3, 5, 7, 9, 11].map(n => (
                  <button key={n} onClick={() => setSelectedLegs(n)}
                    className="px-4 py-2 rounded-lg text-sm font-black uppercase transition-all"
                    style={{
                      fontFamily: "Oswald, sans-serif", cursor: "pointer",
                      background: selectedLegs === n ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)",
                      color: selectedLegs === n ? "#a78bfa" : "rgba(255,255,255,0.4)",
                      border: selectedLegs === n ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.07)",
                    }}>
                    {n === 1 ? "Single" : `BO${n}`}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>Sets to win match</div>
                <div className="flex gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setSelectedSets(s => ({ ...s, sets: n }))}
                      className="w-10 h-10 rounded-lg text-sm font-black transition-all"
                      style={{
                        fontFamily: "Oswald, sans-serif", cursor: "pointer",
                        background: selectedSets.sets === n ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)",
                        color: selectedSets.sets === n ? "#a78bfa" : "rgba(255,255,255,0.4)",
                        border: selectedSets.sets === n ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.07)",
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>Legs per set</div>
                <div className="flex gap-1.5 flex-wrap">
                  {[3, 5, 7].map(n => (
                    <button key={n} onClick={() => setSelectedSets(s => ({ ...s, legsPerSet: n }))}
                      className="w-10 h-10 rounded-lg text-sm font-black transition-all"
                      style={{
                        fontFamily: "Oswald, sans-serif", cursor: "pointer",
                        background: selectedSets.legsPerSet === n ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)",
                        color: selectedSets.legsPerSet === n ? "#a78bfa" : "rgba(255,255,255,0.4)",
                        border: selectedSets.legsPerSet === n ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.07)",
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                  Best of {selectedSets.sets} sets · {selectedSets.legsPerSet} legs/set · First to {Math.ceil(selectedSets.sets/2)} sets
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bull Up toggle (2p / bot modes only) */}
      {mode !== "solo" && (
        <button onClick={() => setBullUp(v => !v)}
          className="w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-all"
          style={{
            background: bullUp ? "rgba(255,210,74,0.08)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${bullUp ? "rgba(255,210,74,0.35)" : "rgba(255,255,255,0.07)"}`,
            cursor: "pointer",
          }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <div className="flex-1 text-left">
            <div className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: bullUp ? "#ffd24a" : "rgba(255,255,255,0.45)" }}>
              Bull Up
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem" }}>
              Closest to bull decides who throws first
            </div>
          </div>
          <div className="w-10 h-5 rounded-full relative transition-all flex-shrink-0"
            style={{ background: bullUp ? "rgba(255,210,74,0.5)" : "rgba(255,255,255,0.1)" }}>
            <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
              style={{ background: bullUp ? "#ffd24a" : "rgba(255,255,255,0.3)", left: bullUp ? "calc(100% - 18px)" : "2px" }} />
          </div>
        </button>
      )}

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
          ? mode === "bot"
            ? botMode === "level"
              ? `Start vs Level ${selectedLevel} Bot`
              : botMode === "shadow"
              ? `Start vs Shadow ${players.find(p => p.id === selectedShadowId)?.name ?? "Clone"}`
              : `Start vs ${selectedPersona?.name ?? "Bot"}`
            : mode === "solo"
            ? `Solo Practice — ${selectedGame?.name}`
            : `Start Practice — ${selectedGame?.name}`
          : mode === "bot"
            ? botMode === "level"
              ? "Choose player, level & game"
              : botMode === "shadow"
              ? "Choose player, clone & game"
              : "Choose player, opponent & game"
            : mode === "solo"
            ? "Choose player & game"
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
      // P2 stats — present only in human-vs-human sessions
      if (stats.p2Darts !== undefined) {
        body.p2Darts            = stats.p2Darts;
        body.p2Score            = stats.p2Score;
        body.p2_180s            = stats.p2_180s;
        body.p2CheckoutAttempts = stats.p2CheckoutAttempts;
        body.p2CheckoutHits     = stats.p2CheckoutHits;
      }
      // Store dart logs + game-specific session data in session_data JSONB
      const sd: Record<string, unknown> = { ...stats.sessionData };
      if (stats.dartLog?.length)    sd.dartLog        = stats.dartLog;
      if (stats.p2DartLog?.length)  sd.p2DartLog      = stats.p2DartLog;
      if (data.shadowPlayerId)      sd.shadowPlayerId  = data.shadowPlayerId;
      if (Object.keys(sd).length)   body.sessionData  = sd;
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
          {data.soloPlay ? "Practice Complete!" : data.solo ? (result.winnerIdx === 0 ? "You Win!" : `${p2Label ?? "CPU"} Wins!`) : `${winner} Wins!`}
        </div>
        {result.detail && <div className="text-sm mt-1" style={{ color: "#a78bfa", fontFamily: "Oswald, sans-serif" }}>{result.detail}</div>}
      </div>

      {stats && (
        <MatchStatsCard
          p1Name={data.p1.name}
          p2Name={data.botName ?? data.p2?.name ?? "CPU"}
          stats={stats}
          winnerIdx={result.winnerIdx as 0|1}
          accentColor="#a78bfa"
        />
      )}

      <div className="pdc-card p-4 text-left space-y-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Session Summary</div>
        {([
          ["Game", data.gameType.name],
          ["Mode", !data.solo ? "2 Players" : data.soloPlay ? "Solo Play" : "Solo vs CPU"],
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
    const p2Name = setupData.botName ?? setupData.p2?.name ?? "CPU";
    return createPortal(
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#06040e",
      }}>
        <div className="ambient-blob-red" />
        <div className="ambient-blob-blue" />
        <GameScorer
          p1Name={setupData.p1.name}
          p2Name={p2Name}
          gameType={setupData.gameType}
          botConfig={setupData.botConfig}
          legs={setupData.legs}
          setsToWin={setupData.setsToWin}
          legsToWinSet={setupData.legsToWinSet}
          soloMode={setupData.soloPlay}
          bullUp={setupData.bullUp}
          onWin={r => { setResult(r); setPhase("done"); }}
          onAbandon={() => setPhase("setup")}
          onPracticeStats={s => setPracticeStats(s)}
        />
      </div>,
      document.body
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
