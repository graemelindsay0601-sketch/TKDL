import { useState } from "react";
import { Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { getListPlayersQueryKey } from "@workspace/api-client-react";
import { CollapsibleAdminSection } from "./collapsible-section";

export function UserAccountsManager({ players }: { players: any[] | undefined }) {
  const { toast }                         = useToast();
  const [accounts, setAccounts]           = useState<any[]>([]);
  const [loading, setLoading]             = useState(false);
  const [createPlayerId, setCreatePlayerId] = useState("");
  const [createPwd, setCreatePwd]         = useState("");
  const [createIsAdmin, setCreateIsAdmin] = useState(false);
  const [creating, setCreating]           = useState(false);
  const [revealed, setRevealed]           = useState<Record<number, string>>({});
  const [resetPwd, setResetPwd]           = useState<Record<number, string>>({});
  const [resetting, setResetting]         = useState<number | null>(null);
  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [newName, setNewName]             = useState("");
  const [newPwd, setNewPwd]               = useState("");
  const [newIsAdmin, setNewIsAdmin]       = useState(false);
  const [creatingNew, setCreatingNew]     = useState(false);
  const [loaded, setLoaded]               = useState(false);
  const queryClient = useQueryClient();

  const adminPin = () => sessionStorage.getItem("tkdl_admin_pin") ?? "";
  const adminHeaders = () => ({ "Content-Type": "application/json", "x-admin-pin": adminPin() });

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users", { credentials: "include", headers: { "x-admin-pin": adminPin() } });
    if (res.ok) setAccounts(await res.json());
    setLoading(false);
    setLoaded(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST", credentials: "include",
      headers: adminHeaders(),
      body: JSON.stringify({ playerId: Number(createPlayerId), password: createPwd, isAdmin: createIsAdmin }),
    });
    const data = await res.json();
    if (res.ok) {
      toast({ title: `Account created: @${data.username}`, description: "Initial password shown above — write it down." });
      setRevealed(p => ({ ...p, [data.id]: createPwd }));
      setCreatePlayerId(""); setCreatePwd(""); setCreateIsAdmin(false);
      void load();
    } else {
      toast({ title: "Error", description: data.error, variant: "destructive" });
    }
    setCreating(false);
  };

  const handleReset = async (userId: number) => {
    const pwd = resetPwd[userId];
    if (!pwd || pwd.length < 4) { toast({ title: "Password too short (min 4 chars)", variant: "destructive" }); return; }
    setResetting(userId);
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
      method: "POST", credentials: "include", headers: adminHeaders(), body: JSON.stringify({ password: pwd }),
    });
    const data = await res.json();
    if (res.ok) {
      toast({ title: `Password reset for @${data.username}`, description: "New password shown — write it down." });
      setRevealed(p => ({ ...p, [userId]: pwd }));
      setResetPwd(p => ({ ...p, [userId]: "" }));
    } else {
      toast({ title: "Error", description: data.error, variant: "destructive" });
    }
    setResetting(null);
  };

  const handleCreateNewPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreatingNew(true);
    const playerRes = await fetch("/api/players", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const playerData = await playerRes.json();
    if (!playerRes.ok) {
      toast({ title: "Failed to create player", description: playerData.error ?? "Unknown error", variant: "destructive" });
      setCreatingNew(false); return;
    }
    const userRes = await fetch("/api/admin/users", {
      method: "POST", credentials: "include", headers: adminHeaders(),
      body: JSON.stringify({ playerId: playerData.id, password: newPwd, isAdmin: newIsAdmin }),
    });
    const userData = await userRes.json();
    if (userRes.ok) {
      toast({ title: `${playerData.name} added to the league!`, description: `Login: @${userData.username} — password shown above.` });
      setRevealed(p => ({ ...p, [userData.id]: newPwd }));
      setNewName(""); setNewPwd(""); setNewIsAdmin(false); setShowNewPlayer(false);
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
      void load();
    } else {
      toast({ title: "Player created but account failed", description: userData.error, variant: "destructive" });
    }
    setCreatingNew(false);
  };

  const playersWithoutAccount = (players ?? []).filter(p => !accounts.some(a => a.playerId === p.id));

  const badge = (
    <>
      <span className="text-xs mx-1" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
        {accounts.length} accounts
      </span>
      <button onClick={e => { e.stopPropagation(); setShowNewPlayer(p => !p); if (!loaded) void load(); }}
        className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
        style={{ background: showNewPlayer ? "rgba(0,229,160,0.12)" : "rgba(0,229,160,0.06)", border: `1px solid ${showNewPlayer ? "rgba(0,229,160,0.35)" : "rgba(0,229,160,0.15)"}`, color: "#00e5a0", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
        + New Player
      </button>
    </>
  );

  const handleOpen = () => { if (!loaded) void load(); };

  return (
    <CollapsibleAdminSection title="Player Accounts" icon={Users} accent="#4d94ff" borderColor="rgba(0,102,255,0.15)" background="rgba(0,102,255,0.02)" badge={badge}>
      <div className="p-5" onClick={e => { if (!loaded && e.currentTarget === e.target) handleOpen(); }}>
        {!loaded ? (
          <button onClick={() => void load()} className="text-xs py-2 w-full text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
            {loading ? "Loading…" : "Load accounts"}
          </button>
        ) : loading ? (
          <div className="py-4 text-center" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.8rem" }}>Loading…</div>
        ) : accounts.length > 0 ? (
          <div className="rounded-xl overflow-hidden mb-5" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            {accounts.map((acc, i) => (
              <div key={acc.id} style={{ borderBottom: i < accounts.length - 1 ? "1px solid rgba(255,255,255,0.05)" : undefined, padding: "0.75rem 1rem" }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>@{acc.username}</span>
                      <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)" }}>→ {acc.playerName}</span>
                      {acc.isAdmin && (
                        <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(255,210,74,0.12)", color: "#ffd24a", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.1em" }}>ADMIN</span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.22)", marginTop: "1px" }}>
                      {acc.lastLoginAt ? `Last login: ${new Date(acc.lastLoginAt).toLocaleDateString()}` : "Never logged in"}
                    </div>
                  </div>
                  {revealed[acc.id] && (
                    <div className="px-2 py-1 rounded-lg shrink-0" style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#00e5a0", letterSpacing: "0.05em" }}>{revealed[acc.id]}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="New password (min 4 chars)" value={resetPwd[acc.id] ?? ""} onChange={e => setResetPwd(p => ({ ...p, [acc.id]: e.target.value }))}
                    className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontFamily: "Oswald, sans-serif" }} />
                  <button onClick={() => handleReset(acc.id)} disabled={resetting === acc.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity disabled:opacity-50"
                    style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.25)", color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                    {resetting === acc.id ? "…" : "Reset"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-4 py-4 text-center rounded-xl" style={{ border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", fontSize: "0.78rem" }}>
            No accounts yet — create the first one below
          </div>
        )}

        {loaded && playersWithoutAccount.length > 0 && (
          <form onSubmit={handleCreate} className="space-y-3">
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.52rem", letterSpacing: "0.18em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: "0.25rem" }}>Create New Account</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>Player</label>
                <select value={createPlayerId} onChange={e => setCreatePlayerId(e.target.value)} required
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "Oswald, sans-serif" }}>
                  <option value="">Select player…</option>
                  {playersWithoutAccount.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>Initial Password</label>
                <input type="text" placeholder="Set their password" value={createPwd} onChange={e => setCreatePwd(e.target.value)} required minLength={4}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "Oswald, sans-serif" }} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={createIsAdmin} onChange={e => setCreateIsAdmin(e.target.checked)} className="rounded" style={{ accentColor: "#ffd24a" }} />
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em" }}>Admin access</span>
              </label>
              <button type="submit" disabled={creating}
                className="px-4 py-2 rounded-lg text-sm font-bold transition-opacity disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, rgba(0,102,255,0.25), rgba(0,102,255,0.12))", border: "1px solid rgba(0,102,255,0.35)", color: "#4d94ff", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
                {creating ? "Creating…" : "Create Account"}
              </button>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>
              Username is auto-generated from the player's name. Password is shown once — write it down to hand out.
            </p>
          </form>
        )}
        {loaded && playersWithoutAccount.length === 0 && accounts.length > 0 && !showNewPlayer && (
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
            All active players have accounts. Use <strong>+ New Player</strong> to add someone new to the league.
          </p>
        )}

        {showNewPlayer && (
          <form onSubmit={handleCreateNewPlayer} className="mt-4 space-y-3 rounded-xl p-4" style={{ background: "rgba(0,229,160,0.03)", border: "1px solid rgba(0,229,160,0.12)" }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.52rem", letterSpacing: "0.18em", color: "rgba(0,229,160,0.5)", textTransform: "uppercase", marginBottom: "0.25rem" }}>Register New Player + Account</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>Full Name</label>
                <input type="text" placeholder="e.g. Jamie Smith" value={newName} onChange={e => setNewName(e.target.value)} required
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "Oswald, sans-serif" }} />
              </div>
              <div>
                <label className="block mb-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>Initial Password</label>
                <input type="text" placeholder="Set their password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required minLength={4}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "Oswald, sans-serif" }} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newIsAdmin} onChange={e => setNewIsAdmin(e.target.checked)} className="rounded" style={{ accentColor: "#ffd24a" }} />
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em" }}>Admin access</span>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowNewPlayer(false); setNewName(""); setNewPwd(""); }}
                  className="px-3 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                  Cancel
                </button>
                <button type="submit" disabled={creatingNew}
                  className="px-4 py-2 rounded-lg text-sm font-bold transition-opacity disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, rgba(0,229,160,0.2), rgba(0,229,160,0.08))", border: "1px solid rgba(0,229,160,0.35)", color: "#00e5a0", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
                  {creatingNew ? "Adding…" : "Add to League"}
                </button>
              </div>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
              Creates the player profile and their login account in one step. Username is auto-generated from their name.
            </p>
          </form>
        )}
      </div>
    </CollapsibleAdminSection>
  );
}
