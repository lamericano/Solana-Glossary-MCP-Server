/**
 * simulate_swap — Get a swap quote from Jupiter
 * 
 * Simulates a token swap showing route, output amount,
 * price impact, and fees without executing.
 */

import { z } from "zod";
import { getSwapQuote, KNOWN_TOKENS, resolveTokenMint } from "../../services/jupiter.js";
import { formatNumber, formatUsd } from "../../utils/format.js";

export const simulateSwapSchema = z.object({
  input_token: z.string().describe("Token to swap FROM — symbol (e.g., 'SOL', 'USDC') or mint address"),
  output_token: z.string().describe("Token to swap TO — symbol (e.g., 'USDC', 'BONK') or mint address"),
  amount: z.number().positive().describe("Amount of input token to swap (in human-readable units, e.g., 1.5 for 1.5 SOL)"),
});

export type SimulateSwapInput = z.infer<typeof simulateSwapSchema>;

export async function simulateSwap(input: SimulateSwapInput): Promise<string> {
  const inputToken = resolveTokenMint(input.input_token);
  const outputToken = resolveTokenMint(input.output_token);

  if (!inputToken) {
    const available = Object.keys(KNOWN_TOKENS).join(", ");
    return `❌ Unknown input token "${input.input_token}". Known tokens: ${available}`;
  }

  if (!outputToken) {
    const available = Object.keys(KNOWN_TOKENS).join(", ");
    return `❌ Unknown output token "${input.output_token}". Known tokens: ${available}`;
  }

  if (inputToken.mint === outputToken.mint) {
    return `❌ Cannot swap a token to itself (${inputToken.symbol} → ${outputToken.symbol}).`;
  }

  try {
    const quote = await getSwapQuote(input.input_token, input.output_token, input.amount);

    if (!quote) {
      return `❌ Could not get swap quote for ${inputToken.symbol} → ${outputToken.symbol}. Route may not exist.`;
    }

    // Calculate output in human-readable units
    const outAmount = Number(quote.outAmount) / Math.pow(10, outputToken.decimals);
    const inAmount = input.amount;
    const priceImpact = parseFloat(quote.priceImpactPct);
    const rate = outAmount / inAmount;

    const lines = [
      `🔄 **Swap Simulation**`,
      ``,
      `📥 Input: **${formatNumber(inAmount)} ${inputToken.symbol}**`,
      `📤 Output: **${formatNumber(outAmount)} ${outputToken.symbol}**`,
      `💱 Rate: 1 ${inputToken.symbol} = ${formatNumber(rate)} ${outputToken.symbol}`,
      `📊 Price Impact: ${priceImpact < 0.01 ? "<0.01" : priceImpact.toFixed(2)}%`,
    ];

    // Price impact warning
    if (priceImpact > 1) {
      lines.push(`⚠️ **High price impact!** Consider reducing the swap amount.`);
    } else if (priceImpact > 5) {
      lines.push(`🚨 **Very high price impact!** This swap would significantly impact the market.`);
    }

    // Route info
    if (quote.routePlan.length > 0) {
      lines.push(``, `🛤️ **Route** (${quote.routePlan.length} hop${quote.routePlan.length !== 1 ? "s" : ""}):`);
      for (const hop of quote.routePlan) {
        const label = hop.swapInfo.label || "Unknown DEX";
        const pct = hop.percent;
        lines.push(`  → **${label}** (${pct}%)`);
      }
    }

    lines.push(
      ``,
      `_This is a simulation only. No tokens were swapped._`,
      `_Quote from Jupiter aggregator. Prices may change._`
    );

    return lines.join("\n");
  } catch (err: any) {
    return `❌ Swap simulation failed: ${err.message ?? "Jupiter API error"}`;
  }
}
