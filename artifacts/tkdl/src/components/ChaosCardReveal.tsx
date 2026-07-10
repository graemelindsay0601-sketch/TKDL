/**
 * ChaosCardReveal - Chaos Mode mystery-card picker.
 * Shows 3 face-down cards at the start of a visit. Player taps one, it flips
 * to reveal the card, then auto-applies after a short beat.
 */

import { useState, useRef } from "react";
import { TKDLCard } from "./TKDLCard";
import type { CardData } from "@/lib/cards-data";

interface ChaosCardRevealProps {
  options: CardData[];
  playerLabel: string;
  onResolve: (card: CardData) => void;
}

export function ChaosCardReveal({ options, playerLabel, onResolve }: ChaosCardRevealProps) {
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const resolvedRef = useRef(false);

  const resolveOnce = (card: CardData) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onResolve(card);
  };

  const handlePick = (idx: number) => {
    if (pickedIndex !== null) return;
    setPickedIndex(idx);
    // Let the flip animation finish, then show the revealed card long enough to actually read it.
    window.setTimeout(() => setRevealed(true), 500);
    // Safety-net auto-continue in case the player doesn't tap — long enough to read the full effect text.
    window.setTimeout(() => resolveOnce(options[idx]), 5000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 55,
      }}
    >
      <style>{`
        @keyframes chaos-fade-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes chaos-flip { 0% { transform: rotateY(0deg); } 50% { transform: rotateY(90deg); } 100% { transform: rotateY(0deg); } }
        .chaos-card-back {
          width: 78px; height: 108px; border-radius: 10px;
          background: linear-gradient(135deg, #1a1030, #2d1a4d 45%, #1a1030);
          border: 2px solid rgba(167,139,250,0.4);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 20px rgba(124,58,237,0.35), inset 0 0 12px rgba(167,139,250,0.15);
          cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
        }
        .chaos-card-back:hover { transform: translateY(-4px); box-shadow: 0 4px 26px rgba(124,58,237,0.55); }
      `}</style>

      <div
        style={{
          animation: "chaos-fade-in 0.22s ease-out",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          padding: "20px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 900,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#a78bfa",
            textShadow: "0 0 12px rgba(167,139,250,0.6)",
          }}
        >
          🌀 Chaos Draw — {playerLabel}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "-8px" }}>
          {pickedIndex === null ? "Pick a card — it applies instantly" : revealed ? "Tap the card to continue" : "Revealing..."}
        </div>

        <div style={{ display: "flex", gap: "14px" }}>
          {options.map((card, idx) => {
            const isPicked = pickedIndex === idx;
            const isOtherPicked = pickedIndex !== null && !isPicked;
            return (
              <div
                key={card.id}
                style={{
                  opacity: isOtherPicked ? 0.25 : 1,
                  transition: "opacity 0.2s",
                  perspective: "600px",
                }}
              >
                {isPicked ? (
                  <div
                    style={{ animation: "chaos-flip 0.5s ease-in-out", cursor: revealed ? "pointer" : "default" }}
                    onClick={() => revealed && resolveOnce(card)}
                  >
                    <TKDLCard card={card} size={revealed ? "md" : "sm"} locked={false} />
                  </div>
                ) : (
                  <div className="chaos-card-back" onClick={() => handlePick(idx)}>
                    <span style={{ fontSize: "26px", opacity: 0.7 }}>❔</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {revealed && pickedIndex !== null && (
          <button
            onClick={() => resolveOnce(options[pickedIndex])}
            style={{
              marginTop: "4px", padding: "9px 26px", borderRadius: "10px", border: "1px solid rgba(167,139,250,0.4)",
              background: "rgba(167,139,250,0.15)", color: "#a78bfa",
              fontFamily: "Oswald, sans-serif", fontWeight: 800, fontSize: "12px",
              letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}
