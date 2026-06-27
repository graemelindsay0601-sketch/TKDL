import { useState, useEffect, useCallback } from 'react';

interface EquipmentPreference {
  playerId: number;
  goodCardsPerMatch: number;
  badCardsPerMatch: number;
}

export function useEquipmentPreference(playerId: number) {
  const [preference, setPreference] = useState<EquipmentPreference>({
    playerId,
    goodCardsPerMatch: 2,
    badCardsPerMatch: 2,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preference on mount
  useEffect(() => {
    loadPreference();
  }, [playerId]);

  const loadPreference = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/card-clash/player/${playerId}/equipment-preference`);
      const data = await response.json();
      console.log(`[useEquipmentPreference] Loaded preference:`, data);
      setPreference(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load equipment preference:', err);
      setError('Failed to load preferences');
      // Use defaults on error
      setPreference({
        playerId,
        goodCardsPerMatch: 2,
        badCardsPerMatch: 2,
      });
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  const savePreference = useCallback(
    async (goodCards: number, badCards: number) => {
      try {
        setError(null);
        const response = await fetch(`/api/card-clash/player/${playerId}/equipment-preference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goodCardsPerMatch: goodCards,
            badCardsPerMatch: badCards,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save preference');
        }

        const data = await response.json();
        setPreference({
          playerId,
          goodCardsPerMatch: data.goodCardsPerMatch,
          badCardsPerMatch: data.badCardsPerMatch,
        });

        return true;
      } catch (err) {
        console.error('Failed to save equipment preference:', err);
        setError('Failed to save preferences');
        return false;
      }
    },
    [playerId]
  );

  return {
    preference,
    loading,
    error,
    savePreference,
    reload: loadPreference,
  };
}
