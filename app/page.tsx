import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

export default async function Home() {
  const sess = await getSession()
  redirect(sess ? '/dashboard' : '/login')
}
