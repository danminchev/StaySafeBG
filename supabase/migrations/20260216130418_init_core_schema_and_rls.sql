create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
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
      and ur.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null,
  tags text[] not null default '{}',
  author_id uuid references auth.users(id) on delete set null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.scam_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null,
  scam_type text,
  url text,
  phone text,
  iban text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.report_files (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.scam_reports(id) on delete cascade,
  file_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_articles_created_at on public.articles(created_at desc);
create index if not exists idx_articles_category on public.articles(category);
create index if not exists idx_articles_published on public.articles(is_published);
create index if not exists idx_reports_created_by on public.scam_reports(created_by);
create index if not exists idx_reports_status on public.scam_reports(status);
create index if not exists idx_reports_created_at on public.scam_reports(created_at desc);
create index if not exists idx_report_files_report_id on public.report_files(report_id);

alter table public.user_roles enable row level security;
alter table public.articles enable row level security;
alter table public.scam_reports enable row level security;
alter table public.report_files enable row level security;

create policy "user_roles_select_own_or_admin"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "user_roles_insert_self"
on public.user_roles
for insert
to authenticated
with check (user_id = auth.uid() and role = 'user');

create policy "user_roles_admin_update"
on public.user_roles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "user_roles_admin_delete"
on public.user_roles
for delete
to authenticated
using (public.is_admin());

create policy "articles_read_published_or_admin"
on public.articles
for select
to anon, authenticated
using (is_published = true or public.is_admin());

create policy "articles_admin_insert"
on public.articles
for insert
to authenticated
with check (public.is_admin());

create policy "articles_admin_update"
on public.articles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "articles_admin_delete"
on public.articles
for delete
to authenticated
using (public.is_admin());

create policy "reports_read_approved_own_or_admin"
on public.scam_reports
for select
to anon, authenticated
using (status = 'approved' or created_by = auth.uid() or public.is_admin());

create policy "reports_insert_own_pending"
on public.scam_reports
for insert
to authenticated
with check (created_by = auth.uid() and status = 'pending');

create policy "reports_update_own_pending_or_admin"
on public.scam_reports
for update
to authenticated
using (public.is_admin() or (created_by = auth.uid() and status = 'pending'))
with check (public.is_admin() or (created_by = auth.uid() and status = 'pending'));

create policy "reports_delete_own_pending_or_admin"
on public.scam_reports
for delete
to authenticated
using (public.is_admin() or (created_by = auth.uid() and status = 'pending'));

create policy "report_files_select_own_or_admin"
on public.report_files
for select
to authenticated
using (
  public.is_admin() or exists (
    select 1
    from public.scam_reports r
    where r.id = report_id
      and r.created_by = auth.uid()
  )
);

create policy "report_files_insert_own_or_admin"
on public.report_files
for insert
to authenticated
with check (
  public.is_admin() or exists (
    select 1
    from public.scam_reports r
    where r.id = report_id
      and r.created_by = auth.uid()
  )
);

create policy "report_files_delete_own_or_admin"
on public.report_files
for delete
to authenticated
using (
  public.is_admin() or exists (
    select 1
    from public.scam_reports r
    where r.id = report_id
      and r.created_by = auth.uid()
  )
);
