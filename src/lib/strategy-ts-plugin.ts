import path from 'path';
import { StrategyAction, StrategyContext, StrategyProvider, StrategySource } from './strategy-provider';

export class TsPluginStrategyProvider implements StrategyProvider {
  private modPath: string;
  private exportName: string;

  constructor(source: StrategySource) {
    const p = source.path;
    this.modPath = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    this.exportName = source.exportName || 'computeActions';
  }

  async computeActions(ctx: StrategyContext): Promise<StrategyAction[]> {
    // Dynamic import user module
    const mod = await import(this.modPath);
    const fn = mod[this.exportName] as ((ctx: StrategyContext) => Promise<StrategyAction[]> | StrategyAction[]);
    if (typeof fn !== 'function') {
      throw new Error(`Export ${this.exportName} not found or not a function in ${this.modPath}`);
    }
    const actions = await fn(ctx);
    if (!Array.isArray(actions)) {
      throw new Error('Strategy returned invalid actions (not an array)');
    }
    return actions as StrategyAction[];
  }
}
