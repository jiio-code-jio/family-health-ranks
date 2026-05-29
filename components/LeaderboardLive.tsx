'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { LeaderboardTable } from './LeaderboardTable'
import type { LeaderboardResult, Period } from '@/lib/scoring/leaderboard'
import { useT } from './design/ThemeProvider'
import { SegTabs } from './design/primitives'
import { FONT_DISPLAY, FONT_UI } from './design/theme'
import { Icon } from './design/Icon'

type ApiResp = LeaderboardResult & { current_user_id: string }

const TABS: Array<{ v: Period; label: string }> = [
  { v: 'daily', label: 'Today' },
  { v: 'weekly', label: 'Week' },
  { v: 'monthly', label: 'Month' },
  { v: 'overall', label: 'All' },
]

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<ApiResp>)

type Props = {
  initial: ApiResp
  circleName?: string
}

export function LeaderboardLive({ initial, circleName }: Props) {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const active = (params?.get('period') ?? 'daily') as Period

  const { data } = useSWR(`/api/leaderboard?period=${active}`, fetcher, {
    fallbackData: active === initial.period ? initial : undefined,
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  })

  function setTab(period: Period) {
    const sp = new URLSearchParams(params ? params.toString() : '')
    sp.set('period', period)
    router.replace(`/leaderboard?${sp.toString()}`)
  }

  const totalMembers = data ? data.rows.length + data.ineligible_count : 0

  return (
    <section
      className="hr-scroll"
      style={{ maxWidth: 460, margin: '0 auto', padding: '60px 18px 0' }}
    >
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: 27,
            color: t.text,
            letterSpacing: -0.5,
          }}
        >
          Leaderboard
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <Icon name="user" size={13} sw={2.2} color={t.textFaint} />
          <span style={{ fontFamily: FONT_UI, fontSize: 12.5, color: t.textMute }}>
            {circleName ?? 'Your circle'}
            {totalMembers > 0 ? ` · ${totalMembers} ranked` : ''}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <SegTabs<Period> options={TABS} value={active} onChange={setTab} size="sm" />
      </div>

      {data && (
        <>
          <p
            style={{
              fontFamily: FONT_UI,
              fontSize: 11.5,
              color: t.textFaint,
              margin: '0 4px 10px',
            }}
          >
            {data.period_label}
          </p>
          <LeaderboardTable
            period={data.period}
            rows={data.rows}
            currentUserId={data.current_user_id}
            ineligibleCount={data.ineligible_count}
          />
        </>
      )}

      <div
        style={{
          marginTop: 14,
          textAlign: 'center',
          fontFamily: FONT_UI,
          fontSize: 12,
          color: t.textFaint,
        }}
      >
        Ranks update live as your circle logs meals.
      </div>
    </section>
  )
}
