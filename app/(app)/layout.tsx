import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { ThemeProvider } from '@/components/design/ThemeProvider'
import { TabBar } from '@/components/design/TabBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sess = await getSession()
  if (!sess) redirect('/login')

  return (
    <ThemeProvider defaultDark defaultAccent="lime">
      <main
        className="flex-1"
        style={{
          background: '#0A0C0B',
          color: '#F2F5F2',
          minHeight: '100vh',
          paddingBottom: 124,
        }}
      >
        {children}
      </main>
      <TabBar />
    </ThemeProvider>
  )
}
