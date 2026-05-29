/**
 * Daily kcal + protein targets from user profile. Mifflin-St Jeor BMR is the
 * 2024 ADA-recommended formula for adults (more accurate than Harris-Benedict).
 *
 *   BMR (male)   = 10·kg + 6.25·cm − 5·age + 5
 *   BMR (female) = 10·kg + 6.25·cm − 5·age − 161
 *
 * TDEE = BMR × activity factor. Goal applies a ±400 kcal adjustment.
 * Protein target: 1.6 g/kg for lose/gain (preserves lean mass + supports
 * growth), 1.2 g/kg for maintain (general adult RDA-plus).
 */

export type Goal = 'lose' | 'maintain' | 'gain'
export type Gender = 'male' | 'female' | 'other'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary:    1.2,
  light:        1.375,
  moderate:     1.55,
  active:       1.725,
  very_active:  1.9,
}

const GOAL_KCAL_ADJUSTMENT: Record<Goal, number> = {
  lose:     -400,
  maintain:  0,
  gain:     +400,
}

export interface ProfileInput {
  age: number
  gender: Gender
  height_cm: number
  weight_kg: number
  activity_level: Activity
  goal: Goal
}

export interface Targets {
  daily_kcal_target: number
  daily_protein_target_g: number
}

export function computeTargets(p: ProfileInput): Targets {
  const baseBmr = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age
  const bmr = p.gender === 'female' ? baseBmr - 161 : baseBmr + 5 // 'other' uses male formula as a midpoint
  const tdee = bmr * ACTIVITY_FACTOR[p.activity_level]
  const kcal = Math.round(tdee + GOAL_KCAL_ADJUSTMENT[p.goal])

  const proteinPerKg = p.goal === 'maintain' ? 1.2 : 1.6
  const protein = Math.round(p.weight_kg * proteinPerKg)

  return { daily_kcal_target: kcal, daily_protein_target_g: protein }
}
