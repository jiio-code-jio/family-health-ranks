/**
 * Stage 2 fallback: GPT-4.1 mini when Gemini's confidence is low or too many
 * items resolved as 'unmatched'. Same prompt/schema shape as identify.ts so
 * the rest of the pipeline doesn't care which model produced the result.
 */

import OpenAI from 'openai'
import type { IdentificationResult } from './identify'

const MODEL = 'gpt-4.1-mini'

const SYSTEM_PROMPT = `You analyze meal photos for a healthy-eating tracking app.

For the given photo, identify each distinct food or drink visible and estimate nutrition. Return strictly the JSON schema, no commentary.

Rules:
- If the photo shows no food, set is_food=false and items=[].
- description: common English name ("two boiled eggs", "white basmati rice", "milky chai with sugar"). Cuisine cue when helpful.
- suggested_portion: small | medium | large.
- confidence: 0-1, conservative. Clear: 0.85+. Ambiguous: 0.4-0.7. Unsure: <0.4.
- estimated_per_100g: typical USDA/IFCT values per 100 g of the food as served. Always provide best estimate, never all-zero.
- category: grain | protein | vegetable | fruit | dairy | snack | beverage | mixed_dish | fat_oil | sweet.
- quality_tier: whole_foods | mixed | processed | ultra_processed.
- overall_confidence: clarity of the whole meal.
- notes: one short observation, <120 chars.`

const JSON_SCHEMA = {
  name: 'meal_identification',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_food: { type: 'boolean' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            description:       { type: 'string' },
            suggested_portion: { type: 'string', enum: ['small', 'medium', 'large'] },
            confidence:        { type: 'number' },
            estimated_per_100g: {
              type: 'object',
              additionalProperties: false,
              properties: {
                protein_g: { type: 'number' }, carbs_g: { type: 'number' }, fat_g: { type: 'number' },
                fiber_g:   { type: 'number' }, sat_fat_g: { type: 'number' }, sugar_g: { type: 'number' },
                sodium_mg: { type: 'number' }, kcal: { type: 'number' },
              },
              required: ['protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sat_fat_g', 'sugar_g', 'sodium_mg', 'kcal'],
            },
            category:     { type: 'string', enum: ['grain', 'protein', 'vegetable', 'fruit', 'dairy', 'snack', 'beverage', 'mixed_dish', 'fat_oil', 'sweet'] },
            quality_tier: { type: 'string', enum: ['whole_foods', 'mixed', 'processed', 'ultra_processed'] },
          },
          required: ['description', 'suggested_portion', 'confidence', 'estimated_per_100g', 'category', 'quality_tier'],
        },
      },
      overall_confidence: { type: 'number' },
      notes: { type: 'string' },
    },
    required: ['is_food', 'items', 'overall_confidence', 'notes'],
  },
}

let _client: OpenAI | null = null
function client(): OpenAI {
  if (_client) return _client
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing')
  _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

export function openaiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}

export async function identifyWithOpenAI(imageBase64: string, mimeType: string): Promise<IdentificationResult> {
  const resp = await client().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Identify the foods in this meal photo. Return strictly the JSON schema.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
    response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
    temperature: 0,
  })
  const content = resp.choices[0]?.message?.content
  if (!content) throw new Error('openai returned no content')
  return JSON.parse(content) as IdentificationResult
}
