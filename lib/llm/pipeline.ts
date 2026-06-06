/**
 * The full identification pipeline for one meal.
 *
 * Stage 1 — Gemini 2.5 Flash vision → open-ended {is_food, items, confidence, notes}.
 *           Each item already carries its own estimated_per_100g + category +
 *           quality_tier, so the meal is fully score-able from this alone.
 * Stage 2 — If overall confidence is low OR any single item is low-confidence,
 *           re-run Stage 1 with GPT-4.1 mini (when configured) for a sharper read.
 * Persist — Write llm_suggested_foods + overall_confidence + used_premium_model,
 *           flip processing_status to 'awaiting_confirmation' (or 'rejected_not_food').
 *
 * There is no taxonomy lookup anymore — the model is the single source of truth
 * for both identification and macros. Scoring (Stage 3) runs only when the user
 * confirms the foods in the UI.
 */

import { adminClient } from '@/lib/supabase/admin'
import { identifyWithGemini, type IdentificationResult, type IdentifiedItem, type Per100g, type FoodCategory, type FoodQuality } from './identify'
import { identifyWithOpenAI, openaiConfigured } from './openai'
import { log } from '@/lib/log'

const ESCALATE_OVERALL_CONFIDENCE = 0.65
const ESCALATE_ITEM_CONFIDENCE = 0.5

/**
 * Suggestion shape persisted to meals.llm_suggested_foods. Every item is
 * score-able directly from the model's own macro estimate — there is no
 * taxonomy match to fall back to.
 */
export type ResolvedSuggestion = {
  description: string
  portion: 'small' | 'medium' | 'large'
  estimated_per_100g: Per100g
  llm_category: FoodCategory
  llm_quality: FoodQuality
}

export async function runIdentificationPipeline(mealId: string): Promise<void> {
  const supabase = adminClient()
  const t0 = Date.now()
  log.info('pipeline.start', 'beginning', { meal_id: mealId })
  try {
    // 1. Fetch meal row + image bytes
    const { data: meal, error: fetchErr } = await supabase
      .from('meals')
      .select('id, image_path, processing_status')
      .eq('id', mealId)
      .single()
    if (fetchErr || !meal) return
    if (meal.processing_status !== 'pending_identify') return // already processed or being processed

    const { data: blob, error: dlErr } = await supabase.storage.from('meals').download(meal.image_path)
    if (dlErr || !blob) {
      await markFailed(mealId, `download_failed: ${dlErr?.message ?? 'no_blob'}`)
      return
    }

    const arrayBuf = await blob.arrayBuffer()
    const base64 = Buffer.from(arrayBuf).toString('base64')
    const mimeType = blob.type && blob.type !== '' ? blob.type : guessMime(meal.image_path)

    // 2. Stage 1 — Gemini identify. If Gemini fails completely (e.g. retried
    // 5xx, key revoked), cascade to OpenAI as the primary identifier rather
    // than fail the whole meal. Mark used_premium_model=true so cost is visible.
    let stage1: IdentificationResult
    let stage1FromPremium = false
    try {
      stage1 = await identifyWithGemini(base64, mimeType)
    } catch (gemErr) {
      if (!openaiConfigured()) {
        await markFailed(mealId, `gemini: ${msgOf(gemErr)}`)
        return
      }
      console.warn(`gemini stage1 failed for meal ${mealId}, falling back to openai: ${msgOf(gemErr)}`)
      try {
        stage1 = await identifyWithOpenAI(base64, mimeType)
        stage1FromPremium = true
      } catch (oaiErr) {
        await markFailed(mealId, `gemini: ${msgOf(gemErr)} | openai: ${msgOf(oaiErr)}`)
        return
      }
    }

    if (!stage1.is_food || stage1.items.length === 0) {
      await supabase.from('meals').update({
        processing_status: 'rejected_not_food',
        overall_confidence: stage1.overall_confidence,
        used_premium_model: false,
      }).eq('id', mealId)
      log.info('pipeline.done', 'rejected_not_food', { meal_id: mealId, ms: Date.now() - t0, confidence: stage1.overall_confidence })
      return
    }
    log.info('pipeline.stage1', 'identified', {
      meal_id: mealId, items: stage1.items.length, confidence: stage1.overall_confidence, premium: stage1FromPremium,
    })

    // 3. Decide whether to escalate to the premium model for a sharper read.
    const lowOverall = stage1.overall_confidence < ESCALATE_OVERALL_CONFIDENCE
    const anyLowItem = stage1.items.some((i) => i.confidence < ESCALATE_ITEM_CONFIDENCE)
    const wantEscalate = lowOverall || anyLowItem
    const canEscalate = openaiConfigured()

    let usedPremium = stage1FromPremium
    let final = stage1

    if (!stage1FromPremium && wantEscalate && canEscalate) {
      log.info('pipeline.escalate', 'low confidence, retrying with openai', {
        meal_id: mealId, low_overall: lowOverall, any_low_item: anyLowItem,
      })
      try {
        const stage2 = await identifyWithOpenAI(base64, mimeType)
        if (!stage2.is_food || stage2.items.length === 0) {
          // Premium model also says not_food → trust it.
          await supabase.from('meals').update({
            processing_status: 'rejected_not_food',
            overall_confidence: stage2.overall_confidence,
            used_premium_model: true,
          }).eq('id', mealId)
          log.info('pipeline.done', 'rejected_not_food (openai)', { meal_id: mealId, ms: Date.now() - t0 })
          return
        }
        final = stage2
        usedPremium = true
      } catch (err) {
        // Premium failed — keep Gemini's result rather than fail the whole meal.
        log.warn('pipeline.escalate', 'openai failed; keeping gemini result', { meal_id: mealId, error: msgOf(err) })
      }
    }

    // 4. Persist + flip status
    const resolved = toSuggestions(final.items)
    await supabase.from('meals').update({
      llm_suggested_foods: resolved,
      overall_confidence: final.overall_confidence,
      used_premium_model: usedPremium,
      processing_status: 'awaiting_confirmation',
    }).eq('id', mealId)
    log.info('pipeline.done', 'awaiting_confirmation', {
      meal_id: mealId, ms: Date.now() - t0, premium: usedPremium, items: resolved.length,
    })
  } catch (err) {
    await markFailed(mealId, `unexpected: ${msgOf(err)}`)
  }
}

/** Map the model's identified items into the persisted suggestion shape. */
function toSuggestions(items: IdentifiedItem[]): ResolvedSuggestion[] {
  return items.map((item) => ({
    description: item.description,
    portion: item.suggested_portion,
    estimated_per_100g: item.estimated_per_100g,
    llm_category: item.category,
    llm_quality: item.quality_tier,
  }))
}

async function markFailed(mealId: string, reason: string): Promise<void> {
  log.error('pipeline.fail', reason, { meal_id: mealId })
  await adminClient().from('meals').update({ processing_status: 'failed' }).eq('id', mealId)
}

function msgOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function guessMime(path: string): string {
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.heic')) return 'image/heic'
  return 'image/jpeg'
}
