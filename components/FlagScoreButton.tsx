'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from './design/ThemeProvider'
import { Button, Card } from './design/primitives'
import { FONT_UI, FONT_MONO } from './design/theme'

type FeedbackResponse = {
  ok: boolean
  rescored: boolean
  old_score?: number | null
  score?: number
  reason?: string
}

type Phase = 'idle' | 'open' | 'sending' | 'done'

export function FlagScoreButton({ mealId }: { mealId: string }) {
  const t = useT()
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
      router.refresh()
    } catch {
      setOutcome({ ok: false, rescored: false, reason: 'network' })
      setPhase('done')
    }
  }

  if (phase === 'done' && outcome) {
    return (
      <Card pad={12} style={{ marginTop: 12 }}>
        {outcome.rescored ? (
          <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 12.5, color: t.text }}>
            ✓ Re-checked with premium AI.{' '}
            {typeof outcome.old_score === 'number' && typeof outcome.score === 'number' ? (
              <span>
                Score {Math.round(outcome.old_score)} →{' '}
                <strong style={{ fontFamily: FONT_MONO }}>{Math.round(outcome.score)}</strong>.
              </span>
            ) : (
              <span>Updated.</span>
            )}{' '}
            <span style={{ color: t.textFaint }}>
              Scroll up to see the new foods — tweak any portion and re-score if needed.
            </span>
          </p>
        ) : (
          <p style={{ margin: 0, fontFamily: FONT_UI, fontSize: 12.5, color: t.text }}>
            ✓ Thanks — we&apos;ve flagged this for review.
            {outcome.reason === 'not_food' && ' (The AI couldn’t find food on a re-check.)'}
          </p>
        )}
      </Card>
    )
  }

  if (phase === 'open' || phase === 'sending') {
    return (
      <Card pad={12} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p
          style={{
            margin: 0,
            fontFamily: FONT_UI,
            fontWeight: 700,
            fontSize: 12.5,
            color: t.text,
          }}
        >
          What looks off? (optional)
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="e.g. that's dal, not sambar; portion was bigger"
          disabled={phase === 'sending'}
          style={{
            width: '100%',
            background: t.surface2,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: '8px 10px',
            color: t.text,
            fontFamily: FONT_UI,
            fontSize: 13,
            outline: 'none',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            kind="brand"
            onClick={send}
            disabled={phase === 'sending'}
            full
          >
            {phase === 'sending' ? 'Re-checking…' : 'Flag & re-check'}
          </Button>
          <Button kind="surface" onClick={() => setPhase('idle')} disabled={phase === 'sending'}>
            Cancel
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPhase('open')}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'center',
        fontFamily: FONT_UI,
        fontSize: 11.5,
        color: t.textFaint,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '6px 0',
        marginTop: 4,
      }}
    >
      Score looks wrong? Flag &amp; re-check with AI
    </button>
  )
}
