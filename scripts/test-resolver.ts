/**
 * Phase-2 verification (plan §Verification step 5a).
 *
 * Sanity-tests the taxonomy resolver against three synthetic descriptions:
 *   - clearly known    → auto
 *   - ambiguous        → llm_disambig
 *   - unknown / junk   → unmatched
 *
 * Run: npm run test-resolver
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { resolveDescription } from '../lib/taxonomy/resolver'

const CASES: Array<{ label: string; description: string; expect: string }> = [
  { label: 'clear',     description: 'two boiled eggs',                   expect: 'auto or llm_disambig → eggs_boiled' },
  { label: 'ambiguous', description: 'spicy lentil soup with vegetables', expect: 'llm_disambig → sambar / dal / rasam' },
  { label: 'unknown',   description: 'alien xyzzy food from mars',        expect: 'unmatched' },
  { label: 'south indian', description: 'two steamed rice cakes',         expect: 'auto → idli' },
  { label: 'beverage',  description: 'milky chai with sugar',             expect: 'auto → tea_milk' },
  // Regression tests for the previously-unmatched items from the user's screenshot
  { label: 'basmati',   description: 'white basmati rice',                expect: '→ rice_basmati_cooked' },
  { label: 'dal',       description: 'lentil curry (dal)',                expect: '→ dal_tadka or dal_makhani' },
  { label: 'pickle',    description: 'pickled red onions',                expect: '→ onion_pickled' },
  { label: 'lemon',     description: 'a slice of lemon',                  expect: '→ lemon' },
  { label: 'ghee',      description: 'a spoon of ghee on top',            expect: '→ ghee' },
]

async function main() {
  for (const c of CASES) {
    console.log('\n────────────────────────────────────────────')
    console.log(`[${c.label}] "${c.description}"`)
    console.log(`  expect: ${c.expect}`)
    try {
      const r = await resolveDescription(c.description)
      console.log(`  kind:   ${r.kind}`)
      if (r.kind !== 'unmatched') {
        console.log(`  match:  ${r.food_id}`)
      }
      console.log(`  top 5:`)
      for (const c2 of r.candidates) {
        console.log(`    ${c2.similarity.toFixed(3)}  ${c2.food_id.padEnd(28)}  ${c2.display_name}`)
      }
    } catch (e) {
      console.error('  ✗ error:', e instanceof Error ? e.message : e)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
