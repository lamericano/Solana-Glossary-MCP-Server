/**
 * Configuration Management
 * 
 * Centralizes all environment variable access and provides
 * sensible defaults for optional services.
 */

export interface ServerConfig {
  /** Solana RPC endpoint */
  solanaRpcUrl: string;
  /** Helius API key for enhanced RPC (optional) */
  heliusApiKey: string | null;
  /** Jupiter API base URL */
  jupiterApiUrl: string;
  /** Server version */
  version: string;
}

let _config: ServerConfig | null = null;

export function getConfig(): ServerConfig {
  if (_config) return _config;

  _config = {
    solanaRpcUrl: process.env.SOLANA_RPC_URL
      || (process.env.HELIUS_API_KEY
        ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
        : "https://api.mainnet-beta.solana.com"),
    heliusApiKey: process.env.HELIUS_API_KEY || null,
    jupiterApiUrl: "https://api.jup.ag",
    version: "2.0.0",
  };

  return _config;
}

/**
 * Check which optional services are available
 */
export function getServiceStatus(): Record<string, boolean> {
  const config = getConfig();
  return {
    solanaRpc: true, // Always available (public endpoint fallback)
    heliusEnhanced: config.heliusApiKey !== null,
    jupiterPrices: true, // Public API
  };
}
