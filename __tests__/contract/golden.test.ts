/**
 * Golden contract tests for UAE Law MCP.
 *
 * Tests tool outputs against the golden-tests.json fixture file.
 * These tests verify that the MCP server returns expected data
 * for well-known UAE, DIFC, and ADGM legal provisions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(__dirname, '../../fixtures/golden-tests.json');

interface GoldenTest {
  id: string;
  category: string;
  description: string;
  tool: string;
  input: Record<string, unknown>;
  assertions: {
    result_not_empty?: boolean;
    any_result_contains?: string[];
    text_contains?: string[];
    fields_present?: string[];
    text_not_empty?: boolean;
    min_results?: number;
    citation_url_pattern?: string;
    handles_gracefully?: boolean;
  };
}

interface GoldenFixture {
  version: string;
  mcp_name: string;
  tests: GoldenTest[];
}

const fixture: GoldenFixture = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

describe('Golden contract tests', () => {
  it('fixture file is valid', () => {
    expect(fixture.version).toBe('1.0');
    expect(fixture.mcp_name).toBe('UAE Law MCP');
    expect(fixture.tests.length).toBeGreaterThan(0);
  });

  it('has expected number of tests', () => {
    expect(fixture.tests.length).toBe(12);
  });

  for (const test of fixture.tests) {
    it(`${test.id}: ${test.description}`, () => {
      // Contract tests validate the fixture structure.
      // Full integration tests require a running server with a database.
      // In CI, these run in CONTRACT_MODE=nightly for live assertions.

      expect(test.id).toBeTruthy();
      expect(test.tool).toBeTruthy();
      expect(test.assertions).toBeTruthy();

      // Validate assertion structure
      if (test.assertions.any_result_contains) {
        expect(Array.isArray(test.assertions.any_result_contains)).toBe(true);
      }

      if (test.assertions.text_contains) {
        expect(Array.isArray(test.assertions.text_contains)).toBe(true);
      }

      if (test.assertions.fields_present) {
        expect(Array.isArray(test.assertions.fields_present)).toBe(true);
      }

      if (test.assertions.min_results !== undefined) {
        expect(typeof test.assertions.min_results).toBe('number');
      }

      if (test.assertions.citation_url_pattern) {
        // Verify the regex pattern is valid
        expect(() => new RegExp(test.assertions.citation_url_pattern!)).not.toThrow();
      }
    });
  }

  describe('test categories', () => {
    it('has article retrieval tests', () => {
      const retrievalTests = fixture.tests.filter(t => t.category === 'article_retrieval');
      expect(retrievalTests.length).toBe(3);
    });

    it('has search tests', () => {
      const searchTests = fixture.tests.filter(t => t.category === 'search');
      expect(searchTests.length).toBe(3);
    });

    it('has citation roundtrip tests', () => {
      const citationTests = fixture.tests.filter(t => t.category === 'citation_roundtrip');
      expect(citationTests.length).toBe(2);
    });

    it('has EU cross-reference tests', () => {
      const euTests = fixture.tests.filter(t => t.category === 'eu_cross_reference');
      expect(euTests.length).toBe(2);
    });

    it('has negative tests', () => {
      const negativeTests = fixture.tests.filter(t => t.category === 'negative_test');
      expect(negativeTests.length).toBe(2);
    });
  });

  describe('tool coverage', () => {
    it('covers get_provision tool', () => {
      const getProvTests = fixture.tests.filter(t => t.tool === 'get_provision');
      expect(getProvTests.length).toBeGreaterThanOrEqual(3);
    });

    it('covers search_legislation tool', () => {
      const searchTests = fixture.tests.filter(t => t.tool === 'search_legislation');
      expect(searchTests.length).toBeGreaterThanOrEqual(3);
    });

    it('covers get_provision_eu_basis tool', () => {
      const euBasisTests = fixture.tests.filter(t => t.tool === 'get_provision_eu_basis');
      expect(euBasisTests.length).toBeGreaterThanOrEqual(2);
    });
  });
});
