import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type Row = { playerId: number; name: string; position: number; wins: number; losses: number; points: number; isChampion: boolean; matchWins: number; matchLosses: number };
type Season = { seasonId: number; name: string; rows: Row[]; remove: number[]; moves: { playerId: number; from: number; to: number }[]; mismatches: number[]; matchesInSeason: number };

/**
 * Past season tables (Singles): what each finished season's final table says
 * next to what its match rows say. "Tidy" only takes off players whose table
 * row is 0-0 AND who have no matches that season; it can be undone.
 */
export function SeasonTablesCheck() {
  const { toast } = useToast();
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try { const r = await fetch("/api/admin/season-tables/check"); if (!r.ok) throw new Error(String(r.status)); setSeasons((await r.json()).seasons); }
    catch { toast({ title: "Couldn't load the season tables", variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const act = async (what: "tidy" | "restore") => {
    if (what === "tidy" && !window.confirm("Take players with no matches off these past season tables? You can undo this with Restore.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/season-tables/${what}`, { method: "POST" });
      const d = await r.json();
      toast({ title: what === "tidy" ? `Removed ${d.removed?.length ?? 0}, moved ${d.moved?.length ?? 0}` : `Restored ${d.restored ?? 0}` });
      await load();
    } catch { toast({ title: "That didn't work", variant: "destructive" }); setBusy(false); }
  };
  const toRemove = seasons?.reduce((n, s) => n + s.remove.length, 0) ?? 0;
  const mismatches = seasons?.reduce((n, s) => n + s.mismatches.length, 0) ?? 0;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-white/60 text-xs leading-relaxed">
        Each finished Singles season's final table next to its match records. A player is only taken off when their table row is 0–0
        <b> and</b> they have no matches that season. Rows where the table and the matches disagree are marked so you can fix them in the Season Manager.
      </p>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={load} className="adm-chip">{seasons ? "Check again" : "Check past seasons"}</button>
        {seasons && toRemove > 0 && <button disabled={busy} onClick={() => act("tidy")} className="adm-chip" style={{ borderColor: "rgba(255,210,74,.6)", color: "#ffd24a" }}>Tidy ({toRemove} off)</button>}
        <button disabled={busy} onClick={() => act("restore")} className="adm-chip">Restore removed</button>
      </div>
      {seasons && <div className="text-xs text-white/50">{toRemove} to take off · {mismatches} rows where the table and matches disagree</div>}
      {seasons?.map(s => (
        <div key={s.seasonId} className="rounded-xl border border-white/10 overflow-hidden">
          <div className="px-3 py-2 flex justify-between bg-white/[.03]"><b style={{ fontFamily: "Oswald, sans-serif", letterSpacing: ".06em" }}>{s.name}</b><span className="text-xs text-white/50">{s.matchesInSeason} matches recorded</span></div>
          <table className="w-full text-xs">
            <thead><tr className="text-white/40"><th className="text-left px-3 py-1">#</th><th className="text-left">Player</th><th>Table W–L</th><th>Matches W–L</th><th className="text-left">Note</th></tr></thead>
            <tbody>
              {s.rows.map(r => {
                const off = s.remove.includes(r.playerId), bad = s.mismatches.includes(r.playerId), mv = s.moves.find(m => m.playerId === r.playerId);
                return (
                  <tr key={r.playerId} className="border-t border-white/5" style={{ opacity: off ? .55 : 1 }}>
                    <td className="px-3 py-1">{r.position}</td>
                    <td>{r.name}{r.isChampion && " 🏆"}</td>
                    <td className="text-center">{r.wins}–{r.losses}</td>
                    <td className="text-center">{r.matchWins}–{r.matchLosses}</td>
                    <td style={{ color: off ? "#ff7aa8" : bad ? "#ffb070" : "#8cc4ff" }}>{off ? "comes off (no games)" : bad ? "table ≠ matches" : mv ? `moves to ${mv.to}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
