import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { rescoreMealWithPremium } from '@/lib/llm/refine'
import { openaiConfigured } from '@/lib/llm/openai'
import { log } from '@/lib/log'

export const runtime = 'nodejs'
export const maxDuration = 60

const Body = z.object({
  note: z.string().trim().max(500).optional(),
})

/**
 * POST /api/meals/[id]/feedback — user flags a meal's score as wrong.
 *
 * Records the flag (for admin review) and, when the premium model is
 * configured, immediately re-runs the photo through GPT-4.1 mini, re-adopts the
 * foods, and re-scores. Old + new scores are stored on the feedback row so the
 * admin can audit accuracy over time.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id: mealId } = await ctx.params

  let body: z.infer<typeof Body> = {}
  try {
    body = Body.parse(await req.json().catch(() => ({})))
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const supabase = adminClient()
  const { data: meal, error: fetchErr } = await supabase
    .from('meals')
    .select('id, user_id, score, processing_status')
    .eq('id', mealId)
    .single()
  if (fetchErr || !meal) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (meal.user_id !== sess.sub) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (meal.processing_status !== 'scored') {
    return NextResponse.json({ error: 'not_scored' }, { status: 409 })
  }

  const oldScore = meal.score === null ? null : Number(meal.score)

  // Record the flag first so it's never lost even if the re-score fails.
  const { data: fb, error: fbErr } = await supabase
    .from('meal_feedback')
    .insert({
      meal_id: mealId,
      user_id: sess.sub,
      note: body.note ?? null,
      old_score: oldScore,
      status: 'open',
    })
    .select('id')
    .single()
  if (fbErr) {
    log.error('meals.feedback', 'flag insert failed', { meal_id: mealId, error: fbErr.message })
    return NextResponse.json({ error: fbErr.message }, { status: 500 })
  }
  log.info('meals.feedback', 'flagged', { meal_id: mealId, user_id: sess.sub, feedback_id: fb.id, old_score: oldScore })

  if (!openaiConfigured()) {
    // No premium model — the flag stands for manual admin review.
    return NextResponse.json({ ok: true, rescored: false, old_score: oldScore })
  }

  try {
    const result = await rescoreMealWithPremium(mealId)
    if (!result.ok) {
      log.warn('meals.feedback', 're-score not applied', { meal_id: mealId, reason: result.reason })
      return NextResponse.json({ ok: true, rescored: false, reason: result.reason, old_score: oldScore })
    }

    await supabase
      .from('meal_feedback')
      .update({ new_score: result.score, status: 'reviewed', resolved_at: new Date().toISOString() })
      .eq('id', fb.id)

    return NextResponse.json({
      ok: true,
      rescored: true,
      old_score: oldScore,
      score: result.score,
      breakdown: result.breakdown,
      macros: result.macros,
      daily: result.daily,
    })
  } catch (err) {
    log.error('meals.feedback', 're-score failed', { meal_id: mealId, error: err instanceof Error ? err.message : String(err) })
    // Flag is still recorded; surface a soft failure so the UI can say "flagged".
    return NextResponse.json({ ok: true, rescored: false, reason: 'rescore_error', old_score: oldScore })
  }
}
