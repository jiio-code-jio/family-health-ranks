/**
 * Seed / refresh the food_items taxonomy table from data/food_taxonomy.ts.
 *
 * Behavior:
 *   - Fetches existing food_items ids from Supabase.
 *   - For each food in FOODS that's NOT already in the table, generates an
 *     embedding via Google text-embedding-004 (free tier) and inserts.
 *   - To re-embed an existing row (e.g. you edited its display_name or aliases),
 *     pass --force which re-embeds and updates every row.
 *
 * Idempotent: running it twice does nothing the second time.
 *
 * Usage:
 *   npm run seed-taxonomy
 *   npm run seed-taxonomy -- --force
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { FOODS, type FoodItem } from '../data/food_taxonomy'

const force = process.argv.includes('--force')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const GEMINI_KEY   = process.env.GEMINI_API_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error('Missing one of: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

function embedText(item: FoodItem): string {
  return [item.display_name, ...item.aliases].join(' | ')
}

const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`

async function embed(text: string): Promise<number[]> {
  const res = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: 768,
      taskType: 'RETRIEVAL_DOCUMENT',
    }),
  })
  if (!res.ok) {
    throw new Error(`embed ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as { embedding: { values: number[] } }
  return data.embedding.values
}

async function existingIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('food_items').select('id')
  if (error) throw new Error(`fetch existing: ${error.message}`)
  return new Set((data ?? []).map((r) => r.id as string))
}

function toRow(item: FoodItem, embedding: number[]) {
  return {
    id: item.id,
    display_name: item.display_name,
    aliases: item.aliases,
    category: item.category,
    per_100g: item.per_100g,
    quality_tier: item.quality_tier,
    micronutrient_tags: item.micronutrient_tags,
    default_portion_g: item.default_portion_g,
    embedding: `[${embedding.join(',')}]`,
  }
}

async function main() {
  const have = force ? new Set<string>() : await existingIds()
  const todo = FOODS.filter((f) => !have.has(f.id))

  console.log(`Total in CSV: ${FOODS.length}`)
  console.log(`Already in DB: ${have.size}`)
  console.log(`To embed + upsert: ${todo.length}${force ? ' (--force)' : ''}`)

  if (todo.length === 0) {
    console.log('Nothing to do. Pass --force to re-embed everything.')
    return
  }

  let done = 0
  for (const item of todo) {
    const vec = await embed(embedText(item))
    const { error } = await supabase.from('food_items').upsert(toRow(item, vec))
    if (error) {
      console.error(`  ✗ ${item.id}: ${error.message}`)
      process.exit(1)
    }
    done++
    console.log(`  ✓ ${item.id.padEnd(28)} (${done}/${todo.length})`)
  }

  console.log(`\nDone. Upserted ${done} food items.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
