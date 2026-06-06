/**
 * Premium re-score for the "this score looks wrong" feedback button.
 *
 * Re-runs the meal photo through the premium model (GPT-4.1 mini), AUTO-adopts
 * the model's identified items (with their own macro estimates) as the new
 * confirmed_foods, and re-scores deterministically. The user doesn't have to
 * re-confirm — that's the whole point of the auto path. They can still open the
 * confirm screen afterwards to hand-tune.
 */

import { adminClient } from '@/lib/supabase/admin'
import { identifyWithOpenAI, openaiConfigured } from './openai'
import { aggregateMacros, type ConfirmedFood } from '@/lib/taxonomy/macros'
import { computeMealScore } from '@/lib/scoring/meal'
import { recomputeDaily } from '@/lib/scoring/aggregate'
import type { DailyComponents } from '@/lib/scoring/daily'
import type { MealScoreBreakdown } from '@/lib/scoring/meal'
import type { Per100g } from '@/lib/taxonomy/loader'
import { log } from '@/lib/log'

const FALLBACK_DEFAULTS = { small: 80, medium: 150, large: 250 }

export type RescoreResult =
  | { ok: true; score: number; breakdown: MealScoreBreakdown; macros: Per100g; daily: DailyComponents }
  | { ok: false; reason: 'not_configured' | 'not_food' | 'no_items' | 'download_failed' }

export async function rescoreMealWithPremium(mealId: string): Promise<RescoreResult> {
  if (!openaiConfigured()) return { ok: false, reason: 'not_configured' }

  const supabase = adminClient()
  const { data: meal } = await supabase
    .from('meals')
    .select('id, user_id, user_local_date, image_path')
    .eq('id', mealId)
    .single()
  if (!meal) return { ok: false, reason: 'download_failed' }

  const { data: blob, error: dlErr } = await supabase.storage.from('meals').download(meal.image_path)
  if (dlErr || !blob) return { ok: false, reason: 'download_failed' }

  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
  const mimeType = blob.type && blob.type !== '' ? blob.type : guessMime(meal.image_path)

  const result = await identifyWithOpenAI(base64, mimeType)
  if (!result.is_food) return { ok: false, reason: 'not_food' }
  if (result.items.length === 0) return { ok: false, reason: 'no_items' }

  // Adopt the model's items directly — macros come from its own estimate.
  const confirmed: ConfirmedFood[] = result.items.map((item) => ({
    display_name: titleCase(item.description),
    llm_macros_per_100g: item.estimated_per_100g,
    llm_category: item.category,
    llm_quality: item.quality_tier,
    portion_size: item.suggested_portion,
    portion_g: FALLBACK_DEFAULTS[item.suggested_portion],
  }))

  const { macros, items: scoringItems } = await aggregateMacros(confirmed)
  const { score, breakdown } = computeMealScore(macros, scoringItems)

  const { error: updErr } = await supabase
    .from('meals')
    .update({
      confirmed_foods: confirmed,
      macros,
      score,
      score_breakdown: breakdown,
      used_premium_model: true,
      processing_status: 'scored',
    })
    .eq('id', mealId)
  if (updErr) throw new Error(`rescore update: ${updErr.message}`)

  const daily = await recomputeDaily(meal.user_id, meal.user_local_date)
  log.info('meals.rescore', 'premium re-score complete', { meal_id: mealId, score, items: confirmed.length })

  return { ok: true, score, breakdown, macros, daily }
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function guessMime(path: string): string {
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.heic')) return 'image/heic'
  return 'image/jpeg'
}
