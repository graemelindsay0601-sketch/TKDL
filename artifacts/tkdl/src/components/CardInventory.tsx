import React, { useState, useMemo } from "react";
import { Search, Filter, SortAsc } from "lucide-react";
import { CardDisplay } from "./CardDisplay";

interface Card {
  id: string;
  name: string;
  description: string;
  cardType: "GOOD" | "BAD";
  rarity: "COMMON" | "RARE" | "LEGENDARY";
  effect: string;
  gameMode: "X01" | "CRICKET" | "WILDCARD";
  quantity: number;
}

interface CardInventoryProps {
  cards: Card[];
  loading?: boolean;
}

type SortOption = "rarity" | "type" | "name" | "quantity";
type FilterType = "all" | "X01" | "CRICKET" | "WILDCARD";
type FilterRarity = "all" | "COMMON" | "RARE" | "LEGENDARY";

export function CardInventory({ cards, loading = false }: CardInventoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterRarity, setFilterRarity] = useState<FilterRarity>("all");
  const [sortBy, setSortBy] = useState<SortOption>("rarity");

  const filteredAndSorted = useMemo(() => {
    let filtered = cards.filter((card) => {
      const matchesSearch =
        card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = filterType === "all" || card.gameMode === filterType;
      const matchesRarity = filterRarity === "all" || card.rarity === filterRarity;

      return matchesSearch && matchesType && matchesRarity;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "rarity":
          const rarityOrder = { LEGENDARY: 0, RARE: 1, COMMON: 2 };
          return rarityOrder[a.rarity] - rarityOrder[b.rarity];
        case "type":
          return a.cardType.localeCompare(b.cardType);
        case "name":
          return a.name.localeCompare(b.name);
        case "quantity":
          return b.quantity - a.quantity;
        default:
          return 0;
      }
    });

    return filtered;
  }, [cards, searchQuery, filterType, filterRarity, sortBy]);

  const stats = {
    total: cards.length,
    legendary: cards.filter((c) => c.rarity === "LEGENDARY").length,
    rare: cards.filter((c) => c.rarity === "RARE").length,
    common: cards.filter((c) => c.rarity === "COMMON").length,
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
        <p style={{ color: "var(--color-text-secondary)" }}>Loading your card collection...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "12px",
          marginBottom: "2rem",
        }}
      >
        {[
          { label: "Total Cards", value: stats.total, color: "#666" },
          { label: "Legendary", value: stats.legendary, color: "#FBBF24" },
          { label: "Rare", value: stats.rare, color: "#3B82F6" },
          { label: "Common", value: stats.common, color: "#9CA3AF" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "1rem",
              borderRadius: "10px",
              background: "var(--color-background-secondary)",
              border: `2px solid ${stat.color}33`,
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
              }}
            >
              {stat.label}
            </p>
            <p
              style={{
                margin: "0.5rem 0 0 0",
                fontSize: "24px",
                fontWeight: 900,
                color: stat.color,
                fontFamily: "Oswald, sans-serif",
              }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div
        style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          borderRadius: "12px",
          background: "var(--color-background-secondary)",
          border: "1px solid var(--color-border-tertiary)",
        }}
      >
        {/* Search */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              marginBottom: "0.5rem",
            }}
          >
            <Search size={14} style={{ marginRight: "6px" }} />
            Search Cards
          </label>
          <input
            type="text"
            placeholder="Search by name or effect..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--color-border-tertiary)",
              background: "var(--color-background-primary)",
              color: "var(--color-text-primary)",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Filters & Sort */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: "0.5rem",
              }}
            >
              <Filter size={14} style={{ marginRight: "6px" }} />
              Game Mode
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--color-border-tertiary)",
                background: "var(--color-background-primary)",
                color: "var(--color-text-primary)",
                fontSize: "14px",
              }}
            >
              <option value="all">All Modes</option>
              <option value="X01">X01 Only</option>
              <option value="CRICKET">Cricket Only</option>
              <option value="WILDCARD">Wildcards</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: "0.5rem",
              }}
            >
              Rarity
            </label>
            <select
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value as FilterRarity)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--color-border-tertiary)",
                background: "var(--color-background-primary)",
                color: "var(--color-text-primary)",
                fontSize: "14px",
              }}
            >
              <option value="all">All Rarities</option>
              <option value="LEGENDARY">Legendary Only</option>
              <option value="RARE">Rare Only</option>
              <option value="COMMON">Common Only</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: "0.5rem",
              }}
            >
              <SortAsc size={14} style={{ marginRight: "6px" }} />
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--color-border-tertiary)",
                background: "var(--color-background-primary)",
                color: "var(--color-text-primary)",
                fontSize: "14px",
              }}
            >
              <option value="rarity">Rarity</option>
              <option value="type">Type (Good/Bad)</option>
              <option value="name">Name</option>
              <option value="quantity">Quantity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {filteredAndSorted.length === 0 ? (
        <div
          style={{
            padding: "3rem 1rem",
            textAlign: "center",
            borderRadius: "12px",
            background: "var(--color-background-secondary)",
            border: "1px dashed var(--color-border-tertiary)",
          }}
        >
          <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
            {searchQuery || filterType !== "all" || filterRarity !== "all"
              ? "No cards match your filters"
              : "You haven't collected any cards yet"}
          </p>
        </div>
      ) : (
        <>
          <p
            style={{
              marginBottom: "1rem",
              fontSize: "12px",
              color: "var(--color-text-secondary)",
              fontWeight: 600,
            }}
          >
            Showing {filteredAndSorted.length} of {cards.length} cards
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "24px",
              paddingBottom: "2rem",
            }}
          >
            {filteredAndSorted.map((card) => (
              <div key={card.id} style={{ paddingBottom: "60px" }}>
                <CardDisplay
                  id={card.id}
                  name={card.name}
                  description={card.description}
                  cardType={card.cardType}
                  rarity={card.rarity}
                  effect={card.effect}
                  gameMode={card.gameMode}
                  quantity={card.quantity}
                  showQuantity
                  interactive
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
