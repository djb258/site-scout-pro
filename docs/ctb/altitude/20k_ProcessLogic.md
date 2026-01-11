# 20k Process Logic - Elimination Pipeline

## Complete Elimination Pipeline

### Stage 1: U-Haul Migration Analysis
- **Input**: County-level migration data
- **Process**: Analyze inbound vs outbound trends
- **Output**: Migration index score
- **Elimination**: Negative migration = early elimination

### Stage 2: Census Population
- **Input**: Census population data
- **Process**: Extract population and household counts
- **Output**: Population metrics
- **Elimination**: Population below threshold = elimination

### Stage 3: Household Density
- **Input**: Household count, geographic area
- **Process**: Calculate density per square mile
- **Output**: Density score
- **Elimination**: Low density = elimination

### Stage 4: Saturation Calculation (6 sq ft per person)
- **Input**: Population, existing storage sqft
- **Process**: 
  ```
  required = population * 6
  ratio = existing / required
  ```
- **Output**: Saturation score
- **Elimination**: Oversupplied markets (ratio > 1.1) = elimination

### Stage 5: Rent Verification
- **Input**: Market rent data
- **Process**: Verify rent band ($80-$120)
- **Output**: Rent validation
- **Elimination**: Rent outside band = elimination

### Stage 6: Traffic Counts
- **Input**: DOT traffic data
- **Process**: Analyze daily traffic volume
- **Output**: Traffic score
- **Elimination**: Low traffic = elimination

### Stage 7: DOT Upgrades
- **Input**: DOT infrastructure plans
- **Process**: Check for planned improvements
- **Output**: DOT corridor flag
- **Elimination**: No planned improvements = lower score

### Stage 8: County Zoning Filters
- **Input**: County zoning regulations
- **Process**: Verify storage facility zoning allowed
- **Output**: Zoning approval status
- **Elimination**: Zoning not allowed = elimination

### Stage 9: Stormwater Rules
- **Input**: County stormwater requirements
- **Process**: Assess compliance complexity
- **Output**: Stormwater difficulty score
- **Elimination**: Prohibitive requirements = elimination

### Stage 10: Parcel Shape/Slope/Access
- **Input**: Parcel geometry data
- **Process**: Calculate shape efficiency, slope analysis, access quality
- **Output**: Parcel viability score
- **Elimination**: Poor shape/slope/access = elimination

### Stage 11: Floodplain Check
- **Input**: FEMA floodplain data
- **Process**: Verify floodplain status
- **Output**: Floodplain flag
- **Elimination**: In floodplain = elimination

### Stage 12: Soil/Rock Analysis
- **Input**: Geological survey data
- **Process**: Assess soil conditions and rock presence
- **Output**: Soil/rock score
- **Elimination**: Poor soil conditions = elimination

### Stage 13: Competition Mapping
- **Input**: Existing storage facilities
- **Process**: Map nearby competitors
- **Output**: Competition density
- **Elimination**: High competition = lower score

### Stage 14: Financial Viability
- **Input**: Rent data, build costs, loan terms
- **Process**: Calculate debt service coverage
- **Output**: Financial score
- **Elimination**: Negative cash flow = elimination

### Stage 15: Final Scoring
- **Input**: All component scores
- **Process**: Weighted combination
- **Output**: Final score (0-100)
- **Result**: Ranked candidate list

## Phase Rollout Logic

**Phase 1** (Basic): Stages 1-4 (Migration, Population, Density, Saturation)
**Phase 2** (Parcel): Stages 10-12 (Shape, Slope, Access, Floodplain, Soil)
**Phase 3** (Financial): Stages 5, 14 (Rent, Financial)
**Phase 4** (Regulatory): Stages 8-9 (Zoning, Stormwater)
**Phase 5** (Complete): All stages + Final scoring

## Status Transitions

```
pending → screening → saturation → scoring → completed
                              ↓
                          eliminated
```

