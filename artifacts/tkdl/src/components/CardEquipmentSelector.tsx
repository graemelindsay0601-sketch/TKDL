import React, { useState, useEffect } from "react";
import { ALL_CARDS } from "@/lib/cards-data";
import type { CardData } from "@/lib/cards-data";
import { TKDLCard } from "./TKDLCard";
import { useCardClashSettings } from "@/hooks/useCardClashSettings";
import { useEquipmentPreference } from "@/hooks/useEquipmentPreference";
import { useFavorites } from "@/hooks/useFavorites";

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
  onConfirm: (p1Cards: CardData[], p2Cards: CardData[]) => void;
  onBack: () => void;
  submitError?: string | null;
  playerId?: number;
  onSelect?: (equipment: any) => void;
  onCancel?: () => void;
}

function CardArtworkDisplay({ 
  card, 
  selected, 
  disabled, 
  onClick, 
  isFavorite, 
  onToggleFavorite,
  onPreview 
}: { 
  card: Card; 
  selected: boolean; 
  disabled: boolean; 
  onClick: () => void; 
  isFavorite: boolean; 
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onPreview: (e: React.MouseEvent) => void;
}) {
  const fullCard = ALL_CARDS.find(c => c.name === card.name);
  const isG = card.cardType === "GOOD";
  
  if (!fullCard) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        all: "unset",
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s",
        borderRadius: "12px",
        overflow: "hidden",
        border: selected ? `3px solid ${isG ? "#22c55e" : "#ef4444"}` : "2px solid rgba(255,255,255,0.1)",
        boxShadow: selected ? `0 0 20px ${isG ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}` : "0 0 8px rgba(0,0,0,0.5)",
      }}
    >
      {/* Card Artwork */}
      <div style={{ width: "100%", height: "100%", minHeight: typeof window !== 'undefined' && window.innerWidth < 768 ? "160px" : "280px" }}>
        <TKDLCard 
          card={fullCard}
          size="md"
          locked={disabled}
        />
      </div>

      {/* Overlay Controls */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: selected ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0)",
          transition: "background 0.2s",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "12px",
          pointerEvents: "none",
        }}
      >
        {/* Top: Favorite Button */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={(e) => onToggleFavorite(card.id, e)}
            style={{
              all: "unset",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "20px",
              borderRadius: "50%",
              background: isFavorite ? "rgba(255,82,82,0.3)" : "rgba(0,0,0,0.4)",
              border: `2px solid ${isFavorite ? "rgba(255,82,82,0.8)" : "rgba(255,255,255,0.2)"}`,
              transition: "all 0.2s",
              backdropFilter: "blur(8px)",
              pointerEvents: "auto",
              boxShadow: isFavorite ? "0 0 12px rgba(255,82,82,0.4)" : "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.15)";
              e.currentTarget.style.background = isFavorite ? "rgba(255,82,82,0.5)" : "rgba(0,0,0,0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = isFavorite ? "rgba(255,82,82,0.3)" : "rgba(0,0,0,0.4)";
            }}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorite ? "⭐" : "☆"}
          </button>
        </div>

        {/* Bottom: Preview Button */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={onPreview}
            style={{
              all: "unset",
              padding: "8px 16px",
              background: "rgba(0,100,255,0.4)",
              border: "1.5px solid rgba(0,180,255,0.6)",
              borderRadius: "6px",
              color: "#00d4ff",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              backdropFilter: "blur(8px)",
              pointerEvents: "auto",
              letterSpacing: "0.05em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,100,255,0.6)";
              e.currentTarget.style.boxShadow = "0 0 16px rgba(0,180,255,0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,100,255,0.4)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            👁 PREVIEW
          </button>
        </div>

        {/* Selection Checkmark */}
        {selected && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              left: "12px",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: isG ? "#22c55e" : "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: 900,
              color: "#fff",
              boxShadow: `0 0 16px ${isG ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)"}`,
            }}
          >
            ✓
          </div>
        )}
      </div>
    </button>
  );
}

export function CardEquipmentSelector({ currentPlayerId, currentPlayerName, opponentName, gameMode, onConfirm, onBack, submitError }: CardEquipmentSelectorProps) {
  const playerId = currentPlayerId;
  const [inventory, setInventory] = useState<Card[]>([]);
  const [selectedGood, setSelectedGood] = useState<Card[]>([]);
  const [selectedBad, setSelectedBad]   = useState<Card[]>([]);
  const [previewCard, setPreviewCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const { settings: gameSettings } = useCardClashSettings();
  const { preference, savePreference, loading: prefLoading } = useEquipmentPreference(playerId);
  const [showPreferenceEditor, setShowPreferenceEditor] = useState(false);
  const [tempGoodCount, setTempGoodCount] = useState(preference.goodCardsPerMatch);
  const [tempBadCount, setTempBadCount] = useState(preference.badCardsPerMatch);
  
  // Use new Card Clash favorites hook with server persistence
  const { 
    isFavorited, 
    toggleFavorite: toggleFavoritesHook,
    favorites,
    isLoading: favLoading,
    error: favError,
  } = useFavorites({ gameMode });

  useEffect(() => { if (playerId) loadInventory(); }, [playerId]);

  // Sync temp counts when preference loads
  useEffect(() => {
    setTempGoodCount(preference.goodCardsPerMatch);
    setTempBadCount(preference.badCardsPerMatch);
  }, [preference]);

  const loadInventory = async () => {
    try {
      setLoading(true); setError(null);
      const invRes = await fetch(`/api/card-clash/inventory/${playerId}`);
      
      if (!invRes.ok) throw new Error("Failed to load inventory");
      
      const data = await invRes.json();
      const raw: any[] = Array.isArray(data) ? data : (data.cards ?? []);
      
      setInventory(raw.map((c: any) => {
        const cardId = c.id ?? c.cardId ?? c.id;
        if (!cardId) {
          console.warn("Card missing id field", c);
        }
        return {
          id: String(cardId || ""),
          name: c.cardName ?? c.name ?? "",
          cardType: c.cardType ?? "GOOD",
          rarity: (c.rarity ?? "COMMON").toUpperCase() as "COMMON" | "RARE" | "LEGENDARY",
          effect: c.effect ?? "",
          quantity: c.quantity ?? 1,
          gameMode: c.gameMode ?? c.game_mode ?? "WILDCARD",
        };
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cards");
    } finally { setLoading(false); }
  };

  const goodCards = inventory
    .filter(c => c.cardType === "GOOD" && (c.gameMode === gameMode || c.gameMode === "WILDCARD") && c.quantity > 0)
    .sort((a, b) => {
      const aIsFav = isFavorited(a.id);
      const bIsFav = isFavorited(b.id);
      if (aIsFav !== bIsFav) return aIsFav ? -1 : 1;
      return 0;
    });
    
  // Split into favorites and non-favorites for visual grouping
  const goodFavorites = goodCards.filter(c => isFavorited(c.id));
  const goodNonFavorites = goodCards.filter(c => !isFavorited(c.id));
    
  const badCards = inventory
    .filter(c => c.cardType === "BAD"  && (c.gameMode === gameMode || c.gameMode === "WILDCARD") && c.quantity > 0)
    .sort((a, b) => {
      const aIsFav = isFavorited(a.id);
      const bIsFav = isFavorited(b.id);
      if (aIsFav !== bIsFav) return aIsFav ? -1 : 1;
      return 0;
    });

  // Split into favorites and non-favorites for visual grouping
  const badFavorites = badCards.filter(c => isFavorited(c.id));
  const badNonFavorites = badCards.filter(c => !isFavorited(c.id));

  // Wrapper for toggle favorite to integrate with click handler
  const toggleFavorite = async (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Find the card name for the API call
      const card = inventory.find(c => c.id === cardId);
      if (!card) {
        console.error("Card not found:", cardId);
        return;
      }
      
      // Use the hook's toggle function
      const success = await toggleFavoritesHook(cardId, card.name);
      if (!success) {
        console.error(`Failed to toggle favorite for card ${cardId}`);
      }
    } catch (err) {
      console.error("[toggleFavorite] Error:", err);
    }
  };

  const toggleGood = (c: Card) => {
    if (selectedGood.find(x => x.id === c.id)) setSelectedGood(selectedGood.filter(x => x.id !== c.id));
    else if (selectedGood.length < preference.goodCardsPerMatch) setSelectedGood([...selectedGood, c]);
  };
  const toggleBad = (c: Card) => {
    if (selectedBad.find(x => x.id === c.id)) setSelectedBad(selectedBad.filter(x => x.id !== c.id));
    else if (selectedBad.length < preference.badCardsPerMatch) setSelectedBad([...selectedBad, c]);
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

  const enrichCardsWithFullData = (cards: Card[]): CardData[] => {
    return cards.map(c => {
      const fullCard = ALL_CARDS.find(ac => ac.name === c.name);
      if (!fullCard) {
        console.warn(`Card not found in ALL_CARDS: ${c.name}`);
        return {
          id: parseInt(c.id) || 0,
          name: c.name,
          category: c.cardType === "GOOD" ? (c.gameMode === "X01" ? "X01 GOOD" : "CRICKET GOOD") : (c.gameMode === "X01" ? "X01 BAD" : "CRICKET BAD"),
          rarity: c.rarity,
          effect: c.effect,
          flavourText: "",
          energyCost: 1,
        } as CardData;
      }
      return fullCard;
    });
  };

  return (
    <div style={overlay}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{ background: "#080f1e", border: "1px solid rgba(255,210,74,0.22)", borderRadius: "16px", width: "100%", maxWidth: "660px", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 0 60px rgba(0,0,0,0.8), 0 0 120px rgba(255,210,74,0.06)", padding: "0" }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px" }}>✨</span>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: "#ffd24a", letterSpacing: "0.06em", fontFamily: "'Arial Black',Arial,sans-serif" }}>{currentPlayerName}'S CARDS — {gameMode}</h2>
            </div>
            <button
              onClick={() => setShowPreferenceEditor(!showPreferenceEditor)}
              style={{
                padding: "6px 12px",
                background: "rgba(255,210,74,0.1)",
                border: "1px solid rgba(255,210,74,0.3)",
                borderRadius: "6px",
                color: "#ffd24a",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,210,74,0.2)";
                e.currentTarget.style.borderColor = "rgba(255,210,74,0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,210,74,0.1)";
                e.currentTarget.style.borderColor = "rgba(255,210,74,0.3)";
              }}
            >
              ⚙️ {preference.goodCardsPerMatch}G/{preference.badCardsPerMatch}B
            </button>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.32)", fontFamily: "Arial,sans-serif" }}>Bring up to {preference.goodCardsPerMatch} Good + {preference.badCardsPerMatch} Bad cards to the match. Then it's {opponentName}'s turn.</p>
          {submitError && <div style={{ marginTop: "10px", padding: "8px 14px", background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.28)", borderRadius: "7px", color: "#ff6b6b", fontSize: "12px", fontFamily: "Arial,sans-serif" }}>⚠️ {submitError}</div>}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", minHeight: 0, paddingBottom: "80px" }}>
          <div style={{ marginBottom: "22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "20px" }}>⚡</span>
              <span style={{ fontWeight: 900, fontSize: "14px", color: "#22c55e", letterSpacing: "0.08em", fontFamily: "'Arial Black',Arial,sans-serif" }}>GOOD CARDS ({selectedGood.length}/{preference.goodCardsPerMatch})</span>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontFamily: "Arial,sans-serif" }}>Boost YOU on your turn</span>
            </div>
            {goodCards.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "10px", color: "rgba(255,255,255,0.25)", fontSize: "13px", fontFamily: "Arial,sans-serif" }}>
                No {gameMode} Good cards in your collection — head to the Shop!
              </div>
            ) : (
              <>
                {/* FAVORITES SECTION */}
                {goodFavorites.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", paddingLeft: "4px" }}>
                      <span style={{ fontSize: "16px" }}>⭐</span>
                      <span style={{ fontWeight: 700, fontSize: "12px", color: "#ffd24a", textTransform: "uppercase", letterSpacing: "0.05em" }}>FAVORITES ({goodFavorites.length})</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth < 768 ? "1fr" : "1fr 1fr", gap: typeof window !== 'undefined' && window.innerWidth < 768 ? "8px" : "12px" }}>
                      {goodFavorites.map(c => (
                        <CardArtworkDisplay 
                          key={c.id}
                          card={c} 
                          selected={!!selectedGood.find(x => x.id === c.id)} 
                          disabled={selectedGood.length === preference.goodCardsPerMatch && !selectedGood.find(x => x.id === c.id)} 
                          onClick={() => toggleGood(c)}
                          isFavorite={isFavorited(c.id)}
                          onToggleFavorite={toggleFavorite}
                          onPreview={(e) => {
                            e.stopPropagation();
                            setPreviewCard(c);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* ALL CARDS SECTION */}
                {goodNonFavorites.length > 0 && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", paddingLeft: "4px" }}>
                      <span style={{ fontWeight: 700, fontSize: "12px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em" }}>ALL CARDS ({goodNonFavorites.length})</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth < 768 ? "1fr" : "1fr 1fr", gap: typeof window !== 'undefined' && window.innerWidth < 768 ? "8px" : "12px" }}>
                      {goodNonFavorites.map(c => (
                        <CardArtworkDisplay 
                          key={c.id}
                          card={c} 
                          selected={!!selectedGood.find(x => x.id === c.id)} 
                          disabled={selectedGood.length === preference.goodCardsPerMatch && !selectedGood.find(x => x.id === c.id)} 
                          onClick={() => toggleGood(c)}
                          isFavorite={isFavorited(c.id)}
                          onToggleFavorite={toggleFavorite}
                          onPreview={(e) => {
                            e.stopPropagation();
                            setPreviewCard(c);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "20px" }}>💀</span>
              <span style={{ fontWeight: 900, fontSize: "14px", color: "#ef4444", letterSpacing: "0.08em", fontFamily: "'Arial Black',Arial,sans-serif" }}>BAD CARDS ({selectedBad.length}/{preference.badCardsPerMatch})</span>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontFamily: "Arial,sans-serif" }}>Curse OPPONENT on their turn</span>
            </div>
            {badCards.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "10px", color: "rgba(255,255,255,0.25)", fontSize: "13px", fontFamily: "Arial,sans-serif" }}>
                No {gameMode} Bad cards in your collection — head to the Shop!
              </div>
            ) : (
              <>
                {/* FAVORITES SECTION */}
                {badFavorites.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", paddingLeft: "4px" }}>
                      <span style={{ fontSize: "16px" }}>⭐</span>
                      <span style={{ fontWeight: 700, fontSize: "12px", color: "#ffd24a", textTransform: "uppercase", letterSpacing: "0.05em" }}>FAVORITES ({badFavorites.length})</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth < 768 ? "1fr" : "1fr 1fr", gap: typeof window !== 'undefined' && window.innerWidth < 768 ? "8px" : "12px" }}>
                      {badFavorites.map(c => (
                        <CardArtworkDisplay 
                          key={c.id}
                          card={c} 
                          selected={!!selectedBad.find(x => x.id === c.id)} 
                          disabled={selectedBad.length === preference.badCardsPerMatch && !selectedBad.find(x => x.id === c.id)} 
                          onClick={() => toggleBad(c)}
                          isFavorite={isFavorited(c.id)}
                          onToggleFavorite={toggleFavorite}
                          onPreview={(e) => {
                            e.stopPropagation();
                            setPreviewCard(c);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* ALL CARDS SECTION */}
                {badNonFavorites.length > 0 && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", paddingLeft: "4px" }}>
                      <span style={{ fontWeight: 700, fontSize: "12px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em" }}>ALL CARDS ({badNonFavorites.length})</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth < 768 ? "1fr" : "1fr 1fr", gap: typeof window !== 'undefined' && window.innerWidth < 768 ? "8px" : "12px" }}>
                      {badNonFavorites.map(c => (
                        <CardArtworkDisplay 
                          key={c.id}
                          card={c} 
                          selected={!!selectedBad.find(x => x.id === c.id)} 
                          disabled={selectedBad.length === preference.badCardsPerMatch && !selectedBad.find(x => x.id === c.id)} 
                          onClick={() => toggleBad(c)}
                          isFavorite={isFavorited(c.id)}
                          onToggleFavorite={toggleFavorite}
                          onPreview={(e) => {
                            e.stopPropagation();
                            setPreviewCard(c);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Equipment Preference Editor Modal */}
        {showPreferenceEditor && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}>
            <div style={{
              background: "#0f1925",
              border: "1px solid rgba(255,210,74,0.4)",
              borderRadius: "14px",
              padding: "28px",
              maxWidth: "400px",
              boxShadow: "0 0 40px rgba(255,210,74,0.1)",
            }}>
              <h3 style={{ margin: "0 0 24px", fontSize: "18px", fontWeight: 900, color: "#ffd24a", fontFamily: "'Arial Black',Arial,sans-serif" }}>⚙️ EQUIPMENT PREFERENCE</h3>
              
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", fontFamily: "Arial,sans-serif" }}>Good Cards Per Match</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      onClick={() => setTempGoodCount(num)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        background: tempGoodCount === num ? "#22c55e" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${tempGoodCount === num ? "#22c55e" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: "6px",
                        color: tempGoodCount === num ? "#000" : "#22c55e",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (tempGoodCount !== num) {
                          e.currentTarget.style.borderColor = "#22c55e";
                          e.currentTarget.style.background = "rgba(34,197,94,0.1)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (tempGoodCount !== num) {
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                        }
                      }}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", fontFamily: "Arial,sans-serif" }}>Bad Cards Per Match</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      onClick={() => setTempBadCount(num)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        background: tempBadCount === num ? "#ef4444" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${tempBadCount === num ? "#ef4444" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: "6px",
                        color: tempBadCount === num ? "#fff" : "#ef4444",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (tempBadCount !== num) {
                          e.currentTarget.style.borderColor = "#ef4444";
                          e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (tempBadCount !== num) {
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                        }
                      }}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => setShowPreferenceEditor(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    color: "rgba(255,255,255,0.65)",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    fontFamily: "Arial,sans-serif",
                    fontSize: "12px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const success = await savePreference(tempGoodCount, tempBadCount);
                    if (success) {
                      setShowPreferenceEditor(false);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "linear-gradient(135deg,#ffd24a,#ffb700)",
                    border: "none",
                    borderRadius: "8px",
                    color: "#000",
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    fontFamily: "'Arial Black',Arial,sans-serif",
                    fontSize: "12px",
                    letterSpacing: "0.05em",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 16px rgba(255,210,74,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  ✓ Save
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: "12px", justifyContent: "space-between", flexShrink: 0, background: "rgba(0,0,0,0.6)", position: "sticky", bottom: 0, zIndex: 50 }}>
          <button onClick={onBack} style={{ flex: 1, padding: "12px 20px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "rgba(255,255,255,0.65)", fontWeight: 700, fontSize: "13px", cursor: "pointer", fontFamily: "Arial,sans-serif", transition: "all 0.2s", whiteSpace: "nowrap" }}>← BACK</button>

          <button
            onClick={() => onConfirm(enrichCardsWithFullData([...selectedGood, ...selectedBad]), [])}
            disabled={totalSelected === 0}
            style={{ flex: 1, padding: "12px 20px", background: totalSelected > 0 ? "linear-gradient(135deg,#ffd24a,#ffb700)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: "10px", color: totalSelected > 0 ? "#000" : "rgba(255,255,255,0.25)", fontWeight: 800, fontSize: "13px", cursor: totalSelected > 0 ? "pointer" : "not-allowed", letterSpacing: "0.06em", fontFamily: "'Arial Black',Arial,sans-serif", boxShadow: totalSelected > 0 ? "0 4px 16px rgba(255,210,74,0.3)" : "none", whiteSpace: "nowrap", opacity: totalSelected > 0 ? 1 : 0.5, transition: "all 0.2s" }}
          >
            {totalSelected > 0 ? `⚡ PLAY (${totalSelected})` : "Select at least 1 card"}
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {previewCard && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ position: "relative", maxWidth: "500px", width: "100%" }}>
            <button
              onClick={() => setPreviewCard(null)}
              style={{ position: "absolute", top: "-40px", right: 0, background: "none", border: "none", color: "#fff", fontSize: "32px", cursor: "pointer", padding: 0, width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              ✕
            </button>
            
            <div style={{ background: "rgba(0,0,0,0.8)", border: "2px solid rgba(100,200,255,0.3)", borderRadius: "16px", padding: "24px", textAlign: "center" }}>
              {/* Card Preview */}
              <div style={{ marginBottom: "20px", display: "flex", justifyContent: "center" }}>
                <div style={{ width: "220px", height: "308px" }}>
                  <TKDLCard
                    card={ALL_CARDS.find(c => c.name === previewCard.name) || { id: "", name: "", category: "WILDCARD", rarity: "COMMON", effect: "", gameMode: "" }}
                    size="md"
                    locked={false}
                  />
                </div>
              </div>
              
              {/* Card Info */}
              <h3 style={{ margin: "16px 0 8px", fontSize: "18px", fontWeight: 900, color: "#ffd24a" }}>{previewCard.name}</h3>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                {previewCard.cardType === "GOOD" ? "✓ GOOD" : "✗ BAD"} • {previewCard.rarity}
              </p>
              <p style={{ margin: "0 0 20px", fontSize: "14px", color: "rgba(255,255,255,0.8)", lineHeight: "1.5" }}>{previewCard.effect}</p>
              
              <button
                onClick={() => setPreviewCard(null)}
                style={{ padding: "12px 32px", background: "linear-gradient(135deg,#4db8ff,#00c4ff)", border: "none", borderRadius: "10px", color: "#000", fontWeight: 900, fontSize: "13px", cursor: "pointer", letterSpacing: "0.08em" }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
