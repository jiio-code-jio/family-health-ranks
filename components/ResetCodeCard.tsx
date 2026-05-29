'use client'

import { useState } from 'react'

/**
 * "Reset & reveal login code" — shown on the profile page for every user.
 *
 * Because codes are stored as a one-way hash, the system can never show you the
 * current one. Instead we mint a NEW code, store it hashed, and show the
 * plaintext exactly once. The old code is immediately invalid.
 *
 * Typical use: "I got a new phone and forgot to save my code."
 */
export function ResetCodeCard() {
  type Phase = 'idle' | 'confirming' | 'busy' | 'revealed'
  const [phase, setPhase] = useState<Phase>('idle')
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reset() {
    setPhase('busy')
    setError(null)
    try {
      const res = await fetch('/api/profile/reset-code', { method: 'POST' })
      const json = (await res.json()) as { ok?: boolean; code?: string; error?: string }
      if (!res.ok || !json.code) {
        setError(json.error ?? 'Could not reset code. Try again.')
        setPhase('confirming')
        return
      }
      setCode(json.code)
      setPhase('revealed')
    } catch {
      setError('Network error. Try again.')
      setPhase('confirming')
    }
  }

  async function copy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked — user can select manually */ }
  }

  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.02] px-4 py-3 dark:border-white/15 dark:bg-white/[0.03]">
      <h2 className="text-xs font-medium uppercase tracking-wide opacity-60">Login code</h2>

      {phase === 'idle' && (
        <>
          <p className="mt-1 text-xs opacity-60">
            Need your code for a new device? Reset it here — we&apos;ll show the new one once.
          </p>
          <button
            type="button"
            onClick={() => setPhase('confirming')}
            className="mt-3 rounded-md border border-black/15 px-3 py-1.5 text-xs dark:border-white/20"
          >
            Reset &amp; reveal my code
          </button>
        </>
      )}

      {phase === 'confirming' && (
        <>
          <p className="mt-1 text-xs opacity-60">
            This invalidates your current code immediately. Continue?
          </p>
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background"
            >
              Yes, reset it
            </button>
            <button
              type="button"
              onClick={() => { setPhase('idle'); setError(null) }}
              className="rounded-md border border-black/15 px-3 py-1.5 text-xs dark:border-white/20"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {phase === 'busy' && (
        <p className="mt-2 text-xs opacity-50">Generating new code…</p>
      )}

      {phase === 'revealed' && code && (
        <>
          <p className="mt-2 font-mono text-lg font-semibold tracking-widest">{code}</p>
          <p className="mt-1 text-xs opacity-60">
            Save this — it&apos;s shown only once. If you lose it again, come back here to reset.
          </p>
          <button
            type="button"
            onClick={copy}
            className="mt-2 rounded-md bg-foreground px-3 py-1.5 text-xs text-background"
          >
            {copied ? 'Copied ✓' : 'Copy code'}
          </button>
        </>
      )}
    </div>
  )
}
