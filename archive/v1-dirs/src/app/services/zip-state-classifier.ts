/**
 * ZIP State Classification Service
 *
 * Derives ZIP data state at runtime - never stored in database.
 * Enforces read-first / reuse-first doctrine.
 */

export type ZipDataState = 'KNOWN' | 'STALE' | 'UNKNOWN';

const STALE_THRESHOLD_DAYS = 30;

/**
 * Classify ZIP data state based on facility count and data age.
 *
 * - UNKNOWN: No facilities recorded
 * - STALE: Facilities exist but data is >30 days old
 * - KNOWN: Facilities exist and data is recent
 */
export function classifyZipState(
  facilityCount: number,
  oldestSeenAt: string | Date | null
): ZipDataState {
  if (facilityCount === 0) return 'UNKNOWN';
  if (!oldestSeenAt) return 'KNOWN';

  const seenDate = typeof oldestSeenAt === 'string' ? new Date(oldestSeenAt) : oldestSeenAt;
  const daysSinceSeen = Math.floor(
    (Date.now() - seenDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceSeen > STALE_THRESHOLD_DAYS ? 'STALE' : 'KNOWN';
}

/**
 * Calculate data age in days from the oldest seen date.
 */
export function calculateDataAgeDays(oldestSeenAt: string | Date | null): number | null {
  if (!oldestSeenAt) return null;

  const seenDate = typeof oldestSeenAt === 'string' ? new Date(oldestSeenAt) : oldestSeenAt;
  return Math.floor((Date.now() - seenDate.getTime()) / (1000 * 60 * 60 * 24));
}
