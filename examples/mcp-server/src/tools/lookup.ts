/**
 * lookup_term — Look up a Solana term by ID or alias
 * Enhanced with practical examples and tags.
 */

import { z } from "zod";
import { resolveTermLocalized, validateLocale } from "../i18n-resolver.js";
import { getTerm, type GlossaryTerm } from "@stbr/solana-glossary";
import { getTermExample } from "../data/glossary-index.js";

export const lookupTermSchema = z.object({
  term: z.string().describe("The term ID, name, or alias to look up (e.g., 'pda', 'Proof of History', 'PoH')"),
  locale: z.enum(["en", "pt", "es"]).optional().describe("Language for the response. Defaults to 'en'. Use 'pt' for Portuguese or 'es' for Spanish."),
});

export type LookupTermInput = z.infer<typeof lookupTermSchema>;

export function lookupTerm(input: LookupTermInput): string {
  const locale = validateLocale(input.locale);
  const term = resolveTermLocalized(input.term, locale);

  if (!term) {
    return [
      `❌ Term "${input.term}" not found.`,
      ``,
      `💡 Try:`,
      `• 'suggest_terms' for fuzzy spelling suggestions`,
      `• 'search_glossary' for full-text search`,
      `• 'semantic_search' for natural language queries`,
    ].join("\n");
  }

  // Resolve related terms for richer context
  const relatedDetails: string[] = [];
  for (const relId of term.related ?? []) {
    const rel = resolveTermLocalized(relId, locale);
    if (rel) {
      relatedDetails.push(`  • ${rel.term}: ${rel.definition.substring(0, 100)}${rel.definition.length > 100 ? "…" : ""}`);
    }
  }

  const parts = [
    `📖 **${term.term}**`,
    ``,
    `${term.definition}`,
    ``,
    `🏷️ Category: ${term.category}`,
  ];

  if (term.aliases && term.aliases.length > 0) {
    parts.push(`🔤 Aliases: ${term.aliases.join(", ")}`);
  }

  if (relatedDetails.length > 0) {
    parts.push(``, `🔗 Related Terms:`, ...relatedDetails);
  }

  // Add practical example if available
  const example = getTermExample(term.id);
  if (example) {
    parts.push(``, `💡 Practical Example:`, example.example);
    parts.push(`🏷️ Tags: ${example.tags.join(", ")}`);
  }

  if (locale !== "en") {
    parts.push(``, `🌐 Language: ${locale === "pt" ? "Português" : "Español"}`);
  }

  return parts.join("\n");
}
