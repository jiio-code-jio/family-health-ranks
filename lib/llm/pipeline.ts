/**
 * The full identification pipeline for one meal.
 *
 * Stage 1   — Gemini 2.5 Flash vision → open-ended {is_food, items, confidence, notes}
 * Stage 1.5 — Taxonomy resolver maps each free-text description to a food_id
 *             (vector search + optional disambig LLM)
 * Stage 2   — If confidence too low OR ≥2 items came back unmatched,
 *             re-run Stage 1 with GPT-4.1 mini (when configured) and re-resolve.
 * Persist   — Write llm_suggested_foods + overall_confidence + used_premium_model,
 *             flip processing_status to 'awaiting_confirmation' (or 'rejected_not_food').
 *
 * Scoring (Stage 3) is NOT here — that runs only when the user confirms the
 * foods in the UI (Phase 6).
 */

import { adminClient } from '@/lib/supabase/admin'
import { resolveDescription, type Resolution } from '@/lib/taxonomy/resolver'
import { searchByText } from '@/lib/taxonomy/loader'
import { identifyWithGemini, type IdentificationResult, type IdentifiedItem, type Per100g, type FoodCategory, type FoodQuality } from './identify'
import { identifyWithOpenAI, openaiConfigured } from './openai'
import { log } from '@/lib/log'

const ESCALATE_OVERALL_CONFIDENCE = 0.65
const ESCALATE_ITEM_CONFIDENCE = 0.5
const ESCALATE_UNMATCHED_COUNT = 2

/**
 * Suggestion shape persisted to meals.llm_suggested_foods. Every item is
 * SCORE-ABLE — either via taxonomy lookup (resolved_food_id present) or via the
 * LLM's own macro estimate (estimated_per_100g + llm_category + llm_quality).
 *
 * This is the architectural shift from "force user to pick from taxonomy" to
 * "LLM identifies, taxonomy refines when available, user just tweaks".
 */
export type ResolvedSuggestion = {
  description: string
  portion: 'small' | 'medium' | 'large'
  resolved_food_id: string | null
  resolution: 'auto' | 'llm_disambig' | 'llm_estimate'
  candidates: Array<{ food_id: string; display_name: string; similarity: number }>
  // LLM fallback fields — always present so the meal is score-able without
  // a taxonomy match. For resolved items these are kept for reference but
  // the taxonomy values are used at score time.
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

    // 3. Stage 1.5 — resolve each item against the taxonomy
    let resolved = await resolveAll(stage1.items)

    // 4. Decide whether to escalate
    const lowOverall = stage1.overall_confidence < ESCALATE_OVERALL_CONFIDENCE
    const anyLowItem = stage1.items.some((i) => i.confidence < ESCALATE_ITEM_CONFIDENCE)
    // "Needs help" now means LLM-estimate fallback (no taxonomy match). If
    // several items couldn't be matched we still escalate to the premium
    // model, which may identify them more precisely.
    const unmatchedCount = resolved.filter((r) => r.resolution === 'llm_estimate').length
    const wantEscalate = lowOverall || anyLowItem || unmatchedCount >= ESCALATE_UNMATCHED_COUNT
    const canEscalate = openaiConfigured()

    let usedPremium = stage1FromPremium
    let final = stage1

    if (!stage1FromPremium && wantEscalate && canEscalate) {
      log.info('pipeline.escalate', 'low confidence, retrying with openai', {
        meal_id: mealId, low_overall: lowOverall, any_low_item: anyLowItem, unmatched: unmatchedCount,
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
        resolved = await resolveAll(stage2.items)
        usedPremium = true
      } catch (err) {
        // Premium failed — keep Gemini's result rather than fail the whole meal.
        log.warn('pipeline.escalate', 'openai failed; keeping gemini result', { meal_id: mealId, error: msgOf(err) })
      }
    }

    // 5. Persist + flip status
    await supabase.from('meals').update({
      llm_suggested_foods: resolved,
      overall_confidence: final.overall_confidence,
      used_premium_model: usedPremium,
      processing_status: 'awaiting_confirmation',
    }).eq('id', mealId)
    log.info('pipeline.done', 'awaiting_confirmation', {
      meal_id: mealId, ms: Date.now() - t0, premium: usedPremium,
      resolved: resolved.filter((r) => r.resolved_food_id).length,
      unmatched: resolved.filter((r) => !r.resolved_food_id).length,
    })
  } catch (err) {
    await markFailed(mealId, `unexpected: ${msgOf(err)}`)
  }
}

async function resolveAll(items: IdentificationResult['items']): Promise<ResolvedSuggestion[]> {
  // Run resolver calls in parallel — resolver does its own DB + Gemini calls.
  return Promise.all(items.map(async (item) => {
    const llmFields = {
      estimated_per_100g: item.estimated_per_100g,
      llm_category: item.category,
      llm_quality: item.quality_tier,
    }

    let r: Resolution
    try {
      r = await resolveDescription(item.description)
    } catch (err) {
      // Embed / vector search failed (typically Gemini 503). With LLM-first
      // scoring this is fine — we still have the LLM's macros and quality
      // tier, so the meal scores correctly without a taxonomy match. Show
      // text-search candidates as suggestions in case the user wants to
      // swap to a taxonomy item.
      log.warn('pipeline.resolve', 'resolver failed, using llm estimate', {
        description: item.description, error: msgOf(err),
      })
      const fallback = await searchByText(item.description, 5).catch(() => [])
      return {
        description: item.description,
        portion: item.suggested_portion,
        resolved_food_id: null,
        resolution: 'llm_estimate' as const,
        candidates: fallback,
        ...llmFields,
      }
    }
    // Same fallback for legitimate vector-search misses — but we tag them as
    // llm_estimate so the UI knows to trust the LLM's macros for scoring.
    return {
      description: item.description,
      portion: item.suggested_portion,
      resolved_food_id: r.kind === 'unmatched' ? null : r.food_id,
      resolution: r.kind === 'unmatched' ? 'llm_estimate' : r.kind,
      candidates: r.candidates,
      ...llmFields,
    }
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
