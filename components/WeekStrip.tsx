'use client'

export type DayCell = {
  date: string          // YYYY-MM-DD in user-local tz
  weekday: string       // 'Mon', 'Tue', ...
  score: number | null  // null = no data logged that day
  isToday: boolean
}

export function WeekStrip({ days }: { days: DayCell[] }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide opacity-60">Last 7 days</h3>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const cls = colorForScore(d.score)
          return (
            <div
              key={d.date}
              className={`flex flex-col items-center rounded-md border px-1 py-1.5 text-center text-xs ${cls} ${d.isToday ? 'ring-2 ring-foreground' : ''}`}
              title={d.date}
            >
              <span className="text-[10px] uppercase opacity-70">{d.weekday}</span>
              <span className="font-semibold leading-tight">{d.score === null ? '—' : Math.round(d.score)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function colorForScore(s: number | null): string {
  if (s === null) return 'border-black/10 bg-black/[0.02] text-zinc-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-400'
  if (s >= 80) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (s >= 60) return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
}
