import { useEffect, useState } from "react";
import { RefreshCw, Target, Crown, Ban } from "lucide-react";

type Month = { month: string; [k: string]: unknown };
type TargetAdmin = { live: boolean; month: string; label: string; unit: string; target: number; value: number; sharing: number; voided?: boolean; months: Month[];
  scorerUse?: { month: string; scored: number; total: number }[] };
type GafferAdmin = { live: boolean; month: string; gaffer: { id: number; name: string } | null; chosenBy: string; picking: boolean; pickBy: string; voided?: boolean;
  challenge: null | { label: string; levelName: string; target: number; value: number; paramLabel: string | null; contributors: number }; months: Month[] };

const MONTH = (k: string) => new Date(`${k}-01T12:00:00Z`).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const btn = "adm-btn flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold uppercase";
const post = (url: string, body?: unknown) => fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) })
  .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "That didn't work"); });

/** Admin: League Target and The Gaffer as they run (live or in the background), with fixes for when something goes wrong. */
export function LeagueChallenges({ players }: { players: { id: number; name: string }[] | undefined }) {
  const [lt, setLt] = useState<TargetAdmin | null>(null);
  const [gf, setGf] = useState<GafferAdmin | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState("");
  const load = () => {
    setBusy(true); setErr("");
    Promise.all([fetch("/api/admin/league-target").then(r => r.json()), fetch("/api/admin/gaffer").then(r => r.json())])
      .then(([a, b]) => { setLt(a); setGf(b); }).catch(() => setErr("Couldn't load")).finally(() => setBusy(false));
  };
  useEffect(load, []);
  const act = (fn: () => Promise<void>, confirmText: string) => { if (!window.confirm(confirmText)) return; setBusy(true); fn().then(load).catch(e => { setErr(e.message); setBusy(false); }); };
  const state = (live: boolean) => <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ml-auto" style={{ background: live ? "rgba(34,197,94,.15)" : "rgba(255,210,74,.12)", color: live ? "#4ade80" : "#ffd24a" }}>{live ? "Live" : "Background"}</span>;
  const yesNo = (v: unknown) => v === true ? "✓ Hit" : v === false ? "✗ Missed" : "—";

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-white/45">Both run every month. In the background, nobody sees them and no unlocks go out. Switch them on in Feature Flags.</p>
        <button onClick={load} disabled={busy} className={btn} style={{ border: "1px solid rgba(255,255,255,.13)", color: "rgba(255,255,255,.7)" }}><RefreshCw size={14} className={busy ? "animate-spin" : ""} /><span className="hidden sm:inline">Refresh</span></button>
      </div>
      {err && <div className="rounded-lg p-3 text-sm" style={{ border: "1px solid rgba(255,0,92,.3)", color: "#ff7aa8" }}>{err}</div>}

      {lt?.scorerUse && (
        <div className="rounded-xl p-4 space-y-2.5" style={{ border: "1px solid rgba(34,197,94,.25)", background: "rgba(34,197,94,.04)" }}>
          <b className="uppercase text-sm" style={{ fontFamily: "Oswald, sans-serif" }}>Played on the app's scorer</b>
          <p className="text-xs text-white/45">Results with darts recorded, so their 180s and checkouts count. The rest were entered by hand.</p>
          {lt.scorerUse.map(u => {
            const pct = u.total ? Math.round((u.scored / u.total) * 100) : 0;
            return (
              <div key={u.month} className="flex items-center gap-3 text-xs">
                <span className="w-16 shrink-0 text-white/60">{MONTH(u.month)}</span>
                <span className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.07)" }}><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: "#22c55e" }} /></span>
                <span className="shrink-0 text-right text-white/75 tabular-nums whitespace-nowrap">{u.scored}/{u.total} · {pct}%</span>
              </div>
            );
          })}
        </div>
      )}

      {lt && (
        <div className="rounded-xl p-4 space-y-3" style={{ border: "1px solid rgba(25,195,200,.25)", background: "rgba(25,195,200,.04)" }}>
          <div className="flex items-center gap-2"><Target size={16} style={{ color: "#19c3c8" }} /><b className="uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>League Target · {MONTH(lt.month)}</b>{state(lt.live)}</div>
          {lt.voided ? <p className="text-sm text-amber-300">Cancelled this month.</p> :
            <p className="text-sm text-white/70">{lt.label}: <b>{lt.value}</b> of {lt.target} · {lt.sharing} sharing so far</p>}
          {!lt.voided && <button disabled={busy} className={btn} style={{ border: "1px solid rgba(255,0,92,.35)", color: "#ff7aa8" }}
            onClick={() => act(() => post("/api/admin/league-target/void"), "Cancel this month's League Target? It won't count and nobody gets anything for it.")}><Ban size={14} />Cancel this month</button>}
          <Table rows={lt.months} cols={[["Month", m => MONTH(String(m.month))], ["Target", m => `${m.target}`], ["Result", m => m.voided ? "Cancelled" : m.final_value == null ? "Running" : `${m.final_value} · ${yesNo(m.hit)}`], ["Mode", m => m.settled_at ? (m.live ? "Live" : "Background") : ""]]} />
        </div>
      )}

      {gf && (
        <div className="rounded-xl p-4 space-y-3" style={{ border: "1px solid rgba(34,197,94,.25)", background: "rgba(34,197,94,.04)" }}>
          <div className="flex items-center gap-2"><Crown size={16} style={{ color: "#ffd24a" }} /><b className="uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>The Gaffer · {MONTH(gf.month)}</b>{state(gf.live)}</div>
          {gf.voided ? <p className="text-sm text-amber-300">Cancelled this month.</p> : <>
            <p className="text-sm text-white/70">Gaffer: <b>{gf.gaffer?.name ?? "none"}</b> ({gf.chosenBy === "vote" ? "voted in" : gf.chosenBy === "most_matches" ? "most matches, no votes" : gf.chosenBy === "admin" ? "set by admin" : "nobody eligible"})</p>
            <p className="text-sm text-white/70">{gf.challenge ? <>{gf.challenge.label}{gf.challenge.paramLabel ? ` (${gf.challenge.paramLabel})` : ""} · {gf.challenge.levelName}: <b>{gf.challenge.value}</b> of {gf.challenge.target} · {gf.challenge.contributors} in the squad</>
              : gf.picking ? <>Waiting for the pick, until {new Date(gf.pickBy).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</> : "No challenge set"}</p>
          </>}
          {!gf.voided && <div className="flex flex-wrap gap-2 items-center">
            <select value={pick} onChange={e => setPick(e.target.value)} className="rounded-md px-2 py-2 text-sm" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.13)" }}>
              <option value="">Change the Gaffer…</option>
              {(players ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button disabled={busy || !pick} className={btn} style={{ border: "1px solid rgba(255,210,74,.4)", color: "#ffd24a" }}
              onClick={() => act(() => post("/api/admin/gaffer/set", { playerId: Number(pick) }), "Make this player the Gaffer? Their challenge is cleared and they get 2 days to pick.")}><Crown size={14} />Make Gaffer</button>
            <button disabled={busy} className={btn} style={{ border: "1px solid rgba(255,0,92,.35)", color: "#ff7aa8" }}
              onClick={() => act(() => post("/api/admin/gaffer/void"), "Cancel this month's Gaffer challenge? It won't count and nobody gets anything for it.")}><Ban size={14} />Cancel this month</button>
          </div>}
          <Table rows={gf.months} cols={[["Month", m => MONTH(String(m.month))], ["Gaffer", m => (players ?? []).find(p => p.id === m.gaffer_id)?.name ?? "—"], ["Challenge", m => `${m.challenge ?? "—"}${m.target != null ? ` · ${m.target}` : ""}`],
            ["Result", m => m.voided ? "Cancelled" : m.final_value == null ? "Running" : `${m.final_value} · ${yesNo(m.hit)}`]]} />
        </div>
      )}
    </div>
  );
}

function Table({ rows, cols }: { rows: Month[]; cols: [string, (m: Month) => string][] }) {
  if (!rows?.length) return null;
  return (
    <div className="overflow-x-auto"><table className="w-full text-xs">
      <thead><tr>{cols.map(([h]) => <th key={h} className="text-left py-1.5 pr-3 text-white/40 uppercase font-bold">{h}</th>)}</tr></thead>
      <tbody>{rows.map(m => <tr key={m.month} className="border-t border-white/5">{cols.map(([h, f]) => <td key={h} className="py-1.5 pr-3 text-white/75">{f(m)}</td>)}</tr>)}</tbody>
    </table></div>
  );
}
