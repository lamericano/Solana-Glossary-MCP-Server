/**
 * what_is_this_address — Intelligent address classification
 * 
 * Determines if an address is a wallet, program, token mint,
 * token account, or known protocol. Provides rich context.
 */

import { z } from "zod";
import { classifyAccount, isValidAddress } from "../../services/solana-rpc.js";
import { getKnownProgram, getAllKnownPrograms } from "../../data/known-programs.js";
import { KNOWN_TOKENS } from "../../services/jupiter.js";
import { formatSol, shortenAddress } from "../../utils/format.js";

export const addressInfoSchema = z.object({
  address: z.string().describe("Solana address to identify and classify (base58 encoded)"),
});

export type AddressInfoInput = z.infer<typeof addressInfoSchema>;

export async function addressInfo(input: AddressInfoInput): Promise<string> {
  if (!isValidAddress(input.address)) {
    return `❌ Invalid Solana address: "${input.address}".`;
  }

  try {
    // Check known programs first (no RPC needed)
    const knownProgram = getKnownProgram(input.address);
    if (knownProgram) {
      return [
        `🏗️ **Known Program Identified**`,
        ``,
        `📍 Address: \`${input.address}\``,
        `📛 Name: **${knownProgram.name}**`,
        `📝 ${knownProgram.description}`,
        `🏷️ Category: ${knownProgram.category}`,
        knownProgram.url ? `🔗 Website: ${knownProgram.url}` : "",
      ].filter(Boolean).join("\n");
    }

    // Check known token mints
    for (const [symbol, data] of Object.entries(KNOWN_TOKENS)) {
      if (data.mint === input.address) {
        return [
          `🪙 **Known Token Mint**`,
          ``,
          `📍 Address: \`${input.address}\``,
          `📛 Token: **${data.name} (${symbol})**`,
          `🔢 Decimals: ${data.decimals}`,
          ``,
          `_Use 'get_token_price' to check the current price._`,
        ].join("\n");
      }
    }

    // Classify via RPC
    const info = await classifyAccount(input.address);

    const typeLabels: Record<string, string> = {
      wallet: "👛 Wallet (System Account)",
      program: "🏗️ Program (Smart Contract)",
      "token-mint": "🪙 Token Mint",
      "token-account": "💳 Token Account",
      unknown: "❓ Unknown / Empty Account",
    };

    const lines = [
      `🔎 **Address Classification**`,
      ``,
      `📍 Address: \`${input.address}\``,
      `📋 Type: **${typeLabels[info.type] ?? info.type}**`,
      `💎 SOL Balance: ${formatSol(info.lamports)}`,
    ];

    if (info.owner) {
      const ownerProgram = getKnownProgram(info.owner);
      lines.push(`👤 Owner: ${ownerProgram ? `**${ownerProgram.name}**` : `\`${shortenAddress(info.owner)}\``}`);
    }

    if (info.dataSize > 0) {
      lines.push(`📦 Data Size: ${info.dataSize.toLocaleString()} bytes`);
    }

    if (info.executable) {
      lines.push(`⚡ Executable: Yes (this is a deployed program)`);
    }

    // Type-specific details
    if (info.details) {
      lines.push(``, `📊 **Details:**`);

      if (info.type === "token-mint") {
        if (info.details.decimals !== undefined) lines.push(`  Decimals: ${info.details.decimals}`);
        if (info.details.supply) lines.push(`  Supply: ${info.details.supply}`);
        if (info.details.mintAuthority) lines.push(`  Mint Authority: \`${shortenAddress(info.details.mintAuthority)}\``);
        if (info.details.freezeAuthority) lines.push(`  Freeze Authority: \`${shortenAddress(info.details.freezeAuthority)}\``);
      }

      if (info.type === "token-account") {
        if (info.details.mint) lines.push(`  Mint: \`${shortenAddress(info.details.mint)}\``);
        if (info.details.owner) lines.push(`  Owner: \`${shortenAddress(info.details.owner)}\``);
        if (info.details.amount) lines.push(`  Balance: ${info.details.amount}`);
      }
    }

    // Suggestions based on type
    lines.push(``, `💡 **Next Steps:**`);
    switch (info.type) {
      case "wallet":
        lines.push(`• Use 'get_wallet_balance' for detailed balance info`);
        lines.push(`• Use 'get_token_balance' to see token holdings`);
        lines.push(`• Use 'get_recent_transactions' for activity`);
        break;
      case "program":
        lines.push(`• This is a deployed Solana program`);
        lines.push(`• Use glossary tools to learn about Solana programs`);
        break;
      case "token-mint":
        lines.push(`• Use 'get_token_price' with the mint address for pricing`);
        break;
      case "token-account":
        lines.push(`• This account holds tokens for a specific wallet`);
        lines.push(`• Check the owner field to find the parent wallet`);
        break;
      default:
        lines.push(`• Account may be new, closed, or uninitialized`);
        break;
    }

    return lines.join("\n");
  } catch (err: any) {
    return `❌ Failed to classify address: ${err.message ?? "RPC error"}`;
  }
}
