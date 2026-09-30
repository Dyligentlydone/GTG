-- 0005 The Sculpture: sculptures, chisel events, decorations (SPEC §7.1, §7.2).

create table public.sculptures (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  archetype        text not null default 'philosopher' check (archetype in ('philosopher', 'athlete', 'warrior', 'orator')),
  seed             bigint not null check (seed between 0 and 4294967295),
  pieces_total     integer not null default 120 check (pieces_total = 120),
  pieces_revealed  integer not null default 0 check (pieces_revealed between 0 and 120),
  status           text not null default 'sealed' check (status in ('sealed', 'carving', 'complete')),
  final_image_path text,
  rough_image_path text,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  check ((status = 'complete') = (pieces_revealed = 120)),
  check ((status = 'complete') = (completed_at is not null))
);
-- One active (not yet complete) sculpture per user.
create unique index sculptures_one_active_per_user on public.sculptures (user_id) where status <> 'complete';

-- pieces_revealed may only increase (the 0..120 bound is the check constraint above).
create or replace function public.sculptures_guard_pieces()
returns trigger
language plpgsql
as $$
begin
  if new.pieces_revealed < old.pieces_revealed then
    raise exception 'pieces_revealed can only increase (% -> %)', old.pieces_revealed, new.pieces_revealed
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger sculptures_pieces_only_increase before update of pieces_revealed on public.sculptures
  for each row execute function public.sculptures_guard_pieces();

create table public.chisel_events (
  id             uuid primary key default gen_random_uuid(),
  sculpture_id   uuid not null references public.sculptures (id) on delete cascade,
  week_start     date not null check (extract(isodow from week_start) = 1),
  completion_pct numeric(5, 4) not null check (completion_pct between 0 and 1),
  pieces         integer not null check (pieces between 0 and 5),
  created_at     timestamptz not null default now(),
  unique (sculpture_id, week_start)
);
create trigger chisel_events_append_only before update or delete on public.chisel_events
  for each row execute function public.forbid_update_delete('allow_cascade');
create trigger chisel_events_no_truncate before truncate on public.chisel_events
  for each statement execute function public.forbid_truncate();

-- Each chisel event reveals its pieces (capped at 120) and advances the sculpture status.
create or replace function public.apply_chisel_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  revealed integer;
begin
  select least(120, s.pieces_revealed + new.pieces) into revealed
    from public.sculptures s where s.id = new.sculpture_id for update;
  update public.sculptures s set
    pieces_revealed = revealed,
    status = case when revealed >= 120 then 'complete' when revealed > 0 then 'carving' else s.status end,
    completed_at = case when revealed >= 120 then coalesce(s.completed_at, now()) else s.completed_at end
  where s.id = new.sculpture_id;
  return new;
end;
$$;
create trigger chisel_events_apply after insert on public.chisel_events
  for each row execute function public.apply_chisel_event();

create table public.sculpture_decorations (
  id              uuid primary key default gen_random_uuid(),
  sculpture_id    uuid not null references public.sculptures (id) on delete cascade,
  decoration_type text not null,
  source_type     text not null,
  source_id       text not null,
  earned_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (sculpture_id, decoration_type, source_type, source_id)
);
create index sculpture_decorations_sculpture_idx on public.sculpture_decorations (sculpture_id);
