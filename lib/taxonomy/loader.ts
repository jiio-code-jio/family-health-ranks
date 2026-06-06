/**
 * Shared nutrition value types.
 *
 * This module used to be an in-memory cache of the `food_items` taxonomy. That
 * table has been removed — the app now relies entirely on the LLM's own
 * per-100g macro estimates (Gemini, escalating to OpenAI). Only the value types
 * survive here; many modules import them from this path.
 */

export type Per100g = {
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sat_fat_g: number
  sugar_g: number
  sodium_mg: number
  kcal: number
}

export type QualityTier = 'whole_foods' | 'mixed' | 'processed' | 'ultra_processed'
export type Category =
  | 'grain' | 'protein' | 'vegetable' | 'fruit' | 'dairy'
  | 'snack' | 'beverage' | 'mixed_dish' | 'fat_oil' | 'sweet'
