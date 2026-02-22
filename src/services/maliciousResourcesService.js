import { requireSupabase } from './supabaseClient.js';

function normalizeRiskLevel(value, fallback = 'high') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') return normalized;
  return fallback;
}

function normalizeResourceType(value, fallback = 'url') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['url', 'domain', 'ip', 'hash', 'file', 'other'].includes(normalized)) return normalized;
  return fallback;
}

function normalizeStatus(value, fallback = 'online') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['online', 'offline', 'unknown'].includes(normalized)) return normalized;
  return fallback;
}

export function normalizeMaliciousResourceValue(resourceValue, resourceType = 'url') {
  const value = String(resourceValue || '').trim();
  const type = normalizeResourceType(resourceType);
  if (!value) return '';

  if (type === 'url') {
    const candidate = /^https?:\/\//i.test(value) ? value : `http://${value}`;
    try {
      const parsed = new URL(candidate);
      parsed.hash = '';
      parsed.search = '';
      return parsed.href.replace(/\/$/, '').toLowerCase();
    } catch {
      return value.toLowerCase();
    }
  }

  if (type === 'domain') {
    return value
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '');
  }

  if (type === 'ip') {
    return value
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '');
  }

  if (type === 'hash') {
    return value.replace(/\s+/g, '').toLowerCase();
  }

  return value.toLowerCase();
}

function deriveTermsForLookup(input) {
  const raw = String(input || '').trim();
  if (!raw) return [];

  const terms = new Set([raw.toLowerCase()]);
  const emailMatch = raw.match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/);
  if (emailMatch?.[1]) {
    terms.add(normalizeMaliciousResourceValue(emailMatch[1], 'domain'));
  }

  const hashCandidate = raw.replace(/\s+/g, '');
  if (/^[a-fA-F0-9]{32,128}$/.test(hashCandidate)) {
    terms.add(normalizeMaliciousResourceValue(hashCandidate, 'hash'));
  }

  const isLikelyUrl = /^https?:\/\//i.test(raw) || raw.includes('.') || /^(?:\d{1,3}\.){3}\d{1,3}/.test(raw);
  if (isLikelyUrl) {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(candidate);
      parsed.hash = '';
      parsed.search = '';
      terms.add(parsed.href.replace(/\/$/, '').toLowerCase());
      terms.add(normalizeMaliciousResourceValue(parsed.hostname, 'domain'));
      terms.add(normalizeMaliciousResourceValue(parsed.hostname, 'ip'));
      if (parsed.pathname && parsed.pathname !== '/') {
        terms.add(`${parsed.origin.toLowerCase()}${parsed.pathname}`.replace(/\/$/, ''));
      }
    } catch {
      // ignore invalid URL parse
    }
  }

  return Array.from(terms).filter(Boolean).slice(0, 12);
}

const SELECT_FIELDS = 'id, resource_value, normalized_value, resource_type, threat_name, source, confidence, risk_level, status, is_active, notes, created_at, first_seen_at, last_seen_at, updated_at';

export async function getMaliciousResources(limit = 300) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('malicious_resources')
    .select(SELECT_FIELDS)
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function createMaliciousResource({
  resourceValue,
  resourceType,
  source,
  confidence,
  riskLevel,
  status,
  threatName,
  notes
}) {
  const supabase = requireSupabase();
  const type = normalizeResourceType(resourceType);
  const normalized = normalizeMaliciousResourceValue(resourceValue, type);
  const numericConfidence = Number.isFinite(Number(confidence)) ? Number(confidence) : 0.9;

  const payload = {
    resource_value: String(resourceValue || '').trim(),
    normalized_value: normalized,
    resource_type: type,
    source: String(source || 'manual').trim() || 'manual',
    confidence: numericConfidence,
    risk_level: normalizeRiskLevel(
      riskLevel,
      numericConfidence >= 0.9 ? 'high' : numericConfidence >= 0.6 ? 'medium' : 'low'
    ),
    status: normalizeStatus(status),
    threat_name: String(threatName || '').trim() || null,
    notes: String(notes || '').trim() || null,
    is_active: true,
    last_seen_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('malicious_resources')
    .upsert(payload, { onConflict: 'resource_type,normalized_value' })
    .select(SELECT_FIELDS)
    .single();

  if (error) throw error;
  return data;
}

export async function updateMaliciousResource(id, updates) {
  const supabase = requireSupabase();
  const payload = {};

  const nextType = updates.resource_type !== undefined || updates.resourceType !== undefined
    ? normalizeResourceType(updates.resource_type ?? updates.resourceType)
    : null;

  if (typeof updates.resource_value === 'string' || typeof updates.resourceValue === 'string') {
    const rawValue = String((updates.resource_value ?? updates.resourceValue) || '').trim();
    payload.resource_value = rawValue;
    payload.normalized_value = normalizeMaliciousResourceValue(rawValue, nextType || 'url');
  }

  if (nextType) {
    payload.resource_type = nextType;
    if (payload.resource_value && !payload.normalized_value) {
      payload.normalized_value = normalizeMaliciousResourceValue(payload.resource_value, nextType);
    }
  }

  if (typeof updates.source === 'string') payload.source = updates.source.trim() || 'manual';
  if (updates.confidence !== undefined) {
    const numeric = Number(updates.confidence);
    if (!Number.isFinite(numeric)) throw new Error('Invalid confidence value');
    payload.confidence = numeric;
  }
  if (updates.risk_level !== undefined || updates.riskLevel !== undefined) {
    payload.risk_level = normalizeRiskLevel(updates.risk_level ?? updates.riskLevel);
  }
  if (updates.status !== undefined) payload.status = normalizeStatus(updates.status);
  if (typeof updates.threat_name === 'string' || typeof updates.threatName === 'string') {
    payload.threat_name = String(updates.threat_name ?? updates.threatName).trim() || null;
  }
  if (typeof updates.notes === 'string') payload.notes = updates.notes.trim() || null;
  if (typeof updates.is_active === 'boolean') payload.is_active = updates.is_active;
  if (updates.bumpLastSeen) payload.last_seen_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('malicious_resources')
    .update(payload)
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMaliciousResource(id) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('malicious_resources')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function checkAgainstMaliciousResources(input) {
  const supabase = requireSupabase();
  const terms = deriveTermsForLookup(input);
  if (terms.length === 0) return { matched: false, matches: [] };

  const { data, error } = await supabase
    .from('malicious_resources')
    .select(SELECT_FIELDS)
    .eq('is_active', true)
    .in('normalized_value', terms)
    .order('risk_level', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) throw error;

  const matches = data || [];
  return {
    matched: matches.length > 0,
    matches,
    terms
  };
}

export async function getRecentActiveMaliciousResources(limit = 10) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('malicious_resources')
    .select(SELECT_FIELDS)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
