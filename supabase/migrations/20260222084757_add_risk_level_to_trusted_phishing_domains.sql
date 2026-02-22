alter table public.trusted_phishing_domains
add column if not exists risk_level text;

update public.trusted_phishing_domains
set risk_level = case
  when confidence >= 0.90 then 'high'
  when confidence >= 0.60 then 'medium'
  else 'low'
end
where risk_level is null;

alter table public.trusted_phishing_domains
alter column risk_level set default 'medium';

update public.trusted_phishing_domains
set risk_level = 'medium'
where risk_level not in ('low', 'medium', 'high');

alter table public.trusted_phishing_domains
alter column risk_level set not null;

alter table public.trusted_phishing_domains
drop constraint if exists trusted_phishing_domains_risk_level_check;

alter table public.trusted_phishing_domains
add constraint trusted_phishing_domains_risk_level_check
check (risk_level in ('low', 'medium', 'high'));

create index if not exists idx_trusted_phishing_domains_risk_level
on public.trusted_phishing_domains(risk_level);
