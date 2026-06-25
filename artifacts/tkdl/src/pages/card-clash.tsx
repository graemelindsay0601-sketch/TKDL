import React, { useState, useEffect, useCallback } from "react";
import { useCurrentPlayer } from "@/context/auth";
import { CardShopUI } from "@/components/CardShopUI";
import { CardClashMatchLauncher } from "@/components/CardClashMatchLauncher";
import { CardClashMockGame } from "@/components/CardClashMockGame";
import { PlayerChallenges } from "@/components/PlayerChallenges";
import { TKDLCard } from "@/components/TKDLCard";
import { ALL_CARDS } from "@/lib/cards-data";
import type { CardData, Category, Rarity } from "@/lib/cards-data";

type Tab = "collection" | "shop" | "play" | "practice" | "standings" | "achievements" | "rules" | "admin";

const CATEGORIES: Category[] = ["X01 GOOD", "X01 BAD", "CRICKET GOOD", "CRICKET BAD", "WILDCARD GOOD", "WILDCARD BAD"];
const RARITIES: Rarity[] = ["COMMON", "RARE", "LEGENDARY"];

const CAT_COLOR: Record<Category, string> = {
  "X01 GOOD": "#00b4ff", "X01 BAD": "#ff3b3b",
  "CRICKET GOOD": "#00cc66", "CRICKET BAD": "#9933ff",
  "WILDCARD GOOD": "#ffaa00", "WILDCARD BAD": "#cc1111",
};
const RAR_COLOR: Record<Rarity, string> = { COMMON: "#9ab0c4", RARE: "#c084fc", LEGENDARY: "#ffd24a" };

interface Stats { coins: number; cardsOwned: number; matchesPlayed: number; wins: number; losses: number; }
interface Standing { player_id: number; player_name: string; wins: number; losses: number; total_matches: number; points: number; }

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "collection",   label: "Collection",   icon: "🃏" },
  { id: "shop",         label: "Shop",         icon: "🛍️" },
  { id: "play",         label: "Play",         icon: "⚡" },
  { id: "practice",     label: "Practice",     icon: "🎲" },
  { id: "standings",    label: "Standings",    icon: "🏆" },
  { id: "achievements", label: "Achievements", icon: "🎖️" },
  { id: "rules",        label: "Rules",        icon: "📖" },
  { id: "admin",        label: "Admin",        icon: "⚙️" },
];

export default function CardClashPage() {
  const currentPlayer = useCurrentPlayer();
  const playerId = currentPlayer?.playerId;

  const [activeTab, setActiveTab] = useState<Tab>("collection");
  const [stats, setStats]         = useState<Stats | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [ownedNames, setOwnedNames]     = useState<Set<string>>(new Set());
  const [newCardNames, setNewCardNames] = useState<Set<string>>(new Set());
  const [collLoading, setCollLoading]   = useState(true);
  const [achievements, setAchievements] = useState<any>(null);
  const [packInventory, setPackInventory] = useState<any[]>([]);
  const [dupCards, setDupCards]           = useState<any[]>([]);
  const [sellingCard, setSellingCard]     = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [catFilter, setCatFilter] = useState<Category | "ALL">("ALL");
  const [rarFilter, setRarFilter] = useState<Rarity | "ALL">("ALL");
  const [showOwned, setShowOwned] = useState<"all" | "owned" | "unowned">("all");
  const [enlargedCard, setEnlargedCard] = useState<CardData | null>(null);
    const [adminPin, setAdminPin] = useState("");
    const [adminAuthed, setAdminAuthed] = useState(false);
    const [adminPinError, setAdminPinError] = useState(false);
    const [adminAction, setAdminAction] = useState<string | null>(null);
    const [adminResult, setAdminResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);
    const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!playerId) return;
    const key = `tkdl_new_cards_${playerId}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const stored: Record<string, number> = JSON.parse(raw);
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const fresh  = new Set(Object.entries(stored).filter(([, ts]) => ts > cutoff).map(([name]) => name));
      const pruned: Record<string, number> = {};
      for (const [name, ts] of Object.entries(stored)) { if (ts > cutoff) pruned[name] = ts; }
      localStorage.setItem(key, JSON.stringify(pruned));
      setNewCardNames(fresh);
    } catch {}
  }, [playerId]);

  const handleCardsReceived = (cardNames: string[]) => {
    if (!playerId || cardNames.length === 0) return;
    const key = `tkdl_new_cards_${playerId}`;
    try {
      const raw    = localStorage.getItem(key);
      const stored: Record<string, number> = raw ? JSON.parse(raw) : {};
      const now    = Date.now();
      for (const name of cardNames) stored[name] = now;
      localStorage.setItem(key, JSON.stringify(stored));
      setNewCardNames(prev => new Set([...prev, ...cardNames]));
    } catch {}
    loadData();
  };

  const loadData = useCallback(async () => {
    if (!playerId) return;
    try {
      const [statsR, invR, standingsR, achR, packInvR] = await Promise.all([
        fetch(`/api/card-clash/player/${playerId}/stats`).then(r => r.ok ? r.json() : null),
        fetch(`/api/card-clash/inventory/${playerId}`).then(r => r.ok ? r.json() : []),
        fetch("/api/card-clash/standings").then(r => r.ok ? r.json() : []),
        fetch(`/api/card-clash/achievements/${playerId}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/card-clash/pack-inventory/${playerId}`).then(r => r.ok ? r.json() : []),
      ]);
      if (statsR) setStats(statsR);
      const inv = Array.isArray(invR) ? invR : [];
      setOwnedNames(new Set(inv.map((c: any) => c.cardName ?? c.name ?? "")));
      setDupCards(inv.filter((c: any) => (c.quantity ?? 1) > 1));
      setStandings(Array.isArray(standingsR) ? standingsR : []);
      if (achR) setAchievements(achR);
      setPackInventory(Array.isArray(packInvR) ? packInvR : []);
    } catch {} finally { setCollLoading(false); }
  }, [playerId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!currentPlayer || !playerId) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#030812" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "52px", marginBottom: "1rem" }}>🎴</div>
          <div style={{ color: "rgba(255,255,255,0.45)", marginBottom: "1.5rem", fontFamily: "Arial,sans-serif" }}>Log in to access Card Clash</div>
          <button onClick={() => (window.location.href = "/login")} style={{ padding: "12px 28px", background: "linear-gradient(135deg,#ffd24a,#ff8c00)", border: "none", borderRadius: "6px", color: "#000", fontSize: "13px", fontWeight: 800, letterSpacing: "0.1em", cursor: "pointer" }}>Go to Login</button>
        </div>
      </div>
    );
  }

  const filteredCards = ALL_CARDS.filter(c => {
    if (catFilter !== "ALL" && c.category !== catFilter) return false;
    if (rarFilter !== "ALL" && c.rarity !== rarFilter)   return false;
    if (showOwned === "owned"   && !ownedNames.has(c.name)) return false;
    if (showOwned === "unowned" &&  ownedNames.has(c.name)) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.effect.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const winRate       = stats && stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0;
  const totalOwned    = ALL_CARDS.filter(c => ownedNames.has(c.name)).length;
  const completionPct = Math.round((totalOwned / ALL_CARDS.length) * 100);
  const playerName    = (currentPlayer as any)?.name || (currentPlayer as any)?.playerName || "Player";

  return (
    <div style={{ minHeight: "100vh", background: "#030812", color: "#fff", fontFamily: "Arial,sans-serif", position: "relative", overflowX: "hidden" }}>
      <style>{`
        @keyframes bgPulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
        @keyframes titleGlow { 0%,100%{filter:drop-shadow(0 0 18px rgba(255,210,74,0.35))} 50%{filter:drop-shadow(0 0 38px rgba(255,210,74,0.65))} }
        @keyframes tabFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sellSpin { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── PAGE BACKGROUND GLOWS ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "60%", background: "radial-gradient(ellipse,rgba(0,130,255,0.07) 0%,transparent 70%)", animation: "bgPulse 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: "55%", height: "55%", background: "radial-gradient(ellipse,rgba(255,160,0,0.06) 0%,transparent 70%)", animation: "bgPulse 10s ease-in-out infinite 2s" }} />
        <div style={{ position: "absolute", top: "40%", left: "40%", width: "30%", height: "30%", background: "radial-gradient(ellipse,rgba(180,0,255,0.04) 0%,transparent 70%)", animation: "bgPulse 12s ease-in-out infinite 4s" }} />
        {/* Subtle dot grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.028) 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
      </div>

      {/* ── HEADER ── */}
      <div style={{ position: "relative", zIndex: 1, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {/* Header background gradient */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,60,120,0.18) 0%,transparent 100%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", padding: "2rem 2rem 0" }}>

          {/* Badge + title row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            <div>
              {/* Exclusive badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: "linear-gradient(90deg,rgba(255,210,74,0.14),rgba(255,140,0,0.08))", border: "1px solid rgba(255,210,74,0.3)", borderRadius: "20px", padding: "5px 14px", marginBottom: "14px" }}>
                <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#ffd24a", boxShadow: "0 0 8px #ffd24a", animation: "bgPulse 2s ease-in-out infinite" }} />
                <span style={{ color: "#ffd24a", fontSize: "10px", fontWeight: 900, letterSpacing: "0.2em", fontFamily: "'Arial Black',Impact,Arial,sans-serif" }}>TKDL EXCLUSIVE GAME MODE</span>
              </div>

              {/* Main title */}
              <div style={{ lineHeight: 0.92, marginBottom: "12px" }}>
                <span style={{
                  display: "block",
                  fontSize: "clamp(36px,5.5vw,68px)",
                  fontWeight: 900,
                  fontFamily: "'Arial Black',Impact,Arial,sans-serif",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  background: "linear-gradient(135deg,#ffffff 0%,#aadcff 35%,#ffffff 55%,#cceeff 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>CARD</span>
                <span style={{
                  display: "block",
                  fontSize: "clamp(36px,5.5vw,68px)",
                  fontWeight: 900,
                  fontFamily: "'Arial Black',Impact,Arial,sans-serif",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  background: "linear-gradient(135deg,#ffaa00 0%,#ffd24a 40%,#ffe97a 60%,#ff9500 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "titleGlow 3s ease-in-out infinite",
                }}>CLASH</span>
              </div>

              <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.42)", lineHeight: 1.6, maxWidth: "320px" }}>
                100 unique cards · Real darts matches · Mid-game chaos
              </p>
            </div>

            {/* Right: stats column */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
              {/* Coin balance */}
              <div style={{ background: "linear-gradient(135deg,rgba(255,210,74,0.18),rgba(255,140,0,0.1))", border: "1px solid rgba(255,210,74,0.35)", borderRadius: "24px", padding: "9px 22px", fontSize: "18px", fontWeight: 900, color: "#ffd24a", letterSpacing: "0.05em", fontFamily: "'Arial Black',Arial,sans-serif", boxShadow: "0 0 24px rgba(255,210,74,0.15), inset 0 1px 0 rgba(255,255,255,0.08)" }}>
                🪙 {stats?.coins ?? "—"}
              </div>
              {/* Quick stats row */}
              <div style={{ display: "flex", gap: "8px" }}>
                {[
                  { label: "WINS",     value: stats?.wins ?? "—",     color: "#00ff88" },
                  { label: "WIN RATE", value: stats ? `${winRate}%` : "—", color: "#c084fc" },
                  { label: `${totalOwned}/${ALL_CARDS.length}`, value: null, color: "#00e5ff", icon: "🃏" },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "7px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", marginBottom: "3px" }}>{s.label}</div>
                    <div style={{ fontSize: "15px", fontWeight: 900, color: s.color, fontFamily: "'Arial Black',Arial,sans-serif", lineHeight: 1 }}>{s.value ?? s.icon}</div>
                  </div>
                ))}
              </div>
              {/* Collection progress bar */}
              <div style={{ width: "220px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "8px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginBottom: "6px" }}>
                  <span>COLLECTION</span>
                  <span>{completionPct}%</span>
                </div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${completionPct}%`, background: "linear-gradient(90deg,#00e5ff,#ffd24a)", borderRadius: "2px", transition: "width 0.6s", boxShadow: "0 0 8px rgba(0,229,255,0.5)" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", overflowX: "auto", gap: "2px", paddingBottom: "0" }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  padding: "11px 20px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 900,
                  letterSpacing: "0.1em", background: "transparent", whiteSpace: "nowrap",
                  textTransform: "uppercase", fontFamily: "'Arial Black',Impact,Arial,sans-serif",
                  color: isActive ? "#ffd24a" : "rgba(255,255,255,0.28)",
                  borderBottom: isActive ? "2px solid #ffd24a" : "2px solid transparent",
                  marginBottom: "-1px",
                  transition: "color 0.15s",
                  position: "relative",
                }}>
                  {tab.icon} {tab.label}
                  {tab.id === "shop" && packInventory.length > 0 && (
                    <span style={{ marginLeft: "5px", background: "linear-gradient(135deg,#ffd24a,#ff9500)", color: "#000", fontSize: "9px", fontWeight: 900, padding: "1px 6px", borderRadius: "8px", verticalAlign: "middle", boxShadow: "0 0 8px rgba(255,210,74,0.5)" }}>{packInventory.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: "1280px", margin: "0 auto", padding: "2rem 2rem 5rem" }}>

        {/* ── COLLECTION ── */}
        {activeTab === "collection" && (
          <div style={{ animation: "tabFadeIn 0.25s ease" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "1.5rem", alignItems: "center" }}>
              <input
                type="text" placeholder="Search cards…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "7px", padding: "8px 14px", color: "#fff", fontSize: "13px", outline: "none", minWidth: "140px" }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                <Chip label="ALL" active={catFilter === "ALL"} color="#aaa" onClick={() => setCatFilter("ALL")} />
                {CATEGORIES.map(cat => <Chip key={cat} label={cat} active={catFilter === cat} color={CAT_COLOR[cat]} onClick={() => setCatFilter(cat === catFilter ? "ALL" : cat)} />)}
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                <Chip label="ALL" active={rarFilter === "ALL"} color="#aaa" onClick={() => setRarFilter("ALL")} />
                {RARITIES.map(r => <Chip key={r} label={r} active={rarFilter === r} color={RAR_COLOR[r]} onClick={() => setRarFilter(r === rarFilter ? "ALL" : r)} />)}
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                {(["all", "owned", "unowned"] as const).map(v => (
                  <button key={v} onClick={() => setShowOwned(v)} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontSize: "11px", fontWeight: 600, background: showOwned === v ? "rgba(255,255,255,0.1)" : "transparent", color: showOwned === v ? "#fff" : "rgba(255,255,255,0.32)" }}>
                    {v === "all" ? "All" : v === "owned" ? "✓ Owned" : "○ Missing"}
                  </button>
                ))}
              </div>
              <div style={{ marginLeft: "auto", fontSize: "12px", color: "rgba(255,255,255,0.22)" }}>
                {filteredCards.length} card{filteredCards.length !== 1 ? "s" : ""}
              </div>
            </div>

            {collLoading ? (
              <div style={{ textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.25)" }}>Loading collection…</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
                {filteredCards.map(card => {
                  const owned = ownedNames.has(card.name);
                  return (
                    <div key={card.id} onClick={() => setEnlargedCard(card)}
                      style={{ cursor: "pointer", transition: "transform 0.18s", flexShrink: 0, position: "relative" }}
                      onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04) translateY(-4px)")}
                      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      <TKDLCard card={card} size="sm" locked={!owned} />
                      {newCardNames.has(card.name) && (
                        <div style={{ position: "absolute", top: "5px", right: "5px", background: "linear-gradient(135deg,#ff3b3b,#ff6b00)", color: "#fff", fontSize: "9px", fontWeight: 900, padding: "2px 6px", borderRadius: "8px", letterSpacing: "0.06em", boxShadow: "0 2px 8px rgba(255,60,60,0.55)", zIndex: 5 }}>NEW</div>
                      )}
                    </div>
                  );
                })}
                {filteredCards.length === 0 && (
                  <div style={{ width: "100%", textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.25)" }}>
                    <div style={{ fontSize: "44px", marginBottom: "1rem" }}>🃏</div>
                    <div>No cards match your filters</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SHOP ── */}
        {activeTab === "shop" && (
          <div style={{ animation: "tabFadeIn 0.25s ease", maxWidth: "680px", margin: "0 auto" }}>
            <SectionHeader title="Card Shop" subtitle="Build your arsenal. Collect all 100 cards." />

            {/* Single unified CardShopUI — passes free packs so they appear at top */}
            <Panel>
              <CardShopUI
                playerId={playerId}
                onCardsReceived={handleCardsReceived}
                freePacks={packInventory}
                onFreePackOpened={loadData}
              />
            </Panel>

            {/* Sell duplicates — only section below the shop */}
            {dupCards.length > 0 && (
              <Panel style={{ marginTop: "1.5rem", borderColor: "rgba(255,255,255,0.08)" }}>
                <PanelTitle>♻️ Sell Duplicates</PanelTitle>
                <p style={{ margin: "0 0 14px", fontSize: "12px", color: "rgba(255,255,255,0.32)", fontFamily: "Arial,sans-serif" }}>Common: 10🪙 · Rare: 30🪙 · Legendary: 100🪙</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "8px" }}>
                  {dupCards.map((c: any) => {
                    const rar   = (c.rarity ?? "COMMON").toUpperCase();
                    const prices: Record<string,number> = { COMMON: 10, RARE: 30, LEGENDARY: 100 };
                    const price = prices[rar] ?? 10;
                    const rc    = rar === "LEGENDARY" ? "#ffd24a" : rar === "RARE" ? "#c084fc" : "rgba(255,255,255,0.4)";
                    const cid   = c.cardId ?? c.card_id ?? c.id;
                    return (
                      <div key={cid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: `1px solid ${rc}20`, borderRadius: "8px" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "13px", color: "#fff" }}>{c.cardName ?? c.name}</div>
                          <div style={{ fontSize: "11px", color: rc, marginTop: "2px" }}>{rar} · ×{c.quantity}</div>
                        </div>
                        <button
                          disabled={sellingCard === cid}
                          onClick={async () => {
                            setSellingCard(cid);
                            try {
                              const r = await fetch("/api/card-clash/sell-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId, cardId: cid }) });
                              if (r.ok) loadData();
                            } finally { setSellingCard(null); }
                          }}
                          style={{ padding: "5px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: sellingCard === cid ? "rgba(255,255,255,0.2)" : "#ffd24a", fontWeight: 700, fontSize: "11px", cursor: sellingCard === cid ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                        >
                          {sellingCard === cid ? "…" : `+${price}🪙`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </div>
        )}

        {/* ── PLAY ── */}
        {activeTab === "play" && (
          <div style={{ animation: "tabFadeIn 0.25s ease" }}>
            <SectionHeader title="⚡ Enter the Clash" subtitle="Select an opponent, optionally equip up to 4 cards, and play" />
            <CardClashMatchLauncher
              currentPlayerId={playerId}
              currentPlayerName={playerName}
              onMatchComplete={() => { setActiveTab("collection"); loadData(); }}
            />
            <div style={{ marginTop: "2.5rem" }}>
              <PanelTitle style={{ marginBottom: "1rem" }}>Your Challenges</PanelTitle>
              <PlayerChallenges playerId={playerId} />
            </div>
          </div>
        )}

        {/* ── PRACTICE ── */}
        {activeTab === "practice" && (
          <div style={{ animation: "tabFadeIn 0.25s ease" }}>
            <SectionHeader title="🎲 Practice Mode" subtitle="No coins spent, no cards consumed — test strategies risk-free" />
            <CardClashMockGame
              playerId={playerId}
              playerName={playerName}
              onDone={() => setActiveTab("collection")}
            />
          </div>
        )}

        {/* ── STANDINGS ── */}
        {activeTab === "standings" && (
          <div style={{ animation: "tabFadeIn 0.25s ease" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "1.75rem" }}>
              <SectionHeader title="🏆 Standings" subtitle="Ranked by total wins across all Card Clash matches" noMargin />
              <button onClick={loadData} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "7px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>↻ Refresh</button>
            </div>

            {standings.length > 0 ? (
              <Panel style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                      {["#", "Player", "W", "L", "Played", "Pts"].map(h => (
                        <th key={h} style={{ padding: "12px 18px", textAlign: h === "Player" || h === "#" ? "left" : "center", color: "rgba(255,255,255,0.3)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.12em", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, idx) => {
                      const isMe = row.player_id === playerId;
                      return (
                        <tr key={row.player_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: isMe ? "rgba(0,180,255,0.06)" : idx % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                          <td style={{ padding: "14px 18px", color: idx < 3 ? ["#ffd24a","#c0c0c0","#cd7f32"][idx] : "rgba(255,255,255,0.3)", fontWeight: 900, fontSize: "15px" }}>
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                          </td>
                          <td style={{ padding: "14px 18px", fontWeight: isMe ? 700 : 400, color: isMe ? "#00b4ff" : "#fff" }}>
                            {row.player_name}{isMe && <span style={{ fontSize: "10px", color: "rgba(0,180,255,0.45)", marginLeft: "7px" }}>(you)</span>}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "center", color: "#00ff88", fontWeight: 700 }}>{row.wins}</td>
                          <td style={{ padding: "14px 18px", textAlign: "center", color: "#ff6b6b" }}>{row.losses}</td>
                          <td style={{ padding: "14px 18px", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>{row.total_matches}</td>
                          <td style={{ padding: "14px 18px", textAlign: "center", color: "#00e5ff", fontWeight: 700 }}>{row.points ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            ) : (
              <div style={{ textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.25)" }}>
                <div style={{ fontSize: "44px", marginBottom: "1rem" }}>🏆</div>
                <div>No matches yet — play some Card Clash games to appear here!</div>
              </div>
            )}
          </div>
        )}

        {/* ── ACHIEVEMENTS ── */}
        {activeTab === "achievements" && (
          <div style={{ animation: "tabFadeIn 0.25s ease" }}>
            <SectionHeader title="🎖️ Achievements" subtitle="Earn coins and bonus packs by completing challenges" />

            {achievements?.stats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(128px,1fr))", gap: "10px", marginBottom: "2rem" }}>
                {[
                  { label: "Matches",  value: achievements.stats.matchesPlayed,    icon: "🃏", color: "#00b4ff" },
                  { label: "Wins",     value: achievements.stats.matchesWon,        icon: "⚡", color: "#00ff88" },
                  { label: "Cards",    value: achievements.stats.cardsOwned,        icon: "🎴", color: "#ffd24a" },
                  { label: "Packs",    value: achievements.stats.packsOpened,       icon: "📦", color: "#c084fc" },
                  { label: "Streak",   value: `${achievements.stats.loginStreak}d`, icon: "🔥", color: "#ff9500" },
                ].map(s => (
                  <div key={s.label} style={{ padding: "16px 14px", background: `linear-gradient(135deg,${s.color}0d,${s.color}05)`, border: `1px solid ${s.color}25`, borderRadius: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "22px", marginBottom: "7px" }}>{s.icon}</div>
                    <div style={{ fontSize: "22px", fontWeight: 900, color: s.color, fontFamily: "'Arial Black',Arial,sans-serif", lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "5px", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {achievements?.achievements ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "10px" }}>
                {achievements.achievements.map((a: any) => {
                  const rarColors: Record<string,string> = { Common: "#9ca3af", Rare: "#c084fc", Epic: "#818cf8", Legendary: "#ffd24a" };
                  const rc = rarColors[a.rarity] ?? "#9ca3af";
                  return (
                    <div key={a.key} style={{ padding: "14px 16px", background: a.earned ? `linear-gradient(135deg,${rc}08,rgba(0,0,0,0))` : "rgba(255,255,255,0.02)", border: `1px solid ${a.earned ? rc + "40" : "rgba(255,255,255,0.06)"}`, borderRadius: "12px", opacity: a.earned ? 1 : 0.62, transition: "opacity 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ fontSize: "28px", lineHeight: 1, filter: a.earned ? "none" : "grayscale(1)", flexShrink: 0 }}>{a.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "5px" }}>
                            <span style={{ fontWeight: 700, fontSize: "13px", color: a.earned ? "#fff" : "rgba(255,255,255,0.42)" }}>{a.name}</span>
                            <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 8px", borderRadius: "8px", background: rc + "1c", color: rc, letterSpacing: "0.08em" }}>{a.rarity.toUpperCase()}</span>
                            {a.earned && <span style={{ fontSize: "10px", color: "#00ff88", fontWeight: 700 }}>✓ EARNED</span>}
                          </div>
                          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.36)", marginBottom: "8px", lineHeight: 1.5 }}>{a.description}</div>
                          {!a.earned && (
                            <div style={{ marginBottom: "8px" }}>
                              <div style={{ height: "3px", background: "rgba(255,255,255,0.07)", borderRadius: "2px", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min(100, (a.progress / a.statValue) * 100)}%`, background: `linear-gradient(90deg,${rc}88,${rc})`, borderRadius: "2px" }} />
                              </div>
                              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.26)", marginTop: "3px" }}>{Math.min(a.progress, a.statValue)} / {a.statValue}</div>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "11px", color: "#ffd24a", fontWeight: 700 }}>🪙 {a.coinReward}</span>
                            {a.packName && <span style={{ fontSize: "11px", color: "#00b4ff" }}>📦 {a.packName}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.25)" }}>
                <div style={{ fontSize: "40px", marginBottom: "1rem" }}>🎖️</div>
                <div>Loading achievements…</div>
              </div>
            )}
          </div>
        )}

        {/* ── RULES ── */}
        {activeTab === "rules" && (
          <div style={{ animation: "tabFadeIn 0.25s ease" }}>
            <SectionHeader title="📖 How to Play" subtitle="The complete guide to TKDL Card Clash" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "10px" }}>
              {([
                { icon: "🃏", h: "What is Card Clash?",  body: "TKDL's exclusive meta-game built on top of your real darts matches. Collect 100 unique cards, equip them before a match, and trigger tactical effects during play." },
                { icon: "🪙", h: "Earning Coins",        body: "Log in daily (streak bonuses grow), complete achievements, sell duplicate cards, and win Card Clash matches." },
                { icon: "📦", h: "Packs & Drop Rates",   body: "Standard Pull — 50 coins, 1 card\nKilbirnie Night — 200 coins, 5 cards\nLegend Vault — 350 coins, 10 cards\n\n75% Common · 20% Rare · 5% Legendary\nGuaranteed Legendary after 50 pulls." },
                { icon: "✨", h: "Card Rarities",        body: "Common — solid, reliable effects\nRare — stronger or niche effects\nLegendary — the most powerful cards in the game" },
                { icon: "🎯", h: "Card Categories",      body: "X01, Cricket, or Wildcard — each works in its matching game mode. Wildcards work everywhere.\n\nGood cards benefit you. Bad cards curse your opponent." },
                { icon: "⚡", h: "Equipping Cards",      body: "In the Play tab, pick your opponent and game mode, then optionally equip up to 4 cards. Cards are never required — you can always play without them." },
                { icon: "🎖️", h: "Achievements",         body: "Complete milestones to earn coins and free packs. Earned packs appear in the Shop and can be opened any time." },
                { icon: "🔥", h: "Login Streak",         body: "Log in daily to grow your streak.\n7 days = 200 coins + 1 Standard Pull\n30 days = 1000 coins + Kilbirnie Night Pack" },
                { icon: "♻️", h: "Selling Duplicates",  body: "Common → 10 coins\nRare → 30 coins\nLegendary → 100 coins\n\nSell spares from the Shop tab." },
              ] as { icon: string; h: string; body: string }[]).map(s => (
                <div key={s.h} style={{ padding: "18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px" }}>
                  <h3 style={{ margin: "0 0 9px", fontSize: "12px", fontWeight: 900, color: "#ffd24a", fontFamily: "'Arial Black',Arial,sans-serif", letterSpacing: "0.07em", textTransform: "uppercase" }}>{s.icon} {s.h}</h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.44)", lineHeight: 1.75, whiteSpace: "pre-line" }}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>


          {/* ── ADMIN ── */}
          {activeTab === "admin" && (
            <div style={{ animation: "tabFadeIn 0.25s ease", maxWidth: "560px", margin: "0 auto" }}>
              <SectionHeader title="⚙️ Admin Panel" subtitle="Launch prep tools — PIN protected" />

              {!adminAuthed ? (
                <Panel>
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: "40px", marginBottom: "18px" }}>🔐</div>
                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "18px", fontFamily: "Arial,sans-serif" }}>Enter admin PIN to continue</div>
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="••••"
                      value={adminPin}
                      onChange={e => { setAdminPin(e.target.value); setAdminPinError(false); }}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          if (adminPin === "0601") { setAdminAuthed(true); setAdminPinError(false); }
                          else { setAdminPinError(true); setAdminPin(""); }
                        }
                      }}
                      style={{ padding: "12px 20px", background: adminPinError ? "rgba(255,60,60,0.08)" : "rgba(255,255,255,0.06)", border: `1px solid ${adminPinError ? "rgba(255,60,60,0.4)" : "rgba(255,255,255,0.14)"}`, borderRadius: "8px", color: "#fff", fontSize: "22px", textAlign: "center", outline: "none", width: "140px", letterSpacing: "0.3em", marginBottom: "12px" }}
                    />
                    {adminPinError && <div style={{ fontSize: "12px", color: "#ff5566", marginBottom: "12px", fontFamily: "Arial,sans-serif" }}>Incorrect PIN</div>}
                    <br />
                    <button
                      onClick={() => {
                        if (adminPin === "0601") { setAdminAuthed(true); setAdminPinError(false); }
                        else { setAdminPinError(true); setAdminPin(""); }
                      }}
                      style={{ padding: "10px 28px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "8px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em" }}
                    >
                      Unlock
                    </button>
                  </div>
                </Panel>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                  {/* Success/error result banner */}
                  {adminResult && (
                    <div style={{ padding: "14px 18px", borderRadius: "10px", background: adminResult.ok ? "rgba(0,255,136,0.07)" : "rgba(255,60,60,0.07)", border: `1px solid ${adminResult.ok ? "rgba(0,255,136,0.28)" : "rgba(255,60,60,0.28)"}` }}>
                      <div style={{ fontWeight: 700, color: adminResult.ok ? "#00ff88" : "#ff5566", marginBottom: "6px", fontFamily: "Arial,sans-serif" }}>
                        {adminResult.ok ? "✅" : "❌"} {adminResult.message}
                      </div>
                      {adminResult.details?.map((d, i) => (
                        <div key={i} style={{ fontSize: "12px", color: "rgba(255,255,255,0.36)", fontFamily: "Arial,sans-serif", lineHeight: 1.6 }}>{d}</div>
                      ))}
                    </div>
                  )}

                  {/* Challenge reset */}
                  <Panel>
                    <PanelTitle color="#00b4ff">🗑️ Clear Challenges</PanelTitle>
                    <p style={{ margin: "0 0 14px", fontSize: "12px", color: "rgba(255,255,255,0.36)", lineHeight: 1.6, fontFamily: "Arial,sans-serif" }}>
                      Removes all daily &amp; weekly challenge progress. Definitions (the challenge templates) are preserved — players will get fresh challenges next time they visit.
                    </p>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        disabled={adminAction === "clearMyChallenge"}
                        onClick={async () => {
                          setAdminAction("clearMyChallenge"); setAdminResult(null);
                          try {
                            const r = await fetch("/api/card-clash/admin/challenges/clear", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "x-admin-pin": "0601" },
                              body: JSON.stringify({ playerId })
                            });
                            const d = await r.json();
                            setAdminResult({ ok: r.ok, message: d.message ?? (r.ok ? "Done" : d.error), details: [] });
                            if (r.ok) loadData();
                          } catch (e: any) { setAdminResult({ ok: false, message: e.message }); }
                          finally { setAdminAction(null); }
                        }}
                        style={{ padding: "10px 20px", background: "rgba(0,180,255,0.08)", border: "1px solid rgba(0,180,255,0.3)", borderRadius: "8px", color: "#00b4ff", fontWeight: 700, fontSize: "12px", cursor: adminAction ? "not-allowed" : "pointer", letterSpacing: "0.06em" }}
                      >
                        {adminAction === "clearMyChallenge" ? "Clearing…" : "Clear MY Challenges"}
                      </button>
                      <button
                        disabled={!!adminAction}
                        onClick={async () => {
                          if (!window.confirm("Clear challenges for ALL players?")) return;
                          setAdminAction("clearAllChallenges"); setAdminResult(null);
                          try {
                            const r = await fetch("/api/card-clash/admin/challenges/clear", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "x-admin-pin": "0601" },
                              body: JSON.stringify({})
                            });
                            const d = await r.json();
                            setAdminResult({ ok: r.ok, message: d.message ?? (r.ok ? "Done" : d.error), details: [] });
                          } catch (e: any) { setAdminResult({ ok: false, message: e.message }); }
                          finally { setAdminAction(null); }
                        }}
                        style={{ padding: "10px 20px", background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.3)", borderRadius: "8px", color: "#ffaa00", fontWeight: 700, fontSize: "12px", cursor: adminAction ? "not-allowed" : "pointer", letterSpacing: "0.06em" }}
                      >
                        {adminAction === "clearAllChallenges" ? "Clearing…" : "Clear ALL Players' Challenges"}
                      </button>
                    </div>
                  </Panel>

                  {/* Full nuclear reset */}
                  <Panel style={{ border: "1px solid rgba(255,60,60,0.25)", background: "rgba(255,30,30,0.03)" }}>
                    <PanelTitle color="#ff5566">☢️ Full Nuclear Reset</PanelTitle>
                    <p style={{ margin: "0 0 10px", fontSize: "12px", color: "rgba(255,255,255,0.36)", lineHeight: 1.6, fontFamily: "Arial,sans-serif" }}>
                      Wipes <strong style={{ color: "rgba(255,255,255,0.55)" }}>all</strong> Card Clash player data: card inventories, matches, achievements, packs, challenges, login streaks. Everyone's coin balance resets to <strong style={{ color: "#ffd24a" }}>200 starter coins</strong>. Card definitions and challenge templates are preserved.
                    </p>
                    <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#ff9999", fontFamily: "Arial,sans-serif" }}>
                      Use this immediately before your real launch so everyone starts fresh.
                    </p>
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "6px", fontFamily: "Arial,sans-serif" }}>Type LAUNCH to confirm:</div>
                      <input
                        type="text"
                        placeholder="LAUNCH"
                        value={confirmText}
                        onChange={e => setConfirmText(e.target.value.toUpperCase())}
                        style={{ padding: "9px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,60,60,0.25)", borderRadius: "7px", color: "#fff", fontSize: "14px", outline: "none", width: "140px", letterSpacing: "0.14em" }}
                      />
                    </div>
                    <button
                      disabled={confirmText !== "LAUNCH" || !!adminAction}
                      onClick={async () => {
                        setAdminAction("fullReset"); setAdminResult(null); setConfirmText("");
                        try {
                          const r = await fetch("/api/card-clash/admin/full-reset", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "x-admin-pin": "0601" },
                            body: JSON.stringify({})
                          });
                          const d = await r.json();
                          setAdminResult({ ok: r.ok, message: d.message ?? (r.ok ? "Reset complete" : d.error), details: d.results });
                          if (r.ok) loadData();
                        } catch (e: any) { setAdminResult({ ok: false, message: e.message }); }
                        finally { setAdminAction(null); }
                      }}
                      style={{ padding: "12px 28px", background: confirmText === "LAUNCH" ? "linear-gradient(135deg,#c0392b,#e74c3c)" : "rgba(255,255,255,0.04)", border: `1px solid ${confirmText === "LAUNCH" ? "rgba(255,60,60,0.6)" : "rgba(255,255,255,0.08)"}`, borderRadius: "9px", color: confirmText === "LAUNCH" ? "#fff" : "rgba(255,255,255,0.2)", fontWeight: 900, fontSize: "13px", cursor: confirmText === "LAUNCH" && !adminAction ? "pointer" : "not-allowed", letterSpacing: "0.08em", boxShadow: confirmText === "LAUNCH" ? "0 4px 22px rgba(231,76,60,0.35)" : "none", transition: "all 0.2s" }}
                    >
                      {adminAction === "fullReset" ? "⏳ Resetting everything…" : "☢️ NUCLEAR RESET — LAUNCH READY"}
                    </button>
                  </Panel>

                  <button
                    onClick={() => { setAdminAuthed(false); setAdminPin(""); setAdminResult(null); setConfirmText(""); }}
                    style={{ padding: "8px 18px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "7px", color: "rgba(255,255,255,0.28)", fontSize: "12px", cursor: "pointer" }}
                  >
                    🔒 Lock Admin Panel
                  </button>
                </div>
              )}
            </div>
          )}

      {/* ── CARD ENLARGE MODAL ── */}
      {enlargedCard && (
        <div onClick={() => setEnlargedCard(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.9)", backdropFilter: "blur(12px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "22px", padding: "20px" }}>
            <div style={{ display: "flex", gap: "32px", alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
              <TKDLCard card={enlargedCard} size="lg" locked={!ownedNames.has(enlargedCard.name)} />
              <div style={{ maxWidth: "280px", paddingTop: "8px" }}>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.26)", letterSpacing: "0.1em", marginBottom: "8px" }}>CLICK CARD TO FLIP</div>
                <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#fff", margin: "0 0 12px", fontFamily: "'Arial Black',sans-serif" }}>{enlargedCard.name}</h2>
                <div style={{ display: "flex", gap: "7px", marginBottom: "16px", flexWrap: "wrap" }}>
                  <Badge color={CAT_COLOR[enlargedCard.category]}>{enlargedCard.category}</Badge>
                  <Badge color={RAR_COLOR[enlargedCard.rarity]}>{enlargedCard.rarity}</Badge>
                  {ownedNames.has(enlargedCard.name) ? <Badge color="#00ff88">✓ OWNED</Badge> : <Badge color="rgba(255,255,255,0.28)">NOT OWNED</Badge>}
                </div>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", lineHeight: 1.65, margin: "0 0 14px" }}>{enlargedCard.effect}</p>
                {enlargedCard.flavourText && (
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontStyle: "italic", lineHeight: 1.5, margin: 0, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "12px" }}>"{enlargedCard.flavourText}"</p>
                )}
                {!ownedNames.has(enlargedCard.name) && (
                  <button onClick={() => { setEnlargedCard(null); setActiveTab("shop"); }} style={{ marginTop: "18px", padding: "10px 22px", background: "rgba(255,210,74,0.12)", border: "1px solid rgba(255,210,74,0.35)", borderRadius: "8px", color: "#ffd24a", fontWeight: 700, fontSize: "13px", cursor: "pointer", letterSpacing: "0.04em" }}>
                    🛍️ Buy in Shop
                  </button>
                )}
              </div>
            </div>
            <button onClick={() => setEnlargedCard(null)} style={{ padding: "8px 24px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: "13px" }}>
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared UI primitives ───────────────────────────────────────────────────────

function Chip({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 12px", borderRadius: "14px", cursor: "pointer", fontSize: "11px", fontWeight: 700,
      letterSpacing: "0.04em", transition: "all 0.14s", border: "1px solid", whiteSpace: "nowrap",
      background: active ? `${color}1c` : "transparent",
      color: active ? color : "rgba(255,255,255,0.28)",
      borderColor: active ? `${color}50` : "rgba(255,255,255,0.08)",
      boxShadow: active ? `0 0 10px ${color}22` : "none",
    }}>
      {label}
    </button>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 9px", borderRadius: "14px", background: `${color}1c`, color, border: `1px solid ${color}3c`, letterSpacing: "0.04em" }}>
      {children}
    </span>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: "20px 22px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "14px", ...style }}>
      {children}
    </div>
  );
}

function PanelTitle({ children, color, style }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: "11px", fontWeight: 900, color: color ?? "rgba(255,255,255,0.65)", letterSpacing: "0.13em", textTransform: "uppercase", fontFamily: "'Arial Black',Arial,sans-serif", marginBottom: "8px", ...style }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, noMargin }: { title: string; subtitle?: string; noMargin?: boolean }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : "2rem" }}>
      <h2 style={{ margin: "0 0 5px", fontSize: "22px", fontWeight: 900, color: "#fff", letterSpacing: "0.04em", fontFamily: "'Arial Black',Impact,Arial,sans-serif" }}>{title}</h2>
      {subtitle && <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.36)" }}>{subtitle}</p>}
    </div>
  );
}
