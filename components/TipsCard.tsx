'use client'

export type WeeklyTips = {
  week_start: string
  tips: string[]
  weakest_component: string | null
}

const FOCUS_LABEL: Record<string, string> = {
  nutrition: 'meal quality',
  goal_alignment: 'hitting your targets',
  hydration: 'hydration',
  consistency: 'logging consistency',
}

export function TipsCard({ tips }: { tips: WeeklyTips }) {
  if (tips.tips.length === 0) return null
  const focus = tips.weakest_component ? FOCUS_LABEL[tips.weakest_component] : null

  return (
    <section className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">✨ This week’s tips</h2>
        {focus && <span className="text-[11px] opacity-60">focus: {focus}</span>}
      </div>
      <ul className="mt-2 space-y-2">
        {tips.tips.map((tip, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="select-none text-violet-500">{i + 1}.</span>
            <span className="opacity-90">{tip}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
