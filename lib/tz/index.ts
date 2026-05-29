import { formatInTimeZone } from 'date-fns-tz'

/**
 * Bucket a UTC timestamp into a calendar date in the user's local timezone.
 * Returns 'YYYY-MM-DD' suitable for the meals.user_local_date column.
 *
 * Always derive at insert time from the user's stored IANA timezone — never
 * trust client-supplied local dates (clock drift, tz spoofing).
 */
export function userLocalDate(eatenAt: Date | string, timezone: string): string {
  const dt = typeof eatenAt === 'string' ? new Date(eatenAt) : eatenAt
  return formatInTimeZone(dt, timezone, 'yyyy-MM-dd')
}
