import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { waitUntil } from '@vercel/functions'
import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { userLocalDate } from '@/lib/tz'
import { runIdentificationPipeline } from '@/lib/llm/pipeline'
import { log } from '@/lib/log'

export const runtime = 'nodejs'

const MEAL_TYPES = new Set(['breakfast', 'lunch', 'snack', 'dinner', 'other'])
const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4 MB — server-side safety net; client compresses to ~150KB

/**
 * POST /api/meals — multipart/form-data upload.
 *   fields: image (File), meal_type, eaten_at (ISO 8601, optional — defaults to now), metadata (optional)
 * Returns { meal_id }. Status is 'pending_identify'; the LLM pipeline will be
 * fired here via waitUntil in Phase 5.
 */
export async function POST(req: NextRequest) {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 })
  }

  const image = form.get('image')
  const mealType = String(form.get('meal_type') ?? '').trim()
  const eatenAtRaw = String(form.get('eaten_at') ?? '').trim()
  const metadata = (form.get('metadata') ? String(form.get('metadata')) : null)?.slice(0, 500) || null

  if (!(image instanceof File) || image.size === 0) return NextResponse.json({ error: 'image_required' }, { status: 400 })
  if (image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'image_too_large' }, { status: 413 })
  if (!MEAL_TYPES.has(mealType)) return NextResponse.json({ error: 'invalid_meal_type' }, { status: 400 })

  const eatenAt = eatenAtRaw ? new Date(eatenAtRaw) : new Date()
  if (Number.isNaN(eatenAt.getTime())) return NextResponse.json({ error: 'invalid_eaten_at' }, { status: 400 })

  const supabase = adminClient()

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('timezone')
    .eq('id', sess.sub)
    .single()
  if (userErr || !userRow) return NextResponse.json({ error: 'user_missing' }, { status: 401 })

  const mealId = randomUUID()
  const ext = (image.type === 'image/png' ? 'png' : 'jpg')
  const imagePath = `${sess.sub}/${mealId}.${ext}`

  log.info('meals.create', 'upload received', {
    meal_id: mealId, user_id: sess.sub, meal_type: mealType,
    bytes: image.size, content_type: image.type,
  })

  // Upload to storage first so we don't leave an orphan DB row if storage fails.
  const uploadStart = Date.now()
  const buf = Buffer.from(await image.arrayBuffer())
  const { error: upErr } = await supabase.storage
    .from('meals')
    .upload(imagePath, buf, { contentType: image.type || 'image/jpeg', upsert: false })
  if (upErr) {
    log.error('meals.create', 'storage upload failed', { meal_id: mealId, error: upErr.message })
    return NextResponse.json({ error: `upload: ${upErr.message}` }, { status: 500 })
  }
  log.info('meals.create', 'storage upload ok', { meal_id: mealId, ms: Date.now() - uploadStart })

  const { error: insErr } = await supabase.from('meals').insert({
    id: mealId,
    user_id: sess.sub,
    meal_type: mealType,
    eaten_at: eatenAt.toISOString(),
    user_local_date: userLocalDate(eatenAt, userRow.timezone),
    image_path: imagePath,
    metadata,
    processing_status: 'pending_identify',
  })
  if (insErr) {
    await supabase.storage.from('meals').remove([imagePath]) // best-effort cleanup
    log.error('meals.create', 'row insert failed; cleaned up storage', { meal_id: mealId, error: insErr.message })
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // Fire-and-forget identification. waitUntil keeps the serverless function
  // alive after the response is sent (up to the function timeout) so the
  // Gemini + resolver work finishes without blocking upload latency.
  waitUntil(runIdentificationPipeline(mealId))
  log.info('meals.create', 'pipeline fired', { meal_id: mealId })

  return NextResponse.json({ meal_id: mealId, processing_status: 'pending_identify' })
}

/**
 * GET /api/meals?date=YYYY-MM-DD (defaults to today in user's tz)
 * Returns the current user's meals for that user_local_date.
 */
export async function GET(req: NextRequest) {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = adminClient()
  const { data: user } = await supabase.from('users').select('timezone').eq('id', sess.sub).single()
  if (!user) return NextResponse.json({ error: 'user_missing' }, { status: 401 })

  const dateParam = req.nextUrl.searchParams.get('date')
  const date = dateParam || userLocalDate(new Date(), user.timezone)

  const { data, error } = await supabase
    .from('meals')
    .select('id, meal_type, eaten_at, processing_status, image_path, score, used_premium_model, metadata, confirmed_foods, macros')
    .eq('user_id', sess.sub)
    .eq('user_local_date', date)
    .order('eaten_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ date, meals: data ?? [] })
}
