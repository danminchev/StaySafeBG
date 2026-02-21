const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type InputType = 'url' | 'email' | 'phone' | 'unknown';

type SourceResult = {
  source: string;
  checked: boolean;
  flagged: boolean;
  confidence: number;
  reason?: string;
  details?: unknown;
};

function normalizeInput(value: unknown): string {
  return String(value || '').trim();
}

function detectInputType(value: string): InputType {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const ipv4Pattern = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:\/.*)?$/;
  const hasLetters = /[a-zA-Zа-яА-Я]/.test(value);
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
    const url = new URL(prefixed);
    return url.href;
  } catch {
    return null;
  }
}

function extractDomainFromEmail(email: string): string | null {
  const [, domain] = email.split('@');
  return domain ? domain.toLowerCase() : null;
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

  const suspiciousKeywords = /(login|verify|secure|update|wallet|bank|signin|account|invoice|urgent)/i;
  if (suspiciousKeywords.test(parsed.pathname) || suspiciousKeywords.test(parsed.hostname)) {
    score += 0.1;
    reasons.push('Contains common phishing keywords');
  }

  if (reasons.length === 0) {
    return [{
      source: 'Heuristic URL analysis',
      checked: true,
      flagged: false,
      confidence: 0.55,
      reason: 'No high-risk heuristic signals',
    }];
  }

  const confidence = Math.min(0.95, score);
  const isFlagged = confidence >= 0.45;

  return [{
    source: 'Heuristic URL analysis',
    checked: true,
    flagged: isFlagged,
    confidence,
    reason: reasons.join('; '),
    details: { reasons },
  }];
}

async function checkSinkingYachts(urlCandidate: string): Promise<SourceResult> {
  try {
    const hostname = new URL(urlCandidate).hostname;
    const response = await fetch(`https://phish.sinking.yachts/v2/check/${encodeURIComponent(hostname)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        source: 'phish.sinking.yachts',
        checked: false,
        flagged: false,
        confidence: 0,
        reason: `HTTP ${response.status}`,
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
      source: 'phish.sinking.yachts',
      checked: true,
      flagged,
      confidence: flagged ? 0.8 : 0.6,
      details: data,
    };
  } catch (error) {
    return {
      source: 'phish.sinking.yachts',
      checked: false,
      flagged: false,
      confidence: 0,
      reason: error instanceof Error ? error.message : 'Network error',
    };
  }
}

async function checkUrlhaus(urlCandidate: string): Promise<SourceResult> {
  try {
    const body = new URLSearchParams({
      url: urlCandidate,
    });

    const response = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      return {
        source: 'URLhaus',
        checked: false,
        flagged: false,
        confidence: 0,
        reason: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const flagged = data?.query_status === 'ok';

    return {
      source: 'URLhaus',
      checked: true,
      flagged,
      confidence: flagged ? 0.88 : 0.58,
      details: {
        query_status: data?.query_status,
        url_status: data?.url_status,
        threat: data?.threat,
      },
    };
  } catch (error) {
    return {
      source: 'URLhaus',
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
      checked: false,
      flagged: false,
      confidence: 0,
      reason: 'No API key configured',
    };
  }

  try {
    const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client: {
          clientId: 'staysafebg',
          clientVersion: '1.0.0',
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
      return {
        source: 'Google Safe Browsing',
        checked: false,
        flagged: false,
        confidence: 0,
        reason: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const flagged = Array.isArray(data?.matches) && data.matches.length > 0;

    return {
      source: 'Google Safe Browsing',
      checked: true,
      flagged,
      confidence: flagged ? 0.92 : 0.67,
      details: flagged ? data.matches : null,
    };
  } catch (error) {
    return {
      source: 'Google Safe Browsing',
      checked: false,
      flagged: false,
      confidence: 0,
      reason: error instanceof Error ? error.message : 'Network error',
    };
  }
}

function aggregateSources(sources: SourceResult[]) {
  const checkedSources = sources.filter((source) => source.checked);
  const flaggedSources = sources.filter((source) => source.checked && source.flagged);

  const totalConfidence = checkedSources.reduce((acc, source) => acc + source.confidence, 0);
  const weightedFlagged = flaggedSources.reduce((acc, source) => acc + source.confidence, 0);

  const score = totalConfidence > 0 ? Math.round((weightedFlagged / totalConfidence) * 100) : 0;

  let verdict: 'danger' | 'warning' | 'clean' | 'unknown' = 'clean';
  if (checkedSources.length === 0) verdict = 'unknown';
  else if (score >= 65 || flaggedSources.length >= 2) verdict = 'danger';
  else if (score >= 35 || flaggedSources.length === 1) verdict = 'warning';

  return {
    verdict,
    riskScore: score,
    checkedCount: checkedSources.length,
    flaggedCount: flaggedSources.length,
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
        verdict: 'clean',
        riskScore: 0,
        checkedCount: 0,
        flaggedCount: 0,
        sources: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sourceResults = await Promise.all([
      checkSinkingYachts(urlCandidate),
      checkUrlhaus(urlCandidate),
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
