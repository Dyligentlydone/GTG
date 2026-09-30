-- 0008 Phase 2 seams (no app code uses them yet) and analytics events (SPEC §7.1).

create table public.payouts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete restrict, -- money: never cascade
  amount_cents          bigint not null check (amount_cents > 0),
  currency              char(3) not null check (currency ~ '^[A-Z]{3}$'),
  rail                  text not null check (rail in ('stripe', 'solana_usdc', 'robinhood_chain')),
  status                text not null default 'requested'
                        check (status in ('requested', 'approved', 'processing', 'paid', 'failed', 'canceled')),
  destination_ref       text,
  ledger_transaction_id uuid references public.ledger_transactions (id) on delete restrict,
  requested_at          timestamptz not null default now(),
  processed_at          timestamptz,
  created_at            timestamptz not null default now()
);
create index payouts_user_idx on public.payouts (user_id);

create table public.kyc_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  provider    text not null,
  reference   text,
  status      text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'expired')),
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);
create index kyc_records_user_idx on public.kyc_records (user_id);

create table public.reputation_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,
  delta       integer not null,
  source_type text,
  source_id   text,
  created_at  timestamptz not null default now()
);
create index reputation_events_user_idx on public.reputation_events (user_id);
create trigger reputation_events_append_only before update or delete on public.reputation_events
  for each row execute function public.forbid_update_delete('allow_cascade');
create trigger reputation_events_no_truncate before truncate on public.reputation_events
  for each statement execute function public.forbid_truncate();

create table public.fraud_flags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  reason      text not null,
  severity    text not null default 'low' check (severity in ('low', 'medium', 'high')),
  status      text not null default 'open' check (status in ('open', 'dismissed', 'confirmed')),
  details     jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index fraud_flags_user_idx on public.fraud_flags (user_id);

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  name       text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_name_created_idx on public.events (name, created_at);
