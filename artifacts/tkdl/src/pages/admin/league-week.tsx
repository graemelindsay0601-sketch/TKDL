import { useEffect, useState } from "react";
import { Copy, Share2, Check, RefreshCw, Users, AlertTriangle } from "lucide-react";

type Data = {
  digest: { text: string; matches: number };
  health: { activePlayers: number; pairings: number; notMet: { a: string; b: string }[]; notMetCount: number; possibleDuplicates: { ids: number[]; winner: string; loser: string; at: string }[] };
};

/** Admin: this week's round-up to paste into the group chat, and a few league-health checks. */
export function LeagueWeek() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const load = () => { setLoading(true); setError(""); fetch("/api/admin/league-week").then(async r => { if (!r.ok) throw new Error("Couldn't load this week's round-up"); return r.json(); }).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(load, []);
  const copy = async () => { if (!data) return; try { await navigator.clipboard.writeText(data.digest.text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setError("Copy didn't work on this device; select the text instead."); } };
  const share = async () => { if (!data) return; try { await navigator.share?.({ text: data.digest.text }); } catch { /* cancelled */ } };
  const met = data ? data.health.pairings - data.health.notMetCount : 0;
  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-lg font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>Weekly round-up</h3>
          <p className="text-sm text-white/40">The last 7 days, ready to paste into the group chat.</p></div>
        <button onClick={load} disabled={loading} className="adm-btn flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold uppercase" style={{ border: "1px solid rgba(255,255,255,.13)", color: "rgba(255,255,255,.7)" }}><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</button>
      </div>
      {error && <div className="rounded-lg p-3 text-sm" style={{ border: "1px solid rgba(255,0,92,.3)", color: "#ff7aa8" }}>{error}</div>}
      {data && <>
        <pre className="whitespace-pre-wrap text-sm rounded-xl p-4" style={{ fontFamily: "Inter, system-ui, sans-serif", background: "linear-gradient(160deg, rgba(37,211,102,.08), rgba(12,10,18,.9))", border: "1px solid rgba(37,211,102,.3)", color: "#e8f5ec", lineHeight: 1.5 }}>{data.digest.text}</pre>
        <div className="flex gap-2">
          <button onClick={copy} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold uppercase text-sm" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: ".1em", color: "#06200f", background: "linear-gradient(180deg,#4ff09a,#1fb865)" }}>
            {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy"}</button>
          {"share" in navigator && <button onClick={share} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold uppercase text-sm" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: ".1em", color: "#fff", border: "1px solid rgba(255,255,255,.2)" }}><Share2 size={16} />Share</button>}
        </div>

        <div>
          <h3 className="text-lg font-bold uppercase flex items-center gap-2" style={{ fontFamily: "Oswald, sans-serif" }}><Users size={16} style={{ color: "#3ee0b4" }} />Who hasn't played who</h3>
          <p className="text-sm text-white/40 mb-2">This singles season: {met} of {data.health.pairings} pairings have met ({data.health.pairings ? Math.round(met / data.health.pairings * 100) : 0}%).</p>
          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,.06)" }}><div className="h-full" style={{ width: `${data.health.pairings ? met / data.health.pairings * 100 : 0}%`, background: "linear-gradient(90deg,#3ee0b4,#4fa8ff)" }} /></div>
          {data.health.notMetCount > 0 && <div className="flex flex-wrap gap-1.5">
            {data.health.notMet.map((p, i) => <span key={i} className="text-xs rounded-full px-2.5 py-1" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#d8d4e6" }}>{p.a} <span className="text-white/30">v</span> {p.b}</span>)}
            {data.health.notMetCount > data.health.notMet.length && <span className="text-xs text-white/40 px-1 py-1">and {data.health.notMetCount - data.health.notMet.length} more</span>}
          </div>}
        </div>

        <div>
          <h3 className="text-lg font-bold uppercase flex items-center gap-2" style={{ fontFamily: "Oswald, sans-serif" }}><AlertTriangle size={16} style={{ color: "#ffd24a" }} />Possible double entries</h3>
          {data.health.possibleDuplicates.length === 0
            ? <p className="text-sm text-white/40">None in the last 30 days.</p>
            : <><p className="text-sm text-white/40 mb-2">The same winner and loser recorded within five minutes. Check these and delete the copy from the match page if it's a mistake.</p>
              <div className="space-y-1.5">{data.health.possibleDuplicates.map(d => (
                <a key={d.ids.join("-")} href={`/match-centre/league-${d.ids[1]}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(255,210,74,.06)", border: "1px solid rgba(255,210,74,.25)" }}>
                  <span><b style={{ color: "#fff" }}>{d.winner}</b> <span className="text-white/40">beat</span> {d.loser}</span>
                  <span className="text-xs text-white/50">{new Date(d.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · #{d.ids[0]} & #{d.ids[1]}</span>
                </a>))}</div></>}
        </div>
      </>}
    </div>
  );
}
