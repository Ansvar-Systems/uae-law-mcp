# UAE Law MCP Server

**The MOHRE / UAE Legislation Portal alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fuae-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/uae-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/uae-law-mcp?style=social)](https://github.com/Ansvar-Systems/uae-law-mcp)
[![CI](https://github.com/Ansvar-Systems/uae-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/uae-law-mcp/actions/workflows/ci.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](https://github.com/Ansvar-Systems/uae-law-mcp)
[![Provisions](https://img.shields.io/badge/provisions-113%2C230-blue)](https://github.com/Ansvar-Systems/uae-law-mcp)

Query **4,797 UAE federal laws and regulations** -- from the Personal Data Protection Law and Cybercrimes Law to the Federal Penal Code, Commercial Companies Law, and Electronic Transactions Law -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing UAE legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

UAE legal research means navigating mohre.gov.ae, legislation.gov.ae, uaelegislation.gov.ae, and free-zone portals like DIFC and ADGM separately. Whether you're:

- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking PDPL obligations or DIFC Data Protection Law requirements
- A **legal tech developer** building tools on UAE federal or free-zone law
- A **researcher** tracing provisions across 4,797 federal instruments

...you shouldn't need dozens of browser tabs and manual cross-referencing across Arabic and English sources. Ask Claude. Get the exact provision. With context.

This MCP server makes UAE law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://uae-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add uae-law --transport http https://uae-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "uae-law": {
      "type": "url",
      "url": "https://uae-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "uae-law": {
      "type": "http",
      "url": "https://uae-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/uae-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "uae-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/uae-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"البحث عن 'حماية البيانات الشخصية' في قانون رقم 45 لعام 2021"* (Search for "personal data protection" in Federal Decree-Law No. 45 of 2021)
- *"ما الذي يقوله قانون العقوبات الاتحادي بشأن جرائم المعلوماتية؟"* (What does the Federal Penal Code say about information crimes?)
- *"البحث عن أحكام قانون العمل الاتحادي بشأن عقود العمل"* (Search for provisions in the Federal Labour Law on employment contracts)
- *"What does the UAE PDPL (Federal Decree-Law No. 45 of 2021) say about data subject rights?"*
- *"Find provisions in the Cybercrimes Law about unauthorized access"*
- *"Is the Electronic Transactions Law still in force?"*
- *"Search for DIFC Data Protection Law provisions on consent"*
- *"Validate the citation Federal Decree-Law No. 45 of 2021, Article 12"*
- *"Build a legal stance on data localization requirements in UAE law"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Federal Laws & Regulations** | 4,797 instruments | Federal decrees, laws, cabinet resolutions |
| **Provisions** | 113,230 sections | Full-text searchable with FTS5 |
| **Coverage** | Federal + DIFC/ADGM | Federal law plus key free-zone data protection frameworks |
| **Data Source** | moj.gov.ae | UAE Ministry of Justice official source |
| **Database Size** | Optimized SQLite | Portable, pre-built |

**Verified data only** -- every citation is validated against official sources (UAE Ministry of Justice, legislation.gov.ae). Zero LLM-generated content.

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from moj.gov.ae, legislation.gov.ae, and official UAE government portals
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by decree/law number + article
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
MOJ / legislation.gov.ae --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                               ^                        ^
                        Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search legislation.gov.ae by decree number | Search in Arabic or English: *"حماية البيانات"* |
| Navigate multi-chapter laws manually | Get the exact provision with context |
| Manual cross-referencing between laws | `build_legal_stance` aggregates across sources |
| "Is this regulation still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find GCC alignment -- search separately | `get_eu_basis` -- linked international frameworks |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Search legislation.gov.ae --> Navigate Arabic/English law --> Ctrl+F --> Cross-reference with cabinet resolutions --> Check DIFC portal separately --> Repeat

**This MCP:** *"What are the consent requirements under the UAE PDPL and how do they compare to GDPR?"* --> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 113,230 provisions with BM25 ranking. Supports Arabic and English queries, quoted phrases, boolean operators |
| `get_provision` | Retrieve specific provision by decree/law number + article |
| `check_currency` | Check if a statute is in force, amended, or superseded |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple laws for a legal topic |
| `format_citation` | Format citations per UAE legal conventions |
| `list_sources` | List all available laws with metadata and coverage scope |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get international frameworks (GCC, GDPR comparisons) that a UAE law aligns with |
| `get_uae_implementations` | Find UAE laws corresponding to a specific international standard or framework |
| `search_eu_implementations` | Search international documents with UAE alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of UAE statutes against international frameworks |

---

## International Law Alignment

The UAE is not an EU member state, but UAE law has significant alignment with international data protection frameworks:

- **Federal Decree-Law No. 45 of 2021 (PDPL)** -- UAE's primary personal data protection law, with structural similarities to GDPR (data subject rights, controller obligations, cross-border transfer rules)
- **DIFC Data Protection Law** -- The DIFC (Dubai International Financial Centre) data protection regime has an [EU adequacy decision](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en) for transfers from the EU
- **ADGM Data Protection Regulations** -- Abu Dhabi Global Market data protection framework aligned with UK GDPR
- **GCC Framework** -- UAE participates in GCC harmonization efforts on e-commerce and data flows
- **Arab League** -- Member of regional frameworks on electronic transactions and cybercrime

The international alignment tools allow you to explore these relationships -- checking which UAE provisions correspond to GDPR requirements or GCC standards.

> **Note:** UAE cross-references reflect alignment relationships. The UAE operates its own independent legal system under federal and emirate-level law, plus separate free-zone jurisdictions. The EU tools identify comparative domains rather than formal transposition.

---

## Data Sources & Freshness

All content is sourced from authoritative UAE legal databases:

- **[UAE Ministry of Justice](https://moj.gov.ae)** -- Official federal legislation portal
- **[UAE Legislation Portal](https://legislation.gov.ae)** -- Consolidated federal laws and decrees
- **[DIFC Laws & Regulations](https://difc.ae/business/laws)** -- DIFC free-zone legislation
- **[ADGM](https://adgm.com/regulations)** -- Abu Dhabi Global Market regulations

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | UAE Ministry of Justice |
| **Retrieval method** | Official government portals |
| **Languages** | Arabic (primary), English (official translations) |
| **License** | UAE Government publications |
| **Coverage** | 4,797 federal instruments plus DIFC/ADGM key instruments |

### Automated Freshness Checks

A [GitHub Actions workflow](.github/workflows/check-updates.yml) monitors data sources for changes:

| Check | Method |
|-------|--------|
| **Statute amendments** | Drift detection against known provision anchors |
| **New decrees** | Comparison against official gazettes |
| **Repealed legislation** | Status change detection |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official UAE government publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources for court filings
> - **International cross-references** reflect alignment relationships, not formal equivalence
> - **Federal vs. emirate law** -- this covers federal legislation; emirate-specific laws (Dubai, Abu Dhabi, etc.) may apply in addition
> - **Free-zone law** -- DIFC and ADGM operate separate legal systems; confirm which jurisdiction applies

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. For professional use guidance, consult the **Abu Dhabi Bar Association** or **UAE Bar Association** professional conduct rules.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/uae-law-mcp
cd uae-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                        # Start MCP server
npx @anthropic/mcp-inspector node dist/server.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest            # Ingest statutes from UAE government portals
npm run build:db          # Rebuild SQLite database
npm run drift:detect      # Run drift detection against anchors
npm run check:freshness   # Check for amendments and new decrees
npm run check-updates     # Check for source updates
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Reliability:** 100% ingestion success rate
- **Languages:** Arabic and English queries supported

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/uae-law-mcp](https://github.com/Ansvar-Systems/uae-law-mcp) (This Project)
**Query 4,797 UAE federal laws and regulations** -- PDPL, Cybercrimes Law, Commercial Companies Law, Electronic Transactions Law, DIFC/ADGM frameworks. `npx @ansvar/uae-law-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**70+ national law MCPs** covering Australia, Brazil, Canada, Cameroon, Denmark, Finland, France, Germany, Ghana, India, Ireland, Israel, Italy, Japan, Netherlands, Nigeria, Norway, Singapore, Sweden, Switzerland, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Emirate-level legislation (Dubai DIFC updates, Abu Dhabi local laws)
- Court case law integration (Federal Supreme Court decisions)
- Arabic-optimized FTS5 morphological analysis
- Historical decree versions and amendment tracking
- ADGM regulation expansion

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] PDPL, Cybercrimes Law, Electronic Transactions Law
- [x] DIFC/ADGM data protection frameworks
- [x] International law alignment tools (GDPR comparison)
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Court case law (Federal Supreme Court)
- [ ] Emirate-level legislation
- [ ] Historical decree versions (amendment tracking)
- [ ] Arabic morphological analysis for FTS5
- [ ] ADGM regulation corpus expansion

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{uae_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {UAE Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/uae-law-mcp},
  note = {4,797 UAE federal laws with 113,230 provisions, DIFC/ADGM coverage}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Federal Legislation:** UAE Government publications (public access)
- **DIFC Laws:** DIFC Authority (publicly accessible)
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool for UAE law -- turns out everyone building for the Gulf market or navigating PDPL compliance has the same research frustrations.

So we're open-sourcing it. Navigating 4,797 federal instruments across Arabic and English shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
