import React, { useState } from "react";
import {
  useListPlayers, useUpdatePlayer, useResetSeason, useListMatches, useDeleteMatch,
  getListPlayersQueryKey, getGetStatsSummaryQueryKey, getGetCurrentSeasonQueryKey,
  getListSeasonsQueryKey, getGetLeaderboardQueryKey, getListMatchesQueryKey,
  getGetRecentActivityQueryKey, getGetPlayerStatsQueryKey, getGetPlayerQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, RotateCcw, AlertTriangle, Swords, Trash2, Users, Lock, ChevronDown, ChevronUp, Trophy, Zap, Pencil, Check } from "lucide-react";
import { format } from "date-fns";

import { ADMIN_PIN_KEY, PinScreen } from "./pin-screen";
import { CollapsibleAdminSection } from "./collapsible-section";
import { FeatureFlags } from "./feature-flags";
import { GameTypesManager } from "./game-types-manager";
import { UserAccountsManager } from "./user-accounts-manager";
import { SeasonEditor } from "./season-editor";
import { TourDataManager } from "./tour-data-manager";
import { PracticeAnalytics } from "./practice-analytics";
import { SweepTool } from "./sweep-tool";
import { TestComms } from "./test-comms";
import { DataManagement } from "./data-management";
import { AnnouncementsManager } from "./announcements-manager";
import { NotificationAnalytics } from "./notification-analytics";
import AdminCardClashPanel from "@/components/admin-card-clash-panel";
import AdminChallengesPanel from "@/components/admin-challenges-panel";
import AdminFeatureFlagsPanel from "@/components/admin-feature-flags-panel";

type ModeKey = "isActive" | "practiceEnabled" | "tourEnabled" | "m501Enabled" | "shadowBotEnabled";
const PLAYER_MODES: { key: ModeKey; label: string; desc: string; color: string; emoji: string }[] = [
  { key: "isActive",         label: "League",    desc: "Participates in the current season", color: "#22c55e", emoji: "🏆" },
  { key: "practiceEnabled",  label: "Practice",  desc: "Can use Practice mode",              color: "#38bdf8", emoji: "🎯" },
  { key: "tourEnabled",      label: "Tour",      desc: "Can enter Tour Mode events",         color: "#c084fc", emoji: "⭐" },
  { key: "m501Enabled",      label: "M501",      desc: "Can play Master 501 runs",           color: "#ffd24a", emoji: "🎱" },
  { key: "shadowBotEnabled", label: "Shadow Bot", desc: "Can train against Shadow Bot",      color: "#f97316", emoji: "🤖" },
];

export default function Admin() {
  const { data: players, isLoading: isLoadingPlayers } = useListPlayers();
  const { data: matches, isLoading: isLoadingMatches } = useListMatches({ limit: 30 });
  const updatePlayerMutation = useUpdatePlayer();
  const resetSeasonMutation  = useResetSeason();
  const deleteMatchMutation  = useDeleteMatch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [seasonName, setSeasonName]               = useState("");
  const [isSweeping, setIsSweeping]               = useState(false);
  const [eloPlayerId, setEloPlayerId]             = useState<number | null>(null);
  const [eloValue, setEloValue]                   = useState(1000);
  const [eloLoading, setEloLoading]               = useState(false);
  const [editingMatchId, setEditingMatchId]       = useState<number | null>(null);
  const [editMatchForm, setEditMatchForm]         = useState({ winnerId: 0, loserId: 0 });
  const [editMatchLoading, setEditMatchLoading]   = useState(false);
  const [unlocked, setUnlocked]                   = useState(() => sessionStorage.getItem(ADMIN_PIN_KEY) === "1");
  const [deletingPlayerId, setDeletingPlayerId]   = useState<number | null>(null);
  const [expandedPlayers, setExpandedPlayers]     = useState<Set<number>>(new Set());
  const [modeToggling, setModeToggling]           = useState<string | null>(null);

  if (!unlocked) return <PinScreen onUnlock={() => setUnlocked(true)} />;

  const handleDeletePlayer = async (id: number, name: string) => {
    setDeletingPlayerId(id);
    try {
      const res = await fetch(`/api/admin/players/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `${name} deleted`, description: "Player and all related data removed." });
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
      } else {
        toast({ title: "Delete failed", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
    setDeletingPlayerId(null);
  };

  const handleToggleActive = (id: number, current: boolean) => {
    updatePlayerMutation.mutate(
      { id, data: { isActive: !current } },
      {
        onSuccess: () => { toast({ title: "Player Updated" }); queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() }); },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleModeToggle = async (playerId: number, field: ModeKey, newVal: boolean) => {
    const key = `${playerId}:${field}`;
    setModeToggling(key);
    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newVal }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Update failed", description: d.error ?? "Unknown error", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
    setModeToggling(null);
  };

  const handleResetSeason = () => {
    resetSeasonMutation.mutate(
      { data: { name: seasonName || undefined } },
      {
        onSuccess: (data: any) => {
          toast({ title: "Season Reset", description: `"${data.name}" has started!` });
          setSeasonName("");
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCurrentSeasonQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSeasonsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        },
        onError: (e: any) => toast({ title: "Error resetting season", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleEloOverride = async () => {
    if (!eloPlayerId) return;
    setEloLoading(true);
    try {
      const res = await fetch(`/api/admin/players/${eloPlayerId}/elo`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elo: eloValue }),
      });
      const data = await res.json();
      if (data.ok) {
        const name = players?.find(p => p.id === eloPlayerId)?.name ?? "Player";
        toast({ title: "Elo Updated", description: `${name} → ${eloValue} Elo (${data.tier})` });
        queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        setEloPlayerId(null);
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setEloLoading(false);
  };

  const handleDeleteMatch = (matchId: number, winnerId: number, loserId: number) => {
    deleteMatchMutation.mutate(
      { id: matchId },
      {
        onSuccess: () => {
          toast({ title: "Match Deleted", description: "Stats reverted." });
          queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(winnerId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(loserId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(winnerId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(loserId) });
        },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleEditMatch = async () => {
    if (!editingMatchId || !editMatchForm.winnerId || !editMatchForm.loserId) return;
    if (editMatchForm.winnerId === editMatchForm.loserId) return;
    setEditMatchLoading(true);
    try {
      const res = await fetch(`/api/admin/matches/${editingMatchId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editMatchForm),
      });
      const data = await res.json();
      if (res.ok) {
        const eloMsg = data.eloChange != null ? ` Elo recalculated (±${data.eloChange}).` : "";
        toast({ title: "Match Updated", description: `Winner and loser corrected.${eloMsg}` });
        setEditingMatchId(null);
        queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setEditMatchLoading(false);
  };

  const handleSweepAchievements = async () => {
    setIsSweeping(true);
    try {
      const res = await fetch("/api/admin/achievement-sweep", { method: "POST" });
      const data = await res.json();
      toast({ title: "Achievement Sweep Complete", description: `${data.totalGranted} achievements granted across ${data.playersChecked} players.` });
    } catch (e: any) {
      toast({ title: "Sweep failed", description: e.message, variant: "destructive" });
    }
    setIsSweeping(false);
  };

  return (
    <div className="space-y-8">
      <div className="pdc-divider" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6" style={{ color: "#ff005c", filter: "drop-shadow(0 0 6px rgba(255,0,92,0.6))" }} />
          <div>
            <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", textShadow: "0 0 20px rgba(255,0,92,0.4)" }}>Admin Panel</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>League management · Dangerous operations</p>
          </div>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem(ADMIN_PIN_KEY); setUnlocked(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold hover:bg-white/5 transition-colors"
          style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Lock className="w-3 h-3" /> Lock
        </button>
      </div>

      <FeatureFlags />
      <GameTypesManager />
      <UserAccountsManager players={players} />

      {/* Season Manager */}
      <CollapsibleAdminSection title="Season Manager" icon={Trophy} accent="#ffd24a" borderColor="rgba(255,210,74,0.15)" background="rgba(255,210,74,0.02)">
        <div className="p-5"><SeasonEditor /></div>
      </CollapsibleAdminSection>

      {/* Start New Season */}
      <CollapsibleAdminSection title="Start New Season" icon={RotateCcw} accent="#ff005c" borderColor="rgba(255,0,92,0.2)" background="rgba(255,0,92,0.03)">
        <div className="p-5">
          <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
            End the current season and start a new one. All players reset to 25 pts. Elo and career stats preserved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="flex-1">
              <Input placeholder="Custom season name (optional)" value={seasonName} onChange={e => setSeasonName(e.target.value)}
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,0,92,0.2)" }} />
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.22)" }}>Leave blank for auto-generated name</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="gap-2 font-bold uppercase tracking-wider whitespace-nowrap" style={{ background: "#ff005c", border: "none", fontFamily: "Oswald, sans-serif" }}>
                  <AlertTriangle className="w-4 h-4" /> Reset Season
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent style={{ background: "hsl(240 20% 7%)", borderColor: "rgba(255,0,92,0.3)" }}>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                    <AlertTriangle className="w-5 h-5" /> Are you absolutely sure?
                  </AlertDialogTitle>
                  <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                    This will end the current active season, crown the champion, and reset all players to 25 pts. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetSeason} style={{ background: "#ff005c", color: "#fff", border: "none" }}>Yes, End Season</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CollapsibleAdminSection>

      <TourDataManager players={players ?? []} />

      {/* Achievement Sweep */}
      <CollapsibleAdminSection title="Achievement Sweep" icon={Zap} accent="#0066ff" borderColor="rgba(0,102,255,0.2)" background="rgba(0,102,255,0.02)">
        <div className="p-5 flex items-center justify-between gap-4">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Retroactively check and grant all earned achievements based on current career stats</p>
          <Button onClick={handleSweepAchievements} disabled={isSweeping}
            className="gap-2 font-bold uppercase tracking-wider shrink-0"
            style={{ background: "#0066ff", border: "none", fontFamily: "Oswald, sans-serif", minWidth: 120 }}>
            {isSweeping ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#fff" }} /> Sweeping...</> : <><Zap className="w-4 h-4" /> Run Sweep</>}
          </Button>
        </div>
      </CollapsibleAdminSection>

      {/* Elo Override */}
      <CollapsibleAdminSection title="Elo Override" icon={Zap} accent="#0066ff" borderColor="rgba(0,102,255,0.2)" background="rgba(0,102,255,0.02)">
        <div className="p-5">
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <select value={eloPlayerId ?? ""} onChange={e => { const id = e.target.value ? Number(e.target.value) : null; setEloPlayerId(id); const p = players?.find(pl => pl.id === id); if (p) setEloValue(p.elo); }}
              className="flex-1 rounded-lg text-sm px-3 py-2 min-w-0"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,102,255,0.25)", color: "rgba(255,255,255,0.75)", fontFamily: "Oswald, sans-serif" }}>
              <option value="">Select player…</option>
              {players?.map(p => <option key={p.id} value={p.id} style={{ background: "#0a0814" }}>{p.name} (Elo {p.elo})</option>)}
            </select>
            <Input type="number" min={800} max={2000} value={eloValue} onChange={e => setEloValue(Number(e.target.value))} placeholder="800 – 2000" className="w-36"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(0,102,255,0.25)" }} />
            <Button onClick={handleEloOverride} disabled={!eloPlayerId || eloLoading}
              className="gap-2 font-bold uppercase tracking-wider whitespace-nowrap"
              style={{ background: "#0066ff", border: "none", fontFamily: "Oswald, sans-serif", minWidth: 110 }}>
              {eloLoading ? <div className="w-3.5 h-3.5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#fff" }} /> : <Zap className="w-4 h-4" />}
              Set Elo
            </Button>
          </div>
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>Tier is recalculated automatically. Career peak Elo is not affected.</p>
        </div>
      </CollapsibleAdminSection>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Roster */}
        <CollapsibleAdminSection title="Roster" icon={Users} accent="#0066ff">
          {isLoadingPlayers ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} /></div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              {players?.map(player => {
                const p = player as any;
                const isExpanded = expandedPlayers.has(player.id);
                const enabledCount = PLAYER_MODES.filter(m => p[m.key] !== false).length;
                return (
                  <div key={player.id}>
                    <div className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02]">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)" }}>{player.name}</div>
                        <div className="text-xs font-mono" style={{ color: "#0066ff" }}>{player.elo} Elo · {player.points}pts</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {PLAYER_MODES.map(m => (
                          <div key={m.key} title={`${m.label}: ${p[m.key] !== false ? "on" : "off"}`} className="w-2 h-2 rounded-full transition-colors" style={{ background: p[m.key] !== false ? m.color : "rgba(255,255,255,0.1)" }} />
                        ))}
                        <span className="ml-1 text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>{enabledCount}/5</span>
                      </div>
                      <button onClick={() => setExpandedPlayers(prev => { const next = new Set(prev); if (next.has(player.id)) next.delete(player.id); else next.add(player.id); return next; })}
                        className="p-1 rounded transition-colors hover:bg-white/10" title="Manage modes">
                        {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} />}
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-500/10" disabled={deletingPlayerId === player.id}>
                            {deletingPlayerId === player.id
                              ? <div className="w-3 h-3 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
                              : <Trash2 className="h-3 w-3" style={{ color: "rgba(255,0,92,0.5)" }} />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent style={{ background: "hsl(240 20% 7%)", borderColor: "rgba(255,0,92,0.3)" }}>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                              <AlertTriangle className="w-5 h-5" /> Delete {player.name}?
                            </AlertDialogTitle>
                            <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                              This permanently removes <strong style={{ color: "#fff" }}>{player.name}</strong> and all their data — matches, achievements, titles, tour runs, and their login account. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeletePlayer(player.id, player.name)} style={{ background: "#ff005c", color: "#fff", border: "none" }}>Delete Forever</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1 space-y-1" style={{ background: "rgba(255,255,255,0.015)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em" }}>MODE ACCESS — toggle to restrict/restore</div>
                        {PLAYER_MODES.map(m => {
                          const isOn = p[m.key] !== false;
                          const toggling = modeToggling === `${player.id}:${m.key}`;
                          return (
                            <div key={m.key} className="flex items-center justify-between py-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{m.emoji}</span>
                                <span className="text-xs font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", color: isOn ? m.color : "rgba(255,255,255,0.3)" }}>{m.label}</span>
                                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{m.desc}</span>
                              </div>
                              <Switch checked={isOn} onCheckedChange={val => handleModeToggle(player.id, m.key, val)} disabled={toggling} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleAdminSection>

        {/* Recent Matches */}
        <CollapsibleAdminSection title="Recent Matches" icon={Swords} accent="#ff005c">
          {isLoadingMatches ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} /></div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              {matches?.map((match: any) => (
                <div key={match.id}>
                  {editingMatchId === match.id ? (
                    <div className="px-4 py-3 space-y-2.5" style={{ background: "rgba(255,210,74,0.04)", borderLeft: "3px solid rgba(255,210,74,0.4)" }}>
                      <div className="text-xs font-black uppercase tracking-wider mb-1" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", fontSize: "0.6rem" }}>Edit Match Result</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem" }}>Winner</label>
                          <select value={editMatchForm.winnerId} onChange={e => setEditMatchForm(f => ({ ...f, winnerId: Number(e.target.value) }))}
                            className="w-full rounded text-sm px-2 py-1.5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", fontFamily: "inherit" }}>
                            <option value={0}>Select winner…</option>
                            {players?.map(p => <option key={p.id} value={p.id} style={{ background: "#0a0814", color: "#fff" }}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem" }}>Loser</label>
                          <select value={editMatchForm.loserId} onChange={e => setEditMatchForm(f => ({ ...f, loserId: Number(e.target.value) }))}
                            className="w-full rounded text-sm px-2 py-1.5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,0,92,0.3)", color: "#ff005c", fontFamily: "inherit" }}>
                            <option value={0}>Select loser…</option>
                            {players?.map(p => <option key={p.id} value={p.id} style={{ background: "#0a0814", color: "#fff" }}>{p.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.6rem" }}>Elo, points, wins and losses are automatically recalculated.</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleEditMatch} disabled={editMatchLoading || !editMatchForm.winnerId || !editMatchForm.loserId || editMatchForm.winnerId === editMatchForm.loserId}
                          className="gap-1.5 text-xs font-bold uppercase" style={{ background: "#ffd24a", color: "#000", border: "none", fontFamily: "Oswald, sans-serif", height: 28 }}>
                          {editMatchLoading ? <div className="w-3 h-3 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#000" }} /> : <Check className="w-3 h-3" />}
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingMatchId(null)} className="text-xs" style={{ color: "rgba(255,255,255,0.4)", height: 28 }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                      <div>
                        <div className="text-sm font-semibold flex items-center flex-wrap gap-1.5">
                          <span style={{ color: "#22c55e" }}>{match.winnerName}</span>
                          <span style={{ color: "rgba(255,255,255,0.25)" }}>def.</span>
                          <span style={{ color: "#ff005c" }}>{match.loserName}</span>
                          {match.stake > 0 && <span className="text-xs font-mono" style={{ color: "#ffd24a" }}>±{match.stake}pts</span>}
                          {match.isTeamMatch && <span className="text-xs font-black px-1.5 py-0.5 rounded" style={{ background: "rgba(0,200,150,0.12)", color: "#00c896", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>TEAM</span>}
                        </div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>{format(new Date(match.playedAt), "MMM d, HH:mm")}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-yellow-500/10"
                          onClick={() => { setEditingMatchId(match.id); setEditMatchForm({ winnerId: match.winnerId, loserId: match.loserId }); }}>
                          <Pencil className="h-3.5 w-3.5" style={{ color: "#ffd24a" }} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" style={{ color: "#ff005c" }} /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent style={{ background: "hsl(240 20% 7%)", borderColor: "rgba(255,0,92,0.3)" }}>
                            <AlertDialogHeader>
                              <AlertDialogTitle style={{ fontFamily: "Oswald, sans-serif" }}>Delete Match?</AlertDialogTitle>
                              <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                                Delete {match.winnerName} vs {match.loserName} from {format(new Date(match.playedAt), "MMM d, yyyy")}? Points and Elo will be reverted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteMatch(match.id, match.winnerId, match.loserId)} style={{ background: "#ff005c", color: "#fff", border: "none" }}>Delete Match</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {(!matches || matches.length === 0) && <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No matches found.</div>}
            </div>
          )}
        </CollapsibleAdminSection>
      </div>

      <TestComms />
      <DataManagement />
      <AnnouncementsManager />
      <NotificationAnalytics />
      <AdminCardClashPanel />
      <AdminChallengesPanel />
      <AdminFeatureFlagsPanel />
      <SweepTool />
      <PracticeAnalytics />
    </div>
  );
}
