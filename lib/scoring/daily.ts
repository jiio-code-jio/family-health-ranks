/**
 * Daily aggregate — the 5-component formula.
 *
 *   DailyScore =
 *     0.40 × Nutrition       (avg of today's per-meal scores)
 *   + 0.25 × GoalAlignment   (how well daily totals match user's kcal + protein targets)
 *   + 0.15 × MealTiming      (still a 100 placeholder; activated in a later v2 step)
 *   + 0.10 × Hydration       (v2: water_ml / target, capped at 100)
 *   + 0.10 × Consistency     (meal_count vs expected 3-4)
 *
 * MealTiming still washes out as a flat 100 (everyone gets the same 15 points)
 * so it doesn't distort the leaderboard. Hydration is now a real input fed from
 * the day's logged water.
 */

import type { Per100g } from '@/lib/taxonomy/loader'
import { hydrationScore } from '@/lib/hydration'

export type DailyComponents = {
  nutrition: number
  goal_alignment: number
  meal_timing: number
  hydration: number
  consistency: number
  total_score: number
  meal_count: number
}

export type UserTargets = {
  daily_kcal_target: number
  daily_protein_target_g: number
}

export type HydrationInput = {
  water_ml: number
  target_ml: number
}

const EXPECTED_MEALS = 3
const W = { nutrition: 0.40, goal: 0.25, timing: 0.15, hydration: 0.10, consistency: 0.10 }

export function computeDaily(
  mealScores: number[],
  dailyMacros: Per100g,
  user: UserTargets,
  hydration_input: HydrationInput,
): DailyComponents {
  const nutrition = mealScores.length > 0 ? round1(mean(mealScores)) : 0

  const goal_alignment = round1(computeGoalAlignment(dailyMacros, user))
  const meal_timing = 100 // still a placeholder — activated in a later v2 step
  const hydration   = round1(hydrationScore(hydration_input.water_ml, hydration_input.target_ml))
  const consistency = round1(Math.min(100, (mealScores.length / EXPECTED_MEALS) * 100))

  const total_score = round1(
    W.nutrition   * nutrition +
    W.goal        * goal_alignment +
    W.timing      * meal_timing +
    W.hydration   * hydration +
    W.consistency * consistency
  )

  return {
    nutrition, goal_alignment, meal_timing, hydration, consistency,
    total_score, meal_count: mealScores.length,
  }
}

function computeGoalAlignment(d: Per100g, u: UserTargets): number {
  // Split-meal safe: only looks at the day's running totals, not per-meal expectations.
  if (u.daily_kcal_target <= 0 || u.daily_protein_target_g <= 0) return 0
  const kcalMatch    = clamp(0, 100, 100 - Math.abs(d.kcal      - u.daily_kcal_target)      / u.daily_kcal_target      * 200)
  const proteinMatch = clamp(0, 100, 100 - Math.abs(d.protein_g - u.daily_protein_target_g) / u.daily_protein_target_g * 150)
  return 0.6 * kcalMatch + 0.4 * proteinMatch
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}
function clamp(lo: number, hi: number, x: number): number {
  return Math.max(lo, Math.min(hi, x))
}
function round1(n: number): number {
  return Math.round(n * 10) / 10
}
