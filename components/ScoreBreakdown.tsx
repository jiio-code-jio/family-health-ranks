'use client'

type Breakdown = {
  protein: number
  fiber: number
  quality: number
  vegetable: number
  fruit: number
  sugar: number
  sat_fat: number
  sodium: number
  raw: number
  final: number
}

type Macros = {
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sat_fat_g: number
  sugar_g: number
  sodium_mg: number
  kcal: number
}

type DailyComponents = {
  nutrition: number
  goal_alignment: number
  meal_timing: number
  hydration: number
  consistency: number
  total_score: number
  meal_count: number
}

export type ScoredFood = {
  display_name: string
  portion_size: 'small' | 'medium' | 'large' | 'custom'
  portion_g: number
}

type Props = {
  score: number
  breakdown: Breakdown
  macros: Macros
  daily?: DailyComponents
  foods?: ScoredFood[]
}

const ROWS: Array<{ key: keyof Breakdown; label: string }> = [
  { key: 'protein',   label: 'Protein' },
  { key: 'fiber',     label: 'Fiber' },
  { key: 'quality',   label: 'Food quality' },
  { key: 'vegetable', label: 'Vegetables present' },
  { key: 'fruit',     label: 'Fruit present' },
  { key: 'sugar',     label: 'Sugar' },
  { key: 'sat_fat',   label: 'Saturated fat' },
  { key: 'sodium',    label: 'Sodium over 600 mg' },
]

export function ScoreBreakdown({ score, breakdown, macros, daily, foods }: Props) {
  const rounded = Math.round(score)
  const ring =
    rounded >= 80 ? 'border-emerald-500 text-emerald-500' :
    rounded >= 60 ? 'border-amber-500 text-amber-500' :
                    'border-red-500 text-red-500'

  return (
    <section className="space-y-5">
      <header className="flex items-center gap-4">
        <div className={`grid h-20 w-20 place-items-center rounded-full border-4 text-2xl font-bold ${ring}`}>
          {rounded}
        </div>
        <div>
          <p className="text-lg font-semibold">Meal scored</p>
          <p className="text-xs opacity-60">out of 100 · higher is healthier</p>
        </div>
      </header>

      {foods && foods.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide opacity-60">What you ate</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {foods.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span>{f.display_name}</span>
                <span className="text-xs opacity-60">{f.portion_g} g · {f.portion_size}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs font-medium uppercase tracking-wide opacity-60">How we got there</h3>
        <ul className="mt-2 divide-y divide-black/5 text-sm dark:divide-white/5">
          {ROWS.filter((r) => breakdown[r.key] !== 0).map((r) => {
            const v = breakdown[r.key]
            const sign = v > 0 ? '+' : ''
            return (
              <li key={r.key} className="flex justify-between py-1.5">
                <span>{r.label}</span>
                <span className={v > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                  {sign}{round1(v)}
                </span>
              </li>
            )
          })}
          <li className="flex justify-between py-1.5 font-medium">
            <span>Raw total</span>
            <span>{round1(breakdown.raw)}</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-medium uppercase tracking-wide opacity-60">Macros</h3>
        <p className="mt-2 text-sm">
          <strong>{macros.kcal}</strong> kcal · <strong>{macros.protein_g} g</strong> protein ·{' '}
          <strong>{macros.carbs_g} g</strong> carbs · <strong>{macros.fat_g} g</strong> fat ·{' '}
          <strong>{macros.fiber_g} g</strong> fiber
        </p>
      </div>

      {daily && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide opacity-60">Today so far</h3>
          <p className="mt-2 text-sm">
            Daily score <strong>{round1(daily.total_score)}</strong> across {daily.meal_count} meal{daily.meal_count === 1 ? '' : 's'}
          </p>
          <ul className="mt-1 text-xs opacity-70">
            <li>Nutrition {round1(daily.nutrition)} · Goal alignment {round1(daily.goal_alignment)} · Consistency {round1(daily.consistency)}</li>
            <li className="opacity-60">Meal timing + Hydration are placeholder 100 until v2 wires them in.</li>
          </ul>
        </div>
      )}
    </section>
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
