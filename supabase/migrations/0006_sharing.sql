-- 0006 Sharing and referrals (SPEC §7.1, §7.3).

create table public.shares (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  scope           text not null check (scope in ('takeaway', 'quest', 'custom_set', 'day', 'week', 'achievement', 'milestone')),
  item_refs       jsonb not null default '[]'::jsonb,
  template        text not null default 'light' check (template in ('light', 'dark')),
  include_journal boolean not null default false,
  public_slug     text not null unique check (public_slug ~ '^[A-Za-z0-9_-]{6,64}$'),
  image_path      text,
  clicks          integer not null default 0 check (clicks >= 0),
  signups         integer not null default 0 check (signups >= 0),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index shares_user_idx on public.shares (user_id);

create table public.referrals (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_id uuid not null unique references public.profiles (id) on delete cascade,
  share_id    uuid references public.shares (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (referrer_id <> referred_id)
);
create index referrals_referrer_idx on public.referrals (referrer_id);

-- Removes journal content from share item refs:
-- object → drops keys 'journal' and 'journal_text'; array → drops elements with type 'journal'.
create or replace function public.strip_journal(refs jsonb)
returns jsonb
language sql
immutable
as $$
  select case jsonb_typeof(refs)
    when 'object' then refs - 'journal' - 'journal_text'
    when 'array' then coalesce(
      (select jsonb_agg(e) from jsonb_array_elements(refs) as e where coalesce(e ->> 'type', '') <> 'journal'),
      '[]'::jsonb)
    else refs
  end
$$;

-- Public read of one share by slug. Returns only rendered fields; excludes deleted shares and
-- journal content unless the owner explicitly ticked include_journal.
create or replace function public.get_public_share(p_slug text)
returns table (
  public_slug     text,
  scope           text,
  template        text,
  item_refs       jsonb,
  include_journal boolean,
  image_path      text,
  handle          text,
  display_name    text,
  created_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.public_slug,
         s.scope,
         s.template,
         case when s.include_journal then s.item_refs else public.strip_journal(s.item_refs) end,
         s.include_journal,
         s.image_path,
         p.handle,
         p.display_name,
         s.created_at
    from public.shares s
    join public.profiles p on p.id = s.user_id
   where s.public_slug = p_slug
     and s.deleted_at is null
     and p.status = 'active'
$$;
