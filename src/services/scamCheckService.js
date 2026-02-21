import { requireSupabase } from './supabaseClient.js';

const INTERNET_CHECK_BASE = 'https://phish.sinking.yachts/v2/check/';
const THREAT_CHECK_FUNCTION_NAME = 'threat-check';

function normalizeInput(value) {
  return String(value || '').trim();
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function detectInputType(value) {
  const input = normalizeInput(value);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const ipv4Pattern = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:\/.*)?$/;
  const hasLetters = /[a-zA-Zа-яА-Я]/.test(input);
  const digitsOnly = input.replace(/\D/g, '');

  if (emailPattern.test(input)) return 'email';
  if (input.startsWith('http://') || input.startsWith('https://') || (input.includes('.') && hasLetters) || ipv4Pattern.test(input)) return 'url';
  if (digitsOnly.length >= 6) return 'phone';

  return 'unknown';
}

function normalizeUrlCandidate(value) {
  const trimmed = normalizeInput(value);
  if (!trimmed) return null;

  const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(prefixed);
    return parsed.href;
  } catch {
    return null;
  }
}

function extractDomainFromEmail(email) {
  const [, domain] = String(email || '').split('@');
  return domain ? domain.toLowerCase() : null;
}

function buildDbSearchTerms(rawInput, type) {
  const normalized = normalizeInput(rawInput);
  const compactPhone = normalizePhone(rawInput);
  const terms = [normalized];

  if (type === 'url') {
    const candidateUrl = normalizeUrlCandidate(normalized);
    if (candidateUrl) {
      const host = new URL(candidateUrl).hostname;
      terms.push(host);
    }
  }

  if (type === 'email') {
    const domain = extractDomainFromEmail(normalized);
    if (domain) terms.push(domain);
  }

  if (type === 'phone' && compactPhone) {
    terms.push(compactPhone);
  }

  return terms
    .map((term) => String(term || '').replace(/[%(),]/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 4);
}

async function checkAgainstDatabase(rawInput, type) {
  const supabase = requireSupabase();
  const terms = buildDbSearchTerms(rawInput, type);

  if (terms.length === 0) {
    return { matched: false, matches: [] };
  }

  const orFilters = terms
    .map((term) => `url.ilike.%${term}%,phone.ilike.%${term}%,title.ilike.%${term}%,description.ilike.%${term}%`)
    .join(',');

  const { data, error } = await supabase
    .from('scam_reports')
    .select('id, title, category, scam_type, created_at, status, url, phone')
    .eq('status', 'approved')
    .or(orFilters)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw error;

  return {
    matched: (data || []).length > 0,
    matches: data || [],
  };
}

async function checkAgainstInternet(rawInput, type) {
  let urlCandidate = null;

  if (type === 'url') {
    urlCandidate = normalizeUrlCandidate(rawInput);
  } else if (type === 'email') {
    const domain = extractDomainFromEmail(rawInput);
    urlCandidate = domain ? normalizeUrlCandidate(domain) : null;
  }

  if (!urlCandidate) {
    return {
      checked: false,
      flagged: false,
      source: 'phish.sinking.yachts',
      details: null,
    };
  }

  try {
    const response = await fetch(`${INTERNET_CHECK_BASE}${encodeURIComponent(urlCandidate)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return {
        checked: true,
        flagged: false,
        source: 'phish.sinking.yachts',
        details: { error: `HTTP ${response.status}` },
      };
    }

    const data = await response.json();

    let flagged = false;
    if (typeof data === 'boolean') {
      flagged = data;
    } else if (typeof data?.phish === 'boolean') {
      flagged = data.phish;
    } else if (Array.isArray(data)) {
      flagged = data.some((item) => Boolean(item?.phish) || Boolean(item?.in_database));
    }

    return {
      checked: true,
      flagged,
      source: 'phish.sinking.yachts',
      details: data,
    };
  } catch (error) {
    return {
      checked: false,
      flagged: false,
      source: 'phish.sinking.yachts',
      details: { error: error?.message || 'Network error' },
    };
  }
}

function mapVerdictFromScore(score) {
  if (score >= 70) return 'danger';
  if (score >= 35) return 'warning';
  return 'clean';
}

function analyzeHeuristicUrlRisk(rawInput, inputType) {
  if (inputType !== 'url') {
    return { risk: 0, reasons: [] };
  }

  const candidate = normalizeUrlCandidate(rawInput);
  if (!candidate) {
    return { risk: 0, reasons: [] };
  }

  const parsed = new URL(candidate);
  const reasons = [];
  let risk = 0;

  const isIpv4Host = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(parsed.hostname);
  if (isIpv4Host) {
    risk += 40;
    reasons.push('URL използва директен IP адрес вместо домейн');
  }

  if (parsed.protocol === 'http:') {
    risk += 12;
    reasons.push('URL е по HTTP (без TLS)');
  }

  if (parsed.port && !['80', '443'].includes(parsed.port)) {
    risk += 18;
    reasons.push(`URL използва нестандартен порт (${parsed.port})`);
  }

  return {
    risk: Math.min(65, risk),
    reasons,
  };
}

async function checkInternetViaEdgeFunction(rawInput, inputType) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.functions.invoke(THREAT_CHECK_FUNCTION_NAME, {
    body: {
      input: rawInput,
      inputType,
    },
  });

  if (error) throw error;

  const sources = Array.isArray(data?.sources) ? data.sources : [];
  const checkedCount = Number.isFinite(data?.checkedCount) ? data.checkedCount : sources.filter((source) => source.checked).length;
  const flaggedCount = Number.isFinite(data?.flaggedCount) ? data.flaggedCount : sources.filter((source) => source.flagged).length;
  const riskScore = Number.isFinite(data?.riskScore) ? data.riskScore : 0;

  return {
    checked: checkedCount > 0,
    flagged: flaggedCount > 0,
    source: 'edge-function',
    details: data,
    riskScore,
    verdict: data?.verdict || mapVerdictFromScore(riskScore),
    sources,
    checkedCount,
    flaggedCount,
    usedEdgeFunction: true,
  };
}

export async function runScamCheck(rawInput) {
  const input = normalizeInput(rawInput);
  if (!input) {
    throw new Error('Моля въведете линк, телефон или имейл.');
  }

  const inputType = detectInputType(input);
  if (inputType === 'unknown') {
    throw new Error('Невалиден формат. Въведете URL, телефонен номер или имейл.');
  }

  const databaseResultPromise = checkAgainstDatabase(input, inputType);
  const internetResultPromise = checkInternetViaEdgeFunction(input, inputType)
    .catch(async () => {
      const fallback = await checkAgainstInternet(input, inputType);
      return {
        ...fallback,
        riskScore: fallback.flagged ? 50 : 0,
        verdict: fallback.flagged ? 'warning' : 'clean',
        sources: [
          {
            source: fallback.source,
            checked: fallback.checked,
            flagged: fallback.flagged,
            confidence: fallback.flagged ? 0.7 : 0.5,
            details: fallback.details,
            reason: 'Fallback direct check',
          },
        ],
        checkedCount: fallback.checked ? 1 : 0,
        flaggedCount: fallback.flagged ? 1 : 0,
        usedEdgeFunction: false,
      };
    });

  const [databaseResult, internetResult] = await Promise.all([
    databaseResultPromise,
    internetResultPromise,
  ]);

  const heuristic = analyzeHeuristicUrlRisk(input, inputType);
  const dbRisk = databaseResult.matched ? Math.min(60, 20 + databaseResult.matches.length * 10) : 0;
  const internetRisk = Number.isFinite(internetResult.riskScore) ? internetResult.riskScore : 0;
  const riskScore = Math.min(100, dbRisk + Math.round(internetRisk * 0.6) + heuristic.risk);

  const hasInternetCoverage = Boolean(internetResult.checked) || (internetResult.checkedCount || 0) > 0;
  const verdict = !hasInternetCoverage && !databaseResult.matched
    ? 'unknown'
    : mapVerdictFromScore(riskScore);

  const isSuspicious = verdict === 'danger' || verdict === 'warning' || verdict === 'unknown';

  const heuristicSources = heuristic.reasons.map((reason) => ({
    source: 'Heuristic URL analysis',
    checked: true,
    flagged: true,
    confidence: 0.65,
    reason,
  }));

  const mergedSources = [...(internetResult.sources || []), ...heuristicSources];

  return {
    input,
    inputType,
    isSuspicious,
    verdict,
    riskScore,
    database: databaseResult,
    internet: {
      ...internetResult,
      sources: mergedSources,
      checkedCount: (internetResult.checkedCount || 0) + (heuristicSources.length ? 1 : 0),
      flaggedCount: (internetResult.flaggedCount || 0) + (heuristicSources.length ? 1 : 0),
    },
    warnings: verdict === 'unknown' ? ['Външните източници не върнаха валиден отговор. Резултатът не е окончателен.'] : [],
  };
}

export async function getRecentApprovedScamChecks(limit = 5) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('scam_reports')
    .select('id, title, url, phone, category, created_at, status')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
