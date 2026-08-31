import { useState, useEffect } from "react";
import { useListPlayers, useSubmitMatch, getGetLeaderboardQueryKey, getGetStatsSummaryQueryKey, getGetRecentActivityQueryKey, getListMatchesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { Swords, Trophy, RotateCcw, ChevronRight, BookOpen, Info, Zap, AlertCircle, User, Building2 } from "lucide-react";
import { GameScorer, type GameTypeOption, type GameResult, type PracticeStats } from "@/components/game-scorer";
import { RulesModal } from "@/components/rules-modal";
import { MatchStatsCard } from "@/components/match-stats-card";
import { CardEquipmentSelector } from "@/components/CardEquipmentSelector";
import { useCurrentPlayer } from "@/context/auth";
import { PostMatchAnalysisModal } from "@/components/stats/post-match-analysis";

// ── Types ──────────────────────────────────────────────────────────────────────
type Player = { id: number; name: string; points: number; elo: number; status: string };
type Format = "1v1" | "2v2" | "3v3" | "killer-ffa" | "doubles-event" | "shift-wars";

type SetupData = {
  format: Format;
  team1: Player[];   // 1v1: [p1]; 2v2: [a,b]; 3v3: [a,b,c]; killer-ffa: all players; doubles-event: fixed draw team A's members; shift-wars: single synthetic entry standing in for the department team
  team2: Player[];   // killer-ffa: empty; doubles-event: fixed draw team B's members; shift-wars: same as team1 but for the other department
  gameType: GameTypeOption;
  stake: number;
  bullUp?: boolean;
  doublesTeamIds?: [number, number]; // doubles-event only: [team1Id, team2Id] for the season's fixed random-draw teams
  shiftWarsTeamIds?: [number, number]; // shift-wars only: [team1Id, team2Id] for the 3 fixed department teams
};

type EquippedCards = {
  goodCards: Array<{ id: string; name: string }>;
  badCards: Array<{ id: string; name: string }>;
};

// ── Format config ───────────────────────────────────────────────────────────────
// Note: "2v2 Team Game" and "Doubles Event" are deliberately labeled and
// described differently — they're easy to conflate otherwise. 2v2 is any
// casual pairing of two players for a one-off game; Doubles Event is the
// season's official fixed random-draw teams competition (see the admin
// toggle in Feature Flags to turn the whole event on/off for a season).
const FORMAT_OPTIONS: { key: Format; label: string; icon: string; desc: string }[] = [
  { key: "1v1",        label: "1v1",             icon: "👤",  desc: "Head to head" },
  { key: "2v2",        label: "2v2 Team Game",   icon: "👥",  desc: "Any 2 players vs any 2 — casual, one-off" },
  { key: "3v3",        label: "3v3 Triples",     icon: "👥",  desc: "Teams of 3 — casual, one-off" },
  { key: "doubles-event", label: "Doubles Event", icon: "🎯",  desc: "Official season event — fixed random-draw teams" },
  { key: "shift-wars", label: "Shift Wars", icon: "🏬",  desc: "Fixed department teams — Fresh, Twilight, Shift Leader" },
  { key: "killer-ffa", label: "Killer Free-for-All", icon: "💀", desc: "3–6 individual players" },
];

const TEAM_CATEGORIES: Record<Format, string[]> = {
  "1v1":            ["competitive", "practice", "party", "mini-games"],
  "2v2":            ["team"],
  "3v3":            ["team"],
  "killer-ffa":     ["team"],
  "doubles-event":  ["team"],
  "shift-wars":     ["team"],
};

const TABS_BY_FORMAT: Record<Format, { key: string; label: string }[]> = {
  "1v1":        [
    { key: "competitive", label: "Competitive" },
    { key: "practice",    label: "Practice"    },
    { key: "party",       label: "Party"       },
    { key: "mini-games",  label: "Mini-Games"  },
  ],
  "2v2":            [{ key: "team", label: "Team Games" }],
  "3v3":            [{ key: "team", label: "Team Games" }],
  "killer-ffa":     [{ key: "team", label: "Killer" }],
  "doubles-event":  [{ key: "team", label: "Team Games" }],
  "shift-wars":     [{ key: "team", label: "Team Games" }],
};

// ── Doubles Event: log a result for the season's fixed random-draw teams ───────
type DoublesTeam = {
  id: number; teamName: string; points: number; elo: number; isEliminated: boolean;
  players: { id: number; name: string }[];
};

function useDoublesTeamsForPlay() {
  const [teams, setTeams]   = useState<DoublesTeam[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const seasonRes = await fetch("/api/seasons/current");
        const season = await seasonRes.json();
        if (!season?.id) { setTeams([]); setLoaded(true); return; }
        const teamsRes = await fetch(`/api/seasons/${season.id}/doubles/teams`);
        const data = await teamsRes.json();
        setTeams(Array.isArray(data) ? data : []);
      } catch {
        setTeams([]);
      }
      setLoaded(true);
    })();
  }, []);

  return { teams, loaded };
}

// ── Doubles team slot selector (Team 1 / Team 2 pick from the fixed draw) ──────
function DoublesTeamSlot({ label, color, value, onChange, exclude, teams }: {
  label: string; color: string; value: string;
  onChange: (v: string) => void; exclude: string[]; teams: DoublesTeam[];
}) {
  const selected = teams.find(t => t.id === Number(value));
  return (
    <div className="pdc-card p-3" style={{ borderColor: value ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)" }}>
      <div className="text-xs font-bold uppercase mb-2" style={{ fontFamily: "Oswald, sans-serif", color, letterSpacing: "0.1em" }}>
        {label}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: value ? "#fff" : "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
        <option value="" style={{ color: "#111" }}>Select team…</option>
        {teams.filter(t => !exclude.includes(String(t.id))).map(t => (
          <option key={t.id} value={t.id} style={{ color: "#111" }}>{t.teamName} ({t.points}pts)</option>
        ))}
      </select>
      {selected && (
        <div className="mt-1.5 text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
          {selected.teamName} · {selected.points}pts · ELO {selected.elo}
        </div>
      )}
    </div>
  );
}


// ── Shift Wars: log a result for one of the 3 fixed department teams ───────────
type ShiftWarsTeam = { id: number; name: string; points: number; wins: number; losses: number };

function useShiftWarsTeamsForPlay() {
  const [teams, setTeams]   = useState<ShiftWarsTeam[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/shift-wars/teams")
      .then(r => r.ok ? r.json() : [])
      .then(data => setTeams(Array.isArray(data) ? data : []))
      .catch(() => setTeams([]))
      .finally(() => setLoaded(true));
  }, []);

  return { teams, loaded };
}

// ── Shift Wars team slot selector (Team 1 / Team 2 pick from the fixed 3) ──────
function ShiftWarsTeamSlot({ label, color, value, onChange, exclude, teams }: {
  label: string; color: string; value: string;
  onChange: (v: string) => void; exclude: string[]; teams: ShiftWarsTeam[];
}) {
  const selected = teams.find(t => t.id === Number(value));
  return (
    <div className="pdc-card p-3" style={{ borderColor: value ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)" }}>
      <div className="text-xs font-bold uppercase mb-2" style={{ fontFamily: "Oswald, sans-serif", color, letterSpacing: "0.1em" }}>
        {label}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: value ? "#fff" : "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
        <option value="" style={{ color: "#111" }}>Select team…</option>
        {teams.filter(t => !exclude.includes(String(t.id))).map(t => (
          <option key={t.id} value={t.id} style={{ color: "#111" }}>{t.name} ({t.points}pts)</option>
        ))}
      </select>
      {selected && (
        <div className="mt-1.5 text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
          {selected.name} · {selected.points}pts
        </div>
      )}
    </div>
  );
}

// ── Game type card ─────────────────────────────────────────────────────────────
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

// ── Player slot selector ────────────────────────────────────────────────────────
function PlayerSlot({ label, color, value, onChange, exclude, players }: {
  label: string; color: string; value: string;
  onChange: (v: string) => void; exclude: string[]; players: Player[];
}) {
  const selected = players.find(p => p.id === Number(value));
  return (
    <div className="pdc-card p-3" style={{ borderColor: value ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)" }}>
      <div className="text-xs font-bold uppercase mb-2" style={{ fontFamily: "Oswald, sans-serif", color, letterSpacing: "0.1em" }}>
        {label}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: value ? "#fff" : "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
        <option value="" style={{ color: "#111" }}>Select player…</option>
        {players.filter(p => !exclude.includes(String(p.id))).map(p => (
          <option key={p.id} value={p.id} style={{ color: "#111" }}>{p.name} ({p.points}pts)</option>
        ))}
      </select>
      {selected && (
        <div className="mt-1.5 text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
          {selected.points}pts · ELO {selected.elo}
        </div>
      )}
    </div>
  );
}

// ── Setup Screen ───────────────────────────────────────────────────────────────
function SetupScreen({ onStart }: { onStart: (d: SetupData) => void }) {
  const { data: playersData } = useListPlayers();
  const currentPlayer         = useCurrentPlayer();
  const { data: appSettings }  = useSettings();
  const doublesEventEnabled    = appSettings?.doubles_event_enabled ?? true;
  const shiftWarsEnabled       = appSettings?.shift_wars_enabled ?? false;
  const formatOptions          = FORMAT_OPTIONS
    .filter(f => f.key !== "doubles-event" || doublesEventEnabled)
    .filter(f => f.key !== "shift-wars" || shiftWarsEnabled);
  const [gameTypes, setGameTypes] = useState<GameTypeOption[]>([]);
  const [format, setFormat]       = useState<Format>("1v1");
  const [team1Ids, setTeam1Ids]   = useState<string[]>(["", "", ""]);
  const [team2Ids, setTeam2Ids]   = useState<string[]>(["", "", ""]);
  const [ffaCount, setFfaCount]   = useState(3);
  const [ffaIds, setFfaIds]       = useState<string[]>(["", "", "", "", "", ""]);
  const [selectedGame, setGame]   = useState<GameTypeOption | null>(null);
  const [stake, setStake]         = useState("5");
  const [tab, setTab]             = useState("competitive");
  const [rulesGame, setRulesGame] = useState<GameTypeOption | null>(null);
  const [bullUp, setBullUp]       = useState(false);
  const [doublesTeam1Id, setDoublesTeam1Id] = useState("");
  const [doublesTeam2Id, setDoublesTeam2Id] = useState("");
  const [shiftWarsTeam1Id, setShiftWarsTeam1Id] = useState("");
  const [shiftWarsTeam2Id, setShiftWarsTeam2Id] = useState("");

  const { teams: allDoublesTeams, loaded: doublesTeamsLoaded } = useDoublesTeamsForPlay();
  const activeDoublesTeams = allDoublesTeams.filter(t => !t.isEliminated);
  const doublesTeam1 = activeDoublesTeams.find(t => String(t.id) === doublesTeam1Id) ?? null;
  const doublesTeam2 = activeDoublesTeams.find(t => String(t.id) === doublesTeam2Id) ?? null;

  const { teams: shiftWarsTeams, loaded: shiftWarsTeamsLoaded } = useShiftWarsTeamsForPlay();
  const shiftWarsTeam1 = shiftWarsTeams.find(t => String(t.id) === shiftWarsTeam1Id) ?? null;
  const shiftWarsTeam2 = shiftWarsTeams.find(t => String(t.id) === shiftWarsTeam2Id) ?? null;

  useEffect(() => {
    fetch("/api/game-types").then(r => r.json()).then(setGameTypes).catch(() => {});
  }, []);

  // Reset game selection and tab when format changes
  useEffect(() => {
    setGame(null);
    const tabs = TABS_BY_FORMAT[format];
    setTab(tabs[0]?.key ?? "competitive");
  }, [format]);

  // Only the ranked 1v1 Competitive ladder should hide ELIMINATED players
  // (0 points this season) — everywhere else (1v1 Practice/Party/Mini-Games,
  // 2v2/3v3 Team Games, Killer FFA) is casual and unaffected by singles-ladder
  // elimination, so eliminated players should still be selectable there.
  // INACTIVE (retired/left-the-league) players are excluded everywhere.
  // Doubles Event and Shift Wars already get this right since they pull their
  // rosters from their own team endpoints instead of this players list.
  const isCompetitiveLadder = format === "1v1" && tab === "competitive";
  const players = (playersData as Player[] | undefined)?.filter(p =>
    isCompetitiveLadder ? p.status === "ACTIVE" : p.status !== "INACTIVE"
  ) ?? [];

  // Auto-default Player 1 slot to logged-in player
  useEffect(() => {
    if (!currentPlayer || players.length === 0 || team1Ids[0] !== "") return;
    const match = players.find(p => p.id === currentPlayer.playerId);
    if (match) setTeam1Ids(prev => { const n = [...prev]; n[0] = String(match.id); return n; });
  }, [players.length, currentPlayer?.playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collect all selected IDs to prevent duplicates
  const allTeam1 = team1Ids.filter(Boolean);
  const allTeam2 = team2Ids.filter(Boolean);
  const allFfa   = ffaIds.slice(0, ffaCount).filter(Boolean);
  const allSelected = [...allTeam1, ...allTeam2, ...allFfa];

  const teamSize = format === "2v2" ? 2 : format === "3v3" ? 3 : 1;

  // Resolve selected player objects
  const resolveTeam = (ids: string[], size: number): (Player | null)[] =>
    ids.slice(0, size).map(id => players.find(p => p.id === Number(id)) ?? null);

  const team1Players = resolveTeam(team1Ids, teamSize);
  const team2Players = resolveTeam(team2Ids, teamSize);
  const ffaPlayers   = ffaIds.slice(0, ffaCount).map(id => players.find(p => p.id === Number(id)) ?? null);

  // Stake validation
  const activePlayers: Player[] = format === "killer-ffa"
    ? ffaPlayers.filter((p): p is Player => !!p)
    : format === "doubles-event"
    ? [doublesTeam1, doublesTeam2].filter((t): t is DoublesTeam => !!t)
        .map(t => ({ id: t.id, name: t.teamName, points: t.points, elo: t.elo, status: "ACTIVE" }))
    : format === "shift-wars"
    ? [shiftWarsTeam1, shiftWarsTeam2].filter((t): t is ShiftWarsTeam => !!t)
        .map(t => ({ id: t.id, name: t.name, points: t.points, elo: 0, status: "ACTIVE" }))
    : [...team1Players, ...team2Players].filter((p): p is Player => !!p);
  const maxStake = activePlayers.length > 0 ? Math.min(...activePlayers.map(p => p.points)) : 0;
  const stakeN   = parseInt(stake) || 0;
  const stakeErr = activePlayers.length > 0
    ? (stakeN < 1 ? "Min stake is 1pt" : stakeN > maxStake ? `Max is ${maxStake}pts (lowest balance)` : "")
    : "";

  // Readiness check
  const team1Ready = format === "1v1"
    ? (team1Ids[0] !== "" && team2Ids[0] !== "" && team1Ids[0] !== team2Ids[0])
    : team1Players.every(Boolean);
  const team2Ready = format === "1v1" ? true : team2Players.every(Boolean);
  const ffaReady   = format === "killer-ffa" && ffaPlayers.every(Boolean) && new Set(ffaIds.slice(0, ffaCount).filter(Boolean)).size === ffaCount;
  const doublesReady = format === "doubles-event" && !!doublesTeam1 && !!doublesTeam2 && doublesTeam1.id !== doublesTeam2.id;
  const shiftWarsReady = format === "shift-wars" && !!shiftWarsTeam1 && !!shiftWarsTeam2 && shiftWarsTeam1.id !== shiftWarsTeam2.id;

  const playersReady = format === "killer-ffa" ? ffaReady
    : format === "doubles-event" ? doublesReady
    : format === "shift-wars" ? shiftWarsReady
    : (team1Ready && team2Ready);
  const canStart = playersReady && !!selectedGame && !stakeErr;

  // Game type filtering
  const allowedCats = TEAM_CATEGORIES[format];
  const tabGames = gameTypes.filter(g => {
    if (g.enabled === false) return false;
    if (format === "killer-ffa") {
      // Only show MultiKiller games, filter by player count
      if (g.engine !== "MultiKiller") return false;
      const cfg = JSON.parse(g.config ?? "{}") as { playerCount?: number };
      return cfg.playerCount === ffaCount;
    }
    return allowedCats.includes(g.category) && g.category === tab;
  });

  const updateFfaId = (idx: number, val: string) => {
    setFfaIds(prev => { const n = [...prev]; n[idx] = val; return n; });
  };

  const updateTeam = (team: 1|2, idx: number, val: string) => {
    if (team === 1) setTeam1Ids(prev => { const n = [...prev]; n[idx] = val; return n; });
    else setTeam2Ids(prev => { const n = [...prev]; n[idx] = val; return n; });
  };

  const handleStart = () => {
    if (!canStart || !selectedGame) return;
    if (format === "killer-ffa") {
      onStart({ format, team1: ffaPlayers.filter((p): p is Player => !!p), team2: [], gameType: selectedGame, stake: stakeN });
    } else if (format === "doubles-event") {
      if (!doublesTeam1 || !doublesTeam2) return;
      const shim = (t: DoublesTeam): Player[] =>
        t.players.map(p => ({ id: p.id, name: p.name, points: t.points, elo: t.elo, status: "ACTIVE" }));
      onStart({
        format,
        team1: shim(doublesTeam1),
        team2: shim(doublesTeam2),
        gameType: selectedGame,
        stake: stakeN,
        bullUp,
        doublesTeamIds: [doublesTeam1.id, doublesTeam2.id],
      });
    } else if (format === "shift-wars") {
      if (!shiftWarsTeam1 || !shiftWarsTeam2) return;
      const shim = (t: ShiftWarsTeam): Player[] => [{ id: t.id, name: t.name, points: t.points, elo: 0, status: "ACTIVE" }];
      onStart({
        format,
        team1: shim(shiftWarsTeam1),
        team2: shim(shiftWarsTeam2),
        gameType: selectedGame,
        stake: stakeN,
        bullUp,
        shiftWarsTeamIds: [shiftWarsTeam1.id, shiftWarsTeam2.id],
      });
    } else if (format === "1v1") {
      const p1 = players.find(p => String(p.id) === team1Ids[0])!;
      const p2 = players.find(p => String(p.id) === team2Ids[0])!;
      onStart({ format, team1: [p1], team2: [p2], gameType: selectedGame, stake: stakeN, bullUp });
    } else {
      onStart({
        format,
        team1: team1Players.filter((p): p is Player => !!p),
        team2: team2Players.filter((p): p is Player => !!p),
        gameType: selectedGame,
        stake: stakeN,
        bullUp,
      });
    }
  };

  const tabs = TABS_BY_FORMAT[format];

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

      {/* Format selector */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Format</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {formatOptions.map(f => (
            <button key={f.key} onClick={() => setFormat(f.key)}
              className="p-3 rounded-xl text-left transition-all"
              style={{
                background: format === f.key ? "rgba(255,0,92,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${format === f.key ? "rgba(255,0,92,0.35)" : "rgba(255,255,255,0.07)"}`,
                cursor: "pointer",
              }}>
              <div className="text-lg mb-0.5">{f.icon}</div>
              <div className="text-xs font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", color: format === f.key ? "#ff005c" : "rgba(255,255,255,0.6)", letterSpacing: "0.06em" }}>
                {f.label}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>{f.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Player selection */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
          {format === "killer-ffa" ? "Players" : "Teams"}
        </h2>

        {/* 1v1 */}
        {format === "1v1" && (
          <div className="grid grid-cols-2 gap-3">
            <PlayerSlot label="Player 1" color="#22c55e" value={team1Ids[0]} onChange={v => updateTeam(1, 0, v)}
              exclude={[team2Ids[0]].filter(Boolean)} players={players} />
            <PlayerSlot label="Player 2" color="#ee0a78" value={team2Ids[0]} onChange={v => updateTeam(2, 0, v)}
              exclude={[team1Ids[0]].filter(Boolean)} players={players} />
          </div>
        )}

        {/* 2v2 or 3v3 */}
        {(format === "2v2" || format === "3v3") && (
          <div className="grid grid-cols-2 gap-4">
            {/* Team 1 */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase text-center py-1 rounded" style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>Team 1</div>
              {Array.from({ length: teamSize }).map((_, i) => (
                <PlayerSlot key={i} label={`Player ${i + 1}`} color="#22c55e"
                  value={team1Ids[i]} onChange={v => updateTeam(1, i, v)}
                  exclude={allSelected.filter(id => id !== team1Ids[i])} players={players} />
              ))}
            </div>
            {/* Team 2 */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase text-center py-1 rounded" style={{ background: "rgba(238,10,120,0.08)", color: "#ee0a78", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>Team 2</div>
              {Array.from({ length: teamSize }).map((_, i) => (
                <PlayerSlot key={i} label={`Player ${i + 1}`} color="#ee0a78"
                  value={team2Ids[i]} onChange={v => updateTeam(2, i, v)}
                  exclude={allSelected.filter(id => id !== team2Ids[i])} players={players} />
              ))}
            </div>
          </div>
        )}

        {/* Doubles Event — pick from the season's fixed random-draw teams */}
        {format === "doubles-event" && (
          !doublesTeamsLoaded ? (
            <div className="text-sm py-6 text-center" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>Loading teams…</div>
          ) : activeDoublesTeams.length === 0 ? (
            <div className="text-sm py-6 text-center" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
              No doubles teams yet this season — ask an admin to run the random draw first.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <DoublesTeamSlot label="Team 1" color="#22c55e" value={doublesTeam1Id} onChange={setDoublesTeam1Id}
                exclude={[doublesTeam2Id].filter(Boolean)} teams={activeDoublesTeams} />
              <DoublesTeamSlot label="Team 2" color="#ee0a78" value={doublesTeam2Id} onChange={setDoublesTeam2Id}
                exclude={[doublesTeam1Id].filter(Boolean)} teams={activeDoublesTeams} />
            </div>
          )
        )}

        {/* Shift Wars — pick 2 of the 3 fixed department teams */}
        {format === "shift-wars" && (
          !shiftWarsTeamsLoaded ? (
            <div className="text-sm py-6 text-center" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>Loading teams…</div>
          ) : shiftWarsTeams.length === 0 ? (
            <div className="text-sm py-6 text-center" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
              No Shift Wars teams yet — ask an admin to set them up first.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <ShiftWarsTeamSlot label="Team 1" color="#22c55e" value={shiftWarsTeam1Id} onChange={setShiftWarsTeam1Id}
                exclude={[shiftWarsTeam2Id].filter(Boolean)} teams={shiftWarsTeams} />
              <ShiftWarsTeamSlot label="Team 2" color="#ee0a78" value={shiftWarsTeam2Id} onChange={setShiftWarsTeam2Id}
                exclude={[shiftWarsTeam1Id].filter(Boolean)} teams={shiftWarsTeams} />
            </div>
          )
        )}

        {/* Killer FFA */}
        {format === "killer-ffa" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Number of players:</span>
              <div className="flex gap-1">
                {[3, 4, 5, 6].map(n => (
                  <button key={n} onClick={() => { setFfaCount(n); setGame(null); }}
                    className="w-9 h-9 rounded-lg font-bold text-sm"
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      background: ffaCount === n ? "rgba(255,210,74,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${ffaCount === n ? "rgba(255,210,74,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: ffaCount === n ? "#ffd24a" : "rgba(255,255,255,0.4)",
                      cursor: "pointer",
                    }}>{n}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: ffaCount }).map((_, i) => (
                <PlayerSlot key={i} label={`Player ${i + 1}`} color={["#22c55e","#ee0a78","#ffd24a","#38bdf8","#f97316","#a78bfa"][i]}
                  value={ffaIds[i]} onChange={v => updateFfaId(i, v)}
                  exclude={allFfa.filter(id => id !== ffaIds[i])} players={players} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stake */}
      {format !== "killer-ffa" || activePlayers.length > 0 ? (
        <div className="pdc-card p-4" style={{ borderColor: stakeErr ? "rgba(255,0,92,0.3)" : "rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Stake</h2>
            {activePlayers.length > 0 && <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Max: {maxStake}pts per player</span>}
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
          {!stakeErr && activePlayers.length > 1 && (
            <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
              {format === "1v1"
                ? `Winner gets +${stakeN}pts from loser`
                : `Each loser pays ${stakeN}pts · each winner gains ${stakeN}pts`}
            </p>
          )}
        </div>
      ) : null}

      {/* Game type selection */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Game Type</h2>
        {tabs.length > 1 && (
          <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {tabs.map(t => (
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
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
          {tabGames.length === 0
            ? <div className="col-span-2 text-center py-8 text-sm" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
                {format === "killer-ffa" ? `No Killer game found for ${ffaCount} players` : "No games in this category"}
              </div>
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

      {/* Bull Up toggle (all non-FFA formats) */}
      {format !== "killer-ffa" && (
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

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!canStart}
        className="w-full py-4 text-base font-black uppercase tracking-widest rounded-xl transition-all"
        style={{ background: canStart ? "linear-gradient(135deg, #ff005c, #cc0048)" : "rgba(255,255,255,0.04)",
          color: canStart ? "#fff" : "rgba(255,255,255,0.2)",
          border: canStart ? "none" : "1px solid rgba(255,255,255,0.06)",
          fontFamily: "Oswald, sans-serif", cursor: canStart ? "pointer" : "not-allowed",
          boxShadow: canStart ? "0 8px 32px rgba(255,0,92,0.3)" : undefined }}>
        {canStart
          ? format === "killer-ffa"
            ? `Start Killer — ${ffaCount} Players`
            : `Start — ${selectedGame?.name}`
          : format === "killer-ffa" ? "Select players & game" : (format === "doubles-event" || format === "shift-wars") ? "Select teams, game & stake" : "Select players, game & stake"}
        {canStart && <ChevronRight className="inline ml-2 w-5 h-5" />}
      </button>

      {rulesGame && <RulesModal game={rulesGame} onClose={() => setRulesGame(null)} />}
    </div>
  );
}

// ── Game Over Screen ───────────────────────────────────────────────────────────
function GameOverScreen({ result, data, stats, player1Equipment, player2Equipment, onBack }: {
  result: GameResult; data: SetupData; stats: PracticeStats | null; player1Equipment: EquippedCards | null; player2Equipment: EquippedCards | null; onBack: () => void;
}) {
  const { toast }   = useToast();
  const qc          = useQueryClient();
  const { mutateAsync: submitMatch, isPending: isPending1v1 } = useSubmitMatch();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState("");
  const [autoFired, setAutoFired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMatchId, setSubmittedMatchId] = useState<number | null>(null);
  const [analysisPlayerId, setAnalysisPlayerId] = useState<number | null>(null);

  // Resolve winner/loser for display and submission
  const isTeam = data.format === "2v2" || data.format === "3v3" || data.format === "doubles-event" || data.format === "shift-wars";
  const isKillerFfa = data.format === "killer-ffa";

  const winnerTeam: Player[] = isKillerFfa
    ? [data.team1[result.winnerIdx]]
    : (result.winnerIdx === 0 ? data.team1 : data.team2);
  const loserTeam: Player[] = isKillerFfa
    ? data.team1.filter((_, i) => i !== result.winnerIdx)
    : (result.winnerIdx === 0 ? data.team2 : data.team1);

  const winnerName = winnerTeam.map(p => p.name).join(" & ");
  const loserName  = loserTeam.map(p  => p.name).join(" & ");

  const submit = async () => {
    try {
      setError("");
      setIsSubmitting(true);
      if (data.format === "1v1") {
        const winner = winnerTeam[0];
        const loser  = loserTeam[0];
        const wIdx = result.winnerIdx;
        const wStats = wIdx === 0
          ? { darts: stats?.p1Darts, s100s: stats?.p1_100s, s140s: stats?.p1_140s, s170s: stats?.p1_170s, s180s: stats?.p1_180s, ca: stats?.p1CheckoutAttempts, ch: stats?.p1CheckoutHits }
          : { darts: stats?.p2Darts, s100s: stats?.p2_100s, s140s: stats?.p2_140s, s170s: stats?.p2_170s, s180s: stats?.p2_180s, ca: stats?.p2CheckoutAttempts, ch: stats?.p2CheckoutHits };
        const lStats = wIdx === 0
          ? { darts: stats?.p2Darts, s100s: stats?.p2_100s, s140s: stats?.p2_140s, s170s: stats?.p2_170s, s180s: stats?.p2_180s, ca: stats?.p2CheckoutAttempts, ch: stats?.p2CheckoutHits }
          : { darts: stats?.p1Darts, s100s: stats?.p1_100s, s140s: stats?.p1_140s, s170s: stats?.p1_170s, s180s: stats?.p1_180s, ca: stats?.p1CheckoutAttempts, ch: stats?.p1CheckoutHits };
        const createdMatch = await submitMatch({ data: {
          winnerId:               winner.id,
          loserId:                loser.id,
          stake:                  data.stake,
          gameType:               data.gameType.key,
          ...(wStats.darts !== undefined ? { winnerDarts:            wStats.darts  } : {}),
          ...(wStats.s100s !== undefined ? { winner100s:             wStats.s100s  } : {}),
          ...(wStats.s140s !== undefined ? { winner140s:             wStats.s140s  } : {}),
          ...(wStats.s170s !== undefined ? { winner170s:             wStats.s170s  } : {}),
          ...(wStats.s180s !== undefined ? { winner180s:             wStats.s180s  } : {}),
          ...(wStats.ca    !== undefined ? { winnerCheckoutAttempts: wStats.ca     } : {}),
          ...(wStats.ch    !== undefined ? { winnerCheckoutHits:     wStats.ch     } : {}),
          ...(lStats.darts !== undefined ? { loserDarts:             lStats.darts  } : {}),
          ...(lStats.s100s !== undefined ? { loser100s:              lStats.s100s  } : {}),
          ...(lStats.s140s !== undefined ? { loser140s:              lStats.s140s  } : {}),
          ...(lStats.s170s !== undefined ? { loser170s:              lStats.s170s  } : {}),
          ...(lStats.s180s !== undefined ? { loser180s:              lStats.s180s  } : {}),
          ...(lStats.ca    !== undefined ? { loserCheckoutAttempts:  lStats.ca     } : {}),
          ...(lStats.ch    !== undefined ? { loserCheckoutHits:      lStats.ch     } : {}),
          // Include equipped cards if Card Clash match — sent keyed by
          // winner/loser (not player1/player2) since that's what the backend
          // needs to attribute coin rewards and consume cards from the right
          // player's inventory.
          ...(player1Equipment || player2Equipment ? {
            cardsUsedInMatch: {
              winner: (wIdx === 0 ? player1Equipment : player2Equipment) ?? { goodCards: [], badCards: [] },
              loser:  (wIdx === 0 ? player2Equipment : player1Equipment) ?? { goodCards: [], badCards: [] },
            },
          } : {}),
        } });
        setSubmittedMatchId(createdMatch.id);
      } else if (data.format === "doubles-event" && data.doublesTeamIds) {
        const [team1Id, team2Id] = data.doublesTeamIds;
        const winnerTeamId = result.winnerIdx === 0 ? team1Id : team2Id;
        const loserTeamId  = result.winnerIdx === 0 ? team2Id : team1Id;
        await fetch("/api/doubles/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            winnerTeamId,
            loserTeamId,
            stake:    data.stake,
            gameType: data.gameType.key,
          }),
        }).then(async r => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`);
          }
          return r.json();
        });
        await qc.invalidateQueries({ queryKey: ["leaderboard-doubles"] });
      } else if (data.format === "shift-wars" && data.shiftWarsTeamIds) {
        const [team1Id, team2Id] = data.shiftWarsTeamIds;
        const winnerTeamId = result.winnerIdx === 0 ? team1Id : team2Id;
        const loserTeamId  = result.winnerIdx === 0 ? team2Id : team1Id;
        await fetch("/api/shift-wars/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            winnerTeamId,
            loserTeamId,
            stake:    data.stake,
            gameType: data.gameType.key,
          }),
        }).then(async r => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`);
          }
          return r.json();
        });
        await qc.invalidateQueries({ queryKey: ["leaderboard-shiftwars"] });
      } else {
        await fetch("/api/team-matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            winnerIds: winnerTeam.map(p => p.id),
            loserIds:  loserTeam.map(p  => p.id),
            stake:     data.stake,
            gameType:  data.gameType.key,
          }),
        }).then(async r => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`);
          }
          return r.json();
        });
      }
      if (data.format !== "doubles-event" && data.format !== "shift-wars") {
        await qc.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
        await qc.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        await qc.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
        await qc.invalidateQueries({ queryKey: getListMatchesQueryKey() });
      }
      setSubmitted(true);
      toast({ title: "Match recorded!", description: `${winnerName} +${data.stake}pts` });
    } catch (e: any) {
      setError(e.message ?? "Failed to submit");
      toast({ title: "Error", description: "Failed to submit match", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!autoFired) { setAutoFired(true); void submit(); }
  }, []);

  const formatLabel = data.format === "1v1" ? "1v1" : data.format === "2v2" ? "2v2 Doubles" : data.format === "3v3" ? "3v3 Triples" : data.format === "doubles-event" ? "Doubles Event" : data.format === "shift-wars" ? "Shift Wars" : `Killer ${data.team1.length}-player`;

  return (
    <div className="max-w-lg mx-auto space-y-6 text-center">
      <div className="pdc-divider" />
      <div>
        <Trophy className="w-16 h-16 mx-auto mb-3" style={{ color: "#ffd24a", filter: "drop-shadow(0 0 20px rgba(255,210,74,0.5))" }} />
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
          {isTeam ? "Winning Team" : isKillerFfa ? "Survivor" : "Winner"}
        </div>
        <div className="text-4xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#fff", letterSpacing: "0.08em", textShadow: "0 0 30px rgba(255,0,92,0.4)" }}>
          {winnerName}
        </div>
        {result.detail && <div className="text-sm mt-1" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>{result.detail}</div>}
      </div>

      {stats && data.format === "1v1" && (
        <MatchStatsCard
          p1Name={data.team1[0].name}
          p2Name={data.team2[0].name}
          stats={stats}
          winnerIdx={result.winnerIdx as 0|1}
          accentColor="#ff005c"
        />
      )}

      <div className="pdc-card p-4 text-left space-y-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Match Summary</div>
        {[
          ["Format",        formatLabel],
          ["Game",          data.gameType.name],
          ["Winner" + (isTeam ? "s" : ""), winnerName],
          ["Loser" + (isTeam ? "s" : ""),  loserName],
          ["Stake",         `${data.stake} pts per player`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>{k}</span>
            <span style={{ color: "#fff", fontFamily: "Oswald, sans-serif" }}>{v}</span>
          </div>
        ))}
      </div>

      {(isPending1v1 || isSubmitting) && (
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>Submitting to leaderboard…</div>
      )}
      {submitted && (
        <div className="pdc-card p-3 text-center" style={{ borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.05)" }}>
          <div className="text-sm font-bold" style={{ color: "#22c55e", fontFamily: "Oswald, sans-serif" }}>✓ Match submitted to leaderboard</div>
        </div>
      )}
      {submitted && data.format === "1v1" && submittedMatchId !== null && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setAnalysisPlayerId(winnerTeam[0].id)}
            className="py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs"
            style={{ background: "rgba(0,229,160,0.1)", color: "#00e5a0", border: "1px solid rgba(0,229,160,0.25)", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}
          >
            {winnerName}'s Analysis
          </button>
          <button
            onClick={() => setAnalysisPlayerId(loserTeam[0].id)}
            className="py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}
          >
            {loserName}'s Analysis
          </button>
        </div>
      )}
      {error && <div className="text-sm" style={{ color: "#ff005c" }}>{error}<br /><button onClick={submit} style={{ textDecoration: "underline", cursor: "pointer" }}>Retry</button></div>}
      {analysisPlayerId !== null && submittedMatchId !== null && (
        <PostMatchAnalysisModal
          matchId={submittedMatchId}
          playerId={analysisPlayerId}
          onClose={() => setAnalysisPlayerId(null)}
        />
      )}

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
  const { data: appSettings }       = useSettings();
  const currentUser                 = useCurrentPlayer();
  const cardClashEnabled            = appSettings?.card_clash_enabled ?? false;

  const [phase, setPhase]           = useState<"setup" | "equipment" | "playing" | "gameover">("setup");
  const [setupData, setSetupData]   = useState<SetupData | null>(null);
  const [player1Equipment, setPlayer1Equipment] = useState<EquippedCards | null>(null);
  const [player2Equipment, setPlayer2Equipment] = useState<EquippedCards | null>(null);
  const [equipmentPhase, setEquipmentPhase] = useState<"player1" | "player2" | "done">("player1");
  const [gameResult, setResult]     = useState<GameResult | null>(null);
  const [matchStats, setMatchStats] = useState<PracticeStats | null>(null);

  const reset = () => { 
    setPhase("setup"); 
    setSetupData(null); 
    setPlayer1Equipment(null);
    setPlayer2Equipment(null);
    setEquipmentPhase("player1");
    setResult(null); 
    setMatchStats(null); 
  };

  if (phase === "setup") {
    return <SetupScreen onStart={d => { 
      setSetupData(d);
      // Route to equipment selection if Card Clash is enabled and game type is X01 or CRICKET
      if (cardClashEnabled && d.format !== "shift-wars" && (d.gameType.key === "x01" || d.gameType.key === "cricket")) {
        setPhase("equipment");
      } else {
        setPhase("playing");
      }
    }} />;
  }

  // ── Equipment Selection Phase ──
  if (phase === "equipment" && setupData && currentUser) {
    const isPlayer1 = String(currentUser.playerId) === String(setupData.team1[0]?.id);
    const isPlayer2 = String(currentUser.playerId) === String(setupData.team2[0]?.id);
    
    // Player 1 equipment selection
    if (equipmentPhase === "player1") {
      return (
        <CardEquipmentSelector
          playerId={setupData.team1[0]?.id || currentUser.playerId}
          currentPlayerName={setupData.team1[0]?.name}
          gameMode={setupData.gameType.key === "x01" ? "X01" : "CRICKET"}
          onSelect={(equipment) => {
            setPlayer1Equipment(equipment);
            setEquipmentPhase("player2");
          }}
          onCancel={() => setPhase("setup")}
        />
      );
    }
    
    // Player 2 equipment selection
    if (equipmentPhase === "player2") {
      return (
        <CardEquipmentSelector
          playerId={setupData.team2[0]?.id || currentUser.playerId}
          currentPlayerName={setupData.team2[0]?.name}
          gameMode={setupData.gameType.key === "x01" ? "X01" : "CRICKET"}
          onSelect={(equipment) => {
            setPlayer2Equipment(equipment);
            setEquipmentPhase("done");
            setPhase("playing");
          }}
          onCancel={() => {
            setPlayer1Equipment(null);
            setEquipmentPhase("player1");
            setPhase("setup");
          }}
        />
      );
    }
  }

  if (phase === "playing" && setupData) {
    const isTeam      = setupData.format === "2v2" || setupData.format === "3v3" || setupData.format === "doubles-event" || setupData.format === "shift-wars";
    const isKillerFfa = setupData.format === "killer-ffa";

    const teamNames: [string[], string[]] | undefined = isTeam
      ? [setupData.team1.map(p => p.name), setupData.team2.map(p => p.name)]
      : undefined;

    const playerNames: string[] | undefined = isKillerFfa
      ? setupData.team1.map(p => p.name)
      : undefined;

    const p1Name = setupData.team1[0]?.name ?? "";
    const p2Name = setupData.team2[0]?.name ?? "";

    const headerLabel = isTeam
      ? `${setupData.team1.map(p => p.name).join(" & ")} vs ${setupData.team2.map(p => p.name).join(" & ")}`
      : isKillerFfa
      ? `Killer — ${setupData.team1.map(p => p.name).join(", ")}`
      : `${p1Name} vs ${p2Name}`;

    return (
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
            {headerLabel} · {setupData.gameType.name} · {setupData.stake}pt stake
          </div>
        </div>
        <GameScorer
          p1Name={p1Name}
          p2Name={p2Name}
          gameType={setupData.gameType}
          teamNames={teamNames}
          playerNames={playerNames}
          bullUp={setupData.bullUp}
          onWin={r => { setResult(r); setPhase("gameover"); }}
          onAbandon={reset}
          onPracticeStats={s => setMatchStats(s)}
        />
      </div>
    );
  }

  if (phase === "gameover" && gameResult && setupData) {
    return <GameOverScreen result={gameResult} data={setupData} stats={matchStats} player1Equipment={player1Equipment} player2Equipment={player2Equipment} onBack={reset} />;
  }

  return null;
}
