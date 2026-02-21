import { requireSupabase } from './supabaseClient.js';

function normalizeDomain(domain) {
  return String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

export async function getTrustedPhishingDomains(limit = 300) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('trusted_phishing_domains')
    .select('id, domain, source, confidence, is_active, notes, created_at, last_seen_at, updated_at')
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function createTrustedPhishingDomain({ domain, source, confidence, notes }) {
  const supabase = requireSupabase();
  const payload = {
    domain: normalizeDomain(domain),
    source: String(source || 'manual').trim() || 'manual',
    confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : 0.9,
    notes: String(notes || '').trim() || null,
    is_active: true,
    last_seen_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('trusted_phishing_domains')
    .upsert(payload, { onConflict: 'domain' })
    .select('id, domain, source, confidence, is_active, notes, created_at, last_seen_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

export async function updateTrustedPhishingDomain(id, updates) {
  const supabase = requireSupabase();
  const payload = {};

  if (typeof updates.domain === 'string') payload.domain = normalizeDomain(updates.domain);
  if (typeof updates.source === 'string') payload.source = updates.source.trim() || 'manual';
  if (updates.confidence !== undefined) {
    const numeric = Number(updates.confidence);
    if (!Number.isFinite(numeric)) throw new Error('Invalid confidence value');
    payload.confidence = numeric;
  }
  if (typeof updates.notes === 'string') payload.notes = updates.notes.trim() || null;
  if (typeof updates.is_active === 'boolean') payload.is_active = updates.is_active;
  if (updates.bumpLastSeen) payload.last_seen_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('trusted_phishing_domains')
    .update(payload)
    .eq('id', id)
    .select('id, domain, source, confidence, is_active, notes, created_at, last_seen_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTrustedPhishingDomain(id) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('trusted_phishing_domains')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}
