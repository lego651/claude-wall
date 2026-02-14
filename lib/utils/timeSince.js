/**
 * Time Since Utility
 * 
 * PP2-013: Client-side utility for human-readable time differences
 * 
 * Usage:
 *   import { timeSince } from '@/lib/utils/timeSince';
 *   timeSince('2026-01-20T10:30:00Z') // "2h 15m"
 */

/**
 * Calculate human-readable time since a timestamp
 * 
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @returns {string} Human-readable time (e.g., "4h 8m", "2d 5hr")
 */
export function timeSince(timestamp) {
  if (!timestamp) return 'N/A';

  try {
    const then = new Date(timestamp);
    const now = new Date();
    const diffMs = now - then;

    // Handle future dates or invalid timestamps
    if (diffMs < 0 || isNaN(diffMs)) {
      return 'N/A';
    }

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    // More than 7 days: show date
    if (days > 7) {
      return then.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: then.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }

    // More than 24 hours: show days and hours
    if (days > 0) {
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}hr`;
    }

    // More than 1 hour: show hours and minutes
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }

    // Less than 1 hour: show minutes
    if (minutes > 0) {
      return `${minutes}m`;
    }

    // Less than 1 minute
    return 'Just now';
  } catch {
    return 'N/A';
  }
}

/**
 * Short format time since (compact)
 * 
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @returns {string} Compact time (e.g., "4h", "2d", "15m")
 */
export function timeSinceShort(timestamp) {
  if (!timestamp) return 'N/A';

  try {
    const then = new Date(timestamp);
    const now = new Date();
    const diffMs = now - then;

    if (diffMs < 0 || isNaN(diffMs)) {
      return 'N/A';
    }

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  } catch {
    return 'N/A';
  }
}
