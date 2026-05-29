'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from './design/ThemeProvider'
import { Button, Card, IconBadge, SegTabs } from './design/primitives'
import { Icon, type IconName } from './design/Icon'
import { FONT_DISPLAY, FONT_UI } from './design/theme'

type Gender = 'male' | 'female' | 'other'
type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
type Goal = 'lose' | 'maintain' | 'gain'

type Initial = {
  age: number | null
  gender: string | null
  height_cm: number | null
  weight_kg: number | null
  activity_level: string | null
  goal: string | null
  timezone: string | null
}

const ACTIVITY_OPTS: Array<{ v: Activity; label: string; sub: string }> = [
  { v: 'sedentary', label: 'Sedentary', sub: 'Desk job, no exercise' },
  { v: 'light', label: 'Light', sub: 'Light exercise 1–3×/wk' },
  { v: 'moderate', label: 'Moderate', sub: 'Exercise 3–5×/wk' },
  { v: 'active', label: 'Active', sub: 'Exercise 6–7×/wk' },
  { v: 'very_active', label: 'Very active', sub: 'Hard daily / physical job' },
]

const GOAL_OPTS: Array<{ v: Goal; label: string; icon: IconName }> = [
  { v: 'lose', label: 'Lose', icon: 'arrow-down' },
  { v: 'maintain', label: 'Maintain', icon: 'minus' },
  { v: 'gain', label: 'Gain', icon: 'arrow-up' },
]

function computeTargets({
  age,
  gender,
  height_cm,
  weight_kg,
  activity,
  goal,
}: {
  age: number
  gender: Gender
  height_cm: number
  weight_kg: number
  activity: Activity
  goal: Goal
}): { kcal: number; protein: number } {
  const bmr =
    10 * weight_kg +
    6.25 * height_cm -
    5 * age +
    (gender === 'male' ? 5 : gender === 'female' ? -161 : -78)
  const mult =
    { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[activity] || 1.55
  let kcal = bmr * mult
  if (goal === 'lose') kcal -= 500
  if (goal === 'gain') kcal += 350
  const protPerKg = goal === 'maintain' ? 1.2 : 1.6
  return { kcal: Math.round(kcal), protein: Math.round(weight_kg * protPerKg) }
}

export function ProfileForm({ initial }: { initial: Initial }) {
  const t = useT()
  const router = useRouter()
  const browserTz =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
  const [age, setAge] = useState(initial.age ?? 30)
  const [gender, setGender] = useState<Gender>((initial.gender as Gender) ?? 'male')
  const [height, setHeight] = useState(initial.height_cm ?? 170)
  const [weight, setWeight] = useState(initial.weight_kg ?? 70)
  const [activity, setActivity] = useState<Activity>((initial.activity_level as Activity) ?? 'light')
  const [goal, setGoal] = useState<Goal>((initial.goal as Goal) ?? 'maintain')
  const [tz, setTz] = useState(initial.timezone ?? browserTz)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const target = useMemo(
    () => computeTargets({ age, gender, height_cm: height, weight_kg: weight, activity, goal }),
    [age, gender, height, weight, activity, goal],
  )

  function markDirty() {
    setSaved(false)
    setErr(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age,
          gender,
          height_cm: height,
          weight_kg: weight,
          activity_level: activity,
          goal,
          timezone: tz,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setErr(j.error ?? 'Could not save.')
        return
      }
      setSaved(true)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Live target card */}
      <Card
        pad={18}
        elev
        style={{
          background: t.dark ? t.bgElev : t.surface,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: -30,
            top: -30,
            width: 150,
            height: 150,
            borderRadius: '50%',
            background: t.brand + '1a',
            filter: 'blur(40px)',
          }}
        />
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: t.textFaint,
            marginBottom: 12,
          }}
        >
          Your daily target
        </div>
        <div style={{ display: 'flex', gap: 14, position: 'relative' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconBadge name="bolt" size={40} bg={t.brand + '22'} color={t.brand} />
            <div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize: 26,
                  color: t.text,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {target.kcal.toLocaleString()}
              </div>
              <div style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textMute, marginTop: 2 }}>
                kcal / day
              </div>
            </div>
          </div>
          <div style={{ width: 1, background: t.border }} />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconBadge name="protein" size={40} bg={t.cyan + '22'} color={t.cyan} />
            <div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize: 26,
                  color: t.text,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {target.protein}
              </div>
              <div style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textMute, marginTop: 2 }}>
                g protein
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily: FONT_UI,
            fontSize: 11.5,
            color: t.textFaint,
            position: 'relative',
          }}
        >
          Recalculated live · Mifflin-St Jeor × activity
        </div>
      </Card>

      {/* Goal */}
      <div>
        <FieldLabel>Goal</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {GOAL_OPTS.map((g) => {
            const on = goal === g.v
            return (
              <button
                key={g.v}
                type="button"
                onClick={() => {
                  setGoal(g.v)
                  markDirty()
                }}
                style={{
                  border: `1px solid ${on ? t.brand : t.border}`,
                  background: on ? t.brand + (t.dark ? '18' : '20') : t.surface,
                  borderRadius: 14,
                  padding: '13px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon name={g.icon} size={18} sw={2.4} color={on ? t.brand : t.textMute} />
                <span style={{ fontFamily: FONT_UI, fontWeight: 700, fontSize: 13, color: on ? t.text : t.textMute }}>
                  {g.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Gender */}
      <div>
        <FieldLabel>Gender</FieldLabel>
        <SegTabs<Gender>
          options={[
            { v: 'male', label: 'Male' },
            { v: 'female', label: 'Female' },
            { v: 'other', label: 'Other' },
          ]}
          value={gender}
          onChange={(v) => {
            setGender(v)
            markDirty()
          }}
        />
      </div>

      {/* Steppers */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Stepper
          label="Age"
          value={age}
          unit="yr"
          onChange={(v) => {
            setAge(v)
            markDirty()
          }}
          min={10}
          max={100}
        />
        <Stepper
          label="Height"
          value={height}
          unit="cm"
          onChange={(v) => {
            setHeight(v)
            markDirty()
          }}
          min={120}
          max={220}
        />
        <Stepper
          label="Weight"
          value={weight}
          unit="kg"
          onChange={(v) => {
            setWeight(v)
            markDirty()
          }}
          min={30}
          max={200}
        />
      </div>

      {/* Activity */}
      <div>
        <FieldLabel>Activity level</FieldLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ACTIVITY_OPTS.map((a) => {
            const on = activity === a.v
            return (
              <button
                key={a.v}
                type="button"
                onClick={() => {
                  setActivity(a.v)
                  markDirty()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  border: `1px solid ${on ? t.brand : t.border}`,
                  background: on ? t.brand + (t.dark ? '14' : '1c') : t.surface,
                  borderRadius: 14,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${on ? t.brand : t.borderHi}`,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {on && (
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.brand }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT_UI, fontWeight: 700, fontSize: 14, color: t.text }}>
                    {a.label}
                  </div>
                  <div style={{ fontFamily: FONT_UI, fontSize: 11.5, color: t.textMute }}>{a.sub}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <FieldLabel>Timezone</FieldLabel>
        <input
          value={tz}
          onChange={(e) => {
            setTz(e.target.value)
            markDirty()
          }}
          required
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

      {err && (
        <p
          style={{
            fontFamily: FONT_UI,
            fontSize: 13,
            color: 'oklch(0.68 0.2 25)',
          }}
        >
          {err}
        </p>
      )}

      <Button kind="brand" full type="submit" icon={saved ? 'check' : undefined} disabled={busy}>
        {busy ? 'Saving…' : saved ? 'Saved · targets updated' : 'Save changes'}
      </Button>
    </form>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const t = useT()
  return (
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
      {children}
    </div>
  )
}

function Stepper({
  label,
  value,
  unit,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string
  value: number
  unit: string
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
}) {
  const t = useT()
  const btn = (icon: IconName, d: number) => (
    <button
      type="button"
      onClick={() => onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, value + d)))}
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        border: `1px solid ${t.border}`,
        background: t.surface2,
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
      }}
    >
      <Icon name={icon} size={16} sw={2.6} color={t.text} />
    </button>
  )
  return (
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontFamily: FONT_UI,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: t.textFaint,
          marginBottom: 7,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 14,
          padding: 6,
        }}
      >
        {btn('minus', -step)}
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: 19,
            color: t.text,
          }}
        >
          {value}
          <span style={{ fontFamily: FONT_UI, fontSize: 11, fontWeight: 600, color: t.textFaint }}> {unit}</span>
        </div>
        {btn('plus', step)}
      </div>
    </div>
  )
}
