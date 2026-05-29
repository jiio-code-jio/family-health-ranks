/**
 * Leaderboard period queries.
 *
 * All periods use the REQUESTER's timezone to compute the date window — so
 * "today" / "this week" / "this month" are anchored to whoever's looking. The
 * row data itself comes from each user's own user_local_date bucketed daily
 * scores, so a user in a different tz still has their day fairly counted.
 *
 * Eligibility thresholds (from the plan):
 *   daily   — meal_count ≥ 2 that day
 *   weekly  — ≥ 5 days logged in the rolling 7-day window
 *   monthly — ≥ 14 days logged in the calendar month
 *   overall — ≥ 14 lifetime days logged
 *
 * Tiebreak: total_score DESC, then meal_count DESC (rewards engagement).
 */

import { formatInTimeZone } from 'date-fns-tz'
import { adminClient } from '@/lib/supabase/admin'

export type Period = 'daily' | 'weekly' | 'monthly' | 'overall'

export type LeaderboardRow = {
  user_id: string
  display_name: string
  score: number
  meal_count: number
  days_logged: number   // 1 for daily, 1..7 for weekly, 1..31 for monthly, lifetime for overall
}

export type LeaderboardResult = {
  period: Period
  period_label: string
  rows: LeaderboardRow[]
  ineligible_count: number
}

const MIN_DAYS = { daily: 1, weekly: 5, monthly: 14, overall: 14 } as const
const MIN_MEALS_FOR_DAILY = 2

export async function fetchLeaderboard(period: Period, requesterTz: string): Promise<LeaderboardResult> {
  const now = new Date()
  const today = formatInTimeZone(now, requesterTz, 'yyyy-MM-dd')

  if (period === 'daily') {
    return await dailyLeaderboard(today)
  }

  const { startDate, label } =
    period === 'weekly'  ? rollingWindow(now, requesterTz, 6, 'Last 7 days') :
    period === 'monthly' ? monthWindow(now, requesterTz) :
                           { startDate: '1970-01-01', label: 'All time' }

  return await rangeLeaderboard(period, startDate, today, label)
}

async function dailyLeaderboard(date: string): Promise<LeaderboardResult> {
  const supabase = adminClient()
  // Pull all of today's daily_scores rows + their user display_name in one join.
  const { data: rows, error } = await supabase
    .from('daily_scores')
    .select('user_id, total_score, meal_count, users!inner(display_name)')
    .eq('user_local_date', date)
    .order('total_score', { ascending: false })
    .order('meal_count',  { ascending: false })
  if (error) throw new Error(`daily leaderboard: ${error.message}`)

  const all = (rows ?? []).map((r) => {
    const u = (r as { users: { display_name: string } | { display_name: string }[] }).users
    const name = Array.isArray(u) ? (u[0]?.display_name ?? '?') : u.display_name
    return {
      user_id:      r.user_id as string,
      display_name: name,
      score:        Number(r.total_score),
      meal_count:   Number(r.meal_count),
      days_logged:  1,
    } satisfies LeaderboardRow
  })

  const eligible   = all.filter((r) => r.meal_count >= MIN_MEALS_FOR_DAILY)
  const ineligible = all.length - eligible.length

  return {
    period: 'daily',
    period_label: `Today · ${date}`,
    rows: eligible,
    ineligible_count: ineligible,
  }
}

async function rangeLeaderboard(period: Period, startDate: string, endDate: string, label: string): Promise<LeaderboardResult> {
  const supabase = adminClient()
  const [{ data: rows, error }, { data: users, error: userErr }] = await Promise.all([
    supabase
      .from('daily_scores')
      .select('user_id, user_local_date, total_score, meal_count')
      .gte('user_local_date', startDate)
      .lte('user_local_date', endDate),
    supabase
      .from('users')
      .select('id, display_name'),
  ])
  if (error)     throw new Error(`range leaderboard: ${error.message}`)
  if (userErr)   throw new Error(`users: ${userErr.message}`)

  const minDays = MIN_DAYS[period]
  const nameById = new Map((users ?? []).map((u) => [u.id as string, u.display_name as string]))

  type Bucket = { scores: number[]; meals: number; dates: Set<string> }
  const byUser = new Map<string, Bucket>()
  for (const r of rows ?? []) {
    const uid = r.user_id as string
    const b = byUser.get(uid) ?? { scores: [], meals: 0, dates: new Set<string>() }
    if (Number(r.meal_count) > 0) {
      b.scores.push(Number(r.total_score))
      b.meals += Number(r.meal_count)
      b.dates.add(r.user_local_date as string)
    }
    byUser.set(uid, b)
  }

  const all: LeaderboardRow[] = []
  let ineligible = 0
  for (const [uid, b] of byUser) {
    if (b.dates.size === 0) continue
    if (b.dates.size < minDays) { ineligible++; continue }
    all.push({
      user_id: uid,
      display_name: nameById.get(uid) ?? '?',
      score:       round1(mean(b.scores)),
      meal_count:  b.meals,
      days_logged: b.dates.size,
    })
  }
  all.sort((a, b) => b.score - a.score || b.meal_count - a.meal_count)

  return { period, period_label: label, rows: all, ineligible_count: ineligible }
}

function rollingWindow(now: Date, tz: string, daysBack: number, label: string) {
  const startMs = now.getTime() - daysBack * 24 * 60 * 60 * 1000
  return { startDate: formatInTimeZone(new Date(startMs), tz, 'yyyy-MM-dd'), label }
}

function monthWindow(now: Date, tz: string) {
  const ym = formatInTimeZone(now, tz, 'yyyy-MM')
  return { startDate: `${ym}-01`, label: formatInTimeZone(now, tz, 'MMMM yyyy') }
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}
function round1(n: number): number { return Math.round(n * 10) / 10 }
