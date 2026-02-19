/**
 * format_citation — Format a UAE legal citation per standard conventions.
 *
 * Supports three formats for all three legal zones:
 * - Federal: "Article N, Federal Decree-Law No. X of Year on Title"
 * - DIFC: "Article N, DIFC Law No. X of Year (Title)"
 * - ADGM: "Section N, ADGM [Title] Regulations Year"
 */

export interface FormatCitationInput {
  citation: string;
  format?: 'full' | 'short' | 'pinpoint';
}

export interface FormatCitationResult {
  original: string;
  formatted: string;
  format: string;
}

export async function formatCitationTool(
  input: FormatCitationInput,
): Promise<FormatCitationResult> {
  const format = input.format ?? 'full';
  const trimmed = input.citation.trim();

  // Parse "Article N <law>" or "Art. N <law>" or "<law>, Article N"
  const artFirst = trimmed.match(/^(?:Article|Art\.?|المادة)\s*(\d+[A-Za-z]*)\s*[,;]?\s+(.+)$/i);
  const artLast = trimmed.match(/^(.+?)[,;]\s*(?:Article|Art\.?|المادة)\s*(\d+[A-Za-z]*)$/i);
  const secFirst = trimmed.match(/^(?:Section|s\.?)\s*(\d+[A-Za-z]*)\s*[,;]?\s+(.+)$/i);
  const secLast = trimmed.match(/^(.+?)[,;]\s*(?:Section|s\.?)\s*(\d+[A-Za-z]*)$/i);

  const article = artFirst?.[1] ?? artLast?.[2] ?? secFirst?.[1] ?? secLast?.[2];
  const law = artFirst?.[2] ?? artLast?.[1] ?? secFirst?.[2] ?? secLast?.[1] ?? trimmed;

  // Detect if this is DIFC/ADGM (uses Section) or Federal (uses Article)
  const isDifcAdgm = /\b(?:DIFC|ADGM)\b/i.test(law);
  const provisionWord = isDifcAdgm ? 'Section' : 'Article';
  const provisionAbbrev = isDifcAdgm ? 's' : 'Art.';

  let formatted: string;
  switch (format) {
    case 'short':
      formatted = article ? `${provisionAbbrev} ${article}, ${law.split('(')[0].trim()}` : law;
      break;
    case 'pinpoint':
      formatted = article ? `${provisionAbbrev} ${article}` : law;
      break;
    case 'full':
    default:
      formatted = article ? `${provisionWord} ${article}, ${law}` : law;
      break;
  }

  return { original: input.citation, formatted, format };
}
