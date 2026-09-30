-- 0010 Row Level Security and grants (SPEC §7.3).
--
-- Model:
-- * Every table has RLS enabled.
-- * Players (role `authenticated`) read their own rows. They write directly only to profile
--   fields, paused days, books and shares. Everything that awards progress (completions, XP,
--   week results, chisel events, achievements, ledger…) is written by server route handlers with
--   the service role (which bypasses RLS), because proof validation and scoring live in the core.
-- * Game catalog tables (games, quests, achievements, plans, entitlements, seasons) are readable
--   by everyone and writable by admins (profiles.role = 'admin').
-- * journal_entries: owner only. No policy grants any other user or anon access.
-- * shares: owner full access; anon reads only through get_public_share(slug).

-- ---------- helpers ----------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.owns_sculpture(p_sculpture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.sculptures where id = p_sculpture_id and user_id = auth.uid());
$$;

create or replace function public.owns_ledger_account(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.ledger_accounts
                  where id = p_account_id and owner_type = 'user' and owner_id = auth.uid());
$$;

-- ---------- enable RLS everywhere ----------

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'plans', 'subscriptions', 'entitlements', 'games', 'seasons', 'quests', 'achievements',
    'enrollments', 'paused_days', 'books', 'completions', 'takeaways', 'journal_entries', 'xp_events',
    'streak_freezes', 'week_results', 'user_achievements', 'sculptures', 'chisel_events',
    'sculpture_decorations', 'shares', 'referrals', 'ledger_accounts', 'ledger_transactions',
    'ledger_entries', 'payouts', 'kyc_records', 'reputation_events', 'fraud_flags', 'events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- grants (tighten Supabase's default "all to anon/authenticated") ----------

grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;

grant select on all tables in schema public to authenticated;
grant select on public.games, public.quests, public.achievements, public.plans, public.entitlements, public.seasons to anon;

-- admin-writable catalog (RLS limits writes to admins)
grant insert, update, delete on public.games, public.quests, public.achievements, public.plans,
  public.entitlements, public.seasons to authenticated;

-- player-writable tables
grant insert (id, handle, display_name, time_zone, lat, lon, custom_wake_start, custom_wake_end,
              avatar_path, face_photo_path, face_consent_at)
  on public.profiles to authenticated;
grant update (handle, display_name, time_zone, lat, lon, custom_wake_start, custom_wake_end,
              avatar_path, face_photo_path, face_consent_at)
  on public.profiles to authenticated;
grant insert, update, delete on public.paused_days to authenticated;
grant insert, delete on public.books to authenticated;
grant update (title, total_pages) on public.books to authenticated;
grant insert, update, delete on public.shares to authenticated;
grant delete on public.journal_entries to authenticated;

revoke all on function public.get_public_share(text) from public;
grant execute on function public.get_public_share(text) to anon, authenticated, service_role;
revoke all on function public.handle_new_profile() from public;
revoke all on function public.apply_chisel_event() from public;
grant execute on function public.is_admin(), public.owns_sculpture(uuid), public.owns_ledger_account(uuid)
  to authenticated, service_role;

-- ---------- policies ----------

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- catalog: readable by everyone, writable by admins
do $$
declare t text;
begin
  foreach t in array array['games', 'quests', 'achievements', 'plans', 'entitlements', 'seasons'] loop
    execute format('create policy %1$s_read_all on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('create policy %1$s_admin_insert on public.%1$I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy %1$s_admin_update on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy %1$s_admin_delete on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- player-owned, read-only for the player (writes via service role)
do $$
declare t text;
begin
  foreach t in array array[
    'subscriptions', 'enrollments', 'completions', 'takeaways', 'xp_events', 'streak_freezes',
    'week_results', 'user_achievements', 'sculptures', 'payouts', 'kyc_records', 'reputation_events'
  ] loop
    execute format('create policy %1$s_select_own on public.%1$I for select to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- paused days: owner full access
create policy paused_days_select_own on public.paused_days for select to authenticated using (user_id = auth.uid());
create policy paused_days_insert_own on public.paused_days for insert to authenticated with check (user_id = auth.uid());
create policy paused_days_update_own on public.paused_days for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy paused_days_delete_own on public.paused_days for delete to authenticated using (user_id = auth.uid());

-- books: owner may add, rename and remove; pages are advanced by check-ins (service role)
create policy books_select_own on public.books for select to authenticated using (user_id = auth.uid());
create policy books_insert_own on public.books for insert to authenticated with check (user_id = auth.uid() and pages_read = 0 and finished_at is null);
create policy books_update_own on public.books for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy books_delete_own on public.books for delete to authenticated using (user_id = auth.uid());

-- journal entries: owner only (read and delete). Nothing for anon or other users.
create policy journal_entries_select_owner on public.journal_entries for select to authenticated using (user_id = auth.uid());
create policy journal_entries_delete_owner on public.journal_entries for delete to authenticated using (user_id = auth.uid());

-- sculpture children
create policy chisel_events_select_own on public.chisel_events for select to authenticated using (public.owns_sculpture(sculpture_id));
create policy sculpture_decorations_select_own on public.sculpture_decorations for select to authenticated using (public.owns_sculpture(sculpture_id));

-- shares: owner full access (anon uses get_public_share)
create policy shares_select_own on public.shares for select to authenticated using (user_id = auth.uid());
create policy shares_insert_own on public.shares for insert to authenticated with check (user_id = auth.uid());
create policy shares_update_own on public.shares for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy shares_delete_own on public.shares for delete to authenticated using (user_id = auth.uid());

-- referrals: both sides can see the link
create policy referrals_select_party on public.referrals for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid());

-- ledger: a player sees their own accounts and the entries/transactions touching them
create policy ledger_accounts_select_own on public.ledger_accounts for select to authenticated
  using (owner_type = 'user' and owner_id = auth.uid());
create policy ledger_entries_select_own on public.ledger_entries for select to authenticated
  using (public.owns_ledger_account(account_id));
create policy ledger_transactions_select_own on public.ledger_transactions for select to authenticated
  using (exists (select 1 from public.ledger_entries e where e.transaction_id = id and public.owns_ledger_account(e.account_id)));

-- fraud_flags, events: no player policies (service role / admins via service role only)
