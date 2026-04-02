/**
 * get_recent_transactions — Get recent transactions for a wallet
 * explain_transaction — Parse and explain a transaction
 */

import { z } from "zod";
import {
  getRecentTransactions as fetchRecentTx,
  getTransactionDetails,
  isValidAddress,
  isValidSignature,
} from "../../services/solana-rpc.js";
import { getKnownProgram } from "../../data/known-programs.js";
import { formatSol, formatTimestamp, shortenAddress } from "../../utils/format.js";

// ─── Recent Transactions ────────────────────────────────────

export const recentTransactionsSchema = z.object({
  address: z.string().describe("Solana wallet address to get recent transactions for"),
  limit: z.number().min(1).max(20).optional().describe("Number of transactions to return (default: 5, max: 20)"),
});

export type RecentTransactionsInput = z.infer<typeof recentTransactionsSchema>;

export async function recentTransactions(input: RecentTransactionsInput): Promise<string> {
  if (!isValidAddress(input.address)) {
    return `❌ Invalid Solana address: "${input.address}".`;
  }

  const limit = input.limit ?? 5;

  try {
    const txs = await fetchRecentTx(input.address, limit);

    if (txs.length === 0) {
      return `📭 No recent transactions found for \`${input.address}\`.`;
    }

    const lines = [
      `📋 **Recent Transactions** for \`${shortenAddress(input.address)}\``,
      `📊 Showing ${txs.length} most recent:`,
      ``,
    ];

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const status = tx.err ? "❌ Failed" : "✅ Success";
      const time = tx.blockTime ? formatTimestamp(tx.blockTime) : "unknown";

      lines.push(`${i + 1}. ${status} — ${time}`);
      lines.push(`   Sig: \`${tx.signature.substring(0, 20)}…\``);
      lines.push(`   Slot: ${tx.slot.toLocaleString()}`);
      if (tx.memo) lines.push(`   Memo: "${tx.memo}"`);
      lines.push(``);
    }

    lines.push(`_Use 'explain_transaction' with a signature for full details._`);

    return lines.join("\n");
  } catch (err: any) {
    return `❌ Failed to fetch transactions: ${err.message ?? "RPC error"}`;
  }
}

// ─── Explain Transaction ────────────────────────────────────

export const explainTransactionSchema = z.object({
  signature: z.string().describe("Transaction signature (base58 encoded, 87-88 characters)"),
});

export type ExplainTransactionInput = z.infer<typeof explainTransactionSchema>;

export async function explainTransaction(input: ExplainTransactionInput): Promise<string> {
  if (!isValidSignature(input.signature)) {
    return `❌ Invalid transaction signature. Must be a base58-encoded string (87-88 characters).`;
  }

  try {
    const tx = await getTransactionDetails(input.signature);

    if (!tx) {
      return `❌ Transaction not found: \`${input.signature.substring(0, 20)}…\`. It may not exist or may have been pruned.`;
    }

    const lines = [
      `🔍 **Transaction Analysis**`,
      ``,
      `📝 Signature: \`${tx.signature.substring(0, 30)}…\``,
      `${tx.status === "success" ? "✅" : "❌"} Status: **${tx.status}**`,
      `🕐 Time: ${tx.blockTime ? formatTimestamp(tx.blockTime) : "unknown"}`,
      `📦 Slot: ${tx.slot.toLocaleString()}`,
      `💰 Fee: ${formatSol(tx.fee)}`,
      ``,
      `📋 **Instructions** (${tx.instructions.length}):`,
      ``,
    ];

    for (let i = 0; i < tx.instructions.length; i++) {
      const ix = tx.instructions[i];
      const known = getKnownProgram(ix.programId);
      const programName = known?.name ?? `Unknown (${shortenAddress(ix.programId)})`;

      lines.push(`  ${i + 1}. **${programName}**`);
      if (ix.type) {
        lines.push(`     Action: ${ix.type}`);
      }
      if (ix.info) {
        // Format key details from parsed instruction
        const details = formatInstructionInfo(ix.type, ix.info);
        if (details) lines.push(`     ${details}`);
      }
      if (known?.description && !ix.type) {
        lines.push(`     _${known.description}_`);
      }
      lines.push(``);
    }

    // Balance changes
    if (tx.preBalances.length > 0 && tx.postBalances.length > 0) {
      const balanceChanges: string[] = [];
      for (let i = 0; i < Math.min(tx.preBalances.length, 5); i++) {
        const diff = tx.postBalances[i] - tx.preBalances[i];
        if (diff !== 0) {
          const sign = diff > 0 ? "+" : "";
          balanceChanges.push(`  Account ${i}: ${sign}${formatSol(diff)}`);
        }
      }
      if (balanceChanges.length > 0) {
        lines.push(`💰 **Balance Changes:**`);
        lines.push(...balanceChanges);
        lines.push(``);
      }
    }

    // Key log messages (filter noise)
    const importantLogs = tx.logMessages.filter(
      (log) => log.startsWith("Program log:") || log.includes("Error") || log.includes("success")
    ).slice(0, 5);

    if (importantLogs.length > 0) {
      lines.push(`📝 **Key Logs:**`);
      for (const log of importantLogs) {
        lines.push(`  ${log}`);
      }
    }

    return lines.join("\n");
  } catch (err: any) {
    return `❌ Failed to fetch transaction: ${err.message ?? "RPC error"}`;
  }
}

/** Format parsed instruction info into readable text */
function formatInstructionInfo(type: string | undefined, info: Record<string, any>): string | null {
  if (!type || !info) return null;

  switch (type) {
    case "transfer":
      return `From: \`${shortenAddress(info.source ?? "")}\` → To: \`${shortenAddress(info.destination ?? "")}\` | Amount: ${formatSol(info.lamports ?? 0)}`;
    case "transferChecked":
      return `From: \`${shortenAddress(info.source ?? "")}\` → To: \`${shortenAddress(info.destination ?? "")}\` | Amount: ${info.tokenAmount?.uiAmountString ?? "unknown"}`;
    case "createAccount":
      return `New account: \`${shortenAddress(info.newAccount ?? "")}\` | Space: ${info.space ?? 0} bytes | Rent: ${formatSol(info.lamports ?? 0)}`;
    case "closeAccount":
      return `Closed: \`${shortenAddress(info.account ?? "")}\` → Rent to: \`${shortenAddress(info.destination ?? "")}\``;
    case "initializeAccount":
    case "initializeAccount3":
      return `Token account for mint: \`${shortenAddress(info.mint ?? "")}\` | Owner: \`${shortenAddress(info.owner ?? "")}\``;
    case "mintTo":
    case "mintToChecked":
      return `Mint: \`${shortenAddress(info.mint ?? "")}\` | Amount: ${info.tokenAmount?.uiAmountString ?? info.amount ?? "unknown"}`;
    default:
      // Generic: show first few key-value pairs
      const entries = Object.entries(info).slice(0, 3);
      if (entries.length === 0) return null;
      return entries.map(([k, v]) => `${k}: ${typeof v === "string" ? `\`${shortenAddress(v)}\`` : JSON.stringify(v)}`).join(" | ");
  }
}
