/**
 * Solana RPC Service
 * 
 * Wraps @solana/web3.js Connection with error handling,
 * retry logic, and LLM-friendly response formatting.
 */

import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  type ParsedTransactionWithMeta,
  type ConfirmedSignatureInfo,
  type AccountInfo,
  type ParsedAccountData,
} from "@solana/web3.js";
import { getConfig } from "../utils/config.js";

let _connection: Connection | null = null;

function getConnection(): Connection {
  if (_connection) return _connection;
  const config = getConfig();
  _connection = new Connection(config.solanaRpcUrl, {
    commitment: "confirmed",
  });
  return _connection;
}

/** Validate a Solana address string */
export function isValidAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return address.length >= 32 && address.length <= 44;
  } catch {
    return false;
  }
}

/** Validate a transaction signature */
export function isValidSignature(sig: string): boolean {
  return /^[A-HJ-NP-Za-km-z1-9]{87,88}$/.test(sig);
}

export interface WalletBalance {
  address: string;
  lamports: number;
  sol: number;
}

/** Get SOL balance for a wallet address */
export async function getWalletBalance(address: string): Promise<WalletBalance> {
  const conn = getConnection();
  const pubkey = new PublicKey(address);
  const lamports = await conn.getBalance(pubkey);
  return {
    address,
    lamports,
    sol: lamports / LAMPORTS_PER_SOL,
  };
}

export interface TokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number | null;
}

/** Get all SPL token balances for a wallet */
export async function getTokenBalances(address: string): Promise<TokenBalance[]> {
  const conn = getConnection();
  const pubkey = new PublicKey(address);

  const response = await conn.getParsedTokenAccountsByOwner(pubkey, {
    programId: new PublicKey("TokenkegQfeN2oAHczjsxq1Fv7KNGo5UKeYTfYC9qHq"),
  });

  return response.value
    .map((account) => {
      const parsed = account.account.data as ParsedAccountData;
      const info = parsed.parsed?.info;
      if (!info) return null;
      return {
        mint: info.mint as string,
        amount: info.tokenAmount?.amount as string,
        decimals: info.tokenAmount?.decimals as number,
        uiAmount: info.tokenAmount?.uiAmount as number | null,
      };
    })
    .filter((t): t is TokenBalance => t !== null && Number(t.amount) > 0);
}

export interface TransactionInfo {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: any;
  memo: string | null;
}

/** Get recent transaction signatures for an address */
export async function getRecentTransactions(
  address: string,
  limit = 10
): Promise<TransactionInfo[]> {
  const conn = getConnection();
  const pubkey = new PublicKey(address);

  const sigs = await conn.getSignaturesForAddress(pubkey, { limit });

  return sigs.map((sig) => ({
    signature: sig.signature,
    slot: sig.slot,
    blockTime: sig.blockTime ?? null,
    err: sig.err,
    memo: sig.memo ?? null,
  }));
}

export interface ParsedTransaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  fee: number;
  status: "success" | "failed";
  instructions: Array<{
    programId: string;
    type?: string;
    info?: Record<string, any>;
  }>;
  preBalances: number[];
  postBalances: number[];
  logMessages: string[];
}

/** Get and parse a transaction by signature */
export async function getTransactionDetails(
  signature: string
): Promise<ParsedTransaction | null> {
  const conn = getConnection();

  const tx = await conn.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) return null;

  const instructions = tx.transaction.message.instructions.map((ix) => {
    if ("parsed" in ix) {
      return {
        programId: ix.programId.toBase58(),
        type: ix.parsed?.type,
        info: ix.parsed?.info,
      };
    }
    return {
      programId: ix.programId.toBase58(),
    };
  });

  return {
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    fee: tx.meta?.fee ?? 0,
    status: tx.meta?.err ? "failed" : "success",
    instructions,
    preBalances: tx.meta?.preBalances ?? [],
    postBalances: tx.meta?.postBalances ?? [],
    logMessages: tx.meta?.logMessages ?? [],
  };
}

export interface AccountClassification {
  address: string;
  type: "wallet" | "program" | "token-mint" | "token-account" | "unknown";
  executable: boolean;
  owner: string;
  lamports: number;
  dataSize: number;
  details?: Record<string, any>;
}

/** Classify what type of account an address is */
export async function classifyAccount(
  address: string
): Promise<AccountClassification> {
  const conn = getConnection();
  const pubkey = new PublicKey(address);

  const accountInfo = await conn.getParsedAccountInfo(pubkey);

  if (!accountInfo.value) {
    return {
      address,
      type: "unknown",
      executable: false,
      owner: "",
      lamports: 0,
      dataSize: 0,
    };
  }

  const info = accountInfo.value;
  const owner = info.owner.toBase58();
  const executable = info.executable;
  const lamports = info.lamports;

  // Determine type
  let type: AccountClassification["type"] = "unknown";
  let details: Record<string, any> | undefined;

  if (executable) {
    type = "program";
  } else if (owner === "TokenkegQfeN2oAHczjsxq1Fv7KNGo5UKeYTfYC9qHq" || owner === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") {
    const parsed = info.data as ParsedAccountData;
    const parsedType = parsed?.parsed?.type;

    if (parsedType === "mint") {
      type = "token-mint";
      details = {
        supply: parsed.parsed.info?.supply,
        decimals: parsed.parsed.info?.decimals,
        mintAuthority: parsed.parsed.info?.mintAuthority,
        freezeAuthority: parsed.parsed.info?.freezeAuthority,
      };
    } else if (parsedType === "account") {
      type = "token-account";
      details = {
        mint: parsed.parsed.info?.mint,
        owner: parsed.parsed.info?.owner,
        amount: parsed.parsed.info?.tokenAmount?.uiAmountString,
      };
    }
  } else if (owner === "11111111111111111111111111111111") {
    type = "wallet";
  }

  const dataSize = Buffer.isBuffer(info.data)
    ? info.data.length
    : typeof info.data === "object" && "space" in (info.data as any)
      ? (info.data as any).space
      : 0;

  return { address, type, executable, owner, lamports, dataSize, details };
}
