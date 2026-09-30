-- §7.4 test 1: inserting a profile creates exactly one sealed sculpture (120 pieces, 0 revealed)
-- and a Game 1 enrollment. Also: a player can create their own profile (onboarding) but not
-- someone else's, and signup still works (without enrollment) if Game 1 is missing.

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000101', 'rock1@test.local'),
  ('00000000-0000-4000-8000-000000000102', 'rock2@test.local'),
  ('00000000-0000-4000-8000-000000000103', 'rock3@test.local'),
  ('00000000-0000-4000-8000-000000000104', 'rock4@test.local');

insert into public.profiles (id, handle, time_zone)
values ('00000000-0000-4000-8000-000000000101', 'rock_one', 'America/Costa_Rica');

do $$
declare
  uid constant uuid := '00000000-0000-4000-8000-000000000101';
  n integer;
  s public.sculptures;
begin
  select count(*) into n from public.sculptures where user_id = uid;
  if n <> 1 then raise exception 'expected exactly 1 sculpture, got %', n; end if;

  select * into s from public.sculptures where user_id = uid;
  if s.status <> 'sealed' then raise exception 'expected sealed, got %', s.status; end if;
  if s.pieces_total <> 120 then raise exception 'expected 120 pieces, got %', s.pieces_total; end if;
  if s.pieces_revealed <> 0 then raise exception 'expected 0 revealed, got %', s.pieces_revealed; end if;
  if s.seed is null or s.seed < 0 or s.seed > 4294967295 then raise exception 'bad seed %', s.seed; end if;

  select count(*) into n
    from public.enrollments e join public.games g on g.id = e.game_id
   where e.user_id = uid and g.slug = 'g1' and e.state = 'active';
  if n <> 1 then raise exception 'expected 1 Game 1 enrollment, got %', n; end if;

  select count(*) into n from public.enrollments where user_id = uid;
  if n <> 1 then raise exception 'expected exactly 1 enrollment, got %', n; end if;
end $$;

-- Onboarding as the player: own profile allowed (trigger still creates the rock), others refused.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000102';
insert into public.profiles (id, handle) values ('00000000-0000-4000-8000-000000000102', 'rock_two');
do $$
begin
  begin
    insert into public.profiles (id, handle) values ('00000000-0000-4000-8000-000000000103', 'rock_three');
    raise exception 'player created a profile for someone else';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.profiles (id, handle, role) values ('00000000-0000-4000-8000-000000000103', 'sneaky', 'admin');
    raise exception 'player could set role on insert';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;

do $$
declare n integer;
begin
  select count(*) into n from public.sculptures where user_id = '00000000-0000-4000-8000-000000000102' and status = 'sealed';
  if n <> 1 then raise exception 'onboarding profile: expected 1 sealed sculpture, got %', n; end if;
end $$;

-- Graceful skip: if Game 1 has not been seeded, the rock is still created and enrollment is skipped.
do $$
declare n integer; e integer;
begin
  begin
    update public.games set slug = 'g1-hidden' where slug = 'g1';
    insert into public.profiles (id, handle) values ('00000000-0000-4000-8000-000000000104', 'rock_four');
    select count(*) into n from public.sculptures where user_id = '00000000-0000-4000-8000-000000000104';
    select count(*) into e from public.enrollments where user_id = '00000000-0000-4000-8000-000000000104';
    if n <> 1 or e <> 0 then raise exception 'without g1: sculptures=%, enrollments=%', n, e; end if;
    raise exception 'rollback-ok';
  exception when others then
    if sqlerrm <> 'rollback-ok' then raise; end if;
  end;
  if not exists (select 1 from public.games where slug = 'g1') then raise exception 'g1 slug not restored'; end if;
end $$;
