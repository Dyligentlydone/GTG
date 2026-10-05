-- 0013 Quest lore: player-facing flavor text shown on the quest page and
-- in the in-world shrine modal. `description` = what the quest is;
-- `why` = why it's worth doing.
alter table public.quests
  add column description text,
  add column why text;
