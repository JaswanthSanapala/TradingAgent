// Centralized config loader

function envOrThrow(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required environment variable: ${key}`);
  return v;
}

export const CONFIG = {
  // Server
  HOSTNAME: process.env.HOSTNAME,
  PORT: Number(process.env.PORT),
  SCHEDULER_ENABLED: (process.env.SCHEDULER_ENABLED ?? "true").toLowerCase() !== "false",
  SCHEDULER_TICK_MS: Number(process.env.SCHEDULER_TICK_MS),
  // Workers
  SUPERVISED_WORKER_ENABLED: (process.env.SUPERVISED_WORKER_ENABLED ?? 'false').toLowerCase() === 'true',

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

  // Execution controls
  EXECUTION_ENABLED: (process.env.EXECUTION_ENABLED ?? 'false').toLowerCase() === 'true',
  RISK_PER_TRADE_PCT: Number(process.env.RISK_PER_TRADE_PCT ?? '1'), // percent of quote balance
  QUOTE_CURRENCY: process.env.QUOTE_CURRENCY || 'USDT',
  ORDER_POLL_MS: Number(process.env.ORDER_POLL_MS ?? '5000'),

  // Prediction routing
  PREDICTION_MIN_CONF: Number(process.env.PREDICTION_MIN_CONF ?? '0.5'),
  PREDICTION_COOLDOWN_SEC: Number(process.env.PREDICTION_COOLDOWN_SEC ?? '60'),
  DO_NOT_TRADE: (process.env.DO_NOT_TRADE || '').split(',').map(s => s.trim()).filter(Boolean),

  // Symbols and timeframes
  SYMBOLS: envOrThrow('SYMBOLS').split(',').map(s => s.trim()).filter(Boolean),
  TIMEFRAMES: envOrThrow('TIMEFRAMES').split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .reduce<Record<string,string>>((acc, tf) => { acc[tf] = tf; return acc; }, {}),
};
