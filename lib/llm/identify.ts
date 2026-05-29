/**
 * Stage 1 of the identification pipeline: ask Gemini 2.5 Flash to describe
 * the foods on the plate, freely. We deliberately DO NOT constrain the model
 * to taxonomy food_ids here — that's what the resolver does. Cramming 80+
 * enum values into a structured-output schema would degrade Gemini's
 * extraction accuracy.
 */

import { generateJson } from './gemini'

export type Portion = 'small' | 'medium' | 'large'

export type FoodCategory =
  | 'grain' | 'protein' | 'vegetable' | 'fruit' | 'dairy'
  | 'snack' | 'beverage' | 'mixed_dish' | 'fat_oil' | 'sweet'

export type FoodQuality = 'whole_foods' | 'mixed' | 'processed' | 'ultra_processed'

export type Per100g = {
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sat_fat_g: number
  sugar_g: number
  sodium_mg: number
  kcal: number
}

export type IdentifiedItem = {
  description: string
  suggested_portion: Portion
  confidence: number
  /**
   * LLM's nutrient estimate per 100 g. Used as a FALLBACK when the taxonomy
   * resolver can't match this item to a curated food_items row. For matched
   * items we still prefer the taxonomy's macros (more accurate / consistent),
   * but having the LLM estimate means rare or unknown foods still get scored
   * without forcing the user to pick from a finite list.
   */
  estimated_per_100g: Per100g
  category: FoodCategory
  quality_tier: FoodQuality
}

export type IdentificationResult = {
  is_food: boolean
  items: IdentifiedItem[]
  overall_confidence: number
  notes: string
}

const SYSTEM_INSTRUCTION = `You analyze meal photos for a healthy-eating tracking app.

For the given photo, identify each distinct food or drink visible on the plate/bowl/glass and estimate its nutrition. Return strictly the JSON schema, no commentary.

Rules:
- If the photo shows no food (e.g. a chair, a screenshot, a person), set is_food=false and items=[].
- Each item.description must be a short, plain-English name ("two boiled eggs", "white basmati rice", "milky chai with sugar"). Prefer the common name over brand names. Include cuisine cue when helpful.
- suggested_portion is your visual estimate of how much is on the plate: small / medium / large. Default to medium when unsure.
- confidence is 0-1, conservative. Clear well-lit recognizable dish: 0.85+. Ambiguous or occluded: 0.4-0.7. Unsure: <0.4.
- overall_confidence reflects how clearly identifiable the WHOLE meal is overall.
- notes is a one-line observation (<120 chars).

For each item also provide:
- estimated_per_100g — nutrient amounts per 100 grams of the food as served. Use authoritative typical values (USDA, IFCT). All amounts in grams except kcal (number) and sodium_mg (milligrams). NEVER zero everything out — give your best estimate even when uncertain.
- category — best fit from: grain, protein, vegetable, fruit, dairy, snack, beverage, mixed_dish, fat_oil, sweet.
- quality_tier — whole_foods (minimally processed), mixed (home-cooked with some processing), processed (commercial bread, juice, paneer dishes with cream), ultra_processed (chips, candy, instant noodles, sugary soda, fast food burgers).`

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    is_food: { type: 'boolean' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description:       { type: 'string' },
          suggested_portion: { type: 'string', enum: ['small', 'medium', 'large'] },
          confidence:        { type: 'number' },
          estimated_per_100g: {
            type: 'object',
            properties: {
              protein_g: { type: 'number' },
              carbs_g:   { type: 'number' },
              fat_g:     { type: 'number' },
              fiber_g:   { type: 'number' },
              sat_fat_g: { type: 'number' },
              sugar_g:   { type: 'number' },
              sodium_mg: { type: 'number' },
              kcal:      { type: 'number' },
            },
            required: ['protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sat_fat_g', 'sugar_g', 'sodium_mg', 'kcal'],
            propertyOrdering: ['protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sat_fat_g', 'sugar_g', 'sodium_mg', 'kcal'],
          },
          category: {
            type: 'string',
            enum: ['grain', 'protein', 'vegetable', 'fruit', 'dairy', 'snack', 'beverage', 'mixed_dish', 'fat_oil', 'sweet'],
          },
          quality_tier: {
            type: 'string',
            enum: ['whole_foods', 'mixed', 'processed', 'ultra_processed'],
          },
        },
        required: ['description', 'suggested_portion', 'confidence', 'estimated_per_100g', 'category', 'quality_tier'],
        propertyOrdering: ['description', 'suggested_portion', 'confidence', 'estimated_per_100g', 'category', 'quality_tier'],
      },
    },
    overall_confidence: { type: 'number' },
    notes: { type: 'string' },
  },
  required: ['is_food', 'items', 'overall_confidence', 'notes'],
  propertyOrdering: ['is_food', 'items', 'overall_confidence', 'notes'],
}

export async function identifyWithGemini(imageBase64: string, mimeType: string): Promise<IdentificationResult> {
  return generateJson<IdentificationResult>({
    systemInstruction: SYSTEM_INSTRUCTION,
    parts: [
      { inlineData: { mimeType, data: imageBase64 } },
      { text: 'Identify the foods in this meal photo. Return strictly the JSON schema.' },
    ],
    responseSchema: RESPONSE_SCHEMA,
  })
}
