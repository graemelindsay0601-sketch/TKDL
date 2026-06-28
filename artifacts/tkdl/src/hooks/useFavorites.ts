import { useState, useCallback, useEffect } from "react";

// ────────────────────────────────────────────────────────────────────────
// CARD CLASH FAVORITES HOOK
// ────────────────────────────────────────────────────────────────────────

export interface CardClashFavorite {
  id: number;
  cardId: string;
  cardName: string;
  gameMode: "X01" | "CRICKET";
  addedAt: string | Date;
}

interface UseFavoritesOptions {
  gameMode?: "X01" | "CRICKET";
}

/**
 * Hook for managing Card Clash card favorites
 * 
 * Features:
 * - Load favorites from server on mount
 * - Add/remove favorites
 * - Check if card is favorited
 * - Auto-refresh after changes
 * - Proper error handling
 * - Max 20 favorites per game mode
 */
export function useFavorites(options: UseFavoritesOptions = {}) {
  const gameMode = options.gameMode || "X01";
  
  const [favorites, setFavorites] = useState<CardClashFavorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load favorites from server
  const loadFavorites = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/card-favorites?gameMode=${gameMode}`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Not authenticated");
        }
        throw new Error("Failed to load favorites");
      }

      const data = await response.json();
      setFavorites(data.favorites || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[useFavorites] Load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [gameMode]);

  // Load on mount and when gameMode changes
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Add card to favorites
  const addFavorite = useCallback(
    async (cardId: string, cardName: string) => {
      try {
        const response = await fetch("/api/card-favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            cardId,
            cardName,
            gameMode,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          if (response.status === 409) {
            // Already favorited - that's ok
            return true;
          }
          
          throw new Error(
            errorData.error || `Failed to add favorite (${response.status})`
          );
        }

        const data = await response.json();
        if (data.ok) {
          // Reload favorites to sync with server
          await loadFavorites();
          return true;
        }

        throw new Error("Failed to add favorite");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("[useFavorites] Add error:", err);
        return false;
      }
    },
    [gameMode, loadFavorites]
  );

  // Remove card from favorites
  const removeFavorite = useCallback(
    async (cardId: string) => {
      try {
        const response = await fetch(
          `/api/card-favorites/${cardId}?gameMode=${gameMode}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            // Not found - that's ok
            return true;
          }
          throw new Error(`Failed to remove favorite (${response.status})`);
        }

        const data = await response.json();
        if (data.ok) {
          // Reload favorites to sync with server
          await loadFavorites();
          return true;
        }

        throw new Error("Failed to remove favorite");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("[useFavorites] Remove error:", err);
        return false;
      }
    },
    [gameMode, loadFavorites]
  );

  // Toggle favorite status
  const toggleFavorite = useCallback(
    async (cardId: string, cardName: string): Promise<boolean> => {
      const isFavorited = favorites.some((f) => f.cardId === cardId);

      if (isFavorited) {
        return removeFavorite(cardId);
      } else {
        return addFavorite(cardId, cardName);
      }
    },
    [favorites, addFavorite, removeFavorite]
  );

  // Check if card is favorited
  const isFavorited = useCallback(
    (cardId: string): boolean => {
      return favorites.some((f) => f.cardId === cardId);
    },
    [favorites]
  );

  // Clear all favorites for this game mode
  const clearAllFavorites = useCallback(async () => {
    try {
      const response = await fetch(`/api/card-favorites?gameMode=${gameMode}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to clear favorites");
      }

      const data = await response.json();
      if (data.ok) {
        await loadFavorites();
        return true;
      }

      throw new Error("Failed to clear favorites");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[useFavorites] Clear error:", err);
      return false;
    }
  }, [gameMode, loadFavorites]);

  return {
    favorites,
    isLoading,
    error,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorited,
    clearAllFavorites,
    refresh: loadFavorites,
    count: favorites.length,
    isFull: favorites.length >= 20,
  };
}

// ────────────────────────────────────────────────────────────────────────
// LEGACY INVENTORY FAVORITES (Kept for backwards compatibility)
// ────────────────────────────────────────────────────────────────────────

interface CardWithFavorite {
  id: number;
  name: string;
  category: string;
  rarity: string;
  effect: string;
  is_favorite?: boolean;
  [key: string]: any;
}

/**
 * DEPRECATED: Use useFavorites() for Card Clash
 * This hook is kept for legacy inventory card favorites
 */
export function useInventoryFavorites(playerId: number, cards: CardWithFavorite[]) {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const response = await fetch(`/api/player/${playerId}/cards/favorites`);
        if (response.ok) {
          const data = await response.json();
          const favIds = new Set(data.favorites.map((card: any) => card.id));
          setFavorites(favIds);
        }
      } catch (error) {
        console.error('Failed to load inventory favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    if (playerId) {
      loadFavorites();
    }
  }, [playerId]);

  const isFavorite = useCallback(
    (cardId: number): boolean => favorites.has(cardId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (cardId: number) => {
      try {
        const response = await fetch(`/api/cards/${cardId}/favorite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId }),
        });

        if (response.ok) {
          const data = await response.json();
          const newFavorites = new Set(favorites);
          if (data.isFavorite) {
            newFavorites.add(cardId);
          } else {
            newFavorites.delete(cardId);
          }
          setFavorites(newFavorites);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Failed to toggle inventory favorite:', error);
        return false;
      }
    },
    [playerId, favorites]
  );

  const sortedCards = useCallback((): CardWithFavorite[] => {
    const favorited = cards.filter((c) => favorites.has(c.id));
    const notFavorited = cards.filter((c) => !favorites.has(c.id));
    return [...favorited, ...notFavorited];
  }, [cards, favorites]);

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    sortedCards: sortedCards(),
    loading,
  };
}

/**
 * Filter cards into favorites and non-favorites
 */
export function partitionByFavorite(
  cards: CardWithFavorite[],
  favorites: Set<number>
): {
  favorited: CardWithFavorite[];
  notFavorited: CardWithFavorite[];
} {
  return {
    favorited: cards.filter((c) => favorites.has(c.id)),
    notFavorited: cards.filter((c) => !favorites.has(c.id)),
  };
}
