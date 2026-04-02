/**
 * get_token_balance — Get SPL token balances for a wallet
 * get_token_price — Get live token price from Jupiter
 */

import { z } from "zod";
import { getTokenBalances, isValidAddress } from "../../services/solana-rpc.js";
import { getTokenPrice as fetchPrice, KNOWN_TOKENS, resolveTokenMint } from "../../services/jupiter.js";
import { formatUsd, formatNumber } from "../../utils/format.js";

// ─── Token Balance ──────────────────────────────────────────

export const tokenBalanceSchema = z.object({
  address: z.string().describe("Solana wallet address to check token balances for"),
  token: z.string().optional().describe("Filter by specific token symbol (e.g., 'USDC') or mint address. If omitted, returns all token balances."),
});

export type TokenBalanceInput = z.infer<typeof tokenBalanceSchema>;

export async function tokenBalance(input: TokenBalanceInput): Promise<string> {
  if (!isValidAddress(input.address)) {
    return `❌ Invalid Solana address: "${input.address}".`;
  }

  try {
    let balances = await getTokenBalances(input.address);

    // Filter by specific token if requested
    if (input.token) {
      const resolved = resolveTokenMint(input.token);
      if (resolved) {
        balances = balances.filter(b => b.mint === resolved.mint);
      } else {
        // Try matching by mint directly
        balances = balances.filter(b => b.mint === input.token);
      }
    }

    if (balances.length === 0) {
      const filterMsg = input.token ? ` for token "${input.token}"` : "";
      return `📭 No token balances found${filterMsg} in wallet \`${input.address}\`.`;
    }

    const lines = [
      `🪙 **Token Balances** for \`${input.address}\``,
      `📊 ${balances.length} token${balances.length !== 1 ? "s" : ""}:`,
      ``,
    ];

    for (const b of balances.slice(0, 20)) {
      // Try to find symbol
      let symbol = "???";
      for (const [sym, data] of Object.entries(KNOWN_TOKENS)) {
        if (data.mint === b.mint) { symbol = sym; break; }
      }

      const amount = b.uiAmount !== null ? formatNumber(b.uiAmount) : b.amount;
      lines.push(`• **${symbol}**: ${amount}`);
      if (symbol === "???") {
        lines.push(`  Mint: \`${b.mint}\``);
      }
    }

    if (balances.length > 20) {
      lines.push(``, `_…and ${balances.length - 20} more tokens._`);
    }

    return lines.join("\n");
  } catch (err: any) {
    return `❌ Failed to fetch token balances: ${err.message ?? "RPC error"}`;
  }
}

// ─── Token Price ────────────────────────────────────────────

export const tokenPriceSchema = z.object({
  symbol: z.string().describe("Token symbol (e.g., 'SOL', 'USDC', 'BONK', 'JUP') or mint address"),
});

export type TokenPriceInput = z.infer<typeof tokenPriceSchema>;

export async function tokenPrice(input: TokenPriceInput): Promise<string> {
  try {
    const price = await fetchPrice(input.symbol);

    if (!price) {
      const available = Object.keys(KNOWN_TOKENS).join(", ");
      return `❌ Could not find token "${input.symbol}". Known tokens: ${available}`;
    }

    return [
      `📈 **${price.symbol} Price**`,
      ``,
      `💵 **${formatUsd(price.price)}**`,
      ``,
      `_Price from Jupiter aggregator (real-time)._`,
    ].join("\n");
  } catch (err: any) {
    return `❌ Failed to fetch price: ${err.message ?? "Jupiter API error"}`;
  }
}
