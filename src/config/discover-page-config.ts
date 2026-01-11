import { Radio, BarChart3, Building2, Calculator, MapPin, Scale } from "lucide-react";

export const subHubs = [
  {
    id: 0,
    title: "Signals / Smoke",
    icon: Radio,
    reads: ["ZIP", "County FIPS"],
    writes: ["ZIP (signals)", "County FIPS (permits)"],
    purpose: "Early activity, inspections, news, permit velocity",
    rule: "Write at highest certainty source",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    id: 1,
    title: "Market Reality",
    icon: BarChart3,
    reads: ["ZIP"],
    writes: ["ZIP"],
    purpose: "Demand, population, competitors, saturation",
    rule: "No jurisdictional logic here",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  {
    id: 2,
    title: "County Card (Constants)",
    icon: Building2,
    reads: ["County FIPS"],
    writes: ["County FIPS"],
    purpose: "Zoning posture, ordinances, build constants, cost indices",
    rule: "No math. Facts only.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  {
    id: 3,
    title: "Calculators",
    icon: Calculator,
    reads: ["ZIP + County Card"],
    writes: ["SVA only"],
    purpose: "Feasibility, density, ROI, scoring",
    rule: "Read-only. No geography writes.",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  {
    id: 4,
    title: "Parcel Discovery",
    icon: MapPin,
    reads: ["ZIP scope + County rules"],
    writes: ["SVA (candidates)", "Parcel ID (promotion)"],
    purpose: "Find viable parcels inside approved ZIPs",
    rule: "ZIP-driven search, FIPS-validated",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
  },
  {
    id: 5,
    title: "Deal Gate (Doctrine)",
    icon: Scale,
    reads: ["All prior outputs"],
    writes: ["Final Decision Log"],
    purpose: "GOOD DEAL / BAD DEAL",
    rule: "Binary. No overrides without doctrine exception.",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
];

export const doctrineLocks = [
  "ZIP is the atomic ingest anchor",
  "County FIPS is the rule authority",
  "Asset Type determines data recipe",
  "Sovereign IDs are minted from intent",
  "Sub-Hubs never redefine identity",
];

export const assetTypes = [
  { value: "self-storage", label: "Self-Storage" },
  { value: "rv", label: "RV" },
  { value: "truck", label: "Truck" },
  { value: "boat", label: "Boat" },
];

export const summaryAnchors = [
  { term: "ZIP", definition: "atomic data anchor" },
  { term: "County FIPS", definition: "jurisdiction & rules anchor" },
  { term: "SVA", definition: "decision identity" },
  { term: "Asset Type", definition: "changes the recipe for all sub-hubs" },
];
