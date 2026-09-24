import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearch } from "wouter";
import { useListPlayers } from "@workspace/api-client-react";
import { useCurrentPlayer } from "@/context/auth";
import { useCosmeticsCatalog, resultThemeColor, checkoutEffect, scorerThemeColor as scorerThemeColorHelper } from "@/lib/cosmetics";
import { CheckoutBurst } from "@/components/CheckoutBurst";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Trophy, RotateCcw, ChevronRight, BookOpen, Info, Zap, Bot, Cpu, Users, Ghost, User, Target, Clock, X, Search, Star, ChevronDown, Sparkles, ArrowUp } from "lucide-react";
import { GameScorer, type GameTypeOption, type GameResult, type PracticeStats } from "@/components/game-scorer";
import { CustomHandicapCard, CUSTOM_HANDICAP_KEY } from "@/components/custom-handicap-picker";
import { RulesModal } from "@/components/rules-modal";
import { MatchStatsCard } from "@/components/match-stats-card";
import {
  BOT_PERSONAS, BOT_LEVELS, getBotConfig, numLevelConfig, numLevelLabel, numLevelColor,
  type BotPersona, type BotConfig, type ShadowProfile,
} from "@/lib/bot-engine";
import {
  LevelBotPicker, PersonaCard, ShadowPlayerPicker,
  type SoloBotMode, type ShadowProfileData, type ShadowProfileLocked, type ShadowProfileResult,
} from "@/components/BotPickers";
import { useWakeLock, useZoomLock, useExitGuard } from "@/lib/nativeParity";

type Player = { id: number; name: string; points: number; elo: number; status: string; isActive: boolean };

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

// Expandable, favouritable game card — click the body to select the game
// for setup, click the star to favourite it (device-local, see
// PRACTICE_REDESIGN_BUILD_PLAN.md Phase 1), click the chevron to reveal a
// bit more detail plus a link into the existing RulesModal for the full
// text. All three are separate hit targets (star/chevron stopPropagation
// so they don't also select the game).
function GameCard({ gt, selected, expanded, isFav, onSelect, onToggleExpand, onToggleFav, onRules }: {
  gt: GameTypeOption; selected: boolean; expanded: boolean; isFav: boolean;
  onSelect: () => void; onToggleExpand: () => void; onToggleFav: () => void; onRules: () => void;
}) {
  return (
    <div id={`game-card-${gt.key}`} onClick={onSelect} className="pdc-card p-3 cursor-pointer transition-all relative overflow-hidden"
      style={{
        borderColor: selected ? "#a78bfa" : "rgba(255,255,255,0.07)",
        background: selected ? "rgba(167,139,250,0.06)" : "rgba(255,255,255,0.02)",
        boxShadow: selected ? "0 0 18px rgba(167,139,250,0.12)" : undefined,
        gridColumn: expanded ? "1 / -1" : undefined,
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
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={e => { e.stopPropagation(); onToggleFav(); }} className="p-1 rounded"
            style={{ color: isFav ? "#ffd24a" : "rgba(255,255,255,0.2)", cursor: "pointer" }} title={isFav ? "Remove favourite" : "Add favourite"}>
            <Star className="w-3.5 h-3.5" fill={isFav ? "#ffd24a" : "none"} />
          </button>
          <button onClick={e => { e.stopPropagation(); onToggleExpand(); }} className="p-1 rounded"
            style={{ color: "rgba(255,255,255,0.25)", cursor: "pointer" }} title="More info">
            <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} onClick={e => e.stopPropagation()}>
          <p className="text-xs leading-relaxed mb-2.5" style={{ color: "rgba(255,255,255,0.5)" }}>{gt.description}</p>
          <button onClick={onRules} className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5"
            style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}>
            <BookOpen className="w-3.5 h-3.5" />Full rules
          </button>
        </div>
      )}
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
  const [rulesGame, setRulesGame] = useState<GameTypeOption | null>(null);
  const [formatMode, setFormatMode] = useState<"legs" | "sets">("legs");
  const [selectedLegs, setSelectedLegs] = useState(1);
  const [selectedSets, setSelectedSets] = useState({ sets: 3, legsPerSet: 3 });
  const [bullUp, setBullUp]             = useState(false);
  const [gameLb, setGameLb]             = useState<any[]>([]);

  // ── Self-play unlocks: locked "Play a Pro" personas + Preview Pass ────────
  // See SELF_PLAY_UNLOCKS_BUILD_PLAN.md. activeUnlockIds is fetched once
  // per logged-in player and updated optimistically on a successful
  // purchase — the backend is the source of truth (routes/self-play-unlocks.ts),
  // this is just avoiding a full refetch after every unlock click.
  const LOCKED_PERSONA_IDS = ["luke_harbours", "luca_scrawler"];
  const [selfPlayCatalog, setSelfPlayCatalog] = useState<Record<string, { price: number; name: string }>>({});
  const [activeUnlockIds, setActiveUnlockIds] = useState<Set<string>>(new Set());
  const [unlockingId, setUnlockingId]   = useState<string | null>(null);
  const [unlockError, setUnlockError]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/self-play-unlocks/catalog").then(r => r.json())
      .then((rows: any[]) => {
        const map: Record<string, { price: number; name: string }> = {};
        for (const row of rows) map[row.id] = { price: row.price, name: row.name };
        setSelfPlayCatalog(map);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentPlayer?.playerId) return;
    fetch(`/api/players/${currentPlayer.playerId}/self-play-unlocks`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { activeIds: [] })
      .then((d: { activeIds: string[] }) => setActiveUnlockIds(new Set(d.activeIds)))
      .catch(() => {});
  }, [currentPlayer?.playerId]);

  const hasPreviewPass = activeUnlockIds.has("persona-preview-pass");
  function isPersonaLocked(personaId: string): boolean {
    if (!LOCKED_PERSONA_IDS.includes(personaId)) return false;
    if (hasPreviewPass) return false;
    return !activeUnlockIds.has(`persona-${personaId}`);
  }
  async function unlockSelfPlay(unlockId: string) {
    if (!currentPlayer?.playerId || unlockingId) return;
    setUnlockingId(unlockId);
    setUnlockError(null);
    try {
      const res = await fetch(`/api/players/${currentPlayer.playerId}/self-play-unlocks/purchase`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlockId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setUnlockError(data.error || "Purchase failed"); return; }
      setActiveUnlockIds(prev => new Set(prev).add(unlockId));
    } catch {
      setUnlockError("Couldn't reach the server — try again in a moment.");
    } finally {
      setUnlockingId(null);
    }
  }

  // ── Game browser: search / category filter / favourites / expand ──────────
  // Replaces the old fixed 4-tab switcher — see PRACTICE_REDESIGN_BUILD_PLAN.md
  // Phase 1. Favourites are device-local (localStorage), not per-player —
  // Practice is a shared walk-up screen with no login requirement (same
  // reasoning as the no-auth practice-session routes on the backend), so a
  // per-player favourites list isn't the right shape here without knowing
  // who's about to play before they've even picked a game.
  const [gameSearch, setGameSearch]     = useState("");
  const [activeCat, setActiveCat]       = useState<string>("all");
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [expandedKey, setExpandedKey]   = useState<string | null>(null);
  const [favorites, setFavorites]       = useState<Set<string>>(new Set());
  const [showBackTop, setShowBackTop]   = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tkdl_practice_favorites");
      if (raw) setFavorites(new Set(JSON.parse(raw)));
    } catch { /* ignore — favourites are a convenience, not load-bearing */ }
  }, []);
  function toggleFavorite(key: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem("tkdl_practice_favorites", JSON.stringify([...next])); } catch {}
      return next;
    });
  }
  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 480);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Deep-link from the Coach tab's "Start This Drill" button (account.tsx) —
  // previously that link passed the drill's display title as an unused
  // `?drill=` param that this page never read, so clicking it just opened a
  // blank practice setup with no indication of what to actually do. Now the
  // drill's real instructions/target/duration ride along and are surfaced
  // here so the player can see and follow them while they pick their game.
  const search = useSearch();
  const [dismissedDrill, setDismissedDrill] = useState(false);
  const coachDrill = (() => {
    const params = new URLSearchParams(search);
    const title = params.get("drillTitle");
    if (!title) return null;
    return {
      title,
      instructions: params.get("drillInstructions") ?? "",
      target:       params.get("drillTarget") ?? "",
      duration:     params.get("drillDuration") ?? "",
    };
  })();

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

  const players = (playersData as Player[] | undefined)?.filter(p => p.isActive !== false) ?? [];

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

  const CAT_COLOR: Record<string, string> = {
    competitive: "#38bdf8",
    practice: "#a78bfa",
    party: "#ee0a78",
    "mini-games": "#ffd24a",
  };
  const enabledGames = gameTypes.filter(g => g.enabled !== false);
  const totalGames = enabledGames.length;
  const catCounts: Record<string, number> = {};
  for (const t of TABS) catCounts[t.key] = enabledGames.filter(g => g.category === t.key).length;
  const searchQ = gameSearch.trim().toLowerCase();
  const passesSearch = (g: GameTypeOption) => !searchQ || g.name.toLowerCase().includes(searchQ) || g.description.toLowerCase().includes(searchQ);
  const activeCats = activeCat === "all" ? TABS.map(t => t.key) : [activeCat];
  const visibleGames = enabledGames.filter(g => activeCats.includes(g.category) && passesSearch(g));
  const shownCount = visibleGames.length;
  const favGames = enabledGames.filter(g => favorites.has(g.key));

  function toggleCatCollapsed(cat: string) {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }
  function jumpToGame(gt: GameTypeOption) {
    setActiveCat("all"); setGameSearch("");
    setCollapsedCats(prev => { const n = new Set(prev); n.delete(gt.category); return n; });
    setExpandedKey(gt.key);
    requestAnimationFrame(() => {
      document.getElementById(`game-card-${gt.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  function surpriseMe() {
    const pool = visibleGames.length ? visibleGames : enabledGames;
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setGame(pick);
    jumpToGame(pick);
  }

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
    <>
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

      {/* Coach drill deep-link banner */}
      {coachDrill && !dismissedDrill && (
        <div className="pdc-card p-4 relative" style={{ borderColor: "rgba(0,200,160,0.3)", background: "rgba(0,200,160,0.05)" }}>
          <button onClick={() => setDismissedDrill(true)} className="absolute top-3 right-3 opacity-50 hover:opacity-100" style={{ color: "#00c8a0" }}>
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-1.5 pr-6">
            <Dumbbell className="w-4 h-4" style={{ color: "#00c8a0" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#00c8a0" }}>
              Coach Drill: {coachDrill.title}
            </span>
          </div>
          {coachDrill.instructions && (
            <p className="text-sm mb-1.5" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{coachDrill.instructions}</p>
          )}
          <div className="flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            {coachDrill.target && (
              <span className="flex items-center gap-1.5"><Target className="w-3 h-3" style={{ color: "#00c8a0" }} />{coachDrill.target}</span>
            )}
            {coachDrill.duration && (
              <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{coachDrill.duration}</span>
            )}
          </div>
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            Set up a game below to run through it, then use "Log Completion" back on your Coach tab to track your progress.
          </p>
        </div>
      )}

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
              {!hasPreviewPass && LOCKED_PERSONA_IDS.some(isPersonaLocked) && (
                <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)" }}>
                  <div>
                    <div className="text-xs font-bold" style={{ color: "#a78bfa", fontFamily: "Oswald, sans-serif" }}>
                      Preview Pass
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
                      {selfPlayCatalog["persona-preview-pass"]?.price ?? 120} coins · every locked persona for 7 days
                    </div>
                  </div>
                  <button
                    onClick={() => unlockSelfPlay("persona-preview-pass")}
                    disabled={unlockingId === "persona-preview-pass"}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0"
                    style={{
                      fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em",
                      background: "rgba(167,139,250,0.18)", color: "#a78bfa",
                      border: "1px solid rgba(167,139,250,0.35)",
                      cursor: unlockingId === "persona-preview-pass" ? "wait" : "pointer",
                      opacity: unlockingId === "persona-preview-pass" ? 0.6 : 1,
                    }}>
                    {unlockingId === "persona-preview-pass" ? "…" : "Get Pass"}
                  </button>
                </div>
              )}
              {unlockError && (
                <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ color: "#ff6b8a", background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.2)", fontFamily: "Oswald, sans-serif" }}>
                  {unlockError}
                </div>
              )}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {BOT_PERSONAS.map(p => {
                  const locked = isPersonaLocked(p.id);
                  const unlockId = `persona-${p.id}`;
                  return (
                    <PersonaCard key={p.id} persona={p}
                      selected={selectedPersona?.id === p.id}
                      onSelect={() => setPersona(p)}
                      locked={locked}
                      price={selfPlayCatalog[unlockId]?.price}
                      unlocking={unlockingId === unlockId}
                      onUnlock={() => unlockSelfPlay(unlockId)} />
                  );
                })}
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

      {/* Game type — search + category filter + collapsible sections,
         replacing the old fixed 4-tab switcher. See
         PRACTICE_REDESIGN_BUILD_PLAN.md Phase 1 for the reasoning: the old
         layout hid 3 of 4 categories behind tabs and still needed a scroll
         box for whichever tab was open, on top of the *page's* own scroll —
         a "scroll fest" with no way to jump around. This flattens all
         enabled games into one filterable, browsable list. */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Game Type</h2>

        {/* Custom / Handicap — lets Player 1 and Player 2 (or Player 1 vs a
           bot) start on independently typed scores (e.g. 501 v 301). Pinned
           above the browser, always visible regardless of search/filters. */}
        <div className="mb-3">
          <CustomHandicapCard
            accent="#a78bfa"
            selected={selectedGame?.key === CUSTOM_HANDICAP_KEY}
            onSelect={gt => { setGame(gt); setExpandedKey(null); }}
            onClear={() => setGame(g => (g?.key === CUSTOM_HANDICAP_KEY ? null : g))}
          />
        </div>

        {/* Sticky search + surprise-me + category quick-nav */}
        <div className="sticky top-2 z-20 mb-3 rounded-xl p-2.5" style={{ background: "rgba(10,7,16,0.92)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(14px)" }}>
          <div className="flex gap-2 mb-2.5">
            <div className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Search className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
              <input
                value={gameSearch}
                onChange={e => setGameSearch(e.target.value)}
                placeholder={`Search ${totalGames} games…`}
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: "#fff", fontFamily: "Oswald, sans-serif" }}
              />
            </div>
            <button onClick={surpriseMe} className="shrink-0 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1.5"
              style={{ background: "linear-gradient(120deg,#ffe19a,#ffd24a)", color: "#2a1600", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}>
              <Sparkles className="w-3.5 h-3.5" />Surprise
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setActiveCat("all")}
              className="text-xs font-bold px-3 py-1.5 rounded-full transition-all"
              style={{
                fontFamily: "Oswald, sans-serif", cursor: "pointer",
                background: activeCat === "all" ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
                color: activeCat === "all" ? "#a78bfa" : "rgba(255,255,255,0.4)",
                border: activeCat === "all" ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.08)",
              }}>
              All <span style={{ opacity: 0.6 }}>{totalGames}</span>
            </button>
            {TABS.map(t => {
              const c = CAT_COLOR[t.key] ?? "#a78bfa";
              const on = activeCat === t.key;
              return (
                <button key={t.key} onClick={() => setActiveCat(t.key)}
                  className="text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                  style={{
                    fontFamily: "Oswald, sans-serif", cursor: "pointer",
                    background: on ? `${c}22` : "rgba(255,255,255,0.04)",
                    color: on ? c : "rgba(255,255,255,0.4)",
                    border: on ? `1px solid ${c}66` : "1px solid rgba(255,255,255,0.08)",
                  }}>
                  {t.label} <span style={{ opacity: 0.6 }}>{catCounts[t.key] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Favourites quick row — device-local, only shown once something's starred */}
        {favGames.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {favGames.map(g => (
              <button key={g.key} onClick={() => jumpToGame(g)}
                className="text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5"
                style={{ background: "rgba(255,210,74,0.1)", border: "1px solid rgba(255,210,74,0.3)", color: "#ffd24a", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}>
                <Star className="w-3 h-3" fill="#ffd24a" />{g.name}
              </button>
            ))}
          </div>
        )}

        <div className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
          {(activeCat === "all" && !searchQ) ? `${totalGames} games` : `${shownCount} match${shownCount === 1 ? "" : "es"}`}
        </div>

        {shownCount === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
            No games match — try a different search or category.
          </div>
        ) : (
          activeCats.map(catKey => {
            const catGames = visibleGames.filter(g => g.category === catKey);
            if (!catGames.length) return null;
            const c = CAT_COLOR[catKey] ?? "#a78bfa";
            const label = TABS.find(t => t.key === catKey)?.label ?? catKey;
            const collapsed = collapsedCats.has(catKey);
            return (
              <div key={catKey} className="mb-3">
                <button onClick={() => toggleCatCollapsed(catKey)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg mb-2"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                  <span className="text-xs font-black uppercase tracking-wider flex-1 text-left" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>{label}</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>{catGames.length}</span>
                  <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ color: "rgba(255,255,255,0.3)", transform: collapsed ? "rotate(-90deg)" : "none" }} />
                </button>
                {!collapsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {catGames.map(gt => (
                      <GameCard key={gt.key} gt={gt}
                        selected={selectedGame?.key === gt.key}
                        expanded={expandedKey === gt.key}
                        isFav={favorites.has(gt.key)}
                        onSelect={() => setGame(gt)}
                        onToggleExpand={() => setExpandedKey(k => k === gt.key ? null : gt.key)}
                        onToggleFav={() => toggleFavorite(gt.key)}
                        onRules={() => setRulesGame(gt)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
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
        onClick={() => {
          if (!canStart) return;
          // Defensive: clear any card-clash session flags left over from the
          // Card Clash tab, since Practice never sets these itself.
          clearCardClashSession();
          onStart(buildSetupData());
        }}
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
    {showBackTop && (
      <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-24 right-5 z-30 w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: "rgba(20,14,32,0.92)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", cursor: "pointer", boxShadow: "0 10px 28px -10px rgba(0,0,0,0.6)" }}
        title="Back to top">
        <ArrowUp className="w-4 h-4" />
      </button>
    )}
    </>
  );
}

// ── Practice Over Screen ───────────────────────────────────────────────────────
function PracticeOverScreen({ result, data, stats, onBack }: {
  result: GameResult; data: SetupData; stats: PracticeStats | null; onBack: () => void;
}) {
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState("");
  const startRef            = useRef(Date.now());

  // RESULT_THEME cosmetic — an accent colour for the logged-in viewer's own
  // result screen, independent of which slot (p1/p2) they played as. Falls
  // back to the existing hardcoded purple below when nothing's equipped or
  // no one's logged in (e.g. a shared-device solo session).
  const currentPlayer = useCurrentPlayer();
  const cosmeticsCatalog = useCosmeticsCatalog();
  const [equippedThemeId, setEquippedThemeId] = useState<string | null>(null);
  const [equippedEffectId, setEquippedEffectId] = useState<string | null>(null);
  useEffect(() => {
    if (!currentPlayer?.playerId) return;
    fetch(`/api/players/${currentPlayer.playerId}/cosmetics`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        setEquippedThemeId(data?.equippedResultThemeId ?? null);
        setEquippedEffectId(data?.equippedCheckoutEffectId ?? null);
      })
      .catch(() => {});
  }, [currentPlayer?.playerId]);
  const themeColor = resultThemeColor(cosmeticsCatalog.find(c => c.id === equippedThemeId), "#a78bfa");

  // CHECKOUT_EFFECT cosmetic — only plays for the logged-in viewer, and only
  // when they were the one who won (comparing currentPlayer against
  // whichever side result.winnerIdx names), same reasoning as RESULT_THEME
  // being Practice-only: this screen has a neutral decorative surface to
  // add an effect to, Master501/Tour's win/loss-semantic screens don't.
  const winnerId = result.winnerIdx === 0 ? data.p1.id : data.p2?.id;
  const viewerWon = !!currentPlayer?.playerId && currentPlayer.playerId === winnerId;
  const burstEffect = viewerWon ? checkoutEffect(cosmeticsCatalog.find(c => c.id === equippedEffectId)) : null;

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
        <div className="relative w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center"
          style={{ background: `${themeColor}26`, border: `2px solid ${themeColor}66` }}>
          <Trophy className="w-8 h-8" style={{ color: themeColor }} />
          {burstEffect && <CheckoutBurst emoji={burstEffect.emoji} color={burstEffect.color} />}
        </div>
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>Practice Complete</div>
        <div className="text-4xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#fff", letterSpacing: "0.08em" }}>
          {data.soloPlay ? "Practice Complete!" : data.solo ? (result.winnerIdx === 0 ? "You Win!" : `${p2Label ?? "CPU"} Wins!`) : `${winner} Wins!`}
        </div>
        {result.detail && <div className="text-sm mt-1" style={{ color: themeColor, fontFamily: "Oswald, sans-serif" }}>{result.detail}</div>}
      </div>

      {stats && (
        <MatchStatsCard
          p1Name={data.p1.name}
          p2Name={data.botName ?? data.p2?.name ?? "CPU"}
          stats={stats}
          winnerIdx={result.winnerIdx as 0|1}
          accentColor={themeColor}
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
          style={{ background: `${themeColor}1f`, color: themeColor, border: `1px solid ${themeColor}40`, fontFamily: "Oswald, sans-serif", lineHeight: "1.5rem" }}>
          Dashboard
        </a>
      </div>
    </div>
  );
}

// ── Main Practice Page ─────────────────────────────────────────────────────────
function clearCardClashSession() {
  sessionStorage.removeItem("card_clash_mode");
  sessionStorage.removeItem("card_clash_chaos_mode");
  sessionStorage.removeItem("card_clash_p1_cards");
  sessionStorage.removeItem("card_clash_p2_cards");
}

export default function Practice() {
  const [phase, setPhase]             = useState<"setup" | "playing" | "done">("setup");
  const [setupData, setSetupData]     = useState<SetupData | null>(null);
  const [gameResult, setResult]       = useState<GameResult | null>(null);
  const [practiceStats, setPracticeStats] = useState<PracticeStats | null>(null);

  // Native-app parity: keep the screen awake, stop pinch-zoom, and trap the
  // back button/swipe behind a confirmation for as long as a session is live
  // — see src/lib/nativeParity.ts.
  const isLive = phase === "playing";
  useWakeLock(isLive);
  useZoomLock(isLive);
  useExitGuard(isLive, () => { clearCardClashSession(); setPhase("setup"); });

  // SCORER_THEME cosmetic — accents the logged-in viewer's own live scoring
  // surface (X01 & Cricket only, see GameScorer). Same "own account, solo
  // practice" reasoning as PracticeOverScreen's RESULT_THEME/CHECKOUT_EFFECT
  // above: falls back to each scorer's existing hardcoded default when
  // nothing's equipped or no one's logged in.
  const currentPlayer = useCurrentPlayer();
  const cosmeticsCatalog = useCosmeticsCatalog();
  const [equippedScorerThemeId, setEquippedScorerThemeId] = useState<string | null>(null);
  useEffect(() => {
    if (!currentPlayer?.playerId) return;
    fetch(`/api/players/${currentPlayer.playerId}/cosmetics`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => setEquippedScorerThemeId(data?.equippedScorerThemeId ?? null))
      .catch(() => {});
  }, [currentPlayer?.playerId]);
  const scorerAccentColor = equippedScorerThemeId
    ? scorerThemeColorHelper(cosmeticsCatalog.find(c => c.id === equippedScorerThemeId), "")
    : null;

  if (phase === "setup") {
    return <SetupScreen onStart={d => {
      // Fire-and-forget: log that a session actually started, not just
      // when (if) it finishes. practice_sessions only ever gets a row on
      // successful completion, so a session that freezes/crashes/gets
      // abandoned before then leaves no trace anywhere today. This alone
      // doesn't let a crashed session resume — it's just so it's visible
      // instead of silently vanishing. See the add_practice_session_attempts
      // migration for the full reasoning.
      fetch("/api/practice/session-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player1Id: d.p1.id,
          player2Id: d.p2?.id ?? null,
          gameTypeKey: d.gameType.key,
          mode: d.solo ? (d.soloPlay ? "solo" : "bot") : "2p",
        }),
      }).catch(() => {});
      setSetupData(d); setPhase("playing");
    }} />;
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
          scorerThemeColor={scorerAccentColor}
          onWin={r => { clearCardClashSession(); setResult(r); setPhase("done"); }}
          onAbandon={() => { clearCardClashSession(); setPhase("setup"); }}
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
        onBack={() => { clearCardClashSession(); setPhase("setup"); setResult(null); setSetupData(null); setPracticeStats(null); }}
      />
    );
  }

  return null;
}
