/**
 * HTML parser for UAE legislation from elaws.moj.gov.ae and free zone sources.
 *
 * elaws.moj.gov.ae federal laws:
 *   - Arabic text with HTML entities (&#1605; etc.)
 *   - Articles marked with المادة (Article) after entity decoding
 *   - Anchors: <a name="AnchorN"> for structural navigation
 *   - CSS classes encode Arabic section names (x__XXXX_ patterns)
 *   - Document structure: decree header, preamble, chapters/parts, articles
 *
 * DIFC laws (difclaws.com):
 *   - English only, common law format
 *   - Articles/sections numbered conventionally
 *
 * ADGM regulations (adgm.com):
 *   - English only, regulation/rule numbering
 */

export interface ParsedDocument {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  legal_zone: 'federal' | 'difc' | 'adgm';
  language: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
  language: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

// ============================================================
// HTML entity decoding and text cleanup
// ============================================================

/** Named HTML entities */
const NAMED_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&#xA0;': ' ', '&#160;': ' ',
  '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&#39;': "'",
  '&#8212;': '\u2014', '&#8217;': '\u2019',
  '&#8220;': '\u201C', '&#8221;': '\u201D',
};

/**
 * Decode all HTML entities (named and numeric) to Unicode characters.
 */
function decodeEntities(html: string): string {
  // Decode named entities
  let result = html;
  for (const [entity, char] of Object.entries(NAMED_ENTITIES)) {
    result = result.replaceAll(entity, char);
  }
  // Decode numeric entities: &#NNNN; and &#xHHHH;
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return result;
}

/**
 * Strip HTML tags, decode entities, and normalize whitespace.
 * Preserves Arabic characters and diacritics.
 */
function stripHtml(html: string): string {
  return decodeEntities(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u200B/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

// ============================================================
// elaws.moj.gov.ae Federal Law Parser
// ============================================================

export interface FederalLawEntry {
  id: string;
  title: string;
  titleEn: string;
  shortName: string;
  type: 'fdl' | 'fl' | 'cd' | 'decree' | 'cabinet' | 'ministerial' | 'other';
  number: number;
  year: number;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
}

/**
 * Classify an Arabic law type string into an internal type code.
 */
export function classifyLawType(arabicType: string): FederalLawEntry['type'] {
  const t = arabicType.trim();
  if (/مرسوم بقانون اتحادي/.test(t)) return 'fdl';   // Federal Decree-Law
  if (/قانون اتحادي/.test(t)) return 'fl';            // Federal Law
  if (/مرسوم اتحادي/.test(t)) return 'decree';        // Federal Decree
  if (/قرار مجلس الوزراء/.test(t)) return 'cabinet';   // Cabinet Decision
  if (/قرار وزاري/.test(t)) return 'ministerial';      // Ministerial Decision
  if (/قرار/.test(t)) return 'cd';                     // Decision (generic)
  return 'other';
}

/**
 * Generate a simple English translation of the law type + number + year.
 */
export function generateTitleEn(arabicType: string, number: number, year: number): string {
  const t = arabicType.trim();
  if (/مرسوم بقانون اتحادي/.test(t)) return `Federal Decree-Law No. ${number} of ${year}`;
  if (/قانون اتحادي/.test(t)) return `Federal Law No. ${number} of ${year}`;
  if (/مرسوم اتحادي/.test(t)) return `Federal Decree No. ${number} of ${year}`;
  if (/قرار مجلس الوزراء/.test(t)) return `Cabinet Decision No. ${number} of ${year}`;
  if (/قرار وزاري/.test(t)) return `Ministerial Decision No. ${number} of ${year}`;
  if (/تعميم/.test(t)) return `Circular No. ${number} of ${year}`;
  if (/لائحة/.test(t)) return `Regulation No. ${number} of ${year}`;
  if (/نظام/.test(t)) return `System/Bylaw No. ${number} of ${year}`;
  if (/دستور/.test(t)) return `Constitution of the UAE`;
  return `Decision No. ${number} of ${year}`;
}

/**
 * Parse provisions from elaws.moj.gov.ae HTML content.
 * The HTML uses CSS class names for structural elements and Arabic text.
 * Articles are marked with المادة (after entity decoding).
 */
export function parseElawsHtml(
  html: string,
  law: FederalLawEntry,
): ParsedDocument {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  // First, decode all entities in the full HTML for regex matching
  const decoded = decodeEntities(html);

  // Detect language from content
  const isArabic = /المادة/.test(decoded) || /\p{Script=Arabic}/u.test(decoded);
  const language = isArabic ? 'ar' : 'en';

  let currentChapter = '';

  // Extract chapter/part markers from decoded text
  // Common patterns: الباب (Part), الفصل (Chapter)
  const chapterPattern = /(?:الباب|الفصل)\s+([\u0600-\u06FF\s\d]+?)(?=<|المادة|\n)/g;

  // Extract articles: المادة followed by article number in Arabic or Latin digits
  // The elaws format has articles in <div> blocks with Anchor references
  const articlePattern = /المادة\s*\(?\s*(\d+)\s*\)?\s*([\s\S]*?)(?=المادة\s*\(?\s*\d+|<\/body>|$)/g;

  let articleMatch: RegExpExecArray | null;
  while ((articleMatch = articlePattern.exec(decoded)) !== null) {
    const articleNum = articleMatch[1];
    const rawContent = articleMatch[2];

    // Update current chapter from content before this article
    const beforeArticle = decoded.substring(0, articleMatch.index);
    let lastChapter: RegExpExecArray | null = null;
    let chapMatch: RegExpExecArray | null;
    const chapterScan = /(?:الباب|الفصل)\s+([\u0600-\u06FF\s\d]+?)(?=<|المادة|\n)/g;
    while ((chapMatch = chapterScan.exec(beforeArticle)) !== null) {
      lastChapter = chapMatch;
    }
    if (lastChapter) {
      currentChapter = stripHtml(lastChapter[0]).trim();
    }

    // Extract title: content between المادة N) and the first paragraph break or div
    // Often the first bold text or first line after the article reference
    const titleMatch = rawContent.match(/<[^>]*>([^<]{3,80})<\/[^>]*>/);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';

    const content = stripHtml(rawContent);

    if (content.length > 5) {
      provisions.push({
        provision_ref: `art${articleNum}`,
        chapter: currentChapter || undefined,
        section: articleNum,
        title,
        content: content.substring(0, 12000),
        language,
      });
    }

    // Extract definitions from articles labeled تعريفات (Definitions) or containing definition patterns
    if (/تعريفات|تعاريف|التعريفات/.test(rawContent) || /\bdefinitions?\b/i.test(rawContent)) {
      // Arabic definition pattern: "term": definition ending with period
      const defPattern = /["\u201C]([^"\u201D]{2,60})["\u201D]\s*[:：]\s*([^.]{5,}\.)/g;

      let defMatch: RegExpExecArray | null;
      const defContent = stripHtml(rawContent);
      while ((defMatch = defPattern.exec(defContent)) !== null) {
        const term = defMatch[1].trim();
        const definition = defMatch[2].trim();
        if (term && definition.length > 3) {
          definitions.push({
            term,
            definition: `\u201C${term}\u201D: ${definition}`.substring(0, 4000),
            source_provision: `art${articleNum}`,
          });
        }
      }
    }
  }

  // If no articles found with المادة, try English Article pattern
  if (provisions.length === 0) {
    const enArticlePattern = /Article\s*\(?\s*(\d+)\s*\)?\s*([\s\S]*?)(?=Article\s*\(?\s*\d+|<\/body>|$)/gi;
    let enMatch: RegExpExecArray | null;
    while ((enMatch = enArticlePattern.exec(decoded)) !== null) {
      const articleNum = enMatch[1];
      const rawContent = enMatch[2];

      const titleMatch = rawContent.match(/<(?:strong|b|h\d)[^>]*>([^<]+)<\/(?:strong|b|h\d)>/i);
      const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';

      const content = stripHtml(rawContent);

      if (content.length > 5) {
        provisions.push({
          provision_ref: `art${articleNum}`,
          section: articleNum,
          title,
          content: content.substring(0, 12000),
          language: 'en',
        });
      }
    }
  }

  // If still no provisions, try to extract any structural content via Anchor divs
  if (provisions.length === 0) {
    // Fall back: extract content by div blocks with Anchors
    const anchorPattern = /<a\s+name="Anchor(\d+)"[^>]*><\/a>\s*([\s\S]*?)(?=<a\s+name="Anchor|<\/body>|$)/gi;
    let anchorMatch: RegExpExecArray | null;
    let secNum = 0;
    while ((anchorMatch = anchorPattern.exec(decoded)) !== null) {
      const rawContent = anchorMatch[2];
      const content = stripHtml(rawContent);
      if (content.length > 20) {
        secNum++;
        provisions.push({
          provision_ref: `s${secNum}`,
          section: String(secNum),
          title: content.substring(0, 80),
          content: content.substring(0, 12000),
          language,
        });
      }
    }
  }

  // Deduplicate provisions by provision_ref (keep longest content)
  const byRef = new Map<string, ParsedProvision>();
  for (const prov of provisions) {
    const existing = byRef.get(prov.provision_ref);
    if (!existing || prov.content.length > existing.content.length) {
      byRef.set(prov.provision_ref, prov);
    }
  }

  // Deduplicate definitions by term
  const byTerm = new Map<string, ParsedDefinition>();
  for (const def of definitions) {
    const existing = byTerm.get(def.term);
    if (!existing || def.definition.length > existing.definition.length) {
      byTerm.set(def.term, def);
    }
  }

  return {
    id: law.id,
    type: 'statute',
    title: law.title,
    title_en: law.titleEn,
    short_name: law.shortName,
    status: law.status,
    issued_date: law.issuedDate,
    in_force_date: law.inForceDate,
    url: law.url,
    legal_zone: 'federal',
    language,
    provisions: Array.from(byRef.values()),
    definitions: Array.from(byTerm.values()),
  };
}

// ============================================================
// Legacy Federal Law Parser (kept for compatibility)
// ============================================================

/**
 * Parse provisions from federal law HTML content.
 * This is the legacy parser for moj.gov.ae (non-elaws) content.
 */
export function parseFederalLawHtml(
  html: string,
  law: FederalLawEntry,
): ParsedDocument {
  // Delegate to the new elaws parser which handles both formats
  return parseElawsHtml(html, law);
}

// ============================================================
// DIFC Law Parser
// ============================================================

export interface DifcLawEntry {
  id: string;
  title: string;
  shortName: string;
  lawNumber: number;
  year: number;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
}

/**
 * Parse provisions from DIFC law HTML content.
 * DIFC laws are in English and use Article/Section numbering.
 */
export function parseDifcLawHtml(
  html: string,
  law: DifcLawEntry,
): ParsedDocument {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];
  let currentChapter = '';

  const articlePattern = /(?:Article|Section)\s*(\d+[A-Za-z]*)\s*([\s\S]*?)(?=(?:Article|Section)\s*\d+[A-Za-z]*|$)/gi;

  let articleMatch: RegExpExecArray | null;
  while ((articleMatch = articlePattern.exec(html)) !== null) {
    const articleNum = articleMatch[1];
    const rawContent = articleMatch[2];

    const beforeArticle = html.substring(0, articleMatch.index);
    const chapPattern = /(?:Part|Chapter)\s+(\d+[A-Za-z]*)\s*[-\u2013:]\s*(.+?)(?=<|$)/gi;
    let lastChap: RegExpExecArray | null = null;
    let cm: RegExpExecArray | null;
    while ((cm = chapPattern.exec(beforeArticle)) !== null) {
      lastChap = cm;
    }
    if (lastChap) {
      currentChapter = stripHtml(lastChap[0]).trim();
    }

    const titleMatch = rawContent.match(/<(?:strong|b|h\d)[^>]*>([^<]+)<\/(?:strong|b|h\d)>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';

    const content = stripHtml(rawContent);

    if (content.length > 5) {
      provisions.push({
        provision_ref: `art${articleNum}`,
        chapter: currentChapter || undefined,
        section: articleNum,
        title,
        content: content.substring(0, 12000),
        language: 'en',
      });
    }

    if (/\bdefinitions?\b/i.test(rawContent)) {
      const defPattern = /["\u201C]([^"\u201D]+)["\u201D]\s*(?:means?|includes?|has the meaning)\s+([\s\S]*?)(?=["\u201C]|$)/gi;
      let defMatch: RegExpExecArray | null;
      while ((defMatch = defPattern.exec(rawContent)) !== null) {
        const term = stripHtml(defMatch[1]).trim();
        const definition = stripHtml(defMatch[2]).trim();
        if (term && definition.length > 3) {
          definitions.push({
            term,
            definition: `\u201C${term}\u201D ${definition}`.substring(0, 4000),
            source_provision: `art${articleNum}`,
          });
        }
      }
    }
  }

  const byRef = new Map<string, ParsedProvision>();
  for (const prov of provisions) {
    const existing = byRef.get(prov.provision_ref);
    if (!existing || prov.content.length > existing.content.length) {
      byRef.set(prov.provision_ref, prov);
    }
  }

  const byTerm = new Map<string, ParsedDefinition>();
  for (const def of definitions) {
    const existing = byTerm.get(def.term);
    if (!existing || def.definition.length > existing.definition.length) {
      byTerm.set(def.term, def);
    }
  }

  return {
    id: law.id,
    type: 'statute',
    title: law.title,
    title_en: law.title,
    short_name: law.shortName,
    status: law.status,
    issued_date: law.issuedDate,
    in_force_date: law.inForceDate,
    url: law.url,
    legal_zone: 'difc',
    language: 'en',
    provisions: Array.from(byRef.values()),
    definitions: Array.from(byTerm.values()),
  };
}

// ============================================================
// ADGM Regulation Parser
// ============================================================

export interface AdgmRegulationEntry {
  id: string;
  title: string;
  shortName: string;
  regulationType: string;
  year: number;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
}

/**
 * Parse provisions from ADGM regulation HTML content.
 * ADGM uses Section/Rule numbering (English only).
 */
export function parseAdgmRegulationHtml(
  html: string,
  regulation: AdgmRegulationEntry,
): ParsedDocument {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];
  let currentChapter = '';

  const sectionPattern = /(?:Section|Rule|Regulation)\s*(\d+[A-Za-z]*)\s*([\s\S]*?)(?=(?:Section|Rule|Regulation)\s*\d+[A-Za-z]*|$)/gi;

  let sectionMatch: RegExpExecArray | null;
  while ((sectionMatch = sectionPattern.exec(html)) !== null) {
    const sectionNum = sectionMatch[1];
    const rawContent = sectionMatch[2];

    const beforeSection = html.substring(0, sectionMatch.index);
    const chapPattern = /(?:Part|Chapter|Division)\s+(\d+[A-Za-z]*)\s*[-\u2013:]\s*(.+?)(?=<|$)/gi;
    let lastChap: RegExpExecArray | null = null;
    let cm: RegExpExecArray | null;
    while ((cm = chapPattern.exec(beforeSection)) !== null) {
      lastChap = cm;
    }
    if (lastChap) {
      currentChapter = stripHtml(lastChap[0]).trim();
    }

    const titleMatch = rawContent.match(/<(?:strong|b|h\d)[^>]*>([^<]+)<\/(?:strong|b|h\d)>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';

    const content = stripHtml(rawContent);

    if (content.length > 5) {
      provisions.push({
        provision_ref: `s${sectionNum}`,
        chapter: currentChapter || undefined,
        section: sectionNum,
        title,
        content: content.substring(0, 12000),
        language: 'en',
      });
    }

    if (/\bdefinitions?\b/i.test(rawContent)) {
      const defPattern = /["\u201C]([^"\u201D]+)["\u201D]\s*(?:means?|includes?|has the meaning)\s+([\s\S]*?)(?=["\u201C]|$)/gi;
      let defMatch: RegExpExecArray | null;
      while ((defMatch = defPattern.exec(rawContent)) !== null) {
        const term = stripHtml(defMatch[1]).trim();
        const definition = stripHtml(defMatch[2]).trim();
        if (term && definition.length > 3) {
          definitions.push({
            term,
            definition: `\u201C${term}\u201D ${definition}`.substring(0, 4000),
            source_provision: `s${sectionNum}`,
          });
        }
      }
    }
  }

  const byRef = new Map<string, ParsedProvision>();
  for (const prov of provisions) {
    const existing = byRef.get(prov.provision_ref);
    if (!existing || prov.content.length > existing.content.length) {
      byRef.set(prov.provision_ref, prov);
    }
  }

  const byTerm = new Map<string, ParsedDefinition>();
  for (const def of definitions) {
    const existing = byTerm.get(def.term);
    if (!existing || def.definition.length > existing.definition.length) {
      byTerm.set(def.term, def);
    }
  }

  return {
    id: regulation.id,
    type: 'statute',
    title: regulation.title,
    title_en: regulation.title,
    short_name: regulation.shortName,
    status: regulation.status,
    issued_date: regulation.issuedDate,
    in_force_date: regulation.inForceDate,
    url: regulation.url,
    legal_zone: 'adgm',
    language: 'en',
    provisions: Array.from(byRef.values()),
    definitions: Array.from(byTerm.values()),
  };
}

// ============================================================
// Pre-configured lists (legacy — kept for backward compatibility)
// These are now populated dynamically by the ingest script.
// ============================================================

export const KEY_FEDERAL_LAWS: FederalLawEntry[] = [];
export const KEY_DIFC_LAWS: DifcLawEntry[] = [];
export const KEY_ADGM_REGULATIONS: AdgmRegulationEntry[] = [];
