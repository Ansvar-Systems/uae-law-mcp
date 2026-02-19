/**
 * HTML parser for UAE legislation from three sources.
 *
 * Federal laws (moj.gov.ae):
 *   - Arabic and English versions available
 *   - Articles marked with "المادة" (Arabic) or "Article" (English)
 *   - Document ID format: fdl-{number}-{year} (Federal Decree-Law),
 *     fl-{number}-{year} (Federal Law), cd-{number}-{year} (Cabinet Decision)
 *
 * DIFC laws (difclaws.com):
 *   - English only, common law format
 *   - Articles/sections numbered conventionally
 *   - Document ID format: difc-law-{number}-{year}
 *
 * ADGM regulations (adgm.com):
 *   - English only, regulation/rule numbering
 *   - Document ID format: adgm-{type}-{year} (e.g., adgm-dpr-2021)
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

/**
 * Decode HTML entities and strip tags, collapsing whitespace.
 * Preserves Arabic characters and diacritics.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#xA0;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8220;/g, '\u201C')
    .replace(/&#8221;/g, '\u201D')
    .replace(/\u200B/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

// ============================================================
// Federal Law Parser
// ============================================================

export interface FederalLawEntry {
  id: string;
  title: string;
  titleEn: string;
  shortName: string;
  type: 'fdl' | 'fl' | 'cd';
  number: number;
  year: number;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
}

/**
 * Parse provisions from federal law HTML content.
 * Federal laws use "المادة" (Article in Arabic) and "Article" in English.
 */
export function parseFederalLawHtml(
  html: string,
  law: FederalLawEntry,
): ParsedDocument {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];
  let currentChapter = '';

  // Detect language from content
  const isArabic = /المادة/.test(html);
  const language = isArabic ? 'ar' : 'en';

  // Extract chapters/parts: common patterns in UAE federal law HTML
  const chapterPattern = isArabic
    ? /(?:الباب|الفصل)\s+([\u0600-\u06FF\s]+)/g
    : /(?:Chapter|Part)\s+(\d+[A-Za-z]*)\s*[-–:]\s*(.+?)(?=<|$)/gi;

  // Extract articles
  const articlePattern = isArabic
    ? /المادة\s*\(?\s*(\d+)\s*\)?\s*([\s\S]*?)(?=المادة\s*\(?\s*\d+|$)/g
    : /Article\s*\(?\s*(\d+)\s*\)?\s*([\s\S]*?)(?=Article\s*\(?\s*\d+|$)/g;

  let articleMatch: RegExpExecArray | null;
  while ((articleMatch = articlePattern.exec(html)) !== null) {
    const articleNum = articleMatch[1];
    const rawContent = articleMatch[2];

    // Update current chapter from content before this article
    const beforeArticle = html.substring(0, articleMatch.index);
    let lastChapter: RegExpExecArray | null = null;
    let chapMatch: RegExpExecArray | null;
    const chapterScan = isArabic
      ? /(?:الباب|الفصل)\s+([\u0600-\u06FF\s]+)/g
      : /(?:Chapter|Part)\s+(\d+[A-Za-z]*)\s*[-–:]\s*(.+?)(?=<|$)/gi;
    while ((chapMatch = chapterScan.exec(beforeArticle)) !== null) {
      lastChapter = chapMatch;
    }
    if (lastChapter) {
      currentChapter = stripHtml(lastChapter[0]).trim();
    }

    // Extract title: first line or bold text within the article content
    const titleMatch = rawContent.match(isArabic
      ? /<[^>]*>([^<]*)<\/[^>]*>/
      : /<(?:strong|b|h\d)[^>]*>([^<]+)<\/(?:strong|b|h\d)>/i
    );
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

    // Extract definitions from articles typically labeled "Definitions" or "تعريفات"
    if (isArabic ? /تعريفات|تعاريف/.test(rawContent) : /\bdefinitions?\b/i.test(rawContent)) {
      const defPattern = isArabic
        ? /["\u201C]([^"\u201D]+)["\u201D]\s*[:：]\s*([^.]+\.)/g
        : /["\u201C]([^"\u201D]+)["\u201D]\s*(?:means?|includes?|has the meaning)\s+([\s\S]*?)(?=["\u201C]|$)/gi;

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

  // Deduplicate provisions by provision_ref
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

  // Extract description from long title or preamble
  const descMatch = html.match(isArabic
    ? /<[^>]*class="[^"]*(?:long-title|preamble)[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i
    : /<[^>]*class="[^"]*(?:long-title|preamble|subtitle)[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i
  );
  const description = descMatch ? stripHtml(descMatch[1]) : undefined;

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
    description,
    legal_zone: 'federal',
    language,
    provisions: Array.from(byRef.values()),
    definitions: Array.from(byTerm.values()),
  };
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

  // Extract articles/sections: DIFC uses "Article N" format
  const articlePattern = /(?:Article|Section)\s*(\d+[A-Za-z]*)\s*([\s\S]*?)(?=(?:Article|Section)\s*\d+[A-Za-z]*|$)/gi;

  let articleMatch: RegExpExecArray | null;
  while ((articleMatch = articlePattern.exec(html)) !== null) {
    const articleNum = articleMatch[1];
    const rawContent = articleMatch[2];

    // Update chapter tracking
    const beforeArticle = html.substring(0, articleMatch.index);
    const chapPattern = /(?:Part|Chapter)\s+(\d+[A-Za-z]*)\s*[-–:]\s*(.+?)(?=<|$)/gi;
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

    // Extract definitions
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

  // Deduplicate
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

  // Extract sections/rules: ADGM uses "Section N" or "Rule N" format
  const sectionPattern = /(?:Section|Rule|Regulation)\s*(\d+[A-Za-z]*)\s*([\s\S]*?)(?=(?:Section|Rule|Regulation)\s*\d+[A-Za-z]*|$)/gi;

  let sectionMatch: RegExpExecArray | null;
  while ((sectionMatch = sectionPattern.exec(html)) !== null) {
    const sectionNum = sectionMatch[1];
    const rawContent = sectionMatch[2];

    // Update chapter tracking
    const beforeSection = html.substring(0, sectionMatch.index);
    const chapPattern = /(?:Part|Chapter|Division)\s+(\d+[A-Za-z]*)\s*[-–:]\s*(.+?)(?=<|$)/gi;
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

    // Extract definitions
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

  // Deduplicate
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
// Pre-configured lists of key UAE laws to ingest
// ============================================================

export const KEY_FEDERAL_LAWS: FederalLawEntry[] = [
  {
    id: 'fdl-45-2021',
    title: 'المرسوم بقانون اتحادي رقم 45 لسنة 2021 بشأن حماية البيانات الشخصية',
    titleEn: 'Federal Decree-Law No. 45 of 2021 on Personal Data Protection',
    shortName: 'PDPL',
    type: 'fdl',
    number: 45,
    year: 2021,
    status: 'in_force',
    issuedDate: '2021-09-20',
    inForceDate: '2022-01-02',
    url: 'https://moj.gov.ae/en/legislation/federal-decree-law-45-2021',
  },
  {
    id: 'fdl-34-2021',
    title: 'المرسوم بقانون اتحادي رقم 34 لسنة 2021 في شأن مكافحة الشائعات والجرائم الإلكترونية',
    titleEn: 'Federal Decree-Law No. 34 of 2021 on Combatting Rumours and Cybercrimes',
    shortName: 'Cybercrimes Law',
    type: 'fdl',
    number: 34,
    year: 2021,
    status: 'in_force',
    issuedDate: '2021-09-20',
    inForceDate: '2022-01-02',
    url: 'https://moj.gov.ae/en/legislation/federal-decree-law-34-2021',
  },
  {
    id: 'fdl-46-2021',
    title: 'المرسوم بقانون اتحادي رقم 46 لسنة 2021 بشأن المعاملات الإلكترونية وخدمات الثقة',
    titleEn: 'Federal Decree-Law No. 46 of 2021 on Electronic Transactions and Trust Services',
    shortName: 'ETA',
    type: 'fdl',
    number: 46,
    year: 2021,
    status: 'in_force',
    issuedDate: '2021-09-20',
    inForceDate: '2022-01-02',
    url: 'https://moj.gov.ae/en/legislation/federal-decree-law-46-2021',
  },
  {
    id: 'fl-2-2015',
    title: 'القانون الاتحادي رقم 2 لسنة 2015 بشأن الشركات التجارية',
    titleEn: 'Federal Law No. 2 of 2015 on Commercial Companies',
    shortName: 'Companies Law',
    type: 'fl',
    number: 2,
    year: 2015,
    status: 'in_force',
    issuedDate: '2015-03-01',
    inForceDate: '2015-07-01',
    url: 'https://moj.gov.ae/en/legislation/federal-law-2-2015',
  },
  {
    id: 'constitution-1971',
    title: 'دستور دولة الإمارات العربية المتحدة',
    titleEn: 'Constitution of the United Arab Emirates',
    shortName: 'Constitution',
    type: 'fl',
    number: 0,
    year: 1971,
    status: 'in_force',
    issuedDate: '1971-12-02',
    inForceDate: '1971-12-02',
    url: 'https://moj.gov.ae/en/legislation/uae-constitution',
  },
  {
    id: 'fl-3-2003',
    title: 'القانون الاتحادي رقم 3 لسنة 2003 بشأن تنظيم قطاع الاتصالات',
    titleEn: 'Federal Law No. 3 of 2003 on Telecommunications Regulation',
    shortName: 'Telecom Law',
    type: 'fl',
    number: 3,
    year: 2003,
    status: 'in_force',
    issuedDate: '2003-01-01',
    inForceDate: '2003-01-01',
    url: 'https://moj.gov.ae/en/legislation/federal-law-3-2003',
  },
];

export const KEY_DIFC_LAWS: DifcLawEntry[] = [
  {
    id: 'difc-law-5-2020',
    title: 'DIFC Data Protection Law, DIFC Law No. 5 of 2020',
    shortName: 'DIFC DPL',
    lawNumber: 5,
    year: 2020,
    status: 'in_force',
    issuedDate: '2020-07-01',
    inForceDate: '2020-07-01',
    url: 'https://www.difclaws.com/laws-and-regulations/data-protection',
  },
  {
    id: 'difc-law-3-2006',
    title: 'DIFC Companies Law, DIFC Law No. 3 of 2006 (as amended)',
    shortName: 'DIFC Companies Law',
    lawNumber: 3,
    year: 2006,
    status: 'in_force',
    issuedDate: '2006-09-25',
    inForceDate: '2006-09-25',
    url: 'https://www.difclaws.com/laws-and-regulations/companies',
  },
  {
    id: 'difc-law-4-2004',
    title: 'DIFC Employment Law, DIFC Law No. 4 of 2004 (as amended)',
    shortName: 'DIFC Employment Law',
    lawNumber: 4,
    year: 2004,
    status: 'in_force',
    issuedDate: '2004-09-28',
    inForceDate: '2004-09-28',
    url: 'https://www.difclaws.com/laws-and-regulations/employment',
  },
  {
    id: 'difc-law-1-2004',
    title: 'DIFC Arbitration Law, DIFC Law No. 1 of 2004 (as amended)',
    shortName: 'DIFC Arbitration Law',
    lawNumber: 1,
    year: 2004,
    status: 'in_force',
    issuedDate: '2004-09-28',
    inForceDate: '2004-09-28',
    url: 'https://www.difclaws.com/laws-and-regulations/arbitration',
  },
];

export const KEY_ADGM_REGULATIONS: AdgmRegulationEntry[] = [
  {
    id: 'adgm-dpr-2021',
    title: 'ADGM Data Protection Regulations 2021',
    shortName: 'ADGM DPR',
    regulationType: 'regulations',
    year: 2021,
    status: 'in_force',
    issuedDate: '2021-02-14',
    inForceDate: '2021-02-14',
    url: 'https://adgm.com/legal-framework/data-protection',
  },
  {
    id: 'adgm-cr-2020',
    title: 'ADGM Companies Regulations 2020',
    shortName: 'ADGM Companies Regs',
    regulationType: 'regulations',
    year: 2020,
    status: 'in_force',
    issuedDate: '2020-01-01',
    inForceDate: '2020-01-01',
    url: 'https://adgm.com/legal-framework/companies',
  },
  {
    id: 'adgm-er-2019',
    title: 'ADGM Employment Regulations 2019',
    shortName: 'ADGM Employment Regs',
    regulationType: 'regulations',
    year: 2019,
    status: 'in_force',
    issuedDate: '2019-01-01',
    inForceDate: '2019-01-01',
    url: 'https://adgm.com/legal-framework/employment',
  },
  {
    id: 'adgm-fsmr-2015',
    title: 'ADGM Financial Services and Markets Regulations 2015',
    shortName: 'ADGM FSMR',
    regulationType: 'regulations',
    year: 2015,
    status: 'in_force',
    issuedDate: '2015-10-21',
    inForceDate: '2015-10-21',
    url: 'https://adgm.com/legal-framework/financial-services',
  },
];
