-- 0011 Bootstrap profile on auth signup. Every auth.users row gets a profiles row,
-- which cascades into sculpture + enrollment via profiles_create_rock_and_enroll.
-- Without this, onboarding's profile update is a silent no-op and /api/sculpture 404s.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users who signed up before the trigger existed. Each profiles insert
-- fires profiles_create_rock_and_enroll, so they get their sculpture + enrollment too.
insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
