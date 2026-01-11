/**
 * Reference Schema Registry
 * 
 * Documents all reference data tables available for anchor resolution.
 * These tables provide bidirectional lookups for ZIP↔County mapping
 * and other reference data used by sub-hubs.
 */

export interface RefTableConfig {
  table: string;
  schema: "ref" | "pass1" | "pass2" | "public";
  description: string;
  rowCount: number;
  lastUpdated: string;
  anchors: string[];
  lookupDirections: string[];
  usedBy: number[]; // Sub-hub IDs that use this table
}

export const refSchemaRegistry: RefTableConfig[] = [
  {
    table: "ref_zip_county",
    schema: "ref",
    description: "Bidirectional ZIP to County FIPS mapping",
    rowCount: 46641,
    lastUpdated: "2025-01-11",
    anchors: ["ZIP", "County FIPS"],
    lookupDirections: ["ZIP → County FIPS", "County FIPS → ZIPs"],
    usedBy: [0, 1, 2, 4],
  },
  {
    table: "ref_zip_replica",
    schema: "ref",
    description: "Read-only ZIP master data with coordinates",
    rowCount: 33486,
    lastUpdated: "2025-01-11",
    anchors: ["ZIP"],
    lookupDirections: ["ZIP → Demographics/Coords"],
    usedBy: [0, 1, 3, 4],
  },
  {
    table: "ref_county_fips",
    schema: "ref",
    description: "County FIPS codes with state associations",
    rowCount: 3222,
    lastUpdated: "2025-01-11",
    anchors: ["County FIPS"],
    lookupDirections: ["FIPS → County Name/State"],
    usedBy: [0, 2, 5],
  },
  {
    table: "ref_county_capability",
    schema: "ref",
    description: "County automation capabilities for Pass 2",
    rowCount: 0, // To be populated
    lastUpdated: "2025-01-11",
    anchors: ["County FIPS"],
    lookupDirections: ["FIPS → Capability Score"],
    usedBy: [2],
  },
];

/**
 * Maps sub-hub IDs to the reference tables they depend on
 */
export const subHubRefDependencies: Record<number, string[]> = {
  0: ["ref_zip_county", "ref_zip_replica"],
  1: ["ref_zip_replica"],
  2: ["ref_county_fips", "ref_county_capability"],
  3: ["ref_zip_replica"],
  4: ["ref_zip_county", "ref_zip_replica"],
  5: [], // Reads from prior outputs only
};

/**
 * Anchor resolution query examples for UI reference
 */
export const anchorResolutionExamples: Record<string, string> = {
  "ZIP → County": `SELECT county_fips, county_name, state_code 
FROM ref.ref_zip_county 
WHERE zip_code = '22314'`,

  "County → ZIPs": `SELECT zip_code 
FROM ref.ref_zip_county 
WHERE county_fips = '51059' 
ORDER BY zip_code`,

  "ZIP → Coordinates": `SELECT lat, lng, city, state_code 
FROM ref.ref_zip_replica 
WHERE zip_code = '22314'`,

  "FIPS → County Name": `SELECT county_name, state_name 
FROM ref.ref_county_fips 
WHERE fips = '51059'`,
};

/**
 * Data statistics for display
 */
export const refDataStats = {
  totalMappings: 46641,
  uniqueZips: 33486,
  uniqueCounties: 3222,
  statesWithData: 51, // 50 + DC
  multiCountyZips: 1234, // ZIPs spanning multiple counties
};

/**
 * Get reference tables used by a specific sub-hub
 */
export function getRefTablesForSubHub(subHubId: number): RefTableConfig[] {
  const tableNames = subHubRefDependencies[subHubId] || [];
  return refSchemaRegistry.filter((t) => tableNames.includes(t.table));
}
