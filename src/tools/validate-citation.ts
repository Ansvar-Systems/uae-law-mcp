/**
 * validate_citation — Validate a UAE legal citation against the database.
 *
 * Supports three legal systems:
 * - Federal: "Article 2, Federal Decree-Law No. 45 of 2021"
 * - DIFC: "Article 1, DIFC Law No. 5 of 2020"
 * - ADGM: "Section 1, ADGM Data Protection Regulations 2021"
 * - Arabic: "المادة 2 من المرسوم بقانون اتحادي رقم 45 لسنة 2021"
 * - Short: "Art. 2, PDPL 2021"
 * - ID-based: "fdl-45-2021, art. 2"
 */

import type Database from '@ansvar/mcp-sqlite';
import { resolveDocumentId } from '../utils/statute-id.js';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface ValidateCitationInput {
  citation: string;
}

export interface ValidateCitationResult {
  valid: boolean;
  citation: string;
  normalized?: string;
  document_id?: string;
  document_title?: string;
  provision_ref?: string;
  status?: string;
  legal_zone?: string;
  warnings: string[];
}

/**
 * Parse a UAE legal citation.
 */
function parseCitation(citation: string): { documentRef: string; articleRef?: string } | null {
  const trimmed = citation.trim();

  // Arabic format: "المادة N من ..."
  const arabicMatch = trimmed.match(/^المادة\s+(\d+[A-Za-z]*)\s+(?:من\s+)?(.+)$/);
  if (arabicMatch) {
    return { documentRef: arabicMatch[2].trim(), articleRef: arabicMatch[1] };
  }

  // "Article N, <law>" or "Art. N, <law>"
  const artFirst = trimmed.match(/^(?:Article|Art\.?)\s*(\d+[A-Za-z]*)\s*[,;]?\s+(.+)$/i);
  if (artFirst) {
    return { documentRef: artFirst[2].trim(), articleRef: artFirst[1] };
  }

  // "Section N, <law>" or "s N <law>" (DIFC/ADGM)
  const secFirst = trimmed.match(/^(?:Section|s\.?)\s*(\d+[A-Za-z]*)\s*[,;]?\s+(.+)$/i);
  if (secFirst) {
    return { documentRef: secFirst[2].trim(), articleRef: secFirst[1] };
  }

  // "<law>, Article N" or "<law>, art. N"
  const artLast = trimmed.match(/^(.+?)[,;]\s*(?:Article|Art\.?)\s*(\d+[A-Za-z]*)$/i);
  if (artLast) {
    return { documentRef: artLast[1].trim(), articleRef: artLast[2] };
  }

  // "<law>, Section N"
  const secLast = trimmed.match(/^(.+?)[,;]\s*(?:Section|s\.?)\s*(\d+[A-Za-z]*)$/i);
  if (secLast) {
    return { documentRef: secLast[1].trim(), articleRef: secLast[2] };
  }

  // ID-based: "fdl-45-2021, art. 2"
  const idBased = trimmed.match(/^([a-z]+-[\d-]+)\s*[,;]\s*(?:art\.?|s\.?)\s*(\d+[A-Za-z]*)$/i);
  if (idBased) {
    return { documentRef: idBased[1].trim(), articleRef: idBased[2] };
  }

  // Just a document reference
  return { documentRef: trimmed };
}

export async function validateCitationTool(
  db: InstanceType<typeof Database>,
  input: ValidateCitationInput,
): Promise<ToolResponse<ValidateCitationResult>> {
  const warnings: string[] = [];
  const parsed = parseCitation(input.citation);

  if (!parsed) {
    return {
      results: {
        valid: false,
        citation: input.citation,
        warnings: ['Could not parse citation format'],
      },
      _metadata: generateResponseMetadata(db),
    };
  }

  const docId = resolveDocumentId(db, parsed.documentRef);
  if (!docId) {
    return {
      results: {
        valid: false,
        citation: input.citation,
        warnings: [`Document not found: "${parsed.documentRef}"`],
      },
      _metadata: generateResponseMetadata(db),
    };
  }

  const doc = db.prepare(
    'SELECT id, title, status, legal_zone FROM legal_documents WHERE id = ?'
  ).get(docId) as { id: string; title: string; status: string; legal_zone: string | null };

  if (doc.status === 'repealed') {
    warnings.push('WARNING: This law has been repealed.');
  } else if (doc.status === 'amended') {
    warnings.push('Note: This law has been amended. Verify you are referencing the current version.');
  }

  if (parsed.articleRef) {
    const provision = db.prepare(
      "SELECT provision_ref FROM legal_provisions WHERE document_id = ? AND (provision_ref = ? OR provision_ref = ? OR provision_ref = ? OR section = ?)"
    ).get(docId, parsed.articleRef, `art${parsed.articleRef}`, `s${parsed.articleRef}`, parsed.articleRef) as { provision_ref: string } | undefined;

    if (!provision) {
      return {
        results: {
          valid: false,
          citation: input.citation,
          document_id: docId,
          document_title: doc.title,
          legal_zone: doc.legal_zone ?? undefined,
          warnings: [...warnings, `Provision "${parsed.articleRef}" not found in ${doc.title}`],
        },
        _metadata: generateResponseMetadata(db),
      };
    }

    const articleNum = provision.provision_ref.replace(/^(?:art|s)/, '');
    const prefix = doc.legal_zone === 'federal' ? 'Article' : 'Section';

    return {
      results: {
        valid: true,
        citation: input.citation,
        normalized: `${prefix} ${articleNum}, ${doc.title}`,
        document_id: docId,
        document_title: doc.title,
        provision_ref: provision.provision_ref,
        status: doc.status,
        legal_zone: doc.legal_zone ?? undefined,
        warnings,
      },
      _metadata: generateResponseMetadata(db),
    };
  }

  return {
    results: {
      valid: true,
      citation: input.citation,
      normalized: doc.title,
      document_id: docId,
      document_title: doc.title,
      status: doc.status,
      legal_zone: doc.legal_zone ?? undefined,
      warnings,
    },
    _metadata: generateResponseMetadata(db),
  };
}
