/**
 * Per-meal deterministic 0-100 score.
 *
 * Inputs come ONLY from the food on the plate — never from the user's daily
 * targets or meal-type expectations. This is on purpose: splitting one meal
 * across two photos (main plate then a side dish) must not be double-penalized.
 * All goal-vs-actual logic lives in the daily rollup (lib/scoring/daily.ts).
 *
 * Sum of positives − sum of negatives → piecewise normalize:
 *   raw ≤ -30        → 5
 *   -30 < raw ≤ 0    → linear 5 → 35
 *   0 < raw ≤ 40     → linear 35 → 75
 *   40 < raw ≤ 80    → linear 75 → 95
 *   raw > 80         → linear 95 → 100 (clamped)
 *
 * Typical balanced meal lands 65-80; ultra-processed indulgence 10-25.
 */

import type { Per100g, Category, QualityTier } from '@/lib/taxonomy/loader'

/**
 * The minimum a scorer needs from each item: its quality tier and category.
 * Both taxonomy items and LLM-estimate items satisfy this, so the scorer
 * doesn't care which source produced them.
 */
export type ScorableItem = { quality_tier: QualityTier; category: Category }

export type MealScoreBreakdown = {
  protein: number
  fiber: number
  quality: number
  vegetable: number
  fruit: number
  sugar: number
  sat_fat: number
  sodium: number
  raw: number
  final: number
}

const QUALITY_BONUS = {
  whole_foods:     +15,
  mixed:           +5,
  processed:       -12,
  ultra_processed: -30,
} as const

export function computeMealScore(macros: Per100g, foods: ScorableItem[]): { score: number; breakdown: MealScoreBreakdown } {
  // ---- positives (each capped) ----
  const protein   = cap(0, 35, macros.protein_g * 1)
  const fiber     = cap(0, 30, macros.fiber_g   * 3)
  const vegetable = foods.some((f) => f.category === 'vegetable') ? 8 : 0
  const fruit     = foods.some((f) => f.category === 'fruit') ? 6 : 0

  // ---- quality: take the WORST tier present in the meal ----
  const tiers = new Set(foods.map((f) => f.quality_tier))
  const quality =
    tiers.has('ultra_processed') ? QUALITY_BONUS.ultra_processed :
    tiers.has('processed')       ? QUALITY_BONUS.processed :
    tiers.has('mixed')           ? QUALITY_BONUS.mixed :
    tiers.has('whole_foods')     ? QUALITY_BONUS.whole_foods :
                                   0

  // ---- negatives (each capped, stored as negative numbers) ----
  const sugar   = -cap(0, 30, macros.sugar_g   * 3)
  const sat_fat = -cap(0, 20, macros.sat_fat_g * 2)
  const sodiumOver = Math.max(0, macros.sodium_mg - 600)
  const sodium  = -cap(0, 15, sodiumOver / 100)

  const raw = protein + fiber + quality + vegetable + fruit + sugar + sat_fat + sodium
  const final = normalize(raw)

  return {
    score: final,
    breakdown: { protein, fiber, quality, vegetable, fruit, sugar, sat_fat, sodium, raw, final },
  }
}

function cap(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalize(raw: number): number {
  if (raw <= -30) return 5
  if (raw <= 0)   return round1(5  + ((raw + 30) / 30) * 30)   // -30..0 → 5..35
  if (raw <= 40)  return round1(35 + (raw / 40) * 40)          // 0..40  → 35..75
  if (raw <= 80)  return round1(75 + ((raw - 40) / 40) * 20)   // 40..80 → 75..95
  if (raw <= 120) return round1(95 + ((raw - 80) / 40) * 5)    // 80..120 → 95..100
  return 100
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
