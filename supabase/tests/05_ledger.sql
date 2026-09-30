-- §7.4 test 5: an unbalanced ledger transaction fails at commit; a balanced one succeeds.

insert into public.ledger_accounts (id, owner_type, owner_id, currency, kind) values
  ('00000000-0000-4000-8000-000000000501', 'platform', null, 'USD', 'budget'),
  ('00000000-0000-4000-8000-000000000502', 'user', '00000000-0000-4000-8000-0000000005aa', 'USD', 'wallet'),
  ('00000000-0000-4000-8000-000000000503', 'platform', null, 'EUR', 'budget');

-- Balanced: entries inserted in separate statements (the check is deferred to commit).
begin;
insert into public.ledger_transactions (id, idempotency_key, description)
  values ('00000000-0000-4000-8000-000000000510', 'balanced-1', 'test transfer');
insert into public.ledger_entries (transaction_id, account_id, amount_cents)
  values ('00000000-0000-4000-8000-000000000510', '00000000-0000-4000-8000-000000000501', -1500);
insert into public.ledger_entries (transaction_id, account_id, amount_cents)
  values ('00000000-0000-4000-8000-000000000510', '00000000-0000-4000-8000-000000000502', 1500);
commit;

do $$
declare total numeric;
begin
  if not exists (select 1 from public.ledger_transactions where idempotency_key = 'balanced-1') then
    raise exception 'balanced transaction did not commit';
  end if;
  select sum(amount_cents) into total from public.ledger_entries where account_id = '00000000-0000-4000-8000-000000000502';
  if total <> 1500 then raise exception 'wallet balance %', total; end if;
end $$;

-- Unbalanced: must fail at COMMIT. Let this one statement error without stopping the script.
\set ON_ERROR_STOP 0
\echo '    (expected error below: unbalanced ledger transaction rejected at commit)'
begin;
insert into public.ledger_transactions (id, idempotency_key)
  values ('00000000-0000-4000-8000-000000000520', 'unbalanced-commit');
insert into public.ledger_entries (transaction_id, account_id, amount_cents) values
  ('00000000-0000-4000-8000-000000000520', '00000000-0000-4000-8000-000000000501', -1000),
  ('00000000-0000-4000-8000-000000000520', '00000000-0000-4000-8000-000000000502', 999);
commit;
\set ON_ERROR_STOP 1

do $$
begin
  if exists (select 1 from public.ledger_transactions where idempotency_key = 'unbalanced-commit') then
    raise exception 'unbalanced transaction was committed';
  end if;
end $$;

-- Same rules checked explicitly (SET CONSTRAINTS IMMEDIATE runs the deferred trigger now).
do $$
begin
  begin
    insert into public.ledger_transactions (id, idempotency_key) values ('00000000-0000-4000-8000-000000000530', 'one-leg');
    insert into public.ledger_entries (transaction_id, account_id, amount_cents)
      values ('00000000-0000-4000-8000-000000000530', '00000000-0000-4000-8000-000000000501', 100);
    set constraints all immediate;
    raise exception 'single-entry transaction accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.ledger_transactions (id, idempotency_key) values ('00000000-0000-4000-8000-000000000531', 'no-entries');
    set constraints all immediate;
    raise exception 'transaction without entries accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.ledger_transactions (id, idempotency_key) values ('00000000-0000-4000-8000-000000000532', 'mixed');
    insert into public.ledger_entries (transaction_id, account_id, amount_cents) values
      ('00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000501', -100),
      ('00000000-0000-4000-8000-000000000532', '00000000-0000-4000-8000-000000000503', 100);
    set constraints all immediate;
    raise exception 'mixed-currency transaction accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.ledger_transactions (idempotency_key) values ('balanced-1');
    raise exception 'duplicate idempotency key accepted';
  exception when unique_violation then null;
  end;

  begin
    update public.ledger_entries set amount_cents = 1 where transaction_id = '00000000-0000-4000-8000-000000000510';
    raise exception 'ledger entry updated';
  exception when raise_exception then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;
end $$;
