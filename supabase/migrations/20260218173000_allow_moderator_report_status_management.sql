create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'moderator'
  );
$$;

grant execute on function public.is_moderator() to authenticated;

create or replace function public.can_moderate_reports()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_moderator();
$$;

grant execute on function public.can_moderate_reports() to authenticated;

drop policy if exists "reports_read_approved_own_or_admin"
on public.scam_reports;

drop policy if exists "reports_update_own_pending_or_admin"
on public.scam_reports;

drop policy if exists "reports_delete_own_pending_or_admin"
on public.scam_reports;

create policy "reports_read_approved_own_or_admin_or_moderator"
on public.scam_reports
for select
to anon, authenticated
using (
  status = 'approved'
  or created_by = auth.uid()
  or public.can_moderate_reports()
);

create policy "reports_update_own_pending_or_admin_or_moderator"
on public.scam_reports
for update
to authenticated
using (
  public.can_moderate_reports()
  or (created_by = auth.uid() and status = 'pending')
)
with check (
  public.can_moderate_reports()
  or (created_by = auth.uid() and status = 'pending')
);

create policy "reports_delete_own_pending_or_admin_or_moderator"
on public.scam_reports
for delete
to authenticated
using (
  public.can_moderate_reports()
  or (created_by = auth.uid() and status = 'pending')
);

drop policy if exists "report_files_select_own_or_admin"
on public.report_files;

drop policy if exists "report_files_select_approved_own_or_admin"
on public.report_files;

create policy "report_files_select_approved_own_or_admin_or_moderator"
on public.report_files
for select
to anon, authenticated
using (
  public.can_moderate_reports()
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

drop policy if exists "evidence_select_approved_own_or_admin"
on storage.objects;

create policy "evidence_select_approved_own_or_admin_or_moderator"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'evidence'
  and (
    public.can_moderate_reports()
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

drop policy if exists "evidence_delete_own_or_admin"
on storage.objects;

create policy "evidence_delete_own_or_admin_or_moderator"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'evidence'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.can_moderate_reports()
  )
);
