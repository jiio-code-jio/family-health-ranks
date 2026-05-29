-- 0004_indexes.sql
-- Performance indexes. HNSW for vector search; partial index for the
-- pending-meal queue; composite indexes for leaderboard sort.

create index meals_user_date_idx
  on meals (user_id, user_local_date);

create index meals_date_idx
  on meals (user_local_date);

create index meals_pending_idx
  on meals (processing_status, created_at)
  where processing_status in ('pending_identify', 'awaiting_confirmation');

create index daily_scores_leaderboard_idx
  on daily_scores (user_local_date, total_score desc);

create index users_code_idx
  on users (participation_code_hash);

-- HNSW for cosine-distance similarity search on food embeddings.
-- m=16, ef_construction=64 are sensible defaults for ~500 rows.
create index food_items_embedding_idx
  on food_items
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
