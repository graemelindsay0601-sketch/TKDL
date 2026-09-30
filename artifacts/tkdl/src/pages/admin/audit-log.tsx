import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { History, RefreshCw } from "lucide-react";
import { useListPlayers } from "@workspace/api-client-react";
import { CollapsibleAdminSection } from "./collapsible-section";

type AuditRow = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
  admin_player_name: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  "match.edit":              "Match edited",
  "match.delete":            "Singles/team result removed",
  "doubles.match.delete":    "Doubles result removed",
  "shift_wars.match.delete": "Shift Wars result removed",
  "standings.edit":          "Standings edited",
  "player.delete":           "Player deleted",
  "player.retire":           "Player retired",
  "player.elo_override":     "Elo overridden",
  "season.reset":            "Season reset",
  "playoff.match_recorded":  "Playoff match recorded",
  "playoff.match_edit":      "Playoff match edited",
  "playoff.match_delete":    "Playoff match deleted",
  "integrity.achievement_reviewed": "Achievement flag reviewed",
  "integrity.achievement_reopened": "Achievement flag reopened",
  "doubles.teams.draw":      "Doubles teams drawn",
  "doubles.teams.redraw":    "Doubles teams redrawn",
  "shift_wars.team_points.edit": "Shift Wars points edited",
  "shift_wars.starting_points.edit": "Shift Wars reset value edited",
  "shift_wars.roster.assign": "Shift Wars roster changed",
  "game_type.created":        "Game type created",
  "game_type.updated":        "Game type updated",
  "game_type.enabled":        "Game type enabled",
  "game_type.disabled":       "Game type disabled",
  "game_type.deleted":        "Game type deleted",
  "player.settings_update":   "Player settings changed",
};

const ACTION_COLORS: Record<string, string> = {
  "player.delete":  "#ff005c",
  "season.reset":   "#ff005c",
  "player.elo_override": "#ffd24a",
  "match.edit":     "#0066ff",
  "match.delete":   "#ff005c",
  "doubles.match.delete": "#ff005c",
  "shift_wars.match.delete": "#ff005c",
  "standings.edit": "#0066ff",
  "integrity.achievement_reviewed": "#22c55e",
  "integrity.achievement_reopened": "#ffd24a",
  "doubles.teams.draw": "#0066ff",
  "doubles.teams.redraw": "#ff005c",
  "shift_wars.team_points.edit": "#ffd24a",
  "shift_wars.starting_points.edit": "#22c55e",
  "shift_wars.roster.assign": "#0066ff",
  "game_type.created": "#22c55e",
  "game_type.updated": "#0066ff",
  "game_type.enabled": "#22c55e",
  "game_type.disabled": "#ffd24a",
  "game_type.deleted": "#ff005c",
  "player.settings_update": "#0066ff",
};

function summarize(row: AuditRow, nameById: Map<number, string>): string {
  const d = row.details ?? {};
  const nameOf = (id: unknown) => (typeof id === "number" ? (nameById.get(id) ?? `#${id}`) : "—");
  const accessLabels:Record<string,string>={isActive:"League",practiceEnabled:"Practice",tourEnabled:"Tour",m501Enabled:"M501",shadowBotEnabled:"Shadow Bot",status:"Status",name:"Name"};

  switch (row.action) {
    case "match.edit":
      return `${d.before?.winner ?? "?"} beat ${d.before?.loser ?? "?"} → ${d.after?.winner ?? "?"} beat ${d.after?.loser ?? "?"}`;
    case "match.delete":
      return `${d.winner ?? "?"} beat ${d.loser ?? "?"} · ${d.stake ?? "?"} pts · ${d.gameType ?? "match"}`;
    case "doubles.match.delete":
    case "shift_wars.match.delete":
      return `${d.title ?? "Team result"}${d.playedAt ? ` · played ${format(new Date(d.playedAt), "d MMM yyyy HH:mm")}` : ""}`;
    case "standings.edit":
      return `${nameOf(d.playerId)} — pos #${d.position}, ${d.wins}W-${d.losses}L, ${d.points}pts, ${d.elo} ELO${d.isChampion ? " · crowned champion" : ""}`;
    case "player.delete":
      return `${d.name ?? "Unknown player"}`;
    case "player.elo_override":
      return `${d.name ?? "Unknown player"} — ${d.beforeElo ?? "?"} → ${d.afterElo} ELO (${d.tier})`;
    case "player.settings_update": {
      const changes=Object.entries(d.changes??{}).map(([field,value]:[string,any])=>{const show=(v:unknown)=>typeof v==="boolean"?(v?"On":"Off"):String(v??"—");return `${accessLabels[field]??field}: ${show(value?.before)} → ${show(value?.after)}`;});
      return `${d.playerName??nameOf(Number(row.entity_id))} · ${changes.join(" · ")}`;
    }
    case "season.reset":
      return `${d.leagueType ?? "singles"} — "${d.name ?? "New season"}"`;
    case "playoff.match_recorded":
      return `${d.round} — ${nameOf(d.player1Id)} vs ${nameOf(d.player2Id)}${d.winnerId ? `, winner: ${nameOf(d.winnerId)}` : ""}`;
    case "playoff.match_edit":
      return `${d.round ? `${d.round} — ` : ""}${d.winnerId ? `winner: ${nameOf(d.winnerId)}` : "updated"}`;
    case "playoff.match_delete":
      return `match #${row.entity_id}`;
    case "integrity.achievement_reviewed":
      return `${nameOf(d.playerId)} · ${d.achievementKey ?? "achievement"} · marked as checked`;
    case "integrity.achievement_reopened":
      return `${nameOf(d.playerId)} · ${d.achievementKey ?? "achievement"} · returned for review`;
    case "doubles.teams.draw":
      return `${d.seasonName ?? "Doubles season"} · ${d.newTeams ?? "?"} teams created`;
    case "doubles.teams.redraw":
      return `${d.seasonName ?? "Doubles season"} · ${d.previousTeams ?? "?"} teams and ${d.removedMatches ?? "?"} results replaced · ${d.newTeams ?? "?"} new teams`;
    case "shift_wars.team_points.edit":
      return `${d.teamName ?? "Team"} · ${d.before ?? "?"} → ${d.after ?? "?"} current points`;
    case "shift_wars.starting_points.edit":
      return `${d.teamName ?? "Team"} · monthly reset value ${d.before ?? "?"} → ${d.after ?? "?"}`;
    case "shift_wars.roster.assign":
      return `${d.playerName ?? "Player"} · ${d.beforeTeamName ?? "Unassigned"} → ${d.afterTeamName ?? "Unassigned"}`;
    case "game_type.created":
      return `${d.name ?? "Game type"} · ${d.engine ?? "?"} engine · ${d.category ?? "?"}`;
    case "game_type.enabled":
    case "game_type.disabled":
      return `${d.name ?? "Game type"} (${d.key ?? "?"})`;
    case "game_type.updated":
      return `${d.name ?? "Game type"} · ${d.before?.engine ?? "?"} → ${d.after?.engine ?? "?"} engine · ${d.after?.category ?? "?"}`;
    case "game_type.deleted":
      return `${d.name ?? "Game type"} (${d.key ?? "?"})`;
    default:
      return JSON.stringify(d);
  }
}

export function AuditLog() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { data: players } = useListPlayers();
  const [filter, setFilter] = useState<"all" | "corrections" | "seasons" | "players" | "integrity" | "shift_wars" | "game_types">("all");
  const nameById = useMemo(
    () => new Map((players ?? []).map((p: any) => [p.id, p.name])),
    [players]
  );

  const load = () => {
    setLoading(true);
    fetch("/api/admin/audit-log?limit=75", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  const matchesFilter = (row:AuditRow,key:typeof filter) => {
    if (key === "all") return true;
    if (key === "corrections") return row.action === "match.edit" || row.action.endsWith("match.delete") || row.action.startsWith("playoff.match_");
    if (key === "seasons") return row.action === "season.reset" || row.action === "standings.edit" || row.action.startsWith("doubles.teams.");
    if (key === "players") return row.action.startsWith("player.");
    if (key === "integrity") return row.action.startsWith("integrity.");
    if (key === "shift_wars") return row.action.startsWith("shift_wars.");
    return row.action.startsWith("game_type.");
  };
  const visibleRows = (rows ?? []).filter(row => matchesFilter(row,filter));

  return (
    <CollapsibleAdminSection title="Audit Log" icon={History} accent="#9ca3af" borderColor="rgba(156,163,175,0.15)" background="rgba(156,163,175,0.02)">
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            A history of consequential admin actions — match corrections, standings edits, player changes, season resets, playoff results, and integrity reviews.
          </p>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shrink-0 ml-3 transition-all disabled:opacity-50"
            style={{ background: "rgba(156,163,175,0.1)", border: "1px solid rgba(156,163,175,0.25)", color: "#9ca3af", fontFamily: "Oswald, sans-serif" }}>
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([['all','All activity'],['corrections','Corrections'],['seasons','Seasons'],['players','Players'],['integrity','Integrity'],['shift_wars','Shift Wars'],['game_types','Game types']] as const).map(([key,label]) => (
            <button key={key} onClick={() => setFilter(key)} className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider"
              style={{ background:filter===key?"rgba(156,163,175,.16)":"rgba(255,255,255,.025)", border:`1px solid ${filter===key?"rgba(156,163,175,.35)":"rgba(255,255,255,.07)"}`, color:filter===key?"#d1d5db":"rgba(255,255,255,.3)", fontFamily:"Oswald, sans-serif" }}>
              {label}{rows ? ` (${rows.filter(row => matchesFilter(row,key)).length})` : ''}
            </button>
          ))}
        </div>

        {rows === null ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#9ca3af" }} />
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
            No {filter === "all" ? "admin actions" : filter} recorded yet.
          </div>
        ) : (
          <div className="space-y-1 max-h-[420px] overflow-y-auto">
            {visibleRows.map(row => {
              const color = ACTION_COLORS[row.action] ?? "#9ca3af";
              return (
                <div key={row.id} className="flex items-start gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="text-xs shrink-0 w-32 pt-0.5" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                    {format(new Date(row.created_at), "d MMM HH:mm")}
                  </div>
                  <div className="shrink-0 w-40">
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded" style={{ background: `${color}18`, color, letterSpacing: "0.04em" }}>
                      {ACTION_LABELS[row.action] ?? row.action}
                    </span>
                  </div>
                  <div className="text-sm flex-1 min-w-0 truncate" style={{ color: "rgba(255,255,255,0.65)" }} title={summarize(row, nameById)}>
                    {summarize(row, nameById)}
                  </div>
                  {row.admin_player_name && (
                    <div className="text-xs shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
                      {row.admin_player_name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CollapsibleAdminSection>
  );
}
