-- 0004 Player progress: enrollments, pauses, books, completions, takeaways, journal, XP,
-- streak freezes, week results, earned achievements (SPEC §7.1).

create table public.enrollments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    uuid not null references public.games (id) on delete cascade,
  state      text not null default 'active' check (state in ('active', 'paused', 'left')),
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, game_id)
);

create table public.paused_days (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  reason     text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create table public.books (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 300),
  total_pages integer not null check (total_pages > 0),
  pages_read  integer not null default 0 check (pages_read >= 0),
  finished_at timestamptz,
  created_at  timestamptz not null default now()
);
create index books_user_idx on public.books (user_id);

-- Accepted check-ins. Journal text is never stored here (see journal_entries).
create table public.completions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  quest_id     uuid not null references public.quests (id),
  local_date   date not null,
  completed_at timestamptz not null,
  payload      jsonb not null default '{}'::jsonb,
  is_repair    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index completions_user_date_idx on public.completions (user_id, local_date);
create index completions_user_quest_date_idx on public.completions (user_id, quest_id, local_date);

create table public.takeaways (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  book_id       uuid references public.books (id) on delete set null,
  completion_id uuid not null unique references public.completions (id) on delete cascade,
  text          text not null check (char_length(text) between 10 and 200 and text !~ '[\r\n]'),
  created_at    timestamptz not null default now()
);
create index takeaways_user_idx on public.takeaways (user_id);

-- Encrypted by the app (AES-GCM). Never readable by other users or by share rendering.
create table public.journal_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  completion_id uuid not null unique references public.completions (id) on delete cascade,
  ciphertext    bytea not null,
  nonce         bytea not null,
  created_at    timestamptz not null default now()
);
create index journal_entries_user_idx on public.journal_entries (user_id);

create table public.xp_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  source_type     text not null check (source_type in ('quest', 'full_set', 'inner_balance', 'outer_balance',
                    'balanced_week', 'perfect_week', 'book_finished', 'achievement', 'share')),
  source_id       text not null,
  amount          integer not null,
  idempotency_key text not null unique,
  created_at      timestamptz not null default now()
);
create index xp_events_user_idx on public.xp_events (user_id, created_at);
create trigger xp_events_append_only before update or delete on public.xp_events
  for each row execute function public.forbid_update_delete('allow_cascade');
create trigger xp_events_no_truncate before truncate on public.xp_events
  for each statement execute function public.forbid_truncate();

create table public.streak_freezes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  month      char(7) not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  used_on    date not null,
  created_at timestamptz not null default now(),
  unique (user_id, used_on),
  check (to_char(used_on, 'YYYY-MM') = month)
);
create index streak_freezes_user_month_idx on public.streak_freezes (user_id, month);

create table public.week_results (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  game_id        uuid not null references public.games (id) on delete cascade,
  week_start     date not null check (extract(isodow from week_start) = 1),
  due            integer not null check (due >= 0),
  done           integer not null check (done >= 0 and done <= due),
  completion_pct numeric(5, 4) not null check (completion_pct between 0 and 1),
  perfect_week   boolean not null default false,
  balanced_week  boolean not null default false,
  inner_balance  boolean not null default false,
  outer_balance  boolean not null default false,
  pieces         integer not null check (pieces in (0, 1, 2, 5)),
  created_at     timestamptz not null default now(),
  unique (user_id, game_id, week_start)
);

create table public.user_achievements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (user_id, achievement_id)
);
