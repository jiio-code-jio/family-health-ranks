# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

---

## Commands

```bash
npm run dev          # dev server (Turbopack, binds 0.0.0.0:3000)
npm run build        # production build — must pass before any deploy
npm run lint         # ESLint (eslint-config-next); 2 known pre-existing set-state-in-effect errors (ConfirmPanel.tsx, design/viz.tsx — intentional)
npx tsc --noEmit     # type-check without emitting; run after build to catch stale .next/types errors
npm run tail-logs    # stream logs/app.log
```

There are no admin/seed scripts — accounts are created on first Google sign-in, and there is no taxonomy to seed.

Deploy: `vercel deploy --prod` (or push to `main` — GitHub is connected via `vercel git connect`). Functions deploy to `sin1` (Singapore, co-located with the Supabase DB).

---

## Architecture

### Auth
- **Google OAuth only.** Any Google account can sign in — there are no codes, passwords, or invites. Users are keyed by `google_sub` (with `email` + `avatar_url`) in `users`.
- The app keeps its **own session**: Google is just the identity provider, and after verification we mint a 90-day JWT → HTTP-only cookie `fhr_session` (unchanged from before).
- Flow: login page → GET `/api/auth/google/start` (sets a short-lived `fhr_oauth` CSRF cookie carrying state + `from` + browser tz, redirects to Google) → Google redirects to `/api/auth/google/callback` → verify ID token (`google-auth-library`), upsert user by `google_sub`, sign session, redirect to `/profile` (new user) or `/dashboard`. See `lib/auth/google.ts`.
- Middleware lives in `proxy.ts` (not `middleware.ts` — Next 16 convention). Exported function is `proxy`, not `middleware`. Protects `/dashboard`, `/leaderboard`, `/profile`, `/meal`.
- All API routes use `getSession()` → `lib/auth/session.ts` → `lib/auth/jwt.ts` (edge-safe jose). `getSession()` returns `{ sub: userId }`.

### Database (Supabase Postgres)
- **Service-role only.** All app writes go through API routes using `adminClient()` from `lib/supabase/admin.ts` (singleton — one client per process). RLS is enabled on all tables with **no permissive policies** — a leaked anon key exposes nothing.
- `adminClient()` is a module-level singleton. Do not call `createClient()` directly in routes.
- Migrations: `supabase/migrations/000N_*.sql` applied in order. Run via Supabase MCP `apply_migration` or the dashboard SQL editor — not via Supabase CLI (not installed). `0008` dropped the taxonomy + invites and moved auth to Google.
- Key tables: `users`, `meals`, `daily_scores`, `daily_water`, `weekly_tips`, `meal_feedback`. (The `food_items` taxonomy and `invites` tables were removed in `0008`; the `vector` extension is left installed but unused.)
- `daily_scores` has one row per `(user_id, user_local_date)` and is **always recomputed from scratch** via `recomputeDaily()` — never patched.

### Meal identification pipeline (`lib/llm/pipeline.ts`)
Fired asynchronously on upload (via `waitUntil`); the daily cron at `0 3 * * *` mops up any stuck meals. **The model is the single source of truth** — there is no taxonomy:

1. **Gemini 2.5 Flash (vision)** — identifies foods freely, returns `description`, `suggested_portion`, `confidence`, **`estimated_per_100g`**, `category`, `quality_tier` per item. These macros are used directly for scoring.
2. **Escalation check** — if `overall_confidence < 0.65` or any item `< 0.50` → re-run with **GPT-4.1 mini** (requires `OPENAI_API_KEY`) for a sharper read. Gemini total failure also cascades to OpenAI as the primary identifier.
3. **Persist** — write `llm_suggested_foods` (array of `ResolvedSuggestion` = `{description, portion, estimated_per_100g, llm_category, llm_quality}`), flip `processing_status` to `awaiting_confirmation`.
4. **User confirms** in `/meal/[id]/confirm` → POST `/api/meals/[id]/confirm` → `computeMealScore()` + `recomputeDaily()`. On the confirm screen the user adjusts portions, removes items, or adds one (typed name → `POST /api/foods/estimate` → Gemini macro estimate).

At score time every item uses its own `estimated_per_100g` — `aggregateMacros()` (`lib/taxonomy/macros.ts`) just sums them, scaled by portion.

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
| `GEMINI_API_KEY` | gemini-2.5-flash | Vision ID + macros, `/api/foods/estimate` |
| `OPENAI_API_KEY` | gpt-4.1-mini | Escalation fallback + feedback re-score |
| `GROQ_API_KEY` | llama-3.3-70b-versatile | Weekly tips (optional) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Google OAuth login |

Gemini calls go directly to the REST API (not the SDK) — see `lib/llm/gemini.ts`. OpenAI uses the `openai` npm package. Groq uses the same OpenAI SDK pointed at `api.groq.com/openai/v1`.

### Weekly tips
Generated once per ISO week per user by `generateWeeklyTipsForUser()` (`lib/tips/generate.ts`) — idempotent. Piggybacked onto the daily cron (`/api/meals/process-pending`). Feeds last 4 weeks' tips back into the prompt to prevent repetition. Stored in `weekly_tips`; displayed on the dashboard via `TipsCard`.

### Feedback / re-score
`FlagScoreButton` → POST `/api/meals/[id]/feedback` → immediately writes `meal_feedback` row (never lost), then async calls `rescoreMealWithPremium()` in `lib/llm/refine.ts` (GPT-4.1 mini, re-downloads image, re-identifies, re-scores from the model's macros, updates `meals` row + `daily_scores`).

### Leaderboard
`lib/scoring/leaderboard.ts`. Range queries only count days where `meal_count > 0` — water-only days don't affect eligibility. Result is cached 60s via `unstable_cache` per `(period, tz)`.

### Design system
Custom design tokens in `components/design/theme.ts`. Theme-aware primitives (`Button`, `Card`, `SectionLabel`, etc.) in `components/design/primitives.tsx`. New UI components should import from these rather than writing inline Tailwind from scratch. `useT()` from `ThemeProvider` provides the current token set.

### Key conventions
- `useSearchParams()` must be inside a `<Suspense>` boundary — see the login page pattern. Required for static prerender.
- API routes that need `node:crypto` or `google-auth-library` must declare `export const runtime = 'nodejs'` (e.g. the Google OAuth routes). JWT/session code uses `jose` (edge-safe) so `proxy.ts` can verify the cookie in the Edge runtime.
- `recomputeDaily(userId, date)` is the single entry point for updating `daily_scores` — call it after any meal confirm, meal delete, or water log change.
- Images are stored in the private `meals` Supabase bucket. Serve them via `signMealImageUrls()` (`lib/storage/signImages.ts`) — batch-sign in one call, never per-card.
- There is no food taxonomy: macros come entirely from the model's `estimated_per_100g`. `lib/taxonomy/loader.ts` now only exports the shared `Per100g`/`Category`/`QualityTier` types.
