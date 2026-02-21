import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type InputType = 'url' | 'email' | 'phone' | 'unknown';
type Verdict = 'danger' | 'warning' | 'clean' | 'unknown';
type SourceType = 'external' | 'heuristic';

type SourceResult = {
  source: string;
  sourceType: SourceType;
  checked: boolean;
  flagged: boolean;
  confidence: number;
  reason?: string;
  details?: unknown;
};

type AggregateResult = {
  verdict: Verdict;
  riskScore: number;
  checkedCount: number;
  flaggedCount: number;
  externalCheckedCount: number;
  externalSourceCount: number;
  degraded: boolean;
  warnings: string[];
};

type SimilarDomainRow = {
  domain: string;
  similarity: number;
  source: string;
  confidence: number;
};

const REQUEST_TIMEOUT_MS = 6500;
const DOMAIN_SIMILARITY_THRESHOLD = 0.52;

function normalizeInput(value: unknown): string {
  return String(value || '').trim();
}

function detectInputType(value: string): InputType {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const ipv4Pattern = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:\/.*)?$/;
  const hasLetters = /[a-zA-Z]/.test(value);
  const digitsOnly = value.replace(/\D/g, '');

  if (emailPattern.test(value)) return 'email';
  if (value.startsWith('http://') || value.startsWith('https://') || (value.includes('.') && hasLetters) || ipv4Pattern.test(value)) return 'url';
  if (digitsOnly.length >= 6) return 'phone';
  return 'unknown';
}

function normalizeUrlCandidate(value: string): string | null {
  if (!value) return null;
  const prefixed = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(prefixed).href;
  } catch {
    return null;
  }
}

function extractDomainFromEmail(email: string): string | null {
  const [, domain] = email.split('@');
  return domain ? domain.toLowerCase() : null;
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function toBase64Url(value: string): string {
  const encoded = btoa(value);
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function analyzeHeuristicUrlRisk(rawInput: string, inputType: InputType): SourceResult[] {
  if (inputType !== 'url') return [];

  const urlCandidate = normalizeUrlCandidate(rawInput);
  if (!urlCandidate) return [];

  const parsed = new URL(urlCandidate);
  const reasons: string[] = [];
  let score = 0;

  const isIpv4Host = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(parsed.hostname);
  if (isIpv4Host) {
    score += 0.65;
    reasons.push('Direct IP host used instead of domain');
  }

  if (parsed.protocol === 'http:') {
    score += 0.2;
    reasons.push('Uses HTTP without TLS');
  }

  if (parsed.port && !['80', '443'].includes(parsed.port)) {
    score += 0.3;
    reasons.push(`Uses non-standard port ${parsed.port}`);
  }

  const hostParts = parsed.hostname.split('.').filter(Boolean);
  if (hostParts.length >= 4) {
    score += 0.1;
    reasons.push('High subdomain depth');
  }

  const suspiciousKeywords = /(login|verify|secure|update|wallet|bank|signin|account|invoice|urgent|coupon|gift|bonus|promo|prize)/i;
  if (suspiciousKeywords.test(parsed.pathname) || suspiciousKeywords.test(parsed.hostname)) {
    score += 0.1;
    reasons.push('Contains common phishing keywords');
  }

  const firstLabel = hostParts[0] || '';
  const freeHostPattern = /(pages\.dev|github\.io|netlify\.app|vercel\.app|web\.app|firebaseapp\.com)$/i;
  if (freeHostPattern.test(parsed.hostname)) {
    score += 0.12;
    reasons.push('Hosted on free subdomain platform');
  }

  if (/-[a-f0-9]{6,}$/i.test(firstLabel) || /-\d{5,}$/i.test(firstLabel)) {
    score += 0.22;
    reasons.push('Subdomain contains random-looking suffix');
  }

  const hyphenCount = (firstLabel.match(/-/g) || []).length;
  if (hyphenCount >= 3) {
    score += 0.08;
    reasons.push('High hyphen density in subdomain');
  }

  if (reasons.length === 0) {
    return [{
      source: 'Heuristic URL analysis',
      sourceType: 'heuristic',
      checked: true,
      flagged: false,
      confidence: 0.55,
      reason: 'No high-risk heuristic signals',
    }];
  }

  const confidence = Math.min(0.95, score);
  return [{
    source: 'Heuristic URL analysis',
    sourceType: 'heuristic',
    checked: true,
    flagged: confidence >= 0.45,
    confidence,
    reason: reasons.join('; '),
    details: { reasons },
  }];
}

async function checkTrustedPhishingDomains(urlCandidate: string): Promise<SourceResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      source: 'Trusted phishing domain list',
      sourceType: 'external',
      checked: false,
      flagged: false,
      confidence: 0,
      reason: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const hostname = normalizeHost(new URL(urlCandidate).hostname);

  try {
    const { data: exactMatch, error: exactError } = await supabase
      .from('trusted_phishing_domains')
      .select('domain, source, confidence')
      .eq('is_active', true)
      .eq('domain', hostname)
      .maybeSingle();

    if (exactError) {
      return {
        source: 'Trusted phishing domain list',
        sourceType: 'external',
        checked: false,
        flagged: false,
        confidence: 0,
        reason: exactError.message,
      };
    }

    if (exactMatch) {
      return {
        source: 'Trusted phishing domain list',
        sourceType: 'external',
        checked: true,
        flagged: true,
        confidence: Math.min(0.99, Math.max(0.75, Number(exactMatch.confidence ?? 0.9))),
        reason: `Exact match with known phishing domain: ${exactMatch.domain}`,
        details: exactMatch,
      };
    }

    const { data: similarMatches, error: similarError } = await supabase.rpc('find_similar_phishing_domains', {
      input_domain: hostname,
      similarity_threshold: DOMAIN_SIMILARITY_THRESHOLD,
      max_results: 5,
    });

    if (similarError) {
      return {
        source: 'Trusted phishing domain list',
        sourceType: 'external',
        checked: false,
        flagged: false,
        confidence: 0,
        reason: similarError.message,
      };
    }

    const candidates = Array.isArray(similarMatches) ? (similarMatches as SimilarDomainRow[]) : [];
    if (candidates.length > 0) {
      const top = candidates[0];
      const similarity = Number(top.similarity || 0);
      const flagged = similarity >= DOMAIN_SIMILARITY_THRESHOLD;

      return {
        source: 'Trusted phishing domain list',
        sourceType: 'external',
        checked: true,
        flagged,
        confidence: Math.min(0.95, 0.6 + similarity * 0.35),
        reason: `Similar to known phishing domain (${top.domain}, similarity ${similarity.toFixed(2)})`,
        details: {
          input: hostname,
          bestMatch: top,
          similar: candidates,
        },
      };
    }

    return {
      source: 'Trusted phishing domain list',
      sourceType: 'external',
      checked: true,
      flagged: false,
      confidence: 0.65,
      reason: 'No match in trusted phishing list',
    };
  } catch (error) {
    return {
      source: 'Trusted phishing domain list',
      sourceType: 'external',
      checked: false,
      flagged: false,
      confidence: 0,
      reason: error instanceof Error ? error.message : 'Unexpected error',
    };
  }
}

async function checkSinkingYachts(urlCandidate: string): Promise<SourceResult> {
  try {
    const hostname = new URL(urlCandidate).hostname;
    const response = await fetchWithTimeout(`https://phish.sinking.yachts/v2/check/${encodeURIComponent(hostname)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'StaySafeBG/1.0',
      },
    });

    if (response.status === 404) {
      return {
        source: 'phish.sinking.yachts',
        sourceType: 'external',
        checked: true,
        flagged: false,
        confidence: 0.58,
        reason: 'Not listed',
      };
    }

    if (!response.ok) {
      return {
        source: 'phish.sinking.yachts',
        sourceType: 'external',
        checked: false,
        flagged: false,
        confidence: 0,
        reason: `HTTP ${response.status}`,
      };
    }

    const data = await safeReadJson(response);
    let flagged = false;
    if (typeof data === 'boolean') flagged = data;
    else if (typeof (data as { phish?: unknown })?.phish === 'boolean') flagged = Boolean((data as { phish: boolean }).phish);
    else if (Array.isArray(data)) flagged = data.some((item) => Boolean((item as { phish?: unknown })?.phish) || Boolean((item as { in_database?: unknown })?.in_database));

    return {
      source: 'phish.sinking.yachts',
      sourceType: 'external',
      checked: true,
      flagged,
      confidence: flagged ? 0.82 : 0.58,
      details: data,
    };
  } catch (error) {
    return {
      source: 'phish.sinking.yachts',
      sourceType: 'external',
      checked: false,
      flagged: false,
      confidence: 0,
      reason: error instanceof Error ? error.message : 'Network error',
    };
  }
}

async function checkVirusTotal(urlCandidate: string): Promise<SourceResult> {
  const apiKey = Deno.env.get('VIRUSTOTAL_API_KEY');
  if (!apiKey) {
    return {
      source: 'VirusTotal',
      sourceType: 'external',
      checked: false,
      flagged: false,
      confidence: 0,
      reason: 'No API key configured',
    };
  }

  try {
    const urlId = toBase64Url(urlCandidate);
    const response = await fetchWithTimeout(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'StaySafeBG/1.0',
        'x-apikey': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await safeReadText(response);
      const reason = errorText ? `HTTP ${response.status}: ${errorText.slice(0, 140)}` : `HTTP ${response.status}`;
      return {
        source: 'VirusTotal',
        sourceType: 'external',
        checked: false,
        flagged: false,
        confidence: 0,
        reason,
      };
    }

    const data = await safeReadJson(response) as {
      data?: {
        attributes?: {
          last_analysis_stats?: {
            malicious?: number;
            suspicious?: number;
            harmless?: number;
            undetected?: number;
          };
        };
      };
    } | null;

    const stats = data?.data?.attributes?.last_analysis_stats || {};
    const malicious = Number(stats.malicious || 0);
    const suspicious = Number(stats.suspicious || 0);
    const harmless = Number(stats.harmless || 0);
    const undetected = Number(stats.undetected || 0);
    const flagged = malicious > 0 || suspicious > 0;
    const checked = (malicious + suspicious + harmless + undetected) > 0;

    return {
      source: 'VirusTotal',
      sourceType: 'external',
      checked,
      flagged,
      confidence: flagged ? Math.min(0.97, 0.7 + malicious * 0.05 + suspicious * 0.02) : 0.7,
      details: { malicious, suspicious, harmless, undetected },
      reason: checked ? undefined : 'No analysis stats in response',
    };
  } catch (error) {
    return {
      source: 'VirusTotal',
      sourceType: 'external',
      checked: false,
      flagged: false,
      confidence: 0,
      reason: error instanceof Error ? error.message : 'Network error',
    };
  }
}

async function checkGoogleSafeBrowsing(urlCandidate: string): Promise<SourceResult> {
  const apiKey = Deno.env.get('GOOGLE_SAFE_BROWSING_API_KEY');
  if (!apiKey) {
    return {
      source: 'Google Safe Browsing',
      sourceType: 'external',
      checked: false,
      flagged: false,
      confidence: 0,
      reason: 'No API key configured',
    };
  }

  try {
    const response = await fetchWithTimeout(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'StaySafeBG/1.0',
      },
      body: JSON.stringify({
        client: {
          clientId: 'staysafebg',
          clientVersion: '1.2.0',
        },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url: urlCandidate }],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await safeReadText(response);
      const reason = errorText ? `HTTP ${response.status}: ${errorText.slice(0, 180)}` : `HTTP ${response.status}`;
      return {
        source: 'Google Safe Browsing',
        sourceType: 'external',
        checked: false,
        flagged: false,
        confidence: 0,
        reason,
      };
    }

    const data = await safeReadJson(response) as { matches?: unknown[] } | null;
    const flagged = Array.isArray(data?.matches) && data.matches.length > 0;
    return {
      source: 'Google Safe Browsing',
      sourceType: 'external',
      checked: true,
      flagged,
      confidence: flagged ? 0.93 : 0.68,
      details: flagged ? data?.matches : null,
    };
  } catch (error) {
    return {
      source: 'Google Safe Browsing',
      sourceType: 'external',
      checked: false,
      flagged: false,
      confidence: 0,
      reason: error instanceof Error ? error.message : 'Network error',
    };
  }
}

function aggregateSources(sources: SourceResult[]): AggregateResult {
  const checkedSources = sources.filter((source) => source.checked);
  const flaggedSources = sources.filter((source) => source.checked && source.flagged);
  const externalSources = sources.filter((source) => source.sourceType === 'external');
  const checkedExternal = externalSources.filter((source) => source.checked);
  const flaggedExternal = checkedExternal.filter((source) => source.flagged);
  const heuristicFlagged = sources.some((source) => source.sourceType === 'heuristic' && source.checked && source.flagged);

  const totalConfidence = checkedSources.reduce((acc, source) => acc + source.confidence, 0);
  const weightedFlagged = flaggedSources.reduce((acc, source) => acc + source.confidence, 0);
  const riskScore = totalConfidence > 0 ? Math.round((weightedFlagged / totalConfidence) * 100) : 0;

  const warnings: string[] = [];
  let verdict: Verdict = 'unknown';

  if (flaggedExternal.length >= 2 || riskScore >= 75) {
    verdict = 'danger';
  } else if (flaggedSources.length >= 1) {
    verdict = riskScore >= 60 ? 'danger' : 'warning';
  } else if (checkedExternal.length >= 1) {
    verdict = 'clean';
  } else if (heuristicFlagged) {
    verdict = 'warning';
    warnings.push('External threat feeds unavailable. Verdict based on local heuristic risk signals.');
  } else {
    verdict = 'unknown';
    warnings.push('External threat feeds unavailable. Cannot classify as clean with high confidence.');
  }

  const degraded = checkedExternal.length === 0;
  if (degraded && warnings.length === 0) {
    warnings.push('Degraded mode: no external provider returned a confirmed result.');
  }

  return {
    verdict,
    riskScore,
    checkedCount: checkedSources.length,
    flaggedCount: flaggedSources.length,
    externalCheckedCount: checkedExternal.length,
    externalSourceCount: externalSources.length,
    degraded,
    warnings,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const input = normalizeInput(body?.input);
    if (!input) {
      return new Response(JSON.stringify({ error: 'Missing input' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const inputType: InputType = body?.inputType || detectInputType(input);
    let urlCandidate: string | null = null;

    if (inputType === 'url') {
      urlCandidate = normalizeUrlCandidate(input);
    } else if (inputType === 'email') {
      const domain = extractDomainFromEmail(input);
      urlCandidate = domain ? normalizeUrlCandidate(domain) : null;
    }

    if (!urlCandidate) {
      return new Response(JSON.stringify({
        inputType,
        urlCandidate: null,
        verdict: 'unknown',
        riskScore: 0,
        checkedCount: 0,
        flaggedCount: 0,
        externalCheckedCount: 0,
        externalSourceCount: 0,
        degraded: true,
        warnings: ['Input type is not eligible for external URL intelligence checks.'],
        sources: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sourceResults = await Promise.all([
      checkTrustedPhishingDomains(urlCandidate),
      checkSinkingYachts(urlCandidate),
      checkVirusTotal(urlCandidate),
      checkGoogleSafeBrowsing(urlCandidate),
    ]);
    const heuristicResults = analyzeHeuristicUrlRisk(input, inputType);
    const mergedSources = [...sourceResults, ...heuristicResults];
    const aggregate = aggregateSources(mergedSources);

    return new Response(JSON.stringify({
      inputType,
      urlCandidate,
      ...aggregate,
      sources: mergedSources,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unexpected error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
