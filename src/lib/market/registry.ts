import { MarketProvider } from './interfaces'

let provider: MarketProvider | null = null

export const MarketRegistry = {
  set(p: MarketProvider) { provider = p },
  get(): MarketProvider | null { return provider },
}
