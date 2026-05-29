'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CameraCapture } from '@/components/CameraCapture'
import { useT } from '@/components/design/ThemeProvider'
import { Button, Chip } from '@/components/design/primitives'
import { Icon } from '@/components/design/Icon'
import { FONT_DISPLAY, FONT_MONO, FONT_UI } from '@/components/design/theme'

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'other'

function inferMealType(now = new Date()): MealType {
  const h = now.getHours()
  if (h >= 5 && h < 11) return 'breakfast'
  if (h >= 11 && h < 15) return 'lunch'
  if (h >= 15 && h < 18) return 'snack'
  if (h >= 18 && h < 23) return 'dinner'
  return 'other'
}

const TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snack', label: 'Snack' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'other', label: 'Other' },
]

type Phase = 'idle' | 'uploading' | 'submitted'

export default function NewMealPage() {
  const t = useT()
  const router = useRouter()
  const defaultType = useMemo(() => inferMealType(), [])
  const [mealType, setMealType] = useState<MealType>(defaultType)
  const [file, setFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (file && !submittedRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [file])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('Pick a photo first.')
      return
    }
    setError(null)
    setPhase('uploading')
    setProgress(0)

    const form = new FormData()
    form.append('image', file, 'meal.jpg')
    form.append('meal_type', mealType)
    form.append('eaten_at', new Date().toISOString())
    if (metadata.trim()) form.append('metadata', metadata.trim())

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/meals')
    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        submittedRef.current = true
        setPhase('submitted')
        router.push('/dashboard')
        router.refresh()
      } else {
        let msg = 'Upload failed.'
        try {
          msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg
        } catch {
          /* keep default */
        }
        setError(msg)
        setPhase('idle')
      }
    })
    xhr.addEventListener('error', () => {
      setError('Network error. Check your connection.')
      setPhase('idle')
    })
    xhr.send(form)
  }

  const busy = phase !== 'idle'
  const buttonLabel =
    phase === 'uploading' && progress < 100
      ? `Uploading ${progress}%…`
      : phase === 'uploading'
        ? 'Saving…'
        : phase === 'submitted'
          ? 'Saved'
          : 'Save meal'

  return (
    <section style={{ maxWidth: 460, margin: '0 auto', padding: '60px 18px 0' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
          }}
          aria-label="Back"
        >
          <Icon name="chevron-left" size={24} sw={2.4} color={t.text} />
        </button>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: 20,
            color: t.text,
          }}
        >
          New meal
        </div>
        <div style={{ width: 24 }} />
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Meal type chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TYPES.map((ty) => (
            <Chip
              key={ty.value}
              active={mealType === ty.value}
              onClick={() => setMealType(ty.value)}
            >
              {ty.label}
            </Chip>
          ))}
        </div>

        <CameraCapture onFile={setFile} disabled={busy} />

        {/* Note */}
        <div>
          <div
            style={{
              fontFamily: FONT_UI,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: t.textFaint,
              margin: '0 0 7px 2px',
            }}
          >
            Note (optional)
          </div>
          <input
            type="text"
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            maxLength={500}
            placeholder="e.g. extra ghee, shared with brother"
            style={{
              width: '100%',
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: '12px 14px',
              color: t.text,
              fontFamily: FONT_UI,
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        {error && (
          <p
            style={{
              fontFamily: FONT_UI,
              fontSize: 13,
              color: 'oklch(0.68 0.2 25)',
              margin: 0,
            }}
          >
            {error}
          </p>
        )}

        {phase === 'uploading' && (
          <div
            style={{
              height: 6,
              borderRadius: 99,
              background: t.track,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${t.brand}aa, ${t.brand})`,
                boxShadow: `0 0 10px ${t.brand}88`,
                transition: 'width .2s ease',
              }}
            />
          </div>
        )}

        <Button kind="brand" full type="submit" disabled={busy || !file} icon="spark">
          {buttonLabel}
        </Button>

        {phase === 'uploading' && (
          <div
            style={{
              textAlign: 'center',
              fontFamily: FONT_MONO,
              fontSize: 11,
              color: t.textFaint,
            }}
          >
            We&apos;ll identify it and let you confirm before scoring.
          </div>
        )}
      </form>
    </section>
  )
}
