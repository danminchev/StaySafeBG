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

async function checkSinkingYachts(urlCandidate: string): Promise<SourceResult> {
  try {
    const response = await fetch(`https://phish.sinking.yachts/v2/check/${encodeURIComponent(urlCandidate)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        source: 'phish.sinking.yachts',
        checked: true,
        flagged: false,
        confidence: 0.35,
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
        checked: true,
        flagged: false,
        confidence: 0.3,
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
        checked: true,
        flagged: false,
        confidence: 0.4,
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

    const aggregate = aggregateSources(sourceResults);

    return new Response(JSON.stringify({
      inputType,
      urlCandidate,
      ...aggregate,
      sources: sourceResults,
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
