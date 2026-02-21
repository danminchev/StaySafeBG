insert into public.trusted_phishing_domains (domain, source, confidence, notes)
values
  ('speedy-nanie.web.app', 'cybercrime.bg', 0.98, 'Seeded from trusted feed'),
  ('speedy-transs.pages.dev', 'cybercrime.bg', 0.98, 'Seeded from trusted feed'),
  ('speedy-coupons-e0ecae84.pages.dev', 'cybercrime.bg', 0.98, 'Seeded from trusted feed'),
  ('speedy-coupons-com-006765c8.pages.dev', 'cybercrime.bg', 0.99, 'Seeded from trusted feed'),
  ('speedy-web.pages.dev', 'cybercrime.bg', 0.97, 'Seeded from trusted feed'),
  ('speedy.users.gttg.space', 'cybercrime.bg', 0.97, 'Seeded from trusted feed')
on conflict (domain) do update
set
  source = excluded.source,
  confidence = excluded.confidence,
  is_active = true,
  last_seen_at = now(),
  notes = coalesce(excluded.notes, public.trusted_phishing_domains.notes),
  updated_at = now();
