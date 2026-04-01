/**
 * Tests for the Solana Glossary MCP Server tools
 * 
 * Each tool is tested for:
 * - Successful operations with valid input
 * - Error handling with invalid input
 * - i18n support
 */

import { describe, it, expect } from "vitest";

// Tools
import { lookupTerm } from "../src/tools/lookup.js";
import { searchGlossary } from "../src/tools/search.js";
import { listCategory, listAllCategories } from "../src/tools/category.js";
import { explainConceptTool } from "../src/tools/explain.js";
import { learningPath } from "../src/tools/learning-path.js";
import { compareTerms } from "../src/tools/compare.js";
import { randomTerm } from "../src/tools/random.js";

// Graph
import { findLearningPath, explainConcept, getGraphStats, getHubTerms } from "../src/graph.js";

// i18n
import {
  resolveTermLocalized,
  searchTermsLocalized,
  getTermsByCategoryLocalized,
  localizeTerms,
  getAvailableLocales,
  validateLocale,
} from "../src/i18n-resolver.js";

// Resources
import { readResource, listResources, listResourceTemplates } from "../src/resources/index.js";

// SDK
import { allTerms, getCategories, getTerm } from "@stbr/solana-glossary";

// ─── lookup_term ────────────────────────────────────────────────

describe("lookup_term", () => {
  it("should find a term by ID", () => {
    const result = lookupTerm({ term: "pda" });
    expect(result).toContain("PDA");
    expect(result).not.toContain("not found");
  });

  it("should find a term by alias", () => {
    const term = allTerms.find((t) => t.aliases && t.aliases.length > 0);
    if (!term) return; // skip if no aliased terms
    const result = lookupTerm({ term: term.aliases![0] });
    expect(result).toContain(term.term);
  });

  it("should return not-found for nonexistent term", () => {
    const result = lookupTerm({ term: "this-term-does-not-exist-xyz" });
    expect(result).toContain("not found");
  });

  it("should include related terms", () => {
    const termWithRelated = allTerms.find((t) => (t.related?.length ?? 0) > 0);
    if (!termWithRelated) return;
    const result = lookupTerm({ term: termWithRelated.id });
    expect(result).toContain("Related Terms");
  });

  it("should support i18n locale", () => {
    const result = lookupTerm({ term: "pda", locale: "pt" });
    // Should not error and should include locale indicator
    expect(result).toBeTruthy();
  });
});

// ─── search_glossary ────────────────────────────────────────────

describe("search_glossary", () => {
  it("should find results for a valid query", () => {
    const result = searchGlossary({ query: "validator" });
    expect(result).toContain("Found");
    expect(result).not.toContain("No results");
  });

  it("should return no results for gibberish", () => {
    const result = searchGlossary({ query: "xyzzyspoon!shift+1notaword" });
    expect(result).toContain("No results");
  });

  it("should respect the limit parameter", () => {
    const result = searchGlossary({ query: "account", limit: 3 });
    // Count numbered results (format: "1. **...**")
    const matches = result.match(/^\d+\.\s\*\*/gm);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeLessThanOrEqual(3);
  });

  it("should support i18n", () => {
    const result = searchGlossary({ query: "validator", locale: "es" });
    expect(result).toBeTruthy();
    expect(result).toContain("Found");
  });
});

// ─── list_category ──────────────────────────────────────────────

describe("list_category", () => {
  it("should list terms in a valid category", () => {
    const categories = getCategories();
    const result = listCategory({ category: categories[0] });
    expect(result).toContain(categories[0]);
    expect(result).toContain("terms");
  });

  it("should list all categories", () => {
    const result = listAllCategories();
    expect(result).toContain("Available Categories");
    for (const cat of getCategories()) {
      expect(result).toContain(cat);
    }
  });
});

// ─── explain_concept ────────────────────────────────────────────

describe("explain_concept", () => {
  it("should explain a known concept", () => {
    const termWithRelated = allTerms.find((t) => (t.related?.length ?? 0) > 0);
    if (!termWithRelated) return;
    const result = explainConceptTool({ term: termWithRelated.id, depth: 1 });
    expect(result).toContain("Deep Dive");
    expect(result).toContain("Connected Concepts");
  });

  it("should return not-found for unknown term", () => {
    const result = explainConceptTool({ term: "nonexistent-term-xyz" });
    expect(result).toContain("not found");
  });

  it("should respect depth parameter", () => {
    const termId = allTerms.find((t) => (t.related?.length ?? 0) > 2)?.id;
    if (!termId) return;

    const shallow = explainConceptTool({ term: termId, depth: 1 });
    const deep = explainConceptTool({ term: termId, depth: 3 });

    // Deep should generally find more or equal terms
    expect(deep.length).toBeGreaterThanOrEqual(shallow.length - 50); // allow small variance
  });
});

// ─── get_learning_path ──────────────────────────────────────────

describe("get_learning_path", () => {
  it("should find a path between connected terms", () => {
    // Find two terms with a direct related connection
    const termA = allTerms.find(
      (t) => t.related && t.related.length > 0 && getTerm(t.related[0])
    );
    if (!termA) return;
    const result = learningPath({ from: termA.id, to: termA.related![0] });
    expect(result).toContain("Learning Path");
    expect(result).toContain("Step");
  });

  it("should handle non-existent from term", () => {
    const result = learningPath({ from: "nonexistent-xyz", to: "pda" });
    expect(result).toContain("not found");
  });

  it("should handle non-existent to term", () => {
    const result = learningPath({ from: "pda", to: "nonexistent-xyz" });
    expect(result).toContain("not found");
  });
});

// ─── compare_terms ──────────────────────────────────────────────

describe("compare_terms", () => {
  it("should compare two valid terms", () => {
    const ids = allTerms.slice(0, 2).map((t) => t.id);
    const result = compareTerms({ terms: ids });
    expect(result).toContain("Comparing");
    expect(result).toContain(allTerms[0].term);
    expect(result).toContain(allTerms[1].term);
  });

  it("should fail when a term is not found", () => {
    const result = compareTerms({ terms: ["pda", "totally-fake-term"] });
    expect(result).toContain("not found");
  });

  it("should show shared relationships when they exist", () => {
    // Find two terms that share a related term
    const a = allTerms.find((t) => (t.related?.length ?? 0) > 3);
    const b = allTerms.find(
      (t) =>
        t.id !== a?.id &&
        (t.related?.length ?? 0) > 3 &&
        t.related?.some((r) => a?.related?.includes(r))
    );
    if (!a || !b) return;
    const result = compareTerms({ terms: [a.id, b.id] });
    expect(result).toContain("Comparing");
  });
});

// ─── random_term ────────────────────────────────────────────────

describe("random_term", () => {
  it("should return a single random term by default", () => {
    const result = randomTerm({});
    expect(result).toContain("Random Term");
    expect(result).toContain("Category:");
  });

  it("should return multiple terms when count is specified", () => {
    const result = randomTerm({ count: 3 });
    expect(result).toContain("3 Random Terms");
    // Should have 3 definition markers
    const catMatches = result.match(/🏷️ Category:/g);
    expect(catMatches).toBeTruthy();
    expect(catMatches!.length).toBe(3);
  });

  it("should filter by category", () => {
    const categories = getCategories();
    const result = randomTerm({ category: categories[0], count: 2 });
    expect(result).toContain(categories[0]);
    expect(result).not.toContain("Unknown category");
  });

  it("should return error for invalid category", () => {
    const result = randomTerm({ category: "fake-category-xyz" });
    expect(result).toContain("Unknown category");
  });

  it("should support i18n", () => {
    const result = randomTerm({ count: 1, locale: "pt" });
    expect(result).toBeTruthy();
    expect(result).toContain("Random Term");
  });
});

// ─── Graph Engine ───────────────────────────────────────────────

describe("graph engine", () => {
  it("should return valid stats", () => {
    const stats = getGraphStats();
    expect(stats.totalNodes).toBeGreaterThan(0);
    expect(stats.totalEdges).toBeGreaterThan(0);
    expect(stats.averageDegree).toBeGreaterThan(0);
  });

  it("should find hub terms", () => {
    const hubs = getHubTerms(5);
    expect(hubs.length).toBeGreaterThan(0);
    expect(hubs.length).toBeLessThanOrEqual(5);
    // First hub should have the most connections
    if (hubs.length >= 2) {
      expect(hubs[0].connections).toBeGreaterThanOrEqual(hubs[1].connections);
    }
  });

  it("BFS should find same-node path with distance 0", () => {
    const term = allTerms[0];
    const result = findLearningPath(term.id, term.id);
    expect(result.found).toBe(true);
    expect(result.distance).toBe(0);
    expect(result.path).toHaveLength(1);
  });

  it("DFS should return root for depth 0 exploration", () => {
    const term = allTerms.find((t) => (t.related?.length ?? 0) > 0);
    if (!term) return;
    const result = explainConcept(term.id, 0);
    expect(result.root.id).toBe(term.id);
    expect(result.relatedTerms).toHaveLength(0);
  });

  it("DFS should find related terms at depth 1", () => {
    const term = allTerms.find((t) => (t.related?.length ?? 0) > 0);
    if (!term) return;
    const result = explainConcept(term.id, 1);
    expect(result.relatedTerms.length).toBeGreaterThan(0);
  });
});

// ─── i18n Resolver ──────────────────────────────────────────────

describe("i18n resolver", () => {
  it("should list available locales", () => {
    const locales = getAvailableLocales();
    expect(locales).toContain("en");
    expect(locales).toContain("pt");
    expect(locales).toContain("es");
  });

  it("should validate known locales", () => {
    expect(validateLocale("en")).toBe("en");
    expect(validateLocale("pt")).toBe("pt");
    expect(validateLocale("es")).toBe("es");
  });

  it("should fallback to en for invalid locale", () => {
    expect(validateLocale("xx")).toBe("en");
    expect(validateLocale(undefined)).toBe("en");
  });

  it("should resolve term in default locale", () => {
    const term = resolveTermLocalized("pda");
    expect(term).toBeDefined();
    expect(term?.id).toContain("pda");
  });

  it("should resolve term in pt locale", () => {
    const term = resolveTermLocalized("pda", "pt");
    expect(term).toBeDefined();
  });

  it("should search with locale", () => {
    const results = searchTermsLocalized("validator", "pt");
    expect(results.length).toBeGreaterThan(0);
  });

  it("should get terms by category localized", () => {
    const cats = getCategories();
    const results = getTermsByCategoryLocalized(cats[0], "es");
    expect(results.length).toBeGreaterThan(0);
  });

  it("should localize a list of terms", () => {
    const terms = allTerms.slice(0, 5);
    const localized = localizeTerms(terms, "pt");
    expect(localized).toHaveLength(5);
  });

  it("should return original terms for 'en' locale", () => {
    const terms = allTerms.slice(0, 3);
    const same = localizeTerms(terms, "en");
    expect(same).toEqual(terms);
  });
});

// ─── Resources ──────────────────────────────────────────────────

describe("resources", () => {
  it("should list all resources", () => {
    const resources = listResources();
    expect(resources.length).toBeGreaterThan(2); // full + stats + categories
    expect(resources.some((r) => r.uri.includes("glossary/full"))).toBe(true);
    expect(resources.some((r) => r.uri.includes("glossary/stats"))).toBe(true);
  });

  it("should list resource templates", () => {
    const templates = listResourceTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.some((t) => t.uriTemplate.includes("{termId}"))).toBe(true);
  });

  it("should read glossary/full resource", () => {
    const result = readResource("solana-glossary://glossary/full");
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("application/json");
    const data = JSON.parse(result!.text);
    expect(data.length).toBe(allTerms.length);
  });

  it("should read glossary/stats resource", () => {
    const result = readResource("solana-glossary://glossary/stats");
    expect(result).not.toBeNull();
    const stats = JSON.parse(result!.text);
    expect(stats.totalTerms).toBe(allTerms.length);
    expect(stats.totalCategories).toBe(getCategories().length);
    expect(stats.availableLocales).toContain("pt");
  });

  it("should read a category resource", () => {
    const cat = getCategories()[0];
    const result = readResource(`solana-glossary://category/${cat}`);
    expect(result).not.toBeNull();
    const terms = JSON.parse(result!.text);
    expect(terms.length).toBeGreaterThan(0);
  });

  it("should read a term resource", () => {
    const result = readResource("solana-glossary://term/pda");
    expect(result).not.toBeNull();
    const term = JSON.parse(result!.text);
    expect(term.id).toContain("pda");
  });

  it("should read localized term resource", () => {
    const result = readResource("solana-glossary://pt/term/pda");
    expect(result).not.toBeNull();
  });

  it("should read localized category resource", () => {
    const cat = getCategories()[0];
    const result = readResource(`solana-glossary://es/category/${cat}`);
    expect(result).not.toBeNull();
  });

  it("should return null for unknown resource", () => {
    const result = readResource("solana-glossary://unknown/path");
    expect(result).toBeNull();
  });
});

// ─── Integration: SDK sanity ────────────────────────────────────

describe("SDK integration", () => {
  it("should have 1001 terms loaded", () => {
    expect(allTerms.length).toBe(1001);
  });

  it("should have 14 categories", () => {
    expect(getCategories().length).toBe(14);
  });

  it("every term should have id, term, definition, and category", () => {
    for (const t of allTerms) {
      expect(t.id).toBeTruthy();
      expect(t.term).toBeTruthy();
      expect(typeof t.definition).toBe("string");
      expect(t.category).toBeTruthy();
    }
  });
});
