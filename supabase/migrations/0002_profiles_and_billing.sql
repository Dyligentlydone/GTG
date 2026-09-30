-- 0002 Profiles, plans, subscriptions, entitlements (SPEC §7.1).

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  handle            text unique check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name      text check (char_length(display_name) <= 80),
  time_zone         text not null default 'UTC',
  lat               double precision check (lat between -90 and 90),
  lon               double precision check (lon between -180 and 180),
  custom_wake_start time,
  custom_wake_end   time,
  joined_at         timestamptz not null default now(),
  role              text not null default 'player' check (role in ('player', 'creator', 'admin')),
  avatar_path       text,
  face_photo_path   text,
  face_consent_at   timestamptz,
  status            text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at        timestamptz not null default now(),
  constraint profiles_wake_window_pair check ((custom_wake_start is null) = (custom_wake_end is null)),
  constraint profiles_location_pair check ((lat is null) = (lon is null)),
  constraint profiles_face_needs_consent check (face_photo_path is null or face_consent_at is not null)
);

create table public.plans (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  plan_id                uuid not null references public.plans (id),
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  status                 text not null default 'incomplete'
                         check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_end     timestamptz,
  created_at             timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id);
create index subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

create table public.entitlements (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans (id) on delete cascade,
  feature_key text not null,
  limit_value integer,           -- null = unlimited
  created_at  timestamptz not null default now(),
  unique (plan_id, feature_key)
);
