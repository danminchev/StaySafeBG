drop policy if exists "trusted_phishing_domains_read_all" on public.trusted_phishing_domains;

create policy "trusted_phishing_domains_read_all"
on public.trusted_phishing_domains
for select
to anon, authenticated
using (
  is_active = true
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'moderator')
  )
);
