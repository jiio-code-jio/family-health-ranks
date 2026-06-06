# Setup Guide — Family Health Ranks

This walks you (the admin) through everything needed before the app can run locally. Plan on 30-45 minutes the first time. After that, the family just needs the URL — everyone signs in with their Google account.

You only have to do this once. All external services have free tiers that cover our scale.

---

## 1. Supabase (database + image storage)

1. Go to **https://supabase.com** and sign up (GitHub or email).
2. Click **New Project**. Pick a name (e.g. `family-health-ranks`), set a database password (save it somewhere — you won't need it often), and choose a region close to you (for India: `Singapore (Southeast Asia)`).
3. Wait ~2 minutes for the project to provision.
4. In the left sidebar: **Storage** → **New bucket** → name it `meals` → leave it **Private**. Click Create.
5. In the left sidebar: **SQL Editor** → **New Query**. Open each file in `supabase/migrations/` and run them **in numeric order**: `0001_init.sql`, `0002_taxonomy.sql`, `0003_rls.sql`, `0004_indexes.sql`, `0005_resolver_fn.sql`, `0006_v2.sql`, `0007_invites.sql`, `0008_google_auth_drop_taxonomy.sql`. (The early files create a food taxonomy + invite tables that `0008` then removes — running them all in order is harmless on a fresh database and leaves you on the current schema.)
6. In the left sidebar: **Settings** → **API**. You'll need three values:
   - **Project URL** — copy into `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
   - **anon public** key — copy into `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** key — copy into `SUPABASE_SERVICE_ROLE_KEY`

> The service_role key bypasses all security. **Never commit it.** `.env.local` is already in `.gitignore`.

---

## 2. Google AI Studio (Gemini 2.5 Flash)

1. Go to **https://aistudio.google.com/app/apikey** (sign in with any Google account).
2. Click **Create API key** → choose a project (or let it create one).
3. Copy the key into `GEMINI_API_KEY` in `.env.local`.

Free tier: 1500 vision requests/day — plenty for 7 people × 5 meals. Gemini handles both identifying the food and estimating its macros; there is no taxonomy.

---

## 3. OpenAI (GPT-4.1 mini fallback)

1. Go to **https://platform.openai.com/api-keys** and sign in.
2. Click **Create new secret key**, name it `family-health-ranks`.
3. Copy the key into `OPENAI_API_KEY` in `.env.local`.
4. **Add billing:** Settings → Billing → Add payment method, then drop **$5** of prepaid credit. At our scale this lasts months — GPT-4.1 mini only fires when Gemini's confidence is low (~10% of meals at ~$0.0005 each).

If you want to skip the fallback entirely, leave `OPENAI_API_KEY` blank. The app will just trust Gemini's identification even when confidence is low.

---

## 3b. Groq (weekly personalized tips — free, optional)

1. Go to **https://console.groq.com/keys** and sign in.
2. Click **Create API Key**, name it `family-health-ranks`.
3. Copy the key into `GROQ_API_KEY` in `.env.local`.

Groq's free tier runs Llama 3.3 70B and is plenty for one short tip-generation per person per week. The daily cron generates each person's three tips at the start of their week, feeding the prior 4 weeks' tips back into the prompt so advice never repeats. Leave `GROQ_API_KEY` blank to disable tips entirely (everything else still works).

---

## 3c. Google OAuth (sign-in)

This is how everyone logs in — there are no codes or passwords.

1. Go to **https://console.cloud.google.com/apis/credentials** and pick (or create) a project.
2. If prompted, configure the **OAuth consent screen**: choose **External**, give the app a name + your email, and add yourself (and any family testers) under **Test users** while it's unpublished. Publish it later if you want anyone to sign in.
3. Click **Create Credentials → OAuth client ID → Web application**.
4. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/auth/google/callback` (local dev)
   - `https://YOUR-DOMAIN/api/auth/google/callback` (add this once you know your Vercel URL)
5. Click Create. Copy the **Client ID** into `GOOGLE_CLIENT_ID` and the **Client secret** into `GOOGLE_CLIENT_SECRET` in `.env.local`.

---

## 4. Generate secrets

In your terminal, run:

```sh
openssl rand -base64 48
```

Copy the output into `JWT_SECRET` (used to sign the session cookie). Run it again, copy the second output into `CRON_SECRET`.

---

## 5. Local `.env.local`

In the project root, copy the example and fill in everything from steps 1-4:

```sh
cp .env.local.example .env.local
# edit .env.local with your real values
```

---

## 6. Run it

```sh
npm install            # if you haven't already
npm run dev            # opens http://localhost:3000
```

Open http://localhost:3000, click **Sign in with Google**, pick your account, complete profile setup (height/weight/goal), take a meal photo, and you're in.

To add family members, just share the URL — anyone with a Google account can sign in and gets their own account automatically. (If your OAuth consent screen is still unpublished, add each person under **Test users** in the Google Cloud console first, or publish the consent screen.)

---

## 7. Deploy to Vercel (when you're ready to share)

1. Push the project to GitHub (a private repo is fine).
2. Go to **https://vercel.com** → **Add New Project** → import the repo.
3. In **Environment Variables**, paste in every value from your `.env.local` (including `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).
4. Click **Deploy**. You'll get a URL like `family-health-ranks.vercel.app`.
   - **Important:** go back to the Google Cloud console (step 3c) and add `https://YOUR-VERCEL-URL/api/auth/google/callback` to the Authorized redirect URIs, or Google sign-in will fail in production.
5. On any phone: open the URL in Safari (iPhone) or Chrome (Android) → menu → **Add to Home Screen**. It now behaves like a native app.

---

## Troubleshooting

- **Google sign-in fails with `redirect_uri_mismatch`** — the callback URL isn't registered. Add the exact `…/api/auth/google/callback` URL (local and/or prod) under your OAuth client's Authorized redirect URIs (step 3c).
- **Google sign-in shows "Access blocked / app not verified"** — your OAuth consent screen is unpublished and the account isn't a Test user. Add the email under **Test users**, or publish the consent screen.
- **Supabase SQL error `extension "vector" does not exist`** — pgvector isn't enabled. In the Supabase dashboard: **Database → Extensions → search "vector" → Enable**, then re-run migration `0001`. (It's no longer used after `0008`, but the early migrations still reference it.)
- **Upload returns 401** in the browser — your session expired or you're signed out. Sign in with Google again.
- **Identification stuck on "Analyzing…"** for more than a minute — check the Vercel function logs (or local terminal if running `npm run dev`) for the Gemini call error.
