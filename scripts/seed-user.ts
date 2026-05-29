/**
 * Admin CLI: create a new participant — or regenerate a lost code — and print
 * the participation code.
 *
 * Create:
 *   npm run seed-user -- --name "Ravi" --tz "Asia/Kolkata"
 *
 * Regenerate a lost code (keeps the user + all their meals/scores, just issues
 * a new code and invalidates the old one):
 *   npm run seed-user -- --regenerate --name "Hari"
 *   npm run seed-user -- --regenerate --id "62bbec19-..."   # if names collide
 *
 * Output: a one-line code like FAM-2026-K7M9P3X-A2N — text it to the family
 * member. They paste it into the login page once; the code never leaves their
 * device after that (stored in an HTTP-only cookie).
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { hashCode } from '../lib/auth/code-hash'
import { generateCode } from '../lib/auth/code'

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function printCode(label: string, id: string, code: string, tz?: string) {
  console.log('')
  console.log(`  ${label}: ${id}`)
  if (tz) console.log(`  Timezone:     ${tz}`)
  console.log('')
  console.log(`  Participation code (text this to them — once entered, they stay logged in):`)
  console.log('')
  console.log(`      ${code}`)
  console.log('')
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  // ---- Regenerate an existing user's lost code ----
  if (hasFlag('--regenerate')) {
    const id = arg('--id')
    const name = arg('--name')
    if (!id && !name) {
      console.error('Regenerate needs --id "<uuid>" or --name "Display Name"')
      process.exit(1)
    }

    const lookup = supabase.from('users').select('id, display_name, timezone')
    const { data: matches, error: findErr } = id
      ? await lookup.eq('id', id)
      : await lookup.eq('display_name', name!)
    if (findErr) {
      console.error('Lookup failed:', findErr.message)
      process.exit(1)
    }
    if (!matches || matches.length === 0) {
      console.error(`No user found for ${id ? `id ${id}` : `name "${name}"`}.`)
      process.exit(1)
    }
    if (matches.length > 1) {
      console.error(`Multiple users named "${name}". Re-run with --id one of:`)
      for (const m of matches) console.error(`  ${m.id}  (${m.display_name}, ${m.timezone})`)
      process.exit(1)
    }

    const user = matches[0]
    const code = generateCode()
    const { error: updErr } = await supabase
      .from('users')
      .update({ participation_code_hash: hashCode(code), updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (updErr) {
      console.error('Update failed:', updErr.message)
      process.exit(1)
    }

    console.log(`\n  (Old code for "${user.display_name}" is now invalid.)`)
    printCode('Regenerated for', `${user.display_name} (${user.id})`, code)
    return
  }

  // ---- Create a new user ----
  const name = arg('--name')
  const tz = arg('--tz') ?? 'UTC'
  if (!name) {
    console.error('Missing --name "Display Name"  (or use --regenerate to reissue a lost code)')
    process.exit(1)
  }

  const code = generateCode()
  const { data, error } = await supabase
    .from('users')
    .insert({ display_name: name, timezone: tz, participation_code_hash: hashCode(code) })
    .select('id')
    .single()

  if (error) {
    console.error('Insert failed:', error.message)
    process.exit(1)
  }

  printCode('Created user', `${name} (${data.id})`, code, tz)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
