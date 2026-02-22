import { requireSupabase } from './supabaseClient.js';

function normalizeDomain(domain) {
  return String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

function normalizeRiskLevel(value, fallback = 'medium') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return fallback;
}

export async function getTrustedPhishingDomains(limit = 300) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('trusted_phishing_domains')
    .select('id, domain, source, confidence, risk_level, is_active, notes, created_at, last_seen_at, updated_at')
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function createTrustedPhishingDomain({ domain, source, confidence, notes, riskLevel }) {
  const supabase = requireSupabase();
  const numericConfidence = Number.isFinite(Number(confidence)) ? Number(confidence) : 0.9;
  const payload = {
    domain: normalizeDomain(domain),
    source: String(source || 'manual').trim() || 'manual',
    confidence: numericConfidence,
    risk_level: normalizeRiskLevel(
      riskLevel,
      numericConfidence >= 0.9 ? 'high' : numericConfidence >= 0.6 ? 'medium' : 'low'
    ),
    notes: String(notes || '').trim() || null,
    is_active: true,
    last_seen_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('trusted_phishing_domains')
    .upsert(payload, { onConflict: 'domain' })
    .select('id, domain, source, confidence, risk_level, is_active, notes, created_at, last_seen_at, updated_at')
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
  if (updates.risk_level !== undefined || updates.riskLevel !== undefined) {
    payload.risk_level = normalizeRiskLevel(updates.risk_level ?? updates.riskLevel);
  }
  if (typeof updates.notes === 'string') payload.notes = updates.notes.trim() || null;
  if (typeof updates.is_active === 'boolean') payload.is_active = updates.is_active;
  if (updates.bumpLastSeen) payload.last_seen_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('trusted_phishing_domains')
    .update(payload)
    .eq('id', id)
    .select('id, domain, source, confidence, risk_level, is_active, notes, created_at, last_seen_at, updated_at')
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
