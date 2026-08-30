import React, { useState, useEffect } from "react";
import { Trash2, Plus, Minus, ChevronDown, ChevronRight } from "lucide-react";
import { COLLECTIBLE_CARDS } from "@/lib/cards-data";

// ── Shared dark theme ──────────────────────────────────────────────────────────
const D = {
  card:    "rgba(255,255,255,0.04)",
  border:  "rgba(255,255,255,0.08)",
  text:    "#ffffff",
  sub:     "rgba(255,255,255,0.45)",
  success: "#00ff88",
  danger:  "#ff6b6b",
  warn:    "#ffaa00",
  info:    "#00b4ff",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "8px",
  padding: "10px 14px",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

// This panel only ever renders inside the already PIN-gated /admin page, so
// the browser's admin session cookie (set by the real PIN screen) is all
// that's needed here — no PIN is sent with these requests anymore.
const getAdminHeaders = () => ({ "Content-Type": "application/json" });

// ── Sub-components ─────────────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: "1rem", border: `1px solid ${D.border}`, borderRadius: "10px", overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "none", cursor: "pointer", color: D.text, fontWeight: 700, fontSize: "13px", letterSpacing: "0.05em" }}>
        {title}
        {open ? <ChevronDown size={14} color={D.sub} /> : <ChevronRight size={14} color={D.sub} />}
      </button>
      {open && <div style={{ padding: "16px" }}>{children}</div>}
    </div>
  );
}

function Btn({ onClick, children, color = D.info, disabled = false, fullWidth = false, style: extra }: {
  onClick: () => void; children: React.ReactNode; color?: string; disabled?: boolean; fullWidth?: boolean; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "8px", border: "none", cursor: disabled ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "13px", background: `${color}22`, color, borderTop: `1px solid ${color}44`, opacity: disabled ? 0.5 : 1, width: fullWidth ? "100%" : undefined, justifyContent: fullWidth ? "center" : undefined, transition: "all 0.15s", ...extra }}>
      {children}
    </button>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, appearance: "none", paddingRight: "32px", cursor: "pointer" }}>
        {children}
      </select>
      <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: D.sub, pointerEvents: "none", fontSize: "12px" }}>▾</span>
    </div>
  );
}

function Toast({ message, type }: { message: string; type: "success" | "error" | "info" }) {
  const color = type === "success" ? D.success : type === "error" ? D.danger : D.info;
  return (
    <div style={{ padding: "12px 16px", borderRadius: "8px", marginBottom: "1rem", fontSize: "13px", background: `${color}14`, border: `1px solid ${color}44`, color }}>
      {message}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
export default function AdminCardClashPanel() {
  const [cards, setCards]       = useState<any[]>([]);
  const [players, setPlayers]   = useState<any[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedCard, setSelectedCard]         = useState("");
  const [coinAmount, setCoinAmount]     = useState("50");
  const [cardQuantity, setCardQuantity] = useState("1");
  const [matchId, setMatchId]   = useState("");
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState("");
  const [msgType, setMsgType]   = useState<"success" | "error" | "info">("info");
  const [expanded, setExpanded] = useState(true);

  useEffect(() => { loadCards(); loadPlayers(); }, []);

  const toast = (msg: string, type: "success" | "error" | "info" = "info") => {
    setMessage(msg); setMsgType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  const playerName = () => players.find(p => p.id.toString() === selectedPlayerId)?.name ?? "Unknown";

  const loadCards = async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/card-clash/admin/cards", { headers: getAdminHeaders() });
      const d = await r.json();
      setCards(r.ok && Array.isArray(d) ? d : []);
      if (!r.ok) toast(`Cards: ${d.error ?? "load failed"}`, "error");
    } catch { toast("Failed to load cards", "error"); } finally { setLoading(false); }
  };

  const loadPlayers = async () => {
    try {
      const r = await fetch("/api/players", { headers: getAdminHeaders() });
      const d = await r.json();
      setPlayers(r.ok && Array.isArray(d) ? d : []);
    } catch {}
  };

  const api = async (url: string, body?: object, successMsg?: string) => {
    try {
      const r = await fetch(url, { method: "POST", headers: getAdminHeaders(), body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { toast(successMsg ?? "✅ Done", "success"); return d; }
      toast(d.error ?? r.statusText, "error"); return null;
    } catch (e) { toast(e instanceof Error ? e.message : "Request failed", "error"); return null; }
  };

  const toggleCard = async (cardId: string, enabled: boolean) => {
    await api("/api/card-clash/admin/card/toggle", { cardId, enabled: !enabled }, `Card ${!enabled ? "enabled" : "disabled"}`);
    loadCards();
  };

  const loadDebugLogs = async () => {
    try {
      setLogsLoading(true);
      const r = await fetch("/api/card-clash/admin/debug-logs?limit=50", { headers: getAdminHeaders() });
      const d = await r.json();
      setDebugLogs(r.ok && Array.isArray(d.logs) ? d.logs : []);
      setLogsLoaded(true);
      if (!r.ok) toast(`Logs: ${d.error ?? "load failed"}`, "error");
    } catch { toast("Failed to load match logs", "error"); } finally { setLogsLoading(false); }
  };

  const downloadDebugLog = async (id: number) => {
    try {
      const r = await fetch(`/api/card-clash/admin/debug-logs/${id}/download`, { headers: getAdminHeaders() });
      if (!r.ok) { toast("Download failed", "error"); return; }
      const text = await r.text();
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `card-clash-log-${id}.txt`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast("Download failed", "error"); }
  };

  return (
    <div style={{ padding: "1.5rem", color: D.text }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, letterSpacing: "0.08em" }}>🎴 CARD CLASH ADMIN</h2>
        <button onClick={() => setExpanded(o => !o)} style={{ background: "transparent", border: "none", color: D.sub, cursor: "pointer", fontSize: "18px" }}>
          {expanded ? "▼" : "▶"}
        </button>
      </div>

      {!expanded && null}
      {expanded && (
        <>
          {message && <Toast message={message} type={msgType} />}

          {/* Player selector — persisted at top, used by all player-specific sections */}
          <Section title="👤 ACTIVE PLAYER">
            <Select value={selectedPlayerId} onChange={setSelectedPlayerId}>
              <option value="" style={{ background: "#0a0e18" }}>— Choose a player —</option>
              {players.map(p => <option key={p.id} value={p.id.toString()} style={{ background: "#0a0e18" }}>{p.name} (ID: {p.id})</option>)}
            </Select>
          </Section>

          {/* Setup */}
          <Section title="⚙️ SETUP (run once)" defaultOpen={false}>
            <p style={{ fontSize: "12px", color: D.sub, margin: "0 0 12px" }}>These seed the database. Only needed if starting fresh or after a reset.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <Btn color={D.success} onClick={async () => { setLoading(true); await api("/api/card-clash/admin/seed-cards", {}, "✅ 100 cards seeded"); loadCards(); setLoading(false); }} disabled={loading}>🌱 Seed Cards</Btn>
              <Btn color={D.info} onClick={() => api("/api/card-clash/admin/challenges/seed", {}, "✅ Challenges seeded")} disabled={loading}>📍 Seed Challenges</Btn>
              <Btn color={D.info} onClick={() => api("/api/card-clash/admin/quests/seed", {}, "✅ Quests seeded")} disabled={loading}>🎯 Seed Quests</Btn>
            </div>
          </Section>

          {/* Coins */}
          <Section title="💰 COIN MANAGEMENT">
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "100px" }}>
                <label style={{ fontSize: "11px", color: D.sub, display: "block", marginBottom: "4px" }}>AMOUNT</label>
                <input type="number" value={coinAmount} onChange={e => setCoinAmount(e.target.value)} style={inputStyle} />
              </div>
              <Btn color={D.success} onClick={async () => { if (!selectedPlayerId) return toast("Select a player", "error"); const d = await api("/api/card-clash/admin/coins/give", { playerId: parseInt(selectedPlayerId), amount: parseInt(coinAmount) }, `✅ Gave ${coinAmount} coins to ${playerName()}`); if (d) toast(`✅ Gave ${coinAmount} coins to ${playerName()} (balance: ${d.cardPoints ?? "?"})`, "success"); }}>
                <Plus size={14} /> Give
              </Btn>
              <Btn color={D.danger} onClick={async () => { if (!selectedPlayerId) return toast("Select a player", "error"); const d = await api("/api/card-clash/admin/coins/remove", { playerId: parseInt(selectedPlayerId), amount: parseInt(coinAmount) }, `Removed ${coinAmount} coins from ${playerName()}`); if (d) toast(`✅ Removed ${coinAmount} coins from ${playerName()} (balance: ${d.cardPoints ?? "?"})`, "success"); }}>
                <Minus size={14} /> Remove
              </Btn>
            </div>
          </Section>

          {/* Cards */}
          <Section title="🃏 CARD MANAGEMENT">
            <div style={{ display: "grid", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", color: D.sub, display: "block", marginBottom: "4px" }}>SELECT CARD</label>
                <Select value={selectedCard} onChange={setSelectedCard}>
                  <option value="" style={{ background: "#0a0e18" }}>— Choose a card —</option>
                  {cards.map(c => <option key={c.cardId} value={c.cardId} style={{ background: "#0a0e18" }}>{c.name} ({c.rarity ?? ""})</option>)}
                </Select>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div>
                  <label style={{ fontSize: "11px", color: D.sub, display: "block", marginBottom: "4px" }}>QTY</label>
                  <input type="number" value={cardQuantity} onChange={e => setCardQuantity(e.target.value)} style={{ ...inputStyle, width: "80px" }} min="1" />
                </div>
                <Btn color={D.success} onClick={async () => {
                  if (!selectedPlayerId || !selectedCard) return toast("Select player and card", "error");
                  const card = cards.find(c => c.cardId === selectedCard);
                  await api("/api/card-clash/admin/card/give", { playerId: parseInt(selectedPlayerId), cardId: selectedCard, quantity: parseInt(cardQuantity) }, `✅ Gave ${cardQuantity}x "${card?.name}" to ${playerName()}`);
                }}>
                  <Plus size={14} /> Give Card
                </Btn>
                <Btn color={D.danger} onClick={async () => {
                  if (!selectedPlayerId || !selectedCard) return toast("Select player and card", "error");
                  const card = cards.find(c => c.cardId === selectedCard);
                  await api("/api/card-clash/admin/card/remove", { playerId: parseInt(selectedPlayerId), cardId: selectedCard, quantity: parseInt(cardQuantity) }, `✅ Removed ${cardQuantity}x "${card?.name}" from ${playerName()}`);
                }}>
                  <Minus size={14} /> Remove
                </Btn>
              </div>
              <div style={{ paddingTop: "8px", borderTop: `1px solid ${D.border}` }}>
                <Btn color="#c084fc" fullWidth onClick={async () => {
                  if (!selectedPlayerId) return toast("Select a player first", "error");
                  if (!window.confirm(`Give ALL ${COLLECTIBLE_CARDS.length} cards to ${playerName()}? This may take a moment.`)) return;
                  const d = await api("/api/card-clash/admin/give-all-cards", { playerId: parseInt(selectedPlayerId) }, `✅ Gave all cards to ${playerName()}`);
                  if (d) toast(`✅ Gave ${d.given ?? COLLECTIBLE_CARDS.length} cards to ${playerName()}`, "success");
                }}>
                  <Plus size={14} /> Give ALL {COLLECTIBLE_CARDS.length} Cards (Preview Mode)
                </Btn>
              </div>
            </div>
          </Section>

          {/* Card availability toggle */}
          <Section title={`🔛 CARD AVAILABILITY (${cards.filter(c => c.enabled).length}/${cards.length} enabled)`} defaultOpen={false}>
            {cards.length === 0 ? (
              <p style={{ color: D.sub, fontSize: "13px" }}>No cards loaded — run "Seed Cards" first.</p>
            ) : (
              <div style={{ maxHeight: "320px", overflowY: "auto", display: "grid", gap: "4px" }}>
                {cards.map(card => (
                  <div key={card.cardId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.02)", border: `1px solid ${D.border}` }}>
                    <span style={{ fontSize: "12px", color: D.text }}>{card.name} <span style={{ color: D.sub, fontSize: "11px" }}>({card.gameMode})</span></span>
                    <button onClick={() => toggleCard(card.cardId, card.enabled)} style={{ padding: "3px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 700, background: card.enabled ? `${D.success}22` : `${D.danger}22`, color: card.enabled ? D.success : D.danger }}>
                      {card.enabled ? "✓ ON" : "✗ OFF"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Match management */}
          <Section title="🎯 MATCH MANAGEMENT" defaultOpen={false}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: "120px" }}>
                <label style={{ fontSize: "11px", color: D.sub, display: "block", marginBottom: "4px" }}>MATCH ID</label>
                <input type="number" placeholder="e.g. 42" value={matchId} onChange={e => setMatchId(e.target.value)} style={inputStyle} />
              </div>
              <Btn color={D.danger} onClick={async () => {
                if (!matchId) return toast("Enter a match ID", "error");
                if (!window.confirm("Delete this match and revert its points/cards?")) return;
                await api("/api/card-clash/admin/match/delete", { matchId: parseInt(matchId) }, "✅ Match deleted and data reverted");
                setMatchId("");
              }}>
                <Trash2 size={14} /> Delete Match
              </Btn>
            </div>
          </Section>

          {/* Match logs */}
          <Section title="📋 MATCH LOGS" defaultOpen={false}>
            <p style={{ fontSize: "12px", color: D.sub, margin: "0 0 12px" }}>
              Every Card Clash match (2-player, Standard/Chaos/Chaos Lab) uploads a structured event log here when it
              finishes or is abandoned. Solo vs CPU matches also produce a log — download it directly from the "Download
              Match Log" button on the match screen instead, since those matches have no server-side record to list here.
            </p>
            {!logsLoaded ? (
              <Btn color={D.info} onClick={loadDebugLogs} disabled={logsLoading}>{logsLoading ? "Loading…" : "Load Recent Logs"}</Btn>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: D.sub }}>{debugLogs.length} log{debugLogs.length === 1 ? "" : "s"}</span>
                  <Btn color={D.info} onClick={loadDebugLogs} disabled={logsLoading}>{logsLoading ? "Refreshing…" : "↻ Refresh"}</Btn>
                </div>
                {debugLogs.length === 0 ? (
                  <p style={{ color: D.sub, fontSize: "13px" }}>No match logs yet — play a Card Clash match and it'll show up here.</p>
                ) : (
                  <div style={{ maxHeight: "360px", overflowY: "auto", display: "grid", gap: "4px" }}>
                    {debugLogs.map(log => {
                      const mode = log.is_chaos_lab_mode ? "Chaos Lab" : log.is_chaos_mode ? "Chaos" : "Standard";
                      const players = [log.player_1_name, log.player_2_name].filter(Boolean).join(" vs ") || "Unknown players";
                      const when = log.created_at ? new Date(log.created_at).toLocaleString() : "";
                      const kb = log.log_length ? Math.max(1, Math.round(log.log_length / 1024)) : 0;
                      return (
                        <div key={log.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.02)", border: `1px solid ${D.border}` }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "12px", color: D.text, fontWeight: 700 }}>
                              #{log.id} · {log.game_mode ?? "?"} · {mode}
                            </div>
                            <div style={{ fontSize: "11px", color: D.sub }}>{players} · {when} · ~{kb}KB</div>
                          </div>
                          <Btn color={D.success} onClick={() => downloadDebugLog(log.id)} style={{ flexShrink: 0 }}>⬇ Download</Btn>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </Section>

          {/* Danger zone */}
          <Section title="⚠️ DANGER ZONE" defaultOpen={false}>
            <p style={{ fontSize: "12px", color: D.sub, margin: "0 0 12px" }}>Resets a player's coins and cards back to zero. Cannot be undone.</p>
            <Btn color={D.danger} onClick={async () => {
              if (!selectedPlayerId) return toast("Select a player", "error");
              if (!window.confirm(`Reset ALL Card Clash data for ${playerName()}? This cannot be undone.`)) return;
              await api("/api/card-clash/admin/player/reset", { playerId: parseInt(selectedPlayerId) }, `✅ Reset ${playerName()} to 0 coins and 0 cards`);
              setSelectedPlayerId("");
            }}>
              <Trash2 size={14} /> Reset Player Data
            </Btn>
          </Section>
        </>
      )}
    </div>
  );
}
