/**
 * Known Solana Programs Database
 * 
 * Maps well-known program IDs to human-readable names and descriptions.
 * Used by what_is_this_address and explain_transaction tools.
 */

export interface KnownProgram {
  name: string;
  description: string;
  category: "system" | "defi" | "nft" | "token" | "governance" | "oracle" | "infra";
  url?: string;
}

export const KNOWN_PROGRAMS: Record<string, KnownProgram> = {
  // System programs
  "11111111111111111111111111111111": {
    name: "System Program",
    description: "Native Solana program for creating accounts, transferring SOL, and allocating account data.",
    category: "system",
  },
  "TokenkegQfeN2oAHczjsxq1Fv7KNGo5UKeYTfYC9qHq": {
    name: "Token Program",
    description: "SPL Token Program — manages fungible and non-fungible token operations (mint, transfer, burn).",
    category: "token",
  },
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb": {
    name: "Token-2022 Program",
    description: "SPL Token Extensions Program — advanced token features including transfer fees, confidential transfers, and metadata.",
    category: "token",
  },
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL": {
    name: "Associated Token Account Program",
    description: "Derives and creates deterministic token accounts for a given wallet and mint combination.",
    category: "token",
  },
  "ComputeBudget111111111111111111111111111111": {
    name: "Compute Budget Program",
    description: "Set compute unit limits and priority fees for transactions.",
    category: "system",
  },
  "Vote111111111111111111111111111111111111111": {
    name: "Vote Program",
    description: "Manages validator vote accounts used for consensus and staking.",
    category: "system",
  },
  "Stake11111111111111111111111111111111111111": {
    name: "Stake Program",
    description: "Manages stake accounts — delegation, deactivation, and withdrawal of staked SOL.",
    category: "system",
  },
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr": {
    name: "Memo Program v2",
    description: "Attach arbitrary text memos to Solana transactions.",
    category: "system",
  },
  "AddressLookupTab1e1111111111111111111111111": {
    name: "Address Lookup Table Program",
    description: "Manages address lookup tables for transaction size optimization (versioned transactions).",
    category: "system",
  },

  // DeFi programs
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": {
    name: "Jupiter Aggregator v6",
    description: "Jupiter swap aggregator — finds the best swap route across all Solana DEXes.",
    category: "defi",
    url: "https://jup.ag",
  },
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": {
    name: "Orca Whirlpools",
    description: "Orca concentrated liquidity AMM — provides efficient token swaps and LP positions.",
    category: "defi",
    url: "https://orca.so",
  },
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": {
    name: "Raydium AMM",
    description: "Raydium AMM — hybrid AMM using Serum's central limit order book for liquidity.",
    category: "defi",
    url: "https://raydium.io",
  },
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": {
    name: "Raydium CLMM",
    description: "Raydium Concentrated Liquidity Market Maker (CLMM) program.",
    category: "defi",
    url: "https://raydium.io",
  },
  "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA": {
    name: "Marginfi",
    description: "Marginfi lending protocol — deposit, borrow, and earn yield on Solana assets.",
    category: "defi",
    url: "https://marginfi.com",
  },
  "jCebN34bUfdeUhJEkZxbFE1KZjBN1iUXS1JkGKr2TRH": {
    name: "Jito Stake Pool",
    description: "Jito liquid staking — stake SOL and receive JitoSOL with MEV rewards.",
    category: "defi",
    url: "https://jito.network",
  },
  "DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1": {
    name: "Orca Token Swap",
    description: "Orca legacy constant-product AMM for token swaps.",
    category: "defi",
  },

  // NFT programs
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s": {
    name: "Metaplex Token Metadata",
    description: "Metaplex Token Metadata program — attach metadata (name, symbol, URI) to SPL tokens.",
    category: "nft",
    url: "https://metaplex.com",
  },
  "CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR": {
    name: "Candy Machine v3",
    description: "Metaplex Candy Machine — NFT minting machine with guards and configurable mint rules.",
    category: "nft",
  },

  // Oracle programs
  "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH": {
    name: "Pyth Oracle",
    description: "Pyth Network oracle — provides real-time price feeds for crypto, equities, and commodities.",
    category: "oracle",
    url: "https://pyth.network",
  },
  "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f": {
    name: "Switchboard Oracle",
    description: "Switchboard oracle network — decentralized, permissionless oracle feeds.",
    category: "oracle",
    url: "https://switchboard.xyz",
  },
};

/** Look up a known program by its ID */
export function getKnownProgram(programId: string): KnownProgram | null {
  return KNOWN_PROGRAMS[programId] ?? null;
}

/** Get all known programs */
export function getAllKnownPrograms(): Array<{ id: string } & KnownProgram> {
  return Object.entries(KNOWN_PROGRAMS).map(([id, program]) => ({ id, ...program }));
}
