'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

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

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: 'Google sign-in was cancelled. Try again.',
  missing_code: 'Sign-in didn’t complete. Try again.',
  bad_state: 'Your sign-in link expired. Try again.',
  exchange_failed: 'Could not verify your Google account. Try again.',
  create_failed: 'Could not create your account. Try again.',
  google_not_configured: 'Google sign-in isn’t set up yet. Contact the admin.',
}

function LoginForm() {
  const params = useSearchParams()
  const from = params.get('from') ?? '/dashboard'
  const error = params.get('error')

  function signIn() {
    const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
    const url = new URL('/api/auth/google/start', window.location.origin)
    if (from) url.searchParams.set('from', from)
    if (tz) url.searchParams.set('tz', tz)
    window.location.href = url.toString()
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Family Health Ranks</h1>
          <p className="mt-1 text-sm opacity-70">Sign in to track and rank your family’s nutrition.</p>
        </header>

        {error && <p className="text-sm text-red-500">{ERROR_MESSAGES[error] ?? 'Sign-in failed. Try again.'}</p>}

        <button
          type="button"
          onClick={signIn}
          className="flex w-full items-center justify-center gap-3 rounded-md border border-black/15 bg-white py-2.5 font-medium text-black transition hover:bg-black/[0.03] dark:border-white/20"
        >
          <GoogleMark />
          Sign in with Google
        </button>

        <p className="text-center text-[11px] opacity-50">
          We only use your Google account to identify you. No passwords, no codes.
        </p>
      </div>
    </main>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.06l3.01-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  )
}
