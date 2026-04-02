/**
 * Solana Intelligence MCP Server v2.0.0
 * 
 * A comprehensive AI backend for Solana that combines:
 * - Glossary: 1000+ terms with fuzzy search, semantic search, examples, and tags
 * - Live Data: Wallet balances, token prices, transactions via Solana RPC + Jupiter
 * - Intelligence: Address classification, transaction analysis, swap simulation
 * 
 * Transport: STDIO (compatible with Claude Code, Codex CLI, Cursor)
 * 
 * Tools (15):
 *   Glossary (9):    lookup_term, search_glossary, suggest_terms, semantic_search,
 *                    list_category, explain_concept, get_learning_path, compare_terms, random_term
 *   Solana Live (6): get_wallet_balance, get_token_balance, get_token_price,
 *                    get_recent_transactions, explain_transaction, what_is_this_address,
 *                    simulate_swap
 */

import { z } from "zod";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { allTerms, getCategories, getTerm } from "@stbr/solana-glossary";

// ─── Glossary Tools ─────────────────────────────────────────
import { lookupTermSchema, lookupTerm } from "./tools/lookup.js";
import { searchGlossarySchema, searchGlossary } from "./tools/search.js";
import { listCategorySchema, listCategory } from "./tools/category.js";
import { explainConceptSchema, explainConceptTool } from "./tools/explain.js";
import { learningPathSchema, learningPath } from "./tools/learning-path.js";
import { compareTermsSchema, compareTerms } from "./tools/compare.js";
import { randomTermSchema, randomTerm } from "./tools/random.js";

// ─── Enhanced Glossary Tools (NEW) ──────────────────────────
import { suggestTermsSchema, suggestTerms } from "./tools/glossary/suggest.js";
import { semanticSearchSchema, semanticSearchTool } from "./tools/glossary/semantic-search.js";

// ─── Solana Live Tools (NEW) ────────────────────────────────
import { walletBalanceSchema, walletBalance } from "./tools/solana/wallet.js";
import { tokenBalanceSchema, tokenBalance, tokenPriceSchema, tokenPrice } from "./tools/solana/tokens.js";
import { recentTransactionsSchema, recentTransactions, explainTransactionSchema, explainTransaction } from "./tools/solana/transactions.js";
import { addressInfoSchema, addressInfo } from "./tools/solana/address-info.js";
import { simulateSwapSchema, simulateSwap } from "./tools/solana/swap.js";

// ─── Services & Data ────────────────────────────────────────
import { readResource } from "./resources/index.js";
import { getGraphStats, getHubTerms } from "./graph.js";
import { getIndexStats } from "./services/embeddings.js";
import { getConfig, getServiceStatus } from "./utils/config.js";
import {
  searchTermsLocalized,
  getTermsByCategoryLocalized,
  localizeTerms,
  validateLocale,
  getAvailableLocales,
} from "./i18n-resolver.js";

// ─── Server Setup ───────────────────────────────────────────

const server = new McpServer({
  name: "solana-intelligence",
  version: "2.0.0",
});

// ═══════════════════════════════════════════════════════════
// GLOSSARY TOOLS (9)
// ═══════════════════════════════════════════════════════════

server.tool(
  "lookup_term",
  "Look up a Solana term by ID, name, or alias. Returns definition, category, aliases, related terms, and practical code examples. Supports i18n (en, pt, es).",
  lookupTermSchema.shape,
  async (input) => {
    const result = lookupTerm(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "search_glossary",
  "Full-text search across 1000+ Solana terms. Searches names, definitions, IDs, and aliases. Returns ranked results with previews. Supports i18n.",
  searchGlossarySchema.shape,
  async (input) => {
    const result = searchGlossary(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "suggest_terms",
  "Get smart suggestions for a partially typed or misspelled term. Uses fuzzy matching with Levenshtein distance and bigram similarity. Returns scored results.",
  suggestTermsSchema.shape,
  async (input) => {
    const result = suggestTerms(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "semantic_search",
  "Natural language search across the Solana glossary. Uses TF-IDF embeddings for conceptual matching. Example: 'how does Solana achieve fast consensus?' or 'mechanism for token swaps'.",
  semanticSearchSchema.shape,
  async (input) => {
    const result = semanticSearchTool(input);
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
  "Deep-dive into a Solana concept by exploring its knowledge graph. Uses DFS traversal to find related concepts up to N levels deep, grouped by category.",
  explainConceptSchema.shape,
  async (input) => {
    const result = explainConceptTool(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "get_learning_path",
  "Find the shortest learning path between two Solana concepts. Uses BFS on the term relationship graph to create a step-by-step progression.",
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

// ═══════════════════════════════════════════════════════════
// SOLANA LIVE TOOLS (7)
// ═══════════════════════════════════════════════════════════

server.tool(
  "get_wallet_balance",
  "Get the SOL balance for a Solana wallet address. Returns balance in SOL and lamports, with optional USD conversion using live Jupiter prices.",
  walletBalanceSchema.shape,
  async (input) => {
    const result = await walletBalance(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "get_token_balance",
  "Get SPL token balances for a wallet. Returns all token holdings or filter by specific token symbol/mint. Shows amounts in human-readable format.",
  tokenBalanceSchema.shape,
  async (input) => {
    const result = await tokenBalance(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "get_token_price",
  "Get the current price of a Solana token. Supports symbols (SOL, USDC, BONK, JUP, etc.) or mint addresses. Prices from Jupiter aggregator.",
  tokenPriceSchema.shape,
  async (input) => {
    const result = await tokenPrice(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "get_recent_transactions",
  "Get recent transactions for a Solana wallet address. Shows status, timestamp, signature, and memo for each transaction.",
  recentTransactionsSchema.shape,
  async (input) => {
    const result = await recentTransactions(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "explain_transaction",
  "Parse and explain a Solana transaction by its signature. Identifies programs used, shows instruction details, balance changes, and relevant log messages. Recognizes 20+ known Solana programs.",
  explainTransactionSchema.shape,
  async (input) => {
    const result = await explainTransaction(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "what_is_this_address",
  "Classify a Solana address — determines if it's a wallet, program, token mint, token account, or known protocol. Recognizes 20+ known programs and major tokens. Provides contextual next-step suggestions.",
  addressInfoSchema.shape,
  async (input) => {
    const result = await addressInfo(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

server.tool(
  "simulate_swap",
  "Simulate a token swap using Jupiter aggregator. Shows expected output, exchange rate, price impact, and routing through DEXes — without executing any transaction.",
  simulateSwapSchema.shape,
  async (input) => {
    const result = await simulateSwap(input);
    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ═══════════════════════════════════════════════════════════
// RESOURCES
// ═══════════════════════════════════════════════════════════

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

// ─── Resource Templates ─────────────────────────────────────

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

// ═══════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════

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
              `You are a Solana expert assistant with access to live blockchain data. Use the following glossary definitions as reference when answering questions:`,
              ``,
              context,
              ``,
              `Use these definitions to provide accurate, grounded responses about Solana.`,
              `When referring to a concept from the glossary, be precise with the terminology.`,
              `You also have tools to query live Solana data: balances, prices, transactions, and address info.`,
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
      const wrongPool = localized.filter((t) => t.id !== q.id).sort(() => Math.random() - 0.5);
      const wrongAnswers = wrongPool.slice(0, 3).map((t) => t.term);
      
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

// ═══════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════

async function main() {
  const graphStats = getGraphStats();
  const hubs = getHubTerms(3);
  const indexStats = getIndexStats();
  const services = getServiceStatus();
  const config = getConfig();

  const serviceLines = [
    services.solanaRpc ? "✅ Solana RPC" : "❌ Solana RPC",
    services.heliusEnhanced ? "✅ Helius Enhanced" : "⬡ Helius (not configured)",
    services.jupiterPrices ? "✅ Jupiter Prices" : "❌ Jupiter",
  ];

  console.error(
    `\n` +
    `═══════════════════════════════════════════════════════════\n` +
    `  🧠 Solana Intelligence MCP Server v${config.version}\n` +
    `═══════════════════════════════════════════════════════════\n` +
    `\n` +
    `📚 Glossary: ${allTerms.length} terms | ${getCategories().length} categories\n` +
    `🔗 Graph: ${graphStats.totalEdges} cross-references (avg degree: ${graphStats.averageDegree})\n` +
    `🧠 Semantic Index: ${indexStats.totalTokens} unique tokens indexed\n` +
    `⭐ Hub terms: ${hubs.map((h) => `${h.term.term} (${h.connections})`).join(", ")}\n` +
    `🌐 Locales: en, pt, es\n` +
    `\n` +
    `🔌 Services:\n` +
    serviceLines.map(s => `   ${s}`).join("\n") + "\n" +
    `\n` +
    `🛠️  16 tools | ${getCategories().length + 2} resources | 3 templates | 3 prompts\n` +
    `   Glossary: lookup, search, suggest, semantic, category, explain, path, compare, random\n` +
    `   Solana:   balance, tokens, price, transactions, explain_tx, classify, swap\n` +
    `\n` +
    `📡 Listening on stdio…\n` +
    `═══════════════════════════════════════════════════════════\n`
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
