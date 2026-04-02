/**
 * suggest_terms — Smart term suggestions with fuzzy matching
 * 
 * When a user misspells or partially types a term,
 * this provides intelligent suggestions.
 */

import { z } from "zod";
import { allTerms, type GlossaryTerm } from "@stbr/solana-glossary";
import { fuzzySearch } from "../../utils/fuzzy.js";
import { getTermExample } from "../../data/glossary-index.js";
import { validateLocale, localizeTerms } from "../../i18n-resolver.js";

export const suggestTermsSchema = z.object({
  query: z.string().describe("Partial or misspelled term to get suggestions for"),
  limit: z.number().min(1).max(20).optional().describe("Max suggestions (default: 5)"),
  locale: z.enum(["en", "pt", "es"]).optional().describe("Language for results. Defaults to 'en'."),
});

export type SuggestTermsInput = z.infer<typeof suggestTermsSchema>;

export function suggestTerms(input: SuggestTermsInput): string {
  const locale = validateLocale(input.locale);
  const limit = input.limit ?? 5;

  const matches = fuzzySearch(
    input.query,
    allTerms,
    (term) => [
      term.term,
      term.id,
      ...(term.aliases ?? []),
    ],
    { threshold: 0.25, limit }
  );

  if (matches.length === 0) {
    return [
      `💡 No suggestions found for "${input.query}".`,
      ``,
      `Try:`,
      `• Use 'search_glossary' for broader full-text search`,
      `• Use 'semantic_search' for natural language queries`,
      `• Use 'random_term' to discover terms`,
    ].join("\n");
  }

  const localizedTerms = localizeTerms(matches.map(m => m.item), locale);

  const lines = [
    `💡 **Suggestions for "${input.query}"** (${matches.length} found):`,
    ``,
  ];

  for (let i = 0; i < localizedTerms.length; i++) {
    const t = localizedTerms[i];
    const match = matches[i];
    const score = Math.round(match.score * 100);
    const typeLabel = match.matchType === "exact" ? "✅" : match.matchType === "prefix" ? "🔤" : match.matchType === "contains" ? "📝" : "🔍";
    
    const defPreview = t.definition.substring(0, 100) + (t.definition.length > 100 ? "…" : "");
    lines.push(`${typeLabel} **${t.term}** (${score}% match) [${t.category}]`);
    lines.push(`   ${defPreview}`);

    // Add example if available
    const example = getTermExample(t.id);
    if (example) {
      lines.push(`   🏷️ Tags: ${example.tags.join(", ")}`);
    }
    lines.push(``);
  }

  lines.push(`_Use 'lookup_term' with any of these terms for full details._`);

  return lines.join("\n");
}
