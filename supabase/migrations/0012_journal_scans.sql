-- Journal scan check-ins: a photographed handwritten page counts as the journal
-- entry. Stored as a file in the private 'journal-scans' bucket (owner-only via
-- folder-prefix RLS); journal_entries gains scan_path. Exactly one form per row:
-- either ciphertext+nonce (written entry) or scan_path (scanned page).

alter table public.journal_entries alter column ciphertext drop not null;
alter table public.journal_entries alter column nonce drop not null;
alter table public.journal_entries add column scan_path text;

alter table public.journal_entries add constraint journal_entries_one_form
  check ((ciphertext is null) = (scan_path is not null));

insert into storage.buckets (id, name, public) values ('journal-scans', 'journal-scans', false)
  on conflict (id) do nothing;

-- Objects live under <user_id>/<file>; the first folder must be the caller's id.
create policy journal_scans_owner on storage.objects for all to authenticated
  using (bucket_id = 'journal-scans' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'journal-scans' and (storage.foldername(name))[1] = auth.uid()::text);
