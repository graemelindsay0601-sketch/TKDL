import { useState, useEffect } from "react";
import { ALL_CARDS } from "../lib/cards-data";
import { TKDLCard } from "./TKDLCard";

type TypeGroup = {
  id: string;
  name: string;
  category: string;
  color: string;
};

const TYPE_GROUPS: TypeGroup[] = [
  { id: "x01-good",      name: "X01 GOOD",      category: "X01 GOOD",      color: "#00b4ff" },
  { id: "x01-bad",       name: "X01 BAD",        category: "X01 BAD",       color: "#ff2222" },
  { id: "cricket-good",  name: "CRICKET GOOD",   category: "CRICKET GOOD",  color: "#00cc44" },
  { id: "cricket-bad",   name: "CRICKET BAD",    category: "CRICKET BAD",   color: "#9933ff" },
  { id: "wildcard-good", name: "WILDCARD GOOD",  category: "WILDCARD GOOD", color: "#ffaa00" },
  { id: "wildcard-bad",  name: "WILDCARD BAD",   category: "WILDCARD BAD",  color: "#cc1111" },
];

export function CardCollectionBook({ playerId }: { playerId: number }) {
  const [ownedNames, setOwnedNames] = useState<Set<string>>(new Set());
  const [purchaseTimestamps, setPurchaseTimestamps] = useState<Map<string, string>>(new Map());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<string>("x01-good");

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/card-clash/inventory/${playerId}`).then(r => r.json()),
      fetch(`/api/player/${playerId}/cards/favorites`).then(r => r.json()).catch(() => ({ favorites: [] }))
    ])
      .then(([inv, favData]: any[]) => {
        const names = new Set<string>();
        const timestamps = new Map<string, string>();
        
        (Array.isArray(inv) ? inv : []).forEach((c: any) => {
          const cardName = c.cardName ?? c.name ?? "";
          names.add(cardName);
          if (c.createdAt) {
            timestamps.set(cardName, new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }));
          }
        });
        
        const favoriteCardIds = new Set<string>(
          (Array.isArray(favData?.favorites) ? favData.favorites : []).map(
            (c: any) => String(c.id)
          )
        );
        setOwnedNames(names);
        setPurchaseTimestamps(timestamps);
        setFavorites(favoriteCardIds);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [playerId]);

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)", padding: "24px" }}>Loading collection...</div>;
  if (error)   return <div style={{ color: "#ff6b6b",            padding: "24px" }}>Error: {error}</div>;

  const totalOwned      = ALL_CARDS.filter(c => ownedNames.has(c.name)).length;
  const completionPct   = Math.round((totalOwned / ALL_CARDS.length) * 100);

  return (
    <div style={{ width: "100%" }}>
      {/* Progress bar */}
      <div style={{ padding: "16px", background: "linear-gradient(135deg,rgba(255,212,74,0.1),rgba(0,229,255,0.1))", border: "2px solid rgba(255,212,74,0.3)", borderRadius: "12px", marginBottom: "20px" }}>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", marginBottom: "8px" }}>Collection Progress</div>
        <div style={{ fontSize: "28px", fontWeight: 700, color: "#ffd24a", marginBottom: "12px" }}>{totalOwned} / {ALL_CARDS.length} Cards</div>
        <div style={{ width: "100%", height: "12px", background: "rgba(0,0,0,0.3)", borderRadius: "6px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${completionPct}%`, background: "linear-gradient(90deg,#00e5ff,#ffd24a)", transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "8px" }}>{completionPct}% Complete</div>
      </div>

      {/* Sections */}
      <div style={{ display: "grid", gap: "16px" }}>
        {TYPE_GROUPS.map(group => {
          const groupCards  = ALL_CARDS.filter(c => c.category === group.category);
          const ownedCount  = groupCards.filter(c => ownedNames.has(c.name)).length;
          const isExpanded  = expandedType === group.id;

          return (
            <div key={group.id}>
              {/* Section header */}
              <div
                style={{ padding: "12px 16px", background: `linear-gradient(135deg,${group.color}15,${group.color}05)`, border: `2px solid ${group.color}`, borderRadius: "8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s" }}
                onClick={() => setExpandedType(isExpanded ? "" : group.id)}
              >
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: group.color, textTransform: "uppercase" }}>{group.name}</div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{ownedCount} / {groupCards.length} Cards owned</div>
                </div>
                <div style={{ fontSize: "20px", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", color: group.color }}>▼</div>
              </div>

              {/* Cards grid */}
              {isExpanded && (
                <div style={{ marginTop: "12px", padding: "12px", background: "rgba(0,0,0,0.25)", borderRadius: "8px", display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "flex-start" }}>
                  {groupCards
                    .sort((a, b) => {
                      // Favorites first
                      const aIsFav = favorites.has(String(a.id));
                      const bIsFav = favorites.has(String(b.id));
                      if (aIsFav !== bIsFav) return aIsFav ? -1 : 1;
                      return 0;
                    })
                    .map(card => {
                      const isOwned = ownedNames.has(card.name);
                      const isFavorite = favorites.has(String(card.id));
                      const purchaseDate = purchaseTimestamps.get(card.name);
                      return (
                        <div key={card.id} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <TKDLCard
                            card={card}
                            size="sm"
                            locked={!isOwned}
                            isFavorite={isFavorite}
                            playerId={playerId}
                            onFavoriteChange={(newFavState) => {
                              const newFavorites = new Set(favorites);
                              if (newFavState) {
                                newFavorites.add(String(card.id));
                              } else {
                                newFavorites.delete(String(card.id));
                              }
                              setFavorites(newFavorites);
                            }}
                          />
                          {isOwned && purchaseDate && (
                            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "4px", textAlign: "center", maxWidth: "80px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              Acquired {purchaseDate}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
