# Solana Glossary MCP Server

An MCP server that gives LLMs direct access to 1001 Solana glossary terms. Built on top of the `@stbr/solana-glossary` SDK.

It exposes 7 tools, 16 resources, 3 resource templates, and 3 prompts over the Model Context Protocol. Supports English, Portuguese, and Spanish.

## Table of Contents

1. [What This Is](#what-this-is)
2. [Why It Exists](#why-it-exists)
3. [What It Adds on Top of the SDK](#what-it-adds-on-top-of-the-sdk)
4. [Architecture](#architecture)
5. [Tools](#tools)
6. [Resources](#resources)
7. [Prompts](#prompts)
8. [The Graph Engine](#the-graph-engine)
9. [i18n](#i18n)
10. [Setup](#setup)
11. [Connecting to MCP Clients](#connecting-to-mcp-clients)
12. [Tests](#tests)
13. [Project Structure](#project-structure)
14. [Tech Stack](#tech-stack)

## What This Is

The Solana Glossary SDK (`@stbr/solana-glossary`) has 1001 terms organized in 14 categories with cross-references and translations. As a library, it works well when you write code against it. But LLMs can't import npm packages.

This server bridges that gap. It wraps the SDK with the Model Context Protocol, so any MCP-compatible client (Claude Desktop, Cursor, or anything that speaks MCP) can query terms, search definitions, explore concept relationships, and generate quizzes without the user writing a single line of code.

## Why It Exists

The original Solana Glossary was a go-to reference for developers. It got absorbed into a generic terminology page and lost its value. Superteam Brazil rebuilt it as an SDK with 1000+ structured terms.

The SDK is solid, but it only works at the code level. You have to import it, call functions, and handle the data yourself. LLMs can't do that. They need tools.

MCP is the standard for connecting LLMs to external data. This server makes the full glossary available as native tools that any AI assistant can call on demand.

## What It Adds on Top of the SDK

The server is not a thin wrapper. It introduces capabilities the SDK doesn't have:

**Bidirectional knowledge graph.** The SDK stores cross-references as one-way arrays. If `pda` references `seeds`, that's it. The server builds a symmetric adjacency list at startup, so `seeds` also connects back to `pda`. This makes graph traversal possible.

**BFS and DFS traversal.** With the graph in place, two new operations become available. `explain_concept` runs depth-first search to explore everything connected to a term, up to N levels deep. `get_learning_path` runs breadth-first search to find the shortest path between any two concepts.

**Formatted output.** Every tool returns structured text with markdown formatting, not raw JSON. Related terms come with definition previews. Learning paths show step-by-step progression. Category listings include term counts.

**Cached translations.** The SDK reloads translation files on every call. The server loads them once, indexes by term ID in a Map, and serves them in O(1) from cache. The `locale` parameter works across all tools, resources, and prompts.

**Compound prompts.** Three prompts turn the glossary into complete workflows: inject context into a conversation, auto-detect Solana terms in code, or generate multiple-choice quizzes.

## Architecture

```
MCP Client (Claude Desktop, Cursor, etc.)
    |
    | stdio (stdin/stdout)
    v
+----------------------------------+
|    Solana Glossary MCP Server    |
|                                  |
|  +-------+ +----------+ +-----+ |
|  | Tools | | Resources| |Prpts| |
|  |  (7)  | |  (16+3)  | | (3) | |
|  +---+---+ +----+-----+ +--+--+ |
|      |          |           |    |
|      +-----+----+-----+----+    |
|            v           v         |
|     +----------+ +----------+   |
|     |  Graph   | |   i18n   |   |
|     |  Engine  | | Resolver |   |
|     | BFS/DFS  | | (cached) |   |
|     +----+-----+ +----+-----+   |
|          |             |         |
|          +------+------+         |
|                 v                |
|     +---------------------+     |
|     | @stbr/solana-        |     |
|     | glossary SDK         |     |
|     | (1001 terms)         |     |
|     +---------------------+     |
+----------------------------------+
```

On startup, the server loads all 1001 terms, builds the adjacency graph, computes graph stats (edge count, average degree, hub terms), registers all tools/resources/prompts, and connects via stdio transport.

A typical request: the client sends a tool call, the server routes it to the handler, the handler queries the graph engine or i18n resolver as needed, formats the result, and returns it as MCP content.

## Tools

All tools accept an optional `locale` parameter (`"en"`, `"pt"`, `"es"`).

### lookup_term

Finds a term by ID, name, or alias. Returns the definition, category, aliases, and related terms with previews.

```
Input:  { term: "pda", locale: "pt" }
```

### search_glossary

Full-text search across names, definitions, IDs, and aliases. Returns ranked results.

```
Input:  { query: "proof of history", limit: 5, locale: "es" }
```

### list_category

Lists all terms in one of the 14 categories.

```
Input:  { category: "defi", locale: "pt" }
```

### explain_concept

Runs DFS from a root term through the knowledge graph. Finds connected concepts up to N levels deep and groups them by category.

```
Input:  { term: "validator", depth: 3 }
```

### get_learning_path

Runs BFS to find the shortest path between two concepts.

```
Input:  { from: "pda", to: "cpi" }

Output:
Step 1 (start): Program Derived Address (PDA)
Step 2: invoke_signed
Step 3 (goal): Cross-Program Invocation (CPI)
Distance: 2 steps
```

### compare_terms

Side-by-side comparison of 2 to 5 terms. Shows definitions, categories, aliases, shared relationships, and category overlap.

```
Input:  { terms: ["pda", "keypair", "pubkey"] }
```

### random_term

Returns random terms. Optional category filter. Useful for quizzes or exploration.

```
Input:  { count: 3, category: "defi", locale: "pt" }
```

## Resources

Resources are data accessible by URI.

### Static resources (16 total)

| URI | What it returns |
|-----|-----------------|
| `solana-glossary://glossary/full` | All 1001 terms as JSON |
| `solana-glossary://glossary/stats` | Term counts, category breakdown, relationship density |
| `solana-glossary://category/{name}` | All terms in a category (one resource per category, 14 total) |

### Resource templates (3 total)

Templates support autocompletion in MCP clients.

| Template | Description |
|----------|-------------|
| `solana-glossary://term/{termId}` | Look up any term by ID. Autocompletes all 1001 IDs. |
| `solana-glossary://{locale}/term/{termId}` | Localized term lookup. Autocompletes languages and IDs. |
| `solana-glossary://{locale}/category/{category}` | Localized category listing. Autocompletes languages and categories. |

## Prompts

### solana-context

Takes a topic or category name and generates a system prompt with up to 30 relevant definitions. Grounds any LLM conversation in accurate Solana terminology.

```
Input:  { topic: "defi", locale: "pt" }
```

### explain-solana-code

Takes a code snippet, scans it for Solana terms (by ID, name, or alias), and returns the code along with definitions for every term found.

```
Input:  { code: "const [pda, bump] = PublicKey.findProgramAddressSync(...)" }
// Detects: PDA, bump seed, PublicKey
```

### solana-quiz

Generates multiple-choice quizzes from glossary definitions. Each question shows a definition and four options, with an expandable answer.

```
Input:  { category: "core-protocol", count: "5", locale: "pt" }
```

## The Graph Engine

Implemented in `src/graph.ts`. This is the core differentiator.

### How it works

At startup, the engine iterates over all 1001 terms and their `related` arrays. For each reference, it creates edges in both directions, building a `Map<string, Set<string>>`.

```
pda -> [seeds, bump-seed, cpi]
seeds -> [pda]      // reverse edge added automatically
bump-seed -> [pda]  // reverse edge added automatically
```

### Operations

| Function | Algorithm | What it does |
|----------|-----------|--------------|
| `findLearningPath()` | BFS | Shortest path between two terms |
| `explainConcept()` | DFS with depth limit | Explore related concepts from a root |
| `getGraphStats()` | Full iteration | Node count, edge count, average degree |
| `getHubTerms()` | Sort by degree | Most connected terms in the glossary |

### Stats at startup

The graph logs its statistics when the server starts:

```
1200+ cross-references
Average degree: 2.4
Hub terms: Transaction (15), Account (12), Validator (10)
```

## i18n

Translation files live in `data/i18n/`:

```
data/i18n/
  pt.json   (~482KB, covers all 1001 terms)
  es.json   (~482KB, covers all 1001 terms)
```

The `i18n-resolver.ts` module loads each translation file once, indexes entries by term ID in a Map, and caches the result. All subsequent lookups are O(1).

If a term has no translation, the English version is returned. No errors, no special handling needed.

Every tool, resource, and prompt accepts a `locale` parameter. The language propagates through the entire chain automatically.

## Setup

Requirements: Node.js 18+, npm/pnpm/yarn.

```bash
git clone https://github.com/solanabr/solana-glossary.git
cd solana-glossary
npm install

cd examples/mcp-server
npm install
npm run build
```

### Commands

| Command | What it does |
|---------|--------------|
| `npm run build` | Compile TypeScript with tsup |
| `npm run dev` | Start with auto-reload (tsx) |
| `npm start` | Start the compiled server |
| `npm test` | Run all 51 tests |
| `npm run lint` | TypeScript type checking |
| `npm run inspector` | Open MCP Inspector for visual debugging |

## Connecting to MCP Clients

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "solana-glossary": {
      "command": "node",
      "args": ["/absolute/path/to/examples/mcp-server/dist/server.js"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "solana-glossary": {
      "command": "node",
      "args": ["/absolute/path/to/examples/mcp-server/dist/server.js"]
    }
  }
}
```

### Any MCP client

The server uses stdio transport. Point any MCP client to:

```bash
node /path/to/dist/server.js
```

### Visual debugging

```bash
npm run inspector
```

Opens a web UI where you can test all tools, resources, and prompts interactively.

## Tests

51 tests covering all components. Framework: Vitest.

| Area | What's tested |
|------|---------------|
| Tools (7) | Valid input, error handling, i18n, edge cases |
| Graph engine | BFS, DFS, stats, hub detection |
| i18n resolver | Locale validation, caching, fallback |
| Resources | All URI patterns, localized variants |
| SDK integration | Term count, categories, schema validation |

```bash
cd examples/mcp-server
npm test
```

## Project Structure

```
solana-glossary/
  data/
    terms/              # 14 JSON files, one per category
    i18n/
      pt.json           # Portuguese translations
      es.json           # Spanish translations
  src/
    index.ts            # SDK main API
    types.ts            # GlossaryTerm, Category types
    i18n.ts             # Internationalization module
  examples/
    mcp-server/
      src/
        server.ts       # Server setup, tool/resource/prompt registration
        graph.ts        # BFS/DFS graph engine
        i18n-resolver.ts # Locale resolution with caching
        tools/
          lookup.ts
          search.ts
          category.ts
          explain.ts
          learning-path.ts
          compare.ts
          random.ts
        resources/
          index.ts      # URI-based resource handlers
      tests/
        server.test.ts  # 51 tests
      package.json
      tsconfig.json
      tsup.config.ts
      vitest.config.ts
  tests/
    api.test.ts
    data-integrity.test.ts
  scripts/
    validate.js
  package.json
  CONTRIBUTING.md
  LICENSE (MIT)
```

## Tech Stack

| Technology | Role |
|------------|------|
| TypeScript | Primary language |
| @modelcontextprotocol/sdk | Official MCP SDK (v1.12+) |
| @stbr/solana-glossary | Glossary data layer |
| Zod | Input validation |
| tsup | Bundler (CJS + ESM + types) |
| tsx | Dev runtime |
| Vitest | Test framework |
| Node.js 18+ | Runtime |

## License

MIT. See [LICENSE](LICENSE).

Built by [Lamericano](https://github.com/lamericano) for the [Superteam Brazil](https://twitter.com/SuperteamBR) Solana Glossary Bounty.
