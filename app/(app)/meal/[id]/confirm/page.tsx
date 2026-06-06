import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { adminClient } from '@/lib/supabase/admin'
import type { Per100g, Category, QualityTier } from '@/lib/taxonomy/loader'
import { ConfirmPanel } from './ConfirmPanel'
import type { DraftItem } from '@/components/ConfirmFoodChips'
import { ConfirmHeader } from './ConfirmHeader'

type Suggestion = {
  description: string
  portion: 'small' | 'medium' | 'large'
  estimated_per_100g: Per100g
  llm_category: Category
  llm_quality: QualityTier
}

type ConfirmedFood = {
  display_name: string
  llm_macros_per_100g: Per100g
  llm_category: Category
  llm_quality: QualityTier
  portion_size: 'small' | 'medium' | 'large' | 'custom'
  portion_g: number
}

const FALLBACK_DEFAULTS = { small: 80, medium: 150, large: 250 }

export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const sess = await getSession()
  if (!sess) redirect('/login')

  const { id } = await params
  const supabase = adminClient()
  const { data: meal } = await supabase
    .from('meals')
    .select('id, user_id, meal_type, eaten_at, image_path, processing_status, llm_suggested_foods, confirmed_foods, overall_confidence, used_premium_model')
    .eq('id', id)
    .single()

  if (!meal) notFound()
  if (meal.user_id !== sess.sub) redirect('/dashboard')

  if (meal.processing_status === 'pending_identify') {
    return <Notice title="Still analyzing…" body="Come back in a few seconds. Pull-to-refresh if needed." />
  }
  if (meal.processing_status === 'rejected_not_food') {
    return <Notice title="No food detected" body="That photo didn't look like a meal. Try uploading another." />
  }
  if (meal.processing_status === 'failed') {
    return <Notice title="Identification failed" body="Something went wrong on our side. Try deleting and re-uploading." />
  }

  const suggestions = (meal.llm_suggested_foods ?? []) as Suggestion[]
  const confirmed = (meal.confirmed_foods ?? []) as ConfirmedFood[]

  const { data: signed } = await supabase.storage.from('meals').createSignedUrl(meal.image_path, 600)

  const drafts =
    confirmed.length > 0
      ? confirmedToDrafts(confirmed)
      : suggestionsToDrafts(suggestions)

  return (
    <section
      style={{ maxWidth: 460, margin: '0 auto', padding: '60px 18px 0' }}
    >
      <ConfirmHeader
        imageUrl={signed?.signedUrl ?? null}
        itemCount={drafts.length}
        mealType={meal.meal_type}
        eatenAt={meal.eaten_at}
        usedPremium={meal.used_premium_model === true}
      />

      <ConfirmPanel
        mealId={meal.id}
        initial={drafts}
        alreadyScored={meal.processing_status === 'scored'}
      />

      <div style={{ height: 24 }} />
    </section>
  )
}

function suggestionsToDrafts(suggestions: Suggestion[]): DraftItem[] {
  return suggestions.map((s): DraftItem => ({
    draft_id: cryptoRandom(),
    display_name: titleCase(s.description),
    defaults: FALLBACK_DEFAULTS,
    portion: { size: s.portion, grams: FALLBACK_DEFAULTS[s.portion] },
    description: s.description,
    llm_macros_per_100g: s.estimated_per_100g,
    llm_category: s.llm_category,
    llm_quality: s.llm_quality,
  }))
}

function confirmedToDrafts(confirmed: ConfirmedFood[]): DraftItem[] {
  return confirmed.map((c): DraftItem => ({
    draft_id: cryptoRandom(),
    display_name: c.display_name,
    defaults: FALLBACK_DEFAULTS,
    portion: { size: c.portion_size, grams: c.portion_g },
    llm_macros_per_100g: c.llm_macros_per_100g,
    llm_category: c.llm_category,
    llm_quality: c.llm_quality,
  }))
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function cryptoRandom(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section
      style={{
        maxWidth: 460,
        margin: '0 auto',
        padding: '120px 24px 0',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h1 style={{ fontFamily: 'var(--font-archivo-expanded), var(--font-archivo)', fontWeight: 800, fontSize: 22 }}>
        {title}
      </h1>
      <p style={{ fontSize: 14, opacity: 0.7 }}>{body}</p>
      <Link
        href="/dashboard"
        style={{
          alignSelf: 'center',
          background: '#CBFF3C',
          color: '#10160A',
          borderRadius: 16,
          padding: '12px 18px',
          fontFamily: 'var(--font-archivo), system-ui, sans-serif',
          fontWeight: 700,
          fontSize: 14,
          textDecoration: 'none',
        }}
      >
        Back to dashboard
      </Link>
    </section>
  )
}
