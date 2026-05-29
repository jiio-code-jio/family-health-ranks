'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type FeedbackResponse = {
  ok: boolean
  rescored: boolean
  old_score?: number | null
  score?: number
  reason?: string
}

type Phase = 'idle' | 'open' | 'sending' | 'done'

export function FlagScoreButton({ mealId }: { mealId: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [note, setNote] = useState('')
  const [outcome, setOutcome] = useState<FeedbackResponse | null>(null)

  async function send() {
    setPhase('sending')
    try {
      const res = await fetch(`/api/meals/${mealId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || undefined }),
      })
      const json = (await res.json()) as FeedbackResponse
      setOutcome(json)
      setPhase('done')
      // Pull the freshly re-scored meal + daily total into the page.
      router.refresh()
    } catch {
      setOutcome({ ok: false, rescored: false, reason: 'network' })
      setPhase('done')
    }
  }

  if (phase === 'done' && outcome) {
    return (
      <div className="rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.03]">
        {outcome.rescored ? (
          <p>
            ✓ Re-checked with premium AI.{' '}
            {typeof outcome.old_score === 'number' && typeof outcome.score === 'number' ? (
              <span>
                Score {Math.round(outcome.old_score)} → <strong>{Math.round(outcome.score)}</strong>.
              </span>
            ) : (
              <span>Updated.</span>
            )}{' '}
            <span className="opacity-60">Scroll up to see the new foods — tweak any portion and re-score if needed.</span>
          </p>
        ) : (
          <p>
            ✓ Thanks — we’ve flagged this for review.
            {outcome.reason === 'not_food' && ' (The AI couldn’t find food on a re-check.)'}
          </p>
        )}
      </div>
    )
  }

  if (phase === 'open' || phase === 'sending') {
    return (
      <div className="space-y-2 rounded-md border border-black/10 px-3 py-3 dark:border-white/10">
        <p className="text-xs font-medium">What looks off? (optional)</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="e.g. that's dal, not sambar; portion was bigger"
          className="block w-full rounded border border-black/15 bg-transparent px-2 py-1 text-sm focus:border-foreground focus:outline-none dark:border-white/20"
          disabled={phase === 'sending'}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={send}
            disabled={phase === 'sending'}
            className="flex-1 rounded-md bg-foreground py-1.5 text-sm text-background disabled:opacity-40"
          >
            {phase === 'sending' ? 'Re-checking…' : 'Flag & re-check with AI'}
          </button>
          <button
            type="button"
            onClick={() => setPhase('idle')}
            disabled={phase === 'sending'}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPhase('open')}
      className="block w-full text-center text-[11px] opacity-50 hover:opacity-80"
    >
      Score looks wrong? Flag &amp; re-check with AI
    </button>
  )
}
