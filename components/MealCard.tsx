'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR, { mutate as swrMutate } from 'swr'

export type Meal = {
  id: string
  meal_type: string
  eaten_at: string
  processing_status: 'pending_identify' | 'awaiting_confirmation' | 'scored' | 'rejected_not_food' | 'failed'
  image_path: string | null
  score: string | number | null
  used_premium_model?: boolean
  metadata?: string | null
  confirmed_foods?: Array<{ food_id: string; portion_g?: number }> | null
}

const STATUS_LABEL: Record<Meal['processing_status'], string> = {
  pending_identify: 'Analyzing…',
  awaiting_confirmation: 'Tap to confirm',
  scored: 'Scored',
  rejected_not_food: 'No food detected',
  failed: 'Try again',
}

// Signed URLs are valid 10 min server-side; we dedupe SWR requests for 5 min so
// MealCards re-mounted after navigation (dashboard ↔ leaderboard ↔ confirm)
// read from cache instead of refetching the URL and forcing the browser to
// re-pull the image.
const URL_DEDUPE_MS = 5 * 60 * 1000

const fetchImageUrl = async (apiUrl: string): Promise<string | null> => {
  const r = await fetch(apiUrl)
  if (!r.ok) return null
  const j = (await r.json()) as { url?: string }
  return j.url ?? null
}

export function MealCard({ meal, ownerView }: { meal: Meal; ownerView: boolean }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const { data: imgUrl } = useSWR(
    meal.image_path ? `/api/meals/${meal.id}/image-url` : null,
    fetchImageUrl,
    {
      dedupingInterval: URL_DEDUPE_MS,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    },
  )

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this meal?')) return
    setDeleting(true)

    // Optimistic UI: drop the meal from any cached /api/meals?date=… list
    // immediately, so the card disappears before the server even responds.
    // The actual DELETE + recompute fires in the background; on failure we
    // revalidate to roll back. router.refresh() updates the server-rendered
    // daily score + week strip afterwards but doesn't block the user.
    const matchMealsKey = (key: unknown) => typeof key === 'string' && key.startsWith('/api/meals?date=')
    await swrMutate(
      matchMealsKey,
      (data: { meals: Meal[]; date: string } | undefined) => {
        if (!data) return data
        return { ...data, meals: data.meals.filter((m) => m.id !== meal.id) }
      },
      { revalidate: false },
    )

    try {
      const res = await fetch(`/api/meals/${meal.id}`, { method: 'DELETE' })
      if (!res.ok) {
        // Roll back the optimistic removal by forcing a re-fetch.
        await swrMutate(matchMealsKey)
        alert('Delete failed. Try again.')
        return
      }
      // Quietly refresh the server-rendered bits (daily score + week strip).
      // Not awaited — user already sees the card gone.
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  const eatenAt = new Date(meal.eaten_at)
  const time = eatenAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  // The whole card is a link in two cases: confirm UI or read-only scored view.
  // For other statuses we just show the card without a link target.
  const href =
    meal.processing_status === 'awaiting_confirmation' ? `/meal/${meal.id}/confirm` :
    meal.processing_status === 'scored'                ? `/meal/${meal.id}/confirm` :
                                                         null

  const inner = (
    <>
      <div className="relative aspect-square w-full bg-black/5 dark:bg-white/5">
        {imgUrl ? (
          <img src={imgUrl} alt={`${meal.meal_type} meal`} className="block h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs opacity-50">loading…</div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
          {meal.meal_type}
        </span>
        {meal.score !== null && (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-600/95 px-2 py-0.5 text-[11px] font-semibold text-white">
            {Math.round(Number(meal.score))}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-xs">
        <div className="space-y-0.5">
          <p className="opacity-90">{time}</p>
          <p className={`${meal.processing_status === 'awaiting_confirmation' ? 'text-amber-600 dark:text-amber-400' : 'opacity-60'}`}>
            {STATUS_LABEL[meal.processing_status]}
          </p>
        </div>
        {ownerView && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded px-2 py-1 text-red-500 hover:bg-red-500/10 disabled:opacity-40"
          >
            {deleting ? '…' : 'Delete'}
          </button>
        )}
      </div>
    </>
  )

  return (
    <article className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
      {href ? <Link href={href} className="block">{inner}</Link> : inner}
    </article>
  )
}
