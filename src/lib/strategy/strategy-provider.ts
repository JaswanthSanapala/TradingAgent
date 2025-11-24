export type StrategyAction = 'buy' | 'sell' | 'hold';

export interface StrategyContext {
  marketData: any[]; // chronological array with indicators if available
  symbol: string;
  timeframe: string;
}

export interface StrategyProvider {
  computeActions(ctx: StrategyContext): Promise<StrategyAction[]>;
}

export type StrategySource = {
  type: 'js';
  path: string; // absolute or project-relative path to the module
  exportName?: string; // default if omitted
};
