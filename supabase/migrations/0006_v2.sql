-- 0006_v2.sql
-- V2 features: water tracking, weekly LLM tips, meal scoring feedback.
--
-- Same security model as the rest of the schema (see 0003_rls.sql): all app
-- writes go through API routes using the service-role key, which bypasses RLS.
-- We enable RLS with no permissive policies so a leaked anon key exposes nothing.

-- Tear down the abandoned Routines feature (experimental, never part of the v1
-- migrations; removed entirely in v2). Dropping the column also drops its FK.
alter table meals drop column if exists routine_id;
drop table if exists meal_routines;

-- One running water total per user per local day. Hydration component reads this.
create table daily_water (
  user_id          uuid not null references users(id) on delete cascade,
  user_local_date  date not null,
  ml               int  not null default 0 check (ml >= 0),
  updated_at       timestamptz not null default now(),
  primary key (user_id, user_local_date)
);

-- Generated weekly tips. week_start is the Monday (user-local) of the week the
-- tips are FOR. Last few weeks' tips are fed back into the prompt to keep new
-- tips non-repetitive.
create table weekly_tips (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  week_start         date not null,
  tips               jsonb not null,           -- string[]
  weakest_component  text,
  model              text,
  created_at         timestamptz not null default now(),
  unique (user_id, week_start)
);

create index weekly_tips_user_week_idx on weekly_tips (user_id, week_start desc);

-- User-reported "this score looks wrong" flags. The feedback handler re-runs the
-- meal through the premium model, re-scores, and records old/new score here so
-- the admin can review accuracy over time.
create table meal_feedback (
  id           uuid primary key default gen_random_uuid(),
  meal_id      uuid not null references meals(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  note         text,
  status       text not null default 'open',    -- open | reviewed
  old_score    numeric(5,2),
  new_score    numeric(5,2),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index meal_feedback_open_idx on meal_feedback (status, created_at) where status = 'open';

alter table daily_water   enable row level security;
alter table weekly_tips   enable row level security;
alter table meal_feedback enable row level security;
