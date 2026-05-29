'use client'

import type { Meal } from './MealCard'

type Daily = {
  nutrition: number
  goal_alignment: number
  meal_timing: number
  hydration: number
  consistency: number
  total_score: number
  meal_count: number
} | null

type Targets = {
  daily_kcal_target: number
  daily_protein_target_g: number
}

type Props = {
  daily: Daily
  targets: Targets
  meals: Meal[] // for live kcal/protein totals (server-side daily lags for unscored items, but for v1 we just show scored macros)
}

export function DailyScoreCard({ daily, targets, meals }: Props) {
  const total = daily?.total_score ?? 15 // 15 = baseline from the placeholder MealTiming slot
  const rounded = Math.round(total)
  const ring =
    rounded >= 80 ? 'border-emerald-500 text-emerald-500' :
    rounded >= 60 ? 'border-amber-500 text-amber-500' :
    rounded >= 30 ? 'border-zinc-400 text-zinc-500 dark:text-zinc-400' :
                    'border-red-500 text-red-500'

  // Sum macros across all scored meals (matches what the daily aggregate sees).
  const dailyMacros = sumMacros(meals)
  const kcalPct = clamp01(dailyMacros.kcal / targets.daily_kcal_target)
  const proteinPct = clamp01(dailyMacros.protein_g / targets.daily_protein_target_g)

  const scoredCount = meals.filter((m) => m.processing_status === 'scored').length
  const pendingCount = meals.filter(
    (m) => m.processing_status === 'pending_identify' || m.processing_status === 'awaiting_confirmation'
  ).length

  return (
    <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-center gap-4">
        <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 text-xl font-bold ${ring}`}>
          {rounded}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Today’s score</p>
          <p className="text-xs opacity-60">
            {scoredCount} scored
            {pendingCount > 0 && ` · ${pendingCount} pending`}
            {scoredCount + pendingCount === 0 && ' · log a meal to begin'}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <Bar label="Calories" actual={`${dailyMacros.kcal}`} target={`${Math.round(targets.daily_kcal_target)} kcal`} pct={kcalPct} />
        <Bar label="Protein" actual={`${Math.round(dailyMacros.protein_g)}`} target={`${Math.round(targets.daily_protein_target_g)} g`} pct={proteinPct} />
      </div>

      {daily && (
        <>
          <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
            <Mini label="Nutrition" value={daily.nutrition} weight={40} />
            <Mini label="Goal align." value={daily.goal_alignment} weight={25} />
            <Mini label="Hydration" value={daily.hydration} weight={10} />
            <Mini label="Consistency" value={daily.consistency} weight={10} />
          </div>
          <p className="mt-2 text-[11px] opacity-50">
            + 15 baseline from Meal timing (activated later)
          </p>
        </>
      )}
    </section>
  )
}

function Bar({ label, actual, target, pct }: { label: string; actual: string; target: string; pct: number }) {
  return (
    <div>
      <div className="flex justify-between">
        <span className="opacity-70">{label}</span>
        <span><strong>{actual}</strong> <span className="opacity-50">/ {target}</span></span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded bg-black/10 dark:bg-white/10">
        <div className="h-full bg-foreground transition-[width] duration-300" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}

function Mini({ label, value, weight }: { label: string; value: number; weight: number }) {
  return (
    <div className="rounded border border-black/10 p-2 dark:border-white/10">
      <p className="text-[10px] opacity-60">{label}</p>
      <p className="text-lg font-semibold">{Math.round(value)}</p>
      <p className="text-[10px] opacity-50">weight {weight}%</p>
    </div>
  )
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(1, n)
}

type MealMacros = {
  protein_g?: number; carbs_g?: number; fat_g?: number; fiber_g?: number
  sat_fat_g?: number; sugar_g?: number; sodium_mg?: number; kcal?: number
}

function sumMacros(meals: Meal[]): { kcal: number; protein_g: number } {
  let kcal = 0
  let protein_g = 0
  for (const m of meals) {
    if (m.processing_status !== 'scored') continue
    // macros is jsonb on the row; meals listing endpoint returns it directly.
    const mac = ((m as unknown as { macros?: MealMacros | null }).macros) ?? {}
    kcal += Number(mac.kcal ?? 0)
    protein_g += Number(mac.protein_g ?? 0)
  }
  return { kcal: Math.round(kcal), protein_g: Math.round(protein_g * 10) / 10 }
}
