import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Workflow, 
  Database, 
  Wrench, 
  ArrowDown,
  Newspaper,
  FileCheck,
  MapPin,
  Search,
  Users,
  Building2,
  Calculator,
  CheckSquare,
  Zap,
  Globe,
  Phone,
  Bot,
  Sparkles
} from "lucide-react";

interface PipelineStep {
  name: string;
  description: string;
  tools: string[];
  outputs: string[];
}

interface PipelineDocConfig {
  passNumber: number;
  title: string;
  purpose: string;
  inputs: string[];
  steps: PipelineStep[];
  outputs: string[];
  dataSources: string[];
}

const PASS_CONFIGS: Record<number, PipelineDocConfig> = {
  0: {
    passNumber: 0,
    title: "Radar Pipeline",
    purpose: "Ephemeral signal detection from news, permits, and narratives. Finds early indicators of development activity.",
    inputs: [
      "RSS feeds (Google News, BizJournals)",
      "Manual URL injection",
      "County permit feeds",
      "State filings",
      "Zoning change alerts"
    ],
    steps: [
      {
        name: "Source Fetcher",
        description: "Pulls content from configured RSS feeds and manual URLs",
        tools: ["pass0_source_fetcher", "RSS Parser"],
        outputs: ["Raw articles", "Press releases"]
      },
      {
        name: "Content Parser",
        description: "Extracts structured signals from raw content using NLP",
        tools: ["pass0_content_parser", "Lovable AI (Gemini)"],
        outputs: ["Development signals", "Company mentions"]
      },
      {
        name: "Geo Resolver",
        description: "Converts location mentions to coordinates",
        tools: ["pass0_geo_resolver", "Geocoder API"],
        outputs: ["Lat/Lng coordinates", "Confidence scores"]
      },
      {
        name: "ZIP Mapper",
        description: "Maps coordinates to ZIP codes using Neon zips_master",
        tools: ["pass0_zip_mapper", "Neon (zips_master)"],
        outputs: ["ZIP assignments", "County associations"]
      },
      {
        name: "Pin Emitter",
        description: "Emits narrative pins with TTL to Supabase",
        tools: ["pass0_pin_emitter", "Supabase (pass0_narrative_pins)"],
        outputs: ["Ephemeral pins", "7-day TTL records"]
      }
    ],
    outputs: [
      "pass0_narrative_pins (Supabase)",
      "pass0_run_log (audit trail)",
      "Confidence-scored location signals"
    ],
    dataSources: [
      "Google News RSS",
      "BizJournals feeds",
      "County permit portals",
      "Neon: zips_master"
    ]
  },
  1: {
    passNumber: 1,
    title: "Pass 1 Exploration",
    purpose: "Cheap reject-first market recon. Gathers demand signals, competition data, and scores viability before expensive research.",
    inputs: [
      "5-digit ZIP code",
      "Radius (miles)",
      "Asset type selection"
    ],
    steps: [
      {
        name: "ZIP Hydration",
        description: "Fetches ZIP metadata from Neon (population, income, coords)",
        tools: ["hub1_pass1_orchestrator", "Neon (zips_master)"],
        outputs: ["ZIP metadata", "Demographics"]
      },
      {
        name: "Radius Analysis",
        description: "Finds all ZIPs within radius using Haversine formula",
        tools: ["hub1_pass1_radius", "Neon (zips_master)"],
        outputs: ["pass1_radius_zip", "County list"]
      },
      {
        name: "Census Snapshot",
        description: "Aggregates population/housing for radius ZIPs",
        tools: ["hub1_pass1_census", "Neon (zips_master)"],
        outputs: ["pass1_census_snapshot", "Population totals"]
      },
      {
        name: "Demand Proxies",
        description: "Calculates baseline demand using 6 SF/person rule",
        tools: ["hub1_pass1_demand", "Demand formula"],
        outputs: ["pass1_demand_agg", "Demand by distance band"]
      },
      {
        name: "Supply Scan (OSM + AI)",
        description: "Finds competitors via OpenStreetMap, then AI search for gaps",
        tools: ["hub1_pass1_supply_osm", "hub15_competitor_search", "Lovable AI", "Overpass API"],
        outputs: ["pass1_supply_snapshot", "Facility list"]
      },
      {
        name: "Scoring",
        description: "Weighted scoring: Demand (40%), Supply (35%), Constraints (25%)",
        tools: ["Scoring engine", "Weight matrix"],
        outputs: ["Viability score", "Decision (advance/reject)"]
      }
    ],
    outputs: [
      "pass1_radius_zip (ZIPs in radius)",
      "pass1_census_snapshot (demographics)",
      "pass1_demand_agg (demand by band)",
      "pass1_supply_agg (supply + gap)",
      "hub1_pass1_run_log (audit)"
    ],
    dataSources: [
      "Neon: zips_master",
      "OpenStreetMap (Overpass API)",
      "Lovable AI (competitor search)",
      "Supabase: competitor_facilities"
    ]
  },
  2: {
    passNumber: 2,
    title: "Constraint Compiler",
    purpose: "Validates jurisdiction constraints from Neon. NO computation, NO inference - just relay what Neon says.",
    inputs: [
      "ZIP code (from Pass 1)",
      "County/jurisdiction context"
    ],
    steps: [
      {
        name: "ZIP Resolution",
        description: "Maps ZIP to county/jurisdiction via Neon",
        tools: ["start_pass2", "Neon (zips_master)"],
        outputs: ["County name", "State"]
      },
      {
        name: "CCA Profile Lookup",
        description: "Fetches county automation method from CCA table",
        tools: ["cca_get_profile", "Neon (ref.cca_county_profile)"],
        outputs: ["pass2_method", "Automation confidence"]
      },
      {
        name: "Jurisdiction Card Fetch",
        description: "Retrieves setbacks, coverage, zoning from Neon",
        tools: ["start_pass2", "Neon (pass2.jurisdiction_cards)"],
        outputs: ["Setbacks", "Max coverage", "Zoning code"]
      },
      {
        name: "Prohibition Check",
        description: "Checks for fatal prohibitions (storage banned, etc.)",
        tools: ["start_pass2", "Neon (pass2.jurisdiction_prohibitions)"],
        outputs: ["Fatal flags", "NO_GO triggers"]
      },
      {
        name: "Gap Analysis",
        description: "Identifies missing required fields needing research",
        tools: ["Constraint analyzer"],
        outputs: ["missing_required_fields", "blocked_fields"]
      }
    ],
    outputs: [
      "Constraint status (ELIGIBLE/HOLD/NO_GO)",
      "Missing field list",
      "Next actions for manual research",
      "County capability assessment"
    ],
    dataSources: [
      "Neon: zips_master",
      "Neon: ref.cca_county_profile",
      "Neon: pass2.jurisdiction_cards",
      "Neon: pass2.jurisdiction_prohibitions",
      "Neon: ref.ref_county_capability"
    ]
  },
  3: {
    passNumber: 3,
    title: "Feasibility Solver",
    purpose: "Forward & Reverse capacity calculations. Given a parcel, compute buildable SF. Given target SF, compute required parcel.",
    inputs: [
      "Parcel dimensions (acres, width, depth)",
      "Jurisdiction card (setbacks, coverage)",
      "Tunables (circulation %, stormwater %)"
    ],
    steps: [
      {
        name: "Setback Deduction",
        description: "Subtracts front/side/rear setbacks from parcel",
        tools: ["solver_run", "Geometry engine"],
        outputs: ["Developable envelope"]
      },
      {
        name: "Stormwater Allocation",
        description: "Reserves % of site for stormwater management",
        tools: ["solver_run", "% allocation"],
        outputs: ["Stormwater area", "Net buildable"]
      },
      {
        name: "Fire Lane Deduction",
        description: "Reserves perimeter for fire access lanes",
        tools: ["solver_run", "Fire code rules"],
        outputs: ["Fire lane area", "Remaining area"]
      },
      {
        name: "Building Footprint",
        description: "Fits building archetypes into remaining area",
        tools: ["solver_run", "Archetype library"],
        outputs: ["Building count", "Total footprint"]
      },
      {
        name: "Unit Count & SF",
        description: "Calculates units and rentable SF from footprint",
        tools: ["solver_run", "Unit mix optimizer"],
        outputs: ["Total units", "Rentable SF"]
      },
      {
        name: "Binding Constraint ID",
        description: "Identifies which constraint limits capacity",
        tools: ["Constraint analyzer"],
        outputs: ["SETBACK/STORMWATER/COVERAGE/FOOTPRINT"]
      }
    ],
    outputs: [
      "Total rentable SF",
      "Unit count",
      "Building count",
      "Utilization %",
      "Binding constraint",
      "Phase 1 viability flag"
    ],
    dataSources: [
      "Neon: pass2.jurisdiction_cards (setbacks)",
      "Solver tunables (UI inputs)",
      "Building archetype library"
    ]
  }
};

// Pass 1.5 config for the remediation pipeline
const PASS_15_CONFIG: PipelineDocConfig = {
  passNumber: 1.5,
  title: "Rent Recon (Remediation)",
  purpose: "4-tier cost ladder to fill data gaps: OSM → AI Search → Web Scrape → AI Call. Uses kill switch for cost control.",
  inputs: [
    "competitor_facilities with data gaps",
    "Missing rent data flags",
    "Phone numbers for AI calling"
  ],
  steps: [
    {
      name: "Gap Detection",
      description: "Scans competitor_facilities for incomplete records",
      tools: ["hub15_promote_gaps", "Supabase (competitor_facilities)"],
      outputs: ["pass_1_5_gap_queue", "Priority rankings"]
    },
    {
      name: "Tier 0: OSM (Free)",
      description: "Fetches storage facilities from OpenStreetMap",
      tools: ["hub1_pass1_supply_osm", "Overpass API"],
      outputs: ["Facility names/addresses", "Basic metadata"]
    },
    {
      name: "Tier 1: AI Search",
      description: "Uses Lovable AI to search for competitor pricing",
      tools: ["hub15_competitor_search", "Lovable AI (Gemini)"],
      outputs: ["Web search results", "Price mentions"]
    },
    {
      name: "Tier 2: Web Scrape",
      description: "Scrapes competitor websites for rate cards",
      tools: ["hub15_rate_scraper", "Simple fetch"],
      outputs: ["Rate card data", "Unit availability"]
    },
    {
      name: "Tier 3: AI Call (Expensive)",
      description: "Retell AI calls facility for pricing (last resort)",
      tools: ["hub15_ai_caller", "Retell API"],
      outputs: ["Verified rates", "Call transcript"]
    },
    {
      name: "Resolution",
      description: "Updates competitor record with new data",
      tools: ["hub15_resolve_gap", "Supabase (competitor_facilities)"],
      outputs: ["Updated record", "Confidence score"]
    }
  ],
  outputs: [
    "Updated competitor_facilities",
    "pass_1_5_attempt_log (cost tracking)",
    "ai_cost_tracker (spend monitoring)"
  ],
  dataSources: [
    "Supabase: competitor_facilities",
    "Supabase: pass_1_5_gap_queue",
    "OpenStreetMap (Overpass)",
    "Lovable AI Gateway",
    "Retell AI (calling)"
  ]
};

interface PipelineDocPanelProps {
  passNumber: number | 1.5;
}

export const PipelineDocPanel = ({ passNumber }: PipelineDocPanelProps) => {
  const config = passNumber === 1.5 ? PASS_15_CONFIG : PASS_CONFIGS[passNumber];
  
  if (!config) return null;

  const getStepIcon = (stepName: string) => {
    const name = stepName.toLowerCase();
    if (name.includes('source') || name.includes('fetch')) return <Newspaper className="h-4 w-4" />;
    if (name.includes('geo') || name.includes('zip') || name.includes('radius')) return <MapPin className="h-4 w-4" />;
    if (name.includes('census') || name.includes('population')) return <Users className="h-4 w-4" />;
    if (name.includes('supply') || name.includes('competition') || name.includes('osm')) return <Building2 className="h-4 w-4" />;
    if (name.includes('scrape') || name.includes('web')) return <Globe className="h-4 w-4" />;
    if (name.includes('call') || name.includes('phone')) return <Phone className="h-4 w-4" />;
    if (name.includes('ai') || name.includes('search')) return <Sparkles className="h-4 w-4" />;
    if (name.includes('scor') || name.includes('calc')) return <Calculator className="h-4 w-4" />;
    if (name.includes('constraint') || name.includes('check')) return <CheckSquare className="h-4 w-4" />;
    if (name.includes('cca') || name.includes('profile')) return <FileCheck className="h-4 w-4" />;
    return <Zap className="h-4 w-4" />;
  };

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          Pipeline Documentation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Purpose */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Purpose</div>
          <p className="text-sm">{config.purpose}</p>
        </div>

        <Accordion type="multiple" defaultValue={["inputs", "steps"]} className="space-y-2">
          {/* Inputs */}
          <AccordionItem value="inputs" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline">
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-400" />
                Inputs
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <ul className="space-y-1">
                {config.inputs.map((input, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {input}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* Pipeline Steps */}
          <AccordionItem value="steps" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline">
              <span className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-amber-400" />
                Pipeline Steps ({config.steps.length})
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-3">
              {config.steps.map((step, i) => (
                <div key={i} className="relative">
                  {i < config.steps.length - 1 && (
                    <div className="absolute left-[11px] top-8 h-[calc(100%)] w-px bg-border" />
                  )}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono">
                      {i + 1}
                    </div>
                    <div className="flex-1 space-y-1 pb-2">
                      <div className="flex items-center gap-2">
                        {getStepIcon(step.name)}
                        <span className="text-sm font-medium">{step.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {step.tools.map((tool, j) => (
                          <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0">
                            {tool}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70">
                        → {step.outputs.join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* Outputs */}
          <AccordionItem value="outputs" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline">
              <span className="flex items-center gap-2">
                <ArrowDown className="h-4 w-4 text-emerald-400" />
                Outputs
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <ul className="space-y-1">
                {config.outputs.map((output, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-emerald-400">→</span>
                    <code className="bg-muted px-1 rounded text-[10px]">{output}</code>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* Data Sources */}
          <AccordionItem value="sources" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline">
              <span className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-purple-400" />
                Data Sources & Tools
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="flex flex-wrap gap-1">
                {config.dataSources.map((source, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
                    {source}
                  </Badge>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default PipelineDocPanel;
