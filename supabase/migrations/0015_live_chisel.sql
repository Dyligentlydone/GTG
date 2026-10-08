-- 0015 Live chisel: the statue becomes 875 pieces (~180 days of perfect play at
-- ~34/week). Daily-quest check-ins chip one piece the moment they land;
-- weekly-quota completions bank and all drop together at week close.

-- Drop every check that hardcoded 120 first — they would reject the updates below.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
    where conrelid = 'public.sculptures'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%120%'
  loop
    execute format('alter table public.sculptures drop constraint %I', c.conname);
  end loop;
end $$;
-- Existing statues adopt the new total; finished ones stay finished.
update public.sculptures set pieces_total = 875;
update public.sculptures set pieces_revealed = 875 where status = 'complete';
alter table public.sculptures
  add check (pieces_total = 875),
  add check (pieces_revealed between 0 and 875),
  add check ((status = 'complete') = (pieces_revealed = 875));

-- Live chips: one row per daily completion (week_start/completion_pct stay null);
-- weekly cascades keep writing (sculpture_id, week_start) rows. pieces bound moves
-- from the old 0-5 tier to 0-64 (a week's banked quota can't exceed ~20 today).
alter table public.chisel_events alter column week_start drop not null;
alter table public.chisel_events alter column completion_pct drop not null;
alter table public.chisel_events drop constraint chisel_events_week_start_check;
alter table public.chisel_events add check (week_start is null or extract(isodow from week_start) = 1);
alter table public.chisel_events drop constraint chisel_events_pieces_check;
alter table public.chisel_events add check (pieces between 0 and 64);
alter table public.chisel_events add column completion_id uuid references public.completions (id) on delete cascade;
-- Idempotent live chip: a completion can chip exactly once.
create unique index chisel_events_completion_key on public.chisel_events (completion_id) where completion_id is not null;
-- Exactly one shape per row: live chip xor weekly cascade.
alter table public.chisel_events add check ((completion_id is null) <> (week_start is null));

-- Reveal against pieces_total so the cap follows the row, not a literal.
create or replace function public.apply_chisel_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  revealed integer;
  total integer;
begin
  select s.pieces_revealed, s.pieces_total into revealed, total
    from public.sculptures s where s.id = new.sculpture_id for update;
  revealed := least(total, revealed + new.pieces);
  update public.sculptures s set
    pieces_revealed = revealed,
    status = case when revealed >= total then 'complete' when revealed > 0 then 'carving' else s.status end,
    completed_at = case when revealed >= total then coalesce(s.completed_at, now()) else s.completed_at end
  where s.id = new.sculpture_id;
  return new;
end;
$$;
