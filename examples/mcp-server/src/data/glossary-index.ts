/**
 * Enhanced Glossary Index
 * 
 * Augments glossary terms with practical examples and tags
 * for richer LLM responses.
 */

/** Tag definitions for glossary terms */
export type GlossaryTag = 
  | "defi" | "nft" | "infra" | "security" | "consensus" | "governance"
  | "token" | "staking" | "wallet" | "dev-tool" | "protocol" | "data"
  | "zk" | "mev" | "rpc" | "validator" | "web3" | "ai" | "bridge"
  | "amm" | "lending" | "oracle" | "storage" | "compression";

/** Practical examples for key Solana terms */
export const TERM_EXAMPLES: Record<string, { example: string; tags: GlossaryTag[] }> = {
  "pda": {
    example: "PDAs are used to create program-owned accounts. Example: `const [pda, bump] = PublicKey.findProgramAddressSync([Buffer.from('vault'), user.toBuffer()], programId);` — this derives a deterministic address for a user's vault without a private key.",
    tags: ["protocol", "dev-tool"],
  },
  "proof-of-history": {
    example: "PoH creates a verifiable sequence of time. A validator generates SHA-256 hashes in sequence: hash(prev_hash) → new_hash, creating a cryptographic clock. This allows Solana to order transactions without waiting for consensus on time.",
    tags: ["consensus", "protocol", "infra"],
  },
  "spl-token": {
    example: "Creating an SPL token: `spl-token create-token` creates a new mint. `spl-token create-account <MINT>` creates a token account. `spl-token mint <MINT> 1000` mints 1000 tokens.",
    tags: ["token", "dev-tool"],
  },
  "program": {
    example: "Solana programs (smart contracts) are stateless. They read/write to separate accounts. Example Anchor program:\n```rust\n#[program]\npub mod hello {\n    pub fn greet(ctx: Context<Greet>) -> Result<()> {\n        msg!(\"Hello, {}!\", ctx.accounts.user.key());\n        Ok(())\n    }\n}\n```",
    tags: ["protocol", "dev-tool"],
  },
  "cpi": {
    example: "Cross-Program Invocation lets programs call other programs. Example: a DEX program calls the Token Program to transfer tokens:\n`token::transfer(CpiContext::new(token_program, Transfer { from, to, authority }), amount)?;`",
    tags: ["protocol", "dev-tool"],
  },
  "account": {
    example: "Every piece of data on Solana lives in an account. Accounts have: owner (program that can modify it), data (byte array), lamports (SOL balance), and rent-exemption status.",
    tags: ["protocol", "infra"],
  },
  "rent": {
    example: "Accounts must maintain a minimum SOL balance to be rent-exempt (~0.00089 SOL for 128 bytes). Check with: `const rent = await connection.getMinimumBalanceForRentExemption(dataSize);`",
    tags: ["protocol", "infra"],
  },
  "transaction": {
    example: "A Solana transaction contains: recent blockhash (for expiry), fee payer, instructions array, and signatures. Max size: 1232 bytes. Transactions are atomic — all instructions succeed or all fail.",
    tags: ["protocol", "infra"],
  },
  "anchor": {
    example: "Anchor framework simplifies Solana development:\n`anchor init myproject` → creates project\n`anchor build` → compiles\n`anchor test` → runs tests\n`anchor deploy` → deploys to cluster",
    tags: ["dev-tool"],
  },
  "amm": {
    example: "Automated Market Makers on Solana (Orca, Raydium) use liquidity pools. Price is determined by the constant product formula: x * y = k. LPs earn fees proportional to their share.",
    tags: ["defi", "amm"],
  },
  "validator": {
    example: "Validators process transactions and produce blocks. Requirements: ~1.1 SOL/day in vote costs, high-end hardware (24+ cores, 512GB RAM, NVMe SSD). Run with: `solana-validator --identity keypair.json --vote-account vote.json`",
    tags: ["infra", "validator", "staking"],
  },
  "staking": {
    example: "Stake SOL to earn rewards (~7% APY): `solana create-stake-account stake.json 100` then `solana delegate-stake stake.json <VOTE_ACCOUNT>`. Liquid staking (JitoSOL, mSOL) lets you use staked SOL in DeFi.",
    tags: ["staking", "defi"],
  },
  "nft": {
    example: "Solana NFTs are SPL tokens with 0 decimals and supply of 1. Metadata is stored via Metaplex: name, symbol, URI (pointing to off-chain JSON with image). Create with Metaplex Sugar: `sugar launch`",
    tags: ["nft", "token"],
  },
  "jupiter": {
    example: "Jupiter aggregates all Solana DEX liquidity. API usage: `GET https://quote-api.jup.ag/v6/quote?inputMint=SOL&outputMint=USDC&amount=1000000000` returns the best swap route.",
    tags: ["defi", "amm", "infra"],
  },
  "rpc": {
    example: "Solana RPC methods: `getBalance`, `getTransaction`, `sendTransaction`, `getTokenAccountsByOwner`. Use with: `const conn = new Connection('https://api.mainnet-beta.solana.com');`",
    tags: ["rpc", "infra", "dev-tool"],
  },
  "versioned-transaction": {
    example: "Versioned transactions support Address Lookup Tables (ALTs) to include more accounts: `new VersionedTransaction(new TransactionMessage({ payerKey, recentBlockhash, instructions }).compileToV0Message(lookupTables));`",
    tags: ["protocol", "dev-tool"],
  },
  "priority-fees": {
    example: "Set priority fees to get faster inclusion: `ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 })`. Higher fees = higher priority in the block scheduler.",
    tags: ["protocol", "infra", "mev"],
  },
  "compressed-nft": {
    example: "Compressed NFTs use state compression (Merkle trees) to store NFTs on-chain at ~100x lower cost. Tree creation: `createTree({ maxDepth: 14, maxBufferSize: 64 })` supports ~16,384 NFTs.",
    tags: ["nft", "compression", "zk"],
  },
  "metaplex": {
    example: "Metaplex provides NFT infrastructure: Token Metadata (metadata for tokens), Candy Machine (minting), Bubblegum (compressed NFTs), and Core (next-gen NFT standard).",
    tags: ["nft", "infra", "dev-tool"],
  },
  "blink": {
    example: "Solana Actions & Blinks turn any URL into a signable Solana transaction. Example: A 'Donate' blink creates a transfer transaction when clicked. Blinks work in wallets, X (Twitter), and any web page.",
    tags: ["web3", "protocol"],
  },
};

/** Get practical example for a term */
export function getTermExample(termId: string): { example: string; tags: GlossaryTag[] } | null {
  return TERM_EXAMPLES[termId] ?? null;
}

/** Get all terms that match a specific tag */
export function getTermsByTag(tag: GlossaryTag): string[] {
  return Object.entries(TERM_EXAMPLES)
    .filter(([_, data]) => data.tags.includes(tag))
    .map(([id]) => id);
}

/** Get all available tags with counts */
export function getAllTags(): Array<{ tag: GlossaryTag; count: number }> {
  const counts = new Map<GlossaryTag, number>();
  for (const data of Object.values(TERM_EXAMPLES)) {
    for (const tag of data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
