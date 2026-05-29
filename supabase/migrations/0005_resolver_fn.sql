-- 0005_resolver_fn.sql
-- RPC the resolver calls: returns top-k food_items by cosine similarity to a
-- query embedding. Used by lib/taxonomy/resolver.ts.

create or replace function match_food_items(
  query_embedding vector(768),
  match_count int default 5
)
returns table (id text, display_name text, similarity double precision)
language sql
stable
as $$
  select fi.id,
         fi.display_name,
         1 - (fi.embedding <=> query_embedding) as similarity
  from food_items fi
  where fi.embedding is not null
  order by fi.embedding <=> query_embedding
  limit match_count
$$;
