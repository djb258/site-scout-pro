# Retell AI Caller Script Configuration

**Script ID:** `hub15_rate_collector_v1`  
**Version:** `1.0.0`  
**Last Updated:** 2025-12-18  
**Process ID:** `hub15.ai_caller`

---

## Purpose

Deterministic phone script for collecting storage unit rate data from competitor facilities. Designed for regex extraction of structured rate information.

---

## Call Flow (Strict Sequence)

```
┌─────────────────┐
│  1. GREETING    │
└────────┬────────┘
         ▼
┌─────────────────┐
│  2. VERIFY      │
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. UNIT SIZES  │
└────────┬────────┘
         ▼
┌─────────────────┐
│  4. PROMOS      │
└────────┬────────┘
         ▼
┌─────────────────┐
│  5. ADMIN FEES  │
└────────┬────────┘
         ▼
┌─────────────────┐
│  6. CLOSE       │
└────────┴────────┘
```

---

## Script Blocks

### 1. GREETING (5 seconds max)

**Agent says:**
> "Hi, this is Alex calling about storage availability. Do you have a moment?"

**Expected responses:**
- YES → Proceed to VERIFY
- NO/BUSY → "No problem, I'll try again later. Thank you." → END CALL
- VOICEMAIL → Leave no message → END CALL

**Hard rule:** No small talk. No "how are you today?"

---

### 2. VERIFY (10 seconds max)

**Agent says:**
> "I'm checking rates for your location at {competitor_address}. Is this the right facility?"

**Expected responses:**
- YES → Proceed to UNIT SIZES
- NO/WRONG LOCATION → "Apologies for the confusion. Thank you." → END CALL
- TRANSFER → Accept transfer, restart from GREETING

**Hard rule:** Confirm address before asking rates.

---

### 3. UNIT SIZES (60 seconds max)

**Agent asks each size in exact order:**

| Order | Question (verbatim) |
|-------|---------------------|
| 3.1 | "What is your current monthly rate for a 5 by 5 unit?" |
| 3.2 | "What about a 5 by 10?" |
| 3.3 | "And a 10 by 10?" |
| 3.4 | "How about a 10 by 15?" |
| 3.5 | "And a 10 by 20?" |
| 3.6 | "Do you have 10 by 30 units? If so, what's the rate?" |

**Response handling:**
- RATE GIVEN → Record `{size}:{rate}` → Next question
- NOT AVAILABLE → Record `{size}:N/A` → Next question
- "IT DEPENDS" → "What's the standard non-climate rate?" → Record answer
- CLIMATE QUESTION → "Non-climate controlled, please." → Record answer

**Extraction patterns (regex-ready):**
```
Rate: $XXX or XXX dollars
Not available: "don't have", "sold out", "no availability", "N/A"
```

**Hard rule:** Never ask about climate-controlled units unless clarifying. Always ask for non-climate rates.

---

### 4. PROMOS (15 seconds max)

**Agent says:**
> "Are there any current move-in specials or first month discounts?"

**Expected responses:**
- YES + DETAILS → Record promo text verbatim
- NO → Record `promo:none`
- "DEPENDS ON UNIT" → "What's the most common special?" → Record

**Extraction patterns:**
```
First month free: "first month free", "free first month"
Percentage: "XX% off", "half off", "50 percent"
Dollar amount: "$XX off", "XX dollars off"
None: "no specials", "no promotions", "none right now"
```

**Hard rule:** One question only. Do not ask follow-ups about promo duration or conditions.

---

### 5. ADMIN FEES (10 seconds max)

**Agent says:**
> "Is there an administration fee or one-time move-in fee?"

**Expected responses:**
- YES + AMOUNT → Record `admin_fee:{amount}`
- NO → Record `admin_fee:0`
- INCLUDED → Record `admin_fee:included`

**Extraction patterns:**
```
Fee amount: "$XX", "XX dollars", "XX dollar"
No fee: "no fee", "waived", "none", "no admin"
Included: "included", "part of", "built into"
```

**Hard rule:** Do not ask about deposits, insurance, or other fees.

---

### 6. CLOSE (5 seconds max)

**Agent says:**
> "That's all I needed. Thank you for your time."

**Then:** END CALL immediately.

**Hard rule:** No "have a great day." No callbacks. No name exchange.

---

## Prohibited Behaviors

| Category | Forbidden Actions |
|----------|-------------------|
| Conversation | Open-ended questions ("Tell me about...") |
| Conversation | Small talk ("How's your day?") |
| Conversation | Upselling ("Do you also offer...") |
| Conversation | Personal info exchange |
| Pricing | Asking about climate-controlled rates |
| Pricing | Asking about vehicle/RV storage |
| Pricing | Negotiating or requesting discounts |
| Flow | Repeating questions already answered |
| Flow | Asking for email/callback |
| Flow | Leaving voicemails |

---

## Response Classification

### Terminal States (END CALL)

| Code | Trigger | Classification |
|------|---------|----------------|
| `T001` | Voicemail detected | `no_answer` |
| `T002` | Wrong number/facility | `wrong_target` |
| `T003` | Refused to provide rates | `refused` |
| `T004` | Call dropped/disconnected | `connection_error` |
| `T005` | Successful completion | `completed` |

### Retry States (RESCHEDULE)

| Code | Trigger | Action |
|------|---------|--------|
| `R001` | Busy, call back later | Retry in 2 hours |
| `R002` | On hold > 60 seconds | Retry in 1 hour |
| `R003` | Transferred, then disconnected | Retry immediately |

---

## Output Schema

```json
{
  "script_version": "1.0.0",
  "call_id": "uuid",
  "competitor_id": "string",
  "competitor_name": "string",
  "call_status": "completed|no_answer|refused|wrong_target|connection_error",
  "duration_ms": 0,
  "rates": {
    "5x5": { "rate": 45, "available": true },
    "5x10": { "rate": 65, "available": true },
    "10x10": { "rate": 95, "available": true },
    "10x15": { "rate": 125, "available": true },
    "10x20": { "rate": 155, "available": true },
    "10x30": { "rate": null, "available": false }
  },
  "promo": {
    "has_promo": true,
    "description": "First month free",
    "type": "first_month_free|percentage|dollar_amount|none"
  },
  "admin_fee": {
    "has_fee": true,
    "amount": 25,
    "type": "fixed|waived|included"
  },
  "confidence": 0.85,
  "transcript_hash": "sha256:..."
}
```

---

## Retell Agent Configuration

```yaml
# Retell Dashboard Settings
agent_name: "Hub15 Rate Collector"
voice: "shimmer"  # Clear, neutral, professional
language: "en-US"
interruption_sensitivity: 0.6
response_delay_ms: 400

# Guardrails
max_call_duration_seconds: 180
silence_timeout_seconds: 10
no_response_timeout_seconds: 15

# Webhooks
on_call_end: "https://{project_id}.supabase.co/functions/v1/hub15_log_attempt"
transcript_mode: "full"

# Custom vocabulary (improves recognition)
custom_vocabulary:
  - "5 by 5"
  - "5 by 10"
  - "10 by 10"
  - "10 by 15"
  - "10 by 20"
  - "10 by 30"
  - "climate controlled"
  - "admin fee"
  - "move-in special"
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-18 | Initial script specification |

---

## Integration Notes

1. **Transcript parsing:** Use `hub15_ai_caller` edge function to parse Retell webhook payload
2. **Rate extraction:** Apply regex patterns from Section 3-5 to transcript
3. **Confidence calculation:** Based on extraction hit rate (rates found / rates asked)
4. **Logging:** All calls logged to `pass_1_5_attempt_log` via `hub15_log_attempt`
5. **Resolution:** Successful extractions forwarded to `hub15_resolve_gap`

---

## Testing Checklist

- [ ] Greeting terminates on voicemail
- [ ] Verify step catches wrong facility
- [ ] All 6 unit sizes asked in order
- [ ] Non-climate preference stated when asked
- [ ] Single promo question, no follow-ups
- [ ] Admin fee question captures amount
- [ ] Close is immediate, no small talk
- [ ] Call duration < 180 seconds
- [ ] Transcript hash generated
- [ ] Webhook fires to hub15_log_attempt
