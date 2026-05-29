/**
 * Weekly personalized tips (Groq Llama 3.3 70B).
 *
 * Once per ISO week per user we generate 3 concrete, actionable tips based on
 * the last 7 days of scores + macros and the user's goal. To keep tips
 * non-repetitive, the previous 4 weeks' tips are fed into the prompt with an
 * explicit "do not repeat these" instruction.
 *
 * Generation is triggered from the daily cron (Vercel Hobby allows one cron a
 * day; we piggyback). The dashboard only READS the current week's row.
 */

import { addDays, format, parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { adminClient } from '@/lib/supabase/admin'
import { groqJson, groqConfigured, GROQ_MODEL } from '@/lib/llm/groq'
import { waterTargetMl } from '@/lib/hydration'
import { log } from '@/lib/log'

export type WeeklyTips = {
  week_start: string
  tips: string[]
  weakest_component: string | null
}

const COMPONENT_LABELS: Record<string, string> = {
  nutrition: 'meal nutrition quality',
  goal_alignment: 'calorie & protein goal alignment',
  hydration: 'hydration',
  consistency: 'logging consistency',
}

/** Monday (user-local) of the week containing `now`, as 'yyyy-MM-dd'. */
export function weekStartFor(now: Date, timezone: string): string {
  const todayLocal = formatInTimeZone(now, timezone, 'yyyy-MM-dd')
  const isoDow = Number(formatInTimeZone(now, timezone, 'i')) // 1 = Mon … 7 = Sun
  return format(addDays(parseISO(todayLocal), -(isoDow - 1)), 'yyyy-MM-dd')
}

/** Read the current week's tips for the dashboard. Never generates. */
export async function fetchCurrentWeekTips(userId: string, timezone: string): Promise<WeeklyTips | null> {
  const weekStart = weekStartFor(new Date(), timezone)
  const { data } = await adminClient()
    .from('weekly_tips')
    .select('week_start, tips, weakest_component')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle()
  if (!data) return null
  return {
    week_start: data.week_start as string,
    tips: (data.tips as string[]) ?? [],
    weakest_component: (data.weakest_component as string | null) ?? null,
  }
}

/**
 * Generate (and persist) this week's tips for one user if they don't exist yet
 * and there's enough recent data to advise on. Idempotent — safe to call from a
 * cron that may run more than once.
 */
export async function generateWeeklyTipsForUser(userId: string): Promise<WeeklyTips | null> {
  if (!groqConfigured()) return null
  const supabase = adminClient()

  const { data: user } = await supabase
    .from('users')
    .select('display_name, timezone, goal, age, gender, weight_kg, daily_kcal_target, daily_protein_target_g')
    .eq('id', userId)
    .single()
  if (!user) return null

  const weekStart = weekStartFor(new Date(), user.timezone)

  // Already generated this week → return existing, don't re-spend.
  const { data: existing } = await supabase
    .from('weekly_tips')
    .select('week_start, tips, weakest_component')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle()
  if (existing) {
    return {
      week_start: existing.week_start as string,
      tips: (existing.tips as string[]) ?? [],
      weakest_component: (existing.weakest_component as string | null) ?? null,
    }
  }

  // Last 7 calendar dates ending today (user-local).
  const dates: string[] = []
  for (let i = 6; i >= 0; i--) {
    dates.push(formatInTimeZone(new Date(Date.now() - i * 86400000), user.timezone, 'yyyy-MM-dd'))
  }

  const [{ data: scores }, { data: meals }, { data: priorRows }] = await Promise.all([
    supabase
      .from('daily_scores')
      .select('user_local_date, nutrition, goal_alignment, hydration, consistency, total_score, meal_count')
      .eq('user_id', userId)
      .in('user_local_date', dates),
    supabase
      .from('meals')
      .select('macros, user_local_date')
      .eq('user_id', userId)
      .in('user_local_date', dates)
      .eq('processing_status', 'scored'),
    supabase
      .from('weekly_tips')
      .select('tips, week_start')
      .eq('user_id', userId)
      .lt('week_start', weekStart)
      .order('week_start', { ascending: false })
      .limit(4),
  ])

  const daysLogged = scores?.length ?? 0
  if (daysLogged === 0) {
    log.info('tips.generate', 'skipped — no logged days', { user_id: userId, week_start: weekStart })
    return null
  }

  // Average each component over the days that have data.
  const avg = (key: 'nutrition' | 'goal_alignment' | 'hydration' | 'consistency') =>
    (scores ?? []).reduce((s, r) => s + Number(r[key] ?? 0), 0) / daysLogged

  const componentAverages = {
    nutrition: avg('nutrition'),
    goal_alignment: avg('goal_alignment'),
    hydration: avg('hydration'),
    consistency: avg('consistency'),
  }
  const weakestKey = (Object.entries(componentAverages).sort((a, b) => a[1] - b[1])[0]?.[0]) ?? null
  const avgTotal = (scores ?? []).reduce((s, r) => s + Number(r.total_score ?? 0), 0) / daysLogged

  // Average daily macros over the days that had meals.
  const mealDays = new Set((meals ?? []).map((m) => m.user_local_date as string)).size || 1
  const macroTotals = (meals ?? []).reduce(
    (acc, m) => {
      const mac = (m.macros ?? {}) as { kcal?: number; protein_g?: number }
      acc.kcal += Number(mac.kcal ?? 0)
      acc.protein += Number(mac.protein_g ?? 0)
      return acc
    },
    { kcal: 0, protein: 0 },
  )
  const avgKcal = Math.round(macroTotals.kcal / mealDays)
  const avgProtein = Math.round(macroTotals.protein / mealDays)

  const priorTips = (priorRows ?? []).flatMap((r) => (r.tips as string[]) ?? [])

  const systemPrompt =
    'You are a warm, practical nutrition coach for a family healthy-eating app. ' +
    'You give short, specific, non-judgmental advice. Always reply with a single JSON object ' +
    'of the exact shape {"tips": ["tip1", "tip2", "tip3"]}. Exactly 3 tips. ' +
    'Each tip must be concrete and actionable (name specific foods, swaps, or amounts) — ' +
    'never vague ("eat healthier", "drink more"). Keep each tip under 140 characters. ' +
    'Do NOT repeat, paraphrase, or restate any tip from the "previously given tips" list.'

  const userPrompt = [
    `Person: ${user.display_name}, goal: ${user.goal ?? 'maintain'}, ` +
      `daily target ${Math.round(Number(user.daily_kcal_target ?? 0))} kcal / ${Math.round(Number(user.daily_protein_target_g ?? 0))} g protein, ` +
      `water target ${waterTargetMl(user.weight_kg)} ml.`,
    '',
    `Last 7 days (${daysLogged} days logged):`,
    `- Average daily score: ${avgTotal.toFixed(0)}/100`,
    `- Meal nutrition quality: ${componentAverages.nutrition.toFixed(0)}/100`,
    `- Calorie & protein goal alignment: ${componentAverages.goal_alignment.toFixed(0)}/100`,
    `- Hydration: ${componentAverages.hydration.toFixed(0)}/100`,
    `- Logging consistency: ${componentAverages.consistency.toFixed(0)}/100`,
    `- Average intake on days they ate: ~${avgKcal} kcal, ~${avgProtein} g protein`,
    `- Weakest area: ${weakestKey ? COMPONENT_LABELS[weakestKey] : 'n/a'}`,
    '',
    priorTips.length > 0
      ? `Previously given tips (DO NOT repeat or rephrase any of these):\n${priorTips.map((t) => `- ${t}`).join('\n')}`
      : 'No previous tips yet.',
    '',
    `Write 3 fresh tips for next week. Prioritize their weakest area (${weakestKey ? COMPONENT_LABELS[weakestKey] : 'overall balance'}) and their ${user.goal ?? 'maintain'} goal.`,
  ].join('\n')

  let parsed: { tips?: unknown }
  try {
    parsed = await groqJson<{ tips?: unknown }>(systemPrompt, userPrompt)
  } catch (err) {
    log.error('tips.generate', 'groq call failed', { user_id: userId, error: err instanceof Error ? err.message : String(err) })
    return null
  }

  const tips = Array.isArray(parsed.tips)
    ? parsed.tips.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 3)
    : []
  if (tips.length === 0) {
    log.warn('tips.generate', 'groq returned no usable tips', { user_id: userId })
    return null
  }

  const { error: insErr } = await supabase.from('weekly_tips').insert({
    user_id: userId,
    week_start: weekStart,
    tips,
    weakest_component: weakestKey,
    model: GROQ_MODEL,
  })
  if (insErr) {
    // Unique violation = another invocation beat us to it. Re-read and return.
    if (insErr.code === '23505') return fetchCurrentWeekTips(userId, user.timezone)
    log.error('tips.generate', 'insert failed', { user_id: userId, error: insErr.message })
    return null
  }

  log.info('tips.generate', 'generated', { user_id: userId, week_start: weekStart, count: tips.length, weakest: weakestKey })
  return { week_start: weekStart, tips, weakest_component: weakestKey }
}

/** Cron entry point: generate this week's tips for every user that needs them. */
export async function generateWeeklyTipsForAllUsers(): Promise<{ generated: number; skipped: number }> {
  if (!groqConfigured()) return { generated: 0, skipped: 0 }
  const { data: users } = await adminClient().from('users').select('id')
  let generated = 0
  let skipped = 0
  for (const u of users ?? []) {
    try {
      const result = await generateWeeklyTipsForUser(u.id as string)
      if (result) generated++
      else skipped++
    } catch (err) {
      skipped++
      log.error('tips.generate', 'per-user failure', { user_id: u.id, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return { generated, skipped }
}
