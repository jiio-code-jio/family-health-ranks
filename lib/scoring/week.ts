/**
 * Fetch the last 7 days of daily_scores for a user, returned as a fixed-length
 * array (oldest → newest) so the UI can render the strip without worrying about
 * missing days.
 */

import { formatInTimeZone } from 'date-fns-tz'
import { adminClient } from '@/lib/supabase/admin'
import type { DayCell } from '@/components/WeekStrip'

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function fetchWeekStrip(userId: string, timezone: string): Promise<DayCell[]> {
  const today = new Date()
  const todayStr = formatInTimeZone(today, timezone, 'yyyy-MM-dd')

  // Build the 7 calendar dates ending today in the user's tz.
  // We add 12 h before subtracting whole-day milliseconds to avoid DST edge cases
  // pushing us into the wrong calendar date — formatInTimeZone bucketing then
  // canonicalizes it.
  const days: { date: string; weekday: string; isToday: boolean }[] = []
  for (let i = 6; i >= 0; i--) {
    const t = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const date = formatInTimeZone(t, timezone, 'yyyy-MM-dd')
    const wd = WEEKDAY[Number(formatInTimeZone(t, timezone, 'i')) % 7]
    days.push({ date, weekday: wd, isToday: date === todayStr })
  }

  const supabase = adminClient()
  const { data: rows } = await supabase
    .from('daily_scores')
    .select('user_local_date, total_score')
    .eq('user_id', userId)
    .in('user_local_date', days.map((d) => d.date))

  const scoreByDate = new Map<string, number>()
  for (const r of rows ?? []) scoreByDate.set(r.user_local_date as string, Number(r.total_score))

  return days.map((d) => ({
    ...d,
    score: scoreByDate.has(d.date) ? scoreByDate.get(d.date)! : null,
  }))
}
