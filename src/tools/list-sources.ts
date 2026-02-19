/**
 * list_sources — Return provenance metadata for all data sources.
 */

import type Database from 'node-sqlite3-wasm';
import { readDbMetadata } from '../capabilities.js';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface SourceInfo {
  name: string;
  authority: string;
  url: string;
  license: string;
  coverage: string;
  languages: string[];
  legal_zone: string;
}

export interface ListSourcesResult {
  sources: SourceInfo[];
  database: {
    tier: string;
    schema_version: string;
    built_at?: string;
    document_count: number;
    provision_count: number;
  };
}

function safeCount(db: InstanceType<typeof Database>, sql: string): number {
  try {
    const row = db.prepare(sql).get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  } catch {
    return 0;
  }
}

export async function listSources(
  db: InstanceType<typeof Database>,
): Promise<ToolResponse<ListSourcesResult>> {
  const meta = readDbMetadata(db);

  return {
    results: {
      sources: [
        {
          name: 'UAE Ministry of Justice (Official Legislation Portal)',
          authority: 'Ministry of Justice, United Arab Emirates',
          url: 'https://moj.gov.ae',
          license: 'Government Open Data',
          coverage:
            'Federal Decree-Laws, Federal Laws, Cabinet Decisions, and ministerial resolutions including ' +
            'PDPL (45/2021), Cybercrimes Law (34/2021), Electronic Transactions Law (46/2021), ' +
            'Commercial Companies Law (2/2015), and related implementing regulations',
          languages: ['ar', 'en'],
          legal_zone: 'federal',
        },
        {
          name: 'DIFC Laws and Regulations',
          authority: 'Dubai International Financial Centre (DIFC)',
          url: 'https://difclaws.com',
          license: 'Government Open Data',
          coverage:
            'DIFC Data Protection Law (Law No. 5/2020), DIFC Operating Law, DIFC Companies Law, ' +
            'DIFC Employment Law, DIFC Insolvency Law, DIFC Arbitration Law, and all DIFC regulations and rules of court',
          languages: ['en'],
          legal_zone: 'difc',
        },
        {
          name: 'ADGM Legal Framework',
          authority: 'Abu Dhabi Global Market (ADGM)',
          url: 'https://adgm.com/legal-framework',
          license: 'Government Open Data',
          coverage:
            'ADGM Data Protection Regulations 2021, ADGM Companies Regulations, ' +
            'ADGM Financial Services regulations, ADGM Employment Regulations, and all ADGM guidance and rules',
          languages: ['en'],
          legal_zone: 'adgm',
        },
      ],
      database: {
        tier: meta.tier,
        schema_version: meta.schema_version,
        built_at: meta.built_at,
        document_count: safeCount(db, 'SELECT COUNT(*) as count FROM legal_documents'),
        provision_count: safeCount(db, 'SELECT COUNT(*) as count FROM legal_provisions'),
      },
    },
    _metadata: generateResponseMetadata(db),
  };
}
