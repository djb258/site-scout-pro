# ADR-015: USGS DEM (Digital Elevation Model) API

**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.02.T04

---

## Context

The Pass-2 CivilConstraints spoke requires terrain/slope data to identify properties with prohibitive topography. Properties with slopes exceeding 15% trigger a fatal flaw per Barton Doctrine due to excessive dirt work costs.

## Decision

We will integrate the **USGS 3DEP (3D Elevation Program)** API to retrieve elevation data and calculate slope percentages for parcels.

### API Details

**Endpoint:** `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer`

**Query Method:** ArcGIS REST API with identify operation

```typescript
interface ElevationRequest {
  geometry: {
    x: number;  // longitude
    y: number;  // latitude
  };
  geometryType: 'esriGeometryPoint';
  returnGeometry: false;
  f: 'json';
}

interface ElevationResponse {
  value: number;  // Elevation in meters
  location: {
    x: number;
    y: number;
  };
}
```

### Slope Calculation

To calculate slope, we sample elevation at multiple points:

```typescript
interface SlopeAnalysis {
  centerElevation: number;
  maxElevation: number;
  minElevation: number;
  elevationRange: number;
  avgSlope: number;
  maxSlope: number;
  slopeCategory: 'flat' | 'gentle' | 'moderate' | 'steep' | 'prohibitive';
}

async function calculateSlope(
  centerLat: number,
  centerLng: number,
  radiusFeet: number = 200
): Promise<SlopeAnalysis> {
  // Sample 9 points: center + 8 cardinal/ordinal directions
  const points = generateSamplePoints(centerLat, centerLng, radiusFeet);
  const elevations = await Promise.all(points.map(p => getElevation(p.lat, p.lng)));

  const maxElev = Math.max(...elevations);
  const minElev = Math.min(...elevations);
  const elevRange = maxElev - minElev;

  // Calculate slope as percentage: (rise / run) * 100
  const runFeet = radiusFeet * 2;
  const riseMeters = elevRange;
  const riseFeet = riseMeters * 3.28084;
  const slopePct = (riseFeet / runFeet) * 100;

  return {
    centerElevation: elevations[0],
    maxElevation: maxElev,
    minElevation: minElev,
    elevationRange: elevRange,
    avgSlope: slopePct,
    maxSlope: slopePct,
    slopeCategory: categorizaSlope(slopePct)
  };
}

function categorizeSlope(pct: number): string {
  if (pct <= 2) return 'flat';
  if (pct <= 5) return 'gentle';
  if (pct <= 10) return 'moderate';
  if (pct <= 15) return 'steep';
  return 'prohibitive';  // > 15% = FATAL FLAW
}
```

### Slope Thresholds (Barton Doctrine)

| Slope % | Category | Action |
|---------|----------|--------|
| 0-2% | Flat | Ideal |
| 2-5% | Gentle | Good |
| 5-10% | Moderate | Acceptable |
| 10-15% | Steep | Warning - increased dirt work |
| >15% | Prohibitive | FATAL FLAW - Auto WALK |

### Implementation in CivilConstraints

```typescript
async function checkTopography(lat: number, lng: number, acreage: number): Promise<TopographyResult> {
  const radiusFeet = Math.sqrt(acreage * 43560) / 2;  // Approximate parcel radius
  const slope = await calculateSlope(lat, lng, radiusFeet);

  const isFatalFlaw = slope.maxSlope > 15;
  const warnings: string[] = [];

  if (slope.maxSlope > 10 && slope.maxSlope <= 15) {
    warnings.push(`Slope of ${slope.maxSlope.toFixed(1)}% will increase dirt work costs`);
  }

  return {
    elevation: slope.centerElevation,
    elevationRange: slope.elevationRange,
    avgSlope: slope.avgSlope,
    maxSlope: slope.maxSlope,
    category: slope.slopeCategory,
    isFatalFlaw,
    fatalFlawReason: isFatalFlaw ? 'PROHIBITIVE_TOPOGRAPHY' : undefined,
    warnings
  };
}
```

## Rationale

1. **Doctrine Compliance**: Slope > 15% triggers kill switch
2. **Free API**: No cost, authoritative federal data
3. **High Resolution**: 1/3 arc-second (~10m) resolution
4. **Dirt Work Estimation**: Enables cost modeling

## Consequences

### Positive
- Free, authoritative elevation data
- Nationwide coverage
- High resolution for accurate slope calculation

### Negative
- Multiple API calls needed for slope calculation
- Can be slow in high-demand periods
- Some areas may have lower resolution data

## Rate Limiting

- Implement 500ms delay between requests
- Batch sample points where possible
- Cache elevation data for 90 days

## Related Documents

- PRD_PASS2_UNDERWRITING_HUB.md
- CivilConstraints spoke implementation
- ADR-011-build-cost-calculator.md (dirt work estimation)
