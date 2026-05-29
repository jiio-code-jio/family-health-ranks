import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { computeTargets } from '@/lib/nutrition/targets'

const Body = z.object({
  age: z.number().int().min(10).max(100),
  gender: z.enum(['male', 'female', 'other']),
  height_cm: z.number().min(100).max(230),
  weight_kg: z.number().min(25).max(250),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  goal: z.enum(['lose', 'maintain', 'gain']),
  timezone: z.string().min(1).max(64),
})

export async function PATCH(req: NextRequest) {
  const sess = await getSession()
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const targets = computeTargets(body)
  const supabase = adminClient()
  const { error } = await supabase
    .from('users')
    .update({
      age: body.age,
      gender: body.gender,
      height_cm: body.height_cm,
      weight_kg: body.weight_kg,
      activity_level: body.activity_level,
      goal: body.goal,
      timezone: body.timezone,
      daily_kcal_target: targets.daily_kcal_target,
      daily_protein_target_g: targets.daily_protein_target_g,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sess.sub)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, targets })
}
