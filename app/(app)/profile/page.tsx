import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { ProfileForm } from '@/components/ProfileForm'
import { ResetCodeCard } from '@/components/ResetCodeCard'
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

  return (
    <section className="mx-auto max-w-md space-y-6 px-6 py-8">
      <header>
        <h1 className="text-xl font-semibold">{user.display_name}</h1>
        <p className="text-sm opacity-70">
          {user.weight_kg === null
            ? 'Tell us a bit about you so we can score your meals correctly.'
            : 'Update your profile any time. New targets apply from today.'}
        </p>
      </header>

      <ProfileForm initial={user} />

      {user.daily_kcal_target !== null && (
        <p className="rounded-md bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
          Daily target: <strong>{Math.round(Number(user.daily_kcal_target))} kcal</strong>,{' '}
          <strong>{Math.round(Number(user.daily_protein_target_g))} g protein</strong>
        </p>
      )}

      <ResetCodeCard />
    </section>
  )
}
