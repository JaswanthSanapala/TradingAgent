import { CONFIG } from '@/lib/config';

export type SizingInput = {
  quoteBalance: number;        // e.g., USDT balance available
  riskPct?: number;            // percent of quote to risk per trade
  price: number;               // current price
  minQty?: number;             // exchange min quantity for symbol (optional)
  maxQty?: number;             // exchange max quantity for symbol (optional)
};

export function simpleSizeByQuote({ quoteBalance, riskPct, price, minQty, maxQty }: SizingInput): number {
  const pct = Number.isFinite(riskPct || NaN) ? (riskPct as number) : CONFIG.RISK_PER_TRADE_PCT;
  const quoteToUse = Math.max(0, (pct / 100) * quoteBalance);
  let qty = quoteToUse / price;
  if (minQty != null) qty = Math.max(qty, minQty);
  if (maxQty != null) qty = Math.min(qty, maxQty);
  // round to 8 decimals by default; exchange filters could be applied here if needed
  return Math.max(0, Number(qty.toFixed(8)));
}
