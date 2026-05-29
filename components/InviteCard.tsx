'use client'

import { useEffect, useState } from 'react'

type Invite = { token: string; used_count: number; created_at: string }

/**
 * Admin-only card: shows the reusable family invite link with copy + rotate.
 * Rendered only when the dashboard knows the viewer is an admin. Self-fetches
 * (and auto-creates) the active invite from /api/admin/invite.
 */
export function InviteCard() {
  const [invite, setInvite] = useState<Invite | null>(null)
  const [loading, setLoading] = useState(true)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/admin/invite')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((d: Invite) => alive && setInvite(d))
      .catch(() => alive && setError('Could not load invite link.'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const link = invite
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join?invite=${invite.token}`
    : ''

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked — user can select manually */ }
  }

  async function rotate() {
    if (!confirm('Rotate the invite link? The old link stops working immediately.')) return
    setRotating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/invite', { method: 'POST' })
      if (!res.ok) throw new Error('rotate failed')
      setInvite((await res.json()) as Invite)
    } catch {
      setError('Could not rotate the link.')
    } finally {
      setRotating(false)
    }
  }

  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.02] px-4 py-3 dark:border-white/15 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide opacity-60">Family invite link</h2>
        <span className="text-[11px] opacity-50">admin</span>
      </div>
      <p className="mt-1 text-xs opacity-60">
        Share this once. Anyone who opens it creates their own account — no codes to hand out.
      </p>

      {loading ? (
        <p className="mt-3 text-sm opacity-50">Loading…</p>
      ) : error && !invite ? (
        <p className="mt-3 text-sm text-red-500">{error}</p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 truncate rounded-md border border-black/15 bg-transparent px-2 py-1.5 font-mono text-xs dark:border-white/20"
            />
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs text-background"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] opacity-50">
              {invite ? `${invite.used_count} joined via this link` : ''}
            </span>
            <button
              type="button"
              onClick={rotate}
              disabled={rotating}
              className="text-[11px] opacity-60 hover:opacity-100 disabled:opacity-30"
            >
              {rotating ? 'Rotating…' : 'Rotate link'}
            </button>
          </div>
          {error && invite && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
        </>
      )}
    </div>
  )
}
