#!/usr/bin/env tsx
/**
 * UAE Law MCP -- Ingestion Pipeline
 *
 * Three-phase pipeline fetching UAE legislation from:
 * 1. Federal: moj.gov.ae (Ministry of Justice)
 * 2. DIFC: difclaws.com (Dubai International Financial Centre)
 * 3. ADGM: adgm.com (Abu Dhabi Global Market)
 *
 * Usage:
 *   npm run ingest                              # Full ingestion (all 3 sources)
 *   npm run ingest -- --limit 3                 # Test with 3 laws per source
 *   npm run ingest -- --source federal          # Federal only
 *   npm run ingest -- --source difc             # DIFC only
 *   npm run ingest -- --source adgm             # ADGM only
 *   npm run ingest -- --skip-fetch              # Reuse cached HTML
 *
 * Data is sourced under Government Open Data terms.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchFederalContent, fetchDIFCContent, fetchADGMContent } from './lib/fetcher.js';
import {
  parseFederalLawHtml,
  parseDifcLawHtml,
  parseAdgmRegulationHtml,
  KEY_FEDERAL_LAWS,
  KEY_DIFC_LAWS,
  KEY_ADGM_REGULATIONS,
  type FederalLawEntry,
  type DifcLawEntry,
  type AdgmRegulationEntry,
  type ParsedDocument,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

interface CliArgs {
  limit: number | null;
  skipFetch: boolean;
  source: 'all' | 'federal' | 'difc' | 'adgm';
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;
  let source: CliArgs['source'] = 'all';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    } else if (args[i] === '--source' && args[i + 1]) {
      source = args[i + 1] as CliArgs['source'];
      i++;
    }
  }

  return { limit, skipFetch, source };
}

interface IngestResult {
  id: string;
  name: string;
  provisions: number;
  definitions: number;
  status: string;
  zone: string;
}

async function ingestFederalLaws(
  laws: FederalLawEntry[],
  skipFetch: boolean,
): Promise<IngestResult[]> {
  console.log(`\n  Phase 1: Federal legislation (${laws.length} laws from moj.gov.ae)\n`);
  const results: IngestResult[] = [];

  for (const law of laws) {
    const sourceFile = path.join(SOURCE_DIR, `${law.id}.html`);
    const seedFile = path.join(SEED_DIR, `${law.id}.json`);

    if (skipFetch && fs.existsSync(seedFile)) {
      const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedDocument;
      console.log(`    SKIP ${law.shortName} (cached: ${existing.provisions.length} provisions)`);
      results.push({ id: law.id, name: law.shortName, provisions: existing.provisions.length, definitions: existing.definitions.length, status: 'cached', zone: 'federal' });
      continue;
    }

    try {
      let html: string;
      if (skipFetch && fs.existsSync(sourceFile)) {
        html = fs.readFileSync(sourceFile, 'utf-8');
        console.log(`    ${law.shortName}: parsed from cache`);
      } else {
        process.stdout.write(`    Fetching ${law.shortName}...`);
        const result = await fetchFederalContent(law.url);
        html = result.body;
        fs.writeFileSync(sourceFile, html);
        console.log(` OK (${(html.length / 1024).toFixed(0)} KB)`);
      }

      const parsed = parseFederalLawHtml(html, law);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      console.log(`      -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);
      results.push({ id: law.id, name: law.shortName, provisions: parsed.provisions.length, definitions: parsed.definitions.length, status: 'ok', zone: 'federal' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ERROR ${law.shortName}: ${msg}`);
      results.push({ id: law.id, name: law.shortName, provisions: 0, definitions: 0, status: `FAILED: ${msg.substring(0, 80)}`, zone: 'federal' });
    }
  }

  return results;
}

async function ingestDifcLaws(
  laws: DifcLawEntry[],
  skipFetch: boolean,
): Promise<IngestResult[]> {
  console.log(`\n  Phase 2: DIFC legislation (${laws.length} laws from difclaws.com)\n`);
  const results: IngestResult[] = [];

  for (const law of laws) {
    const sourceFile = path.join(SOURCE_DIR, `${law.id}.html`);
    const seedFile = path.join(SEED_DIR, `${law.id}.json`);

    if (skipFetch && fs.existsSync(seedFile)) {
      const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedDocument;
      console.log(`    SKIP ${law.shortName} (cached: ${existing.provisions.length} provisions)`);
      results.push({ id: law.id, name: law.shortName, provisions: existing.provisions.length, definitions: existing.definitions.length, status: 'cached', zone: 'difc' });
      continue;
    }

    try {
      let html: string;
      if (skipFetch && fs.existsSync(sourceFile)) {
        html = fs.readFileSync(sourceFile, 'utf-8');
        console.log(`    ${law.shortName}: parsed from cache`);
      } else {
        process.stdout.write(`    Fetching ${law.shortName}...`);
        const result = await fetchDIFCContent(law.url);
        html = result.body;
        fs.writeFileSync(sourceFile, html);
        console.log(` OK (${(html.length / 1024).toFixed(0)} KB)`);
      }

      const parsed = parseDifcLawHtml(html, law);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      console.log(`      -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);
      results.push({ id: law.id, name: law.shortName, provisions: parsed.provisions.length, definitions: parsed.definitions.length, status: 'ok', zone: 'difc' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ERROR ${law.shortName}: ${msg}`);
      results.push({ id: law.id, name: law.shortName, provisions: 0, definitions: 0, status: `FAILED: ${msg.substring(0, 80)}`, zone: 'difc' });
    }
  }

  return results;
}

async function ingestAdgmRegulations(
  regulations: AdgmRegulationEntry[],
  skipFetch: boolean,
): Promise<IngestResult[]> {
  console.log(`\n  Phase 3: ADGM regulations (${regulations.length} regulations from adgm.com)\n`);
  const results: IngestResult[] = [];

  for (const reg of regulations) {
    const sourceFile = path.join(SOURCE_DIR, `${reg.id}.html`);
    const seedFile = path.join(SEED_DIR, `${reg.id}.json`);

    if (skipFetch && fs.existsSync(seedFile)) {
      const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedDocument;
      console.log(`    SKIP ${reg.shortName} (cached: ${existing.provisions.length} provisions)`);
      results.push({ id: reg.id, name: reg.shortName, provisions: existing.provisions.length, definitions: existing.definitions.length, status: 'cached', zone: 'adgm' });
      continue;
    }

    try {
      let html: string;
      if (skipFetch && fs.existsSync(sourceFile)) {
        html = fs.readFileSync(sourceFile, 'utf-8');
        console.log(`    ${reg.shortName}: parsed from cache`);
      } else {
        process.stdout.write(`    Fetching ${reg.shortName}...`);
        const result = await fetchADGMContent(reg.url);
        html = result.body;
        fs.writeFileSync(sourceFile, html);
        console.log(` OK (${(html.length / 1024).toFixed(0)} KB)`);
      }

      const parsed = parseAdgmRegulationHtml(html, reg);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      console.log(`      -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);
      results.push({ id: reg.id, name: reg.shortName, provisions: parsed.provisions.length, definitions: parsed.definitions.length, status: 'ok', zone: 'adgm' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ERROR ${reg.shortName}: ${msg}`);
      results.push({ id: reg.id, name: reg.shortName, provisions: 0, definitions: 0, status: `FAILED: ${msg.substring(0, 80)}`, zone: 'adgm' });
    }
  }

  return results;
}

async function main(): Promise<void> {
  const { limit, skipFetch, source } = parseArgs();

  console.log('UAE Law MCP -- Ingestion Pipeline');
  console.log('=================================\n');
  console.log(`  Sources: moj.gov.ae, difclaws.com, adgm.com`);
  console.log(`  License: Government Open Data`);
  console.log(`  Rate limit: 500ms between requests`);
  console.log(`  Languages: Arabic (federal), English (all)`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);
  if (source !== 'all') console.log(`  --source ${source}`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  const allResults: IngestResult[] = [];

  if (source === 'all' || source === 'federal') {
    const federalLaws = limit ? KEY_FEDERAL_LAWS.slice(0, limit) : KEY_FEDERAL_LAWS;
    const results = await ingestFederalLaws(federalLaws, skipFetch);
    allResults.push(...results);
  }

  if (source === 'all' || source === 'difc') {
    const difcLaws = limit ? KEY_DIFC_LAWS.slice(0, limit) : KEY_DIFC_LAWS;
    const results = await ingestDifcLaws(difcLaws, skipFetch);
    allResults.push(...results);
  }

  if (source === 'all' || source === 'adgm') {
    const adgmRegs = limit ? KEY_ADGM_REGULATIONS.slice(0, limit) : KEY_ADGM_REGULATIONS;
    const results = await ingestAdgmRegulations(adgmRegs, skipFetch);
    allResults.push(...results);
  }

  // Summary
  const totalProvisions = allResults.reduce((s, r) => s + r.provisions, 0);
  const totalDefinitions = allResults.reduce((s, r) => s + r.definitions, 0);
  const failed = allResults.filter(r => r.status.startsWith('FAILED')).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log('INGESTION REPORT');
  console.log('='.repeat(60));
  console.log(`\n  Laws processed: ${allResults.length}`);
  console.log(`  Laws failed: ${failed}`);
  console.log(`  Total provisions: ${totalProvisions}`);
  console.log(`  Total definitions: ${totalDefinitions}`);
  console.log(`\n  Per-law breakdown:`);
  console.log(`  ${'Zone'.padEnd(10)} ${'Name'.padEnd(24)} ${'Provisions'.padStart(12)} ${'Definitions'.padStart(13)}  Status`);
  console.log(`  ${'-'.repeat(10)} ${'-'.repeat(24)} ${'-'.repeat(12)} ${'-'.repeat(13)}  ${'-'.repeat(30)}`);
  for (const r of allResults) {
    console.log(
      `  ${r.zone.padEnd(10)} ${r.name.padEnd(24)} ${String(r.provisions).padStart(12)} ${String(r.definitions).padStart(13)}  ${r.status}`,
    );
  }
  console.log();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
