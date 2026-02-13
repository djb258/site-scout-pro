# ADR-004: Zoning API & Regrid Integration

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
| CC-04 Process | Regrid API implementation |

## IMO Layer Scope

| Layer | Impact |
|-------|--------|
| Ingress | Yes |
| Middle | Yes |
| Egress | No |

## Constant vs Variable

| Type | Name | Description |
|------|------|-------------|
| CONST (Input) | Coordinates | Consumed by Regrid API |
| VAR (Output) | Zoning code, parcel geometry | Produced by Regrid API |


**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.02.T01, SS.02.T02

---

## Context

The Pass-2 Underwriting Hub requires parcel-level zoning information to determine if self-storage is permitted by-right. This is a critical gate per the Barton Doctrine's "Zoning Sovereignty" rule - no variances or political friction allowed.

## Decision

We will use **Regrid API** as the primary source for parcel and zoning data.

### API Details

| Parameter | Value |
|-----------|-------|
| Base URL | `https://app.regrid.com/api/v1/` |
| Auth | API Key |
| Rate Limit | Per contract (typically 10,000/month) |
| Coverage | All US parcels (150M+) |
| Data Points | Parcel boundaries, zoning code, owner info, lot size |

### Implementation

```typescript
interface ZoningResult {
  parcelId: string;
  zoningCode: string;
  zoningDescription: string;
  storagePermitted: 'by_right' | 'conditional' | 'prohibited' | 'unknown';
  setbacks: {
    front: number;
    rear: number;
    side: number;
  };
  maxHeight: number;
  maxCoverage: number;
  lotSize: number;
  acreage: number;
}

async function fetchZoningData(
  lat: number,
  lng: number
): Promise<ZoningResult>

async function fetchZoningByParcelId(
  parcelId: string
): Promise<ZoningResult>
```

## Rationale

1. **Coverage**: Most comprehensive parcel database in US
2. **Zoning Data**: Includes zoning codes for many jurisdictions
3. **Geometry**: Provides parcel boundaries for setback calculations
4. **Updates**: Monthly data refreshes

## Consequences

### Positive
- Single source for parcel + zoning data
- API-accessible (no scraping needed)
- Covers rural and urban areas

### Negative
- Zoning interpretation varies by jurisdiction
- Some jurisdictions have incomplete zoning data
- Cost scales with usage

## Zoning Classification Logic

```typescript
function classifyStoragePermitted(zoningCode: string, jurisdiction: string): StoragePermission {
  // Industrial zones (I-1, M-1, etc.) - typically by-right
  if (/^[IM]-?\d/.test(zoningCode)) return 'by_right';

  // Commercial zones (C-2, C-3, B-2) - check specifics
  if (/^[CB]-?\d/.test(zoningCode)) return 'conditional';

  // Agricultural - often permitted for outdoor storage
  if (/^A/.test(zoningCode)) return 'conditional';

  // Residential - typically prohibited
  if (/^R/.test(zoningCode)) return 'prohibited';

  return 'unknown';
}
```

## Fatal Flaw: ZONING_PROHIBITED

Per Barton Doctrine, if storage is not permitted by-right, this triggers an **automatic WALK**:

```typescript
if (zoningResult.storagePermitted === 'prohibited') {
  return {
    fatalFlaw: 'ZONING_PROHIBITED',
    verdict: 'NO_GO',
    reason: 'Storage not permitted in zoning district'
  };
}
```

## Compliance

- [ ] API key stored in environment variables
- [ ] Rate limits monitored
- [ ] Kill switch for API failure
- [ ] Fallback to manual lookup flagged
- [ ] Zoning classification audit trail

## Related Documents

- PRD_PASS2_UNDERWRITING_HUB.md
- BARTON_STORAGE_DOCTRINE.md (Zoning Gate)
- Zoning spoke implementation


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
