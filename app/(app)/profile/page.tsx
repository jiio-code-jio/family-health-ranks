import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { ProfileForm } from '@/components/ProfileForm'
import { ResetCodeCard } from '@/components/ResetCodeCard'
import { ProfileHeader } from '@/components/ProfileHeader'
import { fetchWeekStrip } from '@/lib/scoring/week'
import { fetchLeaderboard } from '@/lib/scoring/leaderboard'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const sess = await getSession()
  if (!sess) redirect('/login')

  const { data: user } = await adminClient()
    .from('users')
    .select('display_name, age, gender, height_cm, weight_kg, activity_level, goal, timezone, daily_kcal_target, daily_protein_target_g')
    .eq('id', sess.sub)
    .single()

  if (!user) redirect('/login')

  const tz = user.timezone ?? 'UTC'
  const [weekDays, board] = await Promise.all([
    fetchWeekStrip(sess.sub, tz),
    fetchLeaderboard('daily', tz),
  ])

  const rankIdx = board.rows.findIndex((r) => r.user_id === sess.sub)
  const rank = rankIdx >= 0 ? rankIdx + 1 : null
  // Streak: consecutive non-null days from today backwards.
  let streak = 0
  for (let i = weekDays.length - 1; i >= 0; i--) {
    if (weekDays[i].score != null) streak++
    else break
  }
  const bestThisWeek = weekDays
    .map((d) => d.score ?? 0)
    .reduce((a, b) => Math.max(a, b), 0)

  return (
    <section
      className="hr-scroll"
      style={{ maxWidth: 460, margin: '0 auto', padding: '60px 18px 0' }}
    >
      <ProfileHeader
        displayName={user.display_name}
        rank={rank}
        streak={streak}
        bestDay={Math.round(bestThisWeek)}
        unsavedPrompt={user.weight_kg === null}
      />

      <ProfileForm initial={user} />

      <div style={{ height: 16 }} />
      <ResetCodeCard />
      <div style={{ height: 16 }} />
    </section>
  )
}
