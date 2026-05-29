'use client'

import type { LeaderboardRow, Period } from '@/lib/scoring/leaderboard'

type Props = {
  period: Period
  rows: LeaderboardRow[]
  currentUserId: string
  ineligibleCount: number
}

export function LeaderboardTable({ period, rows, currentUserId, ineligibleCount }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-black/20 px-4 py-10 text-center text-sm opacity-60 dark:border-white/20">
        No one is on the board yet for this period.
        {ineligibleCount > 0 && (
          <div className="mt-1 text-xs">
            {ineligibleCount} participant{ineligibleCount === 1 ? '' : 's'} still building up enough days.
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <ol className="space-y-1.5">
        {rows.map((r, i) => {
          const isMe = r.user_id === currentUserId
          const tone =
            r.score >= 80 ? 'border-emerald-500/50 bg-emerald-500/5' :
            r.score >= 60 ? 'border-amber-500/40 bg-amber-500/5' :
                            'border-black/10 dark:border-white/10'
          const meEdge = isMe ? 'border-l-4 border-l-foreground' : ''
          return (
            <li
              key={r.user_id}
              className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${tone} ${meEdge}`}
            >
              <span className="w-6 text-right font-semibold opacity-70">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {r.display_name}
                {isMe && <span className="ml-1 text-xs opacity-60">(you)</span>}
              </span>
              <span className="font-mono text-base font-semibold tabular-nums">{Math.round(r.score)}</span>
              <span className="hidden text-xs opacity-50 sm:inline">
                {summary(period, r)}
              </span>
            </li>
          )
        })}
      </ol>
      {ineligibleCount > 0 && (
        <p className="mt-3 text-xs opacity-50">
          {ineligibleCount} other participant{ineligibleCount === 1 ? '' : 's'} still building up enough days to rank.
        </p>
      )}
    </div>
  )
}

function summary(period: Period, r: LeaderboardRow): string {
  if (period === 'daily') return `${r.meal_count} meal${r.meal_count === 1 ? '' : 's'}`
  return `${r.days_logged} day${r.days_logged === 1 ? '' : 's'} · ${r.meal_count} meals`
}
