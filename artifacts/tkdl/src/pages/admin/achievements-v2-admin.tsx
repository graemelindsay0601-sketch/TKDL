import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

type Status = { enabled: boolean; launchedAt: string | null; welcomeCoins: number;
  lastSync: null | { error: string; at: string } | { mode: string; players: number; itemsWritten: number; unlocks: number; coinsPaid: number; welcomed: number; ms: number; at: string } };

/**
 * Achievements v2: preview, the history report, and the switch.
 * Turning it on the first time credits everyone's history (no coins) and pays the one-off welcome bonus;
 * after that new unlocks pay coins and show the unlock pop-up.
 */
export function AchievementsV2Admin() {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");

  const load = useCallback(async () => {
    try { const r = await fetch("/api/admin/achievements-v2/status", { credentials: "include" }); if (r.ok) setStatus(await r.json()); } catch { /* shown as loading */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const call = async (path: string, done: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/achievements-v2/${path}`, { method: "POST", credentials: "include" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Request failed");
      toast({ title: done });
      setConfirm("");
      // the launch sync runs in the background; check back for its result
      setTimeout(load, 1500); setTimeout(load, 8000); setTimeout(load, 20000);
    } catch (e) { toast({ title: "Achievements", description: e instanceof Error ? e.message : "Please try again", variant: "destructive" }); }
    finally { setBusy(false); void load(); }
  };

  const last = status?.lastSync;
  return (
    <div className="space-y-4 px-1 pt-3 pb-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full px-3 py-1 font-bold" style={{ background: status?.enabled ? "rgba(34,197,94,.15)" : "rgba(255,255,255,.06)", color: status?.enabled ? "#4ade80" : "rgba(255,255,255,.6)" }}>
          {status ? (status.enabled ? "Live" : "Switched off") : "Loading…"}
        </span>
        {status?.launchedAt && <span className="text-white/50">Launched {new Date(status.launchedAt).toLocaleString("en-GB")}</span>}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/achievements" className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm hover:bg-white/10">
          <b>Preview the cabinet</b><div className="text-white/50">{status?.enabled ? "Your achievements as players see them." : "Worked out live from history. Nothing is saved while it's off."}</div>
        </Link>
        <a href="/api/admin/achievements-v2/report" target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm hover:bg-white/10">
          <b>History report</b><div className="text-white/50">What everyone would get, area by area. Opens in a new tab.</div>
        </a>
      </div>

      {last && <div className="rounded-lg border border-white/10 p-3 text-sm">
        <b>Last update</b> <span className="text-white/50">{new Date(last.at).toLocaleString("en-GB")}</span>
        {"error" in last ? <div className="text-red-400">Failed: {last.error}</div>
          : <div className="text-white/60">{last.mode === "history" ? "Launch (history credit)" : "Live"} · {last.players} players · {last.unlocks} new unlocks · {last.coinsPaid.toLocaleString("en-GB")} coins paid{last.welcomed ? ` · ${last.welcomed} welcome bonuses` : ""} · {last.ms} ms</div>}
      </div>}

      {status && !status.enabled && (
        <div className="space-y-2 rounded-lg border border-yellow-500/30 p-3">
          <h3 className="font-bold">Switch the new achievements on</h3>
          <p className="text-sm text-white/60">
            {status.launchedAt
              ? "They've been launched before, so this just turns them back on. Anything earned while they were off is picked up and paid on the first update."
              : `The first time, everyone's history is credited (no coins for history) and each player with something earned gets a one-off ${status.welcomeCoins}-coin welcome bonus. After that, new unlocks pay coins and show the unlock pop-up. The Achievements page and profiles switch to the new cabinet.`}
          </p>
          <label htmlFor="av2-confirm" className="block text-sm">Type SWITCH ON to confirm</label>
          <input id="av2-confirm" value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy} autoComplete="off" className="w-full rounded border bg-background p-2" />
          <button type="button" disabled={busy || confirm !== "SWITCH ON"} onClick={() => call("enable", "Achievements switched on: the first update is running")}
            className="rounded bg-yellow-500 px-3 py-2 font-bold text-black disabled:opacity-40">{busy ? "Switching on…" : "Switch on"}</button>
        </div>
      )}

      {status?.enabled && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => call("sync", "Achievements updated")} className="rounded border border-white/15 px-3 py-2 text-sm disabled:opacity-40">Run an update now</button>
          <button type="button" disabled={busy} onClick={() => call("disable", "Achievements switched off")} className="rounded border border-red-500/40 px-3 py-2 text-sm text-red-300 disabled:opacity-40">Switch off</button>
        </div>
      )}
    </div>
  );
}
