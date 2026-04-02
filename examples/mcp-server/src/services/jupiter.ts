/**
 * Jupiter API Service
 * 
 * Integrates with Jupiter's public API for:
 * - Token price lookups
 * - Swap route quotes
 * - Token metadata
 */

import { getConfig } from "../utils/config.js";

/** Well-known token mints on Solana */
export const KNOWN_TOKENS: Record<string, { mint: string; decimals: number; name: string }> = {
  SOL: { mint: "So11111111111111111111111111111111111111112", decimals: 9, name: "Solana" },
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, name: "USD Coin" },
  USDT: { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6, name: "Tether USD" },
  BONK: { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, name: "Bonk" },
  JUP: { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, name: "Jupiter" },
  RAY: { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6, name: "Raydium" },
  ORCA: { mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", decimals: 6, name: "Orca" },
  PYTH: { mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6, name: "Pyth Network" },
  WIF: { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6, name: "dogwifhat" },
  JTO: { mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", decimals: 9, name: "Jito" },
  RENDER: { mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", decimals: 8, name: "Render" },
  HNT: { mint: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux", decimals: 8, name: "Helium" },
  MOBILE: { mint: "mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6", decimals: 6, name: "Helium Mobile" },
  W: { mint: "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ", decimals: 6, name: "Wormhole" },
};

/** Resolve a token symbol or mint to its mint address */
export function resolveTokenMint(symbolOrMint: string): { mint: string; symbol: string; decimals: number } | null {
  const upper = symbolOrMint.toUpperCase();
  if (KNOWN_TOKENS[upper]) {
    return { mint: KNOWN_TOKENS[upper].mint, symbol: upper, decimals: KNOWN_TOKENS[upper].decimals };
  }
  // If it looks like a mint address (base58, 32-44 chars)
  if (/^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(symbolOrMint)) {
    // Find by mint
    for (const [sym, data] of Object.entries(KNOWN_TOKENS)) {
      if (data.mint === symbolOrMint) {
        return { mint: data.mint, symbol: sym, decimals: data.decimals };
      }
    }
    return { mint: symbolOrMint, symbol: "UNKNOWN", decimals: 0 };
  }
  return null;
}

export interface TokenPrice {
  id: string;
  symbol: string;
  price: number;
}

/** Get token prices from Jupiter Price API v2 */
export async function getTokenPrices(mints: string[]): Promise<TokenPrice[]> {
  const config = getConfig();
  const ids = mints.join(",");

  const response = await fetch(
    `${config.jupiterApiUrl}/price/v2?ids=${ids}`
  );

  if (!response.ok) {
    throw new Error(`Jupiter API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { data: Record<string, { id: string; price: string }> };

  return Object.entries(data.data ?? {}).map(([id, info]) => {
    // Try to find symbol
    let symbol = "UNKNOWN";
    for (const [sym, token] of Object.entries(KNOWN_TOKENS)) {
      if (token.mint === id) { symbol = sym; break; }
    }
    return {
      id,
      symbol,
      price: parseFloat(info.price),
    };
  });
}

/** Get price for a single token by symbol or mint */
export async function getTokenPrice(symbolOrMint: string): Promise<TokenPrice | null> {
  const resolved = resolveTokenMint(symbolOrMint);
  if (!resolved) return null;

  const prices = await getTokenPrices([resolved.mint]);
  if (prices.length === 0) return null;

  return { ...prices[0], symbol: resolved.symbol !== "UNKNOWN" ? resolved.symbol : prices[0].symbol };
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputSymbol: string;
  outputSymbol: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
    };
    percent: number;
  }>;
}

/** Get a swap quote from Jupiter */
export async function getSwapQuote(
  inputSymbolOrMint: string,
  outputSymbolOrMint: string,
  amount: number
): Promise<SwapQuote | null> {
  const config = getConfig();

  const inputToken = resolveTokenMint(inputSymbolOrMint);
  const outputToken = resolveTokenMint(outputSymbolOrMint);

  if (!inputToken || !outputToken) return null;

  // Amount in smallest units
  const rawAmount = Math.floor(amount * Math.pow(10, inputToken.decimals));

  const response = await fetch(
    `${config.jupiterApiUrl}/quote?inputMint=${inputToken.mint}&outputMint=${outputToken.mint}&amount=${rawAmount}&slippageBps=50`
  );

  if (!response.ok) {
    throw new Error(`Jupiter quote error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;

  return {
    inputMint: inputToken.mint,
    outputMint: outputToken.mint,
    inputSymbol: inputToken.symbol,
    outputSymbol: outputToken.symbol,
    inAmount: data.inAmount,
    outAmount: data.outAmount,
    otherAmountThreshold: data.otherAmountThreshold,
    priceImpactPct: data.priceImpactPct,
    routePlan: data.routePlan ?? [],
  };
}
