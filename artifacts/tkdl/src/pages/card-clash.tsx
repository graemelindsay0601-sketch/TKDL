import React, { useState, useEffect, useCallback, useRef } from "react";
import { useCurrentPlayer } from "@/context/auth";
import { CardShopUI } from "@/components/CardShopUI";
import { CoinBalance } from "@/components/CoinBalance";
import { CardClashMatchLauncher } from "@/components/CardClashMatchLauncher";
import { PlayerChallenges } from "@/components/PlayerChallenges";
import { TKDLCard } from "@/components/TKDLCard";
import { ALL_CARDS } from "@/lib/cards-data";
import type { CardData, Category, Rarity } from "@/lib/cards-data";

type Tab = "collection" | "shop" | "play" | "standings" | "mock";

const CATEGORIES: Category[] = ["X01 GOOD", "X01 BAD", "CRICKET GOOD", "CRICKET BAD", "WILDCARD GOOD", "WILDCARD BAD"];
const RARITIES: Rarity[] = ["COMMON", "RARE", "LEGENDARY"];

const CAT_COLOR: Record<Category, string> = {
  "X01 GOOD": "#00b4ff", "X01 BAD": "#ff3b3b",
  "CRICKET GOOD": "#00cc66", "CRICKET BAD": "#9933ff",
  "WILDCARD GOOD": "#ffaa00", "WILDCARD BAD": "#cc1111",
};
const RAR_COLOR: Record<Rarity, string> = { COMMON: "#9ab0c4", RARE: "#00b4ff", LEGENDARY: "#ffaa00" };

interface Stats { coins: number; cardsOwned: number; matchesPlayed: number; wins: number; losses: number; }
interface Standing { player_id: number; player_name: string; wins: number; losses: number; total_matches: number; points: number; }
interface Player { id: number; name: string; }

export default function CardClashPage() {
  const currentPlayer = useCurrentPlayer();
  const playerId = currentPlayer?.playerId;

  const [activeTab, setActiveTab] = useState<Tab>("collection");
  const [stats, setStats] = useState<Stats | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [ownedNames, setOwnedNames] = useState<Set<string>>(new Set());
  const [collLoading, setCollLoading] = useState(true);

  // Collection filters
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "ALL">("ALL");
  const [rarFilter, setRarFilter] = useState<Rarity | "ALL">("ALL");
  const [showOwned, setShowOwned] = useState<"all" | "owned" | "unowned">("all");
  const [enlargedCard, setEnlargedCard] = useState<CardData | null>(null);

  // Mock game
  const [mockPlayers, setMockPlayers] = useState<Player[]>([]);
  const [mockOpponentType, setMockOpponentType] = useState<"bot" | "player">("bot");
  const [mockOpponentId, setMockOpponentId] = useState<number | null>(null);
  const [mockStarted, setMockStarted] = useState(false);
  const [mockMatch, setMockMatch] = useState<any>(null);
  const [mockLoading, setMockLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!playerId) return;
    try {
      const [statsR, invR, standingsR] = await Promise.all([
        fetch(`/api/card-clash/player/${playerId}/stats`).then(r => r.ok ? r.json() : null),
        fetch(`/api/card-clash/inventory/${playerId}`).then(r => r.ok ? r.json() : []),
        fetch("/api/card-clash/standings").then(r => r.ok ? r.json() : []),
      ]);
      if (statsR) setStats(statsR);
      setOwnedNames(new Set((Array.isArray(invR) ? invR : []).map((c: any) => c.cardName ?? c.name ?? "")));
      setStandings(Array.isArray(standingsR) ? standingsR : []);
    } catch {} finally { setCollLoading(false); }
  }, [playerId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (activeTab !== "mock") return;
    fetch("/api/card-clash/mock-game/players")
      .then(r => r.ok ? r.json() : [])
      .then((p: Player[]) => setMockPlayers(p.filter((pl: Player) => pl.id !== playerId)))
      .catch(() => {});
  }, [activeTab, playerId]);

  const handleMockStart = async () => {
    if (!playerId) return;
    setMockLoading(true);
    try {
      const r = await fetch("/api/card-clash/mock-game/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player1Id: playerId, player2Id: mockOpponentType === "player" ? mockOpponentId : null, isBotOpponent: mockOpponentType === "bot", player1Cards: [] }),
      });
      if (r.ok) { setMockMatch(await r.json()); setMockStarted(true); }
      else { const e = await r.json(); alert(e.error ?? "Failed to start mock game"); }
    } catch {} finally { setMockLoading(false); }
  };

  const handleMockFinish = async (winnerId: number | null) => {
    if (mockMatch?.match?.id) {
      await fetch("/api/card-clash/match/finish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: mockMatch.match.id, winnerId: winnerId ?? playerId, cardsUsedInMatch: [] }),
      }).catch(() => {});
    }
    setMockStarted(false); setMockMatch(null); setMockOpponentId(null);
    loadData();
  };

  if (!currentPlayer || !playerId) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at top,#07101f 0%,#030508 80%)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "1rem" }}>🎴</div>
          <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: "1.5rem" }}>Please log in to access Card Clash</div>
          <button onClick={() => (window.location.href = "/login")} style={glowBtn("#00b4ff")}>Go to Login</button>
        </div>
      </div>
    );
  }

  const filteredCards = ALL_CARDS.filter(c => {
    if (catFilter !== "ALL" && c.category !== catFilter) return false;
    if (rarFilter !== "ALL" && c.rarity !== rarFilter) return false;
    if (showOwned === "owned" && !ownedNames.has(c.name)) return false;
    if (showOwned === "unowned" && ownedNames.has(c.name)) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.effect.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const winRate = stats && stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0;
  const totalOwned = ALL_CARDS.filter(c => ownedNames.has(c.name)).length;
  const completionPct = Math.round((totalOwned / ALL_CARDS.length) * 100);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "collection", label: "Collection", icon: "📚" },
    { id: "shop", label: "Shop", icon: "🛍️" },
    { id: "play", label: "Play", icon: "⚡" },
    { id: "standings", label: "Standings", icon: "🏆" },
    { id: "mock", label: "Mock Game", icon: "🎲" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at top,#07101f 0%,#030508 80%)", color: "#fff" }}>

      {/* ─── HERO HEADER ─── */}
      <div style={{ padding: "2rem 2rem 0", maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 900, margin: 0, fontFamily: "'Arial Black',Impact,sans-serif", letterSpacing: "0.15em", textShadow: "0 0 30px rgba(0,180,255,0.7)" }}>
            TKDL <span style={{ color: "#00b4ff" }}>CARD CLASH</span>
          </h1>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", margin: "6px 0 0", letterSpacing: "0.15em" }}>
            {ALL_CARDS.length} CARDS · COLLECT · EQUIP · COMPETE
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "1.5rem" }}>
          {[
            { label: "COINS", value: stats?.coins ?? "—", color: "#ffd24a", icon: "🪙" },
            { label: "CARDS", value: `${totalOwned}/${ALL_CARDS.length}`, color: "#00e5ff", icon: "🃏" },
            { label: "WINS", value: stats?.wins ?? "—", color: "#00ff88", icon: "🏆" },
            { label: "WIN RATE", value: stats ? `${winRate}%` : "—", color: "#c084fc", icon: "📊" },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.04)", border: `1px solid ${s.color}22`, borderRadius: "10px", padding: "10px 16px" }}>
              <span style={{ fontSize: "18px" }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>{s.label}</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{String(s.value)}</div>
              </div>
            </div>
          ))}
          {/* Collection progress */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px 16px", flex: 1, minWidth: "200px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", marginBottom: "6px" }}>COLLECTION</div>
              <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${completionPct}%`, background: "linear-gradient(90deg,#00e5ff,#ffd24a)", transition: "width 0.5s" }} />
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "4px" }}>{completionPct}% complete</div>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: "0", overflowX: "auto" }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "10px 20px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px",
              letterSpacing: "0.05em", background: "transparent", whiteSpace: "nowrap", transition: "all 0.2s",
              color: activeTab === tab.id ? "#00b4ff" : "rgba(255,255,255,0.4)",
              borderBottom: activeTab === tab.id ? "2px solid #00b4ff" : "2px solid transparent",
              marginBottom: "-1px",
            }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB CONTENT ─── */}
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "1.5rem 2rem 3rem" }}>

        {/* ── COLLECTION ── */}
        {activeTab === "collection" && (
          <div>
            {/* Filter bar */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "1.5rem", alignItems: "center" }}>
              <input
                type="text" placeholder="Search cards…" value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", padding: "8px 14px", color: "#fff", fontSize: "13px", outline: "none", minWidth: "160px" }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <Chip label="ALL" active={catFilter === "ALL"} color="#00b4ff" onClick={() => setCatFilter("ALL")} />
                {CATEGORIES.map(cat => <Chip key={cat} label={cat} active={catFilter === cat} color={CAT_COLOR[cat]} onClick={() => setCatFilter(cat === catFilter ? "ALL" : cat)} />)}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <Chip label="ALL" active={rarFilter === "ALL"} color="#fff" onClick={() => setRarFilter("ALL")} />
                {RARITIES.map(r => <Chip key={r} label={r} active={rarFilter === r} color={RAR_COLOR[r]} onClick={() => setRarFilter(r === rarFilter ? "ALL" : r)} />)}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["all", "owned", "unowned"] as const).map(v => (
                  <button key={v} onClick={() => setShowOwned(v)} style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: "12px", fontWeight: 600, background: showOwned === v ? "rgba(255,255,255,0.12)" : "transparent", color: showOwned === v ? "#fff" : "rgba(255,255,255,0.4)" }}>
                    {v === "all" ? "All" : v === "owned" ? "✓ Owned" : "○ Missing"}
                  </button>
                ))}
              </div>
              <div style={{ marginLeft: "auto", fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
                {filteredCards.length} card{filteredCards.length !== 1 ? "s" : ""}
              </div>
            </div>

            {collLoading ? (
              <div style={{ textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.3)" }}>Loading collection…</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "flex-start" }}>
                {filteredCards.map(card => {
                  const owned = ownedNames.has(card.name);
                  return (
                    <div key={card.id} onClick={() => setEnlargedCard(card)} style={{ cursor: "pointer", transition: "transform 0.2s", flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04) translateY(-4px)")}
                      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      <TKDLCard card={card} size="sm" locked={!owned} />
                    </div>
                  );
                })}
                {filteredCards.length === 0 && (
                  <div style={{ width: "100%", textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.3)" }}>
                    <div style={{ fontSize: "48px", marginBottom: "1rem" }}>🃏</div>
                    <div>No cards match your filters</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SHOP ── */}
        {activeTab === "shop" && (
          <div>
            <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 style={sectionH2}>Card Shop</h2>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>Buy card packs to expand your collection and equip cards in matches</p>
              </div>
              <CoinBalance playerId={playerId} />
            </div>
            <CardShopUI playerId={playerId} />
          </div>
        )}

        {/* ── PLAY ── */}
        {activeTab === "play" && (
          <div>
            <h2 style={sectionH2}>Play Card Clash</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", marginBottom: "1.5rem" }}>Select up to 4 cards to equip before your darts match — they give you tactical effects during the game</p>
            <CardClashMatchLauncher
              currentPlayerId={playerId}
              currentPlayerName={(currentPlayer as any)?.name || (currentPlayer as any)?.playerName || "Player"}
              onMatchComplete={() => { setActiveTab("collection"); loadData(); }}
            />
            <div style={{ marginTop: "2rem" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: "1rem", letterSpacing: "0.05em" }}>YOUR CHALLENGES</h3>
              <PlayerChallenges playerId={playerId} />
            </div>
          </div>
        )}

        {/* ── STANDINGS ── */}
        {activeTab === "standings" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 style={sectionH2}>All-Time Standings</h2>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>Ranked by total wins across all Card Clash matches</p>
              </div>
              <button onClick={loadData} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>↻ Refresh</button>
            </div>
            {standings.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      {["#", "Player", "W", "L", "Played", "Pts"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: h === "Player" || h === "#" ? "left" : "center", color: "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: "11px", letterSpacing: "0.1em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, idx) => {
                      const isMe = row.player_id === playerId;
                      return (
                        <tr key={row.player_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: isMe ? "rgba(0,180,255,0.06)" : "transparent", transition: "background 0.2s" }}>
                          <td style={{ padding: "14px 16px", color: idx === 0 ? "#ffd24a" : "rgba(255,255,255,0.4)", fontWeight: 800, fontSize: "16px" }}>
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                          </td>
                          <td style={{ padding: "14px 16px", fontWeight: isMe ? 700 : 500, color: isMe ? "#00b4ff" : "#fff" }}>
                            {row.player_name} {isMe && <span style={{ fontSize: "11px", color: "rgba(0,180,255,0.6)" }}>(you)</span>}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "center", color: "#00ff88", fontWeight: 700 }}>{row.wins}</td>
                          <td style={{ padding: "14px 16px", textAlign: "center", color: "#ff6b6b" }}>{row.losses}</td>
                          <td style={{ padding: "14px 16px", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>{row.total_matches}</td>
                          <td style={{ padding: "14px 16px", textAlign: "center", color: "#00e5ff", fontWeight: 700 }}>{row.points ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.3)" }}>
                <div style={{ fontSize: "48px", marginBottom: "1rem" }}>🏆</div>
                <div>No matches recorded yet — play some Card Clash games to appear here!</div>
              </div>
            )}
          </div>
        )}

        {/* ── MOCK GAME ── */}
        {activeTab === "mock" && (
          <div style={{ maxWidth: "600px" }}>
            <h2 style={sectionH2}>🎲 Mock Game</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", marginBottom: "2rem" }}>
              Practice mode — no coins spent, no cards consumed. Test strategies or have a casual game.
            </p>

            {!mockStarted ? (
              <div style={{ display: "grid", gap: "1.5rem" }}>
                {/* Opponent type */}
                <div>
                  <label style={fieldLabel}>Opponent</label>
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                    {(["bot", "player"] as const).map(t => (
                      <button key={t} onClick={() => setMockOpponentType(t)} style={{
                        flex: 1, padding: "14px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "14px", transition: "all 0.2s",
                        background: mockOpponentType === t ? "rgba(0,180,255,0.15)" : "rgba(255,255,255,0.04)",
                        color: mockOpponentType === t ? "#00b4ff" : "rgba(255,255,255,0.5)",
                        border: mockOpponentType === t ? "1px solid rgba(0,180,255,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      }}>
                        {t === "bot" ? "🤖 Bot" : "👤 Player"}
                      </button>
                    ))}
                  </div>
                </div>

                {mockOpponentType === "bot" && (
                  <div style={{ padding: "14px 16px", background: "rgba(0,180,255,0.06)", border: "1px solid rgba(0,180,255,0.2)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                    The bot will receive 4 random cards from the full catalog.
                  </div>
                )}

                {mockOpponentType === "player" && (
                  <div>
                    <label style={fieldLabel}>Select opponent</label>
                    <div style={{ position: "relative", marginTop: "8px" }}>
                      <select
                        value={mockOpponentId ?? ""}
                        onChange={e => setMockOpponentId(Number(e.target.value) || null)}
                        style={{
                          width: "100%", padding: "12px 16px", borderRadius: "10px", appearance: "none",
                          background: "rgba(255,255,255,0.06)", color: mockOpponentId ? "#fff" : "rgba(255,255,255,0.4)",
                          border: "1px solid rgba(255,255,255,0.12)", fontSize: "14px", outline: "none", cursor: "pointer",
                        }}
                      >
                        <option value="" style={{ background: "#0a0e18", color: "#fff" }}>Choose a player…</option>
                        {mockPlayers.map(p => (
                          <option key={p.id} value={p.id} style={{ background: "#0a0e18", color: "#fff" }}>{p.name}</option>
                        ))}
                      </select>
                      <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", pointerEvents: "none" }}>▾</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleMockStart}
                  disabled={mockLoading || (mockOpponentType === "player" && !mockOpponentId)}
                  style={{ ...glowBtn("#00b4ff"), opacity: (mockLoading || (mockOpponentType === "player" && !mockOpponentId)) ? 0.5 : 1 }}
                >
                  {mockLoading ? "Starting…" : "🎲 Start Mock Game"}
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "1.5rem" }}>
                <div style={{ padding: "20px 24px", background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.25)", borderRadius: "12px" }}>
                  <div style={{ fontWeight: 700, color: "#00ff88", fontSize: "16px", marginBottom: "8px" }}>✅ Mock Game Running</div>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                    Go play your darts match, then come back and record the result below.
                  </div>
                  {mockMatch?.botCards?.length > 0 && (
                    <div style={{ marginTop: "10px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                      Bot equipped {mockMatch.botCards.length} random card{mockMatch.botCards.length > 1 ? "s" : ""}.
                    </div>
                  )}
                </div>

                <div>
                  <label style={fieldLabel}>Who won?</label>
                  <div style={{ display: "flex", gap: "12px", marginTop: "10px", flexWrap: "wrap" }}>
                    <button onClick={() => handleMockFinish(playerId)} style={glowBtn("#00ff88")}>🏆 I Won</button>
                    <button onClick={() => handleMockFinish(mockMatch?.match?.player_2_id && mockMatch.match.player_2_id !== playerId ? mockMatch.match.player_2_id : 0)} style={{ ...glowBtn("#ff6b6b"), background: "rgba(255,107,107,0.15)" }}>
                      😔 {mockOpponentType === "bot" ? "Bot" : "Opponent"} Won
                    </button>
                    <button onClick={() => { setMockStarted(false); setMockMatch(null); }} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: 600, fontSize: "14px" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── CARD ENLARGE MODAL ─── */}
      {enlargedCard && (
        <div
          onClick={() => setEnlargedCard(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
            {/* Card detail */}
            <div style={{ display: "flex", gap: "32px", alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
              <TKDLCard card={enlargedCard} size="lg" locked={!ownedNames.has(enlargedCard.name)} />
              <div style={{ maxWidth: "280px", paddingTop: "8px" }}>
                <div style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>CLICK CARD TO FLIP</span>
                </div>
                <h2 style={{ fontSize: "20px", fontWeight: 900, color: "#fff", margin: "0 0 8px", fontFamily: "'Arial Black',sans-serif" }}>{enlargedCard.name}</h2>
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: `${CAT_COLOR[enlargedCard.category]}22`, color: CAT_COLOR[enlargedCard.category], border: `1px solid ${CAT_COLOR[enlargedCard.category]}44` }}>{enlargedCard.category}</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: `${RAR_COLOR[enlargedCard.rarity]}22`, color: RAR_COLOR[enlargedCard.rarity], border: `1px solid ${RAR_COLOR[enlargedCard.rarity]}44` }}>{enlargedCard.rarity}</span>
                  {ownedNames.has(enlargedCard.name)
                    ? <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: "rgba(0,255,136,0.1)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)" }}>✓ OWNED</span>
                    : <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>NOT OWNED</span>
                  }
                </div>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.85)", lineHeight: 1.6, margin: "0 0 12px" }}>{enlargedCard.effect}</p>
                {enlargedCard.flavourText && (
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", fontStyle: "italic", lineHeight: 1.5, margin: 0, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "10px" }}>"{enlargedCard.flavourText}"</p>
                )}
                {!ownedNames.has(enlargedCard.name) && (
                  <button onClick={() => { setEnlargedCard(null); setActiveTab("shop"); }} style={{ marginTop: "16px", ...glowBtn("#ffd24a"), background: "rgba(255,210,74,0.15)" }}>
                    🛍️ Buy in Shop
                  </button>
                )}
              </div>
            </div>
            <button onClick={() => setEnlargedCard(null)} style={{ padding: "8px 24px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 12px", borderRadius: "20px", cursor: "pointer", fontSize: "11px", fontWeight: 700,
      letterSpacing: "0.05em", transition: "all 0.15s", border: "1px solid", whiteSpace: "nowrap",
      background: active ? `${color}22` : "transparent",
      color: active ? color : "rgba(255,255,255,0.35)",
      borderColor: active ? `${color}66` : "rgba(255,255,255,0.1)",
    }}>
      {label}
    </button>
  );
}

const sectionH2: React.CSSProperties = { fontSize: "20px", fontWeight: 800, color: "#fff", margin: "0 0 4px", letterSpacing: "0.05em" };
const fieldLabel: React.CSSProperties = { fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.1em" };

function glowBtn(color: string): React.CSSProperties {
  return {
    padding: "12px 24px", background: `${color}22`, border: `1px solid ${color}66`,
    borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "14px",
    color, letterSpacing: "0.05em", transition: "all 0.2s",
    boxShadow: `0 0 20px ${color}22`,
  };
}
