import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { fetchLeaderboard, type Period } from '@/lib/scoring/leaderboard'

export const runtime = 'nodejs'

const PERIODS = new Set<Period>(['daily', 'weekly', 'monthly', 'overall'])

export async function GET(req: NextRequest) {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const periodParam = (req.nextUrl.searchParams.get('period') ?? 'daily') as Period
  if (!PERIODS.has(periodParam)) {
    return NextResponse.json({ error: 'invalid_period' }, { status: 400 })
  }

  const supabase = adminClient()
  const { data: me } = await supabase
    .from('users')
    .select('timezone')
    .eq('id', sess.sub)
    .single()
  const tz = me?.timezone ?? 'UTC'

  try {
    const result = await fetchLeaderboard(periodParam, tz)
    return NextResponse.json({ ...result, current_user_id: sess.sub })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}
