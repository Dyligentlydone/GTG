-- §7.4 test 7: seed: the 8 pillars' quests exist for Game 1 with the exact founding titles.

do $$
declare
  gid uuid;
  n integer;
  founding_titles text[];
begin
  select id into gid from public.games where slug = 'g1' and type = 'free' and status = 'active';
  if gid is null then raise exception 'Game 1 (g1) not seeded as an active free game'; end if;

  select count(*) into n from public.quests where game_id = gid;
  if n <> 9 then raise exception 'expected 9 Game 1 quests, got %', n; end if;

  select count(distinct pillar) into n from public.quests where game_id = gid;
  if n <> 8 then raise exception 'expected quests in 8 pillars, got %', n; end if;

  select array_agg(title order by sort_order) into founding_titles from public.quests where game_id = gid and founding;
  if founding_titles is distinct from array[
    'Read 10 pages a day from a self-development book',
    'Exercise 4 days a week',
    'Wake up before the sun rises 5 days a week',
    'Journal once a day'
  ] then
    raise exception 'founding titles differ: %', founding_titles;
  end if;

  if not exists (select 1 from public.quests where game_id = gid and key = 'g1.dawn'
                   and "window" ->> 'kind' = 'before_sunrise' and schedule ->> 'perWeek' = '5') then
    raise exception 'g1.dawn window/schedule not seeded';
  end if;

  select count(*) into n from public.achievements where game_id = gid;
  if n <> 20 then raise exception 'expected 20 achievements, got %', n; end if;

  select count(*) into n from public.plans where key in ('free', 'pro');
  if n <> 2 then raise exception 'expected free and pro plans, got %', n; end if;
end $$;

-- Re-running the seed is a no-op (idempotent).
\ir ../seed.sql
do $$
declare n integer;
begin
  select count(*) into n from public.quests q join public.games g on g.id = q.game_id where g.slug = 'g1';
  if n <> 9 then raise exception 'seed not idempotent: % quests', n; end if;
  select count(*) into n from public.games where slug = 'g1';
  if n <> 1 then raise exception 'seed not idempotent: % games', n; end if;
end $$;
