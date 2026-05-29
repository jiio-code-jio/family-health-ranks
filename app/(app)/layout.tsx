import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { adminClient } from '@/lib/supabase/admin'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sess = await getSession()
  if (!sess) redirect('/login')

  const { data: user } = await adminClient()
    .from('users')
    .select('display_name')
    .eq('id', sess.sub)
    .single()

  return (
    <>
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 text-sm dark:border-white/10">
        <a href="/dashboard" className="font-semibold">Health Ranks</a>
        <nav className="flex items-center gap-4 opacity-80">
          <a href="/dashboard" className="hover:opacity-100">Today</a>
          <a href="/leaderboard" className="hover:opacity-100">Rank</a>
          <a href="/profile" className="hover:opacity-100">{user?.display_name ?? 'You'}</a>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </>
  )
}
