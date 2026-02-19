#!/usr/bin/env tsx
/**
 * Build the free-tier database for UAE Law MCP.
 *
 * Same as build-db.ts but outputs to data/database-free.db.
 * The free tier contains the same data as the full tier for this jurisdiction
 * (all UAE federal, DIFC, and ADGM legislation is publicly accessible).
 */

import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../data/database.db');
const FREE_DB_PATH = resolve(__dirname, '../data/database-free.db');

// Build the main database first
execSync('tsx scripts/build-db.ts', { stdio: 'inherit', cwd: resolve(__dirname, '..') });

if (existsSync(DB_PATH)) {
  copyFileSync(DB_PATH, FREE_DB_PATH);
  console.log(`\nFree-tier database copied to: ${FREE_DB_PATH}`);
} else {
  console.error('ERROR: Main database not found after build.');
  process.exit(1);
}
