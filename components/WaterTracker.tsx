'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'

type WaterState = { ml: number; target_ml: number; date: string }

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<WaterState>)

type Props = {
  initial: WaterState
}

export function WaterTracker({ initial }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const { data, mutate } = useSWR('/api/water', fetcher, {
    fallbackData: initial,
    revalidateOnFocus: true,
  })

  const ml = data?.ml ?? 0
  const target = data?.target_ml ?? initial.target_ml
  const pct = target > 0 ? Math.min(100, Math.round((ml / target) * 100)) : 0
  const glasses = Math.round(ml / 250)

  async function adjust(delta: number) {
    if (busy) return
    setBusy(true)
    // Optimistic update so the bar moves instantly.
    const optimistic = { ...(data ?? initial), ml: Math.max(0, ml + delta) }
    await mutate(optimistic, { revalidate: false })
    try {
      const res = await fetch('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta_ml: delta }),
      })
      if (!res.ok) {
        await mutate() // roll back to server truth
        return
      }
      const json = (await res.json()) as WaterState
      await mutate(json, { revalidate: false })
      // Refresh the server-rendered daily score card (Hydration changed).
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">💧 Water</h2>
        <p className="text-xs opacity-60">
          <strong>{(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)} L</strong>
          <span className="opacity-60"> / {(target / 1000).toFixed(1)} L</span>
          <span className="ml-2 opacity-50">{glasses} {glasses === 1 ? 'glass' : 'glasses'}</span>
        </p>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded bg-black/10 dark:bg-white/10">
        <div
          className={`h-full transition-[width] duration-300 ${pct >= 100 ? 'bg-sky-500' : 'bg-sky-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => adjust(250)}
          disabled={busy}
          className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-sm text-sky-700 hover:bg-sky-500/20 disabled:opacity-40 dark:text-sky-300"
        >
          + Glass (250 ml)
        </button>
        <button
          type="button"
          onClick={() => adjust(500)}
          disabled={busy}
          className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-sm text-sky-700 hover:bg-sky-500/20 disabled:opacity-40 dark:text-sky-300"
        >
          + Bottle (500 ml)
        </button>
        <button
          type="button"
          onClick={() => adjust(-250)}
          disabled={busy || ml === 0}
          className="rounded-full border border-black/15 px-3 py-1 text-sm opacity-70 hover:opacity-100 disabled:opacity-30 dark:border-white/20"
        >
          Undo
        </button>
      </div>
    </section>
  )
}
