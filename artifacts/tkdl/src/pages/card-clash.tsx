import React, { useState, useEffect, useCallback } from "react";
import { useCurrentPlayer } from "@/context/auth";
import { CardShopUI } from "@/components/CardShopUI";
import { CoinBalance } from "@/components/CoinBalance";
import { CardClashMatchLauncher } from "@/components/CardClashMatchLauncher";
import { CardClashMockGame } from "@/components/CardClashMockGame";
import { PlayerChallenges } from "@/components/PlayerChallenges";
import { TKDLCard } from "@/components/TKDLCard";
import { ALL_CARDS } from "@/lib/cards-data";
import type { CardData, Category, Rarity } from "@/lib/cards-data";

type Tab = "collection" | "shop" | "play" | "standings" | "mock" | "achievements" | "rules";

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

export default function CardClashPage() {
  const currentPlayer = useCurrentPlayer();
  const playerId = currentPlayer?.playerId;

  const [activeTab, setActiveTab] = useState<Tab>("collection");
  const [stats, setStats] = useState<Stats | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [ownedNames, setOwnedNames] = useState<Set<string>>(new Set());
  const [newCardNames, setNewCardNames] = useState<Set<string>>(new Set());
  const [collLoading, setCollLoading] = useState(true);
  const [achievements, setAchievements] = useState<any>(null);
  const [packInventory, setPackInventory] = useState<any[]>([]);
  const [packInvLoading, setPackInvLoading] = useState(false);
  const [openingPack, setOpeningPack] = useState<number | null>(null);
  const [openedCards, setOpenedCards] = useState<any[] | null>(null);
  const [dupCards, setDupCards] = useState<any[]>([]);
  const [sellingCard, setSellingCard] = useState<string | null>(null);

  // Load NEW card names from localStorage (cards acquired in last 24h)
  useEffect(() => {
    if (!playerId) return;
    const key = `tkdl_new_cards_${playerId}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const stored: Record<string, number> = JSON.parse(raw);
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const fresh = new Set(Object.entries(stored).filter(([, ts]) => ts > cutoff).map(([name]) => name));
      // Prune stale entries
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
      const raw = localStorage.getItem(key);
      const stored: Record<string, number> = raw ? JSON.parse(raw) : {};
      const now = Date.now();
      for (const name of cardNames) stored[name] = now;
      localStorage.setItem(key, JSON.stringify(stored));
      setNewCardNames(prev => new Set([...prev, ...cardNames]));
    } catch {}
    loadData();
  };

  // Collection filters
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "ALL">("ALL");
  const [rarFilter, setRarFilter] = useState<Rarity | "ALL">("ALL");
  const [showOwned, setShowOwned] = useState<"all" | "owned" | "unowned">("all");
  const [enlargedCard, setEnlargedCard] = useState<CardData | null>(null);


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
    { id: "achievements", label: "Achievements", icon: "🎖️" },
    { id: "rules", label: "Rules", icon: "📖" },
    { id: "mock", label: "Mock Game", icon: "🎲" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#03050d", color: "#fff", fontFamily: "'Arial Black', Impact, Arial, sans-serif" }}>

      {/* ─── HERO HEADER ─── */}
      <div style={{ position: "relative", overflow: "hidden", paddingBottom: "0" }}>
        {/* Background image layer */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url('https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1400&q=80')",
          backgroundSize: "cover", backgroundPosition: "center",
          filter: "brightness(0.12) saturate(0.4)",
        }} />
        {/* Radial glow overlays */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 70% 80% at 20% 40%, rgba(0,180,255,0.08), transparent 70%), radial-gradient(ellipse 50% 70% at 80% 60%, rgba(255,170,0,0.06), transparent 70%)",
        }} />
        {/* Bottom fade to page bg */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "80px", background: "linear-gradient(to bottom, transparent, #03050d)" }} />

        <div style={{ position: "relative", zIndex: 2, maxWidth: "1400px", margin: "0 auto", padding: "2.5rem 2rem 0" }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "7px",
            background: "rgba(255,212,74,0.1)", border: "1px solid rgba(255,212,74,0.35)",
            borderRadius: "24px", padding: "5px 16px", marginBottom: "18px",
          }}>
            <span style={{ color: "#ffd24a", fontSize: "10px", fontWeight: 900, letterSpacing: "0.2em" }}>⚡ TKDL EXCLUSIVE GAME MODE</span>
          </div>

          {/* Giant title */}
          <div style={{ lineHeight: 0.88, marginBottom: "16px" }}>
            <div style={{
              fontSize: "clamp(48px, 7vw, 96px)", fontWeight: 900, letterSpacing: "0.07em",
              textTransform: "uppercase",
              background: "linear-gradient(135deg, #ffffff 0%, #00d4ff 40%, #ffffff 60%, #aaddff 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>CARD</div>
            <div style={{
              fontSize: "clamp(48px, 7vw, 96px)", fontWeight: 900, letterSpacing: "0.07em",
              textTransform: "uppercase",
              background: "linear-gradient(135deg, #ffaa00, #ffd24a 50%, #ff6b00)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>CLASH</div>
          </div>

          {/* Subtitle */}
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.65)", fontFamily: "Arial, sans-serif", fontWeight: 400, letterSpacing: "0.03em", lineHeight: 1.6, marginBottom: "22px", maxWidth: "480px" }}>
            100 cards. Real dart matches. Mid-game chaos.<br />
            <span style={{ color: "#00d4ff" }}>Darts has never played like this.</span>
          </p>

          {/* CTA quick-action buttons */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "28px" }}>
            <button onClick={() => setActiveTab("play")} style={{
              padding: "12px 28px", background: "linear-gradient(135deg,#ffd24a,#ff8c00)",
              border: "none", borderRadius: "4px", color: "#000", fontSize: "12px", fontWeight: 900,
              letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer",
              boxShadow: "0 0 28px rgba(255,212,74,0.45), 0 4px 14px rgba(0,0,0,0.4)",
            }}>⚡ ENTER THE CLASH</button>
            <button onClick={() => setActiveTab("shop")} style={{
              padding: "12px 22px", background: "transparent",
              border: "2px solid rgba(255,255,255,0.18)", borderRadius: "4px",
              color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 900,
              letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
            }}>🛍️ OPEN PACKS</button>
            <button onClick={() => setActiveTab("collection")} style={{
              padding: "12px 22px", background: "transparent",
              border: "2px solid rgba(0,212,255,0.2)", borderRadius: "4px",
              color: "rgba(0,212,255,0.7)", fontSize: "12px", fontWeight: 900,
              letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
            }}>🃏 COLLECTION</button>
          </div>

          {/* Stats strip */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "24px" }}>
            {[
              { label: "COINS", value: stats?.coins ?? "—", color: "#ffd24a", icon: "🪙" },
              { label: "CARDS", value: `${totalOwned}/${ALL_CARDS.length}`, color: "#00e5ff", icon: "🃏" },
              { label: "WINS", value: stats?.wins ?? "—", color: "#00ff88", icon: "🏆" },
              { label: "WIN RATE", value: stats ? `${winRate}%` : "—", color: "#c084fc", icon: "📊" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "9px", background: "rgba(255,255,255,0.05)", border: `1px solid ${s.color}20`, borderRadius: "8px", padding: "8px 14px" }}>
                <span style={{ fontSize: "16px" }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", fontFamily: "Arial, sans-serif" }}>{s.label}</div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{String(s.value)}</div>
                </div>
              </div>
            ))}
            {/* Progress bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "8px 14px", flex: 1, minWidth: "180px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", fontFamily: "Arial, sans-serif", marginBottom: "5px" }}>COLLECTION</div>
                <div style={{ height: "5px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${completionPct}%`, background: "linear-gradient(90deg,#00e5ff,#ffd24a)", transition: "width 0.5s" }} />
                </div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "4px", fontFamily: "Arial, sans-serif" }}>{completionPct}% complete</div>
              </div>
            </div>
          </div>

          {/* Tab navigation */}
          <div style={{ display: "flex", gap: "2px", borderBottom: "1px solid rgba(255,255,255,0.08)", overflowX: "auto" }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: "11px 22px", border: "none", cursor: "pointer", fontWeight: 800, fontSize: "12px",
                letterSpacing: "0.1em", background: "transparent", whiteSpace: "nowrap", transition: "all 0.2s",
                textTransform: "uppercase", fontFamily: "'Arial Black', Impact, Arial, sans-serif",
                color: activeTab === tab.id ? "#ffd24a" : "rgba(255,255,255,0.35)",
                borderBottom: activeTab === tab.id ? "3px solid #ffd24a" : "3px solid transparent",
                marginBottom: "-1px",
              }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── TAB CONTENT ─── */}
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem 2rem 4rem" }}>

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
                    <div key={card.id} onClick={() => setEnlargedCard(card)} style={{ cursor: "pointer", transition: "transform 0.2s", flexShrink: 0, position: "relative" }}
                      onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04) translateY(-4px)")}
                      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      <TKDLCard card={card} size="sm" locked={!owned} />
                      {newCardNames.has(card.name) && (
                        <div style={{ position: "absolute", top: "6px", right: "6px", background: "linear-gradient(135deg,#ff3b3b,#ff6b00)", color: "#fff", fontSize: "9px", fontWeight: 900, padding: "2px 7px", borderRadius: "10px", letterSpacing: "0.08em", boxShadow: "0 2px 8px rgba(255,60,60,0.5)", zIndex: 5 }}>NEW</div>
                      )}
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
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "1rem" }}>
                <div>
                  <h2 style={{ ...sectionH2, fontSize: "24px" }}>🛍️ TKDL Card Shop</h2>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: "4px 0 0", lineHeight: 1.5 }}>
                    Build your arsenal. Every card is a weapon — collect them all.
                  </p>
                </div>
                <CoinBalance playerId={playerId} />
              </div>
            </div>

            {/* Achievement packs to open */}
            {packInventory.length > 0 && (
              <div style={{ marginBottom: "2rem", padding: "20px", background: "linear-gradient(135deg,rgba(255,210,74,0.08),rgba(255,165,0,0.04))", border: "1px solid rgba(255,210,74,0.25)", borderRadius: "14px" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: "#ffd24a", letterSpacing: "0.06em" }}>🎁 YOUR ACHIEVEMENT PACKS</h3>
                <p style={{ margin: "0 0 16px", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Earned from achievements — open them for free!</p>
                {openedCards && (
                  <div style={{ marginBottom: "16px", padding: "14px", background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "10px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#00ff88", marginBottom: "8px" }}>✨ Cards received!</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {openedCards.map((c: any, i: number) => {
                        const rc = c.rarity === "LEGENDARY" ? "#ffd24a" : c.rarity === "RARE" ? "#c084fc" : "rgba(255,255,255,0.5)";
                        return <span key={i} style={{ padding: "4px 10px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: `1px solid ${rc}`, fontSize: "12px", color: rc }}>{c.name} ({c.rarity})</span>;
                      })}
                    </div>
                    <button onClick={() => setOpenedCards(null)} style={{ marginTop: "10px", fontSize: "11px", color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}>Dismiss</button>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {packInventory.map((pk: any) => (
                    <div key={pk.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "14px" }}>{pk.packName}</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>{pk.earned_reason?.replace("ACHIEVEMENT:", "From achievement: ") ?? "Achievement reward"}</div>
                      </div>
                      <button
                        disabled={openingPack === pk.id}
                        onClick={async () => {
                          setOpeningPack(pk.id);
                          setOpenedCards(null);
                          try {
                            const r = await fetch(`/api/card-clash/pack-inventory/${pk.id}/open`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ playerId }),
                            });
                            const data = await r.json();
                            if (data.cards) {
                              setOpenedCards(data.cards);
                              loadData();
                            }
                          } finally { setOpeningPack(null); }
                        }}
                        style={{ padding: "8px 18px", background: openingPack === pk.id ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg,#ffd24a,#ff9500)", border: "none", borderRadius: "8px", color: openingPack === pk.id ? "rgba(255,255,255,0.4)" : "#000", fontWeight: 800, fontSize: "12px", cursor: openingPack === pk.id ? "not-allowed" : "pointer", letterSpacing: "0.05em" }}
                      >
                        {openingPack === pk.id ? "Opening..." : "Open Pack"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <CardShopUI playerId={playerId} onCardsReceived={handleCardsReceived} />

            {/* Sell duplicate cards */}
            {dupCards.length > 0 && (
              <div style={{ marginTop: "2rem", padding: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: "rgba(255,255,255,0.8)", letterSpacing: "0.06em" }}>♻️ SELL DUPLICATES</h3>
                <p style={{ margin: "0 0 16px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>Turn spare cards into coins — sell one copy at a time. Common: 10🪙  Rare: 30🪙  Legendary: 100🪙</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "10px" }}>
                  {dupCards.map((c: any) => {
                    const rar = (c.rarity ?? "COMMON").toUpperCase();
                    const prices: Record<string,number> = { COMMON: 10, RARE: 30, LEGENDARY: 100 };
                    const price = prices[rar] ?? 10;
                    const rc = rar === "LEGENDARY" ? "#ffd24a" : rar === "RARE" ? "#c084fc" : "rgba(255,255,255,0.5)";
                    const cid = c.cardId ?? c.card_id ?? c.id;
                    return (
                      <div key={cid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${rc}30`, borderRadius: "10px" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "13px", color: "#fff" }}>{c.cardName ?? c.name}</div>
                          <div style={{ fontSize: "11px", color: rc, marginTop: "2px" }}>{rar} — ×{c.quantity} owned</div>
                        </div>
                        <button
                          disabled={sellingCard === cid}
                          onClick={async () => {
                            setSellingCard(cid);
                            try {
                              const r = await fetch("/api/card-clash/sell-card", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ playerId, cardId: cid }),
                              });
                              if (r.ok) loadData();
                            } finally { setSellingCard(null); }
                          }}
                          style={{ padding: "6px 14px", background: sellingCard === cid ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: sellingCard === cid ? "rgba(255,255,255,0.3)" : "#ffd24a", fontWeight: 700, fontSize: "12px", cursor: sellingCard === cid ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                        >
                          {sellingCard === cid ? "..." : `Sell +${price}🪙`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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

        {/* ── ACHIEVEMENTS ── */}
        {activeTab === "achievements" && (
          <div>
            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ ...sectionH2, fontSize: "24px" }}>🎖️ Card Clash Achievements</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: "4px 0 0" }}>Earn coins and bonus packs by completing challenges</p>
            </div>

            {achievements?.stats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: "12px", marginBottom: "2rem" }}>
                {[
                  { label: "Matches Played", value: achievements.stats.matchesPlayed, icon: "🃏" },
                  { label: "Matches Won", value: achievements.stats.matchesWon, icon: "⚡" },
                  { label: "Cards Owned", value: achievements.stats.cardsOwned, icon: "🎴" },
                  { label: "Packs Opened", value: achievements.stats.packsOpened, icon: "📦" },
                  { label: "Login Streak", value: `${achievements.stats.loginStreak}d`, icon: "🔥" },
                ].map(s => (
                  <div key={s.label} style={{ padding: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "22px", marginBottom: "6px" }}>{s.icon}</div>
                    <div style={{ fontSize: "20px", fontWeight: 900, color: "#fff" }}>{s.value}</div>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {achievements?.achievements ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "12px" }}>
                {achievements.achievements.map((a: any) => {
                  const rarColors: Record<string,string> = { Common: "#9ca3af", Rare: "#c084fc", Epic: "#818cf8", Legendary: "#ffd24a" };
                  const rc = rarColors[a.rarity] ?? "#9ca3af";
                  return (
                    <div key={a.key} style={{ padding: "16px", background: a.earned ? "rgba(0,255,136,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${a.earned ? rc + "50" : "rgba(255,255,255,0.07)"}`, borderRadius: "12px", opacity: a.earned ? 1 : 0.7 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ fontSize: "28px", lineHeight: 1, filter: a.earned ? "none" : "grayscale(1)" }}>{a.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                            <span style={{ fontWeight: 800, fontSize: "13px", color: a.earned ? "#fff" : "rgba(255,255,255,0.5)" }}>{a.name}</span>
                            <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "9px", background: rc + "22", color: rc, letterSpacing: "0.06em" }}>{a.rarity.toUpperCase()}</span>
                            {a.earned && <span style={{ fontSize: "10px", color: "#00ff88" }}>✓ EARNED</span>}
                          </div>
                          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>{a.description}</div>
                          {/* Progress bar */}
                          {!a.earned && (
                            <div style={{ marginBottom: "8px" }}>
                              <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min(100, (a.progress / a.statValue) * 100)}%`, background: rc, borderRadius: "2px", transition: "width 0.3s" }} />
                              </div>
                              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "3px" }}>{Math.min(a.progress, a.statValue)} / {a.statValue}</div>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "11px", color: "#ffd24a" }}>🪙 {a.coinReward} coins</span>
                            {a.packName && <span style={{ fontSize: "11px", color: "#00b4ff" }}>📦 {a.packName}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.3)" }}>
                <div style={{ fontSize: "40px", marginBottom: "1rem" }}>🎖️</div>
                <div>Loading achievements…</div>
              </div>
            )}
          </div>
        )}

        {/* ── RULES ── */}
        {activeTab === "rules" && (
          <div>
            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ ...sectionH2, fontSize: "24px" }}>📖 How to Play Card Clash</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: "4px 0 0" }}>The complete guide to TKDL's exclusive card game</p>
            </div>
            {([
              {
                heading: "What is Card Clash?",
                icon: "🃏",
                body: "Card Clash is TKDL's exclusive meta-game built on top of your darts matches. Collect 100 unique cards, equip them before a match, and use their effects to gain tactical advantages — or mess with your opponent.",
              },
              {
                heading: "Earning Coins",
                icon: "🪙",
                body: "Coins are the Card Clash currency. You earn them by:\n• Logging in daily (streak bonuses grow over time)\n• Completing achievements\n• Selling duplicate cards in the Shop\n• Winning Card Clash matches",
              },
              {
                heading: "Buying & Opening Packs",
                icon: "📦",
                body: "Three packs are available in the Shop:\n• Arrow Pack (🎯) — 50 coins, 1 card\n• League Night Pack (🏹) — 200 coins, 5 cards\n• Kilbirnie Elite (⚡) — 350 coins, 10 cards\n\nDrop rates: 75% Common · 20% Rare · 5% Legendary\nPity system: guaranteed Legendary after 50 pulls with no Legendary.",
              },
              {
                heading: "Card Rarities",
                icon: "✨",
                body: "Cards come in three rarities:\n• Common — grey border, widely available, solid effects\n• Rare — purple border, stronger or more niche effects\n• Legendary — gold border, the most powerful effects in the game",
              },
              {
                heading: "Card Categories",
                icon: "🎯",
                body: "Each card belongs to a game mode and effect type:\n• X01 Good / X01 Bad — effects that help or hinder in X01 (501, 301)\n• Cricket Good / Cricket Bad — effects for Cricket matches\n• Wildcard Good / Wildcard Bad — work in any game mode\n\n'Good' cards benefit you; 'Bad' cards curse your opponent.",
              },
              {
                heading: "Equipping Cards",
                icon: "⚡",
                body: "Before a darts match, go to the Play tab and select the players. You can optionally equip up to 4 cards each. Cards are optional — you can always play without them.\n\nCards are applied during the match and their effects resolve automatically.",
              },
              {
                heading: "Achievements",
                icon: "🎖️",
                body: "Complete in-game milestones to earn coin bonuses and free packs:\n• Play your first match → 50 coins\n• Collect 25 unique cards → 200 coins + free Arrow Pack\n• Win 10 matches → 300 coins + free Arrow Pack\n• And many more — check the Achievements tab!\n\nAchievement packs are stored in the Shop under 'Your Achievement Packs' and can be opened any time.",
              },
              {
                heading: "Daily Login Streak",
                icon: "🔥",
                body: "Log in every day to grow your streak and earn increasing coin rewards. Consecutive days give bigger bonuses — hit 7 days for 200 coins and a free Arrow Pack, 30 days for 1000 coins and a League Night Pack.",
              },
              {
                heading: "Selling Duplicates",
                icon: "♻️",
                body: "Got multiples of the same card? Sell spares in the Shop:\n• Common duplicate → 10 coins\n• Rare duplicate → 30 coins\n• Legendary duplicate → 100 coins\n\nThis keeps your collection tidy and funds new packs.",
              },
            ] as { heading: string; icon: string; body: string }[]).map(section => (
              <div key={section.heading} style={{ marginBottom: "1.5rem", padding: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" }}>
                <h3 style={{ margin: "0 0 10px", fontSize: "15px", fontWeight: 800, color: "#ffd24a" }}>{section.icon} {section.heading}</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.8, whiteSpace: "pre-line" }}>{section.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── MOCK GAME ── */}
        {activeTab === "mock" && (
          <CardClashMockGame
            playerId={playerId}
            playerName={(currentPlayer as any)?.name || (currentPlayer as any)?.playerName || "Player"}
            onDone={() => { setActiveTab("collection"); loadData(); }}
          />
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
