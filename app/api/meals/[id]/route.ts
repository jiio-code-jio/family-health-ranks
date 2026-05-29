import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { recomputeDaily } from '@/lib/scoring/aggregate'
import { log } from '@/lib/log'

export const runtime = 'nodejs'

/**
 * DELETE /api/meals/[id] — owner-only.
 *
 * Hot path is just one DB roundtrip (the delete itself). Storage removal and
 * the daily-scores recompute fire in the background via waitUntil — the
 * client gets a fast response and the optimistic SWR removal feels instant.
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const supabase = adminClient()

  const { data: meal, error: fetchErr } = await supabase
    .from('meals')
    .select('id, user_id, image_path, processing_status, user_local_date')
    .eq('id', id)
    .single()

  if (fetchErr || !meal) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (meal.user_id !== sess.sub) {
    log.warn('meals.delete', 'forbidden', { meal_id: id, requester: sess.sub, owner: meal.user_id })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Critical path: just delete the row. Everything else can settle in background.
  const { error: delErr } = await supabase.from('meals').delete().eq('id', id)
  if (delErr) {
    log.error('meals.delete', 'row delete failed', { meal_id: id, error: delErr.message })
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  // Background: storage cleanup + daily-scores recompute. The storage object
  // becoming orphaned isn't fatal (just wastes ~150KB until manual cleanup),
  // and the daily aggregate eventually consistency is fine within a few seconds.
  waitUntil((async () => {
    await supabase.storage.from('meals').remove([meal.image_path]).catch((e) => {
      log.warn('meals.delete', 'storage cleanup failed', { meal_id: id, error: e instanceof Error ? e.message : String(e) })
    })
    if (meal.processing_status === 'scored') {
      await recomputeDaily(meal.user_id, meal.user_local_date).catch((e) => {
        log.error('meals.delete', 'daily recompute failed', { meal_id: id, error: e instanceof Error ? e.message : String(e) })
      })
    }
  })())

  log.info('meals.delete', 'deleted', { meal_id: id, user_id: sess.sub, was_scored: meal.processing_status === 'scored' })
  return NextResponse.json({ ok: true })
}
