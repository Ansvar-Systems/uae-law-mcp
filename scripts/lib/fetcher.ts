/**
 * Rate-limited HTTP client for UAE legal sources.
 *
 * Primary source: elaws.moj.gov.ae (Ministry of Justice e-Laws portal)
 *   - Search API: POST /api/Laws/Search — paginated law discovery
 *   - Direct HTML: /{Link} — full law text with articles
 *
 * Secondary sources (free zones, kept for compatibility):
 *   - DIFC Laws (difclaws.com) — DIFC free zone legislation (English only)
 *   - ADGM Legal Framework (adgm.com/legal-framework) — ADGM free zone (English only)
 *
 * - 500ms minimum delay between requests (be respectful to government servers)
 * - Browser-like User-Agent
 * - No auth needed (government open data)
 * - Encoding: UTF-8 (supports Arabic + English)
 */

const USER_AGENT = 'UAELawMCP/1.0 (+https://github.com/Ansvar-Systems/uae-law-mcp)';
const MIN_DELAY_MS = 500;

const ELAWS_BASE = 'https://elaws.moj.gov.ae';
const DIFC_BASE = 'https://www.difclaws.com';
const ADGM_BASE = 'https://adgm.com';

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
  url: string;
}

/**
 * Fetch a URL with rate limiting and browser-like headers.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 */
export async function fetchWithRateLimit(
  url: string,
  extraHeaders: Record<string, string> = {},
  maxRetries = 3,
): Promise<FetchResult> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        'Accept-Charset': 'utf-8',
        ...extraHeaders,
      },
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
    }

    const body = await response.text();
    return {
      status: response.status,
      body,
      contentType: response.headers.get('content-type') ?? '',
      url,
    };
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/**
 * Post JSON to a URL with rate limiting.
 */
export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  maxRetries = 3,
): Promise<{ status: number; data: T }> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
    }

    const data = await response.json() as T;
    return { status: response.status, data };
  }

  throw new Error(`Failed to POST ${url} after ${maxRetries} retries`);
}

// ============================================================
// elaws.moj.gov.ae API — Primary source for UAE federal laws
// ============================================================

/** A single search result from the elaws Search API */
export interface ElawsSearchResult {
  Id: number;
  Fragment: string;
  Link: string;
  FinalTitle: string;
  LawTitleLink: string | null;
  LawNumber: string;
  SubtitleNumber: string | null;
  Level: number;
  LawType: string;
  LawDay: number | null;
  LawMonth: number | null;
  HasPdf: boolean;
  LawYear: number;
  LawDate: string;
  DisplayName: string;
  Introduction: string;
  Reference: string;
}

/** Search API response */
export interface ElawsSearchResponse {
  results: ElawsSearchResult[];
  totalCount: number;
}

/** Search request model */
export interface ElawsSearchRequest {
  Keyword: string | null;
  Page: number;
  CountPerPage: number;
  Key: string;
  LawTypes?: string[] | null;
  LawYears?: string[] | null;
  MainClassifications?: string[] | null;
  SecondaryClassifications?: string[] | null;
}

/** Law type count */
export interface ElawsLawTypeCount {
  Key: string;
  Value: number;
}

/**
 * Search for laws in the elaws.moj.gov.ae portal.
 * Default database key: 'AL1' (UAE federal legislation).
 */
export async function searchElaws(request: ElawsSearchRequest): Promise<ElawsSearchResponse> {
  const url = `${ELAWS_BASE}/api/Laws/Search`;
  const { data } = await postJson<ElawsSearchResponse>(url, request);
  return data;
}

/**
 * Get law type counts from the elaws portal.
 */
export async function getElawsLawTypeCounts(key = 'AL1'): Promise<ElawsLawTypeCount[]> {
  const url = `${ELAWS_BASE}/api/Laws/GetLawTypeCounts`;
  const { data } = await postJson<ElawsLawTypeCount[]>(url, { Key: key });
  return data;
}

/**
 * Fetch the full HTML content of a law from elaws.moj.gov.ae.
 * The link path should come from a search result's Link field (without the #Anchor suffix).
 */
export async function fetchElawsContent(linkPath: string): Promise<FetchResult> {
  // The Link field uses backslashes; convert to forward slashes and URL-encode
  const normalizedPath = linkPath.replace(/\\/g, '/');
  const encodedPath = normalizedPath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  const fullUrl = `${ELAWS_BASE}/${encodedPath}`;
  return fetchWithRateLimit(fullUrl);
}

// ============================================================
// Legacy: Federal legislation (moj.gov.ae — old URLs, no longer working)
// ============================================================

export interface FederalIndexEntry {
  title: string;
  titleEn: string;
  url: string;
  type: string;
  year: number;
  number: number;
}

export async function fetchFederalIndex(): Promise<FetchResult> {
  const url = `${ELAWS_BASE}/laws/search`;
  return fetchWithRateLimit(url);
}

export async function fetchFederalContent(lawUrl: string): Promise<FetchResult> {
  const fullUrl = lawUrl.startsWith('http') ? lawUrl : `${ELAWS_BASE}${lawUrl}`;
  return fetchWithRateLimit(fullUrl);
}

// ============================================================
// DIFC legislation (difclaws.com)
// ============================================================

export interface DifcIndexEntry {
  title: string;
  url: string;
  lawNumber: string;
  year: number;
}

export async function fetchDIFCIndex(): Promise<FetchResult> {
  const url = `${DIFC_BASE}/laws-and-regulations`;
  return fetchWithRateLimit(url);
}

export async function fetchDIFCContent(lawUrl: string): Promise<FetchResult> {
  const fullUrl = lawUrl.startsWith('http') ? lawUrl : `${DIFC_BASE}${lawUrl}`;
  return fetchWithRateLimit(fullUrl);
}

// ============================================================
// ADGM legislation (adgm.com)
// ============================================================

export interface AdgmIndexEntry {
  title: string;
  url: string;
  regulationType: string;
  year: number;
}

export async function fetchADGMIndex(): Promise<FetchResult> {
  const url = `${ADGM_BASE}/legal-framework`;
  return fetchWithRateLimit(url);
}

export async function fetchADGMContent(regulationUrl: string): Promise<FetchResult> {
  const fullUrl = regulationUrl.startsWith('http') ? regulationUrl : `${ADGM_BASE}${regulationUrl}`;
  return fetchWithRateLimit(fullUrl);
}
