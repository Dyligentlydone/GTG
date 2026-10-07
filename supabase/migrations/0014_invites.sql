-- 0014 Invite-only gate (invite codes).
--
-- Model:
-- * invites.code — single-use gate key. created_by = null for the founder batch.
-- * claimed_by/claimed_at — set by the service role when a new account redeems it.
-- * Every successful claim mints 3 fresh codes for that user (API layer).
-- * Players can only SELECT codes they generated — validation and claiming go
--   through service-role route handlers; no client writes.

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  created_by  uuid references public.profiles (id) on delete set null,
  claimed_by  uuid references public.profiles (id) on delete set null,
  claimed_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index invites_created_by_idx on public.invites (created_by) where claimed_by is null;

alter table public.invites enable row level security;

-- see only the codes you generated
create policy invites_select_own on public.invites
  for select to authenticated
  using (created_by = auth.uid());

grant select on public.invites to authenticated;
grant all on public.invites to service_role;

-- founder batch: 100 codes, unowned until the founder claims one
insert into public.invites (code)
select 'GTG-' || upper(substring(u from 1 for 4)) || '-' || upper(substring(u from 5 for 4))
from (select replace(gen_random_uuid()::text, '-', '') as u from generate_series(1, 100)) as rows;
