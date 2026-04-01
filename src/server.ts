/**
 * Solana Glossary MCP Server
 * 
 * Exposes the @stbr/solana-glossary SDK as MCP tools, resources, and prompts
 * for intelligent Solana knowledge access from any LLM client.
 * 
 * Features:
 * - 7 tools: lookup, search, category, explain (graph DFS), learning-path (graph BFS), compare, random
 * - Resources: categories, terms, stats, full glossary (all navigable by URI)
 * - Resource templates: dynamic term + localized term/category lookups
 * - i18n: all tools and resources support pt-BR, es, and en
 * - Graph engine: BFS/DFS on term cross-references for deep exploration
 */

import { z } from "zod";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { allTerms, getCategories, getTerm } from "@stbr/solana-glossary";

// Tools
import { lookupTermSchema, lookupTerm } from "./tools/lookup.js";
import { searchGlossarySchema, searchGlossary } from "./tools/search.js";
import { listCategorySchema, listCategory } from "./tools/category.js";
import { explainConceptSchema, explainConceptTool } from "./tools/explain.js";
import { learningPathSchema, learningPath } from "./tools/learning-path.js";
import { compareTermsSchema, compareTerms } from "./tools/compare.js";
import { randomTermSchema, randomTerm } from "./tools/random.js";

// Resources
import { readResource } from "./resources/index.js";

// Graph stats
import { getGraphStats, getHubTerms } from "./graph.js";

// I18n
import {
  searchTermsLocalized,
  getTermsByCategoryLocalized,
  localizeTerms,
  validateLocale,
  getAvailableLocales,
} from "./i18n-resolver.js";

// ─── Server Setup ───────────────────────────────────────────────

const server = new McpServer({
  name: "solana-glossary",
  version: "1.0.0",
});

// ─── Tools ──────────────────────────────────────────────────────

server.tool(
  "lookup_term",
  "Look up a Solana term by ID, name, or alias. Returns the definition, category, aliases, and related terms. Supports i18n (en, pt, es).",
  lookupTermSchema.shape,
  async (input) => {
    const result = lookupTerm(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "search_glossary",
  "Full-text search across 1001 Solana terms. Searches names, definitions, IDs, and aliases. Returns ranked results with previews. Supports i18n.",
  searchGlossarySchema.shape,
  async (input) => {
    const result = searchGlossary(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "list_category",
  `List all terms in a specific category. Available categories: ${getCategories().join(", ")}. Supports i18n.`,
  listCategorySchema.shape,
  async (input) => {
    const result = listCategory(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "explain_concept",
  "Deep-dive into a Solana concept by exploring its knowledge graph. Uses DFS traversal to find related concepts up to N levels deep, grouped by category. Great for building comprehensive context around a topic.",
  explainConceptSchema.shape,
  async (input) => {
    const result = explainConceptTool(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "get_learning_path",
  "Find the shortest learning path between two Solana concepts. Uses BFS on the term relationship graph to create a step-by-step progression from a known concept to a new one.",
  learningPathSchema.shape,
  async (input) => {
    const result = learningPath(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "compare_terms",
  "Compare 2-5 Solana terms side by side. Shows definitions, categories, aliases, and analyzes shared relationships and category overlap.",
  compareTermsSchema.shape,
  async (input) => {
    const result = compareTerms(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "random_term",
  "Get random Solana glossary terms for discovery, exploration, or quiz generation. Optionally filter by category.",
  randomTermSchema.shape,
  async (input) => {
    const result = randomTerm(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Resources ──────────────────────────────────────────────────

server.resource(
  "glossary-full",
  "solana-glossary://glossary/full",
  { mimeType: "application/json", description: `Complete Solana Glossary — all ${allTerms.length} terms` },
  async (uri) => {
    const result = readResource(uri.href);
    if (!result) return { contents: [] };
    return { contents: [result] };
  }
);

server.resource(
  "glossary-stats",
  "solana-glossary://glossary/stats",
  { mimeType: "application/json", description: "Glossary statistics — term counts, categories, relationship density" },
  async (uri) => {
    const result = readResource(uri.href);
    if (!result) return { contents: [] };
    return { contents: [result] };
  }
);

// Register each category as a resource
for (const cat of getCategories()) {
  server.resource(
    `category-${cat}`,
    `solana-glossary://category/${cat}`,
    { mimeType: "application/json", description: `Terms in the ${cat} category` },
    async (uri) => {
      const result = readResource(uri.href);
      if (!result) return { contents: [] };
      return { contents: [result] };
    }
  );
}

// ─── Resource Templates ─────────────────────────────────────────

// Dynamic term lookup by ID
server.resource(
  "term-by-id",
  new ResourceTemplate("solana-glossary://term/{termId}", {
    list: async () => ({
      resources: allTerms.map((t) => ({
        uri: `solana-glossary://term/${t.id}`,
        name: t.term,
        description: t.definition.substring(0, 100),
        mimeType: "application/json",
      })),
    }),
    complete: {
      termId: (value) => {
        const q = value.toLowerCase();
        return allTerms
          .filter((t) => t.id.startsWith(q) || t.term.toLowerCase().startsWith(q))
          .slice(0, 20)
          .map((t) => t.id);
      },
    },
  }),
  { mimeType: "application/json", description: "Look up any Solana glossary term by its ID" },
  async (uri, variables) => {
    const result = readResource(uri.href);
    if (!result) return { contents: [] };
    return { contents: [result] };
  }
);

// Localized term lookup
server.resource(
  "localized-term",
  new ResourceTemplate("solana-glossary://{locale}/term/{termId}", {
    list: undefined,
    complete: {
      locale: () => getAvailableLocales(),
      termId: (value) => {
        const q = value.toLowerCase();
        return allTerms
          .filter((t) => t.id.startsWith(q))
          .slice(0, 20)
          .map((t) => t.id);
      },
    },
  }),
  { mimeType: "application/json", description: "Look up a Solana term in a specific language (en, pt, es)" },
  async (uri) => {
    const result = readResource(uri.href);
    if (!result) return { contents: [] };
    return { contents: [result] };
  }
);

// Localized category lookup
server.resource(
  "localized-category",
  new ResourceTemplate("solana-glossary://{locale}/category/{category}", {
    list: undefined,
    complete: {
      locale: () => getAvailableLocales(),
      category: () => getCategories(),
    },
  }),
  { mimeType: "application/json", description: "Get all terms in a category in a specific language" },
  async (uri) => {
    const result = readResource(uri.href);
    if (!result) return { contents: [] };
    return { contents: [result] };
  }
);

// ─── Prompts ────────────────────────────────────────────────────

server.prompt(
  "solana-context",
  "Generate a system prompt with Solana glossary context for a specific topic or category. Useful for grounding LLM responses in accurate Solana terminology.",
  {
    topic: z.string().describe("The topic or category to generate context for (e.g., 'defi', 'pda', 'staking')"),
    locale: z.string().optional().describe("Language: en, pt, or es"),
  },
  async ({ topic, locale }) => {
    const lang = validateLocale(locale);
    const categories = getCategories();

    let terms;
    if (categories.includes(topic as any)) {
      terms = getTermsByCategoryLocalized(topic as any, lang);
    } else {
      terms = searchTermsLocalized(topic, lang);
    }

    const context = terms
      .slice(0, 30)
      .map((t) => `- ${t.term}: ${t.definition}`)
      .join("\n");

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `You are a Solana expert. Use the following glossary definitions as reference when answering questions:`,
              ``,
              context,
              ``,
              `Use these definitions to provide accurate, grounded responses about Solana.`,
              `When referring to a concept from the glossary, be precise with the terminology.`,
            ].join("\n"),
          },
        },
      ],
    };
  }
);

server.prompt(
  "explain-solana-code",
  "Provide glossary context relevant to a piece of Solana code. Paste code and get definitions for all Solana-specific terms found in it.",
  {
    code: z.string().describe("The Solana code snippet to analyze"),
    locale: z.string().optional().describe("Language: en, pt, or es"),
  },
  async ({ code, locale }) => {
    const lang = validateLocale(locale);

    // Find terms that appear in the code
    const codeLC = code.toLowerCase();
    const foundTerms = allTerms.filter((t) => {
      if (codeLC.includes(t.id)) return true;
      if (codeLC.includes(t.term.toLowerCase())) return true;
      return t.aliases?.some((a) => codeLC.includes(a.toLowerCase())) ?? false;
    });

    const localized = localizeTerms(foundTerms, lang);

    const context = localized
      .map((t) => `- **${t.term}** [${t.category}]: ${t.definition}`)
      .join("\n");

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Analyze this Solana code and explain it using the glossary terms found within:`,
              ``,
              "```",
              code,
              "```",
              ``,
              `**Relevant Solana Glossary Terms** (${localized.length} found):`,
              context,
              ``,
              `Explain what this code does, referencing the glossary definitions above for accuracy.`,
            ].join("\n"),
          },
        },
      ],
    };
  }
);

server.prompt(
  "solana-quiz",
  "Generate a Solana knowledge quiz from the glossary. Creates multiple-choice questions with definitions, testing understanding of Solana concepts.",
  {
    category: z.string().optional().describe("Category to focus the quiz on (e.g., 'defi', 'core-protocol'). Random mix if not specified."),
    count: z.string().optional().describe("Number of questions (1-10, default: 5)"),
    locale: z.string().optional().describe("Language: en, pt, or es"),
  },
  async ({ category, count, locale }) => {
    const lang = validateLocale(locale);
    const numQuestions = Math.min(10, Math.max(1, parseInt(count ?? "5") || 5));

    let pool = allTerms.filter((t) => t.definition.length > 20);
    if (category && getCategories().includes(category as any)) {
      pool = pool.filter((t) => t.category === category);
    }

    const localized = localizeTerms(pool, lang);

    // Shuffle and pick questions
    const shuffled = [...localized].sort(() => Math.random() - 0.5);
    const questions = shuffled.slice(0, numQuestions);

    const quizLines: string[] = [
      `# 🧠 Solana Knowledge Quiz`,
      ``,
      `**${numQuestions} questions**${category ? ` — Category: ${category}` : ""}`,
      ``,
    ];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      // Get 3 wrong answers from different terms
      const wrongPool = localized.filter((t) => t.id !== q.id).sort(() => Math.random() - 0.5);
      const wrongAnswers = wrongPool.slice(0, 3).map((t) => t.term);
      
      // Shuffle correct + wrong answers
      const allAnswers = [q.term, ...wrongAnswers].sort(() => Math.random() - 0.5);
      const letters = ["A", "B", "C", "D"];

      quizLines.push(`## Question ${i + 1}`);
      quizLines.push(``);
      quizLines.push(`> ${q.definition}`);
      quizLines.push(``);
      quizLines.push(`Which term does this define?`);
      quizLines.push(``);
      for (let j = 0; j < allAnswers.length; j++) {
        quizLines.push(`${letters[j]}) ${allAnswers[j]}`);
      }
      quizLines.push(``);
      quizLines.push(`<details><summary>Answer</summary>`);
      quizLines.push(``);
      const correctLetter = letters[allAnswers.indexOf(q.term)];
      quizLines.push(`✅ **${correctLetter}) ${q.term}** [${q.category}]`);
      if (q.aliases && q.aliases.length > 0) {
        quizLines.push(`_Also known as: ${q.aliases.join(", ")}_`);
      }
      quizLines.push(``);
      quizLines.push(`</details>`);
      quizLines.push(``);
    }

    quizLines.push(`---`);
    quizLines.push(`_Generated from the Solana Glossary (${allTerms.length} terms). Use \`random_term\` to explore more!_`);

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: quizLines.join("\n"),
          },
        },
      ],
    };
  }
);

// ─── Start ──────────────────────────────────────────────────────

async function main() {
  const stats = getGraphStats();
  const hubs = getHubTerms(3);

  console.error(
    `🧠 Solana Glossary MCP Server v1.0.0\n` +
    `📚 ${allTerms.length} terms loaded\n` +
    `📂 ${getCategories().length} categories\n` +
    `🔗 ${stats.totalEdges} cross-references (avg degree: ${stats.averageDegree})\n` +
    `⭐ Hub terms: ${hubs.map((h) => `${h.term.term} (${h.connections})`).join(", ")}\n` +
    `🌐 Locales: en, pt, es\n` +
    `🛠️ 7 tools, ${getCategories().length + 2} resources, 3 resource templates, 3 prompts\n` +
    `Listening on stdio...`
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
