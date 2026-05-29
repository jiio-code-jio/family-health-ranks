'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { MealCard, type Meal } from './MealCard'
import { DailyScoreCard } from './DailyScoreCard'
import { WeekStrip, type DayCell } from './WeekStrip'
import { WaterTracker } from './WaterTracker'
import { TipsCard, type WeeklyTips } from './TipsCard'
import { InviteCard } from './InviteCard'

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
  isAdmin: boolean
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<{ meals: Meal[]; date: string }>)

export function DashboardLive({ displayName, initialMeals, initialDate, daily, targets, weekDays, water, tips, isAdmin }: Props) {
  // Poll /api/meals every 4s while any meal is still being identified.
  // The function form of refreshInterval re-evaluates on every fetch, so
  // polling auto-stops the moment the last pending meal flips to
  // awaiting_confirmation, scored, rejected, or failed.
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

  return (
    <section className="mx-auto max-w-2xl space-y-5 px-6 py-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Hi, {displayName}</h1>
          <p className="text-xs opacity-60">
            Goal: {targets.goal} · target {Math.round(targets.daily_kcal_target)} kcal · {Math.round(targets.daily_protein_target_g)} g protein
          </p>
        </div>
        <Link href="/meal/new" className="rounded-md bg-foreground px-3 py-2 text-sm text-background">
          + Add meal
        </Link>
      </header>

      <DailyScoreCard daily={daily} targets={targets} meals={meals} />

      {tips && <TipsCard tips={tips} />}

      <WaterTracker initial={water} />

      <WeekStrip days={weekDays} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide opacity-60">Today’s meals</h2>
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => mutate()}
              className="text-[11px] opacity-60 hover:opacity-100"
            >
              {pendingCount} analyzing · checking every 4s
            </button>
          )}
        </div>
        {meals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/20 px-4 py-10 text-center text-sm opacity-60 dark:border-white/20">
            No meals logged today. Tap “Add meal” to start.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {meals.map((m) => (
              <MealCard key={m.id} meal={m} ownerView />
            ))}
          </div>
        )}
      </div>

      {isAdmin && <InviteCard />}
    </section>
  )
}
