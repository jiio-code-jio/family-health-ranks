import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { runIdentificationPipeline } from '@/lib/llm/pipeline'
import { generateWeeklyTipsForAllUsers } from '@/lib/tips/generate'
import { log } from '@/lib/log'

export const runtime = 'nodejs'
// Vercel Hobby caps serverless functions at 60s. The cron processes up to 10
// stuck meals then generates weekly tips; anything not finished in time is
// picked up on the next daily run (both steps are idempotent + self-skipping).
export const maxDuration = 60

const MAX_PER_RUN = 10
const STUCK_AFTER_SECONDS = 5 * 60

/**
 * Daily safety-net cron (vercel.json: 0 3 * * *).
 *
 * The happy path is fire-and-forget from POST /api/meals via waitUntil. This
 * route exists to mop up meals that got stuck in pending_identify — usually
 * because a deploy interrupted the function or waitUntil hit the timeout.
 * Daily is enough; the user-visible delay is at most until the next 03:00 UTC.
 *
 * Auth: requires the CRON_SECRET in the Authorization header. Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET` automatically when the env var
 * is configured at the project level.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 })

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const stuckBefore = new Date(Date.now() - STUCK_AFTER_SECONDS * 1000).toISOString()
  const supabase = adminClient()

  const { data: stuck, error } = await supabase
    .from('meals')
    .select('id')
    .eq('processing_status', 'pending_identify')
    .lt('created_at', stuckBefore)
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: Array<{ meal_id: string; ok: boolean; error?: string }> = []
  for (const row of stuck ?? []) {
    try {
      await runIdentificationPipeline(row.id)
      results.push({ meal_id: row.id, ok: true })
    } catch (e) {
      results.push({ meal_id: row.id, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  // Piggyback the weekly-tips generation onto this daily cron (Vercel Hobby
  // allows only one cron schedule). Each user gets at most one generation per
  // ISO week — generateWeeklyTipsForUser is idempotent and self-skipping.
  let tips = { generated: 0, skipped: 0 }
  try {
    tips = await generateWeeklyTipsForAllUsers()
  } catch (e) {
    log.error('cron.tips', 'weekly tips generation failed', { error: e instanceof Error ? e.message : String(e) })
  }

  return NextResponse.json({ checked: stuck?.length ?? 0, results, tips })
}
