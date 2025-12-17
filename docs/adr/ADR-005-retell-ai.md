# ADR-005: Retell.ai Voice AI Integration

**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.015.T04

---

## Context

The Pass-1.5 Rent Recon Hub requires actual street rates from competitors. While web scraping captures published rates, many facilities don't publish rates online or have promotional pricing. AI-powered phone calls can gather this data at scale.

## Decision

We will use **Retell.ai** as the voice AI platform for automated competitor rate calls.

### API Details

| Parameter | Value |
|-----------|-------|
| Platform | Retell.ai |
| Auth | API Key |
| Concurrency Limit | 20 simultaneous calls |
| Max Call Duration | 180 seconds |
| Cost | ~$0.10-0.15 per minute |
| Transcript Storage | Automatic, API-accessible |

### Implementation

```typescript
interface AICallWorkOrder {
  competitorId: string;
  competitorName: string;
  phoneNumber: string;
  targetUnitSizes: string[];  // ['5x5', '10x10', '10x20']
  callScript: CallScript;
  priority: 'high' | 'normal' | 'low';
}

interface AICallResult {
  workOrderId: string;
  callStatus: 'completed' | 'no_answer' | 'voicemail' | 'failed';
  callDuration: number;
  transcript: string;
  extractedRates: {
    unitSize: string;
    rate: number;
    climate: boolean;
    promotion?: string;
  }[];
  confidence: number;
}

async function executeAICall(workOrder: AICallWorkOrder): Promise<AICallResult>
```

## Rationale

1. **Scale**: Can make hundreds of calls per day
2. **Consistency**: Same script, same questions every time
3. **Cost**: Cheaper than human callers at volume
4. **Transcripts**: Full audit trail of all conversations

## Call Script Template

```typescript
const callScript: CallScript = {
  greeting: "Hi, I'm looking to rent a storage unit. Do you have any availability?",
  questions: [
    "What sizes do you have available?",
    "How much is a [SIZE] unit per month?",
    "Do you have climate-controlled units?",
    "Are there any move-in specials right now?",
    "What's included - like insurance or admin fees?"
  ],
  closing: "Great, thank you so much for your help!"
};
```

## Consequences

### Positive
- 24/7 calling capability
- Consistent data collection
- Full transcript storage for audit
- No human scheduling needed

### Negative
- Some facilities may screen AI calls
- Complex pricing may not be captured
- Requires call script tuning
- Potential compliance considerations

## Rate Extraction Logic

```typescript
function extractRatesFromTranscript(transcript: string): ExtractedRate[] {
  // Pattern matching for common rate formats
  const patterns = [
    /(\d+x\d+)\s*(?:unit|space)?\s*(?:is|costs?|runs?)?\s*\$?(\d+(?:\.\d{2})?)/gi,
    /\$(\d+(?:\.\d{2})?)\s*(?:per month|monthly)?\s*(?:for|on)?\s*(?:a|the)?\s*(\d+x\d+)/gi
  ];
  // ... extraction logic
}
```

## Compliance

- [ ] Concurrency limit enforced (20 max)
- [ ] Call duration limit (180s)
- [ ] All calls logged with transcripts
- [ ] Opt-out handling implemented
- [ ] Kill switch for API issues
- [ ] Cost monitoring enabled

## Guard Rails

| Guard Rail | Threshold | Action |
|------------|-----------|--------|
| Concurrent calls | 20 max | Queue additional |
| Call duration | 180s | Auto-terminate |
| Daily call limit | 500/day | Pause until next day |
| Failure rate | > 70% | Trigger kill switch |

## Related Documents

- PRD_PASS15_RENT_RECON_HUB.md
- AICallWorkOrders spoke implementation
- Call transcript storage schema
