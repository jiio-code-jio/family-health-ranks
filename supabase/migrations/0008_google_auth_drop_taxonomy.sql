-- 0008_google_auth_drop_taxonomy.sql
-- Two breaking changes + a clean slate:
--
--   1. Auth moves from passwordless participation codes to Google OAuth. The
--      app keeps its own fhr_session JWT (see lib/auth/jwt.ts); Google is just
--      the identity provider. Users are now keyed by google_sub instead of a
--      participation_code_hash. The invite/admin machinery is removed — any
--      Google account can sign in.
--
--   2. The food taxonomy is gone. Identification + macros come entirely from the
--      model (Gemini, escalating to OpenAI). The food_items table, its vector
--      search function, and its index are dropped.
--
-- All existing rows were created under the old code-based auth and have no Google
-- identity, so we wipe the data and start fresh.
--
-- Security model is unchanged (see 0003_rls.sql): all writes go through API
-- routes using the service-role key; RLS stays enabled with no permissive
-- policies so a leaked anon key exposes nothing.

-- --- 1. Wipe all data (cascades to meals / daily_scores / daily_water /
--         weekly_tips / meal_feedback / invites). ---
truncate table users cascade;

-- --- 2. Drop the taxonomy: function first (it references food_items). ---
drop function if exists match_food_items(vector, int);
drop index if exists food_items_embedding_idx;
drop table if exists food_items;

-- --- 3. Drop the invite/admin machinery. ---
drop table if exists invites;

-- --- 4. Reshape users for Google OAuth. ---
drop index if exists users_code_idx;
alter table users drop column if exists participation_code_hash;
alter table users drop column if exists is_admin;

alter table users add column if not exists google_sub text unique;
alter table users add column if not exists email      text unique;
alter table users add column if not exists avatar_url text;

create index if not exists users_google_sub_idx on users (google_sub);
