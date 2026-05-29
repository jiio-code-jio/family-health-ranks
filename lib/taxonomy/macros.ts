import { foodsById, type CachedFood, type Per100g, type Category, type QualityTier } from './loader'

export type ConfirmedFood =
  | TaxonomyConfirmedFood
  | LlmEstimateConfirmedFood

/** A confirmed item that points at a curated taxonomy row. */
export type TaxonomyConfirmedFood = {
  food_id: string
  portion_size: 'small' | 'medium' | 'large' | 'custom'
  portion_g: number
}

/**
 * A confirmed item that the LLM identified but our taxonomy doesn't cover.
 * The LLM's per-100g macros + quality + category are stored on the row itself
 * so re-scoring is deterministic (same input → same output) once we've locked
 * the values in.
 */
export type LlmEstimateConfirmedFood = {
  food_id: null
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
  source: 'taxonomy' | 'llm_estimate'
}

/**
 * Sum macros across all confirmed foods, blending taxonomy + LLM-estimate
 * sources. Returns the scoring metadata each item contributes so the scorer
 * doesn't need to refetch the taxonomy.
 */
export async function aggregateMacros(
  items: ConfirmedFood[],
): Promise<{ macros: Per100g; items: ScoringItem[] }> {
  const taxonomyIds = items
    .filter((i): i is TaxonomyConfirmedFood => i.food_id !== null)
    .map((i) => i.food_id)
  const foods = taxonomyIds.length > 0 ? await foodsById(taxonomyIds) : []
  const byId = new Map(foods.map((f) => [f.id, f]))

  const macros = { ...EMPTY_MACROS }
  const scoring: ScoringItem[] = []

  for (const item of items) {
    const k = item.portion_g / 100

    if (item.food_id !== null) {
      const food = byId.get(item.food_id)
      if (!food) continue // silently skip — confirm route should have validated
      addInto(macros, food.per_100g, k)
      scoring.push({
        display_name: food.display_name,
        category:     food.category,
        quality_tier: food.quality_tier,
        portion_g:    item.portion_g,
        source:       'taxonomy',
      })
    } else {
      addInto(macros, item.llm_macros_per_100g, k)
      scoring.push({
        display_name: item.display_name,
        category:     item.llm_category,
        quality_tier: item.llm_quality,
        portion_g:    item.portion_g,
        source:       'llm_estimate',
      })
    }
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

// Re-export CachedFood so existing imports keep working.
export type { CachedFood }
