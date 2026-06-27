import { useState, useEffect, useCallback } from 'react';

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
 * useFavorites Hook
 * 
 * Manages favorite card state and provides utilities for:
 * - Loading favorites from server
 * - Toggling favorite status
 * - Sorting cards with favorites first
 * 
 * Usage:
 * const {
 *   favorites,
 *   isFavorite,
 *   toggleFavorite,
 *   sortedCards,
 *   loading
 * } = useFavorites(playerId, initialCards);
 */
export function useFavorites(playerId: number, cards: CardWithFavorite[]) {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load favorites from server on mount
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
        console.error('Failed to load favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    if (playerId) {
      loadFavorites();
    }
  }, [playerId]);

  // Check if a card is favorited
  const isFavorite = useCallback(
    (cardId: number): boolean => favorites.has(cardId),
    [favorites]
  );

  // Toggle favorite status
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
        console.error('Failed to toggle favorite:', error);
        return false;
      }
    },
    [playerId, favorites]
  );

  // Sort cards with favorites first
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
