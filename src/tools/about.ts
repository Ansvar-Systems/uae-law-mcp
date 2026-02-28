/**
 * about — Server metadata, dataset statistics, and provenance.
 */

import type Database from '@ansvar/mcp-sqlite';
import { detectCapabilities, readDbMetadata } from '../capabilities.js';
import { SERVER_NAME, SERVER_VERSION, REPOSITORY_URL } from '../constants.js';

export interface AboutContext {
  version: string;
  fingerprint: string;
  dbBuilt: string;
}

function safeCount(db: InstanceType<typeof Database>, sql: string): number {
  try {
    const row = db.prepare(sql).get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  } catch {
    return 0;
  }
}

export function getAbout(db: InstanceType<typeof Database>, context: AboutContext) {
  const caps = detectCapabilities(db);
  const meta = readDbMetadata(db);

  return {
    server: SERVER_NAME,
    version: context.version,
    repository: REPOSITORY_URL,
    jurisdiction: 'United Arab Emirates (AE)',
    legal_system_note:
      'The UAE has a THREE-LAYER legal system: (1) Federal law applies across all emirates, ' +
      '(2) DIFC (Dubai International Financial Centre) is an independent common-law jurisdiction within Dubai, ' +
      '(3) ADGM (Abu Dhabi Global Market) is an independent common-law jurisdiction within Abu Dhabi. ' +
      'Federal law uses Arabic as the authoritative language; DIFC and ADGM laws are drafted natively in English.',
    database: {
      fingerprint: context.fingerprint,
      built_at: context.dbBuilt,
      tier: meta.tier,
      schema_version: meta.schema_version,
      capabilities: [...caps],
    },
    statistics: {
      documents: safeCount(db, 'SELECT COUNT(*) as count FROM legal_documents'),
      provisions: safeCount(db, 'SELECT COUNT(*) as count FROM legal_provisions'),
      definitions: safeCount(db, 'SELECT COUNT(*) as count FROM definitions'),
      eu_documents: safeCount(db, 'SELECT COUNT(*) as count FROM eu_documents'),
      eu_references: safeCount(db, 'SELECT COUNT(*) as count FROM eu_references'),
    },
    data_sources: [
      {
        name: 'UAE Ministry of Justice',
        authority: 'Ministry of Justice, United Arab Emirates',
        url: 'https://moj.gov.ae',
        license: 'Government Open Data',
        jurisdiction: 'AE (Federal)',
        languages: ['ar', 'en'],
        legal_zone: 'federal',
      },
      {
        name: 'DIFC Laws and Regulations',
        authority: 'Dubai International Financial Centre (DIFC)',
        url: 'https://difclaws.com',
        license: 'Government Open Data',
        jurisdiction: 'AE-DU (DIFC)',
        languages: ['en'],
        legal_zone: 'difc',
      },
      {
        name: 'ADGM Legal Framework',
        authority: 'Abu Dhabi Global Market (ADGM)',
        url: 'https://adgm.com/legal-framework',
        license: 'Government Open Data',
        jurisdiction: 'AE-AZ (ADGM)',
        languages: ['en'],
        legal_zone: 'adgm',
      },
    ],
  };
}
