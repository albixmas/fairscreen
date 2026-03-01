/**
 * Taxonomy lookup interfaces and in-memory implementations.
 * In production these read from DB; for scoring tests we use simple maps.
 */

export interface UniversityLookup {
  getTier(institutionName: string): "PRIORITY_1" | "TIER_1" | "TIER_2" | "OTHER";
}

export interface EmployerLookup {
  getFamily(employerName: string): string | null;
  getTier(employerFamily: string): "ELITE" | "SELECTIVE" | "OTHER";
}

export interface DivisionLookup {
  getMultiplier(employerFamily: string, keywords: string[]): number;
  getCategory(employerFamily: string, keywords: string[]): string;
}

// ===== In-memory implementations =====

export class InMemoryUniversityLookup implements UniversityLookup {
  private map: Map<string, "PRIORITY_1" | "TIER_1" | "TIER_2" | "OTHER">;

  constructor(entries: Array<{ name: string; tier: "PRIORITY_1" | "TIER_1" | "TIER_2" | "OTHER" }>) {
    this.map = new Map();
    for (const e of entries) {
      this.map.set(e.name.toLowerCase().trim(), e.tier);
    }
  }

  getTier(institutionName: string): "PRIORITY_1" | "TIER_1" | "TIER_2" | "OTHER" {
    const key = institutionName.toLowerCase().trim();
    // Direct match
    if (this.map.has(key)) return this.map.get(key)!;
    // Partial match
    for (const [name, tier] of this.map) {
      if (key.includes(name) || name.includes(key)) return tier;
    }
    return "OTHER";
  }
}

export class InMemoryEmployerLookup implements EmployerLookup {
  private familyMap: Map<string, string>; // normalized name -> family
  private tierMap: Map<string, "ELITE" | "SELECTIVE" | "OTHER">;

  constructor(
    families: Array<{ patterns: string[]; family: string; tier: "ELITE" | "SELECTIVE" | "OTHER" }>
  ) {
    this.familyMap = new Map();
    this.tierMap = new Map();
    for (const f of families) {
      this.tierMap.set(f.family.toLowerCase(), f.tier);
      for (const p of f.patterns) {
        this.familyMap.set(p.toLowerCase().trim(), f.family);
      }
    }
  }

  getFamily(employerName: string): string | null {
    const key = employerName.toLowerCase().trim();
    if (this.familyMap.has(key)) return this.familyMap.get(key)!;
    for (const [pattern, family] of this.familyMap) {
      if (key.includes(pattern) || pattern.includes(key)) return family;
    }
    return null;
  }

  getTier(employerFamily: string): "ELITE" | "SELECTIVE" | "OTHER" {
    return this.tierMap.get(employerFamily.toLowerCase()) ?? "OTHER";
  }
}

export class InMemoryDivisionLookup implements DivisionLookup {
  private rules: Array<{
    employerFamily: string;
    category: string;
    keywords: string[];
    multiplier: number;
  }>;

  constructor(
    rules: Array<{
      employerFamily: string;
      category: string;
      keywords: string[];
      multiplier: number;
    }>
  ) {
    this.rules = rules;
  }

  getMultiplier(employerFamily: string, keywords: string[]): number {
    const match = this._findMatch(employerFamily, keywords);
    return match?.multiplier ?? 0.5;
  }

  getCategory(employerFamily: string, keywords: string[]): string {
    const match = this._findMatch(employerFamily, keywords);
    return match?.category ?? "OTHER";
  }

  private _findMatch(
    employerFamily: string,
    keywords: string[]
  ): { category: string; multiplier: number } | null {
    const fam = employerFamily.toLowerCase();
    const kws = keywords.map((k) => k.toLowerCase());

    let bestMatch: { category: string; multiplier: number } | null = null;
    let bestScore = 0;

    for (const rule of this.rules) {
      if (rule.employerFamily.toLowerCase() !== fam) continue;
      let score = 0;
      for (const rk of rule.keywords) {
        for (const kw of kws) {
          if (kw.includes(rk.toLowerCase()) || rk.toLowerCase().includes(kw)) {
            score++;
          }
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { category: rule.category, multiplier: rule.multiplier };
      }
    }
    return bestMatch;
  }
}

// ===== Default UK Taxonomies =====

export const DEFAULT_UK_UNIVERSITIES: Array<{ name: string; tier: "PRIORITY_1" | "TIER_1" | "TIER_2" | "OTHER" }> = [
  // Priority Tier 1
  { name: "university of oxford", tier: "PRIORITY_1" },
  { name: "oxford", tier: "PRIORITY_1" },
  { name: "university of cambridge", tier: "PRIORITY_1" },
  { name: "cambridge", tier: "PRIORITY_1" },
  { name: "london school of economics", tier: "PRIORITY_1" },
  { name: "lse", tier: "PRIORITY_1" },
  { name: "imperial college london", tier: "PRIORITY_1" },
  { name: "imperial college", tier: "PRIORITY_1" },
  { name: "university college london", tier: "PRIORITY_1" },
  { name: "ucl", tier: "PRIORITY_1" },
  // Tier 1
  { name: "university of warwick", tier: "TIER_1" },
  { name: "warwick", tier: "TIER_1" },
  { name: "university of st andrews", tier: "TIER_1" },
  { name: "st andrews", tier: "TIER_1" },
  { name: "durham university", tier: "TIER_1" },
  { name: "durham", tier: "TIER_1" },
  { name: "university of bath", tier: "TIER_1" },
  { name: "bath", tier: "TIER_1" },
  { name: "university of edinburgh", tier: "TIER_1" },
  { name: "edinburgh", tier: "TIER_1" },
  { name: "king's college london", tier: "TIER_1" },
  { name: "kcl", tier: "TIER_1" },
  { name: "university of bristol", tier: "TIER_1" },
  { name: "bristol", tier: "TIER_1" },
  { name: "university of exeter", tier: "TIER_1" },
  { name: "exeter", tier: "TIER_1" },
  { name: "university of nottingham", tier: "TIER_1" },
  { name: "nottingham", tier: "TIER_1" },
  { name: "university of manchester", tier: "TIER_1" },
  { name: "manchester", tier: "TIER_1" },
  { name: "university of leeds", tier: "TIER_1" },
  { name: "leeds", tier: "TIER_1" },
  { name: "university of glasgow", tier: "TIER_1" },
  { name: "glasgow", tier: "TIER_1" },
  { name: "university of birmingham", tier: "TIER_1" },
  { name: "birmingham", tier: "TIER_1" },
  // Tier 2
  { name: "university of sheffield", tier: "TIER_2" },
  { name: "sheffield", tier: "TIER_2" },
  { name: "university of york", tier: "TIER_2" },
  { name: "york", tier: "TIER_2" },
  { name: "university of southampton", tier: "TIER_2" },
  { name: "southampton", tier: "TIER_2" },
  { name: "lancaster university", tier: "TIER_2" },
  { name: "lancaster", tier: "TIER_2" },
  { name: "university of surrey", tier: "TIER_2" },
  { name: "surrey", tier: "TIER_2" },
  { name: "queen mary university of london", tier: "TIER_2" },
  { name: "queen mary", tier: "TIER_2" },
  { name: "university of liverpool", tier: "TIER_2" },
  { name: "liverpool", tier: "TIER_2" },
  { name: "cardiff university", tier: "TIER_2" },
  { name: "cardiff", tier: "TIER_2" },
  { name: "university of reading", tier: "TIER_2" },
  { name: "reading", tier: "TIER_2" },
  { name: "loughborough university", tier: "TIER_2" },
  { name: "loughborough", tier: "TIER_2" },
];

export const DEFAULT_UK_EMPLOYERS: Array<{ patterns: string[]; family: string; tier: "ELITE" | "SELECTIVE" | "OTHER" }> = [
  { patterns: ["mckinsey", "mckinsey & company"], family: "McKinsey", tier: "ELITE" },
  { patterns: ["bcg", "boston consulting group"], family: "BCG", tier: "ELITE" },
  { patterns: ["bain", "bain & company"], family: "Bain", tier: "ELITE" },
  { patterns: ["goldman sachs", "goldman"], family: "Goldman Sachs", tier: "ELITE" },
  { patterns: ["morgan stanley"], family: "Morgan Stanley", tier: "ELITE" },
  { patterns: ["j.p. morgan", "jp morgan", "jpmorgan"], family: "JPMorgan", tier: "ELITE" },
  { patterns: ["rothschild", "rothschild & co"], family: "Rothschild", tier: "ELITE" },
  { patterns: ["lazard"], family: "Lazard", tier: "ELITE" },
  { patterns: ["evercore"], family: "Evercore", tier: "ELITE" },
  { patterns: ["pwc", "pricewaterhousecoopers"], family: "PwC", tier: "SELECTIVE" },
  { patterns: ["deloitte"], family: "Deloitte", tier: "SELECTIVE" },
  { patterns: ["ey", "ernst & young", "ernst and young"], family: "EY", tier: "SELECTIVE" },
  { patterns: ["kpmg"], family: "KPMG", tier: "SELECTIVE" },
  { patterns: ["accenture"], family: "Accenture", tier: "SELECTIVE" },
  { patterns: ["oliver wyman"], family: "Oliver Wyman", tier: "ELITE" },
  { patterns: ["strategy&", "strategy and"], family: "Strategy&", tier: "ELITE" },
  { patterns: ["monitor deloitte", "monitor"], family: "Monitor Deloitte", tier: "ELITE" },
  { patterns: ["ey-parthenon", "parthenon"], family: "EY-Parthenon", tier: "ELITE" },
  { patterns: ["google", "alphabet"], family: "Google", tier: "ELITE" },
  { patterns: ["meta", "facebook"], family: "Meta", tier: "ELITE" },
  { patterns: ["amazon"], family: "Amazon", tier: "SELECTIVE" },
  { patterns: ["apple"], family: "Apple", tier: "ELITE" },
  { patterns: ["microsoft"], family: "Microsoft", tier: "SELECTIVE" },
  { patterns: ["barclays"], family: "Barclays", tier: "SELECTIVE" },
  { patterns: ["hsbc"], family: "HSBC", tier: "SELECTIVE" },
  { patterns: ["citi", "citigroup", "citibank"], family: "Citi", tier: "SELECTIVE" },
  { patterns: ["deutsche bank"], family: "Deutsche Bank", tier: "SELECTIVE" },
  { patterns: ["ubs"], family: "UBS", tier: "SELECTIVE" },
  { patterns: ["credit suisse"], family: "Credit Suisse", tier: "SELECTIVE" },
];

export const DEFAULT_UK_DIVISION_RULES: Array<{
  employerFamily: string;
  category: string;
  keywords: string[];
  multiplier: number;
}> = [
  // PwC
  { employerFamily: "PwC", category: "STRATEGY", keywords: ["strategy&", "strategy", "consulting", "advisory"], multiplier: 1.0 },
  { employerFamily: "PwC", category: "DEALS", keywords: ["deals", "transactions", "m&a", "corporate finance"], multiplier: 0.9 },
  { employerFamily: "PwC", category: "AUDIT", keywords: ["audit", "assurance"], multiplier: 0.4 },
  { employerFamily: "PwC", category: "OTHER", keywords: ["tax", "legal", "people"], multiplier: 0.5 },
  // Deloitte
  { employerFamily: "Deloitte", category: "STRATEGY", keywords: ["monitor", "strategy", "consulting"], multiplier: 1.0 },
  { employerFamily: "Deloitte", category: "DEALS", keywords: ["financial advisory", "m&a", "transactions", "restructuring"], multiplier: 0.9 },
  { employerFamily: "Deloitte", category: "AUDIT", keywords: ["audit", "assurance"], multiplier: 0.4 },
  { employerFamily: "Deloitte", category: "OTHER", keywords: ["tax", "risk", "legal"], multiplier: 0.5 },
  // EY
  { employerFamily: "EY", category: "STRATEGY", keywords: ["parthenon", "strategy", "ey-parthenon"], multiplier: 1.0 },
  { employerFamily: "EY", category: "DEALS", keywords: ["strategy and transactions", "transactions", "m&a"], multiplier: 0.9 },
  { employerFamily: "EY", category: "AUDIT", keywords: ["audit", "assurance"], multiplier: 0.4 },
  { employerFamily: "EY", category: "OTHER", keywords: ["tax", "consulting", "technology"], multiplier: 0.6 },
  // KPMG
  { employerFamily: "KPMG", category: "DEALS", keywords: ["deal advisory", "transactions", "m&a", "corporate finance"], multiplier: 0.9 },
  { employerFamily: "KPMG", category: "STRATEGY", keywords: ["strategy", "consulting"], multiplier: 0.8 },
  { employerFamily: "KPMG", category: "AUDIT", keywords: ["audit", "assurance"], multiplier: 0.4 },
  { employerFamily: "KPMG", category: "OTHER", keywords: ["tax", "legal", "people"], multiplier: 0.5 },
  // Accenture
  { employerFamily: "Accenture", category: "STRATEGY", keywords: ["strategy", "accenture strategy", "management consulting"], multiplier: 1.0 },
  { employerFamily: "Accenture", category: "TECH_PRODUCT", keywords: ["technology", "digital", "interactive", "song"], multiplier: 0.7 },
  { employerFamily: "Accenture", category: "OPS", keywords: ["operations", "outsourcing", "delivery"], multiplier: 0.4 },
  // Banks - IB vs others
  { employerFamily: "Goldman Sachs", category: "IB", keywords: ["investment banking", "m&a", "capital markets", "securities"], multiplier: 1.0 },
  { employerFamily: "Goldman Sachs", category: "STRATEGY", keywords: ["strategy", "principal investments"], multiplier: 0.9 },
  { employerFamily: "Goldman Sachs", category: "OPS", keywords: ["operations", "compliance", "risk"], multiplier: 0.5 },
  { employerFamily: "Morgan Stanley", category: "IB", keywords: ["investment banking", "m&a", "capital markets"], multiplier: 1.0 },
  { employerFamily: "Morgan Stanley", category: "OPS", keywords: ["operations", "compliance", "risk", "wealth"], multiplier: 0.5 },
  { employerFamily: "JPMorgan", category: "IB", keywords: ["investment banking", "m&a", "capital markets", "cib"], multiplier: 1.0 },
  { employerFamily: "JPMorgan", category: "OPS", keywords: ["operations", "compliance", "consumer", "retail"], multiplier: 0.5 },
  { employerFamily: "Rothschild", category: "IB", keywords: ["advisory", "m&a", "restructuring"], multiplier: 1.0 },
  { employerFamily: "Lazard", category: "IB", keywords: ["advisory", "m&a", "restructuring", "financial advisory"], multiplier: 1.0 },
  // Tech
  { employerFamily: "Google", category: "TECH_PRODUCT", keywords: ["product", "engineering", "growth", "data science"], multiplier: 0.9 },
  { employerFamily: "Google", category: "STRATEGY", keywords: ["strategy", "biz ops", "business operations"], multiplier: 1.0 },
  { employerFamily: "Google", category: "OPS", keywords: ["support", "admin", "sales"], multiplier: 0.5 },
  { employerFamily: "Meta", category: "TECH_PRODUCT", keywords: ["product", "engineering", "growth", "data"], multiplier: 0.9 },
  { employerFamily: "Meta", category: "OPS", keywords: ["support", "admin", "community"], multiplier: 0.5 },
];
