// Centralized config loader

function envOrThrow(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required environment variable: ${key}`);
  return v;
}

export const CONFIG = {
  // Server
  HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
  PORT: Number(process.env.PORT || 3000),
  SCHEDULER_ENABLED: (process.env.SCHEDULER_ENABLED ?? "true").toLowerCase() !== "false",
  SCHEDULER_TICK_MS: Number(process.env.SCHEDULER_TICK_MS || 15000),

  // Client/site
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SOCKET_PATH: process.env.NEXT_PUBLIC_SOCKET_PATH,

  // News feeds: comma-separated URLs; optional names using Name|URL segments separated by commas
  NEWS_FEEDS: (process.env.NEWS_FEEDS || "").split(",").map((s) => s.trim()).filter(Boolean),

  // Exchange (ccxt)
  EXCHANGE_ID: process.env.EXCHANGE_ID,
  EXCHANGE_API_KEY: process.env.EXCHANGE_API_KEY,
  EXCHANGE_SECRET: process.env.EXCHANGE_SECRET,
  EXCHANGE_SANDBOX: (process.env.EXCHANGE_SANDBOX ?? 'false').toLowerCase() === 'true',

  // Symbols and timeframes
  SYMBOLS: envOrThrow('SYMBOLS').split(',').map(s => s.trim()).filter(Boolean),
  TIMEFRAMES: envOrThrow('TIMEFRAMES').split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .reduce<Record<string,string>>((acc, tf) => { acc[tf] = tf; return acc; }, {}),
};
