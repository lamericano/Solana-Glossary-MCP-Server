/**
 * semantic_search — Natural language search over the glossary
 * 
 * Uses TF-IDF embeddings with cosine similarity to find
 * conceptually relevant terms from natural language queries.
 */

import { z } from "zod";
import { semanticSearch as search, getIndexStats } from "../../services/embeddings.js";
import { localizeTerms, validateLocale } from "../../i18n-resolver.js";
import { getTermExample } from "../../data/glossary-index.js";

export const semanticSearchSchema = z.object({
  query: z.string().describe("Natural language query (e.g., 'how does Solana achieve fast consensus?' or 'token swap mechanism')"),
  limit: z.number().min(1).max(30).optional().describe("Max results (default: 10)"),
  locale: z.enum(["en", "pt", "es"]).optional().describe("Language for results. Defaults to 'en'."),
});

export type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;

export function semanticSearchTool(input: SemanticSearchInput): string {
  const locale = validateLocale(input.locale);
  const limit = input.limit ?? 10;

  const results = search(input.query, limit);

  if (results.length === 0) {
    return [
      `🧠 No semantically relevant terms found for "${input.query}".`,
      ``,
      `Try:`,
      `• Rephrase with different keywords`,
      `• Use 'search_glossary' for exact text matching`,
      `• Use 'suggest_terms' for fuzzy spelling matches`,
    ].join("\n");
  }

  const terms = localizeTerms(results.map(r => r.term), locale);

  const lines = [
    `🧠 **Semantic Search: "${input.query}"**`,
    `📊 ${results.length} relevant terms (ranked by similarity):`,
    ``,
  ];

  for (let i = 0; i < terms.length; i++) {
    const t = terms[i];
    const score = (results[i].score * 100).toFixed(1);
    const defPreview = t.definition.substring(0, 120) + (t.definition.length > 120 ? "…" : "");

    lines.push(`${i + 1}. **${t.term}** — ${score}% relevant [${t.category}]`);
    lines.push(`   ${defPreview}`);

    const example = getTermExample(t.id);
    if (example) {
      lines.push(`   🏷️ ${example.tags.join(", ")}`);
    }
    lines.push(``);
  }

  const stats = getIndexStats();
  lines.push(`---`);
  lines.push(`_Searched across ${stats.totalTerms} indexed terms (${stats.totalTokens} unique tokens)._`);

  return lines.join("\n");
}
