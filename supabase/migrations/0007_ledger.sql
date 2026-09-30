-- 0007 Double-entry ledger (SPEC §4.10, §7.1, §7.2). Integer cents; never cascade-deleted.

create table public.ledger_accounts (
  id         uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('user', 'game', 'platform', 'external')),
  owner_id   uuid,                 -- polymorphic, deliberately not a FK: money history outlives owners
  currency   char(3) not null check (currency ~ '^[A-Z]{3}$'),
  kind       text not null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (owner_type, owner_id, currency, kind)
);

create table public.ledger_transactions (
  id              uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  description     text not null default '',
  created_at      timestamptz not null default now()
);

create table public.ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions (id) on delete restrict,
  account_id     uuid not null references public.ledger_accounts (id) on delete restrict,
  amount_cents   bigint not null check (amount_cents <> 0),
  created_at     timestamptz not null default now()
);
create index ledger_entries_transaction_idx on public.ledger_entries (transaction_id);
create index ledger_entries_account_idx on public.ledger_entries (account_id);

alter table public.games
  add constraint games_budget_account_fk foreign key (budget_account_id)
  references public.ledger_accounts (id) on delete restrict;

-- Append-only (no cascade exception: ledger rows are never deleted).
create trigger ledger_entries_append_only before update or delete on public.ledger_entries
  for each row execute function public.forbid_update_delete();
create trigger ledger_entries_no_truncate before truncate on public.ledger_entries
  for each statement execute function public.forbid_truncate();
create trigger ledger_transactions_append_only before update or delete on public.ledger_transactions
  for each row execute function public.forbid_update_delete();
create trigger ledger_transactions_no_truncate before truncate on public.ledger_transactions
  for each statement execute function public.forbid_truncate();

-- At commit: every transaction has ≥ 2 entries, one currency, and sums to 0.
create or replace function public.check_ledger_transaction_balanced()
returns trigger
language plpgsql
as $$
declare
  txn uuid;
  n integer;
  total numeric;
  currencies integer;
begin
  if tg_table_name = 'ledger_transactions' then
    txn := new.id;
  else
    txn := new.transaction_id;
  end if;
  select count(*), coalesce(sum(e.amount_cents), 0), count(distinct a.currency)
    into n, total, currencies
    from public.ledger_entries e
    join public.ledger_accounts a on a.id = e.account_id
   where e.transaction_id = txn;
  if n < 2 then
    raise exception 'ledger transaction % needs at least 2 entries (has %)', txn, n using errcode = 'check_violation';
  end if;
  if currencies <> 1 then
    raise exception 'ledger transaction % mixes currencies', txn using errcode = 'check_violation';
  end if;
  if total <> 0 then
    raise exception 'ledger transaction % does not balance (sum = %)', txn, total using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger ledger_entries_balanced
  after insert on public.ledger_entries
  deferrable initially deferred
  for each row execute function public.check_ledger_transaction_balanced();

create constraint trigger ledger_transactions_balanced
  after insert on public.ledger_transactions
  deferrable initially deferred
  for each row execute function public.check_ledger_transaction_balanced();
