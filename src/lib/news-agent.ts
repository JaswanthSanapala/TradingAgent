export type ImpactLevel = "High" | "Medium" | "Low";

export interface ClassifiedNewsMeta {
  sectors: string[];
  assets: string[];
  impact: ImpactLevel;
}

const SECTOR_KEYWORDS: Record<string, string[]> = {
  Technology: [
    "tech",
    "ai",
    "semiconductor",
    "chip",
    "software",
    "hardware",
    "cloud",
    "apple",
    "microsoft",
    "google",
    "alphabet",
    "meta",
    "amazon",
    "nvidia",
    "tsmc",
    "intel",
  ],
  Finance: [
    "bank",
    "lender",
    "financial",
    "fintech",
    "goldman",
    "jpmorgan",
    "morgan stanley",
    "citigroup",
    "hsbc",
    "blackrock",
    "ubs",
    "insurance",
  ],
  Energy: [
    "oil",
    "gas",
    "opec",
    "shell",
    "exxon",
    "chevron",
    "refinery",
    "drilling",
    "saudi",
    "brent",
    "wti",
  ],
  Healthcare: [
    "pharma",
    "biotech",
    "drug",
    "vaccine",
    "clinic",
    "hospital",
    "pfizer",
    "moderna",
    "johnson & johnson",
  ],
  Industrials: ["manufacturing", "factory", "aerospace", "boeing", "airbus", "machinery"],
  Consumer: [
    "retail",
    "consumer",
    "tesla",
    "ford",
    "gm",
    "nike",
    "walmart",
    "target",
    "disney",
  ],
  Materials: ["mining", "copper", "steel", "aluminum", "lithium", "commodity"],
  Utilities: ["utility", "electric", "grid", "power", "water"],
  RealEstate: ["real estate", "property", "reit", "mortgage"],
  Crypto: ["bitcoin", "ethereum", "crypto", "blockchain", "btc", "eth"],
};

const ASSET_KEYWORDS: Record<string, string[]> = {
  BTC: ["bitcoin", "btc"],
  ETH: ["ethereum", "eth"],
  SP500: ["s&p", "s&p 500", "sp500", "s&p500"],
  NASDAQ: ["nasdaq"],
  DOW: ["dow jones", "dow"],
  GOLD: ["gold", "xau"],
  OIL: ["oil", "brent", "wti", "crude"],
  USD: ["usd", "dollar", "greenback"],
  EUR: ["euro", "eur"],
  JPY: ["yen", "jpy"],
  TSLA: ["tesla"],
  NVDA: ["nvidia"],
  AAPL: ["apple", "aapl"],
  MSFT: ["microsoft", "msft"],
  AMZN: ["amazon", "amzn"],
};

const HIGH_IMPACT_CUES = [
  "fed",
  "rate hike",
  "rate cut",
  "inflation",
  "cpi",
  "ppi",
  "jobs report",
  "unemployment",
  "recession",
  "sanction",
  "merger",
  "acquisition",
  "bankruptcy",
  "downgrade",
  "upgrade",
  "beats expectations",
  "misses expectations",
  "surge",
  "plunge",
  "soar",
  "collapse",
  "%",
];

const MEDIUM_IMPACT_CUES = [
  "guidance",
  "forecast",
  "lawsuit",
  "investigation",
  "recall",
  "strike",
  "deal",
  "partnership",
];

function scoreImpact(text: string): ImpactLevel {
  const t = text.toLowerCase();
  let score = 0;
  for (const cue of HIGH_IMPACT_CUES) if (t.includes(cue)) score += 2;
  for (const cue of MEDIUM_IMPACT_CUES) if (t.includes(cue)) score += 1;
  if (score >= 3) return "High";
  if (score >= 1) return "Medium";
  return "Low";
}

export function classifyNews(input: {
  title: string;
  summary?: string;
  categories?: string[];
}): ClassifiedNewsMeta {
  const text = `${input.title} ${input.summary ?? ""} ${(input.categories ?? []).join(" ")}`.toLowerCase();

  const sectors = new Set<string>();
  for (const [sector, keys] of Object.entries(SECTOR_KEYWORDS)) {
    if (keys.some((k) => text.includes(k))) sectors.add(sector);
  }
  // Fallback sector if none detected
  if (sectors.size === 0) sectors.add("General");

  const assets = new Set<string>();
  for (const [asset, keys] of Object.entries(ASSET_KEYWORDS)) {
    if (keys.some((k) => text.includes(k))) assets.add(asset);
  }

  const impact = scoreImpact(text);

  return {
    sectors: Array.from(sectors),
    assets: Array.from(assets),
    impact,
  };
}
