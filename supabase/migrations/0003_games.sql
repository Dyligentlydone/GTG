-- 0003 Games as data: games, seasons, quests, achievements (SPEC §7.1).

create table public.games (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9_-]+$'),
  title             text not null,
  type              text not null check (type in ('free', 'paid', 'earning')),
  status            text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  config            jsonb not null default '{}'::jsonb,
  budget_account_id uuid,        -- FK to ledger_accounts added in 0007
  created_at        timestamptz not null default now()
);

create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games (id) on delete cascade,
  name       text not null,
  starts_on  date not null,
  ends_on    date not null,
  rules      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index seasons_game_idx on public.seasons (game_id);

create table public.quests (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games (id) on delete cascade,
  key        text not null,
  pillar     text not null check (pillar in ('mental', 'physical', 'emotional', 'spiritual',
                                             'financial', 'social', 'environmental', 'recreational')),
  title      text not null,
  founding   boolean not null default false,
  schedule   jsonb not null,
  "window"   jsonb not null default '{"kind":"anytime"}'::jsonb,
  proof      jsonb not null,
  xp         integer not null check (xp >= 0),
  unlock     jsonb not null default '{"kind":"always"}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (game_id, key)
);

create table public.achievements (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  game_id    uuid not null references public.games (id) on delete cascade,
  name       text not null,
  scope      text not null check (scope in ('mental', 'physical', 'emotional', 'spiritual', 'financial',
                                            'social', 'environmental', 'recreational', 'inner', 'outer', 'all')),
  hidden     boolean not null default false,
  rule       jsonb not null,
  decoration text,
  created_at timestamptz not null default now()
);
create index achievements_game_idx on public.achievements (game_id);
