import React, { useState, useEffect } from "react";
import { Sparkles, X, HelpCircle } from "lucide-react";

interface CardState {
  id: string;
  name: string;
  effect: string;
  cardType: "GOOD" | "BAD";
  isActive: boolean;
  modifier?: number;
}

interface CardActivationOverlayProps {
  equippedCards: CardState[];
  isVisible: boolean;
  activatedCard?: CardState;
  scoreModifier?: number;
  onCardActivate?: (cardId: string) => void;
  onClose?: () => void;
}

/**
 * Modal for cards that require player input (Instant Mark, Sniper Lock, etc.)
 */
function CardInputModal({
  card,
  onSubmit,
  onCancel,
}: {
  card: CardState;
  onSubmit: (selection: number | number[]) => void;
  onCancel: () => void;
}) {
  const [selection, setSelection] = useState<number | number[]>([]);

  const handleSubmit = () => {
    if (Array.isArray(selection) ? selection.length > 0 : selection > 0) {
      onSubmit(selection);
    }
  };

  // Determine input type based on card effect
  const isMultiSelect = card.effect.toLowerCase().includes("lock") ||
                        card.effect.toLowerCase().includes("3") ||
                        card.effect.toLowerCase().includes("2");
  const isCricketNumber = card.effect.toLowerCase().includes("mark") ||
                          card.effect.toLowerCase().includes("number");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-amber-500 rounded-lg max-w-sm w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-white text-lg">{card.name}</h3>
            <p className="text-sm text-gray-300 mt-1">{card.effect}</p>
          </div>
        </div>

        {isCricketNumber ? (
          <div className="space-y-3 mb-6">
            <p className="text-sm text-gray-400">Select cricket number:</p>
            <div className="grid grid-cols-4 gap-2">
              {[15, 16, 17, 18, 19, 20, 25].map((num) => (
                <button
                  key={num}
                  onClick={() => setSelection(num)}
                  className={`py-2 rounded-lg font-semibold text-sm transition-all ${
                    selection === num
                      ? "bg-amber-500 text-black"
                      : "bg-gray-700 hover:bg-gray-600 text-white"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            <p className="text-sm text-gray-400">
              {isMultiSelect ? "Select numbers:" : "Select a number:"}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20, 25].map((num) => {
                const isSelected = Array.isArray(selection)
                  ? selection.includes(num)
                  : selection === num;

                return (
                  <button
                    key={num}
                    onClick={() => {
                      if (isMultiSelect) {
                        const arr = Array.isArray(selection) ? [...selection] : [];
                        if (isSelected) {
                          setSelection(arr.filter((n) => n !== num));
                        } else if (arr.length < 3) {
                          setSelection([...arr, num]);
                        }
                      } else {
                        setSelection(num);
                      }
                    }}
                    className={`py-2 rounded-lg font-semibold text-sm transition-all ${
                      isSelected
                        ? "bg-amber-500 text-black"
                        : "bg-gray-700 hover:bg-gray-600 text-white"
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={Array.isArray(selection) ? selection.length === 0 : selection === 0}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * CardActivationOverlay displays:
 * 1. List of equipped cards with status
 * 2. Score modifier feedback when cards are played
 * 3. Popup modals for cards needing input
 */
export function CardActivationOverlay({
  equippedCards,
  isVisible,
  activatedCard,
  scoreModifier,
  onCardActivate,
  onClose,
}: CardActivationOverlayProps) {
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedInputCard, setSelectedInputCard] = useState<CardState | null>(null);

  const needsInput = activatedCard && (
    activatedCard.effect.toLowerCase().includes("instant mark") ||
    activatedCard.effect.toLowerCase().includes("sniper lock") ||
    activatedCard.effect.toLowerCase().includes("target master") ||
    activatedCard.effect.toLowerCase().includes("focus fire") ||
    activatedCard.effect.toLowerCase().includes("number hunter")
  );

  useEffect(() => {
    if (needsInput && activatedCard) {
      setSelectedInputCard(activatedCard);
      setShowInputModal(true);
    }
  }, [activatedCard, needsInput]);

  if (!isVisible) return null;

  return (
    <>
      {/* Equipment Status Bar */}
      <div className="fixed top-4 right-4 z-40 max-w-xs">
        <div className="bg-gray-900/95 border border-amber-500/50 rounded-lg p-3 backdrop-blur">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold uppercase text-amber-400 tracking-widest">
              Cards Equipped
            </h4>
          </div>

          <div className="space-y-1.5">
            {equippedCards.map((card) => (
              <button
                key={card.id}
                onClick={() => onCardActivate?.(card.id)}
                disabled={card.isActive}
                className={`w-full flex items-start gap-2 p-2 rounded text-xs transition-all cursor-pointer disabled:cursor-default ${
                  card.isActive
                    ? "bg-amber-500/20 border border-amber-500/50 opacity-50"
                    : "bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/70 active:scale-98"
                }`}
              >
                <div className="flex-1 text-left">
                  <p className={`font-semibold ${
                    card.cardType === "GOOD" ? "text-green-400" : "text-red-400"
                  }`}>
                    {card.name}
                  </p>
                  {card.isActive && card.modifier && (
                    <p className="text-amber-300">
                      {card.modifier > 0 ? "+" : ""}{card.modifier}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Score Modifier Display */}
          {activatedCard && scoreModifier !== undefined && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="bg-amber-500/10 border border-amber-500/50 rounded p-2">
                <p className="text-xs text-amber-300">
                  <strong>{activatedCard.name}</strong>
                  {scoreModifier > 0 ? "+" : ""}{scoreModifier}
                </p>
              </div>
            </div>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-1 hover:bg-gray-700/50 rounded transition-colors"
              title="Close"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Card Input Modal */}
      {showInputModal && selectedInputCard && (
        <CardInputModal
          card={selectedInputCard}
          onSubmit={(selection) => {
            setShowInputModal(false);
            // In production, would send selection to backend
            console.log(`Card ${selectedInputCard.name} selected:`, selection);
          }}
          onCancel={() => setShowInputModal(false)}
        />
      )}

      {/* Tutorial Hint */}
      {equippedCards.length === 0 && (
        <div className="fixed bottom-4 right-4 z-40 max-w-xs animate-pulse">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-300">
                <strong>Tip:</strong> No cards equipped. Go back to set up your card equipment before playing.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
