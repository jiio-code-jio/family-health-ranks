-- 0003_rls.sql
-- All app writes flow through Next.js API routes using the service-role key,
-- which bypasses RLS. RLS here is a defence-in-depth layer: if anything ever
-- leaks the anon key (e.g. a future client-direct query), nothing sensitive is exposed.

alter table users        enable row level security;
alter table meals        enable row level security;
alter table daily_scores enable row level security;
alter table food_items   enable row level security;

-- Anon/authenticated roles cannot read or write directly. Service role bypasses.
-- Leaderboard reads happen server-side via API routes that select only the
-- columns needed (display_name, score, total_score) and return JSON.

-- food_items is a read-only reference table; allow anon read for client-side
-- taxonomy autocomplete in the confirmation UI.
create policy food_items_read_all on food_items
  for select
  using (true);
