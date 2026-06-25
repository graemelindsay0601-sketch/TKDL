import React, { useState, useEffect } from "react";

  interface Card {
    id: string;
    name: string;
    cardType: "GOOD" | "BAD";
    rarity: "COMMON" | "RARE" | "LEGENDARY";
    effect: string;
    quantity: number;
    gameMode: string;
  }

  interface CardEquipmentSelectorProps {
    currentPlayerId: number;
    currentPlayerName?: string;
    opponentId?: number;
    opponentName?: string;
    gameMode: "X01" | "CRICKET";
    onConfirm: (p1Cards: any[], p2Cards: any[]) => void;
    onBack: () => void;
    submitError?: string | null;
    playerId?: number;
    onSelect?: (equipment: any) => void;
    onCancel?: () => void;
  }

  const RAR_COLOR: Record<string, { border: string; glow: string; label: string; bg: string; text: string }> = {
    COMMON:    { border: "#9ca3af", glow: "rgba(156,163,175,0.25)", label: "#d1d5db", bg: "rgba(156,163,175,0.06)", text: "#e5e7eb" },
    RARE:      { border: "#818cf8", glow: "rgba(129,140,248,0.35)", label: "#a5b4fc", bg: "rgba(99,102,241,0.10)", text: "#c7d2fe" },
    LEGENDARY: { border: "#fbbf24", glow: "rgba(251,191,36,0.45)",  label: "#fde68a", bg: "rgba(217,119,6,0.12)",  text: "#fef3c7" },
  };

  function MiniCard({ card, selected, disabled, onClick }: { card: Card; selected: boolean; disabled: boolean; onClick: () => void }) {
    const rc  = RAR_COLOR[card.rarity] ?? RAR_COLOR.COMMON;
    const isG = card.cardType === "GOOD";
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          all: "unset", display: "flex", gap: "12px", alignItems: "flex-start",
          padding: "12px 14px", borderRadius: "10px", cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.18s", width: "100%", boxSizing: "border-box",
          background: selected ? (isG ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)") : rc.bg,
          border: `1.5px solid ${selected ? (isG ? "#22c55e" : "#ef4444") : rc.border + "60"}`,
          boxShadow: selected ? `0 0 16px ${isG ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` : "none",
          opacity: disabled ? 0.38 : 1,
        }}
      >
        {/* Rarity pip */}
        <div style={{ flexShrink: 0, width: "38px", height: "38px", borderRadius: "8px", background: rc.bg, border: `1px solid ${rc.border}55`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px" }}>
          <div style={{ fontSize: "16px" }}>{isG ? "⚡" : "💀"}</div>
          <div style={{ fontSize: "7px", fontWeight: 800, color: rc.label, letterSpacing: "0.06em", fontFamily: "Arial,sans-serif" }}>{card.rarity[0]}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "13px", color: "#fff", fontFamily: "Arial,sans-serif", marginBottom: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.name}</div>
          <div style={{ fontSize: "10px", color: rc.label, marginBottom: "5px", fontFamily: "Arial,sans-serif", letterSpacing: "0.04em" }}>{card.rarity} · ×{card.quantity}</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: 1.45, fontFamily: "Arial,sans-serif", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{card.effect}</div>
        </div>
        {selected && (
          <div style={{ flexShrink: 0, width: "20px", height: "20px", borderRadius: "50%", background: isG ? "#22c55e" : "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>✓</div>
        )}
      </button>
    );
  }

  export function CardEquipmentSelector({ currentPlayerId, gameMode, onConfirm, onBack, submitError }: CardEquipmentSelectorProps) {
    const playerId = currentPlayerId;
    const [inventory, setInventory] = useState<Card[]>([]);
    const [selectedGood, setSelectedGood] = useState<Card[]>([]);
    const [selectedBad, setSelectedBad]   = useState<Card[]>([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState<string | null>(null);

    useEffect(() => { if (playerId) loadInventory(); }, [playerId]);

    const loadInventory = async () => {
      try {
        setLoading(true); setError(null);
        const r = await fetch(`/api/card-clash/inventory/${playerId}`);
        if (!r.ok) throw new Error("Failed to load inventory");
        const data = await r.json();
        const raw: any[] = Array.isArray(data) ? data : (data.cards ?? []);
        setInventory(raw.map((c: any) => ({
          id: String(c.cardId ?? c.id ?? ""),
          name: c.cardName ?? c.name ?? "",
          cardType: c.cardType ?? "GOOD",
          rarity: (c.rarity ?? "COMMON").toUpperCase() as "COMMON" | "RARE" | "LEGENDARY",
          effect: c.effect ?? "",
          quantity: c.quantity ?? 1,
          gameMode: c.gameMode ?? c.game_mode ?? "WILDCARD",
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cards");
      } finally { setLoading(false); }
    };

    const goodCards = inventory.filter(c => c.cardType === "GOOD" && (c.gameMode === gameMode || c.gameMode === "WILDCARD") && c.quantity > 0);
    const badCards  = inventory.filter(c => c.cardType === "BAD"  && (c.gameMode === gameMode || c.gameMode === "WILDCARD") && c.quantity > 0);

    const toggleGood = (c: Card) => {
      if (selectedGood.find(x => x.id === c.id)) setSelectedGood(selectedGood.filter(x => x.id !== c.id));
      else if (selectedGood.length < 2) setSelectedGood([...selectedGood, c]);
    };
    const toggleBad = (c: Card) => {
      if (selectedBad.find(x => x.id === c.id)) setSelectedBad(selectedBad.filter(x => x.id !== c.id));
      else if (selectedBad.length < 2) setSelectedBad([...selectedBad, c]);
    };

    const totalSelected = selectedGood.length + selectedBad.length;

    const overlay = { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" };

    if (loading) return (
      <div style={overlay}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", border: "3px solid transparent", borderTopColor: "#ffd24a", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 16px" }} />
          <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
          <p style={{ color: "rgba(255,255,255,0.45)", fontFamily: "Arial,sans-serif" }}>Loading your cards…</p>
        </div>
      </div>
    );

    if (error) return (
      <div style={overlay}>
        <div style={{ background: "#0d1625", border: "1px solid rgba(255,60,60,0.4)", borderRadius: "14px", padding: "28px", maxWidth: "360px", textAlign: "center" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚠️</div>
          <p style={{ color: "#ff6b6b", marginBottom: "18px", fontFamily: "Arial,sans-serif" }}>{error}</p>
          <button onClick={onBack} style={{ padding: "10px 24px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "8px", color: "#fff", cursor: "pointer" }}>Back</button>
        </div>
      </div>
    );

    return (
      <div style={overlay}>
        <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
        <div style={{ background: "#080f1e", border: "1px solid rgba(255,210,74,0.22)", borderRadius: "16px", width: "100%", maxWidth: "660px", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 0 60px rgba(0,0,0,0.8), 0 0 120px rgba(255,210,74,0.06)" }}>

          {/* Header */}
          <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
              <span style={{ fontSize: "22px" }}>✨</span>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: "#ffd24a", letterSpacing: "0.06em", fontFamily: "'Arial Black',Arial,sans-serif" }}>{currentPlayerName}'S CARDS — {gameMode}</h2>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.32)", fontFamily: "Arial,sans-serif" }}>Bring up to 2 Good + 2 Bad cards to the match. Then it's {opponentName}'s turn.</p>
            {submitError && <div style={{ marginTop: "10px", padding: "8px 14px", background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.28)", borderRadius: "7px", color: "#ff6b6b", fontSize: "12px", fontFamily: "Arial,sans-serif" }}>⚠️ {submitError}</div>}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>

            {/* GOOD cards */}
            <div style={{ marginBottom: "22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{ fontSize: "20px" }}>⚡</span>
                <span style={{ fontWeight: 900, fontSize: "14px", color: "#22c55e", letterSpacing: "0.08em", fontFamily: "'Arial Black',Arial,sans-serif" }}>GOOD CARDS ({selectedGood.length}/2)</span>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontFamily: "Arial,sans-serif" }}>Boost YOU on your turn</span>
              </div>
              {goodCards.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "10px", color: "rgba(255,255,255,0.25)", fontSize: "13px", fontFamily: "Arial,sans-serif" }}>
                  No {gameMode} Good cards in your collection — head to the Shop!
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {goodCards.map(c => (
                    <MiniCard key={c.id} card={c} selected={!!selectedGood.find(x => x.id === c.id)} disabled={selectedGood.length === 2 && !selectedGood.find(x => x.id === c.id)} onClick={() => toggleGood(c)} />
                  ))}
                </div>
              )}
            </div>

            {/* BAD cards */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{ fontSize: "20px" }}>💀</span>
                <span style={{ fontWeight: 900, fontSize: "14px", color: "#ef4444", letterSpacing: "0.08em", fontFamily: "'Arial Black',Arial,sans-serif" }}>BAD CARDS ({selectedBad.length}/2)</span>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontFamily: "Arial,sans-serif" }}>Curse OPPONENT on their turn</span>
              </div>
              {badCards.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "10px", color: "rgba(255,255,255,0.25)", fontSize: "13px", fontFamily: "Arial,sans-serif" }}>
                  No {gameMode} Bad cards in your collection — head to the Shop!
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {badCards.map(c => (
                    <MiniCard key={c.id} card={c} selected={!!selectedBad.find(x => x.id === c.id)} disabled={selectedBad.length === 2 && !selectedBad.find(x => x.id === c.id)} onClick={() => toggleBad(c)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: "10px", justifyContent: "flex-end", flexShrink: 0, background: "rgba(0,0,0,0.2)", position: "sticky", bottom: 0, zIndex: 10 }}>
            <button onClick={onBack} style={{ padding: "11px 22px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "9px", color: "rgba(255,255,255,0.55)", fontWeight: 700, fontSize: "13px", cursor: "pointer", fontFamily: "Arial,sans-serif" }}>← Back</button>
            <button
              onClick={() => onConfirm([...selectedGood, ...selectedBad], [])}
              style={{ padding: "11px 28px", background: "linear-gradient(135deg,#ffd24a,#ff9500)", border: "none", borderRadius: "9px", color: "#000", fontWeight: 900, fontSize: "13px", cursor: "pointer", letterSpacing: "0.07em", fontFamily: "'Arial Black',Arial,sans-serif", boxShadow: "0 4px 20px rgba(255,210,74,0.35)", whiteSpace: "nowrap" }}
            >
              {totalSelected > 0 ? `⚡ PLAY (${totalSelected})` : "⚡ PLAY"}
            </button>
          </div>
        </div>
      </div>
    );
  }
  