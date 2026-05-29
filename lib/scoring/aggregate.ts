/**
 * After every meal confirm (or delete), recompute and upsert the user's
 * daily_scores row for that day. Idempotent — pulls all scored meals for
 * the day fresh and recomputes from scratch.
 */

import { adminClient } from '@/lib/supabase/admin'
import { computeDaily, type DailyComponents } from './daily'
import { EMPTY_MACROS } from '@/lib/taxonomy/macros'
import { waterTargetMl } from '@/lib/hydration'
import type { Per100g } from '@/lib/taxonomy/loader'

export async function recomputeDaily(userId: string, userLocalDate: string): Promise<DailyComponents> {
  const supabase = adminClient()

  const [{ data: user }, { data: meals }, { data: water }] = await Promise.all([
    supabase
      .from('users')
      .select('daily_kcal_target, daily_protein_target_g, weight_kg')
      .eq('id', userId)
      .single(),
    supabase
      .from('meals')
      .select('score, macros')
      .eq('user_id', userId)
      .eq('user_local_date', userLocalDate)
      .eq('processing_status', 'scored'),
    supabase
      .from('daily_water')
      .select('ml')
      .eq('user_id', userId)
      .eq('user_local_date', userLocalDate)
      .maybeSingle(),
  ])

  const targets = {
    daily_kcal_target: Number(user?.daily_kcal_target ?? 0),
    daily_protein_target_g: Number(user?.daily_protein_target_g ?? 0),
  }
  const hydrationInput = {
    water_ml: Number(water?.ml ?? 0),
    target_ml: waterTargetMl(user?.weight_kg),
  }

  const mealScores: number[] = []
  const totals: Per100g = { ...EMPTY_MACROS }
  for (const m of meals ?? []) {
    if (m.score !== null) mealScores.push(Number(m.score))
    const mac = (m.macros ?? {}) as Partial<Per100g>
    totals.kcal      += Number(mac.kcal      ?? 0)
    totals.protein_g += Number(mac.protein_g ?? 0)
    totals.carbs_g   += Number(mac.carbs_g   ?? 0)
    totals.fat_g     += Number(mac.fat_g     ?? 0)
    totals.fiber_g   += Number(mac.fiber_g   ?? 0)
    totals.sat_fat_g += Number(mac.sat_fat_g ?? 0)
    totals.sugar_g   += Number(mac.sugar_g   ?? 0)
    totals.sodium_mg += Number(mac.sodium_mg ?? 0)
  }

  const daily = computeDaily(mealScores, totals, targets, hydrationInput)

  const { error } = await supabase.from('daily_scores').upsert({
    user_id: userId,
    user_local_date: userLocalDate,
    nutrition:      daily.nutrition,
    goal_alignment: daily.goal_alignment,
    meal_timing:    daily.meal_timing,
    hydration:      daily.hydration,
    consistency:    daily.consistency,
    total_score:    daily.total_score,
    meal_count:     daily.meal_count,
    updated_at:     new Date().toISOString(),
  }, { onConflict: 'user_id,user_local_date' })

  if (error) throw new Error(`daily_scores upsert: ${error.message}`)
  return daily
}
