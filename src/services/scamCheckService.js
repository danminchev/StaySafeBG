import { requireSupabase } from './supabaseClient.js';

import { checkAgainstMaliciousResources } from './maliciousResourcesService.js';
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
  const hasLetters = /[a-zA-Z]/.test(input);
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
    return new URL(prefixed).href;
  } catch {
    return null;
  }
}

function extractDomainFromEmail(email) {
  const [, domain] = String(email || '').split('@');
  return domain ? domain.toLowerCase() : null;
}

function normalizeDomainValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

function extractDomainForTrustedLookup(rawInput, inputType) {
  if (inputType === 'email') {
    return normalizeDomainValue(extractDomainFromEmail(rawInput));
  }

  if (inputType === 'url') {
    const candidate = normalizeUrlCandidate(rawInput);
    if (!candidate) return '';
    try {
      const host = new URL(candidate).hostname;
      return normalizeDomainValue(host);
    } catch {
      return '';
    }
  }

  return '';
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
    const hostname = new URL(urlCandidate).hostname;
    const response = await fetch(`${INTERNET_CHECK_BASE}${encodeURIComponent(hostname)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (response.status === 404) {
      return {
        checked: true,
        flagged: false,
        source: 'phish.sinking.yachts',
        details: { reason: 'Not listed' },
      };
    }

    if (!response.ok) {
      return {
        checked: false,
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

function riskFromMaliciousMatch(match) {
  const riskLevel = String(match?.risk_level || '').toLowerCase();
  const status = String(match?.status || '').toLowerCase();
  const confidence = Number(match?.confidence);
  const base = riskLevel === 'high' ? 95 : riskLevel === 'medium' ? 70 : 45;
  const confidenceBoost = Number.isFinite(confidence) ? Math.round(confidence * 5) : 0;
  const statusPenalty = status === 'offline' ? 15 : 0;
  return Math.max(35, Math.min(100, base + confidenceBoost - statusPenalty));
}

function riskFromTrustedDomainMatch(match) {
  const riskLevel = String(match?.risk_level || '').toLowerCase();
  const confidence = Number(match?.confidence);
  const base = riskLevel === 'high' ? 92 : riskLevel === 'medium' ? 70 : 50;
  const confidenceBoost = Number.isFinite(confidence) ? Math.round(confidence * 8) : 0;
  return Math.max(45, Math.min(100, base + confidenceBoost));
}

async function checkAgainstTrustedPhishingDomains(rawInput, inputType) {
  const supabase = requireSupabase();
  const domain = extractDomainForTrustedLookup(rawInput, inputType);
  if (!domain) {
    return { matched: false, matches: [], similar: [] };
  }

  const { data: exactMatches, error: exactError } = await supabase
    .from('trusted_phishing_domains')
    .select('id, domain, source, confidence, risk_level, is_active, updated_at')
    .eq('is_active', true)
    .eq('domain', domain)
    .limit(5);

  if (exactError) throw exactError;

  const { data: similarMatches, error: similarError } = await supabase.rpc('find_similar_phishing_domains', {
    input_domain: domain,
    similarity_threshold: 0.52,
    max_results: 5,
  });

  if (similarError) throw similarError;

  return {
    matched: (exactMatches || []).length > 0,
    matches: exactMatches || [],
    similar: Array.isArray(similarMatches) ? similarMatches : [],
    domain,
  };
}

function analyzeHeuristicUrlRisk(rawInput, inputType) {
  if (inputType !== 'url') {
    return { risk: 0, reasons: [], critical: false, checked: false };
  }

  const candidate = normalizeUrlCandidate(rawInput);
  if (!candidate) {
    return { risk: 0, reasons: [], critical: false, checked: false };
  }

  const parsed = new URL(candidate);
  const reasons = [];
  let risk = 0;

  const isIpv4Host = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(parsed.hostname);
  if (isIpv4Host) {
    risk += 40;
    reasons.push('URL РёР·РїРѕР»Р·РІР° РґРёСЂРµРєС‚РµРЅ IP Р°РґСЂРµСЃ РІРјРµСЃС‚Рѕ РґРѕРјРµР№РЅ');
  }

  if (parsed.protocol === 'http:') {
    risk += 12;
    reasons.push('URL Рµ РїРѕ HTTP (Р±РµР· TLS)');
  }

  if (parsed.port && !['80', '443'].includes(parsed.port)) {
    risk += 18;
    reasons.push(`URL РёР·РїРѕР»Р·РІР° РЅРµСЃС‚Р°РЅРґР°СЂС‚РµРЅ РїРѕСЂС‚ (${parsed.port})`);
  }

  const hostParts = parsed.hostname.split('.').filter(Boolean);
  const firstLabel = hostParts[0] || '';
  const freeHostPattern = /(pages\.dev|github\.io|netlify\.app|vercel\.app|web\.app|firebaseapp\.com)$/i;
  if (freeHostPattern.test(parsed.hostname)) {
    risk += 12;
    reasons.push('URL is hosted on a free subdomain platform');
  }

  if (/-[a-f0-9]{6,}$/i.test(firstLabel) || /-\d{5,}$/i.test(firstLabel)) {
    risk += 22;
    reasons.push('Subdomain contains random-looking suffix');
  }

  const hyphenCount = (firstLabel.match(/-/g) || []).length;
  if (hyphenCount >= 3) {
    risk += 8;
    reasons.push('High hyphen density in subdomain');
  }

  const hasCriticalPattern = isIpv4Host && parsed.protocol === 'http:' && Boolean(parsed.port) && !['80', '443'].includes(parsed.port);

  if (hasCriticalPattern) {
    return {
      risk: 100,
      reasons,
      critical: true,
      checked: true,
    };
  }

  return {
    risk: Math.min(65, risk),
    reasons,
    critical: false,
    checked: true,
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
    warnings: Array.isArray(data?.warnings) ? data.warnings : [],
    degraded: Boolean(data?.degraded),
    usedEdgeFunction: true,
  };
}

export async function runScamCheck(rawInput) {
  const input = normalizeInput(rawInput);
  if (!input) {
    throw new Error('РњРѕР»СЏ РІСЉРІРµРґРµС‚Рµ Р»РёРЅРє, С‚РµР»РµС„РѕРЅ РёР»Рё РёРјРµР№Р».');
  }

  const inputType = detectInputType(input);
  if (inputType === 'unknown') {
    throw new Error('РќРµРІР°Р»РёРґРµРЅ С„РѕСЂРјР°С‚. Р’СЉРІРµРґРµС‚Рµ URL, С‚РµР»РµС„РѕРЅРµРЅ РЅРѕРјРµСЂ РёР»Рё РёРјРµР№Р».');
  }

  const databaseResultPromise = checkAgainstDatabase(input, inputType);
  const maliciousResourcesPromise = checkAgainstMaliciousResources(input)
    .catch(() => ({ matched: false, matches: [] }));
  const trustedDomainsPromise = checkAgainstTrustedPhishingDomains(input, inputType)
    .catch(() => ({ matched: false, matches: [], similar: [] }));
  const internetResultPromise = checkInternetViaEdgeFunction(input, inputType)
    .catch(async (edgeError) => {
      const fallback = await checkAgainstInternet(input, inputType);
      const edgeReason = edgeError?.message || 'Edge function unavailable';
      const fallbackReason = fallback?.details?.error || fallback?.details?.reason || 'No response from fallback source';

      return {
        ...fallback,
        riskScore: fallback.flagged ? 50 : 0,
        verdict: fallback.flagged ? 'warning' : 'clean',
        sources: [{
          source: fallback.source,
          checked: fallback.checked,
          flagged: fallback.flagged,
          confidence: fallback.flagged ? 0.7 : 0.5,
          details: fallback.details,
          reason: `Fallback direct check (edge: ${edgeReason}; source: ${fallbackReason})`,
        }],
        checkedCount: fallback.checked ? 1 : 0,
        flaggedCount: fallback.flagged ? 1 : 0,
        warnings: fallback.checked ? [] : ['External checks are temporarily unavailable.'],
        degraded: true,
        usedEdgeFunction: false,
        edgeError: edgeReason,
      };
    });

  const [databaseResult, internetResult, maliciousResources, trustedPhishingDomains] = await Promise.all([
    databaseResultPromise,
    internetResultPromise,
    maliciousResourcesPromise,
    trustedDomainsPromise,
  ]);

  const edgeHasHeuristic = (internetResult.sources || [])
    .some((source) => source?.source === 'Heuristic URL analysis');

  const heuristic = edgeHasHeuristic
    ? { risk: 0, reasons: [], critical: false, checked: false }
    : analyzeHeuristicUrlRisk(input, inputType);

  const dbRisk = databaseResult.matched ? Math.min(60, 20 + databaseResult.matches.length * 10) : 0;
  const maliciousRisk = maliciousResources.matched
    ? Math.max(...maliciousResources.matches.map(riskFromMaliciousMatch))
    : 0;
  const trustedDomainsRisk = trustedPhishingDomains.matched
    ? Math.max(...trustedPhishingDomains.matches.map(riskFromTrustedDomainMatch))
    : 0;
  const internetRisk = Number.isFinite(internetResult.riskScore) ? internetResult.riskScore : 0;

  let riskScore = internetResult.usedEdgeFunction
    ? Math.min(100, Math.max(internetRisk, dbRisk + heuristic.risk, maliciousRisk, trustedDomainsRisk))
    : Math.min(100, dbRisk + Math.round(internetRisk * 0.6) + heuristic.risk + Math.round(maliciousRisk * 0.7) + Math.round(trustedDomainsRisk * 0.7));

  const hasInternetCoverage = Boolean(internetResult.checked)
    || (internetResult.checkedCount || 0) > 0
    || heuristic.checked;

  let verdict = internetResult.usedEdgeFunction
    ? (internetResult.verdict || mapVerdictFromScore(riskScore))
    : (!hasInternetCoverage && !databaseResult.matched
      ? 'unknown'
      : mapVerdictFromScore(riskScore));

  if (!internetResult.usedEdgeFunction && heuristic.critical) {
    verdict = 'danger';
    riskScore = 100;
  }

  if (databaseResult.matched && verdict !== 'danger') {
    verdict = 'warning';
    riskScore = Math.max(riskScore, 35);
  }

  if (maliciousResources.matched) {
    const hasHighRiskMalicious = maliciousResources.matches
      .some((match) => String(match?.risk_level || '').toLowerCase() === 'high');
    if (hasHighRiskMalicious) {
      verdict = 'danger';
      riskScore = Math.max(riskScore, 85);
    } else if (verdict !== 'danger') {
      verdict = 'warning';
      riskScore = Math.max(riskScore, 45);
    }
  }

  if (trustedPhishingDomains.matched) {
    const hasHighRiskDomain = trustedPhishingDomains.matches
      .some((match) => String(match?.risk_level || '').toLowerCase() === 'high' || Number(match?.confidence || 0) >= 0.9);
    if (hasHighRiskDomain) {
      verdict = 'danger';
      riskScore = Math.max(riskScore, 85);
    } else if (verdict !== 'danger') {
      verdict = 'warning';
      riskScore = Math.max(riskScore, 50);
    }
  }

  const isSuspicious = verdict === 'danger' || verdict === 'warning' || verdict === 'unknown';

  const heuristicSources = heuristic.checked
    ? [{
      source: 'Heuristic URL analysis',
      checked: true,
      flagged: heuristic.reasons.length > 0,
      confidence: heuristic.reasons.length ? (heuristic.critical ? 0.95 : 0.65) : 0.55,
      reason: heuristic.reasons.length ? heuristic.reasons.join('; ') : 'No high-risk heuristic signals',
      details: { reasons: heuristic.reasons, critical: heuristic.critical },
    }]
    : [];

  const mergedSources = [...(internetResult.sources || []), ...heuristicSources];
  const warnings = Array.isArray(internetResult?.warnings) && internetResult.warnings.length
    ? internetResult.warnings
    : (verdict === 'unknown' ? ['Р’СЉРЅС€РЅРёС‚Рµ РёР·С‚РѕС‡РЅРёС†Рё РЅРµ РІСЉСЂРЅР°С…Р° РІР°Р»РёРґРµРЅ РѕС‚РіРѕРІРѕСЂ. Р РµР·СѓР»С‚Р°С‚СЉС‚ РЅРµ Рµ РѕРєРѕРЅС‡Р°С‚РµР»РµРЅ.'] : []);

  return {
    input,
    inputType,
    isSuspicious,
    verdict,
    riskScore,
    database: databaseResult,
    maliciousResources,
    trustedPhishingDomains,
    internet: {
      ...internetResult,
      sources: mergedSources,
      checkedCount: (internetResult.checkedCount || 0) + (heuristicSources.length ? 1 : 0),
      flaggedCount: (internetResult.flaggedCount || 0) + (heuristicSources.length ? 1 : 0),
    },
    warnings,
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

