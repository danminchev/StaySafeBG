create extension if not exists pg_trgm;

create table if not exists public.trusted_phishing_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  source text not null default 'manual',
  confidence numeric(3,2) not null default 1.00 check (confidence >= 0 and confidence <= 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trusted_phishing_domains_domain_lowercase check (domain = lower(domain))
);

create index if not exists idx_trusted_phishing_domains_domain on public.trusted_phishing_domains(domain);
create index if not exists idx_trusted_phishing_domains_domain_trgm on public.trusted_phishing_domains using gin (domain gin_trgm_ops);
create index if not exists idx_trusted_phishing_domains_active on public.trusted_phishing_domains(is_active) where is_active = true;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_trusted_phishing_domains_set_updated_at on public.trusted_phishing_domains;
create trigger trg_trusted_phishing_domains_set_updated_at
before update on public.trusted_phishing_domains
for each row
execute function public.set_updated_at();

create or replace function public.normalize_domain(input_domain text)
returns text
language sql
immutable
as $$
  select
    case
      when input_domain is null then null
      else regexp_replace(lower(trim(input_domain)), '^www\.', '')
    end
$$;

create or replace function public.find_similar_phishing_domains(
  input_domain text,
  similarity_threshold real default 0.52,
  max_results integer default 5
)
returns table (
  domain text,
  similarity real,
  source text,
  confidence numeric
)
language sql
stable
set search_path = public
as $$
  with normalized as (
    select public.normalize_domain(input_domain) as d
  )
  select
    t.domain,
    similarity(t.domain, n.d) as similarity,
    t.source,
    t.confidence
  from public.trusted_phishing_domains t
  cross join normalized n
  where t.is_active = true
    and n.d is not null
    and n.d <> ''
    and t.domain <> n.d
    and similarity(t.domain, n.d) >= greatest(similarity_threshold, 0)
  order by similarity(t.domain, n.d) desc
  limit greatest(max_results, 1);
$$;

alter table public.trusted_phishing_domains enable row level security;

drop policy if exists "trusted_phishing_domains_read_all" on public.trusted_phishing_domains;
create policy "trusted_phishing_domains_read_all"
on public.trusted_phishing_domains
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "trusted_phishing_domains_admin_moderator_insert" on public.trusted_phishing_domains;
create policy "trusted_phishing_domains_admin_moderator_insert"
on public.trusted_phishing_domains
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

drop policy if exists "trusted_phishing_domains_admin_moderator_update" on public.trusted_phishing_domains;
create policy "trusted_phishing_domains_admin_moderator_update"
on public.trusted_phishing_domains
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

drop policy if exists "trusted_phishing_domains_admin_moderator_delete" on public.trusted_phishing_domains;
create policy "trusted_phishing_domains_admin_moderator_delete"
on public.trusted_phishing_domains
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

grant execute on function public.normalize_domain(text) to anon, authenticated;
grant execute on function public.find_similar_phishing_domains(text, real, integer) to anon, authenticated;
