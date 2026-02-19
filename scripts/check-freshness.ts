#!/usr/bin/env tsx
/**
 * Data freshness check for UAE Law MCP.
 *
 * Verifies that the database is not stale by checking the built_at timestamp.
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../data/database.db');
const STALENESS_THRESHOLD_DAYS = 30;

function main(): void {
  console.log('UAE Law MCP -- Freshness Check');
  console.log('==============================\n');

  if (!fs.existsSync(DB_PATH)) {
    console.log('  ERROR: Database not found at', DB_PATH);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  try {
    const builtAt = (db.prepare("SELECT value FROM db_metadata WHERE key = 'built_at'").get() as { value: string } | undefined)?.value;

    if (!builtAt) {
      console.log('  WARNING: No built_at timestamp found in database.');
      process.exit(1);
    }

    const builtDate = new Date(builtAt);
    const daysSinceBuilt = Math.floor((Date.now() - builtDate.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`  Built at: ${builtAt}`);
    console.log(`  Days since built: ${daysSinceBuilt}`);
    console.log(`  Threshold: ${STALENESS_THRESHOLD_DAYS} days`);

    const docCount = (db.prepare('SELECT COUNT(*) as count FROM legal_documents').get() as { count: number }).count;
    const provCount = (db.prepare('SELECT COUNT(*) as count FROM legal_provisions').get() as { count: number }).count;

    console.log(`  Documents: ${docCount}`);
    console.log(`  Provisions: ${provCount}`);

    if (daysSinceBuilt > STALENESS_THRESHOLD_DAYS) {
      console.log(`\n  STALE: Database is ${daysSinceBuilt} days old (threshold: ${STALENESS_THRESHOLD_DAYS}).`);
      process.exit(1);
    }

    console.log('\n  OK: Database is fresh.');
  } finally {
    db.close();
  }
}

main();
