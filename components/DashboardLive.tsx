'use client'

import useSWR from 'swr'
import { MealCard, type Meal } from './MealCard'
import { DailyScoreCard } from './DailyScoreCard'
import { WeekStrip, type DayCell } from './WeekStrip'
import { WaterTracker } from './WaterTracker'
import { TipsCard, type WeeklyTips } from './TipsCard'
import { useT, useThemeCtl } from './design/ThemeProvider'
import { FONT_DISPLAY, FONT_UI, FONT_MONO } from './design/theme'
import { Icon } from './design/Icon'
import { Avatar, IconBadge, SectionLabel, TrendBadge } from './design/primitives'
import Link from 'next/link'

type Daily = {
  nutrition: number
  goal_alignment: number
  meal_timing: number
  hydration: number
  consistency: number
  total_score: number
  meal_count: number
} | null

type Props = {
  displayName: string
  initialMeals: Meal[]
  initialDate: string
  daily: Daily
  targets: { daily_kcal_target: number; daily_protein_target_g: number; goal: string }
  weekDays: DayCell[]
  water: { date: string; ml: number; target_ml: number }
  tips: WeeklyTips | null
  rank?: { rank: number; member_count: number } | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<{ meals: Meal[]; date: string }>)

function hueFromName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h % 360
}

function streakFromDays(days: DayCell[]): number {
  // Walk backwards from today (last entry) counting consecutive days with a score.
  let n = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].score != null) n++
    else break
  }
  return n
}

function formatHeaderDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()]
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
  return `${wk} · ${mo} ${d}`
}

export function DashboardLive({
  displayName,
  initialMeals,
  initialDate,
  daily,
  targets,
  weekDays,
  water,
  tips,
  rank,
}: Props) {
  const t = useT()
  const { toggleDark } = useThemeCtl()

  const { data, mutate } = useSWR(`/api/meals?date=${initialDate}`, fetcher, {
    fallbackData: { meals: initialMeals, date: initialDate },
    refreshInterval: (latest) => {
      const list = latest?.meals ?? initialMeals
      return list.some((m) => m.processing_status === 'pending_identify') ? 4000 : 0
    },
    revalidateOnFocus: true,
  })

  const meals = data?.meals ?? initialMeals
  const pendingCount = meals.filter((m) => m.processing_status === 'pending_identify').length
  const streak = streakFromDays(weekDays)
  const userHue = hueFromName(displayName)

  return (
    <section
      className="hr-scroll"
      style={{
        maxWidth: 460,
        margin: '0 auto',
        padding: '60px 18px 0',
      }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: 1,
              color: t.textFaint,
              textTransform: 'uppercase',
            }}
          >
            {formatHeaderDate(initialDate)}
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: 27,
              color: t.text,
              letterSpacing: -0.5,
              lineHeight: 1.05,
            }}
          >
            Hi, {displayName}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleDark}
          style={{
            border: `1px solid ${t.border}`,
            background: t.surface,
            width: 40,
            height: 40,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
          aria-label="Toggle theme"
        >
          <Icon name={t.dark ? 'sun' : 'moon'} size={19} sw={2.1} color={t.textMute} />
        </button>
        <Link href="/profile" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
          <Avatar name={displayName} initials={displayName[0]} hue={userHue} size={40} ring={t.brand} />
        </Link>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <Link
          href="/leaderboard"
          style={{
            flex: 1,
            border: `1px solid ${t.border}`,
            background: t.surface,
            borderRadius: 16,
            padding: '11px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textAlign: 'left',
            textDecoration: 'none',
          }}
        >
          <IconBadge name="trophy" size={34} bg={t.gold + '22'} color={t.gold} sw={2} />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: 18,
                color: t.text,
                lineHeight: 1,
              }}
            >
              {rank ? (
                <>
                  #{rank.rank}
                  <span style={{ fontFamily: FONT_UI, fontSize: 12, color: t.textFaint, fontWeight: 600 }}>
                    {' '}of {rank.member_count}
                  </span>
                </>
              ) : (
                <span style={{ fontFamily: FONT_UI, fontSize: 13, color: t.textFaint, fontWeight: 600 }}>—</span>
              )}
            </div>
            <div style={{ fontFamily: FONT_UI, fontSize: 11, color: t.textMute, marginTop: 2 }}>in your circle</div>
          </div>
          {rank && <TrendBadge value={null} size={13} />}
        </Link>
        <div
          style={{
            flex: 1,
            border: `1px solid ${t.border}`,
            background: t.surface,
            borderRadius: 16,
            padding: '11px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <IconBadge name="flame" size={34} bg={'oklch(0.7 0.2 40 / 0.16)'} color={'oklch(0.72 0.2 40)'} sw={2} />
          <div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: 18,
                color: t.text,
                lineHeight: 1,
              }}
            >
              {streak}
              <span style={{ fontFamily: FONT_UI, fontSize: 12, color: t.textFaint, fontWeight: 600 }}> days</span>
            </div>
            <div style={{ fontFamily: FONT_UI, fontSize: 11, color: t.textMute, marginTop: 2 }}>logging streak</div>
          </div>
        </div>
      </div>

      <DailyScoreCard daily={daily} targets={targets} meals={meals} />

      <WaterTracker initial={water} />

      {tips && <TipsCard tips={tips} />}

      <WeekStrip days={weekDays} />

      <div style={{ marginBottom: 8 }}>
        <SectionLabel
          right={
            pendingCount > 0 ? (
              <button
                type="button"
                onClick={() => mutate()}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontFamily: FONT_UI,
                  fontWeight: 600,
                  fontSize: 11,
                  color: t.textMute,
                }}
              >
                {pendingCount} analyzing · checking every 4s
              </button>
            ) : (
              <Link
                href="/meal/new"
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontFamily: FONT_UI,
                  fontWeight: 700,
                  fontSize: 12,
                  color: t.brand,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  textDecoration: 'none',
                }}
              >
                <Icon name="plus" size={13} sw={2.6} color={t.brand} /> Add
              </Link>
            )
          }
        >
          Today&apos;s meals
        </SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {meals.map((m) => (
            <MealCard key={m.id} meal={m} ownerView />
          ))}
          <Link
            href="/meal/new"
            style={{
              border: `1.5px dashed ${t.borderHi}`,
              background: 'transparent',
              borderRadius: 18,
              minHeight: 150,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: t.textMute,
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: t.brand,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="camera" size={22} sw={2.2} color={t.brandText} />
            </div>
            <span style={{ fontFamily: FONT_UI, fontWeight: 700, fontSize: 13, color: t.text }}>Log a meal</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
