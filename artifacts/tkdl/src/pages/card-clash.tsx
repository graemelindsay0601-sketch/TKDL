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

type Tab = "collection" | "shop" | "play" | "practice" | "standings" | "achievements" | "rules";

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
];

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
  const [openingPack, setOpeningPack] = useState<number | null>(null);
  const [openedCards, setOpenedCards] = useState<any[] | null>(null);
  const [dupCards, setDupCards] = useState<any[]>([]);
  const [sellingCard, setSellingCard] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "ALL">("ALL");
  const [rarFilter, setRarFilter] = useState<Rarity | "ALL">("ALL");
  const [showOwned, setShowOwned] = useState<"all" | "owned" | "unowned">("all");
  const [enlargedCard, setEnlargedCard] = useState<CardData | null>(null);

  useEffect(() => {
    if (!playerId) return;
    const key = `tkdl_new_cards_${playerId}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const stored: Record<string, number> = JSON.parse(raw);
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const fresh = new Set(Object.entries(stored).filter(([, ts]) => ts > cutoff).map(([name]) => name));
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#03050d" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "1rem" }}>🎴</div>
          <div style={{ color: "rgba(255,255,255,0.45)", marginBottom: "1.5rem", fontFamily: "Arial, sans-serif" }}>Please log in to access Card Clash</div>
          <button
            onClick={() => (window.location.href = "/login")}
            style={{ padding: "12px 28px", background: "linear-gradient(135deg,#ffd24a,#ff8c00)", border: "none", borderRadius: "6px", color: "#000", fontSize: "13px", fontWeight: 800, letterSpacing: "0.1em", cursor: "pointer" }}
          >
            Go to Login
          </button>
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
  const playerName = (currentPlayer as any)?.name || (currentPlayer as any)?.playerName || "Player";

  return (
    <div style={{ minHeight: "100vh", background: "#03050d", color: "#fff", fontFamily: "Arial, sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "2rem 2rem 0" }}>

          {/* Title row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,210,74,0.08)", border: "1px solid rgba(255,210,74,0.22)", borderRadius: "20px", padding: "4px 12px", marginBottom: "10px" }}>
                <span style={{ color: "#ffd24a", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", fontFamily: "'Arial Black', Arial, sans-serif" }}>⚡ TKDL EXCLUSIVE</span>
              </div>
              <h1 style={{ margin: 0, fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "0.06em", lineHeight: 1.05, fontFamily: "'Arial Black', Impact, Arial, sans-serif", textTransform: "uppercase" }}>
                <span style={{ background: "linear-gradient(135deg,#fff 0%,#c8e8ff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Card </span>
                <span style={{ background: "linear-gradient(135deg,#ffd24a,#ff9500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Clash</span>
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                100 cards · Real dart matches · Mid-game chaos
              </p>
            </div>
            <div style={{ paddingTop: "4px" }}>
              <CoinBalance playerId={playerId} />
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "1.5rem" }}>
            {[
              { label: "CARDS",    value: `${totalOwned} / ${ALL_CARDS.length}`, color: "#00e5ff" },
              { label: "WINS",     value: stats?.wins ?? "—",                    color: "#00ff88" },
              { label: "WIN RATE", value: stats ? `${winRate}%` : "—",           color: "#c084fc" },
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "8px 16px" }}>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.14em", marginBottom: "3px" }}>{s.label}</div>
                <div style={{ fontSize: "17px", fontWeight: 900, color: s.color, fontFamily: "'Arial Black', Arial, sans-serif", lineHeight: 1 }}>{String(s.value)}</div>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "8px 16px", flex: 1, minWidth: "180px", maxWidth: "260px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.14em", marginBottom: "6px" }}>COLLECTION</div>
                <div style={{ height: "3px", background: "rgba(255,255,255,0.07)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${completionPct}%`, background: "linear-gradient(90deg,#00e5ff,#ffd24a)", borderRadius: "2px", transition: "width 0.5s" }} />
                </div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "5px" }}>{completionPct}% complete</div>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", overflowX: "auto" }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: "10px 18px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 700,
                letterSpacing: "0.09em", background: "transparent", whiteSpace: "nowrap", transition: "color 0.15s",
                textTransform: "uppercase", fontFamily: "'Arial Black', Arial, sans-serif",
                color: activeTab === tab.id ? "#ffd24a" : "rgba(255,255,255,0.28)",
                borderBottom: activeTab === tab.id ? "2px solid #ffd24a" : "2px solid transparent",
                marginBottom: "-1px",
                position: "relative",
              }}>
                {tab.icon} {tab.label}
                {tab.id === "shop" && packInventory.length > 0 && (
                  <span style={{ marginLeft: "5px", background: "#ffd24a", color: "#000", fontSize: "9px", fontWeight: 900, padding: "1px 5px", borderRadius: "8px", verticalAlign: "middle" }}>{packInventory.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "2rem 2rem 5rem" }}>

        {/* ── COLLECTION ── */}
        {activeTab === "collection" && (
          <div>
            {/* Filter bar */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "1.5rem", alignItems: "center" }}>
              <input
                type="text" placeholder="Search cards…" value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "7px 13px", color: "#fff", fontSize: "13px", outline: "none", minWidth: "140px" }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                <Chip label="ALL" active={catFilter === "ALL"} color="#fff" onClick={() => setCatFilter("ALL")} />
                {CATEGORIES.map(cat => <Chip key={cat} label={cat} active={catFilter === cat} color={CAT_COLOR[cat]} onClick={() => setCatFilter(cat === catFilter ? "ALL" : cat)} />)}
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                <Chip label="ALL" active={rarFilter === "ALL"} color="#fff" onClick={() => setRarFilter("ALL")} />
                {RARITIES.map(r => <Chip key={r} label={r} active={rarFilter === r} color={RAR_COLOR[r]} onClick={() => setRarFilter(r === rarFilter ? "ALL" : r)} />)}
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                {(["all", "owned", "unowned"] as const).map(v => (
                  <button key={v} onClick={() => setShowOwned(v)} style={{ padding: "4px 11px", borderRadius: "5px", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontSize: "11px", fontWeight: 600, background: showOwned === v ? "rgba(255,255,255,0.09)" : "transparent", color: showOwned === v ? "#fff" : "rgba(255,255,255,0.32)" }}>
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
                      onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04) translateY(-3px)")}
                      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      <TKDLCard card={card} size="sm" locked={!owned} />
                      {newCardNames.has(card.name) && (
                        <div style={{ position: "absolute", top: "5px", right: "5px", background: "linear-gradient(135deg,#ff3b3b,#ff6b00)", color: "#fff", fontSize: "9px", fontWeight: 900, padding: "2px 6px", borderRadius: "8px", letterSpacing: "0.06em", boxShadow: "0 2px 8px rgba(255,60,60,0.5)", zIndex: 5 }}>NEW</div>
                      )}
                    </div>
                  );
                })}
                {filteredCards.length === 0 && (
                  <div style={{ width: "100%", textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.25)" }}>
                    <div style={{ fontSize: "40px", marginBottom: "1rem" }}>🃏</div>
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
            <SectionHeader title="Card Shop" subtitle="Build your arsenal — collect all 100 cards" />

            {/* Achievement packs */}
            {packInventory.length > 0 && (
              <div style={{ marginBottom: "2rem", padding: "18px 20px", background: "rgba(255,210,74,0.04)", border: "1px solid rgba(255,210,74,0.18)", borderRadius: "12px" }}>
                <PanelTitle color="#ffd24a">🎁 Achievement Packs</PanelTitle>
                <p style={{ margin: "0 0 14px", fontSize: "12px", color: "rgba(255,255,255,0.38)" }}>Earned from achievements — open them for free!</p>

                {openedCards && (
                  <div style={{ marginBottom: "14px", padding: "12px 14px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.16)", borderRadius: "8px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#00ff88", marginBottom: "8px" }}>✨ Cards received!</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                      {openedCards.map((c: any, i: number) => {
                        const rc = c.rarity === "LEGENDARY" ? "#ffd24a" : c.rarity === "RARE" ? "#c084fc" : "rgba(255,255,255,0.4)";
                        return <span key={i} style={{ padding: "3px 10px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${rc}45`, fontSize: "12px", color: rc }}>{c.name} · {c.rarity}</span>;
                      })}
                    </div>
                    <button onClick={() => setOpenedCards(null)} style={{ marginTop: "8px", fontSize: "11px", color: "rgba(255,255,255,0.28)", background: "none", border: "none", cursor: "pointer" }}>Dismiss</button>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {packInventory.map((pk: any) => (
                    <div key={pk.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "13px" }}>{pk.packName}</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", marginTop: "2px" }}>{pk.earned_reason?.replace("ACHIEVEMENT:", "From achievement: ") ?? "Achievement reward"}</div>
                      </div>
                      <button
                        disabled={openingPack === pk.id}
                        onClick={async () => {
                          setOpeningPack(pk.id); setOpenedCards(null);
                          try {
                            const r = await fetch(`/api/card-clash/pack-inventory/${pk.id}/open`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId }) });
                            const data = await r.json();
                            if (data.cards) { setOpenedCards(data.cards); loadData(); }
                          } finally { setOpeningPack(null); }
                        }}
                        style={{ padding: "7px 16px", background: openingPack === pk.id ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#ffd24a,#ff9500)", border: "none", borderRadius: "6px", color: openingPack === pk.id ? "rgba(255,255,255,0.28)" : "#000", fontWeight: 800, fontSize: "12px", cursor: openingPack === pk.id ? "not-allowed" : "pointer", letterSpacing: "0.04em" }}
                      >
                        {openingPack === pk.id ? "Opening…" : "Open Pack"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <CardShopUI playerId={playerId} onCardsReceived={handleCardsReceived} />

            {/* Sell duplicates */}
            {dupCards.length > 0 && (
              <div style={{ marginTop: "2rem", padding: "18px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px" }}>
                <PanelTitle>♻️ Sell Duplicates</PanelTitle>
                <p style={{ margin: "0 0 14px", fontSize: "12px", color: "rgba(255,255,255,0.32)" }}>Common: 10🪙 · Rare: 30🪙 · Legendary: 100🪙</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: "8px" }}>
                  {dupCards.map((c: any) => {
                    const rar = (c.rarity ?? "COMMON").toUpperCase();
                    const prices: Record<string, number> = { COMMON: 10, RARE: 30, LEGENDARY: 100 };
                    const price = prices[rar] ?? 10;
                    const rc = rar === "LEGENDARY" ? "#ffd24a" : rar === "RARE" ? "#c084fc" : "rgba(255,255,255,0.4)";
                    const cid = c.cardId ?? c.card_id ?? c.id;
                    return (
                      <div key={cid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: `1px solid ${rc}22`, borderRadius: "8px" }}>
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
                          style={{ padding: "5px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "6px", color: sellingCard === cid ? "rgba(255,255,255,0.2)" : "#ffd24a", fontWeight: 700, fontSize: "11px", cursor: sellingCard === cid ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                        >
                          {sellingCard === cid ? "…" : `+${price}🪙`}
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
            <SectionHeader title="⚡ Enter the Clash" subtitle="Select an opponent, optionally equip cards, and play" />
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
          <div>
            <SectionHeader title="🎲 Practice Mode" subtitle="No coins spent, no cards consumed — test your strategies risk-free" />
            <CardClashMockGame
              playerId={playerId}
              playerName={playerName}
              onDone={() => setActiveTab("collection")}
            />
          </div>
        )}

        {/* ── STANDINGS ── */}
        {activeTab === "standings" && (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "1.5rem" }}>
              <SectionHeader title="🏆 Standings" subtitle="Ranked by total wins across all Card Clash matches" noMargin />
              <button onClick={loadData} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "6px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>↻ Refresh</button>
            </div>

            {standings.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["#", "Player", "W", "L", "Played", "Pts"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: h === "Player" || h === "#" ? "left" : "center", color: "rgba(255,255,255,0.3)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.12em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, idx) => {
                      const isMe = row.player_id === playerId;
                      return (
                        <tr key={row.player_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: isMe ? "rgba(0,180,255,0.05)" : "transparent" }}>
                          <td style={{ padding: "13px 16px", color: idx === 0 ? "#ffd24a" : "rgba(255,255,255,0.3)", fontWeight: 800, fontSize: "15px" }}>
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                          </td>
                          <td style={{ padding: "13px 16px", fontWeight: isMe ? 700 : 400, color: isMe ? "#00b4ff" : "#fff" }}>
                            {row.player_name}{isMe && <span style={{ fontSize: "10px", color: "rgba(0,180,255,0.45)", marginLeft: "6px" }}>(you)</span>}
                          </td>
                          <td style={{ padding: "13px 16px", textAlign: "center", color: "#00ff88", fontWeight: 700 }}>{row.wins}</td>
                          <td style={{ padding: "13px 16px", textAlign: "center", color: "#ff6b6b" }}>{row.losses}</td>
                          <td style={{ padding: "13px 16px", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>{row.total_matches}</td>
                          <td style={{ padding: "13px 16px", textAlign: "center", color: "#00e5ff", fontWeight: 700 }}>{row.points ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.25)" }}>
                <div style={{ fontSize: "40px", marginBottom: "1rem" }}>🏆</div>
                <div>No matches yet — play some Card Clash games to appear here!</div>
              </div>
            )}
          </div>
        )}

        {/* ── ACHIEVEMENTS ── */}
        {activeTab === "achievements" && (
          <div>
            <SectionHeader title="🎖️ Achievements" subtitle="Earn coins and bonus packs by completing challenges" />

            {achievements?.stats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: "10px", marginBottom: "2rem" }}>
                {[
                  { label: "Matches Played", value: achievements.stats.matchesPlayed,    icon: "🃏" },
                  { label: "Matches Won",    value: achievements.stats.matchesWon,        icon: "⚡" },
                  { label: "Cards Owned",    value: achievements.stats.cardsOwned,        icon: "🎴" },
                  { label: "Packs Opened",   value: achievements.stats.packsOpened,       icon: "📦" },
                  { label: "Login Streak",   value: `${achievements.stats.loginStreak}d`, icon: "🔥" },
                ].map(s => (
                  <div key={s.label} style={{ padding: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "20px", marginBottom: "6px" }}>{s.icon}</div>
                    <div style={{ fontSize: "20px", fontWeight: 900, color: "#fff", fontFamily: "'Arial Black', Arial, sans-serif" }}>{s.value}</div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.28)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {achievements?.achievements ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "10px" }}>
                {achievements.achievements.map((a: any) => {
                  const rarColors: Record<string, string> = { Common: "#9ca3af", Rare: "#c084fc", Epic: "#818cf8", Legendary: "#ffd24a" };
                  const rc = rarColors[a.rarity] ?? "#9ca3af";
                  return (
                    <div key={a.key} style={{ padding: "14px 16px", background: a.earned ? "rgba(0,255,136,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${a.earned ? rc + "38" : "rgba(255,255,255,0.06)"}`, borderRadius: "10px", opacity: a.earned ? 1 : 0.62 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ fontSize: "26px", lineHeight: 1, filter: a.earned ? "none" : "grayscale(1)", flexShrink: 0 }}>{a.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                            <span style={{ fontWeight: 700, fontSize: "13px", color: a.earned ? "#fff" : "rgba(255,255,255,0.42)" }}>{a.name}</span>
                            <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 7px", borderRadius: "8px", background: rc + "18", color: rc, letterSpacing: "0.07em" }}>{a.rarity.toUpperCase()}</span>
                            {a.earned && <span style={{ fontSize: "10px", color: "#00ff88" }}>✓</span>}
                          </div>
                          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.36)", marginBottom: "8px", lineHeight: 1.5 }}>{a.description}</div>
                          {!a.earned && (
                            <div style={{ marginBottom: "8px" }}>
                              <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min(100, (a.progress / a.statValue) * 100)}%`, background: rc, borderRadius: "2px" }} />
                              </div>
                              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.26)", marginTop: "3px" }}>{Math.min(a.progress, a.statValue)} / {a.statValue}</div>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "11px", color: "#ffd24a" }}>🪙 {a.coinReward}</span>
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
                <div style={{ fontSize: "36px", marginBottom: "1rem" }}>🎖️</div>
                <div>Loading achievements…</div>
              </div>
            )}
          </div>
        )}

        {/* ── RULES ── */}
        {activeTab === "rules" && (
          <div>
            <SectionHeader title="📖 How to Play" subtitle="The complete guide to TKDL Card Clash" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "10px" }}>
              {([
                { icon: "🃏", heading: "What is Card Clash?",  body: "TKDL's exclusive meta-game built on top of your darts matches. Collect 100 unique cards, equip them before a match, and trigger tactical effects during play." },
                { icon: "🪙", heading: "Earning Coins",        body: "Log in daily (streak bonuses grow), complete achievements, sell duplicate cards, and win Card Clash matches." },
                { icon: "📦", heading: "Packs & Drop Rates",   body: "Arrow Pack — 50 coins, 1 card\nLeague Night Pack — 200 coins, 5 cards\nKilbirnie Elite — 350 coins, 10 cards\n\n75% Common · 20% Rare · 5% Legendary\nGuaranteed Legendary after 50 pulls." },
                { icon: "✨", heading: "Card Rarities",        body: "Common — solid reliable effects\nRare — stronger or niche effects\nLegendary — the most powerful cards in the game" },
                { icon: "🎯", heading: "Card Categories",      body: "X01, Cricket, or Wildcard cards — each works in its matching game mode. Wildcards work in any mode.\n\nGood cards benefit you. Bad cards curse your opponent." },
                { icon: "⚡", heading: "Equipping Cards",      body: "In the Play tab, pick your opponent and game mode, then optionally equip up to 4 cards. Cards are never required." },
                { icon: "🎖️", heading: "Achievements",         body: "Complete milestones to earn coins and free packs. Earned packs appear in the Shop and can be opened any time." },
                { icon: "🔥", heading: "Login Streak",         body: "Log in daily to grow your streak.\n7 days = 200 coins + Arrow Pack\n30 days = 1000 coins + League Night Pack" },
                { icon: "♻️", heading: "Selling Duplicates",  body: "Common → 10 coins\nRare → 30 coins\nLegendary → 100 coins\n\nSell from the Shop tab." },
              ] as { icon: string; heading: string; body: string }[]).map(s => (
                <div key={s.heading} style={{ padding: "16px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px" }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 800, color: "#ffd24a", fontFamily: "'Arial Black', Arial, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.icon} {s.heading}</h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.75, whiteSpace: "pre-line" }}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── CARD ENLARGE MODAL ── */}
      {enlargedCard && (
        <div
          onClick={() => setEnlargedCard(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}
        >
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
            <div style={{ display: "flex", gap: "32px", alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
              <TKDLCard card={enlargedCard} size="lg" locked={!ownedNames.has(enlargedCard.name)} />
              <div style={{ maxWidth: "280px", paddingTop: "8px" }}>
                <div style={{ marginBottom: "6px" }}>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em" }}>CLICK CARD TO FLIP</span>
                </div>
                <h2 style={{ fontSize: "20px", fontWeight: 900, color: "#fff", margin: "0 0 10px", fontFamily: "'Arial Black', sans-serif" }}>{enlargedCard.name}</h2>
                <div style={{ display: "flex", gap: "7px", marginBottom: "16px", flexWrap: "wrap" }}>
                  <Badge color={CAT_COLOR[enlargedCard.category]}>{enlargedCard.category}</Badge>
                  <Badge color={RAR_COLOR[enlargedCard.rarity]}>{enlargedCard.rarity}</Badge>
                  {ownedNames.has(enlargedCard.name)
                    ? <Badge color="#00ff88">✓ OWNED</Badge>
                    : <Badge color="rgba(255,255,255,0.28)">NOT OWNED</Badge>}
                </div>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.78)", lineHeight: 1.65, margin: "0 0 12px" }}>{enlargedCard.effect}</p>
                {enlargedCard.flavourText && (
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontStyle: "italic", lineHeight: 1.5, margin: 0, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "10px" }}>"{enlargedCard.flavourText}"</p>
                )}
                {!ownedNames.has(enlargedCard.name) && (
                  <button onClick={() => { setEnlargedCard(null); setActiveTab("shop"); }} style={{ marginTop: "16px", padding: "10px 22px", background: "rgba(255,210,74,0.1)", border: "1px solid rgba(255,210,74,0.32)", borderRadius: "8px", color: "#ffd24a", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                    🛍️ Buy in Shop
                  </button>
                )}
              </div>
            </div>
            <button onClick={() => setEnlargedCard(null)} style={{ padding: "8px 22px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: "13px" }}>
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared UI helpers ──────────────────────────────────────────────────────────

function Chip({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 11px", borderRadius: "14px", cursor: "pointer", fontSize: "11px", fontWeight: 700,
      letterSpacing: "0.04em", transition: "all 0.15s", border: "1px solid", whiteSpace: "nowrap",
      background: active ? `${color}18` : "transparent",
      color: active ? color : "rgba(255,255,255,0.28)",
      borderColor: active ? `${color}50` : "rgba(255,255,255,0.08)",
    }}>
      {label}
    </button>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 9px", borderRadius: "14px", background: `${color}18`, color, border: `1px solid ${color}38`, letterSpacing: "0.04em" }}>
      {children}
    </span>
  );
}

function PanelTitle({ children, color, style }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: "11px", fontWeight: 800, color: color ?? "rgba(255,255,255,0.65)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Arial Black', Arial, sans-serif", marginBottom: "6px", ...style }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, noMargin }: { title: string; subtitle?: string; noMargin?: boolean }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : "1.75rem" }}>
      <h2 style={{ margin: "0 0 5px", fontSize: "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.04em", fontFamily: "'Arial Black', Impact, Arial, sans-serif" }}>{title}</h2>
      {subtitle && <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>{subtitle}</p>}
    </div>
  );
}
