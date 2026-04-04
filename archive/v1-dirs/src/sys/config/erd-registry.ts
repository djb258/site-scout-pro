/**
 * ERD Registry - Static registry of all ERD artifacts
 * Read-only configuration for ERD viewer
 */

export interface ERDEntry {
  id: string;
  name: string;
  anchor: string;
  anchorInvariant: string;
  mdPath: string;
  mermaidPath: string;
  color: string;
}

export const ERD_REGISTRY: ERDEntry[] = [
  {
    id: "shared-ref",
    name: "Shared / Reference",
    anchor: "System",
    anchorInvariant: "Global reference tables accessible by all sub-hubs (READ-ONLY).",
    mdPath: "docs/erd/ERD_Shared_Ref.md",
    mermaidPath: "docs/erd/ERD_Shared_Ref.mermaid",
    color: "hsl(var(--muted))",
  },
  {
    id: "subhub0",
    name: "Sub-Hub 0: Signals",
    anchor: "ZIP Code",
    anchorInvariant: "All rows must trace to exactly one ZIP code within an SVA scope.",
    mdPath: "docs/erd/ERD_SubHub0_Signals.md",
    mermaidPath: "docs/erd/ERD_SubHub0_Signals.mermaid",
    color: "hsl(210 100% 50%)",
  },
  {
    id: "subhub1",
    name: "Sub-Hub 1: Market",
    anchor: "ZIP Code",
    anchorInvariant: "All rows must trace to exactly one ZIP code or facility within SVA scope.",
    mdPath: "docs/erd/ERD_SubHub1_Market.md",
    mermaidPath: "docs/erd/ERD_SubHub1_Market.mermaid",
    color: "hsl(150 100% 40%)",
  },
  {
    id: "subhub2",
    name: "Sub-Hub 2: County Card",
    anchor: "County FIPS",
    anchorInvariant: "All rows must trace to exactly one County FIPS.",
    mdPath: "docs/erd/ERD_SubHub2_CountyCard.md",
    mermaidPath: "docs/erd/ERD_SubHub2_CountyCard.mermaid",
    color: "hsl(45 100% 50%)",
  },
  {
    id: "subhub3",
    name: "Sub-Hub 3: Calculators",
    anchor: "SVA (Sovereign ID)",
    anchorInvariant: "All calculations must reference a valid SVA or Pass 1 run.",
    mdPath: "docs/erd/ERD_SubHub3_Calculators.md",
    mermaidPath: "docs/erd/ERD_SubHub3_Calculators.mermaid",
    color: "hsl(280 100% 60%)",
  },
  {
    id: "subhub4",
    name: "Sub-Hub 4: Parcel",
    anchor: "Parcel ID",
    anchorInvariant: "All rows must trace to exactly one site intake or parcel candidate.",
    mdPath: "docs/erd/ERD_SubHub4_Parcel.md",
    mermaidPath: "docs/erd/ERD_SubHub4_Parcel.mermaid",
    color: "hsl(0 100% 60%)",
  },
  {
    id: "subhub5",
    name: "Sub-Hub 5: DealGate",
    anchor: "Deal ID",
    anchorInvariant: "All rows must trace to exactly one promoted deal or verdict.",
    mdPath: "docs/erd/ERD_SubHub5_DealGate.md",
    mermaidPath: "docs/erd/ERD_SubHub5_DealGate.mermaid",
    color: "hsl(320 100% 50%)",
  },
];

export const getERDById = (id: string): ERDEntry | undefined => {
  return ERD_REGISTRY.find((e) => e.id === id);
};
