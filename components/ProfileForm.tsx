'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Initial = {
  age: number | null
  gender: string | null
  height_cm: number | null
  weight_kg: number | null
  activity_level: string | null
  goal: string | null
  timezone: string | null
}

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter()
  const browserTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
  const [age, setAge] = useState(initial.age ?? 30)
  const [gender, setGender] = useState((initial.gender ?? 'male') as 'male' | 'female' | 'other')
  const [height, setHeight] = useState(initial.height_cm ?? 170)
  const [weight, setWeight] = useState(initial.weight_kg ?? 70)
  const [activity, setActivity] = useState((initial.activity_level ?? 'light') as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active')
  const [goal, setGoal] = useState((initial.goal ?? 'maintain') as 'lose' | 'maintain' | 'gain')
  const [tz, setTz] = useState(initial.timezone ?? browserTz)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age, gender, height_cm: height, weight_kg: weight,
          activity_level: activity, goal, timezone: tz,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setErr(j.error ?? 'Could not save.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-sm">
      <Row label="Age">
        <input type="number" min={10} max={100} value={age} onChange={(e) => setAge(+e.target.value)} className={input} required />
      </Row>
      <Row label="Gender">
        <select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} className={input}>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </Row>
      <Row label="Height (cm)">
        <input type="number" min={100} max={230} step="0.5" value={height} onChange={(e) => setHeight(+e.target.value)} className={input} required />
      </Row>
      <Row label="Weight (kg)">
        <input type="number" min={25} max={250} step="0.1" value={weight} onChange={(e) => setWeight(+e.target.value)} className={input} required />
      </Row>
      <Row label="Activity level">
        <select value={activity} onChange={(e) => setActivity(e.target.value as typeof activity)} className={input}>
          <option value="sedentary">Sedentary (desk job, no exercise)</option>
          <option value="light">Light (walks, light exercise 1-3×/wk)</option>
          <option value="moderate">Moderate (exercise 3-5×/wk)</option>
          <option value="active">Active (exercise 6-7×/wk)</option>
          <option value="very_active">Very active (hard daily or physical job)</option>
        </select>
      </Row>
      <Row label="Goal">
        <select value={goal} onChange={(e) => setGoal(e.target.value as typeof goal)} className={input}>
          <option value="lose">Lose weight</option>
          <option value="maintain">Maintain</option>
          <option value="gain">Gain weight / muscle</option>
        </select>
      </Row>
      <Row label="Timezone">
        <input type="text" value={tz} onChange={(e) => setTz(e.target.value)} className={input} required />
      </Row>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <button type="submit" disabled={busy} className="w-full rounded-md bg-foreground py-2 text-background disabled:opacity-40">
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}

const input = 'mt-1 block w-full rounded-md border border-black/15 bg-transparent px-3 py-2 focus:border-foreground focus:outline-none dark:border-white/20'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide opacity-60">{label}</span>
      {children}
    </label>
  )
}
