const BLUE  = "#005EB8";
const DBLUE = "#003F8A";
const RED   = "#EE1C25";
const LGREY = "#F4F6F9";
const MGREY = "#E2E8F2";
const TEXT  = "#1A2332";
const MUTED = "#64748B";

const players = [
  { rank: 1, name: "Sean",    tier: "Gold",     pts: 46, elo: 1196, wins: 12, losses: 0, trend: "up" },
  { rank: 2, name: "Graeme",  tier: "Silver",   pts: 25, elo: 1104, wins: 8,  losses: 3, trend: "up" },
  { rank: 3, name: "Robert",  tier: "Silver",   pts: 25, elo: 1089, wins: 7,  losses: 4, trend: "down" },
  { rank: 4, name: "Cavan",   tier: "Silver",   pts: 20, elo: 1075, wins: 6,  losses: 3, trend: "same" },
  { rank: 5, name: "Kyle",    tier: "Bronze",   pts: 18, elo: 1050, wins: 5,  losses: 4, trend: "up" },
];

const matches = [
  { winner: "Sean",   loser: "Kyle",    stake: 2,  ago: "2h ago",   gameType: "501" },
  { winner: "Graeme", loser: "Richard", stake: 5,  ago: "Yesterday", gameType: "Cricket" },
  { winner: "Robert", loser: "Ryan",    stake: 8,  ago: "2 days",   gameType: "301" },
  { winner: "Cavan",  loser: "Sean",    stake: 3,  ago: "3 days",   gameType: "501" },
];

const tierColor: Record<string, string> = {
  Gold: "#B8860B", Silver: "#708090", Bronze: "#8B5A2B", Platinum: "#5B6EAE", Diamond: "#2979C1",
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <span style={{ background: tierColor[tier] + "18", color: tierColor[tier], border: `1px solid ${tierColor[tier]}44`, borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
      {tier.toUpperCase()}
    </span>
  );
}

function TrendIcon({ t }: { t: string }) {
  if (t === "up")   return <span style={{ color: "#16A34A", fontSize: 11 }}>▲</span>;
  if (t === "down") return <span style={{ color: RED,      fontSize: 11 }}>▼</span>;
  return <span style={{ color: MUTED, fontSize: 11 }}>—</span>;
}

function NavItem({ label, icon, active }: { label: string; icon: string; active?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderRadius: 8, cursor: "pointer", background: active ? "rgba(255,255,255,0.18)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.7)", fontWeight: active ? 700 : 400, fontSize: 13, transition: "all .15s" }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </div>
  );
}

export function TescoDashboard() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", background: LGREY, color: TEXT }}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <div style={{ width: 220, background: `linear-gradient(175deg, ${BLUE} 0%, ${DBLUE} 100%)`, display: "flex", flexDirection: "column", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 10, boxShadow: "2px 0 12px rgba(0,0,0,0.12)" }}>

        {/* Logo */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 34, height: 34, background: RED, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#fff", letterSpacing: "0.05em", flexShrink: 0 }}>
              TK
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "0.05em", lineHeight: 1.1 }}>TKDL</div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>Darts League</div>
            </div>
          </div>
          <div style={{ marginTop: 8, background: "rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />
            June 2026 · 24 days left
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: "12px 8px", flex: 1 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", padding: "0 8px", marginBottom: 4 }}>MAIN</div>
          <NavItem label="Dashboard"  icon="🏠" active />
          <NavItem label="Submit Match" icon="🎯" />
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", padding: "8px 8px 4px", marginTop: 4 }}>LEAGUE</div>
          <NavItem label="Leaderboard"  icon="🏆" />
          <NavItem label="Players"      icon="👥" />
          <NavItem label="Seasons"      icon="📅" />
          <NavItem label="Achievements" icon="⭐" />
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", padding: "8px 8px 4px", marginTop: 4 }}>CONFIG</div>
          <NavItem label="Admin" icon="⚙️" />
        </div>

        {/* Season leader mini-card */}
        <div style={{ margin: "0 8px 12px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,210,0,0.35)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Season Leader</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#FFD700" }}>Sean</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>46 pts · ELO 1196</div>
          <div style={{ marginTop: 6, height: 3, background: "rgba(255,255,255,0.12)", borderRadius: 4 }}>
            <div style={{ width: "30%", height: "100%", background: "#FFD700", borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>30% through June</div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div style={{ marginLeft: 220, flex: 1, padding: "24px 28px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: "-0.02em" }}>Dashboard</h1>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: MUTED }}>June 2026 Season · 11 active players</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                🎯 Submit Result
              </button>
            </div>
          </div>
          {/* Tesco-style top rule */}
          <div style={{ height: 3, marginTop: 14, borderRadius: 2, background: `linear-gradient(90deg, ${BLUE} 0%, ${RED} 50%, transparent 100%)` }} />
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>
          {[
            { label: "Active Players", value: "11", sub: "4 inactive", icon: "👥", c: BLUE },
            { label: "Eliminated",     value: "0",  sub: "This season", icon: "☠️", c: "#94A3B8" },
            { label: "Matches Played", value: "6",  sub: "This season", icon: "🎯", c: RED },
            { label: "Top ELO",        value: "1196", sub: "Sean",     icon: "⚡", c: "#D97706" },
          ].map(s => (
            <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", borderTop: `3px solid ${s.c}`, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Storylines */}
        <div style={{ background: `linear-gradient(135deg, ${BLUE}0D 0%, ${RED}0D 100%)`, border: `1px solid ${BLUE}22`, borderRadius: 12, padding: "14px 18px", marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>📢 Live Storylines</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { icon: "🔥", color: RED,      title: "Sean is on fire",             body: "12 wins in a row — the league's hottest player right now." },
              { icon: "📉", color: "#D97706", title: "Ronald's nightmare run",       body: "4 consecutive losses. Losing ground fast on the leaderboard." },
              { icon: "💰", color: BLUE,      title: "Graeme playing with fire",     body: "Wagered 25 pts in a recent match — and won. High stakes." },
            ].map(s => (
              <div key={s.title} style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", borderLeft: `3px solid ${s.color}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: TEXT, marginBottom: 5 }}>{s.icon} {s.title}</div>
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12, padding: "12px 18px", marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#C2410C", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>⚠️ Danger Zone</div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { name: "Richard", pts: 18, risk: "1 loss of 17+ pts → eliminated" },
              { name: "Ryan",    pts: 13, risk: "1 loss of 12+ pts → eliminated" },
            ].map(p => (
              <div key={p.name} style={{ flex: 1, background: "#fff", border: "1px solid #FED7AA", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{p.risk}</div>
                </div>
                <div style={{ fontWeight: 900, fontSize: 22, color: "#EA580C" }}>{p.pts}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard + Recent matches */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

          {/* Leaderboard */}
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${MGREY}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>🏆 Leaderboard</div>
              <span style={{ fontSize: 12, color: BLUE, fontWeight: 600, cursor: "pointer" }}>View all →</span>
            </div>
            <div>
              {players.map((p, i) => (
                <div key={p.name} style={{ padding: "11px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: i < players.length - 1 ? `1px solid ${LGREY}` : "none", background: i === 0 ? "#FFFBEB" : "transparent" }}>
                  <span style={{ width: 22, textAlign: "center", fontWeight: 800, fontSize: 14, color: i === 0 ? "#B8860B" : MUTED }}>#{p.rank}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>{p.name} <TierBadge tier={p.tier} /></div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>ELO {p.elo} · {p.wins}W-{p.losses}L</div>
                  </div>
                  <TrendIcon t={p.trend} />
                  <div style={{ fontWeight: 900, fontSize: 18, color: BLUE, minWidth: 36, textAlign: "right" }}>{p.pts}</div>
                  <div style={{ fontSize: 10, color: MUTED }}>pts</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent matches */}
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${MGREY}` }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>⚔️ Recent Matches</div>
            </div>
            <div>
              {matches.map((m, i) => (
                <div key={i} style={{ padding: "12px 18px", borderBottom: i < matches.length - 1 ? `1px solid ${LGREY}` : "none", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                      <span style={{ color: BLUE, fontWeight: 700 }}>{m.winner}</span>
                      <span style={{ color: MUTED, margin: "0 6px", fontSize: 11 }}>def.</span>
                      {m.loser}
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{m.gameType} · {m.ago}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#16A34A" }}>+{m.stake}pts</div>
                    <div style={{ fontSize: 10, color: MUTED }}>wagered</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Tesco branding strip */}
        <div style={{ marginTop: 28, padding: "10px 0", borderTop: `1px solid ${MGREY}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: MUTED }}>Tesco Kilbirnie Darts League · June 2026 Season</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 16, height: 16, background: BLUE, borderRadius: 3 }} />
            <div style={{ width: 16, height: 16, background: RED, borderRadius: 3 }} />
            <span style={{ fontSize: 11, color: MUTED, marginLeft: 4 }}>Powered by Tesco Technology</span>
          </div>
        </div>

      </div>
    </div>
  );
}
