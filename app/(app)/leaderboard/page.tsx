import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { adminClient } from '@/lib/supabase/admin'
import { fetchLeaderboard, type Period } from '@/lib/scoring/leaderboard'
import { LeaderboardLive } from '@/components/LeaderboardLive'

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sess = await getSession()
  if (!sess) redirect('/login')

  const sp = await searchParams
  const period: Period =
    sp.period === 'weekly' || sp.period === 'monthly' || sp.period === 'overall' ? sp.period : 'daily'

  const supabase = adminClient()
  const { data: me } = await supabase
    .from('users')
    .select('timezone')
    .eq('id', sess.sub)
    .single()
  const tz = me?.timezone ?? 'UTC'

  const initial = await fetchLeaderboard(period, tz)

  return <LeaderboardLive initial={{ ...initial, current_user_id: sess.sub }} circleName="Your circle" />
}
