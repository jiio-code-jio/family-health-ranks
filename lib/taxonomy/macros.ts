import type { Per100g, Category, QualityTier } from './loader'

/**
 * A confirmed food item. With the taxonomy removed, every item carries the
 * model's own per-100g macros + classification, so re-scoring is deterministic
 * (same input → same output) once the values are locked in at confirm time.
 */
export type ConfirmedFood = {
  display_name: string
  llm_macros_per_100g: Per100g
  llm_category: Category
  llm_quality: QualityTier
  portion_size: 'small' | 'medium' | 'large' | 'custom'
  portion_g: number
}

export const EMPTY_MACROS: Per100g = {
  protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0,
  sat_fat_g: 0, sugar_g: 0, sodium_mg: 0, kcal: 0,
}

export type ScoringItem = {
  display_name: string
  category: Category
  quality_tier: QualityTier
  portion_g: number
}

/**
 * Sum macros across all confirmed foods (scaled by portion) and return the
 * scoring metadata each item contributes, so the scorer doesn't need to look
 * anything up.
 */
export async function aggregateMacros(
  items: ConfirmedFood[],
): Promise<{ macros: Per100g; items: ScoringItem[] }> {
  const macros = { ...EMPTY_MACROS }
  const scoring: ScoringItem[] = []

  for (const item of items) {
    const k = item.portion_g / 100
    addInto(macros, item.llm_macros_per_100g, k)
    scoring.push({
      display_name: item.display_name,
      category:     item.llm_category,
      quality_tier: item.llm_quality,
      portion_g:    item.portion_g,
    })
  }

  return { macros: round(macros), items: scoring }
}

function addInto(target: Per100g, src: Per100g, k: number): void {
  target.protein_g += src.protein_g * k
  target.carbs_g   += src.carbs_g   * k
  target.fat_g     += src.fat_g     * k
  target.fiber_g   += src.fiber_g   * k
  target.sat_fat_g += src.sat_fat_g * k
  target.sugar_g   += src.sugar_g   * k
  target.sodium_mg += src.sodium_mg * k
  target.kcal      += src.kcal      * k
}

function round(m: Per100g): Per100g {
  return {
    protein_g: round1(m.protein_g),
    carbs_g:   round1(m.carbs_g),
    fat_g:     round1(m.fat_g),
    fiber_g:   round1(m.fiber_g),
    sat_fat_g: round1(m.sat_fat_g),
    sugar_g:   round1(m.sugar_g),
    sodium_mg: Math.round(m.sodium_mg),
    kcal:      Math.round(m.kcal),
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
