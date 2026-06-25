import React, { useState, useEffect } from "react";
import { Plus, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";

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

const getAdminHeaders = () => {
  const pin = sessionStorage.getItem("tkdl_admin_pin");
  return { "Content-Type": "application/json", ...(pin ? { "x-admin-pin": pin } : {}) };
};

interface Challenge {
  id: number;
  title: string;
  description: string | null;
  requirement_value: number;
  reward_coins: number;
}

interface Player { id: number; name: string; }

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

function Btn({ onClick, children, color = D.info, fullWidth = false, disabled = false }: {
  onClick: () => void; children: React.ReactNode; color?: string; fullWidth?: boolean; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "8px", border: "none", cursor: disabled ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "13px", background: `${color}22`, color, borderTop: `1px solid ${color}44`, opacity: disabled ? 0.5 : 1, width: fullWidth ? "100%" : undefined, justifyContent: fullWidth ? "center" : undefined, transition: "all 0.15s" }}>
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
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

function ChallengeCard({ challenge, accentColor, actionLabel, onAction }: {
  challenge: Challenge; accentColor: string; actionLabel: string; onAction: (id: number) => void;
}) {
  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: "10px", padding: "14px" }}>
      <div style={{ fontWeight: 700, fontSize: "13px", color: D.text, marginBottom: "4px" }}>{challenge.title}</div>
      {challenge.description && (
        <div style={{ fontSize: "12px", color: D.sub, marginBottom: "8px", lineHeight: 1.4 }}>{challenge.description}</div>
      )}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ fontSize: "11px", color: D.sub }}>
          Goal: <span style={{ color: D.text }}>{challenge.requirement_value}</span>
          {" · "}Reward: <span style={{ color: D.warn }}>+{challenge.reward_coins} 🪙</span>
        </div>
        <button onClick={() => onAction(challenge.id)} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 700, background: `${accentColor}22`, color: accentColor }}>
          <Plus size={11} /> {actionLabel}
        </button>
      </div>
    </div>
  );
}

export default function AdminChallengesPanel() {
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [dailyChallenges, setDailyChallenges] = useState<Challenge[]>([]);
  const [weeklyChallenges, setWeeklyChallenges] = useState<Challenge[]>([]);
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    loadPlayers();
    loadChallengeDefs();
  }, []);

  const toast = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg); setMsgType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  const loadPlayers = async () => {
    try {
      const r = await fetch("/api/players");
      if (r.ok) setPlayers(await r.json());
    } catch {}
  };

  const loadChallengeDefs = async () => {
    try {
      const [dr, wr] = await Promise.all([
        fetch("/api/challenges/admin/daily-definitions", { headers: getAdminHeaders() }),
        fetch("/api/challenges/admin/weekly-definitions", { headers: getAdminHeaders() }),
      ]);
      if (dr.ok) setDailyChallenges(await dr.json()); else toast("Daily challenges: check PIN", "error");
      if (wr.ok) setWeeklyChallenges(await wr.json()); else toast("Weekly challenges: check PIN", "error");
    } catch { toast("Failed to load challenges", "error"); }
  };

  const api = async (url: string, body?: object, ok?: string) => {
    try {
      const r = await fetch(url, { method: "POST", headers: getAdminHeaders(), body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { toast(ok ?? "✅ Done", "success"); return true; }
      toast(d.error ?? r.statusText, "error"); return false;
    } catch (e) { toast(e instanceof Error ? e.message : "Request failed", "error"); return false; }
  };

  const playerName = () => players.find(p => p.id.toString() === selectedPlayerId)?.name ?? `Player ${selectedPlayerId}`;

  return (
    <div style={{ padding: "1.5rem", color: D.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, letterSpacing: "0.08em" }}>🎯 CHALLENGES ADMIN</h2>
        <button onClick={() => setExpanded(o => !o)} style={{ background: "transparent", border: "none", color: D.sub, cursor: "pointer", fontSize: "18px" }}>
          {expanded ? "▼" : "▶"}
        </button>
      </div>

      {expanded && (
        <>
          {message && (
            <div style={{ padding: "12px 16px", borderRadius: "8px", marginBottom: "1rem", fontSize: "13px", background: `${msgType === "success" ? D.success : D.danger}14`, border: `1px solid ${msgType === "success" ? D.success : D.danger}44`, color: msgType === "success" ? D.success : D.danger }}>
              {message}
            </div>
          )}

          {/* Player */}
          <Section title="👤 ACTIVE PLAYER">
            <Select value={selectedPlayerId} onChange={setSelectedPlayerId}>
              <option value="" style={{ background: "#0a0e18" }}>— Choose a player —</option>
              {players.map(p => <option key={p.id} value={p.id.toString()} style={{ background: "#0a0e18" }}>{p.name} (ID: {p.id})</option>)}
            </Select>
          </Section>

          {/* Actions */}
          <Section title="⚙️ ACTIONS">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <Btn color={D.success} onClick={async () => { if (await api("/api/card-clash/admin/challenges/seed", {}, "✅ Challenges seeded")) loadChallengeDefs(); }}>
                🌱 Seed All Challenges
              </Btn>
              <Btn color={D.warn} onClick={() => {
                if (!selectedPlayerId) return toast("Select a player", "error");
                api(`/api/challenges/admin/daily/reset/${selectedPlayerId}`, {}, `✅ Rerolled daily for ${playerName()}`);
              }}>
                <RotateCcw size={13} /> Reroll Daily
              </Btn>
              <Btn color={D.warn} onClick={() => {
                if (!selectedPlayerId) return toast("Select a player", "error");
                api(`/api/challenges/admin/weekly/reset/${selectedPlayerId}`, {}, `✅ Rerolled weekly for ${playerName()}`);
              }}>
                <RotateCcw size={13} /> Reroll Weekly
              </Btn>
              <Btn color={D.info} onClick={loadChallengeDefs}>↻ Refresh</Btn>
            </div>
          </Section>

          {/* Daily */}
          <Section title={`☀️ DAILY CHALLENGES (${dailyChallenges.length})`}>
            {dailyChallenges.length === 0 ? (
              <p style={{ color: D.sub, fontSize: "13px" }}>No daily challenges found — seed them first.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "10px" }}>
                {dailyChallenges.map(c => (
                  <ChallengeCard key={c.id} challenge={c} accentColor={D.success} actionLabel="Add Bonus" onAction={id => {
                    if (!selectedPlayerId) return toast("Select a player", "error");
                    api(`/api/challenges/admin/daily/bonus/${selectedPlayerId}`, { challengeId: id }, "✅ Bonus daily added");
                  }} />
                ))}
              </div>
            )}
          </Section>

          {/* Weekly */}
          <Section title={`📅 WEEKLY CHALLENGES (${weeklyChallenges.length})`}>
            {weeklyChallenges.length === 0 ? (
              <p style={{ color: D.sub, fontSize: "13px" }}>No weekly challenges found — seed them first.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "10px" }}>
                {weeklyChallenges.map(c => (
                  <ChallengeCard key={c.id} challenge={c} accentColor={D.info} actionLabel="Add Bonus" onAction={id => {
                    if (!selectedPlayerId) return toast("Select a player", "error");
                    api(`/api/challenges/admin/weekly/bonus/${selectedPlayerId}`, { challengeId: id }, "✅ Bonus weekly added");
                  }} />
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
