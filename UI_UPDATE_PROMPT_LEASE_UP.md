# UI Update Prompt: Dynamic Lease-Up Modeling

## Overview
The feasibility analysis backend has been updated to use **dynamic lease-up modeling** instead of static occupancy assumptions. The UI needs to be updated to display this new market-conditioned lease-up information.

---

## What Changed in Backend

### Previous Behavior
- **Static occupancy assumptions**: Y1=50%, Y2=80%, Y3=90% (hardcoded)
- No visibility into lease-up period or market conditions driving occupancy

### New Behavior
- **Dynamic lease-up calculation** based on:
  - **Market saturation** (`sqft_per_capita` from `market_analysis`)
  - **Market trajectory** (`trajectory` from `market_projections`)
- **Lease-up periods** calculated as:
  - **18 months**: saturation < 5 sqft/capita + improving trajectory
  - **24 months**: saturation < 7 sqft/capita
  - **36 months**: saturation < 9 sqft/capita
  - **48 months**: saturation >= 9 sqft/capita
- **Occupancy percentages** now vary by lease-up period:
  - **18 months**: Y1=65%, Y2=85%, Y3=90%
  - **24 months**: Y1=55%, Y2=80%, Y3=90%
  - **36 months**: Y1=45%, Y2=75%, Y3=90%
  - **48 months**: Y1=40%, Y2=70%, Y3=90%

---

## Database Schema Reference (ERD)

### `feasibility_analysis` Table
**Key fields for UI display:**
```sql
y1_occupancy_pct DECIMAL      -- Year 1 occupancy (now dynamic)
y2_occupancy_pct DECIMAL      -- Year 2 occupancy (now dynamic)
y3_occupancy_pct DECIMAL      -- Year 3 occupancy (stabilized at 90%)
y1_noi INT                     -- Year 1 Net Operating Income
y2_noi INT                     -- Year 2 NOI
y3_noi INT                     -- Year 3 NOI
y1_yield_pct DECIMAL           -- Year 1 yield percentage
y2_yield_pct DECIMAL           -- Year 2 yield percentage
y3_yield_pct DECIMAL           -- Year 3 yield percentage
market_saturation VARCHAR(20)  -- 'undersupplied', 'balanced', 'oversupplied'
market_trajectory VARCHAR(20)  -- 'improving', 'stable', 'deteriorating'
```

### Related Tables (for context display)
**`market_analysis`** (joins via `market_analysis_id`):
```sql
sqft_per_capita DECIMAL        -- Key metric used in lease-up calculation
saturation_level VARCHAR(20)    -- 'undersupplied', 'balanced', 'oversupplied'
saturation_score INT           -- 0-100 score
```

**`market_projections`** (joins via `market_projection_id`):
```sql
trajectory VARCHAR(20)          -- 'improving', 'stable', 'deteriorating'
opportunity_score INT           -- 0-100 market opportunity score
```

---

## UI Updates Required

### 1. Feasibility Analysis Display Component

**Location**: Wherever `feasibility_analysis` results are shown (likely a pro forma or financial summary component)

**Add New Section**: "Lease-Up Analysis" or "Market-Conditioned Occupancy"

**Display Fields**:
- **Lease-Up Period**: Calculate and display (18/24/36/48 months) based on occupancy values
  - Logic: If Y1=65% → 18 months, Y1=55% → 24 months, Y1=45% → 36 months, Y1=40% → 48 months
- **Market Saturation**: Display `market_saturation` field (undersupplied/balanced/oversupplied)
- **Market Trajectory**: Display `market_trajectory` field (improving/stable/deteriorating)
- **Sqft per Capita**: Display `sqft_per_capita` from joined `market_analysis` table

**Visual Design Suggestions**:
```
┌─────────────────────────────────────────┐
│ Lease-Up Analysis                       │
├─────────────────────────────────────────┤
│ Estimated Lease-Up Period: 24 months   │
│ Market Saturation: Undersupplied       │
│ Market Trajectory: Stable              │
│ Sqft per Capita: 6.2                    │
│                                         │
│ Occupancy Projection:                   │
│ • Year 1: 55% (lease-up phase)         │
│ • Year 2: 80% (stabilizing)             │
│ • Year 3: 90% (stabilized)              │
└─────────────────────────────────────────┘
```

### 2. Pro Forma Summary Component

**Update**: The existing pro forma display (showing Y1/Y2/Y3 occupancy, NOI, yield)

**Changes**:
- **Add tooltip/hover explanation** on occupancy percentages:
  - "Occupancy based on market conditions: [X] months estimated lease-up period"
- **Add visual indicator** showing lease-up speed:
  - Fast (18-24 months): Green indicator
  - Moderate (36 months): Yellow indicator
  - Slow (48 months): Orange/Red indicator
- **Show market context**:
  - Display saturation level and trajectory as badges/pills next to occupancy values

**Example Enhancement**:
```
Year 1 Occupancy: 55% [24 months lease-up]
Market: Undersupplied | Trajectory: Stable
```

### 3. Comparison/Scenario Views

**If displaying multiple feasibility analyses side-by-side**:

**Add Column**: "Lease-Up Period" or "Market Conditions"
- Allows users to compare why different sites have different Y1/Y2 occupancy assumptions
- Shows the market logic driving the differences

**Example Table Enhancement**:
```
| Site          | Y1 Occ | Y2 Occ | Y3 Occ | Lease-Up | Market Conditions    |
|---------------|--------|--------|--------|----------|----------------------|
| Site A        | 65%    | 85%    | 90%    | 18 mo    | Undersupplied +      |
|               |        |        |        |          | Improving            |
| Site B        | 55%    | 80%    | 90%    | 24 mo    | Undersupplied        |
| Site C        | 40%    | 70%    | 90%    | 48 mo    | Oversupplied         |
```

### 4. Market Context Panel

**New Component or Section**: Display market analysis data that drives lease-up

**Show**:
- Current saturation metrics (`sqft_per_capita`, `saturation_level`)
- Market trajectory (`trajectory` from `market_projections`)
- How these combine to determine lease-up period
- Visual explanation: "Lower saturation + improving trajectory = faster lease-up"

**Design Suggestion**:
```
┌─────────────────────────────────────────┐
│ Market Conditions                        │
├─────────────────────────────────────────┤
│ Saturation: 6.2 sqft/capita             │
│ Status: Undersupplied                   │
│                                         │
│ Trajectory: Stable                      │
│ Opportunity Score: 79/100              │
│                                         │
│ → Lease-Up Impact: 24 months           │
│   (Moderate pace due to balanced        │
│    market conditions)                   │
└─────────────────────────────────────────┘
```

---

## API/Data Fetching Updates

### Required Joins
When fetching `feasibility_analysis`, ensure you also fetch:
- `market_analysis` (via `market_analysis_id`) for `sqft_per_capita` and `saturation_level`
- `market_projections` (via `market_projection_id`) for `trajectory` and `opportunity_score`

### Example Query Structure
```sql
SELECT 
    fa.*,
    ma.sqft_per_capita,
    ma.saturation_level,
    mp.trajectory,
    mp.opportunity_score
FROM feasibility_analysis fa
LEFT JOIN market_analysis ma ON fa.market_analysis_id = ma.id
LEFT JOIN market_projections mp ON fa.market_projection_id = mp.id
WHERE fa.jurisdiction_card_id = ?
```

---

## User Experience Considerations

### 1. Education/Tooltips
- Add help text explaining what "lease-up period" means
- Explain how market conditions affect occupancy assumptions
- Show the calculation logic: "Based on saturation of X sqft/capita and Y trajectory, we estimate Z months to stabilize"

### 2. Visual Hierarchy
- Make lease-up period prominent (it's a key differentiator)
- Use color coding for lease-up speed (fast = green, slow = red)
- Group occupancy percentages with their market context

### 3. Comparison Features
- If users can compare sites, highlight lease-up differences
- Show why Site A has 65% Y1 vs Site B's 40% Y1 (market conditions)

### 4. Reporting
- Include lease-up period in exported reports
- Add market context to PDF/Excel exports
- Show the logic: "Y1 occupancy of 55% reflects 24-month lease-up period based on undersupplied market conditions"

---

## Testing Checklist

- [ ] Verify Y1/Y2/Y3 occupancy values display correctly (should vary by market, not always 50%/80%/90%)
- [ ] Confirm market saturation and trajectory fields display
- [ ] Test lease-up period calculation/display (18/24/36/48 months)
- [ ] Verify sqft_per_capita displays from market_analysis join
- [ ] Check tooltips/help text explain lease-up logic
- [ ] Test comparison views show lease-up differences
- [ ] Verify exports include lease-up information
- [ ] Test with different market conditions (undersupplied vs oversupplied)
- [ ] Verify visual indicators (colors/badges) work correctly

---

## Technical Notes

### Lease-Up Period Calculation (for display)
You can derive the lease-up period from Y1 occupancy:
```javascript
function getLeaseUpPeriod(y1Occupancy) {
  if (y1Occupancy >= 0.65) return 18;
  if (y1Occupancy >= 0.55) return 24;
  if (y1Occupancy >= 0.45) return 36;
  return 48;
}
```

### Occupancy Ranges Reference
- **18 months**: Y1=65%, Y2=85%, Y3=90%
- **24 months**: Y1=55%, Y2=80%, Y3=90%
- **36 months**: Y1=45%, Y2=75%, Y3=90%
- **48 months**: Y1=40%, Y2=70%, Y3=90%

---

## Questions for Clarification

1. **Where is the feasibility analysis currently displayed?** (Component/file names)
2. **Do you have existing pro forma/financial summary components?** (Need to enhance these)
3. **Are there comparison/table views of multiple sites?** (Need to add lease-up column)
4. **What's the preferred visual style?** (Cards, tables, charts, etc.)
5. **Do you need real-time updates?** (If market data changes, should UI refresh?)

---

## Priority

**High Priority**: Update pro forma display to show dynamic occupancy values  
**Medium Priority**: Add lease-up analysis section with market context  
**Low Priority**: Enhanced comparison views and reporting

---

## Backend Commit Reference

**Commit**: `bc2b79e` - "Add dynamic lease-up modeling to feasibility analysis"  
**File Changed**: `create_feasibility_model.py`  
**Function**: `analyze_feasibility()` - Lines 257-297

---

## Contact

For questions about the backend implementation or data structure, refer to:
- ERD: `docs/ERD.md` (lines 885-945 for `feasibility_analysis`, 766-794 for `market_analysis`, 848-879 for `market_projections`)
- Backend function: `create_feasibility_model.py` - `analyze_feasibility()` function

