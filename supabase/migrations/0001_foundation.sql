-- 0001 Foundation: shared helpers used by later migrations.
-- Assumes the Supabase environment: schema `auth` with `auth.users` and `auth.uid()`,
-- and roles `anon`, `authenticated`, `service_role` (scripts/test-db.sh stubs these).

-- Append-only guard (SPEC §7.2). Raises on UPDATE and DELETE.
-- With the trigger argument 'allow_cascade', a DELETE that comes from a foreign-key cascade
-- (account deletion) is allowed: those deletes run inside Postgres' RI trigger, so the trigger
-- depth is > 1. A direct DELETE by any role (depth 1) is always rejected.
create or replace function public.forbid_update_delete()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and tg_nargs > 0 and tg_argv[0] = 'allow_cascade' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception '% is append-only: % is not allowed', tg_table_name, tg_op
    using errcode = 'P0001', hint = 'Write a correcting row instead.';
end;
$$;

create or replace function public.forbid_truncate()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only: TRUNCATE is not allowed', tg_table_name using errcode = 'P0001';
end;
$$;
