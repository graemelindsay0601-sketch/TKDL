import { useState, useEffect } from 'react';

export interface CardClashSettings {
  equipable_good_cards: number;
  equipable_bad_cards: number;
  card_clash_enabled: boolean;
  practice_mode_enabled: boolean;
  practice_reward_multiplier: number;
  min_cards_per_type: number;
  max_cards_per_type: number;
}

const DEFAULT_SETTINGS: CardClashSettings = {
  equipable_good_cards: 2,
  equipable_bad_cards: 2,
  card_clash_enabled: true,
  practice_mode_enabled: true,
  practice_reward_multiplier: 0.5,
  min_cards_per_type: 1,
  max_cards_per_type: 5,
};

/**
 * useCardClashSettings Hook
 * 
 * Loads Card Clash game settings from the API
 * Falls back to defaults if API fails
 * 
 * Usage:
 * const { settings, loading, error, refetch } = useCardClashSettings();
 */
export function useCardClashSettings() {
  const [settings, setSettings] = useState<CardClashSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/card-clash/settings');
      if (!response.ok) throw new Error('Failed to load settings');

      const data = await response.json();
      setSettings(data.settings || DEFAULT_SETTINGS);
    } catch (err) {
      console.error('Error loading Card Clash settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      // Fall back to defaults
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const refetch = loadSettings;

  return { settings, loading, error, refetch };
}

/**
 * Updates Card Clash settings (admin only)
 * 
 * Usage:
 * const result = await updateCardClashSettings({
 *   equipable_good_cards: 3,
 *   equipable_bad_cards: 3,
 *   adminPin: '0601'
 * });
 */
export async function updateCardClashSettings(
  updates: Partial<CardClashSettings> & { adminPin: string },
  notes?: string
) {
  try {
    const response = await fetch('/api/card-clash/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...updates,
        notes,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update settings');
    }

    return await response.json();
  } catch (err) {
    console.error('Error updating settings:', err);
    throw err;
  }
}
