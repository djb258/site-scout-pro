# ADR-002: Google Places API Integration

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
| CC-03 Context | pass1-market |
| CC-04 Process | Google Places API implementation |

## IMO Layer Scope

| Layer | Impact |
|-------|--------|
| Ingress | Yes |
| Middle | Yes |
| Egress | No |

## Constant vs Variable

| Type | Name | Description |
|------|------|-------------|
| CONST (Input) | Coordinates, radius | Consumed by Google Places API |
| VAR (Output) | Competitor facilities, locations | Produced by Google Places API |


**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.01.T06

---

## Context

The Pass-1 Structure Hub requires competitor discovery to identify existing self-storage facilities within a target market. This data feeds into MacroSupply and CompetitorRegistry spokes for supply calculations and competitive analysis.

## Decision

We will use the **Google Places API (Nearby Search)** as the primary source for competitor discovery.

### API Details

| Parameter | Value |
|-----------|-------|
| Base URL | `https://maps.googleapis.com/maps/api/place/nearbysearch/json` |
| Auth | API Key |
| Rate Limit | 1000 requests/day (configurable) |
| Cost | $0.032 per request (after free tier) |
| Search Type | `self_storage`, `storage_rental` |

### Implementation

```typescript
interface PlacesSearchResult {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: { lat: number; lng: number };
  rating?: number;
  user_ratings_total?: number;
  types: string[];
}

async function searchNearbyStorage(
  lat: number,
  lng: number,
  radiusMiles: number
): Promise<PlacesSearchResult[]>
```

## Rationale

1. **Coverage**: Most comprehensive POI database available
2. **Accuracy**: Regularly updated with business listings
3. **Metadata**: Includes ratings, reviews, hours of operation
4. **Pagination**: Supports up to 60 results per search

## Consequences

### Positive
- Best-in-class coverage for business listings
- Rich metadata (ratings, reviews, photos)
- Reliable uptime and performance

### Negative
- Cost per request adds up at scale
- May include non-storage businesses in results
- Rate limits require batch processing

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Yelp Fusion API | Less complete for commercial storage |
| Foursquare Places | Lower coverage in rural areas |
| OpenStreetMap | Inconsistent business data |
| Manual scraping | ToS violations, maintenance burden |

## Compliance

- [ ] API key stored in environment variables
- [ ] Rate limits implemented (1000/day)
- [ ] Cost monitoring enabled
- [ ] Kill switch for quota exhaustion
- [ ] Results cached (7-day TTL)

## Related Documents

- PRD_PASS1_STRUCTURE_HUB.md
- MacroSupply spoke implementation
- CompetitorRegistry spoke implementation


---

## PID Impact

| Pass | Impact |
|------|--------|
| Pass 0 | No |
| Pass 1 | Yes |
| Pass 1.5 | No |
| Pass 2 | No |
| Pass 3 | No |

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Author | AI Agent | 2026-02-13 | DRAFTED |
| Reviewer | --- | --- | PENDING |
| Sovereign | barton-family-office | --- | PENDING |
