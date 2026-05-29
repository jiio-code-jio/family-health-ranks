'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { LeaderboardTable } from './LeaderboardTable'
import type { LeaderboardResult, Period } from '@/lib/scoring/leaderboard'

type ApiResp = LeaderboardResult & { current_user_id: string }

const TABS: Array<{ period: Period; label: string }> = [
  { period: 'daily',   label: 'Today' },
  { period: 'weekly',  label: 'Week' },
  { period: 'monthly', label: 'Month' },
  { period: 'overall', label: 'All time' },
]

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<ApiResp>)

type Props = {
  initial: ApiResp
}

export function LeaderboardLive({ initial }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const active = (params.get('period') ?? 'daily') as Period

  const { data } = useSWR(`/api/leaderboard?period=${active}`, fetcher, {
    fallbackData: active === initial.period ? initial : undefined,
    refreshInterval: 30_000, // gentler than dashboard's 4s — leaderboard moves slowly
    revalidateOnFocus: true,
  })

  function setTab(period: Period) {
    const sp = new URLSearchParams(params)
    sp.set('period', period)
    router.replace(`/leaderboard?${sp.toString()}`)
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5 px-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
        <p className="text-xs opacity-60">Everyone with a participation code, ranked by healthiness of eating.</p>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-md border border-black/10 p-1 text-sm dark:border-white/10">
        {TABS.map((t) => (
          <button
            key={t.period}
            type="button"
            onClick={() => setTab(t.period)}
            className={`flex-1 rounded px-3 py-1.5 transition ${active === t.period ? 'bg-foreground text-background' : 'opacity-70 hover:opacity-100'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {data && (
        <>
          <p className="text-xs opacity-60">{data.period_label}</p>
          <LeaderboardTable
            period={data.period}
            rows={data.rows}
            currentUserId={data.current_user_id}
            ineligibleCount={data.ineligible_count}
          />
        </>
      )}
    </section>
  )
}
