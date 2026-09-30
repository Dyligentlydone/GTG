-- §7.4 test 2: a chisel event of 5 raises pieces_revealed to 5; a 6th piece in one event is
-- rejected; totals cap at 120 and status becomes 'complete'. Also: pieces only increase,
-- and one active sculpture per user.

insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000201', 'chisel@test.local');
insert into public.profiles (id, handle) values ('00000000-0000-4000-8000-000000000201', 'chisel_player');

do $$
declare
  uid constant uuid := '00000000-0000-4000-8000-000000000201';
  sid uuid;
  s public.sculptures;
  wk date := date '2026-01-05';
begin
  select id into sid from public.sculptures where user_id = uid;

  insert into public.chisel_events (sculpture_id, week_start, completion_pct, pieces) values (sid, wk, 0.8, 5);
  select * into s from public.sculptures where id = sid;
  if s.pieces_revealed <> 5 then raise exception 'expected 5 revealed, got %', s.pieces_revealed; end if;
  if s.status <> 'carving' then raise exception 'expected carving, got %', s.status; end if;

  begin
    insert into public.chisel_events (sculpture_id, week_start, completion_pct, pieces) values (sid, wk + 7, 1, 6);
    raise exception '6 pieces in one event was accepted';
  exception when check_violation then null;
  end;

  -- A week with 0 pieces is recorded and changes nothing.
  insert into public.chisel_events (sculpture_id, week_start, completion_pct, pieces) values (sid, wk + 7, 0.1, 0);
  select * into s from public.sculptures where id = sid;
  if s.pieces_revealed <> 5 or s.status <> 'carving' then raise exception 'zero-piece week changed the sculpture'; end if;

  -- pieces_revealed may never decrease or exceed 120
  begin
    update public.sculptures set pieces_revealed = 4 where id = sid;
    raise exception 'pieces_revealed decreased';
  exception when check_violation then null;
  end;
  begin
    update public.sculptures set pieces_revealed = 121 where id = sid;
    raise exception 'pieces_revealed exceeded 120';
  exception when check_violation then null;
  end;

  -- 23 more perfect weeks: 5 + 23·5 = 120
  for i in 2..24 loop
    insert into public.chisel_events (sculpture_id, week_start, completion_pct, pieces) values (sid, wk + 7 * i, 1, 5);
    select * into s from public.sculptures where id = sid;
    if i < 24 and s.status <> 'carving' then raise exception 'week %: expected carving, got %', i, s.status; end if;
  end loop;
  select * into s from public.sculptures where id = sid;
  if s.pieces_revealed <> 120 then raise exception 'expected 120, got %', s.pieces_revealed; end if;
  if s.status <> 'complete' or s.completed_at is null then raise exception 'expected complete with completed_at'; end if;

  -- Further events never push past 120.
  insert into public.chisel_events (sculpture_id, week_start, completion_pct, pieces) values (sid, wk + 7 * 25, 1, 5);
  select * into s from public.sculptures where id = sid;
  if s.pieces_revealed <> 120 or s.status <> 'complete' then raise exception 'cap broken: %', s.pieces_revealed; end if;

  -- Once complete, a new rock may be started; but only one active sculpture at a time.
  insert into public.sculptures (user_id, seed) values (uid, 42);
  begin
    insert into public.sculptures (user_id, seed) values (uid, 43);
    raise exception 'two active sculptures for one user';
  exception when unique_violation then null;
  end;
end $$;
