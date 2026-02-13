# ADR-009: Firecrawl Web Scraping Integration

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
| CC-03 Context | pass0-signals, pass15-rent-recon |
| CC-04 Process | Firecrawl implementation |

## IMO Layer Scope

| Layer | Impact |
|-------|--------|
| Ingress | Yes |
| Middle | No |
| Egress | No |

## Constant vs Variable

| Type | Name | Description |
|------|------|-------------|
| CONST (Input) | URLs | Consumed by Firecrawl |
| VAR (Output) | Parsed content, rates | Produced by Firecrawl |


**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.00.T05, SS.015.T01

---

## Context

Multiple hubs require web scraping capabilities:
- Pass-0 Radar Hub: News article scraping for event detection
- Pass-1.5 Rent Recon Hub: Competitor website rate scraping

We need a reliable, scalable web scraping solution that handles JavaScript-rendered content and provides clean markdown output.

## Decision

We will use **Firecrawl** as our primary web scraping service.

### API Details

| Parameter | Value |
|-----------|-------|
| Base URL | `https://api.firecrawl.dev/v0/` |
| Auth | API Key |
| Rate Limit | 100 requests/hour (standard tier) |
| Output Format | Markdown, HTML, or structured |
| JS Rendering | Yes |

### Implementation

```typescript
interface FirecrawlRequest {
  url: string;
  formats: ('markdown' | 'html' | 'screenshot')[];
  waitFor?: number;           // Wait for JS rendering (ms)
  excludeTags?: string[];     // Remove specific elements
  includeTags?: string[];     // Only include specific elements
}

interface FirecrawlResponse {
  success: boolean;
  markdown?: string;
  html?: string;
  metadata: {
    title: string;
    description: string;
    language: string;
    sourceURL: string;
  };
}

async function scrapeUrl(request: FirecrawlRequest): Promise<FirecrawlResponse>
```

## Use Cases

### Pass-0: News Scraping
```typescript
async function scrapeNewsArticle(url: string): Promise<NewsArticle> {
  const result = await scrapeUrl({
    url,
    formats: ['markdown'],
    excludeTags: ['nav', 'footer', 'aside', '.ads']
  });

  return {
    title: result.metadata.title,
    content: result.markdown,
    sourceUrl: url,
    scrapedAt: new Date()
  };
}
```

### Pass-1.5: Competitor Rate Scraping
```typescript
async function scrapeCompetitorRates(url: string): Promise<RateData[]> {
  const result = await scrapeUrl({
    url,
    formats: ['markdown'],
    waitFor: 3000,  // Wait for pricing to load
    includeTags: ['.pricing', '.unit-size', '.rate']
  });

  return extractRatesFromMarkdown(result.markdown);
}
```

## Rationale

1. **JS Rendering**: Handles modern SPAs and dynamic pricing
2. **Clean Output**: Markdown format is easy to parse
3. **Reliability**: Managed service, no infrastructure
4. **Legal**: Operates within ToS boundaries

## Consequences

### Positive
- Handles JavaScript-heavy sites
- Clean, structured output
- No infrastructure to manage
- Handles CAPTCHAs and bot detection

### Negative
- Cost per request
- Rate limits require batching
- Some sites may still block
- Dependent on third-party service

## Rate Extraction Patterns

```typescript
const ratePatterns = [
  // Common patterns on storage websites
  /\$(\d+(?:\.\d{2})?)\s*(?:\/mo|per month|monthly)/gi,
  /(\d+)x(\d+)\s*(?:unit|space).*?\$(\d+)/gi,
  /(?:starting at|from)\s*\$(\d+)/gi
];

function extractRatesFromMarkdown(markdown: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  for (const pattern of ratePatterns) {
    const matches = markdown.matchAll(pattern);
    for (const match of matches) {
      rates.push({
        amount: parseFloat(match[1] || match[3]),
        unitSize: match[2] ? `${match[1]}x${match[2]}` : null,
        source: 'scrape'
      });
    }
  }

  return rates;
}
```

## Compliance

- [ ] API key stored in environment variables
- [ ] Rate limits enforced (100/hour)
- [ ] Respect robots.txt where applicable
- [ ] Kill switch for quota exhaustion
- [ ] Results cached (24-hour TTL)

## Related Documents

- PRD_PASS0_RADAR_HUB.md
- PRD_PASS15_RENT_RECON_HUB.md
- NewsEvents spoke implementation
- PublishedRateScraper spoke implementation


---

## PID Impact

| Pass | Impact |
|------|--------|
| Pass 0 | Yes |
| Pass 1 | No |
| Pass 1.5 | Yes |
| Pass 2 | No |
| Pass 3 | No |

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Author | AI Agent | 2026-02-13 | DRAFTED |
| Reviewer | --- | --- | PENDING |
| Sovereign | barton-family-office | --- | PENDING |
