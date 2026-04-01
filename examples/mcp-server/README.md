# Solana Glossary MCP Server

[![MCP](https://img.shields.io/badge/MCP-1.0-blueviolet)](https://modelcontextprotocol.io)
[![Terms](https://img.shields.io/badge/terms-1001-brightgreen)](https://github.com/solanabr/solana-glossary)
[![Tools](https://img.shields.io/badge/tools-7-blue)](./)
[![Tests](https://img.shields.io/badge/tests-51%20passing-green)](./)
[![i18n](https://img.shields.io/badge/i18n-en%20pt%20es-orange)](./)

**An MCP server that turns 1001 Solana glossary entries into intelligent LLM tools — lookup, search, graph-based concept exploration, learning paths, side-by-side comparisons, and random discovery. With full i18n support (🇺🇸 🇧🇷 🇪🇸).**

Built on top of the [`@stbr/solana-glossary`](https://github.com/solanabr/solana-glossary) SDK.

---

## What's Inside

| Feature | Description |
|---------|-------------|
| **7 tools** | `lookup_term`, `search_glossary`, `list_category`, `explain_concept`, `get_learning_path`, `compare_terms`, `random_term` |
| **16 resources** | Full glossary, stats, and one resource per category — all navigable by URI |
| **3 resource templates** | Dynamic term lookup, localized term, localized category — with autocompletion |
| **3 prompts** | `solana-context`, `explain-solana-code`, `solana-quiz` |
| **Knowledge graph** | BFS/DFS traversal on term cross-references for deep exploration |
| **i18n** | Every tool and resource supports `en`, `pt` (Portuguese), and `es` (Spanish) |

---

## Quick Start

### Install & Run

```bash
cd examples/mcp-server
npm install
npm run build
```

### Add to Your MCP Client

#### Claude Desktop (`claude_desktop_config.json`)

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

#### Cursor (`.cursor/mcp.json`)

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

#### Development (with auto-reload)

```bash
npm run dev
```

#### MCP Inspector (visual debugging)

```bash
npm run inspector
```

---

## Tools Reference

### `lookup_term`

Look up a single Solana term by ID, name, or alias. Returns the full definition, category, aliases, and resolved related terms.

```
Input:  { term: "pda", locale?: "pt" }
Output: Definition, category, aliases, related terms with previews
```

**Example output:**
```
📖 **Program Derived Address (PDA)**

An account address derived deterministically from a program ID...

🏷️ Category: programming-model
🔤 Aliases: PDA

🔗 Related Terms:
  • Seeds: Byte arrays used as inputs to derive a PDA...
  • Bump Seed: A single byte appended to PDA seeds...
```

---

### `search_glossary`

Full-text search across all 1001 terms. Searches names, definitions, IDs, and aliases with ranked results.

```
Input:  { query: "proof of history", limit?: 5, locale?: "es" }
Output: Ranked results with definition previews and aliases
```

---

### `list_category`

List all terms in a specific category. 14 categories available: `core-protocol`, `programming-model`, `token-ecosystem`, `defi`, `zk-compression`, `infrastructure`, `security`, `dev-tools`, `network`, `blockchain-general`, `web3`, `programming-fundamentals`, `ai-ml`, `solana-ecosystem`.

```
Input:  { category: "defi", locale?: "pt" }
Output: All terms in the category with definition previews
```

---

### `explain_concept`

Deep-dive into a concept by traversing its knowledge graph. Uses DFS to find related terms up to N levels deep, grouped by category.

```
Input:  { term: "validator", depth?: 3, locale?: "en" }
Output: Root definition + related terms organized by category
```

**Why this matters:** An LLM can call this to build comprehensive context about any Solana topic, following cross-references through the graph instead of relying on generic training data.

---

### `get_learning_path`

Find the shortest learning path between two concepts using BFS on the relationship graph.

```
Input:  { from: "pda", to: "cpi", locale?: "pt" }
Output: Step-by-step progression from known concept to target
```

**Example output:**
```
🛤️ **Learning Path: Program Derived Address (PDA) → Cross-Program Invocation (CPI)**
📏 Distance: 2 steps

🟢 Step 1 (start): Program Derived Address (PDA) [programming-model]
   An account address derived deterministically...
   ↓
🔵 Step 2: invoke_signed [programming-model]
   A function that allows a program to sign CPIs using a PDA...
   ↓
🎯 Step 3 (goal): Cross-Program Invocation (CPI) [programming-model]
   Calling one program from another within a transaction...
```

---

### `compare_terms`

Side-by-side comparison of 2-5 Solana terms. Shows definitions, categories, aliases, shared relationships, and category overlap analysis.

```
Input:  { terms: ["pda", "keypair", "pubkey"], locale?: "en" }
Output: Side-by-side comparison with shared relationship analysis
```

---

### `random_term`

Get random Solana terms for discovery, exploration, or quiz generation. Supports optional category filtering.

```
Input:  { count?: 3, category?: "defi", locale?: "pt" }
Output: Random terms with full details
```

**Example output:**
```
🎲 **3 Random Terms** from _defi_:

### Automated Market Maker (AMM)
📖 A smart contract that provides liquidity by using mathematical formulas...
🏷️ Category: defi
🔤 Aliases: AMM
🔗 Related: liquidity-pool, swap, slippage
```

---

## Resource Templates (with autocompletion)

| Template | Description |
|----------|-------------|
| `solana-glossary://term/{termId}` | Dynamic term lookup — lists all 1001 terms, autocompletes term IDs |
| `solana-glossary://{locale}/term/{termId}` | Localized term — autocompletes locales and term IDs |
| `solana-glossary://{locale}/category/{category}` | Localized category — autocompletes locales and categories |

### Static Resources

| URI | Description |
|-----|-------------|
| `solana-glossary://glossary/full` | All 1001 terms (JSON) |
| `solana-glossary://glossary/stats` | Term counts, category breakdown, relationship density |
| `solana-glossary://category/{name}` | All terms in a category (one per category pre-registered) |

---

## Prompts

### `solana-context`

Generate a system prompt with glossary context for a topic or category. Inject accurate Solana terminology into any LLM conversation.

```
Input:  { topic: "defi", locale?: "pt" }
Output: System prompt with up to 30 relevant term definitions
```

### `explain-solana-code`

Paste Solana code and get auto-detected glossary terms. The prompt identifies all Solana-specific concepts in the code and provides their definitions.

```
Input:  { code: "const [pda, bump] = PublicKey.findProgramAddressSync(...)", locale?: "en" }
Output: Code + all detected Solana terms with definitions
```

### `solana-quiz`

Generate interactive multiple-choice quizzes from glossary definitions. Great for testing Solana knowledge or building educational experiences.

```
Input:  { category?: "core-protocol", count?: "5", locale?: "pt" }
Output: Quiz with questions, answers, and expandable solutions
```

**Example output:**
```
## Question 1

> A cryptographic clock mechanism that provides a verifiable ordering of events...

Which term does this define?

A) Proof of History (PoH)
B) Tower BFT
C) Leader Schedule
D) Slot

<details><summary>Answer</summary>
✅ **A) Proof of History (PoH)** [core-protocol]
</details>
```

---

## Architecture

```
src/
├── server.ts           # MCP server setup, tool/resource/prompt registration
├── graph.ts            # BFS/DFS graph engine on term cross-references
├── i18n-resolver.ts    # Locale resolution with caching
├── tools/
│   ├── lookup.ts       # lookup_term
│   ├── search.ts       # search_glossary
│   ├── category.ts     # list_category
│   ├── explain.ts      # explain_concept (DFS)
│   ├── learning-path.ts # get_learning_path (BFS)
│   ├── compare.ts      # compare_terms
│   └── random.ts       # random_term
└── resources/
    └── index.ts        # URI-based resource handlers
```

### Knowledge Graph

The server builds an in-memory bidirectional adjacency list from all term cross-references at startup. This enables:

- **DFS traversal** (`explain_concept`): Explore related concepts radiating outward from a root term
- **BFS shortest path** (`get_learning_path`): Find the most direct conceptual path between any two terms
- **Hub detection**: Identify the most-connected terms (e.g., "transaction", "account", "validator")

At startup, the server logs graph statistics:
```
🧠 Solana Glossary MCP Server v1.0.0
📚 1001 terms loaded
📂 14 categories
🔗 1200+ cross-references (avg degree: 2.4)
⭐ Hub terms: Transaction (15), Account (12), Validator (10)
🌐 Locales: en, pt, es
🛠️ 7 tools, 16 resources, 3 resource templates, 3 prompts
```

---

## Testing

```bash
npm test
```

51 tests covering:
- All 7 tools (valid input, error handling, i18n, edge cases)
- Graph engine (BFS, DFS, stats, hub detection)
- i18n resolver (locale validation, caching, fallback)
- Resources (all URI patterns, localized variants)
- SDK integration (term count, category count, schema validation)

---

## Development

```bash
# Type-check
npm run lint

# Build
npm run build

# Run in dev mode (auto-reload)
npm run dev

# Visual debugging with MCP Inspector
npm run inspector

# Run tests
npm test
```

---

## License

MIT
