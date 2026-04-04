import { Radio, BarChart3, Building2, Calculator, MapPin, Scale, LucideIcon } from "lucide-react";

export interface SubHubConfig {
  id: number;
  title: string;
  icon: LucideIcon;
  anchors: string[];
  reads: string[];
  rule: string;
  writes: string[];
  neverDoes: string;
  killSwitch: string;
  purpose: string;
  color: string;
  bgColor: string;
  refTables: string[]; // Reference tables this sub-hub depends on
}

export const anchorDefinitions: Record<string, string> = {
  "ZIP": "atomic data ingest & search anchor",
  "County FIPS": "jurisdiction & rule authority",
  "SVA": "decision container / work-order identity",
  "Parcel ID": "promoted asset identity (post-discovery only)",
};

export const subHubs: SubHubConfig[] = [
  {
    id: 0,
    title: "Signals / Smoke",
    icon: Radio,
    anchors: ["ZIP", "County FIPS"],
    reads: ["addresses", "lat/long", "county filings"],
    writes: ["ZIP (signals, inspections, news)", "County FIPS (permits, filing velocity)"],
    rule: "Write at highest certainty source",
    neverDoes: "calculations or decisions",
    killSwitch: "signal confidence below threshold",
    purpose: "Early activity, inspections, news, permit velocity",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    refTables: ["ref_zip_county", "ref_zip_replica"],
  },
  {
    id: 1,
    title: "Market Reality",
    icon: BarChart3,
    anchors: ["ZIP"],
    reads: ["census", "competitors", "population"],
    writes: ["ZIP-level demand & saturation facts"],
    rule: "No jurisdictional logic here",
    neverDoes: "zoning or jurisdiction logic",
    killSwitch: "demand math fails minimums",
    purpose: "Demand, population, competitors, saturation",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    refTables: ["ref_zip_replica"],
  },
  {
    id: 2,
    title: "County Card (Constants)",
    icon: Building2,
    anchors: ["County FIPS"],
    reads: ["ordinances", "zoning codes", "regional cost indices"],
    writes: ["County Card (rules + constants)"],
    rule: "No math. Facts only.",
    neverDoes: "calculations or scoring",
    killSwitch: "zoning disallows asset type",
    purpose: "Zoning posture, ordinances, build constants, cost indices",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    refTables: ["ref_county_fips", "ref_county_capability"],
  },
  {
    id: 3,
    title: "Calculators",
    icon: Calculator,
    anchors: ["SVA"],
    reads: ["ZIP facts", "County Card constants"],
    writes: ["SVA-only scores, scenarios, feasibility"],
    rule: "Read-only. No geography writes.",
    neverDoes: "store geography or rules",
    killSwitch: "feasibility below doctrine thresholds",
    purpose: "Feasibility, density, ROI, scoring",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    refTables: ["ref_zip_replica"],
  },
  {
    id: 4,
    title: "Parcel Discovery",
    icon: MapPin,
    anchors: ["ZIP", "Parcel ID"],
    reads: ["ZIP scope", "County Card rules"],
    writes: ["SVA (parcel candidates)", "Parcel ID (promoted parcels only)"],
    rule: "ZIP-driven search, FIPS-validated",
    neverDoes: "market recalculation",
    killSwitch: "parcel fails hard gates",
    purpose: "Find viable parcels inside approved ZIPs",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    refTables: ["ref_zip_county", "ref_zip_replica"],
  },
  {
    id: 5,
    title: "Deal Gate (Doctrine)",
    icon: Scale,
    anchors: ["SVA", "Parcel ID"],
    reads: ["all prior sub-hub outputs"],
    writes: ["final decision log (GOOD / BAD)"],
    rule: "Binary. No overrides without doctrine exception.",
    neverDoes: "discovery or math",
    killSwitch: "any hard doctrine violation",
    purpose: "GOOD DEAL / BAD DEAL",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    refTables: [],
  },
];

export const doctrineLocks = [
  "ZIP is the atomic ingest anchor",
  "County FIPS is the rule authority",
  "Asset Type determines data recipe",
  "Sovereign IDs are minted from intent",
  "Sub-Hubs never redefine identity",
];

export const mentalModel = [
  { term: "Anchors", rule: "do not move" },
  { term: "Sub-Hubs", rule: "are workers" },
  { term: "SVA", rule: "is the spine" },
  { term: "ZIP", rule: "is the atom" },
  { term: "FIPS", rule: "is the rulebook" },
];

export const assetTypes = [
  { value: "self-storage", label: "Self-Storage" },
  { value: "rv-storage", label: "RV Storage" },
  { value: "boat-storage", label: "Boat Storage" },
  { value: "truck-tractor", label: "Truck / Tractor Parking" },
  { value: "tow-impound", label: "Tow & Impound / Insurance Yard" },
];

export const radiusOptions = [
  { value: 25, label: "25 miles" },
  { value: 50, label: "50 miles" },
  { value: 75, label: "75 miles" },
  { value: 100, label: "100 miles" },
  { value: 120, label: "120 miles" },
];

export const summaryAnchors = [
  { term: "ZIP", definition: "atomic data anchor" },
  { term: "County FIPS", definition: "jurisdiction & rules anchor" },
  { term: "SVA", definition: "decision identity" },
  { term: "Asset Type", definition: "changes the recipe for all sub-hubs" },
];
