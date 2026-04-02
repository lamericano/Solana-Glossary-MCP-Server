/**
 * get_wallet_balance — Get SOL balance for a Solana wallet
 */

import { z } from "zod";
import { getWalletBalance, isValidAddress } from "../../services/solana-rpc.js";
import { formatSol, formatUsd } from "../../utils/format.js";
import { getTokenPrice } from "../../services/jupiter.js";

export const walletBalanceSchema = z.object({
  address: z.string().describe("Solana wallet address (base58 encoded, 32-44 characters)"),
  include_usd: z.boolean().optional().describe("Include USD value using live SOL price (default: true)"),
});

export type WalletBalanceInput = z.infer<typeof walletBalanceSchema>;

export async function walletBalance(input: WalletBalanceInput): Promise<string> {
  if (!isValidAddress(input.address)) {
    return `❌ Invalid Solana address: "${input.address}". Must be a base58-encoded public key (32-44 characters).`;
  }

  try {
    const balance = await getWalletBalance(input.address);
    const includeUsd = input.include_usd !== false;

    const lines = [
      `💰 **Wallet Balance**`,
      ``,
      `📍 Address: \`${input.address}\``,
      `💎 Balance: **${formatSol(balance.lamports)}**`,
      `🔢 Lamports: ${balance.lamports.toLocaleString()}`,
    ];

    if (includeUsd) {
      try {
        const solPrice = await getTokenPrice("SOL");
        if (solPrice) {
          const usdValue = balance.sol * solPrice.price;
          lines.push(`💵 Value: **${formatUsd(usdValue)}** (SOL @ ${formatUsd(solPrice.price)})`);
        }
      } catch {
        // Price fetch failed, skip USD
      }
    }

    if (balance.lamports === 0) {
      lines.push(``, `⚠️ This wallet has 0 SOL. It may be empty, a program, or a new account.`);
    }

    return lines.join("\n");
  } catch (err: any) {
    return `❌ Failed to fetch balance: ${err.message ?? "RPC error"}`;
  }
}
