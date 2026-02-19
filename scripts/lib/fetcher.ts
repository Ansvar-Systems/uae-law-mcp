/**
 * Rate-limited HTTP client for UAE legal sources.
 *
 * Three sources:
 * 1. UAE Ministry of Justice (moj.gov.ae) — Federal legislation (Arabic + English)
 * 2. DIFC Laws (difclaws.com) — DIFC free zone legislation (English only)
 * 3. ADGM Legal Framework (adgm.com/legal-framework) — ADGM free zone (English only)
 *
 * - 500ms minimum delay between requests (be respectful to government servers)
 * - Browser-like User-Agent
 * - No auth needed (government open data)
 * - Encoding: UTF-8 (supports Arabic + English)
 */

const USER_AGENT = 'UAELawMCP/1.0 (+https://github.com/Ansvar-Systems/uae-law-mcp)';
const MIN_DELAY_MS = 500;

const MOJ_BASE = 'https://moj.gov.ae';
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

// ============================================================
// Federal legislation (moj.gov.ae)
// ============================================================

export interface FederalIndexEntry {
  title: string;
  titleEn: string;
  url: string;
  type: string;
  year: number;
  number: number;
}

/**
 * Fetch the federal legislation index from the Ministry of Justice portal.
 * The MOJ website lists legislation in a browseable catalogue.
 */
export async function fetchFederalIndex(): Promise<FetchResult> {
  const url = `${MOJ_BASE}/en/legislation`;
  return fetchWithRateLimit(url);
}

/**
 * Fetch the full content of a specific federal law page.
 */
export async function fetchFederalContent(lawUrl: string): Promise<FetchResult> {
  const fullUrl = lawUrl.startsWith('http') ? lawUrl : `${MOJ_BASE}${lawUrl}`;
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

/**
 * Fetch the DIFC laws index page.
 */
export async function fetchDIFCIndex(): Promise<FetchResult> {
  const url = `${DIFC_BASE}/laws-and-regulations`;
  return fetchWithRateLimit(url);
}

/**
 * Fetch the full content of a specific DIFC law page.
 */
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

/**
 * Fetch the ADGM legal framework index page.
 */
export async function fetchADGMIndex(): Promise<FetchResult> {
  const url = `${ADGM_BASE}/legal-framework`;
  return fetchWithRateLimit(url);
}

/**
 * Fetch the full content of a specific ADGM regulation page.
 */
export async function fetchADGMContent(regulationUrl: string): Promise<FetchResult> {
  const fullUrl = regulationUrl.startsWith('http') ? regulationUrl : `${ADGM_BASE}${regulationUrl}`;
  return fetchWithRateLimit(fullUrl);
}
