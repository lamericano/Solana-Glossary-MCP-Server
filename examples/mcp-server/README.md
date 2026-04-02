# Solana Intelligence MCP Server v2.0.0

A comprehensive MCP server that transforms the Solana Glossary into a full AI-powered Solana backend. Provides glossary intelligence, live blockchain data, semantic search, transaction analysis, and swap simulation — all accessible from Claude Code, Codex CLI, Cursor, and any MCP client.

## Features

### Glossary Intelligence (9 tools)
| Tool | Description |
|------|-------------|
| `lookup_term` | Look up any term by ID, name, or alias. Returns definition, examples, and tags |
| `search_glossary` | Full-text search across 1000+ Solana terms |
| `suggest_terms` | Fuzzy matching with Levenshtein distance for misspelled/partial terms |
| `semantic_search` | Natural language queries using TF-IDF embeddings (zero dependencies) |
| `list_category` | Browse terms by category (14 categories) |
| `explain_concept` | Deep-dive via DFS graph traversal of term relationships |
| `get_learning_path` | BFS shortest path between two concepts |
| `compare_terms` | Side-by-side comparison of 2-5 terms |
| `random_term` | Discover random terms, optionally by category |

### Live Solana Data (7 tools)
| Tool | Description |
|------|-------------|
| `get_wallet_balance` | SOL balance with USD conversion via Jupiter prices |
| `get_token_balance` | SPL token holdings for any wallet |
| `get_token_price` | Real-time token prices (SOL, USDC, BONK, JUP, etc.) |
| `get_recent_transactions` | Recent transaction history for any address |
| `explain_transaction` | Parse and explain any transaction — identifies 20+ known programs |
| `what_is_this_address` | Classify any address (wallet, program, token mint, known protocol) |
| `simulate_swap` | Jupiter swap quotes with routing, price impact, and rate info |

### Resources & Prompts
- **16 resources**: Full glossary, stats, per-category views, term lookups, i18n variants
- **3 resource templates**: Dynamic term/category/locale lookups
- **3 prompts**: `solana-context`, `explain-solana-code`, `solana-quiz`

## Architecture

```
src/
├── server.ts                    # MCP server orchestrator (thin)
├── tools/
│   ├── glossary/                # Enhanced glossary tools
│   │   ├── suggest.ts           # Fuzzy suggestions
│   │   └── semantic-search.ts   # TF-IDF semantic search
│   ├── solana/                  # Live blockchain tools
│   │   ├── wallet.ts            # Wallet balance
│   │   ├── tokens.ts            # Token balance + price
│   │   ├── transactions.ts      # History + explain_tx
│   │   ├── address-info.ts      # Address classification
│   │   └── swap.ts              # Swap simulation
│   ├── lookup.ts                # Enhanced with examples/tags
│   ├── search.ts                # Full-text search
│   ├── category.ts              # Category listing
│   ├── explain.ts               # Graph DFS exploration
│   ├── learning-path.ts         # Graph BFS pathfinding
│   ├── compare.ts               # Term comparison
│   └── random.ts                # Random discovery
├── services/
│   ├── solana-rpc.ts            # @solana/web3.js wrapper
│   ├── jupiter.ts               # Jupiter price/swap API
│   └── embeddings.ts            # TF-IDF semantic engine
├── data/
│   ├── known-programs.ts        # 20+ known Solana programs
│   └── glossary-index.ts        # Examples + tags for terms
├── utils/
│   ├── config.ts                # Environment management
│   ├── format.ts                # LLM-optimized formatters
│   └── fuzzy.ts                 # Levenshtein + Dice fuzzy match
├── graph.ts                     # BFS/DFS relation graph
├── i18n-resolver.ts             # Locale resolution + caching
└── resources/
    └── index.ts                 # MCP resource handlers
```

## Quick Start

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build for production
npm run build

# Test with MCP Inspector
npm run inspector
```

## Configuration

No API keys required! All tools work with public endpoints.

For better performance, optionally set:

```bash
# Better RPC (free key at https://dev.helius.xyz)
export HELIUS_API_KEY=your_key_here

# Or custom RPC
export SOLANA_RPC_URL=https://your-rpc.com
```

## Client Setup

### Claude Code
```json
{
  "mcpServers": {
    "solana": {
      "command": "node",
      "args": ["path/to/dist/server.js"]
    }
  }
}
```

### Cursor
```json
{
  "mcpServers": {
    "solana": {
      "command": "npx",
      "args": ["tsx", "path/to/src/server.ts"]
    }
  }
}
```

### Codex CLI
```bash
codex --mcp-server "node path/to/dist/server.js"
```

## Usage Examples

### Glossary
```
> lookup_term({ term: "pda" })
# Returns definition, related terms, practical code example, and tags

> semantic_search({ query: "how does Solana achieve fast consensus?" })
# Returns ranked results by conceptual similarity

> suggest_terms({ query: "proff of histry" })
# Fuzzy matches to "Proof of History" with 78% confidence
```

### Live Data
```
> get_wallet_balance({ address: "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg" })
# Returns SOL balance + USD value

> get_token_price({ symbol: "SOL" })
# Returns live Jupiter price

> simulate_swap({ input_token: "SOL", output_token: "USDC", amount: 10 })
# Shows route, output amount, price impact

> what_is_this_address({ address: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4" })
# Identifies: "Jupiter Aggregator v6" — DeFi program

> explain_transaction({ signature: "5yG..." })
# Parses all instructions, identifies programs, shows balance changes
```

## Technical Highlights

- **Zero external AI dependencies**: Semantic search uses local TF-IDF (no OpenAI/API keys)
- **20+ known programs**: Recognizes Jupiter, Raydium, Orca, Metaplex, Pyth, and more
- **14 known tokens**: SOL, USDC, BONK, JUP, WIF, etc. with mint addresses
- **Fuzzy matching**: Levenshtein distance + Dice coefficient for typo tolerance
- **Graph engine**: BFS/DFS on 1000+ term cross-references
- **i18n**: English, Portuguese, Spanish
- **STDIO transport**: Compatible with all MCP clients
- **Lightweight**: ~589KB bundled, no heavy dependencies

## License

MIT
