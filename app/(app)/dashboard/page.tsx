import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { adminClient } from '@/lib/supabase/admin'
import { userLocalDate } from '@/lib/tz'
import { fetchWeekStrip } from '@/lib/scoring/week'
import { waterTargetMl } from '@/lib/hydration'
import { fetchCurrentWeekTips } from '@/lib/tips/generate'
import { DashboardLive } from '@/components/DashboardLive'
import type { Meal } from '@/components/MealCard'

export default async function DashboardPage() {
  const sess = await getSession()
  if (!sess) redirect('/login')

  const supabase = adminClient()
  const { data: user } = await supabase
    .from('users')
    .select('display_name, weight_kg, daily_kcal_target, daily_protein_target_g, goal, timezone')
    .eq('id', sess.sub)
    .single()
  if (!user) redirect('/login')
  if (user.weight_kg === null) redirect('/profile')

  const today = userLocalDate(new Date(), user.timezone)

  const [mealsResp, dailyResp, weekDays, waterResp, tips] = await Promise.all([
    supabase
      .from('meals')
      .select('id, meal_type, eaten_at, processing_status, image_path, score, used_premium_model, metadata, confirmed_foods, macros')
      .eq('user_id', sess.sub)
      .eq('user_local_date', today)
      .order('eaten_at', { ascending: true }),
    supabase
      .from('daily_scores')
      .select('nutrition, goal_alignment, meal_timing, hydration, consistency, total_score, meal_count')
      .eq('user_id', sess.sub)
      .eq('user_local_date', today)
      .maybeSingle(),
    fetchWeekStrip(sess.sub, user.timezone),
    supabase
      .from('daily_water')
      .select('ml')
      .eq('user_id', sess.sub)
      .eq('user_local_date', today)
      .maybeSingle(),
    fetchCurrentWeekTips(sess.sub, user.timezone),
  ])

  const meals = (mealsResp.data ?? []) as Meal[]
  const daily = dailyResp.data
    ? {
        nutrition: Number(dailyResp.data.nutrition),
        goal_alignment: Number(dailyResp.data.goal_alignment),
        meal_timing: Number(dailyResp.data.meal_timing),
        hydration: Number(dailyResp.data.hydration),
        consistency: Number(dailyResp.data.consistency),
        total_score: Number(dailyResp.data.total_score),
        meal_count: Number(dailyResp.data.meal_count),
      }
    : null

  return (
    <DashboardLive
      displayName={user.display_name}
      initialMeals={meals}
      initialDate={today}
      daily={daily}
      targets={{
        daily_kcal_target: Number(user.daily_kcal_target),
        daily_protein_target_g: Number(user.daily_protein_target_g),
        goal: user.goal ?? 'maintain',
      }}
      weekDays={weekDays}
      water={{
        date: today,
        ml: Number(waterResp.data?.ml ?? 0),
        target_ml: waterTargetMl(user.weight_kg),
      }}
      tips={tips}
    />
  )
}
