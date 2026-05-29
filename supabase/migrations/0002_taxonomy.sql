-- 0002_taxonomy.sql
-- food_items reference table — populated by scripts/seed-taxonomy.ts.
-- Embedding dimension 768 matches Google text-embedding-004.

create type quality_kind as enum ('whole_foods', 'mixed', 'processed', 'ultra_processed');

create type category_kind as enum (
  'grain', 'protein', 'vegetable', 'fruit', 'dairy',
  'snack', 'beverage', 'mixed_dish', 'fat_oil', 'sweet'
);

create table food_items (
  id                   text primary key,
  display_name         text not null,
  aliases              text[] not null default '{}',
  category             category_kind not null,
  per_100g             jsonb not null,
  quality_tier         quality_kind not null,
  micronutrient_tags   text[] not null default '{}',
  default_portion_g    jsonb not null,
  embedding            vector(768)
);
