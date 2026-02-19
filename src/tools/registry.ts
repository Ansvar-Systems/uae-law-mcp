/**
 * Tool registry for UAE Law MCP Server.
 * Shared between stdio (index.ts) and HTTP (api/mcp.ts) entry points.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type Database from 'node-sqlite3-wasm';

import { searchLegislation, type SearchLegislationInput } from './search-legislation.js';
import { getProvision, type GetProvisionInput } from './get-provision.js';
import { validateCitationTool, type ValidateCitationInput } from './validate-citation.js';
import { buildLegalStance, type BuildLegalStanceInput } from './build-legal-stance.js';
import { formatCitationTool, type FormatCitationInput } from './format-citation.js';
import { checkCurrency, type CheckCurrencyInput } from './check-currency.js';
import { getEUBasis, type GetEUBasisInput } from './get-eu-basis.js';
import { getUAEImplementations, type GetUAEImplementationsInput } from './get-uae-implementations.js';
import { searchEUImplementations, type SearchEUImplementationsInput } from './search-eu-implementations.js';
import { getProvisionEUBasis, type GetProvisionEUBasisInput } from './get-provision-eu-basis.js';
import { validateEUCompliance, type ValidateEUComplianceInput } from './validate-eu-compliance.js';
import { listSources } from './list-sources.js';
import { getAbout, type AboutContext } from './about.js';
import { detectCapabilities, upgradeMessage } from '../capabilities.js';
export type { AboutContext } from './about.js';

const ABOUT_TOOL: Tool = {
  name: 'about',
  description:
    'Server metadata, dataset statistics, freshness, and provenance. ' +
    'Call this to verify data coverage, currency, and content basis before relying on results. ' +
    'Includes details about the UAE three-layer legal system (federal, DIFC, ADGM).',
  inputSchema: { type: 'object', properties: {} },
};

const LIST_SOURCES_TOOL: Tool = {
  name: 'list_sources',
  description:
    'Returns detailed provenance metadata for all data sources used by this server, ' +
    'including UAE Ministry of Justice, DIFC Laws (difclaws.com), and ADGM Legal Framework. ' +
    'Use this to understand what data is available, its authority, coverage scope, and known limitations. ' +
    'Also returns dataset statistics (document counts, provision counts) and database build timestamp. ' +
    'Call this FIRST when you need to understand what UAE legal data this server covers.',
  inputSchema: { type: 'object', properties: {} },
};

export const TOOLS: Tool[] = [
  {
    name: 'search_legislation',
    description:
      'Search UAE federal laws, DIFC laws, and ADGM regulations by keyword using full-text search (FTS5 with BM25 ranking). ' +
      'Returns matching provisions with document context, snippets with >>> <<< markers around matched terms, and relevance scores. ' +
      'Supports FTS5 syntax: quoted phrases ("exact match"), boolean operators (AND, OR, NOT), and prefix wildcards (term*). ' +
      'Supports both Arabic and English queries. Results span all three legal zones (federal, DIFC, ADGM). ' +
      'Default limit is 10 results. For broad topics, increase the limit. ' +
      'Use the legal_zone parameter to filter results to federal, difc, or adgm only. ' +
      'Do NOT use this for retrieving a known provision — use get_provision instead.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query in Arabic or English. Supports FTS5 syntax: ' +
            '"personal data" for exact phrase, term* for prefix.',
        },
        document_id: {
          type: 'string',
          description: 'Optional: filter results to a specific law by its document ID.',
        },
        status: {
          type: 'string',
          enum: ['in_force', 'amended', 'repealed'],
          description: 'Optional: filter by legislative status.',
        },
        legal_zone: {
          type: 'string',
          enum: ['federal', 'difc', 'adgm'],
          description: 'Optional: filter by legal zone (federal, difc, adgm).',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10, max: 50).',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_provision',
    description:
      'Retrieve the full text of a specific provision (article/section) from a UAE federal law, DIFC law, or ADGM regulation. ' +
      'Specify a document_id (law title, abbreviation, or internal ID) and optionally an article, section, or provision_ref. ' +
      'Omit article/section/provision_ref to get ALL provisions in the law (use sparingly — can be large). ' +
      'Returns provision text, chapter, article/section number, and metadata. ' +
      'Supports law title references (e.g., "Federal Decree-Law No. 45/2021 on Personal Data Protection"), ' +
      'abbreviations (e.g., "PDPL"), and document IDs (e.g., "fdl-45-2021"). ' +
      'Federal laws use "Article" numbering; DIFC/ADGM use "Section" numbering. ' +
      'Use this when you know WHICH provision you want. For discovery, use search_legislation instead.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description:
            'Law identifier: law title (e.g., "Federal Decree-Law No. 45/2021 on Personal Data Protection"), ' +
            'abbreviation (e.g., "PDPL", "DIFC DPL"), or internal document ID (e.g., "fdl-45-2021").',
        },
        article: {
          type: 'string',
          description: 'Article number for federal laws (e.g., "2", "26"). Omit to get all provisions.',
        },
        section: {
          type: 'string',
          description: 'Section number for DIFC/ADGM laws (e.g., "2", "5A"). Alternative to article.',
        },
        provision_ref: {
          type: 'string',
          description: 'Direct provision reference (e.g., "art2", "s5"). Alternative to article/section.',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'validate_citation',
    description:
      'Validate a UAE legal citation against the database — zero-hallucination check. ' +
      'Parses the citation, checks that the document and provision exist, and returns warnings about status ' +
      '(repealed, amended). Use this to verify any citation BEFORE including it in a legal analysis. ' +
      'Supports formats: "Article 2, Federal Decree-Law No. 45 of 2021", ' +
      '"Article 1, DIFC Law No. 5 of 2020", "المادة 2 من المرسوم بقانون اتحادي رقم 45 لسنة 2021", ' +
      '"Art. 2, PDPL 2021", "fdl-45-2021, art. 2".',
    inputSchema: {
      type: 'object',
      properties: {
        citation: {
          type: 'string',
          description:
            'Citation string to validate. Examples: "Article 2, Federal Decree-Law No. 45/2021", ' +
            '"Article 1, DIFC Data Protection Law No. 5/2020", "fdl-45-2021, art. 2".',
        },
      },
      required: ['citation'],
    },
  },
  {
    name: 'build_legal_stance',
    description:
      'Build a comprehensive set of citations for a legal question by searching across all UAE federal, ' +
      'DIFC, and ADGM legislation simultaneously. Returns aggregated results from multiple relevant provisions. ' +
      'Use this for broad legal questions like "What are the penalties for data breaches in the UAE?" ' +
      'rather than looking up a specific known provision. Can filter by legal_zone.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Legal question or topic to research (e.g., "data breach notification", "cybercrime penalties").',
        },
        document_id: {
          type: 'string',
          description: 'Optional: limit search to one law by document ID.',
        },
        legal_zone: {
          type: 'string',
          enum: ['federal', 'difc', 'adgm'],
          description: 'Optional: limit search to one legal zone.',
        },
        limit: {
          type: 'number',
          description: 'Max results per category (default: 5, max: 20).',
          default: 5,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'format_citation',
    description:
      'Format a UAE legal citation per standard conventions. ' +
      'Three formats: "full" (formal, e.g., "Article 2, Federal Decree-Law No. 45 of 2021 on Personal Data Protection"), ' +
      '"short" (abbreviated, e.g., "Art. 2, PDPL 2021"), "pinpoint" (article reference only, e.g., "Art. 2"). ' +
      'Automatically detects whether to use "Article" (federal) or "Section" (DIFC/ADGM).',
    inputSchema: {
      type: 'object',
      properties: {
        citation: { type: 'string', description: 'Citation string to format.' },
        format: {
          type: 'string',
          enum: ['full', 'short', 'pinpoint'],
          description: 'Output format (default: "full").',
          default: 'full',
        },
      },
      required: ['citation'],
    },
  },
  {
    name: 'check_currency',
    description:
      'Check whether a UAE law, DIFC law, or ADGM regulation is currently in force, amended, repealed, or not yet in force. ' +
      'Returns the document status, issued date, in-force date, legal zone, and warnings. ' +
      'Essential before citing any provision — always verify currency.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Law identifier (law title, abbreviation, or internal ID).',
        },
        provision_ref: {
          type: 'string',
          description: 'Optional: provision reference to check a specific article/section.',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_eu_basis',
    description:
      'Get the EU/international legal basis that a UAE law aligns with or references. ' +
      'The UAE is not an EU member but many UAE laws align with EU regulations ' +
      '(e.g., PDPL aligns with GDPR, DIFC DPL closely modeled on GDPR, ETA aligns with eIDAS). ' +
      'Returns EU/international document identifiers, reference types, and implementation status.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: 'UAE law identifier.' },
        include_articles: {
          type: 'boolean',
          description: 'Include specific EU article references (default: false).',
          default: false,
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_uae_implementations',
    description:
      'Find all UAE laws (federal, DIFC, ADGM) that align with or implement a specific EU directive or regulation. ' +
      'Given an EU document ID (e.g., "regulation:2016/679" for GDPR), returns matching UAE laws. ' +
      'Note: UAE implements international standards through autonomous alignment, not EU transposition.',
    inputSchema: {
      type: 'object',
      properties: {
        eu_document_id: {
          type: 'string',
          description: 'EU document ID (e.g., "regulation:2016/679" for GDPR, "regulation:910/2014" for eIDAS).',
        },
        primary_only: {
          type: 'boolean',
          description: 'Return only primary implementing laws (default: false).',
          default: false,
        },
        in_force_only: {
          type: 'boolean',
          description: 'Return only currently in-force laws (default: false).',
          default: false,
        },
      },
      required: ['eu_document_id'],
    },
  },
  {
    name: 'search_eu_implementations',
    description:
      'Search for EU directives and regulations that have UAE implementing/aligning legislation. ' +
      'Search by keyword, type (directive/regulation), or year range.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword search across EU document titles.' },
        type: { type: 'string', enum: ['directive', 'regulation'], description: 'Filter by EU document type.' },
        year_from: { type: 'number', description: 'Filter by year (from).' },
        year_to: { type: 'number', description: 'Filter by year (to).' },
        has_uae_implementation: {
          type: 'boolean',
          description: 'If true, only return EU documents with UAE aligning legislation.',
        },
        limit: { type: 'number', description: 'Max results (default: 20, max: 100).', default: 20 },
      },
    },
  },
  {
    name: 'get_provision_eu_basis',
    description:
      'Get the EU/international legal basis for a SPECIFIC provision within a UAE law, DIFC law, or ADGM regulation. ' +
      'More granular than get_eu_basis (which operates at the law level). ' +
      'Use this for pinpoint EU/international compliance checks at the provision level.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: 'UAE law identifier.' },
        provision_ref: { type: 'string', description: 'Provision reference (e.g., "art2" or "2" or "s5").' },
      },
      required: ['document_id', 'provision_ref'],
    },
  },
  {
    name: 'validate_eu_compliance',
    description:
      'Check EU/international alignment status for a UAE law, DIFC law, or ADGM regulation. ' +
      'Detects references to repealed EU directives, missing alignment status, outdated references. ' +
      'Returns compliance status (compliant, partial, unclear, not_applicable) with warnings.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: 'UAE law identifier.' },
        provision_ref: { type: 'string', description: 'Optional: check for a specific provision.' },
        eu_document_id: { type: 'string', description: 'Optional: check against a specific EU document.' },
      },
      required: ['document_id'],
    },
  },
];

export function buildTools(
  db?: InstanceType<typeof Database>,
  context?: AboutContext,
): Tool[] {
  const tools = [...TOOLS, LIST_SOURCES_TOOL];

  if (db) {
    try {
      db.prepare('SELECT 1 FROM definitions LIMIT 1').get();
      // Could add a get_definitions tool here when definitions table exists
    } catch {
      // definitions table doesn't exist
    }
  }

  if (context) {
    tools.push(ABOUT_TOOL);
  }

  return tools;
}

export function registerTools(
  server: Server,
  db: InstanceType<typeof Database>,
  context?: AboutContext,
): void {
  const allTools = buildTools(db, context);

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: allTools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case 'search_legislation':
          result = await searchLegislation(db, args as unknown as SearchLegislationInput);
          break;
        case 'get_provision':
          result = await getProvision(db, args as unknown as GetProvisionInput);
          break;
        case 'validate_citation':
          result = await validateCitationTool(db, args as unknown as ValidateCitationInput);
          break;
        case 'build_legal_stance':
          result = await buildLegalStance(db, args as unknown as BuildLegalStanceInput);
          break;
        case 'format_citation':
          result = await formatCitationTool(args as unknown as FormatCitationInput);
          break;
        case 'check_currency':
          result = await checkCurrency(db, args as unknown as CheckCurrencyInput);
          break;
        case 'get_eu_basis':
          result = await getEUBasis(db, args as unknown as GetEUBasisInput);
          break;
        case 'get_uae_implementations':
          result = await getUAEImplementations(db, args as unknown as GetUAEImplementationsInput);
          break;
        case 'search_eu_implementations':
          result = await searchEUImplementations(db, args as unknown as SearchEUImplementationsInput);
          break;
        case 'get_provision_eu_basis':
          result = await getProvisionEUBasis(db, args as unknown as GetProvisionEUBasisInput);
          break;
        case 'validate_eu_compliance':
          result = await validateEUCompliance(db, args as unknown as ValidateEUComplianceInput);
          break;
        case 'list_sources':
          result = await listSources(db);
          break;
        case 'about':
          if (context) {
            result = getAbout(db, context);
          } else {
            return {
              content: [{ type: 'text' as const, text: 'About tool not configured.' }],
              isError: true,
            };
          }
          break;
        default:
          return {
            content: [{ type: 'text' as const, text: `Error: Unknown tool "${name}".` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });
}
