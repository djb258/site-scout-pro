/**
 * BARTON TOOL LEDGER
 * 
 * Doctrine-locked pipeline configuration.
 * "Deterministic First, LLM Tail Only"
 * 
 * Users select pipeline steps.
 * The system selects tools from this approved ledger.
 * No tool sprawl. No vibes. No exceptions.
 */

export type ToolType = 
  | 'deterministic' 
  | 'llm_tail' 
  | 'llm_tier' 
  | 'llm_tail_expensive' 
  | 'external_agent';

export interface LedgerStep {
  step: number;
  name: string;
  solution: string;
  type: ToolType;
  cost?: number; // Cost per execution in dollars
  locked?: boolean; // Cannot be skipped or replaced
}

export interface PipelineLedger {
  pass0: LedgerStep[];
  pass1: LedgerStep[];
  pass15: LedgerStep[];
  pass2: LedgerStep[];
  pass3: LedgerStep[];
  cca: LedgerStep[];
}

export const BARTON_TOOL_LEDGER: PipelineLedger = {
  pass0: [
    { step: 1, name: "Source Fetcher", solution: "RSS Parser", type: "deterministic", locked: true },
    { step: 2, name: "Content Parser", solution: "Lovable AI (Gemini)", type: "llm_tail", cost: 0.01 },
    { step: 3, name: "Geo Resolver", solution: "Geocoder API", type: "deterministic", locked: true },
    { step: 4, name: "ZIP Mapper", solution: "Neon zips_master", type: "deterministic", locked: true },
    { step: 5, name: "Pin Emitter", solution: "Supabase insert", type: "deterministic", locked: true }
  ],
  pass1: [
    { step: 1, name: "ZIP Hydration", solution: "Neon query", type: "deterministic", locked: true },
    { step: 2, name: "Radius Analysis", solution: "Haversine formula", type: "deterministic", locked: true },
    { step: 3, name: "Census Snapshot", solution: "Aggregation query", type: "deterministic", locked: true },
    { step: 4, name: "Demand Proxy", solution: "6 SF/person formula", type: "deterministic", locked: true },
    { step: 5, name: "Supply Scan OSM", solution: "Overpass API", type: "deterministic", locked: true },
    { step: 6, name: "Supply Scan AI", solution: "Lovable AI Search", type: "llm_tail", cost: 0.02 },
    { step: 7, name: "Scoring", solution: "Weighted matrix", type: "deterministic", locked: true }
  ],
  pass15: [
    { step: 1, name: "Gap Detection", solution: "DB query", type: "deterministic", locked: true, cost: 0 },
    { step: 2, name: "Tier 0 OSM", solution: "Overpass API", type: "deterministic", cost: 0 },
    { step: 3, name: "Tier 1 AI Search", solution: "Lovable AI", type: "llm_tier", cost: 0.01 },
    { step: 4, name: "Tier 2 Web Scrape", solution: "Fetch + parse", type: "deterministic", cost: 0 },
    { step: 5, name: "Tier 3 AI Call", solution: "Retell AI", type: "llm_tail_expensive", cost: 0.50 }
  ],
  pass2: [
    { step: 1, name: "ZIP Resolution", solution: "Neon lookup", type: "deterministic", locked: true },
    { step: 2, name: "CCA Profile Lookup", solution: "ref.county_capability", type: "deterministic", locked: true },
    { step: 3, name: "Jurisdiction Card", solution: "pass2.v_jurisdiction_card_for_pass3", type: "deterministic", locked: true },
    { step: 4, name: "Prohibition Check", solution: "pass2.has_fatal_prohibition()", type: "deterministic", locked: true },
    { step: 5, name: "Envelope Check", solution: "pass2.is_envelope_complete()", type: "deterministic", locked: true }
  ],
  pass3: [
    { step: 1, name: "Setback Deduction", solution: "Geometry math", type: "deterministic", locked: true },
    { step: 2, name: "Stormwater Allocation", solution: "% calculation", type: "deterministic", locked: true },
    { step: 3, name: "Fire Lane Deduction", solution: "Perimeter math", type: "deterministic", locked: true },
    { step: 4, name: "Building Footprint", solution: "Archetype fitting", type: "deterministic", locked: true },
    { step: 5, name: "Unit Mix", solution: "Optimizer algorithm", type: "deterministic", locked: true },
    { step: 6, name: "Binding Constraint ID", solution: "Min constraint finder", type: "deterministic", locked: true }
  ],
  cca: [
    { step: 1, name: "County Resolution", solution: "ZIP to county lookup", type: "deterministic", locked: true },
    { step: 2, name: "TTL Check", solution: "ref.needs_refresh()", type: "deterministic", locked: true },
    { step: 3, name: "Capability Recon", solution: "Claude Code", type: "external_agent", cost: 0.10 },
    { step: 4, name: "Profile Write", solution: "ref.county_capability upsert", type: "deterministic", locked: true }
  ]
};

// Helper functions
export function getToolTypeLabel(type: ToolType): string {
  const labels: Record<ToolType, string> = {
    deterministic: "Deterministic",
    llm_tail: "LLM Tail",
    llm_tier: "LLM Tiered",
    llm_tail_expensive: "LLM Expensive",
    external_agent: "External Agent"
  };
  return labels[type];
}

export function getToolTypeColor(type: ToolType): string {
  const colors: Record<ToolType, string> = {
    deterministic: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    llm_tail: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    llm_tier: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    llm_tail_expensive: "bg-red-500/20 text-red-400 border-red-500/30",
    external_agent: "bg-purple-500/20 text-purple-400 border-purple-500/30"
  };
  return colors[type];
}

export function getPipelineStats(steps: LedgerStep[]) {
  const total = steps.length;
  const deterministic = steps.filter(s => s.type === 'deterministic').length;
  const llmSteps = steps.filter(s => s.type !== 'deterministic' && s.type !== 'external_agent');
  const totalCost = steps.reduce((sum, s) => sum + (s.cost || 0), 0);
  const locked = steps.filter(s => s.locked).length;
  
  return {
    total,
    deterministic,
    llmCount: llmSteps.length,
    deterministicPercent: Math.round((deterministic / total) * 100),
    totalCost,
    locked
  };
}
