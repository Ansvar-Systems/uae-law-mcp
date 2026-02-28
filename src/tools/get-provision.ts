/**
 * get_provision — Retrieve specific provision(s) from a UAE federal law, DIFC law, or ADGM regulation.
 */

import type Database from '@ansvar/mcp-sqlite';
import { resolveDocumentId } from '../utils/statute-id.js';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface GetProvisionInput {
  document_id: string;
  section?: string;
  provision_ref?: string;
  article?: string;
  as_of_date?: string;
}

export interface ProvisionResult {
  document_id: string;
  document_title: string;
  provision_ref: string;
  chapter: string | null;
  section: string;
  title: string | null;
  content: string;
  article_number?: string;
  url?: string;
  legal_zone?: string;
  language?: string;
}

export async function getProvision(
  db: InstanceType<typeof Database>,
  input: GetProvisionInput,
): Promise<ToolResponse<ProvisionResult[]>> {
  const resolvedId = resolveDocumentId(db, input.document_id);
  if (!resolvedId) {
    return {
      results: [],
      _metadata: {
        ...generateResponseMetadata(db),
        ...{ note: `No document found matching "${input.document_id}"` },
      },
    };
  }

  const docRow = db.prepare(
    'SELECT id, title, url, legal_zone FROM legal_documents WHERE id = ?'
  ).get(resolvedId) as { id: string; title: string; url: string | null; legal_zone: string | null } | undefined;
  if (!docRow) {
    return { results: [], _metadata: generateResponseMetadata(db) };
  }

  // Specific provision lookup — accept article, section, or provision_ref
  const ref = input.article ?? input.provision_ref ?? input.section;
  if (ref) {
    const refTrimmed = ref.trim();

    // Try direct provision_ref match
    let provision = db.prepare(
      'SELECT * FROM legal_provisions WHERE document_id = ? AND provision_ref = ?'
    ).get(resolvedId, refTrimmed) as Record<string, unknown> | undefined;

    // Try with "art" prefix (e.g., "2" -> "art2") — UAE uses Article numbering
    if (!provision) {
      provision = db.prepare(
        'SELECT * FROM legal_provisions WHERE document_id = ? AND provision_ref = ?'
      ).get(resolvedId, `art${refTrimmed}`) as Record<string, unknown> | undefined;
    }

    // Try with "s" prefix for DIFC/ADGM sections
    if (!provision) {
      provision = db.prepare(
        'SELECT * FROM legal_provisions WHERE document_id = ? AND provision_ref = ?'
      ).get(resolvedId, `s${refTrimmed}`) as Record<string, unknown> | undefined;
    }

    // Try section column match
    if (!provision) {
      provision = db.prepare(
        'SELECT * FROM legal_provisions WHERE document_id = ? AND section = ?'
      ).get(resolvedId, refTrimmed) as Record<string, unknown> | undefined;
    }

    // Try LIKE match for flexible input
    if (!provision) {
      provision = db.prepare(
        "SELECT * FROM legal_provisions WHERE document_id = ? AND (provision_ref LIKE ? OR section LIKE ?)"
      ).get(resolvedId, `%${refTrimmed}%`, `%${refTrimmed}%`) as Record<string, unknown> | undefined;
    }

    if (provision) {
      return {
        results: [{
          document_id: resolvedId,
          document_title: docRow.title,
          provision_ref: String(provision.provision_ref),
          chapter: provision.chapter as string | null,
          section: String(provision.section),
          title: provision.title as string | null,
          content: String(provision.content),
          article_number: String(provision.provision_ref).replace(/^(?:art|s)/, ''),
          url: docRow.url ?? undefined,
          legal_zone: docRow.legal_zone ?? undefined,
          language: provision.language as string | undefined,
        }],
        _metadata: generateResponseMetadata(db),
      };
    }

    return {
      results: [],
      _metadata: {
        ...generateResponseMetadata(db),
        ...{ note: `Provision "${ref}" not found in document "${resolvedId}"` },
      },
    };
  }

  // Return all provisions for the document
  const provisions = db.prepare(
    'SELECT * FROM legal_provisions WHERE document_id = ? ORDER BY id'
  ).all(resolvedId) as Record<string, unknown>[];

  return {
    results: provisions.map(p => ({
      document_id: resolvedId,
      document_title: docRow.title,
      provision_ref: String(p.provision_ref),
      chapter: p.chapter as string | null,
      section: String(p.section),
      title: p.title as string | null,
      content: String(p.content),
      article_number: String(p.provision_ref).replace(/^(?:art|s)/, ''),
      url: docRow.url ?? undefined,
      legal_zone: docRow.legal_zone ?? undefined,
      language: p.language as string | undefined,
    })),
    _metadata: generateResponseMetadata(db),
  };
}
