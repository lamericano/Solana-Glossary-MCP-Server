/**
 * LLM-Optimized Formatters
 * 
 * Produces structured, concise responses that LLMs can parse
 * and relay to users effectively. Avoids noise and verbosity.
 */

/** Format SOL amount from lamports */
export function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(9).replace(/\.?0+$/, "") + " SOL";
}

/** Format USD price */
export function formatUsd(amount: number): string {
  if (amount >= 1) return "$" + amount.toFixed(2);
  if (amount >= 0.01) return "$" + amount.toFixed(4);
  return "$" + amount.toFixed(8);
}

/** Format large numbers with abbreviations */
export function formatNumber(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(n % 1 === 0 ? 0 : 2);
}

/** Shorten a Solana address for display */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/** Format a Unix timestamp to readable date */
export function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

/** Build a structured text response for LLMs */
export function buildResponse(sections: Array<{ label: string; value: string }>): string {
  return sections
    .filter(s => s.value.length > 0)
    .map(s => `**${s.label}:** ${s.value}`)
    .join("\n");
}

/** Build a compact list response */
export function buildList(title: string, items: string[]): string {
  if (items.length === 0) return `${title}: (none)`;
  return `${title}:\n${items.map(i => `  • ${i}`).join("\n")}`;
}

/** Truncate text to max length with ellipsis */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 1) + "…";
}
