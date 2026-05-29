import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { aggregateMacros, type ConfirmedFood } from '@/lib/taxonomy/macros'
import { computeMealScore } from '@/lib/scoring/meal'
import { recomputeDaily } from '@/lib/scoring/aggregate'
import { foodsById } from '@/lib/taxonomy/loader'
import { log } from '@/lib/log'

export const runtime = 'nodejs'

const Per100g = z.object({
  protein_g: z.number().min(0).max(100),
  carbs_g:   z.number().min(0).max(100),
  fat_g:     z.number().min(0).max(100),
  fiber_g:   z.number().min(0).max(50),
  sat_fat_g: z.number().min(0).max(100),
  sugar_g:   z.number().min(0).max(100),
  sodium_mg: z.number().min(0).max(10000),
  kcal:      z.number().min(0).max(900),
})

const Category = z.enum(['grain', 'protein', 'vegetable', 'fruit', 'dairy', 'snack', 'beverage', 'mixed_dish', 'fat_oil', 'sweet'])
const Quality  = z.enum(['whole_foods', 'mixed', 'processed', 'ultra_processed'])
const PortionSize = z.enum(['small', 'medium', 'large', 'custom'])

// Discriminated union: either a taxonomy reference (food_id) or an LLM-estimate
// blob carrying its own macros + classification.
const ConfirmedFoodSchema = z.union([
  z.object({
    food_id: z.string().min(1).max(64),
    portion_size: PortionSize,
    portion_g: z.number().positive().max(2000),
  }),
  z.object({
    food_id: z.null(),
    display_name: z.string().min(1).max(120),
    llm_macros_per_100g: Per100g,
    llm_category: Category,
    llm_quality: Quality,
    portion_size: PortionSize,
    portion_g: z.number().positive().max(2000),
  }),
])

const Body = z.object({
  confirmed_foods: z.array(ConfirmedFoodSchema).min(1).max(20),
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id: mealId } = await ctx.params

  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch (err) {
    log.warn('meals.confirm', 'invalid request', { meal_id: mealId, error: err instanceof Error ? err.message : 'parse' })
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const supabase = adminClient()
  const { data: meal, error: fetchErr } = await supabase
    .from('meals')
    .select('id, user_id, user_local_date, processing_status')
    .eq('id', mealId)
    .single()
  if (fetchErr || !meal) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (meal.user_id !== sess.sub) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  if (meal.processing_status !== 'awaiting_confirmation' && meal.processing_status !== 'scored') {
    return NextResponse.json({ error: `not_confirmable: status=${meal.processing_status}` }, { status: 409 })
  }

  // Validate every taxonomy food_id actually exists. (LLM-estimate items carry
  // their own data, no taxonomy lookup needed.)
  const taxonomyIds = body.confirmed_foods
    .filter((f): f is { food_id: string; portion_size: 'small' | 'medium' | 'large' | 'custom'; portion_g: number } => f.food_id !== null)
    .map((f) => f.food_id)
  if (taxonomyIds.length > 0) {
    const found = await foodsById(taxonomyIds)
    if (found.length !== new Set(taxonomyIds).size) {
      return NextResponse.json({ error: 'unknown_food_id' }, { status: 400 })
    }
  }

  const confirmed = body.confirmed_foods as ConfirmedFood[]
  const { macros, items: scoringItems } = await aggregateMacros(confirmed)
  const { score, breakdown } = computeMealScore(macros, scoringItems)

  const { error: updErr } = await supabase
    .from('meals')
    .update({
      confirmed_foods: confirmed,
      macros,
      score,
      score_breakdown: breakdown,
      processing_status: 'scored',
    })
    .eq('id', mealId)
  if (updErr) {
    log.error('meals.confirm', 'meal update failed', { meal_id: mealId, error: updErr.message })
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  let daily
  try {
    daily = await recomputeDaily(meal.user_id, meal.user_local_date)
  } catch (err) {
    log.error('meals.confirm', 'daily rollup failed', { meal_id: mealId, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'daily_rollup_failed' }, { status: 500 })
  }

  log.info('meals.confirm', 'scored', {
    meal_id: mealId,
    score,
    items: confirmed.length,
    llm_estimate_items: scoringItems.filter((i) => i.source === 'llm_estimate').length,
    daily_total: daily.total_score,
  })
  return NextResponse.json({ score, breakdown, macros, daily })
}
