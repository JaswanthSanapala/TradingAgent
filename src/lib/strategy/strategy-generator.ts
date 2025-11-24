export function generateComputeActionsFromRules(params: {
  name?: string;
  description?: string;
  rules: string[];
}): { code: string; notes: string } {
  const { name, description, rules } = params;
  const banner = [
    `// Auto-generated strategy from Markdown rules`,
    name ? `// Name: ${name}` : undefined,
    description ? `// Description: ${description}` : undefined,
    `// NOTE: This is a scaffold. Review and implement actual logic for each rule.`,
  ].filter(Boolean).join('\n');

  const rulesComment = rules.length
    ? rules.map((r, i) => `//  - [R${i + 1}] ${r}`).join('\n')
    : '//  - (no rules found)';

  const code = `${banner}

// Expected export signature for the platform
// export type StrategyAction = 'buy' | 'sell' | 'hold'
// export interface StrategyContext { marketData: any[]; symbol: string; timeframe: string }

export async function computeActions(ctx) {
  const { marketData, symbol, timeframe } = ctx;
  if (!Array.isArray(marketData) || marketData.length === 0) {
    // No data -> hold
    return ['hold'];
  }

  // Rules parsed from Markdown:
${rulesComment}

  // TODO: Implement signal detection per rules above.
  // Examples:
  //  - Compute indicators (SMA, ATR, CCI) from ctx.marketData
  //  - Detect SMC structures (BoS, CHoCH, OB, FVG, Liquidity)
  //  - Enforce risk management (max risk, trades/day, R:R, pause after losses)

  // Placeholder logic: return 'hold' for now.
  // Replace with actual decision logic.
  return ['hold'];
}
`;

  const notes = `Generated computeActions(ctx) scaffold from ${rules.length} markdown rules. Please review and implement logic.`;
  return { code, notes };
}
