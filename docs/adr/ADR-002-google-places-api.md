# ADR-002: Google Places API Integration

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
