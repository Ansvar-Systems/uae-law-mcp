#!/usr/bin/env tsx
/**
 * UAE Law MCP -- Full Corpus Ingestion Pipeline
 *
 * Census-first approach using the elaws.moj.gov.ae API:
 *
 * Phase 1 — Census: Discover all UAE federal laws via POST /api/Laws/Search
 *   - Paginates through the full corpus (5,000+ laws)
 *   - Deduplicates by law Id
 *   - Writes census.json with the complete inventory
 *
 * Phase 2 — Fetch & Parse: Download each law's HTML and extract articles
 *   - Fetches HTML from elaws.moj.gov.ae/{Link path}
 *   - Parses المادة (Article) markers to extract individual provisions
 *   - Extracts definitions from definition articles
 *   - Writes seed JSON files for the database builder
 *
 * Usage:
 *   npm run ingest                              # Full ingestion
 *   npm run ingest -- --limit 50                # Test with first 50 laws
 *   npm run ingest -- --skip-fetch              # Reuse cached HTML
 *   npm run ingest -- --census-only             # Only run Phase 1
 *   npm run ingest -- --law-types fdl,fl        # Only federal decree-laws and federal laws
 *
 * Data is sourced under Government Open Data terms from the UAE Ministry of Justice.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  searchElaws,
  fetchElawsContent,
  type ElawsSearchResult,
} from './lib/fetcher.js';
import {
  parseElawsHtml,
  classifyLawType,
  generateTitleEn,
  type FederalLawEntry,
  type ParsedDocument,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const CENSUS_FILE = path.resolve(__dirname, '../data/census.json');

const DATABASE_KEY = 'AL1'; // UAE federal legislation database
const PAGE_SIZE = 200;      // Max results per API page

interface CliArgs {
  limit: number | null;
  skipFetch: boolean;
  censusOnly: boolean;
  lawTypes: string[] | null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;
  let censusOnly = false;
  let lawTypes: string[] | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    } else if (args[i] === '--census-only') {
      censusOnly = true;
    } else if (args[i] === '--law-types' && args[i + 1]) {
      lawTypes = args[i + 1].split(',');
      i++;
    }
  }

  return { limit, skipFetch, censusOnly, lawTypes };
}

// ============================================================
// Phase 1: Census — Discover all laws via Search API
// ============================================================

interface CensusEntry {
  id: number;
  reference: string;
  title: string;
  lawType: string;
  lawNumber: string;
  lawYear: number;
  lawMonth: number | null;
  link: string;        // File path (with backslashes) for HTML content
  introduction: string;
}

interface Census {
  schema_version: string;
  jurisdiction: string;
  portal: string;
  generated: string;
  total_laws: number;
  total_provisions: number;
  laws: Array<{
    id: string;
    title: string;
    provisions: number;
  }>;
}

async function runCensus(): Promise<CensusEntry[]> {
  console.log('\n  Phase 1: Census — Discovering all UAE federal laws\n');
  console.log(`    API: POST ${DATABASE_KEY} /api/Laws/Search`);
  console.log(`    Page size: ${PAGE_SIZE}\n`);

  const allResults: ElawsSearchResult[] = [];
  let page = 1;
  let totalCount = 0;

  // Paginate through all results
  while (true) {
    process.stdout.write(`    Page ${page}...`);
    const response = await searchElaws({
      Keyword: null,
      Page: page,
      CountPerPage: PAGE_SIZE,
      Key: DATABASE_KEY,
    });

    totalCount = response.totalCount;
    const results = response.results;
    console.log(` ${results.length} results (total: ${totalCount})`);

    if (results.length === 0) break;
    allResults.push(...results);

    if (allResults.length >= totalCount) break;
    page++;
  }

  // Deduplicate by Id — search results can return the same law multiple times
  // (once per matching section/anchor)
  const byId = new Map<number, ElawsSearchResult>();
  for (const r of allResults) {
    if (!byId.has(r.Id)) {
      byId.set(r.Id, r);
    }
  }

  const uniqueLaws = Array.from(byId.values());
  console.log(`\n    Raw results: ${allResults.length}`);
  console.log(`    Unique laws (by Id): ${uniqueLaws.length}`);

  // Convert to census entries
  const census: CensusEntry[] = uniqueLaws.map(r => ({
    id: r.Id,
    reference: r.Reference,
    title: r.FinalTitle,
    lawType: r.LawType,
    lawNumber: r.LawNumber,
    lawYear: r.LawYear,
    lawMonth: r.LawMonth ?? null,
    link: (r.Link || '').split('#')[0], // Strip anchor from link
    introduction: (r.Introduction || '').substring(0, 500),
  }));

  // Sort by year descending, then by law number
  census.sort((a, b) => b.lawYear - a.lawYear || parseInt(b.lawNumber) - parseInt(a.lawNumber));

  return census;
}

// ============================================================
// Phase 2: Fetch & Parse
// ============================================================

interface IngestResult {
  id: string;
  name: string;
  provisions: number;
  definitions: number;
  status: string;
}

async function ingestLaw(
  entry: CensusEntry,
  skipFetch: boolean,
): Promise<IngestResult> {
  // Generate a stable ID from law type, number, and year
  const typeCode = classifyLawType(entry.lawType);
  const lawId = `${typeCode}-${entry.lawNumber}-${entry.lawYear}`;
  const shortName = `${entry.lawType.trim()} ${entry.lawNumber}/${entry.lawYear}`;

  const sourceFile = path.join(SOURCE_DIR, `${lawId}.html`);
  const seedFile = path.join(SEED_DIR, `${lawId}.json`);

  // Skip if seed file exists and --skip-fetch is set
  if (skipFetch && fs.existsSync(seedFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedDocument;
      return {
        id: lawId,
        name: shortName,
        provisions: existing.provisions.length,
        definitions: existing.definitions.length,
        status: 'cached',
      };
    } catch {
      // Re-parse if seed file is corrupt
    }
  }

  // Fetch HTML content
  let html: string;
  if (skipFetch && fs.existsSync(sourceFile)) {
    html = fs.readFileSync(sourceFile, 'utf-8');
  } else if (!entry.link) {
    return {
      id: lawId,
      name: shortName,
      provisions: 0,
      definitions: 0,
      status: 'SKIPPED: no link',
    };
  } else {
    try {
      const result = await fetchElawsContent(entry.link);
      if (result.status !== 200) {
        return {
          id: lawId,
          name: shortName,
          provisions: 0,
          definitions: 0,
          status: `FAILED: HTTP ${result.status}`,
        };
      }
      html = result.body;
      fs.writeFileSync(sourceFile, html);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        id: lawId,
        name: shortName,
        provisions: 0,
        definitions: 0,
        status: `FAILED: ${msg.substring(0, 80)}`,
      };
    }
  }

  // Build law entry for parser
  const lawEntry: FederalLawEntry = {
    id: lawId,
    title: entry.title,
    titleEn: generateTitleEn(entry.lawType, parseInt(entry.lawNumber), entry.lawYear),
    shortName,
    type: typeCode,
    number: parseInt(entry.lawNumber) || 0,
    year: entry.lawYear,
    status: 'in_force',
    issuedDate: entry.lawMonth
      ? `${entry.lawYear}-${String(entry.lawMonth).padStart(2, '0')}-01`
      : `${entry.lawYear}-01-01`,
    inForceDate: entry.lawMonth
      ? `${entry.lawYear}-${String(entry.lawMonth).padStart(2, '0')}-01`
      : `${entry.lawYear}-01-01`,
    url: `https://elaws.moj.gov.ae/laws/ref/${entry.reference}`,
  };

  // Parse provisions
  try {
    const parsed = parseElawsHtml(html, lawEntry);
    fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
    return {
      id: lawId,
      name: shortName,
      provisions: parsed.provisions.length,
      definitions: parsed.definitions.length,
      status: 'ok',
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      id: lawId,
      name: shortName,
      provisions: 0,
      definitions: 0,
      status: `PARSE_ERROR: ${msg.substring(0, 80)}`,
    };
  }
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const { limit, skipFetch, censusOnly, lawTypes } = parseArgs();

  console.log('UAE Law MCP -- Full Corpus Ingestion Pipeline');
  console.log('=============================================\n');
  console.log('  Source: elaws.moj.gov.ae (Ministry of Justice)');
  console.log('  License: Government Open Data');
  console.log('  Rate limit: 500ms between requests');
  console.log('  Language: Arabic (primary), English (where available)');

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log('  --skip-fetch');
  if (censusOnly) console.log('  --census-only');
  if (lawTypes) console.log(`  --law-types ${lawTypes.join(',')}`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  // Phase 1: Census
  let censusEntries = await runCensus();

  // Filter by law type if specified
  if (lawTypes) {
    censusEntries = censusEntries.filter(e => {
      const typeCode = classifyLawType(e.lawType);
      return lawTypes.includes(typeCode);
    });
    console.log(`\n    After type filter: ${censusEntries.length} laws`);
  }

  // Apply limit
  if (limit) {
    censusEntries = censusEntries.slice(0, limit);
    console.log(`    After --limit: ${censusEntries.length} laws`);
  }

  if (censusOnly) {
    // Write census file and exit
    const censusData: Census = {
      schema_version: '1.0',
      jurisdiction: 'AE',
      portal: 'elaws.moj.gov.ae',
      generated: new Date().toISOString().split('T')[0],
      total_laws: censusEntries.length,
      total_provisions: 0,
      laws: censusEntries.map(e => ({
        id: `${classifyLawType(e.lawType)}-${e.lawNumber}-${e.lawYear}`,
        title: e.title,
        provisions: 0,
      })),
    };
    fs.writeFileSync(CENSUS_FILE, JSON.stringify(censusData, null, 2));
    console.log(`\n    Census written to ${CENSUS_FILE}`);
    console.log(`    Total: ${censusEntries.length} laws discovered`);
    return;
  }

  // Phase 2: Fetch & Parse
  console.log(`\n  Phase 2: Fetch & Parse (${censusEntries.length} laws)\n`);

  const allResults: IngestResult[] = [];
  let successCount = 0;
  let failCount = 0;
  let cachedCount = 0;

  for (let i = 0; i < censusEntries.length; i++) {
    const entry = censusEntries[i];
    const progress = `[${i + 1}/${censusEntries.length}]`;

    process.stdout.write(`    ${progress} ${entry.lawType.trim()} ${entry.lawNumber}/${entry.lawYear}...`);

    const result = await ingestLaw(entry, skipFetch);
    allResults.push(result);

    if (result.status === 'ok') {
      successCount++;
      console.log(` ${result.provisions} provisions, ${result.definitions} defs`);
    } else if (result.status === 'cached') {
      cachedCount++;
      console.log(` cached (${result.provisions} prov)`);
    } else {
      failCount++;
      console.log(` ${result.status}`);
    }
  }

  // Write census.json with final provision counts
  const totalProvisions = allResults.reduce((s, r) => s + r.provisions, 0);
  const totalDefinitions = allResults.reduce((s, r) => s + r.definitions, 0);

  const censusData: Census = {
    schema_version: '1.0',
    jurisdiction: 'AE',
    portal: 'elaws.moj.gov.ae',
    generated: new Date().toISOString().split('T')[0],
    total_laws: allResults.length,
    total_provisions: totalProvisions,
    laws: allResults
      .filter(r => r.provisions > 0)
      .sort((a, b) => b.provisions - a.provisions)
      .map(r => ({
        id: r.id,
        title: r.name,
        provisions: r.provisions,
      })),
  };
  fs.writeFileSync(CENSUS_FILE, JSON.stringify(censusData, null, 2));

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('INGESTION REPORT');
  console.log('='.repeat(70));
  console.log(`\n  Laws discovered: ${censusEntries.length}`);
  console.log(`  Laws fetched:    ${successCount} (ok) + ${cachedCount} (cached)`);
  console.log(`  Laws failed:     ${failCount}`);
  console.log(`  Total provisions: ${totalProvisions}`);
  console.log(`  Total definitions: ${totalDefinitions}`);

  // Per-type breakdown
  const byType = new Map<string, { count: number; provisions: number }>();
  for (const r of allResults) {
    const type = r.id.split('-')[0];
    const existing = byType.get(type) || { count: 0, provisions: 0 };
    existing.count++;
    existing.provisions += r.provisions;
    byType.set(type, existing);
  }

  console.log('\n  Per-type breakdown:');
  console.log(`  ${'Type'.padEnd(15)} ${'Laws'.padStart(8)} ${'Provisions'.padStart(12)}`);
  console.log(`  ${'-'.repeat(15)} ${'-'.repeat(8)} ${'-'.repeat(12)}`);
  for (const [type, data] of Array.from(byType.entries()).sort((a, b) => b[1].provisions - a[1].provisions)) {
    console.log(`  ${type.padEnd(15)} ${String(data.count).padStart(8)} ${String(data.provisions).padStart(12)}`);
  }

  console.log(`\n  Census: ${CENSUS_FILE}`);
  console.log(`  Seed dir: ${SEED_DIR}`);
  console.log();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
