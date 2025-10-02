import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const systemMdExample = `Strategy Title

Overview
Objective: Briefly describe the objective and market (e.g., scalping on EUR/USD, trend-following on BTC, etc.).

Timeframes:
- <TF A>: Describe its role (e.g., context, trend, zones). Example: 4H, 1H, 15m, 5m, 1m, or even a single timeframe like 1h.
- <TF B>: Optional. Add as many or as few timeframes as needed.

Risk Management:
- Risk: <percent>% per trade (e.g., 0.5, 1).
- Max <N> trades/day.
- Pause <N> hours after <K> consecutive losses (optional).
- Min <R>:1 reward-to-risk ratio (guideline; not auto-enforced unless specified for execution).

Indicators (only use what’s stated):
- <TF or General>: List indicators and parameters relevant to your approach. Examples: SMA(50), EMA(20), RSI(14), ATR(14), Bollinger Bands.
- Add lines as needed; use any timeframe names you defined above or leave generic.
`;

  return NextResponse.json({
    success: true,
    templates: {
      systemMarkdown: systemMdExample,
    },
  });
}
