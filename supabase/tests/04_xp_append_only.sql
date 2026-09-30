-- §7.4 test 4: UPDATE/DELETE on xp_events fails (append-only). Idempotency keys are unique.
-- Account deletion (auth user → profile cascade) still removes the player's history.

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000401', 'xp@test.local'),
  ('00000000-0000-4000-8000-000000000402', 'gone@test.local');
insert into public.profiles (id, handle) values
  ('00000000-0000-4000-8000-000000000401', 'xp_player'),
  ('00000000-0000-4000-8000-000000000402', 'gone_player');
insert into public.xp_events (user_id, source_type, source_id, amount, idempotency_key) values
  ('00000000-0000-4000-8000-000000000401', 'quest', 'c1', 20, 'quest:c1'),
  ('00000000-0000-4000-8000-000000000402', 'quest', 'c2', 20, 'quest:c2');

do $$
declare n integer;
begin
  begin
    update public.xp_events set amount = 9999 where idempotency_key = 'quest:c1';
    raise exception 'xp_events update allowed';
  exception when raise_exception then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;

  begin
    delete from public.xp_events where idempotency_key = 'quest:c1';
    raise exception 'xp_events delete allowed';
  exception when raise_exception then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;

  begin
    insert into public.xp_events (user_id, source_type, source_id, amount, idempotency_key)
    values ('00000000-0000-4000-8000-000000000401', 'quest', 'c1', 20, 'quest:c1');
    raise exception 'duplicate idempotency key accepted';
  exception when unique_violation then null;
  end;

  select amount into n from public.xp_events where idempotency_key = 'quest:c1';
  if n <> 20 then raise exception 'xp amount changed to %', n; end if;
end $$;

-- Even the service role cannot rewrite history.
begin;
set local role service_role;
do $$
begin
  begin
    update public.xp_events set amount = 0;
    raise exception 'service_role updated xp_events';
  exception when raise_exception then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;
end $$;
rollback;

do $$
begin
  begin
    truncate public.xp_events;
    raise exception 'xp_events truncate allowed';
  exception when raise_exception then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;
end $$;

-- Account deletion cascades through append-only tables (FK cascade only).
delete from auth.users where id = '00000000-0000-4000-8000-000000000402';
do $$
begin
  if exists (select 1 from public.xp_events where idempotency_key = 'quest:c2') then
    raise exception 'cascaded account deletion left xp_events behind';
  end if;
  if not exists (select 1 from public.xp_events where idempotency_key = 'quest:c1') then
    raise exception 'other players'' xp_events were removed';
  end if;
end $$;
