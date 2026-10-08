-- 0016 Click-to-chisel: chisel_events now BANK pieces; the player knocks them
-- off one click at a time. sculptures.pieces_earned tracks earned-but-not-yet
-- revealed work; pieces_revealed only moves through chisel_next_piece().

alter table public.sculptures add column pieces_earned integer not null default 0;
-- Everything earned before this change was auto-revealed, so revealed == earned.
update public.sculptures set pieces_earned = pieces_revealed;
alter table public.sculptures add check (pieces_earned between 0 and 875);
alter table public.sculptures add check (pieces_revealed <= pieces_earned);

-- A chisel event banks its pieces; status moves sealed → carving on first earned work.
create or replace function public.apply_chisel_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  earned integer;
begin
  select least(s.pieces_total, s.pieces_earned + new.pieces) into earned
    from public.sculptures s where s.id = new.sculpture_id for update;
  update public.sculptures s set
    pieces_earned = earned,
    status = case when s.status = 'complete' then 'complete' when earned > 0 then 'carving' else s.status end
  where s.id = new.sculpture_id;
  return new;
end;
$$;

-- One click knocks one banked piece loose. Atomic: a race between clicks can
-- only consume pieces that actually exist (the WHERE clause is the guard).
create or replace function public.chisel_next_piece(p_sculpture uuid)
returns table(revealed integer, pending integer, complete boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  update public.sculptures s set
    pieces_revealed = s.pieces_revealed + 1,
    status = case when s.pieces_revealed + 1 >= s.pieces_total then 'complete' else 'carving' end,
    completed_at = case when s.pieces_revealed + 1 >= s.pieces_total then coalesce(s.completed_at, now()) else s.completed_at end
  where s.id = p_sculpture and s.pieces_revealed < s.pieces_earned
  returning s.pieces_revealed, s.pieces_earned, s.pieces_total into r;
  if r is null then
    select s.pieces_revealed, s.pieces_earned, s.pieces_total into r
      from public.sculptures s where s.id = p_sculpture;
  end if;
  if r is null then return; end if; -- no such sculpture → empty result
  revealed := r.pieces_revealed;
  pending := greatest(0, r.pieces_earned - r.pieces_revealed);
  complete := r.pieces_revealed >= r.pieces_total;
  return next;
end;
$$;
-- Server-only: the API calls this via the service role.
revoke execute on function public.chisel_next_piece(uuid) from public, anon, authenticated;
grant execute on function public.chisel_next_piece(uuid) to service_role;
