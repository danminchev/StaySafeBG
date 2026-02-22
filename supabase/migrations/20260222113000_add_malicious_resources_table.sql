create table if not exists public.malicious_resources (
  id uuid primary key default gen_random_uuid(),
  resource_value text not null,
  normalized_value text not null,
  resource_type text not null default 'url',
  threat_name text,
  source text not null default 'manual',
  confidence numeric(3,2) not null default 0.90 check (confidence >= 0 and confidence <= 1),
  risk_level text not null default 'high',
  status text not null default 'online',
  is_active boolean not null default true,
  notes text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint malicious_resources_resource_type_check check (resource_type in ('url', 'domain', 'ip', 'hash', 'file', 'other')),
  constraint malicious_resources_risk_level_check check (risk_level in ('low', 'medium', 'high')),
  constraint malicious_resources_status_check check (status in ('online', 'offline', 'unknown')),
  constraint malicious_resources_normalized_not_empty check (length(trim(normalized_value)) > 0)
);

create unique index if not exists ux_malicious_resources_type_normalized
on public.malicious_resources(resource_type, normalized_value);

create index if not exists idx_malicious_resources_active
on public.malicious_resources(is_active)
where is_active = true;

create index if not exists idx_malicious_resources_normalized_value
on public.malicious_resources(normalized_value);

create index if not exists idx_malicious_resources_type
on public.malicious_resources(resource_type);

create index if not exists idx_malicious_resources_status
on public.malicious_resources(status);

create index if not exists idx_malicious_resources_updated_at
on public.malicious_resources(updated_at desc);

drop trigger if exists trg_malicious_resources_set_updated_at on public.malicious_resources;
create trigger trg_malicious_resources_set_updated_at
before update on public.malicious_resources
for each row
execute function public.set_updated_at();

alter table public.malicious_resources enable row level security;

drop policy if exists "malicious_resources_read_all_active" on public.malicious_resources;
create policy "malicious_resources_read_all_active"
on public.malicious_resources
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "malicious_resources_admin_moderator_select_all" on public.malicious_resources;
create policy "malicious_resources_admin_moderator_select_all"
on public.malicious_resources
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'moderator')
  )
);

drop policy if exists "malicious_resources_admin_moderator_insert" on public.malicious_resources;
create policy "malicious_resources_admin_moderator_insert"
on public.malicious_resources
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'moderator')
  )
);

drop policy if exists "malicious_resources_admin_moderator_update" on public.malicious_resources;
create policy "malicious_resources_admin_moderator_update"
on public.malicious_resources
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'moderator')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'moderator')
  )
);

drop policy if exists "malicious_resources_admin_moderator_delete" on public.malicious_resources;
create policy "malicious_resources_admin_moderator_delete"
on public.malicious_resources
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'moderator')
  )
);
