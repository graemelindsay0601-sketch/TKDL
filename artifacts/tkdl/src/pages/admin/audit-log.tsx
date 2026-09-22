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
  "standings.edit":          "Standings edited",
  "player.delete":           "Player deleted",
  "player.elo_override":     "Elo overridden",
  "season.reset":            "Season reset",
  "playoff.match_recorded":  "Playoff match recorded",
  "playoff.match_edit":      "Playoff match edited",
  "playoff.match_delete":    "Playoff match deleted",
};

const ACTION_COLORS: Record<string, string> = {
  "player.delete":  "#ff005c",
  "season.reset":   "#ff005c",
  "player.elo_override": "#ffd24a",
  "match.edit":     "#0066ff",
  "standings.edit": "#0066ff",
};

function summarize(row: AuditRow, nameById: Map<number, string>): string {
  const d = row.details ?? {};
  const nameOf = (id: unknown) => (typeof id === "number" ? (nameById.get(id) ?? `#${id}`) : "—");

  switch (row.action) {
    case "match.edit":
      return `${d.before?.winner ?? "?"} beat ${d.before?.loser ?? "?"} → ${d.after?.winner ?? "?"} beat ${d.after?.loser ?? "?"}`;
    case "standings.edit":
      return `${nameOf(d.playerId)} — pos #${d.position}, ${d.wins}W-${d.losses}L, ${d.points}pts, ${d.elo} ELO${d.isChampion ? " · crowned champion" : ""}`;
    case "player.delete":
      return `${d.name ?? "Unknown player"}`;
    case "player.elo_override":
      return `${d.name ?? "Unknown player"} — ${d.beforeElo ?? "?"} → ${d.afterElo} ELO (${d.tier})`;
    case "season.reset":
      return `${d.leagueType ?? "singles"} — "${d.name ?? "New season"}"`;
    case "playoff.match_recorded":
      return `${d.round} — ${nameOf(d.player1Id)} vs ${nameOf(d.player2Id)}${d.winnerId ? `, winner: ${nameOf(d.winnerId)}` : ""}`;
    case "playoff.match_edit":
      return `${d.round ? `${d.round} — ` : ""}${d.winnerId ? `winner: ${nameOf(d.winnerId)}` : "updated"}`;
    case "playoff.match_delete":
      return `match #${row.entity_id}`;
    default:
      return JSON.stringify(d);
  }
}

export function AuditLog() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { data: players } = useListPlayers();
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

  return (
    <CollapsibleAdminSection title="Audit Log" icon={History} accent="#9ca3af" borderColor="rgba(156,163,175,0.15)" background="rgba(156,163,175,0.02)">
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            A history of consequential admin actions — match edits, standings edits, Elo overrides, player deletes, season resets, and playoff results.
          </p>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shrink-0 ml-3 transition-all disabled:opacity-50"
            style={{ background: "rgba(156,163,175,0.1)", border: "1px solid rgba(156,163,175,0.25)", color: "#9ca3af", fontFamily: "Oswald, sans-serif" }}>
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {rows === null ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#9ca3af" }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
            No admin actions recorded yet.
          </div>
        ) : (
          <div className="space-y-1 max-h-[420px] overflow-y-auto">
            {rows.map(row => {
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
