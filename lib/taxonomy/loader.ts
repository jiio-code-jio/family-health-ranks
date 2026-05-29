/**
 * In-memory cache of food_items. The table is tiny (~80 rows) and read-only
 * at runtime, so we load once per server process. Embeddings are excluded —
 * the resolver uses pgvector directly, the read path here doesn't need them.
 */

import { adminClient } from '@/lib/supabase/admin'

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

export type CachedFood = {
  id: string
  display_name: string
  aliases: string[]
  category: Category
  per_100g: Per100g
  quality_tier: QualityTier
  micronutrient_tags: string[]
  default_portion_g: { small: number; medium: number; large: number }
}

let _list: CachedFood[] | null = null
let _byId: Map<string, CachedFood> | null = null
let _loading: Promise<void> | null = null

async function load(): Promise<void> {
  if (_list) return
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('food_items')
    .select('id, display_name, aliases, category, per_100g, quality_tier, micronutrient_tags, default_portion_g')
  if (error) throw new Error(`taxonomy load: ${error.message}`)
  _list = (data ?? []) as CachedFood[]
  _byId = new Map(_list.map((f) => [f.id, f]))
}

async function ensure(): Promise<void> {
  if (_list) return
  if (!_loading) _loading = load().finally(() => { _loading = null })
  await _loading
}

export async function allFoods(): Promise<CachedFood[]> {
  await ensure()
  return _list!
}

export async function foodById(id: string): Promise<CachedFood | null> {
  await ensure()
  return _byId!.get(id) ?? null
}

export async function foodsById(ids: string[]): Promise<CachedFood[]> {
  await ensure()
  return ids.map((id) => _byId!.get(id)).filter((f): f is CachedFood => !!f)
}

/** Force a re-fetch on next call (use after taxonomy edits). */
export function invalidateTaxonomyCache(): void {
  _list = null
  _byId = null
}

/**
 * Cheap in-memory text search across display_name + aliases.
 *
 * Token-overlap scoring: split the query into 3+ char tokens, count how many
 * appear in each food's haystack, normalise. Used as a fallback when the
 * vector resolver fails (Gemini 503 etc.) so we can still show the user
 * plausible candidates instead of an empty chip with just "Search all foods".
 *
 * Not as good as semantic search, but works without external services and is
 * essentially free at our taxonomy size (~100 rows).
 */
export async function searchByText(
  query: string,
  limit = 5,
): Promise<Array<{ food_id: string; display_name: string; similarity: number }>> {
  await ensure()
  if (!_list) return []
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3)
  if (tokens.length === 0) return []

  const scored = _list.map((f) => {
    const haystack = (f.display_name + ' ' + f.aliases.join(' ')).toLowerCase()
    let hits = 0
    for (const t of tokens) if (haystack.includes(t)) hits++
    return { food_id: f.id, display_name: f.display_name, similarity: hits / tokens.length }
  })
  return scored.filter((s) => s.similarity > 0).sort((a, b) => b.similarity - a.similarity).slice(0, limit)
}
