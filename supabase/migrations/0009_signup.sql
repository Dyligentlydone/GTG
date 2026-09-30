-- 0009 Rock at sign-up (SPEC §7.2): every new profile gets a sealed sculpture and a Game 1 enrollment.
-- If Game 1 (slug 'g1') has not been seeded yet, the enrollment is skipped (the sculpture is still
-- created); seed.sql backfills enrollments for existing profiles when it runs.

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  game1 uuid;
begin
  insert into public.sculptures (user_id, seed, status)
  values (new.id, floor(random() * 4294967296)::bigint, 'sealed');

  select g.id into game1 from public.games g where g.slug = 'g1';
  if game1 is not null then
    insert into public.enrollments (user_id, game_id, state, started_at)
    values (new.id, game1, 'active', new.joined_at)
    on conflict (user_id, game_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger profiles_create_rock_and_enroll
  after insert on public.profiles
  for each row execute function public.handle_new_profile();
