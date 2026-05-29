'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CameraCapture } from '@/components/CameraCapture'

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
  { value: 'lunch',     label: 'Lunch' },
  { value: 'snack',     label: 'Snack' },
  { value: 'dinner',    label: 'Dinner' },
  { value: 'other',     label: 'Other' },
]

type Phase = 'idle' | 'uploading' | 'submitted'

export default function NewMealPage() {
  const router = useRouter()
  const defaultType = useMemo(() => inferMealType(), [])
  const [mealType, setMealType] = useState<MealType>(defaultType)
  const [file, setFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0) // 0-100
  const [error, setError] = useState<string | null>(null)
  const submittedRef = useRef(false)

  // Warn before navigation if there's a selected photo that hasn't been submitted yet.
  // Without this, a tap on "Rank" wipes the in-progress selection silently.
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
    if (!file) return setError('Pick a photo first.')
    setError(null)
    setPhase('uploading')
    setProgress(0)

    const form = new FormData()
    form.append('image', file, 'meal.jpg')
    form.append('meal_type', mealType)
    form.append('eaten_at', new Date().toISOString())
    if (metadata.trim()) form.append('metadata', metadata.trim())

    // XHR instead of fetch so we can report upload progress to the user — fetch
    // doesn't expose an upload-progress event in any stable browser yet.
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
        try { msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg } catch { /* keep default */ }
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
    phase === 'uploading' && progress < 100 ? `Uploading ${progress}%…` :
    phase === 'uploading'                   ? 'Saving…' :
    phase === 'submitted'                   ? 'Saved' :
                                              'Save meal'

  return (
    <section className="mx-auto max-w-md space-y-6 px-6 py-8">
      <header>
        <h1 className="text-xl font-semibold">Log a meal</h1>
        <p className="text-sm opacity-70">Snap or pick a photo — we’ll identify it and let you confirm before scoring.</p>
      </header>

      <form onSubmit={submit} className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setMealType(t.value)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                mealType === t.value
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-black/15 dark:border-white/20'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <CameraCapture onFile={setFile} disabled={busy} />

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide opacity-60">Note (optional)</span>
          <input
            type="text"
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            maxLength={500}
            placeholder="e.g. extra ghee, shared with brother"
            className="mt-1 block w-full rounded-md border border-black/15 bg-transparent px-3 py-2 focus:border-foreground focus:outline-none dark:border-white/20"
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {phase === 'uploading' && (
          <div className="h-1 w-full overflow-hidden rounded bg-black/10 dark:bg-white/10">
            <div className="h-full bg-foreground transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !file}
          className="w-full rounded-md bg-foreground py-2 text-background disabled:opacity-40"
        >
          {buttonLabel}
        </button>
      </form>
    </section>
  )
}
