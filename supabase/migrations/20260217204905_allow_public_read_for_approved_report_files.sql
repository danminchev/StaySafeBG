drop policy if exists "report_files_select_own_or_admin"
on public.report_files;

create policy "report_files_select_approved_own_or_admin"
on public.report_files
for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.scam_reports r
    where r.id = report_id
      and (
        r.status = 'approved'
        or r.created_by = auth.uid()
      )
  )
);

drop policy if exists "evidence_select_own_or_admin"
on storage.objects;

create policy "evidence_select_approved_own_or_admin"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'evidence'
  and (
    public.is_admin()
    or (
      auth.uid() is not null
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    or exists (
      select 1
      from public.report_files rf
      join public.scam_reports r on r.id = rf.report_id
      where rf.file_path = name
        and r.status = 'approved'
    )
  )
);
