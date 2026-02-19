# UAE Law MCP Server — Developer Guide

## Git Workflow

- **Never commit directly to `main`.** Always create a feature branch and open a Pull Request.
- Branch protection requires: verified signatures, PR review, and status checks to pass.
- Use conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, etc.

## Project Overview

UAE Law MCP server providing Arabic and English UAE federal legislation, DIFC (Dubai) laws, and ADGM (Abu Dhabi) regulations search via Model Context Protocol. Strategy A deployment (Vercel, bundled SQLite DB).

## Architecture

- **Transport:** Dual-channel — stdio (npm package) + Streamable HTTP (Vercel serverless)
- **Database:** SQLite + FTS5 via `node-sqlite3-wasm` (WASM-compatible, no WAL mode)
- **Entry points:** `src/index.ts` (stdio), `api/mcp.ts` (Vercel HTTP)
- **Tool registry:** `src/tools/registry.ts` — shared between both transports
- **Capability gating:** `src/capabilities.ts` — detects available DB tables at runtime

## Three-Layer Legal System

The UAE has a unique three-layer legal system:

1. **Federal** (moj.gov.ae): Federal Decree-Laws, Federal Laws, Cabinet Decisions
   - Arabic is the authoritative language; English translations are unofficial
   - Document IDs: `fdl-{n}-{year}`, `fl-{n}-{year}`, `cd-{n}-{year}`
   - Articles: `art1`, `art2`, etc.

2. **DIFC** (difclaws.com): Dubai International Financial Centre
   - Independent common-law jurisdiction within Dubai
   - English only (natively drafted in English)
   - Document IDs: `difc-law-{n}-{year}`
   - Articles: `art1`, `art2`, etc.

3. **ADGM** (adgm.com): Abu Dhabi Global Market
   - Independent common-law jurisdiction within Abu Dhabi
   - English only (natively drafted in English)
   - Document IDs: `adgm-{type}-{year}` (e.g., `adgm-dpr-2021`)
   - Sections: `s1`, `s2`, etc.

## Key Conventions

- All database queries use parameterized statements (never string interpolation)
- FTS5 queries go through `buildFtsQueryVariants()` with primary + fallback strategy
- User input is sanitized via `sanitizeFtsInput()` before FTS5 queries
- Every tool returns `ToolResponse<T>` with `results` + `_metadata` (freshness, disclaimer)
- Tool descriptions are written for LLM agents — explain WHEN and WHY to use each tool
- Capability-gated tools only appear in `tools/list` when their DB tables exist
- Federal laws use "Article" numbering — provision_ref prefix is "art" (e.g., "art2")
- DIFC laws use "Article" numbering — provision_ref prefix is "art" (e.g., "art1")
- ADGM regulations use "Section" numbering — provision_ref prefix is "s" (e.g., "s5")
- Citation formats vary by zone:
  - Federal: "Article 2, Federal Decree-Law No. 45 of 2021"
  - DIFC: "Article 1, DIFC Law No. 5 of 2020"
  - ADGM: "Section 1, ADGM Data Protection Regulations 2021"
  - Arabic: "المادة 2 من المرسوم بقانون اتحادي رقم 45 لسنة 2021"

## Testing

- Unit tests: `tests/` (vitest, in-memory SQLite fixtures)
- Contract tests: `__tests__/contract/golden.test.ts` with `fixtures/golden-tests.json`
- Nightly mode: `CONTRACT_MODE=nightly` enables network assertions
- Run: `npm test` (unit), `npm run test:contract` (golden), `npm run validate` (both)

## Database

- Schema defined inline in `scripts/build-db.ts`
- UAE-specific columns: `legal_zone` (federal/difc/adgm), `language` (ar/en)
- Journal mode: DELETE (not WAL — required for Vercel serverless)
- Runtime: copied to `/tmp/database.db` on Vercel cold start
- Metadata: `db_metadata` table stores tier, schema_version, built_at, builder, jurisdiction, source

## Data Pipeline

1. `scripts/ingest.ts` → fetches from 3 sources → JSON seed files in `data/seed/`
2. `scripts/build-db.ts` → seed JSON → SQLite database in `data/database.db`
3. `scripts/drift-detect.ts` → verifies upstream content hasn't changed

## Data Sources

- **UAE Ministry of Justice** (moj.gov.ae) — Federal legislation (Arabic + English)
- **DIFC Laws** (difclaws.com) — DIFC free zone laws (English)
- **ADGM Legal Framework** (adgm.com) — ADGM free zone regulations (English)
- **License:** Government Open Data (all 3 sources)

## Deployment

- Vercel Strategy A: DB bundled in `data/database.db`, included via `vercel.json` includeFiles
- npm package: `@ansvar/uae-law-mcp` with bin entry for stdio
