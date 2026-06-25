import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Sparkles } from "lucide-react";
import { CardDisplay } from "./CardDisplay";

interface Card {
  id: string;
  name: string;
  cardType: "GOOD" | "BAD";
  rarity: "COMMON" | "RARE" | "LEGENDARY";
  effect: string;
  quantity: number;
}

interface EquippedCards {
  goodCards: Card[];
  badCards: Card[];
}

interface CardEquipmentSelectorProps {
  currentPlayerId: number;
  currentPlayerName?: string;
  opponentId?: number;
  opponentName?: string;
  gameMode: "X01" | "CRICKET";
  onConfirm: (p1Cards: any[], p2Cards: any[]) => void;
  onBack: () => void;
  // Legacy aliases kept for backwards compat
  playerId?: number;
  onSelect?: (equipment: EquippedCards) => void;
  onCancel?: () => void;
}

const RarityColor: Record<string, string> = {
  COMMON: "text-gray-400",
  RARE: "text-blue-400",
  LEGENDARY: "text-yellow-400",
};

const RarityBg: Record<string, string> = {
  COMMON: "bg-gray-500/10",
  RARE: "bg-blue-500/10",
  LEGENDARY: "bg-yellow-500/10",
};

export function CardEquipmentSelector({
  currentPlayerId,
  gameMode,
  onConfirm,
  onBack,
}: CardEquipmentSelectorProps) {
  const playerId = currentPlayerId;
  const [inventory, setInventory] = useState<Card[]>([]);
  const [selectedGood, setSelectedGood] = useState<Card[]>([]);
  const [selectedBad, setSelectedBad] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) return;
    loadInventory();
  }, [playerId]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/card-clash/inventory/${playerId}`);
      if (!response.ok) throw new Error("Failed to load inventory");

      const data = await response.json();
      setInventory(data.cards || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cards");
      console.error("Inventory load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter cards by type and game mode
  const goodCardsAvailable = inventory.filter(
    (c) => c.cardType === "GOOD" && 
            (c.gameMode === gameMode || c.gameMode === "WILDCARD") &&
            c.quantity > 0
  );

  const badCardsAvailable = inventory.filter(
    (c) => c.cardType === "BAD" && 
            (c.gameMode === gameMode || c.gameMode === "WILDCARD") &&
            c.quantity > 0
  );

  // Handle card selection
  const toggleGoodCard = (card: Card) => {
    if (selectedGood.find((c) => c.id === card.id)) {
      setSelectedGood(selectedGood.filter((c) => c.id !== card.id));
    } else if (selectedGood.length < 2) {
      setSelectedGood([...selectedGood, card]);
    }
  };

  const toggleBadCard = (card: Card) => {
    if (selectedBad.find((c) => c.id === card.id)) {
      setSelectedBad(selectedBad.filter((c) => c.id !== card.id));
    } else if (selectedBad.length < 2) {
      setSelectedBad([...selectedBad, card]);
    }
  };

  const isReady = selectedGood.length === 2 && selectedBad.length === 2;

  const handleConfirm = () => {
    if (isReady) {
      onConfirm([...selectedGood, ...selectedBad], []);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-300">Loading your cards...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-red-500 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-red-400 font-semibold mb-1">Error Loading Cards</h3>
              <p className="text-gray-300 text-sm mb-4">{error}</p>
              <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-amber-500/30 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Equip Cards for {gameMode}</h2>
          </div>
          <p className="text-sm text-gray-400">
            Select 2 GOOD cards and 2 BAD cards to use in this match
          </p>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* GOOD Cards Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-green-400">
                GOOD Cards ({selectedGood.length}/2)
              </h3>
              {selectedGood.length === 2 && <CheckCircle className="w-5 h-5 text-green-400" />}
            </div>

            {goodCardsAvailable.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center text-gray-400">
                No good cards available for {gameMode}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {goodCardsAvailable.map((card) => {
                  const isSelected = selectedGood.find((c) => c.id === card.id);
                  const cardNum = parseInt(card.id) || 0;
                  return (
                    <button
                      key={card.id}
                      onClick={() => toggleGoodCard(card)}
                      disabled={selectedGood.length === 2 && !isSelected}
                      className={`rounded-lg border-2 p-3 transition-all overflow-hidden ${
                        isSelected
                          ? "border-green-500 bg-green-500/10"
                          : selectedGood.length === 2
                            ? "border-gray-600 bg-gray-800/30 opacity-50 cursor-not-allowed"
                            : "border-gray-600 bg-gray-800/50 hover:border-green-500/50 hover:bg-gray-700/50"
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Card Image */}
                        <div style={{ flexShrink: 0 }}>
                          <CardDisplay cardId={cardNum} size="small" />
                        </div>
                        
                        {/* Card Info */}
                        <div className="flex-1 text-left">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-white text-sm">{card.name}</p>
                              <p className={`text-xs mt-1 ${RarityColor[card.rarity]}`}>
                                {card.rarity} • Qty: {card.quantity}
                              </p>
                            </div>
                            {isSelected && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 ml-2 mt-1" />}
                          </div>
                          <p className="text-xs text-gray-300 mt-2 line-clamp-2">{card.effect}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* BAD Cards Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-red-400">
                BAD Cards ({selectedBad.length}/2)
              </h3>
              {selectedBad.length === 2 && <CheckCircle className="w-5 h-5 text-red-400" />}
            </div>

            {badCardsAvailable.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center text-gray-400">
                No bad cards available for {gameMode}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {badCardsAvailable.map((card) => {
                  const isSelected = selectedBad.find((c) => c.id === card.id);
                  const cardNum = parseInt(card.id) || 0;
                  return (
                    <button
                      key={card.id}
                      onClick={() => toggleBadCard(card)}
                      disabled={selectedBad.length === 2 && !isSelected}
                      className={`rounded-lg border-2 p-3 transition-all overflow-hidden ${
                        isSelected
                          ? "border-red-500 bg-red-500/10"
                          : selectedBad.length === 2
                            ? "border-gray-600 bg-gray-800/30 opacity-50 cursor-not-allowed"
                            : "border-gray-600 bg-gray-800/50 hover:border-red-500/50 hover:bg-gray-700/50"
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Card Image */}
                        <div style={{ flexShrink: 0 }}>
                          <CardDisplay cardId={cardNum} size="small" />
                        </div>
                        
                        {/* Card Info */}
                        <div className="flex-1 text-left">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-white text-sm">{card.name}</p>
                              <p className={`text-xs mt-1 ${RarityColor[card.rarity]}`}>
                                {card.rarity} • Qty: {card.quantity}
                              </p>
                            </div>
                            {isSelected && <CheckCircle className="w-4 h-4 text-red-400 flex-shrink-0 ml-2 mt-1" />}
                          </div>
                          <p className="text-xs text-gray-300 mt-2 line-clamp-2">{card.effect}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Help Text */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <p className="text-xs text-amber-400">
              💡 <strong>Tip:</strong> GOOD cards boost your score at the start of your turn. BAD cards harm 
              your opponent and are played by them at the end of your turn.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4 flex gap-2 justify-end">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isReady}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              isReady
                ? "bg-amber-500 hover:bg-amber-600 text-black cursor-pointer"
                : "bg-gray-600 text-gray-400 cursor-not-allowed opacity-50"
            }`}
          >
            {isReady ? "Start Match with Cards" : `Select 2 GOOD + 2 BAD (${selectedGood.length + selectedBad.length}/4)`}
          </button>
        </div>
      </div>
    </div>
  );
}
