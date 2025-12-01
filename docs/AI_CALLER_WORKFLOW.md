# AI Caller for Facility Pricing

Collects actual rental rates via AI voice calls to storage facilities.

## Overview

| Metric | Value |
|--------|-------|
| Facilities in Zone | ~2,344 |
| With Phone Numbers | ~360 (growing) |
| Est. Call Duration | 90 sec avg |
| Cost (Bland AI) | ~$0.09/min |
| Cost (Vapi) | ~$0.05/min |
| Total Est. Cost | $15-50 |

## Quick Start

```bash
# 1. Setup (create tables & columns)
python build_ai_caller.py --setup

# 2. Fetch phone numbers from Google Places
python build_ai_caller.py --fetch-phones

# 3. Export call list
python build_ai_caller.py --export

# 4. Upload to Bland AI or Vapi (see instructions below)

# 5. Import results
python build_ai_caller.py --import-file results.csv

# 6. Generate report
python build_ai_caller.py --report
```

## Database Schema

### New Columns Added to `storage_facilities`

| Column | Type | Description |
|--------|------|-------------|
| phone_number | VARCHAR(20) | Facility phone |
| has_climate_control | BOOLEAN | Climate units available |
| climate_premium | INT | $/mo premium for climate |
| move_in_special | TEXT | Current promo |
| availability_status | VARCHAR(20) | available/unavailable/waitlist |
| pricing_source | VARCHAR(20) | 'ai_call', 'sparefoot', 'manual' |
| pricing_fetched_at | TIMESTAMP | When pricing was collected |

### New Table: `facility_call_results`

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| facility_id | INT | FK to storage_facilities |
| call_datetime | TIMESTAMP | When call was made |
| call_duration_seconds | INT | Call length |
| call_status | VARCHAR(20) | completed/no_answer/voicemail/busy |
| availability_10x10 | VARCHAR(20) | Unit availability |
| rate_10x10 | INT | Monthly rate |
| rate_10x20 | INT | Monthly rate |
| has_climate_control | BOOLEAN | Climate available |
| climate_premium | INT | Additional cost |
| move_in_special | TEXT | Promo text |
| transcript | TEXT | Full call transcript |
| caller_service | VARCHAR(50) | bland/vapi/manual |

## Call Script

### Opening
> "Hi, I'm looking for storage in the area and wanted to check on availability and pricing."

### Questions

1. **10x10 Availability**
   > "Do you have any 10 by 10 units available?"

   Capture: `availability_10x10` (available/unavailable/waitlist)

2. **10x10 Rate**
   > "What's the monthly rate for a 10 by 10?"

   Capture: `rate_10x10` (dollar amount)

3. **10x20 Rate**
   > "And what about a 10 by 20?"

   Capture: `rate_10x20` (dollar amount)

4. **Climate Control**
   > "Do you have climate controlled units? What's the rate difference for those?"

   Capture: `has_climate_control` (yes/no), `climate_premium` (dollar amount)

5. **Move-in Specials**
   > "Are there any move-in specials right now?"

   Capture: `move_in_special` (text or "none")

### Closing
> "Great, thank you so much for the information!"

## Bland AI Setup

1. **Sign up**: https://www.bland.ai/

2. **Create Agent**:
   - Name: "Storage Pricing Caller"
   - Voice: Natural, professional

3. **Configure Pathway** with the script above

4. **Upload** `facility_call_list.csv`

5. **Run Batch**

6. **Download Results** and import:
   ```bash
   python build_ai_caller.py --import-file bland_results.csv --caller bland
   ```

### Cost Estimate (Bland AI)
- ~360 facilities
- ~90 seconds avg call
- ~540 minutes total
- **~$48 total** (at $0.09/min)

## Vapi Setup

1. **Sign up**: https://vapi.ai/

2. **Create Assistant**:
   - Name: "Storage Pricing Caller"
   - Model: gpt-4 or claude

3. **System Prompt**:
   ```
   You are calling storage facilities to gather pricing information.
   Be polite, professional, and concise. Extract:
   - 10x10 availability and rate
   - 10x20 rate
   - Climate control availability and premium
   - Move-in specials
   ```

4. **API Integration**:
   ```bash
   POST https://api.vapi.ai/call
   Headers:
     Authorization: Bearer YOUR_API_KEY
   Body:
     {
       "assistant_id": "YOUR_ASSISTANT_ID",
       "phone_number_id": "YOUR_PHONE_ID",
       "customer": {"number": "+1XXXXXXXXXX"},
       "metadata": {"facility_id": "123"}
     }
   ```

### Cost Estimate (Vapi)
- ~360 facilities
- ~90 seconds avg call
- ~540 minutes total
- **~$27 total** (at $0.05/min)

## Edge Cases

| Scenario | Action |
|----------|--------|
| No answer | Mark for retry (max 2 attempts) |
| Voicemail | Mark as 'voicemail', don't leave message |
| "Call back" | Note in call_notes |
| Price varies | Capture range or "varies" |
| Refused price | Mark in call_notes |

## Call Timing

| Factor | Recommendation |
|--------|----------------|
| Best days | Tuesday, Wednesday, Thursday |
| Best hours | 10am-3pm local time |
| Avoid | Mondays (busy), Fridays (early close) |
| Rate limit | 1 call per 2 minutes (be polite) |

## CLI Commands

```bash
# Full setup
python build_ai_caller.py --all

# Individual operations
python build_ai_caller.py --setup              # Create tables/columns
python build_ai_caller.py --fetch-phones       # Get phone numbers
python build_ai_caller.py --fetch-phones --phone-limit 50  # Limit fetch
python build_ai_caller.py --export             # Export call list
python build_ai_caller.py --import-file X.csv  # Import results
python build_ai_caller.py --update             # Update facilities table
python build_ai_caller.py --report             # Generate report

# Show instructions
python build_ai_caller.py --show-script        # Call script JSON
python build_ai_caller.py --show-bland         # Bland AI setup
python build_ai_caller.py --show-vapi          # Vapi setup
```

## Expected Results CSV Format

When importing results, the CSV should have these columns:

```csv
facility_id,call_datetime,call_duration_seconds,call_status,rate_10x10,rate_10x20,has_climate_control,climate_premium,move_in_special,transcript,call_notes
123,2024-01-15T10:30:00,87,completed,95,165,yes,25,First month free,Full transcript here,Notes
```

## Summary Queries

### Results by Status
```sql
SELECT
    call_status,
    COUNT(*) as count,
    ROUND(AVG(rate_10x10)) as avg_10x10
FROM facility_call_results
GROUP BY call_status;
```

### Pricing by County
```sql
SELECT
    c.county_name, c.state,
    COUNT(fcr.id) as calls,
    ROUND(AVG(fcr.rate_10x10)) as avg_10x10,
    MIN(fcr.rate_10x10) as min_10x10,
    MAX(fcr.rate_10x10) as max_10x10
FROM facility_call_results fcr
JOIN storage_facilities sf ON fcr.facility_id = sf.id
JOIN layer_3_counties c ON sf.county_fips = c.county_fips
WHERE fcr.call_status = 'completed'
GROUP BY c.county_name, c.state
ORDER BY avg_10x10 DESC;
```

## Integration with Prompt 8 (SpareFoot)

This is Prompt 8B - an alternative to Prompt 8 (SpareFoot scraping).

| Method | Pros | Cons |
|--------|------|------|
| **8B: AI Caller** | Accurate, real-time | Cost ($15-50), slower |
| **8: SpareFoot** | Free, fast | May be stale, scraping TOS |

**Recommendation**: Use AI Caller (8B) for accuracy. Data is fresher and more reliable than scraped data.

## Files Created

| File | Description |
|------|-------------|
| `build_ai_caller.py` | Main CLI tool |
| `facility_call_list.csv` | Export for AI caller batch |
| `docs/AI_CALLER_WORKFLOW.md` | This documentation |

## Next Steps

1. Continue fetching phone numbers (1,984 remaining)
2. Sign up for Bland AI or Vapi
3. Run batch calls
4. Import results
5. Proceed to Prompt 9 (Scoring Engine)
