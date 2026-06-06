import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { aggregateMacros, type ConfirmedFood } from '@/lib/taxonomy/macros'
import { computeMealScore } from '@/lib/scoring/meal'
import { recomputeDaily } from '@/lib/scoring/aggregate'
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

// Every confirmed item carries the model's own macros + classification.
const ConfirmedFoodSchema = z.object({
  display_name: z.string().min(1).max(120),
  llm_macros_per_100g: Per100g,
  llm_category: Category,
  llm_quality: Quality,
  portion_size: PortionSize,
  portion_g: z.number().positive().max(2000),
})

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
    daily_total: daily.total_score,
  })
  return NextResponse.json({ score, breakdown, macros, daily })
}
