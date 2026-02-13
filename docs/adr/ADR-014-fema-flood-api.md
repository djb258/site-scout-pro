# ADR-014: FEMA Flood API

## Conformance

| Field | Value |
|-------|-------|
| Doctrine Version | 2.0.0 |
| CTB Version | 2.0.0 |
| CC Layer | CC-04 |
| Governing Hub | barton-storage (CC-02) |

## Owning Hub

| Field | Value |
|-------|-------|
| Hub ID | barton-storage |
| Hub Name | Barton Storage System |
| CC Layer | CC-02 |

## CC Layer Scope

| Layer | Relevance |
|-------|-----------|
| CC-01 Sovereign | Governed by barton-family-office |
| CC-02 Hub | barton-storage |
| CC-03 Context | pass2-underwriting |
| CC-04 Process | FEMA Flood API implementation |

## IMO Layer Scope

| Layer | Impact |
|-------|--------|
| Ingress | Yes |
| Middle | Yes |
| Egress | No |

## Constant vs Variable

| Type | Name | Description |
|------|------|-------------|
| CONST (Input) | Coordinates | Consumed by FEMA Flood API |
| VAR (Output) | Flood zone classification | Produced by FEMA Flood API |


**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.02.T03

---

## Context

The Pass-2 CivilConstraints spoke requires flood zone data to identify properties in high-risk flood areas. Properties in FEMA-designated high-risk flood zones (Zone A, AE, V, VE) trigger a fatal flaw and automatic WALK per Barton Doctrine.

## Decision

We will integrate the **FEMA National Flood Hazard Layer (NFHL)** API to retrieve flood zone designations for parcels.

### API Details

**Endpoint:** `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer`

**Query Method:** ArcGIS REST API with geometry intersection

```typescript
interface FloodZoneRequest {
  geometry: {
    x: number;  // longitude
    y: number;  // latitude
  };
  geometryType: 'esriGeometryPoint';
  spatialRel: 'esriSpatialRelIntersects';
  outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF';
  f: 'json';
}

interface FloodZoneResponse {
  features: Array<{
    attributes: {
      FLD_ZONE: string;      // A, AE, V, VE, X, etc.
      ZONE_SUBTY: string;    // Zone subtype
      SFHA_TF: string;       // Special Flood Hazard Area (T/F)
    };
  }>;
}
```

### Flood Zone Classifications

| Zone | Risk Level | Action |
|------|------------|--------|
| A, AE | High Risk | FATAL FLAW - Auto WALK |
| V, VE | Coastal High Risk | FATAL FLAW - Auto WALK |
| AH, AO | High Risk (Shallow) | FATAL FLAW - Auto WALK |
| X (shaded) | Moderate Risk | WARNING |
| X (unshaded) | Minimal Risk | PASS |
| D | Undetermined | WARNING - Manual review |

### Implementation

```typescript
async function checkFloodZone(lat: number, lng: number): Promise<FloodZoneResult> {
  const url = new URL('https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query');
  url.searchParams.set('geometry', JSON.stringify({ x: lng, y: lat }));
  url.searchParams.set('geometryType', 'esriGeometryPoint');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('outFields', 'FLD_ZONE,ZONE_SUBTY,SFHA_TF');
  url.searchParams.set('f', 'json');

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!data.features || data.features.length === 0) {
    return { zone: 'UNKNOWN', riskLevel: 'undetermined', isFatalFlaw: false };
  }

  const zone = data.features[0].attributes.FLD_ZONE;
  const isSFHA = data.features[0].attributes.SFHA_TF === 'T';

  return {
    zone,
    riskLevel: getRiskLevel(zone),
    isFatalFlaw: isHighRiskZone(zone),
    sfha: isSFHA
  };
}

function isHighRiskZone(zone: string): boolean {
  const highRiskZones = ['A', 'AE', 'AH', 'AO', 'AR', 'A99', 'V', 'VE'];
  return highRiskZones.includes(zone);
}
```

## Rationale

1. **Doctrine Compliance**: Flood zones are a kill switch trigger
2. **Free API**: No cost, authoritative federal data
3. **Coverage**: Nationwide flood mapping
4. **Real-time**: Current FEMA designations

## Consequences

### Positive
- Authoritative flood data from FEMA
- Free to use
- Nationwide coverage

### Negative
- API can be slow (2-5 seconds)
- Some areas have outdated maps
- No rate limiting documented (use conservatively)

## Rate Limiting

- Implement 1-second delay between requests
- Cache results for 30 days (flood zones rarely change)
- Fallback to "undetermined" if API fails

## Related Documents

- PRD_PASS2_UNDERWRITING_HUB.md
- CivilConstraints spoke implementation
- BARTON_STORAGE_DOCTRINE.md (Kill Switches)


---

## PID Impact

| Pass | Impact |
|------|--------|
| Pass 0 | No |
| Pass 1 | No |
| Pass 1.5 | No |
| Pass 2 | Yes |
| Pass 3 | No |

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Author | AI Agent | 2026-02-13 | DRAFTED |
| Reviewer | --- | --- | PENDING |
| Sovereign | barton-family-office | --- | PENDING |
