import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import { generateJson } from '@/lib/llm/gemini'
import { log } from '@/lib/log'

export const runtime = 'nodejs'

const Body = z.object({ description: z.string().min(2).max(120) })

const SYSTEM_INSTRUCTION = `You are a nutrition estimator for a healthy-eating app.
Given a short plain-English food description, estimate its nutrition per 100 grams
as served, plus a category and quality tier. Use authoritative typical values
(USDA, IFCT). Return strictly the JSON schema, no commentary. NEVER zero everything
out — give your best estimate even when uncertain.`

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    per_100g: {
      type: 'object',
      properties: {
        protein_g: { type: 'number' },
        carbs_g:   { type: 'number' },
        fat_g:     { type: 'number' },
        fiber_g:   { type: 'number' },
        sat_fat_g: { type: 'number' },
        sugar_g:   { type: 'number' },
        sodium_mg: { type: 'number' },
        kcal:      { type: 'number' },
      },
      required: ['protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sat_fat_g', 'sugar_g', 'sodium_mg', 'kcal'],
      propertyOrdering: ['protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sat_fat_g', 'sugar_g', 'sodium_mg', 'kcal'],
    },
    category: {
      type: 'string',
      enum: ['grain', 'protein', 'vegetable', 'fruit', 'dairy', 'snack', 'beverage', 'mixed_dish', 'fat_oil', 'sweet'],
    },
    quality_tier: {
      type: 'string',
      enum: ['whole_foods', 'mixed', 'processed', 'ultra_processed'],
    },
  },
  required: ['per_100g', 'category', 'quality_tier'],
  propertyOrdering: ['per_100g', 'category', 'quality_tier'],
}

type Per100g = {
  protein_g: number; carbs_g: number; fat_g: number; fiber_g: number
  sat_fat_g: number; sugar_g: number; sodium_mg: number; kcal: number
}
type Estimate = { per_100g: Per100g; category: string; quality_tier: string }

/**
 * POST /api/foods/estimate { description }
 * Returns the model's per-100g macro estimate + classification for a typed food,
 * so the confirm screen can add items the photo pass missed. Replaces the old
 * taxonomy autocomplete — there is no curated food list anymore.
 */
export async function POST(req: NextRequest) {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  try {
    const est = await generateJson<Estimate>({
      systemInstruction: SYSTEM_INSTRUCTION,
      parts: [{ text: `Estimate nutrition for: "${body.description}".` }],
      responseSchema: RESPONSE_SCHEMA,
    })
    // Clamp into the ranges the confirm route accepts, so the result is submittable.
    return NextResponse.json({
      per_100g: clampMacros(est.per_100g),
      category: est.category,
      quality_tier: est.quality_tier,
    })
  } catch (err) {
    log.error('foods.estimate', 'failed', { description: body.description, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'estimate_failed' }, { status: 502 })
  }
}

function clampMacros(m: Per100g): Per100g {
  const c = (v: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0))
  return {
    protein_g: c(m.protein_g, 100),
    carbs_g:   c(m.carbs_g, 100),
    fat_g:     c(m.fat_g, 100),
    fiber_g:   c(m.fiber_g, 50),
    sat_fat_g: c(m.sat_fat_g, 100),
    sugar_g:   c(m.sugar_g, 100),
    sodium_mg: c(m.sodium_mg, 10000),
    kcal:      c(m.kcal, 900),
  }
}
