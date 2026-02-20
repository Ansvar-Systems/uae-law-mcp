/**
 * Response metadata utilities for UAE Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source:
      'UAE Ministry of Justice (moj.gov.ae), DIFC Laws (difclaws.com), ADGM Legal Framework (adgm.com) — ' +
      'UAE Ministry of Justice, DIFC Courts, ADGM Registration Authority',
    jurisdiction: 'AE',
    disclaimer:
      'This data is sourced from official UAE government portals. ' +
      'Arabic is the authoritative language for federal legislation; English translations are unofficial unless from DIFC/ADGM. ' +
      'The UAE has a three-layer legal system: federal law, DIFC (Dubai free zone), and ADGM (Abu Dhabi free zone). ' +
      'Always verify with the official portals at moj.gov.ae, difclaws.com, or adgm.com.',
    freshness,
  };
}
