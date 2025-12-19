# ADR-024: Tool Selection Doctrine

## Status
**Accepted**

## Date
2024-12-19

## Context

The pipeline requires consistent, auditable tool selection across all stages:
- CCA (County Capability Assessment)
- Pass 0 (Permit & Inspection Signals)
- Pass 2 (Jurisdiction Card Hydration)
- Pass 3 (Financial Calculations)

Without a strict doctrine, developers might:
- Use LLMs where deterministic solutions exist
- Skip cheaper/faster options
- Create non-auditable data paths

## Decision

### Tool Selection Priority

All tool selection MUST follow this order:
```
Deterministic → Scrape → AI-Assisted → Manual
```

| Priority | Type | When to Use |
|----------|------|-------------|
| 1 | API | Structured data source available |
| 2 | Scrape | HTML/PDF with known structure |
| 3 | Portal | Interactive UI, no API |
| 4 | AI | Unstructured data, high value |
| 5 | Manual | All automation failed |

### Stage-Specific Rules

#### CCA Stage
- **Deterministic only** for method selection
- Pattern matching for vendor detection
- No AI in capability assessment

#### Pass 0 (Signals)
- API preferred (Accela, Tyler, etc.)
- Scrape fallback
- Momentum scoring is deterministic

#### Pass 2 (Facts)
- Firecrawl for HTML ordinances
- PDF parser for searchable PDFs
- Retell AI **only** when:
  - Scanned PDF
  - No online ordinance
  - High-value county

#### Pass 3 (Calculations)
- **Deterministic only**
- No AI involvement
- No estimation or guessing

### Forbidden Patterns

1. **LLM for structured data** — Use regex/parsers
2. **LLM for calculations** — Non-auditable
3. **Skip deterministic** — Must try before AI
4. **Guess missing data** — Unknown stays unknown

## Consequences

### Positive
- Auditable data paths
- Lower costs (deterministic is cheaper)
- Faster execution (no LLM latency)
- Reproducible results

### Negative
- Some data unreachable without AI
- Manual queue grows for edge cases
- More upfront tool development

### Neutral
- Retell AI usage is legitimate for scanned PDFs
- Manual is a valid pipeline output

## Implementation

### Tool Ledger
See `docs/doctrine/PIPELINE_TOOL_DOCTRINE.md` for complete ledger.

### Enforcement Points
- CCA Recon Agent enforces method priority
- PR templates require tool justification
- Compliance checklists verify tool usage

## Related ADRs
- ADR-022: County Capability Asset
- ADR-023: CCA and Pass 2 Schema Separation
