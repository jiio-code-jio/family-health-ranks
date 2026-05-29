'use client'

import { Card, SectionLabel } from './design/primitives'
import { WeekChart } from './design/viz'

export type DayCell = {
  date: string
  weekday: string
  score: number | null
  isToday: boolean
}

export function WeekStrip({ days }: { days: DayCell[] }) {
  const chartDays = days.map((d) => ({
    d: d.weekday,
    date: d.date,
    score: d.score,
    today: d.isToday,
  }))
  return (
    <div style={{ marginBottom: 16 }}>
      <SectionLabel>Last 7 days</SectionLabel>
      <Card pad={16}>
        <WeekChart days={chartDays} />
      </Card>
    </div>
  )
}
