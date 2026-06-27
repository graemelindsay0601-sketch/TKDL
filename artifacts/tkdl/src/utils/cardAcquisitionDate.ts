/**
 * Card acquisition date utilities
 * 
 * Formats and displays when cards were acquired
 * Shows "New!" badge for recently acquired cards (< 7 days)
 */

/**
 * Format a date as a relative time string
 * e.g., "2 days ago", "Just now", "1 week ago"
 */
export function getRelativeTime(date: Date | string): string {
  const then = new Date(date).getTime();
  const now = Date.now();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;

  return new Date(date).toLocaleDateString();
}

/**
 * Format a date as a full readable string
 * e.g., "June 27, 2026"
 */
export function formatAcquisitionDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Check if a card is "new" (acquired < 7 days ago)
 */
export function isNewCard(acquisitionDate: Date | string): boolean {
  const then = new Date(acquisitionDate).getTime();
  const now = Date.now();
  const diffDays = (now - then) / (1000 * 60 * 60 * 24);
  return diffDays < 7;
}

/**
 * Get formatted badge text for a new card
 */
export function getNewBadgeText(acquisitionDate: Date | string): string {
  if (!isNewCard(acquisitionDate)) return '';

  const then = new Date(acquisitionDate).getTime();
  const now = Date.now();
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '✨ NEW';
  if (diffDays === 1) return '✨ NEW';
  return `✨ ${diffDays}d old`;
}

/**
 * React Hook: useCardAcquisitionDate
 * 
 * Provides formatted acquisition date information for a card
 */
export function useCardAcquisitionDate(acquisitionDate?: Date | string) {
  if (!acquisitionDate) {
    return {
      relativeTime: 'Unknown',
      fullDate: 'Unknown',
      isNew: false,
      badge: '',
    };
  }

  return {
    relativeTime: getRelativeTime(acquisitionDate),
    fullDate: formatAcquisitionDate(acquisitionDate),
    isNew: isNewCard(acquisitionDate),
    badge: getNewBadgeText(acquisitionDate),
  };
}
