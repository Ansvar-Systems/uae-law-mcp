/**
 * Statute ID resolution for UAE Law MCP.
 *
 * Resolves fuzzy document references (titles, abbreviations, citation strings)
 * to database document IDs. Handles all three legal zones:
 * - Federal: fdl-45-2021, fl-2-2015
 * - DIFC: difc-law-5-2020
 * - ADGM: adgm-dpr-2021
 */

import type Database from '@ansvar/mcp-sqlite';

/**
 * Resolve a document identifier to a database document ID.
 * Supports:
 * - Direct ID match (e.g., "fdl-45-2021")
 * - Full title match (e.g., "Federal Decree-Law No. 45/2021 on Personal Data Protection")
 * - Short name / abbreviation match (e.g., "PDPL", "DIFC DPL")
 * - Title substring match (e.g., "Personal Data Protection")
 * - Federal Decree-Law number format (e.g., "45/2021")
 */
export function resolveDocumentId(
  db: InstanceType<typeof Database>,
  input: string,
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct ID match
  const directMatch = db.prepare(
    'SELECT id FROM legal_documents WHERE id = ?'
  ).get(trimmed) as { id: string } | undefined;
  if (directMatch) return directMatch.id;

  // Short name / abbreviation match (exact, case-insensitive)
  const shortNameMatch = db.prepare(
    "SELECT id FROM legal_documents WHERE LOWER(short_name) = LOWER(?) LIMIT 1"
  ).get(trimmed) as { id: string } | undefined;
  if (shortNameMatch) return shortNameMatch.id;

  // Try to extract Federal Decree-Law number/year pattern: "No. 45/2021" or "45/2021"
  const fdlPattern = trimmed.match(/(?:No\.?\s*)?(\d+)\s*\/\s*(\d{4})/);
  if (fdlPattern) {
    const num = fdlPattern[1];
    const year = fdlPattern[2];
    // Try federal decree-law format
    const fdlId = db.prepare(
      "SELECT id FROM legal_documents WHERE id = ? OR id = ? OR id = ? LIMIT 1"
    ).get(`fdl-${num}-${year}`, `fl-${num}-${year}`, `cd-${num}-${year}`) as { id: string } | undefined;
    if (fdlId) return fdlId.id;
  }

  // Title/short_name fuzzy match
  const titleResult = db.prepare(
    "SELECT id FROM legal_documents WHERE title LIKE ? OR short_name LIKE ? OR title_en LIKE ? LIMIT 1"
  ).get(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`) as { id: string } | undefined;
  if (titleResult) return titleResult.id;

  // Case-insensitive fallback
  const lowerResult = db.prepare(
    "SELECT id FROM legal_documents WHERE LOWER(title) LIKE LOWER(?) OR LOWER(short_name) LIKE LOWER(?) OR LOWER(title_en) LIKE LOWER(?) LIMIT 1"
  ).get(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`) as { id: string } | undefined;
  if (lowerResult) return lowerResult.id;

  return null;
}
