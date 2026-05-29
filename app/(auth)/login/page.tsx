'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginFallback() {
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

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') ?? '/dashboard'

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string; needs_profile?: boolean }
      if (!res.ok) {
        setError(json.error === 'invalid_code' ? 'That code didn\'t match. Check with whoever sent it.' : 'Login failed.')
        return
      }
      router.push(json.needs_profile ? '/profile' : from)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <form onSubmit={submit} className="w-full max-w-sm space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Family Health Ranks</h1>
          <p className="mt-1 text-sm opacity-70">Enter the participation code you were sent.</p>
        </header>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide opacity-60">Code</span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="FAM-2026-XXXXXXX-XXX"
            className="mt-1 block w-full rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono tracking-wider focus:border-foreground focus:outline-none dark:border-white/20"
            required
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={busy || code.trim().length < 8}
          className="w-full rounded-md bg-foreground py-2 text-background disabled:opacity-40"
        >
          {busy ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </main>
  )
}
