# ADR-008: Google Trends API Integration

**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.00.T01

---

## Context

The Pass-0 Radar Hub requires leading indicators of storage demand before site-specific analysis begins. Search interest for storage-related terms can signal emerging demand in a market.

## Decision

We will use the **Google Trends API** (via unofficial endpoints or pytrends library) to track search interest for storage-related keywords.

### API Details

| Parameter | Value |
|-----------|-------|
| Method | Unofficial API / pytrends |
| Auth | None (public endpoint) |
| Rate Limit | ~100 requests/day (soft limit) |
| Geographic Resolution | DMA, State, or Metro |
| Time Frame | 12-24 months lookback |

### Target Keywords

```typescript
const storageKeywords = [
  'self storage near me',
  'storage units',
  'rv storage',
  'boat storage',
  'moving storage',
  'storage facility'
];
```

### Implementation

```typescript
interface TrendSignal {
  keyword: string;
  geography: string;
  timeframe: string;
  interestIndex: number;      // 0-100 relative scale
  growthRate: number;         // % change YoY
  seasonalAdjusted: boolean;
  peakMonth: string;
}

interface TrendResult {
  signals: TrendSignal[];
  compositeIndex: number;     // 0-100
  trend: 'rising' | 'stable' | 'declining';
  confidence: 'high' | 'medium' | 'low';
}

async function fetchTrendSignals(
  zipCode: string,
  state: string,
  lookbackMonths: number
): Promise<TrendResult>
```

## Rationale

1. **Leading Indicator**: Search interest precedes actual demand
2. **Free**: No API cost
3. **Geographic**: Can target specific DMAs
4. **Seasonal Insight**: Shows demand patterns

## Consequences

### Positive
- Early demand signal
- No cost
- Broad geographic coverage
- Historical data available

### Negative
- Unofficial API may change
- Rate limits are soft/unpredictable
- Relative scale (not absolute numbers)
- May not correlate perfectly with storage demand

## Trend Interpretation

| Index Range | Trend | Signal |
|-------------|-------|--------|
| > 75 | High interest | Strong demand signal |
| 50-75 | Moderate | Normal market |
| 25-50 | Low | Weak demand signal |
| < 25 | Very low | Caution flag |

| Growth Rate | Signal |
|-------------|--------|
| > 20% YoY | Strong positive |
| 5-20% YoY | Positive |
| -5% to 5% | Stable |
| < -5% YoY | Declining |

## Compliance

- [ ] Rate limiting implemented (100/day)
- [ ] Caching enabled (24-hour TTL)
- [ ] Fallback to cached data on API failure
- [ ] Kill switch integrated

## Related Documents

- PRD_PASS0_RADAR_HUB.md
- TrendSignal spoke implementation
