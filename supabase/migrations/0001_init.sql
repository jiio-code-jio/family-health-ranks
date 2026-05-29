-- 0001_init.sql
-- Core schema: extensions, enums, users, meals, daily_scores.
-- Indexes live in 0004; RLS in 0003; food_items taxonomy in 0002.

create extension if not exists vector;
create extension if not exists pgcrypto;

create type goal_kind        as enum ('lose', 'maintain', 'gain');
create type activity_kind    as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type meal_kind        as enum ('breakfast', 'lunch', 'snack', 'dinner', 'other');
create type processing_state as enum (
  'pending_identify',
  'awaiting_confirmation',
  'scored',
  'rejected_not_food',
  'failed'
);

create table users (
  id                       uuid primary key default gen_random_uuid(),
  participation_code_hash  text unique not null,
  display_name             text not null,
  age                      int,
  gender                   text,
  height_cm                numeric(5,1),
  weight_kg                numeric(5,1),
  activity_level           activity_kind,
  goal                     goal_kind,
  timezone                 text not null default 'UTC',
  daily_kcal_target        numeric(6,1),
  daily_protein_target_g   numeric(5,1),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table meals (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  meal_type             meal_kind not null,
  eaten_at              timestamptz not null,
  user_local_date       date not null,
  image_path            text not null,
  metadata              text,
  processing_status     processing_state not null default 'pending_identify',
  llm_suggested_foods   jsonb,
  confirmed_foods       jsonb,
  overall_confidence    numeric(3,2),
  used_premium_model    boolean not null default false,
  macros                jsonb,
  food_quality_tag      text,
  score                 numeric(5,2),
  score_breakdown       jsonb,
  created_at            timestamptz not null default now()
);

create table daily_scores (
  user_id          uuid not null references users(id) on delete cascade,
  user_local_date  date not null,
  nutrition        numeric(5,2),
  goal_alignment   numeric(5,2),
  meal_timing      numeric(5,2) not null default 100,
  hydration        numeric(5,2) not null default 100,
  consistency      numeric(5,2),
  total_score      numeric(5,2),
  meal_count       int not null default 0,
  updated_at       timestamptz not null default now(),
  primary key (user_id, user_local_date)
);
