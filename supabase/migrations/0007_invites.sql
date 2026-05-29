-- 0007_invites.sql
-- Self-service onboarding: a reusable family invite link.
--
-- Until now the only way to add a participant was the seed-user CLI, and a
-- participation code IS an identity (whoever holds it logs in as that person).
-- This adds a gated join flow: an admin mints a reusable invite token, shares
-- the link, and anyone who opens it creates their OWN account.
--
-- Same security model as the rest of the schema (see 0003_rls.sql): all writes
-- go through API routes using the service-role key, which bypasses RLS. RLS is
-- enabled with no permissive policies so a leaked anon key exposes nothing.

-- Only admins can mint/rotate invite links and see the admin card.
alter table users add column if not exists is_admin boolean not null default false;

-- Reusable invite tokens. The "active family link" is the most recent row where
-- disabled = false. Rotating disables all existing rows and inserts a new one,
-- which instantly invalidates any previously-shared link.
create table invites (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  disabled    boolean not null default false,
  used_count  integer not null default 0,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Fast lookup of the single active invite.
create index invites_active_idx on invites (created_at desc) where disabled = false;

alter table invites enable row level security;

-- Seed the existing admin (Hari).
update users set is_admin = true where id = '62bbec19-05d4-4a8f-8f96-bb122ed97216';
