# ADR-001: Census API Integration

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
| CC-04 Process | Census API implementation |

## IMO Layer Scope

| Layer | Impact |
|-------|--------|
| Ingress | Yes |
| Middle | Yes |
| Egress | No |

## Constant vs Variable

| Type | Name | Description |
|------|------|-------------|
| CONST (Input) | ZIP code, FIPS code | Consumed by Census API |
| VAR (Output) | Population, income, housing units | Produced by Census API |


**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.01.T01

---

## Context

The Pass-1 Structure Hub requires demographic and population data to calculate demand indicators for storage site evaluation. This includes population, median household income, housing units, and other census variables.

## Decision

We will use the **US Census Bureau API** (American Community Survey 5-Year Estimates) as the primary source for demographic data.

### API Details

| Parameter | Value |
|-----------|-------|
| Base URL | `https://api.census.gov/data/2022/acs/acs5` |
| Auth | API Key (free registration) |
| Rate Limit | 500 requests/day |
| Variables | B01003_001E (pop), B19013_001E (income), B25001_001E (housing units) |

### Implementation

```typescript
interface CensusResponse {
  population: number;
  medianIncome: number;
  housingUnits: number;
  geography: string;
}

async function fetchCensusData(zipCode: string, state: string): Promise<CensusResponse>
```

## Rationale

1. **Official Source**: Census Bureau is the authoritative source for US demographic data
2. **Free Tier**: 500 requests/day is sufficient for our volume
3. **5-Year Estimates**: More reliable than 1-year estimates for smaller geographies
4. **Coverage**: Available for all ZIP codes in the US

## Consequences

### Positive
- Reliable, authoritative data
- Free API with generous limits
- Well-documented endpoints

### Negative
- Data is 1-2 years behind current date
- Some small ZIPs may have suppressed data
- Rate limits require caching strategy

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Data.gov | Less structured, harder to query |
| Third-party providers | Cost prohibitive, same underlying data |
| Static datasets | Outdated too quickly |

## Compliance

- [ ] Rate limits implemented (500/day)
- [ ] Caching enabled (24-hour TTL)
- [ ] Fallback to cached data on API failure
- [ ] Kill switch integrated

## Related Documents

- PRD_PASS1_STRUCTURE_HUB.md
- ZipHydration spoke implementation


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
