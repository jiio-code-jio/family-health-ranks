'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinFallback />}>
      <JoinForm />
    </Suspense>
  )
}

function JoinFallback() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6 opacity-60">
        <header>
          <h1 className="text-2xl font-semibold">Family Health Ranks</h1>
          <p className="mt-1 text-sm opacity-70">Loading…</p>
        </header>
      </div>
    </main>
  )
}

function JoinForm() {
  const router = useRouter()
  const params = useSearchParams()
  const inviteToken = params.get('invite') ?? ''
  const browserTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'

  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // After success, we hold the one-time plaintext code here before navigating.
  const [myCode, setMyCode] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken, display_name: name.trim(), timezone: browserTz }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string; code?: string }
      if (!res.ok) {
        setError(
          json.error === 'invalid_invite'
            ? 'This invite link is no longer valid. Ask whoever shared it for a fresh one.'
            : 'Could not create your account. Try again.',
        )
        return
      }
      // Show the code before navigating — user must save it for new-device login.
      setMyCode(json.code ?? null)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function copyCode() {
    if (!myCode) return
    try {
      await navigator.clipboard.writeText(myCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }

  // — Code reveal screen —
  if (myCode) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-6">
          <header>
            <h1 className="text-2xl font-semibold">You&apos;re in, {name}! 🎉</h1>
            <p className="mt-1 text-sm opacity-70">Save your personal login code below.</p>
          </header>

          <div className="rounded-lg border border-black/10 bg-black/[0.02] p-4 dark:border-white/15 dark:bg-white/[0.03]">
            <p className="text-xs font-medium uppercase tracking-wide opacity-60">Your login code</p>
            <p className="mt-2 font-mono text-xl font-semibold tracking-widest">{myCode}</p>
            <p className="mt-2 text-xs opacity-60">
              Use this to log in on any new device. We store it hashed — this is the only time you&apos;ll see it.
              If you lose it you can reset it from your profile while still logged in.
            </p>
            <button
              type="button"
              onClick={copyCode}
              className="mt-3 rounded-md bg-foreground px-4 py-2 text-sm text-background"
            >
              {codeCopied ? 'Copied ✓' : 'Copy code'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="w-full rounded-md bg-foreground py-2 text-background"
          >
            Continue to profile setup →
          </button>

          <p className="text-center text-[11px] opacity-50">
            Next you&apos;ll add a few body stats so we can score your meals correctly.
          </p>
        </div>
      </main>
    )
  }

  // — No invite token in URL —
  if (!inviteToken) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-3 text-center">
          <h1 className="text-2xl font-semibold">Family Health Ranks</h1>
          <p className="text-sm opacity-70">
            This page needs an invite link. Ask a family member to send you one.
          </p>
        </div>
      </main>
    )
  }

  // — Join form —
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <form onSubmit={submit} className="w-full max-w-sm space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Join Family Health Ranks</h1>
          <p className="mt-1 text-sm opacity-70">You&apos;ve been invited. What should we call you?</p>
        </header>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide opacity-60">Your name</span>
          <input
            type="text"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ravi"
            className="mt-1 block w-full rounded-md border border-black/15 bg-transparent px-3 py-2 focus:border-foreground focus:outline-none dark:border-white/20"
            required
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={busy || name.trim().length < 1}
          className="w-full rounded-md bg-foreground py-2 text-background disabled:opacity-40"
        >
          {busy ? 'Creating your account…' : 'Continue'}
        </button>

        <p className="text-center text-[11px] opacity-50">
          Next you&apos;ll add a few body stats so we can score your meals.
        </p>
      </form>
    </main>
  )
}
