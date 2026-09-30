-- §7.4 test 6: RLS. User A cannot read user B's completions or journal entries; anon can read
-- a public share only through get_public_share (never deleted shares, never journal content
-- unless include_journal). Plus: players cannot write progress tables or catalog; admins can.

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000060a', 'a@test.local'),
  ('00000000-0000-4000-8000-00000000060b', 'b@test.local'),
  ('00000000-0000-4000-8000-00000000060c', 'admin@test.local');
insert into public.profiles (id, handle, role) values
  ('00000000-0000-4000-8000-00000000060a', 'player_a', 'player'),
  ('00000000-0000-4000-8000-00000000060b', 'player_b', 'player'),
  ('00000000-0000-4000-8000-00000000060c', 'the_admin', 'admin');

insert into public.completions (id, user_id, quest_id, local_date, completed_at, payload)
select v.id, v.user_id, q.id, date '2026-03-02', now(), '{}'::jsonb
  from (values ('00000000-0000-4000-8000-000000000611'::uuid, '00000000-0000-4000-8000-00000000060a'::uuid),
               ('00000000-0000-4000-8000-000000000612'::uuid, '00000000-0000-4000-8000-00000000060b'::uuid)) as v(id, user_id)
  cross join public.quests q
  join public.games g on g.id = q.game_id and g.slug = 'g1'
 where q.key = 'g1.journal';

insert into public.journal_entries (user_id, completion_id, ciphertext, nonce) values
  ('00000000-0000-4000-8000-00000000060a', '00000000-0000-4000-8000-000000000611', '\x01'::bytea, '\x02'::bytea),
  ('00000000-0000-4000-8000-00000000060b', '00000000-0000-4000-8000-000000000612', '\x03'::bytea, '\x04'::bytea);

insert into public.shares (user_id, scope, item_refs, include_journal, public_slug, deleted_at) values
  ('00000000-0000-4000-8000-00000000060b', 'day',
   '[{"type":"quest","id":"g1.read"},{"type":"journal","text":"private thoughts"}]', false, 'share-private-journal', null),
  ('00000000-0000-4000-8000-00000000060b', 'day',
   '[{"type":"journal","text":"shared on purpose"}]', true, 'share-with-journal', null),
  ('00000000-0000-4000-8000-00000000060b', 'quest', '[{"type":"quest","id":"g1.read"}]', false, 'share-deleted', now());

-- ---------- as user A ----------
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000060a';
do $$
declare n integer;
begin
  if exists (select 1 from public.completions where user_id = '00000000-0000-4000-8000-00000000060b') then
    raise exception 'A can read B''s completions';
  end if;
  select count(*) into n from public.completions;
  if n <> 1 then raise exception 'A should see exactly own completion, saw %', n; end if;

  if exists (select 1 from public.journal_entries where user_id = '00000000-0000-4000-8000-00000000060b') then
    raise exception 'A can read B''s journal entries';
  end if;
  select count(*) into n from public.journal_entries;
  if n <> 1 then raise exception 'A should see exactly own journal entry, saw %', n; end if;

  if exists (select 1 from public.shares where user_id = '00000000-0000-4000-8000-00000000060b') then
    raise exception 'A can read B''s share rows directly';
  end if;
  if exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-00000000060b') then
    raise exception 'A can read B''s profile';
  end if;
  if exists (select 1 from public.sculptures where user_id = '00000000-0000-4000-8000-00000000060b') then
    raise exception 'A can read B''s sculpture';
  end if;
  if not exists (select 1 from public.sculptures where user_id = '00000000-0000-4000-8000-00000000060a') then
    raise exception 'A cannot read own sculpture';
  end if;

  -- Progress tables are written by the service role only.
  begin
    insert into public.xp_events (user_id, source_type, source_id, amount, idempotency_key)
    values ('00000000-0000-4000-8000-00000000060a', 'quest', 'x', 1000000, 'cheat');
    raise exception 'player inserted xp_events';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.completions (user_id, quest_id, local_date, completed_at)
    select '00000000-0000-4000-8000-00000000060a', id, date '2026-03-03', now() from public.quests limit 1;
    raise exception 'player inserted completions directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.sculptures set pieces_revealed = 120 where user_id = '00000000-0000-4000-8000-00000000060a';
    raise exception 'player updated own sculpture';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-00000000060a';
    raise exception 'player promoted self to admin';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.games (slug, title, type) values ('evil', 'Evil', 'free');
    raise exception 'non-admin inserted a game';
  exception when insufficient_privilege then null;
  end;
  update public.quests set title = 'hacked' where key = 'g1.read';
  if exists (select 1 from public.quests where title = 'hacked') then raise exception 'non-admin updated a quest'; end if;

  -- Allowed: own profile fields, own paused days, own shares; not someone else's.
  update public.profiles set display_name = 'Player A' where id = '00000000-0000-4000-8000-00000000060a';
  insert into public.paused_days (user_id, local_date, reason) values ('00000000-0000-4000-8000-00000000060a', date '2026-03-04', 'travel');
  begin
    insert into public.paused_days (user_id, local_date) values ('00000000-0000-4000-8000-00000000060b', date '2026-03-04');
    raise exception 'A paused a day for B';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

-- ---------- as the admin ----------
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000060c';
do $$
begin
  update public.quests set title = 'Admin edit' where key = 'g1.play';
  if not exists (select 1 from public.quests where key = 'g1.play' and title = 'Admin edit') then
    raise exception 'admin could not edit a quest';
  end if;
  if exists (select 1 from public.journal_entries) then
    raise exception 'admin can read journal entries';
  end if;
end $$;
rollback;

-- ---------- as anon ----------
begin;
set local role anon;
do $$
declare
  refs jsonb;
  n integer;
begin
  begin
    perform 1 from public.shares;
    raise exception 'anon read shares table directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.journal_entries;
    raise exception 'anon read journal_entries';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.completions;
    raise exception 'anon read completions';
  exception when insufficient_privilege then null;
  end;

  select count(*) into n from public.get_public_share('share-private-journal');
  if n <> 1 then raise exception 'public share not returned (%)', n; end if;
  select item_refs into refs from public.get_public_share('share-private-journal');
  if refs::text like '%private thoughts%' or refs::text like '%journal%' then
    raise exception 'journal content leaked: %', refs;
  end if;
  if jsonb_array_length(refs) <> 1 then raise exception 'non-journal refs dropped: %', refs; end if;

  select item_refs into refs from public.get_public_share('share-with-journal');
  if refs::text not like '%shared on purpose%' then raise exception 'explicitly shared journal missing: %', refs; end if;

  select count(*) into n from public.get_public_share('share-deleted');
  if n <> 0 then raise exception 'deleted share returned'; end if;
  select count(*) into n from public.get_public_share('no-such-share');
  if n <> 0 then raise exception 'unknown slug returned rows'; end if;

  -- The catalog is public.
  select count(*) into n from public.quests;
  if n < 9 then raise exception 'anon cannot read quests (%)', n; end if;
end $$;
rollback;
