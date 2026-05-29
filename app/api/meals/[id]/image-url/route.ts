import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

export const runtime = 'nodejs'

const SIGNED_URL_TTL_SECONDS = 60 * 10 // 10 minutes

/**
 * GET /api/meals/[id]/image-url
 * Returns { url } — short-lived signed URL to view the meal image.
 *
 * Any logged-in participant can view any meal's image. This is intentional:
 * the participation code IS the friend-circle gate, so within the circle the
 * feed is fully transparent. If we ever want owner-only privacy, add a check
 * against meal.user_id === sess.sub.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const supabase = adminClient()

  const { data: meal, error: fetchErr } = await supabase
    .from('meals')
    .select('image_path')
    .eq('id', id)
    .single()

  if (fetchErr || !meal) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: signed, error: signErr } = await supabase.storage
    .from('meals')
    .createSignedUrl(meal.image_path, SIGNED_URL_TTL_SECONDS)
  if (signErr || !signed) return NextResponse.json({ error: 'sign_failed' }, { status: 500 })

  return NextResponse.json({ url: signed.signedUrl, expires_in: SIGNED_URL_TTL_SECONDS })
}
