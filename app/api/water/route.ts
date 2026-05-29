import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { userLocalDate } from '@/lib/tz'
import { waterTargetMl } from '@/lib/hydration'
import { recomputeDaily } from '@/lib/scoring/aggregate'
import { log } from '@/lib/log'

export const runtime = 'nodejs'

const MAX_TOTAL_ML = 10000

const Body = z.object({
  // Positive to add a glass, negative to undo. Bounded so a bad client can't
  // push absurd values.
  delta_ml: z.number().int().min(-2000).max(2000),
})

async function loadUser(userId: string) {
  const { data } = await adminClient()
    .from('users')
    .select('timezone, weight_kg')
    .eq('id', userId)
    .single()
  return data
}

/** GET /api/water — today's running total + target (in the user's tz). */
export async function GET() {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const user = await loadUser(sess.sub)
  if (!user) return NextResponse.json({ error: 'user_missing' }, { status: 401 })

  const date = userLocalDate(new Date(), user.timezone)
  const { data: row } = await adminClient()
    .from('daily_water')
    .select('ml')
    .eq('user_id', sess.sub)
    .eq('user_local_date', date)
    .maybeSingle()

  return NextResponse.json({
    date,
    ml: Number(row?.ml ?? 0),
    target_ml: waterTargetMl(user.weight_kg),
  })
}

/** POST /api/water { delta_ml } — add/remove water for today, then re-roll the daily score. */
export async function POST(req: NextRequest) {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const user = await loadUser(sess.sub)
  if (!user) return NextResponse.json({ error: 'user_missing' }, { status: 401 })

  const supabase = adminClient()
  const date = userLocalDate(new Date(), user.timezone)

  const { data: existing } = await supabase
    .from('daily_water')
    .select('ml')
    .eq('user_id', sess.sub)
    .eq('user_local_date', date)
    .maybeSingle()

  const current = Number(existing?.ml ?? 0)
  const next = Math.max(0, Math.min(MAX_TOTAL_ML, current + body.delta_ml))

  const { error: upErr } = await supabase
    .from('daily_water')
    .upsert(
      { user_id: sess.sub, user_local_date: date, ml: next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,user_local_date' },
    )
  if (upErr) {
    log.error('water.log', 'upsert failed', { user_id: sess.sub, error: upErr.message })
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  // Re-roll the daily score so the Hydration component reflects the new intake.
  let daily
  try {
    daily = await recomputeDaily(sess.sub, date)
  } catch (err) {
    log.error('water.log', 'daily recompute failed', { user_id: sess.sub, error: err instanceof Error ? err.message : String(err) })
    // Water is saved; the recompute will self-heal on the next meal confirm.
  }

  return NextResponse.json({
    date,
    ml: next,
    target_ml: waterTargetMl(user.weight_kg),
    daily: daily ?? null,
  })
}
