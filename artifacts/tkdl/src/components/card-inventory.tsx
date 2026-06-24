import React, { useState, useEffect } from "react";
import { Search, ChevronDown, Grid3x3, List } from "lucide-react";
import { CardDisplay } from "./CardDisplay";

interface CardInventoryProps {
  playerId: number;
}

interface Card {
  cardId: string;
  quantity: number;
  cardName: string;
  rarity: "COMMON" | "RARE" | "LEGENDARY";
  gameMode: "X01" | "CRICKET" | "WILDCARD";
  cardType: "GOOD" | "BAD";
  effect: string;
  imageUrl?: string;
}

export default function CardInventory({ playerId }: CardInventoryProps) {
  const [inventory, setInventory] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<"ALL" | "X01" | "CRICKET" | "WILDCARD">("ALL");
  const [filterType, setFilterType] = useState<"ALL" | "GOOD" | "BAD">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    loadInventory();
  }, [playerId]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/card-clash/inventory/${playerId}`);
      const data = await res.json();
      setInventory(data);
    } catch (error) {
      console.error("Failed to load inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCards = inventory.filter((card) => {
    if (filterMode !== "ALL" && card.gameMode !== filterMode) return false;
    if (filterType !== "ALL" && card.cardType !== filterType) return false;
    if (searchQuery && !card.cardName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const cardStats = {
    total: inventory.reduce((sum, c) => sum + c.quantity, 0),
    common: inventory.filter((c) => c.rarity === "COMMON").reduce((sum, c) => sum + c.quantity, 0),
    rare: inventory.filter((c) => c.rarity === "RARE").reduce((sum, c) => sum + c.quantity, 0),
    legendary: inventory
      .filter((c) => c.rarity === "LEGENDARY")
      .reduce((sum, c) => sum + c.quantity, 0),
  };

  if (loading) {
    return <div style={{ padding: "1rem" }}>Loading your card collection...</div>;
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 500, margin: "0 0 1.5rem 0" }}>
        🎴 Card Collection ({cardStats.total} total)
      </h2>

      {/* Stats Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: "12px",
          marginBottom: "1.5rem",
        }}
      >
        <StatBox label="Common" count={cardStats.common} rarity="COMMON" />
        <StatBox label="Rare" count={cardStats.rare} rarity="RARE" />
        <StatBox label="Legendary" count={cardStats.legendary} rarity="LEGENDARY" />
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Search cards..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-tertiary)",
            fontSize: "14px",
            flex: "1",
            minWidth: "150px",
          }}
        />

        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as any)}
          style={{
            padding: "8px 12px",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-tertiary)",
            fontSize: "13px",
            background: "var(--color-background-primary)",
            color: "var(--color-text-primary)",
          }}
        >
          <option value="ALL">All Modes</option>
          <option value="X01">X01</option>
          <option value="CRICKET">Cricket</option>
          <option value="WILDCARD">Wildcard</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          style={{
            padding: "8px 12px",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-tertiary)",
            fontSize: "13px",
            background: "var(--color-background-primary)",
            color: "var(--color-text-primary)",
          }}
        >
          <option value="ALL">All Types</option>
          <option value="GOOD">GOOD Cards</option>
          <option value="BAD">BAD Cards</option>
        </select>
      </div>

      {/* Card List */}
      {filteredCards.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary)" }}>
          <p>No cards matching your search</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {filteredCards.map((card) => (
            <CardRow
              key={card.cardId}
              card={card}
              isExpanded={expandedCard === card.cardId}
              onToggleExpand={() =>
                setExpandedCard(expandedCard === card.cardId ? null : card.cardId)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  count,
  rarity,
}: {
  label: string;
  count: number;
  rarity: "COMMON" | "RARE" | "LEGENDARY";
}) {
  const rarityColors = {
    COMMON: { bg: "var(--color-background-secondary)", text: "var(--color-text-secondary)" },
    RARE: "var(--color-background-warning)",
    LEGENDARY: "var(--color-background-danger)",
  };

  return (
    <div
      style={{
        background: rarityColors[rarity],
        padding: "12px",
        borderRadius: "var(--border-radius-md)",
        border: "0.5px solid var(--color-border-tertiary)",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: "0 0 4px 0" }}>
        {label}
      </p>
      <p style={{ fontSize: "18px", fontWeight: 500, margin: 0 }}>{count}</p>
    </div>
  );
}

function CardRow({
  card,
  isExpanded,
  onToggleExpand,
}: {
  card: Card;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const rarityBadgeColor = {
    COMMON: "var(--color-background-secondary)",
    RARE: "var(--color-background-warning)",
    LEGENDARY: "var(--color-background-danger)",
  };

  const typeColor = card.cardType === "GOOD" ? "var(--color-background-success)" : "var(--color-background-danger)";

  return (
    <div
      style={{
        background: "var(--color-background-secondary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-md)",
        overflow: "hidden",
      }}
    >
      {/* Card Header */}
      <button
        onClick={onToggleExpand}
        style={{
          width: "100%",
          padding: "12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          textAlign: "left",
        }}
      >
        {/* Quantity Badge */}
        <div
          style={{
            background: typeColor,
            color: "white",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {card.quantity}
        </div>

        {/* Card Info */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px 0" }}>
            {card.cardName}
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Badge text={card.gameMode} bg="var(--color-background-info)" />
            <Badge text={card.cardType} bg={typeColor} />
            <Badge text={card.rarity} bg={rarityBadgeColor[card.rarity]} />
          </div>
        </div>

        {/* Expand Icon */}
        <ChevronDown
          size={18}
          style={{
            transition: "transform 0.2s",
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            color: "var(--color-text-secondary)",
          }}
        />
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          style={{
            padding: "12px",
            borderTop: "0.5px solid var(--color-border-tertiary)",
            background: "var(--color-background-primary)",
            fontSize: "13px",
            lineHeight: "1.6",
            color: "var(--color-text-secondary)",
          }}
        >
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>Effect:</strong> {card.effect}
          </p>
          {card.imageUrl && (
            <img
              src={card.imageUrl}
              alt={card.cardName}
              style={{
                width: "100%",
                maxWidth: "200px",
                borderRadius: "var(--border-radius-md)",
                marginTop: "8px",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Badge({ text, bg }: { text: string; bg: string }) {
  return (
    <span
      style={{
        background: bg,
        color: "white",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 500,
      }}
    >
      {text}
    </span>
  );
}
