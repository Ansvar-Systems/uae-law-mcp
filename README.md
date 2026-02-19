# UAE Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/uae-law-mcp)](https://www.npmjs.com/package/@ansvar/uae-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/uae-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/uae-law-mcp/actions/workflows/ci.yml)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green)](https://registry.modelcontextprotocol.io/)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/Ansvar-Systems/uae-law-mcp)](https://securityscorecards.dev/viewer/?uri=github.com/Ansvar-Systems/uae-law-mcp)

A Model Context Protocol (MCP) server providing comprehensive access to United Arab Emirates legislation, including federal data protection (PDPL), cybercrimes, electronic transactions, commercial companies law, and DIFC/ADGM free zone data protection frameworks with full-text search.

## Deployment Tier

**SMALL** -- Single tier, bundled SQLite database shipped with the npm package.

**Estimated database size:** ~80-150 MB (full corpus of UAE federal legislation plus DIFC and ADGM free zone laws)

## Key Legislation Covered

| Law | Year | Significance |
|-----|------|-------------|
| **Federal Decree-Law No. 45/2021 (PDPL)** | 2021 | Comprehensive Personal Data Protection Law; overarching federal framework; UAE Data Office supervises implementation |
| **Federal Decree-Law No. 34/2021** | 2021 | Combatting Rumours and Cybercrimes; replaced the 2012 cybercrimes law with expanded digital offences |
| **Federal Decree-Law No. 46/2021** | 2021 | Electronic Transactions and Trust Services; governs e-signatures, e-commerce, and digital trust services |
| **Federal Law No. 2/2015** | 2015 | Commercial Companies Law; primary corporate governance framework |
| **DIFC Data Protection Law (Law No. 5/2020)** | 2020 | DIFC-specific data protection regime; common-law framework closely modeled on GDPR |
| **ADGM Data Protection Regulations 2021** | 2021 | ADGM-specific data protection regime; common-law framework aligned with international standards |
| **UAE Constitution** | 1971 (amended) | Foundational law establishing the federation of the emirates |

## Regulatory Context

- **Federal Data Protection:** UAE Data Office oversees PDPL (Federal Decree-Law No. 45/2021), effective January 2, 2022
- **DIFC:** Independent common-law jurisdiction in Dubai with its own courts, regulator (Commissioner of Data Protection), and data protection law
- **ADGM:** Independent common-law jurisdiction in Abu Dhabi with its own courts, regulator, and data protection regulations
- **Multi-layered system:** Federal law applies across all emirates; DIFC and ADGM have separate legal frameworks within their free zones
- **Language:** Arabic is the official legal language for federal law; DIFC and ADGM laws are drafted natively in English
- **TDRA (Telecommunications and Digital Government Regulatory Authority):** Regulates ICT sector
- **Critical for Middle East market expansion** and cross-border data transfer compliance

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [UAE Ministry of Justice](https://moj.gov.ae) | Ministry of Justice, UAE | HTML Scrape | Monthly | Government Open Data | Federal Decree-Laws, Federal Laws, Cabinet Decisions, implementing regulations |
| [DIFC Laws](https://difclaws.com) | Dubai International Financial Centre | HTML Scrape | On Change | Government Open Data | DIFC Data Protection Law, DIFC Companies Law, all DIFC regulations |
| [ADGM Legal Framework](https://adgm.com/legal-framework) | Abu Dhabi Global Market | HTML Scrape | On Change | Government Open Data | ADGM Data Protection Regulations, ADGM Companies Regulations, all ADGM rules |
| [WAM (Emirates News Agency)](https://www.wam.ae) | Emirates News Agency | HTML Scrape | Weekly | Government Publication | Gazette notices, legislative announcements |

> Full provenance metadata: [`sources.yml`](./sources.yml)

## Installation

```bash
npm install -g @ansvar/uae-law-mcp
```

## Usage

### As stdio MCP server

```bash
uae-law-mcp
```

### In Claude Desktop / MCP client configuration

```json
{
  "mcpServers": {
    "uae-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/uae-law-mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_provision` | Retrieve a specific article from a UAE federal law, DIFC law, or ADGM regulation |
| `search_legislation` | Full-text search across all UAE, DIFC, and ADGM legislation |
| `get_provision_eu_basis` | Cross-reference lookup for international framework relationships (GDPR, eIDAS, etc.) |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run contract tests
npm run test:contract

# Run all validation
npm run validate

# Build database from sources
npm run build:db

# Start server
npm start
```

## Contract Tests

This MCP includes 12 golden contract tests covering:
- 3 article retrieval tests (PDPL, Cybercrimes Law, DIFC Data Protection Law)
- 3 search tests (personal data, cybercrime, electronic transaction)
- 2 citation roundtrip tests (moj.gov.ae and difclaws.com URL patterns)
- 2 cross-reference tests (PDPL to GDPR, DIFC DPL to GDPR)
- 2 negative tests (non-existent law, malformed article)

Run with: `npm run test:contract`

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability disclosure policy.

Report data errors: [Open an issue](https://github.com/Ansvar-Systems/uae-law-mcp/issues/new?template=data-error.md)

## License

Apache-2.0 -- see [LICENSE](./LICENSE)

---

Built by [Ansvar Systems](https://ansvar.eu) -- Cybersecurity compliance through AI-powered analysis.
