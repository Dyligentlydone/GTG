-- §7.4 test 3: a duplicate chisel event for the same week is rejected; chisel_events is append-only.

insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000301', 'dup@test.local');
insert into public.profiles (id, handle) values ('00000000-0000-4000-8000-000000000301', 'dup_player');

do $$
declare
  sid uuid;
  revealed integer;
begin
  select id into sid from public.sculptures where user_id = '00000000-0000-4000-8000-000000000301';
  insert into public.chisel_events (sculpture_id, week_start, completion_pct, pieces) values (sid, date '2026-03-02', 0.9, 5);

  begin
    insert into public.chisel_events (sculpture_id, week_start, completion_pct, pieces) values (sid, date '2026-03-02', 0.9, 5);
    raise exception 'duplicate chisel event accepted';
  exception when unique_violation then null;
  end;

  select pieces_revealed into revealed from public.sculptures where id = sid;
  if revealed <> 5 then raise exception 'duplicate changed pieces_revealed to %', revealed; end if;

  begin
    update public.chisel_events set pieces = 1 where sculpture_id = sid;
    raise exception 'chisel_events update allowed';
  exception when raise_exception then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;
  begin
    delete from public.chisel_events where sculpture_id = sid;
    raise exception 'chisel_events delete allowed';
  exception when raise_exception then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;

  -- Week must start on a Monday.
  begin
    insert into public.chisel_events (sculpture_id, week_start, completion_pct, pieces) values (sid, date '2026-03-10', 0.9, 5);
    raise exception 'non-Monday week accepted';
  exception when check_violation then null;
  end;
end $$;
