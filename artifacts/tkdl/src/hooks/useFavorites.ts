import { useState, useCallback, useEffect } from "react";

// ────────────────────────────────────────────────────────────────────────
// CARD CLASH FAVORITES HOOK - LocalStorage Based
// ────────────────────────────────────────────────────────────────────────

export interface CardClashFavorite {
  id: string;
  cardId: string;
  cardName: string;
  gameMode: "X01" | "CRICKET";
  addedAt: string;
}

interface UseFavoritesOptions {
  gameMode?: "X01" | "CRICKET";
}

/**
 * Hook for managing Card Clash card favorites
 * 
 * Features:
 * - Persistent localStorage storage
 * - Add/remove favorites
 * - Check if card is favorited
 * - Max 20 favorites per game mode
 * - Auto-sync across tabs
 */
export function useFavorites(options: UseFavoritesOptions = {}) {
  const gameMode = options.gameMode || "X01";
  const storageKey = `tkdl_favorites_${gameMode}`;
  
  const [favorites, setFavorites] = useState<CardClashFavorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load favorites from localStorage
  const loadFavorites = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);
      
      const stored = localStorage.getItem(storageKey);
      const data = stored ? JSON.parse(stored) : [];
      setFavorites(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[useFavorites] Load error:", err);
      setFavorites([]);
    } finally {
      setIsLoading(false);
    }
  }, [storageKey]);

  // Load on mount
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey) {
        loadFavorites();
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [storageKey, loadFavorites]);

  // Add card to favorites
  const addFavorite = useCallback(
    async (cardId: string, cardName: string) => {
      try {
        const isCurrent = favorites.some((f) => f.cardId === cardId);
        if (isCurrent) return true;

        if (favorites.length >= 20) {
          setError("Maximum 20 favorites per game mode");
          return false;
        }

        const newFavorite: CardClashFavorite = {
          id: `${cardId}-${Date.now()}`,
          cardId,
          cardName,
          gameMode,
          addedAt: new Date().toISOString(),
        };

        const updated = [...favorites, newFavorite];
        setFavorites(updated);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("[useFavorites] Add error:", err);
        return false;
      }
    },
    [favorites, gameMode, storageKey]
  );

  // Remove card from favorites
  const removeFavorite = useCallback(
    async (cardId: string) => {
      try {
        const updated = favorites.filter((f) => f.cardId !== cardId);
        setFavorites(updated);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("[useFavorites] Remove error:", err);
        return false;
      }
    },
    [favorites, storageKey]
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
      setFavorites([]);
      localStorage.setItem(storageKey, JSON.stringify([]));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[useFavorites] Clear error:", err);
      return false;
    }
  }, [storageKey]);

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
