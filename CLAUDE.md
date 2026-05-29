# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

---

## Commands

```bash
npm run dev          # dev server (Turbopack, binds 0.0.0.0:3000)
npm run build        # production build — must pass before any deploy
npm run lint         # ESLint (eslint-config-next); 1 known pre-existing error in ConfirmPanel.tsx (setState in effect — intentional)
npx tsc --noEmit     # type-check without emitting; run after build to catch stale .next/types errors

# Admin scripts (need .env.local loaded — dotenv is called inside each script)
npm run seed-user -- --name "Ravi" --tz "Asia/Kolkata"          # create participant
npm run seed-user -- --regenerate --name "Ravi"                  # reissue lost code
npm run seed-taxonomy                                            # embed + upsert food_items rows
npm run seed-taxonomy -- --force                                 # re-embed all existing rows
npm run test-resolver                                            # test vector search against real descriptions
npm run tail-logs                                                # stream logs/app.log
```

Deploy: `vercel deploy --prod` (or push to `main` — GitHub is connected via `vercel git connect`). Functions deploy to `sin1` (Singapore, co-located with the Supabase DB).

---

## Architecture

### Auth
- **No passwords, no OAuth.** Each user has a `participation_code_hash` in `users` (HMAC-SHA256 keyed by `JWT_SECRET` — node-only, see `lib/auth/code-hash.ts`).
- Login: POST `/api/auth/login` with a `FAM-YYYY-XXXXXXX-XXX` code → signs a 90-day JWT → HTTP-only cookie `fhr_session`.
- Join (self-service): GET `/join?invite=<token>` → POST `/api/join` validates the `invites` table token, creates the user, and returns the plaintext code **once** in the response body. The code is never recoverable after that — `POST /api/profile/reset-code` mints a fresh one while still logged in.
- Middleware lives in `proxy.ts` (not `middleware.ts` — Next 16 convention). Exported function is `proxy`, not `middleware`. Protects `/dashboard`, `/leaderboard`, `/profile`, `/meal`.
- All API routes use `getSession()` → `lib/auth/session.ts` → `lib/auth/jwt.ts` (edge-safe jose, no node:crypto).

### Database (Supabase Postgres + pgvector)
- **Service-role only.** All app writes go through API routes using `adminClient()` from `lib/supabase/admin.ts` (singleton — one client per process). RLS is enabled on all tables with **no permissive policies** — a leaked anon key exposes nothing.
- `adminClient()` is a module-level singleton. Do not call `createClient()` directly in routes.
- Migrations: `supabase/migrations/000N_*.sql` applied in order. Run via Supabase MCP `apply_migration` or the dashboard SQL editor — not via Supabase CLI (not installed).
- Key tables: `users`, `meals`, `food_items` (taxonomy), `daily_scores`, `daily_water`, `weekly_tips`, `meal_feedback`, `invites`.
- `daily_scores` has one row per `(user_id, user_local_date)` and is **always recomputed from scratch** via `recomputeDaily()` — never patched.

### Meal identification pipeline (`lib/llm/pipeline.ts`)
Five stages fired asynchronously on upload (via `waitUntil`); the daily cron at `0 3 * * *` mops up any stuck meals:

1. **Gemini 2.5 Flash (vision)** — identifies foods freely, returns `description`, `suggested_portion`, `confidence`, **`estimated_per_100g`**, `category`, `quality_tier` per item. The LLM macro estimate is always computed and stored even when a taxonomy match succeeds.
2. **Escalation check** — if `overall_confidence < 0.65` or any item `< 0.50` or ≥2 items unmatched → re-run with **GPT-4.1 mini** (requires `OPENAI_API_KEY`). Gemini failure also cascades here.
3. **Taxonomy resolver** (`lib/taxonomy/resolver.ts`) — for each item: embed description with `gemini-embedding-001` (768-dim) → pgvector cosine search (top 5) → auto-pick if `similarity > 0.70` with margin `> 0.04`, else Gemini Flash disambig call, else `llm_estimate`.
4. **Persist** — write `llm_suggested_foods` (array of `ResolvedSuggestion`), flip `processing_status` to `awaiting_confirmation`.
5. **User confirms** in `/meal/[id]/confirm` → POST `/api/meals/[id]/confirm` → `computeMealScore()` + `recomputeDaily()`.

At score time: taxonomy-matched items use **curated macros** (`food_items.per_100g`); unmatched items use the LLM's `estimated_per_100g`. Either way every item is scoreable.

### Scoring formula
```
DailyScore = 0.40 × Nutrition        (avg of today's per-meal scores)
           + 0.25 × GoalAlignment    (kcal + protein vs user targets — Mifflin-St Jeor)
           + 0.15 × MealTiming       (placeholder 100 — not yet activated)
           + 0.10 × Hydration        (daily_water.ml / waterTargetMl(weight_kg), capped)
           + 0.10 × Consistency      (meal_count / 3)
```
Per-meal score: `computeMealScore()` in `lib/scoring/meal.ts` — positives (protein, fiber, veg, fruit) minus negatives (sugar, sat_fat, sodium) → piecewise normalize to 0–100. Quality tier applies a flat bonus/penalty (`whole_foods +15 → ultra_processed -30`).

Water target: `35 ml/kg`, clamped 1800–4000 ml, fallback 2500 ml if no weight.

### LLM services
| Key | Model | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | gemini-2.5-flash + gemini-embedding-001 | Vision ID, embeddings, disambig |
| `OPENAI_API_KEY` | gpt-4.1-mini | Escalation fallback + feedback re-score |
| `GROQ_API_KEY` | llama-3.3-70b-versatile | Weekly tips (optional) |

Gemini calls go directly to the REST API (not the SDK) — see `lib/llm/gemini.ts`. OpenAI uses the `openai` npm package. Groq uses the same OpenAI SDK pointed at `api.groq.com/openai/v1`.

### Weekly tips
Generated once per ISO week per user by `generateWeeklyTipsForUser()` (`lib/tips/generate.ts`) — idempotent. Piggybacked onto the daily cron (`/api/meals/process-pending`). Feeds last 4 weeks' tips back into the prompt to prevent repetition. Stored in `weekly_tips`; displayed on the dashboard via `TipsCard`.

### Feedback / re-score
`FlagScoreButton` → POST `/api/meals/[id]/feedback` → immediately writes `meal_feedback` row (never lost), then async calls `rescoreMealWithPremium()` in `lib/llm/refine.ts` (GPT-4.1 mini, re-downloads image, re-resolves, re-scores, updates `meals` row + `daily_scores`).

### Leaderboard
`lib/scoring/leaderboard.ts`. Range queries only count days where `meal_count > 0` — water-only days don't affect eligibility. Result is cached 60s via `unstable_cache` per `(period, tz)`.

### Design system
Custom design tokens in `components/design/theme.ts`. Theme-aware primitives (`Button`, `Card`, `SectionLabel`, etc.) in `components/design/primitives.tsx`. New UI components should import from these rather than writing inline Tailwind from scratch. `useT()` from `ThemeProvider` provides the current token set.

### Key conventions
- `useSearchParams()` must be inside a `<Suspense>` boundary — see the login page pattern. Required for static prerender.
- API routes that need `node:crypto` must declare `export const runtime = 'nodejs'`. JWT/session code uses `jose` (edge-safe) and must not import from `lib/auth/code-hash.ts`.
- `recomputeDaily(userId, date)` is the single entry point for updating `daily_scores` — call it after any meal confirm, meal delete, or water log change.
- Images are stored in the private `meals` Supabase bucket. Serve them via `signMealImageUrls()` (`lib/storage/signImages.ts`) — batch-sign in one call, never per-card.
- The taxonomy (`data/food_taxonomy.ts` → `food_items` table) is the source of truth for macros. Add new foods there and run `npm run seed-taxonomy`. The 110-row starter set covers common Indian + Western foods.
