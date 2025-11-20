# 30k Category - Domain Categories

## Category Definitions

### 1. Regional Demand

**Purpose**: Assess market demand based on population dynamics

**Components**:
- U-Haul migration data (inbound/outbound trends)
- Census population growth
- Household density metrics
- Population-to-storage ratios

**Scoring**: High growth = high demand score

### 2. County Rules

**Purpose**: Evaluate regulatory and permitting environment

**Components**:
- County zoning regulations
- Permitting speed (fast = high score, slow = low score)
- Stormwater requirements
- Development restrictions

**Scoring**: Fast permitting = high score, restrictive = low score

### 3. Parcel Viability

**Purpose**: Assess physical site characteristics

**Components**:
- Shape score (usable area)
- Slope analysis (grading requirements)
- Access quality (road frontage, visibility)
- Floodplain status
- Soil/rock conditions

**Scoring**: Weighted combination of shape + slope + access + floodplain

### 4. Saturation Math

**Purpose**: Calculate market saturation levels

**Formula**:
```
required_sqft = population * 6
saturation_ratio = existing_sqft / required_sqft
```

**Scoring**:
- Ratio < 0.7 → Undersupplied (high score)
- Ratio 0.7-1.1 → Balanced (medium score)
- Ratio > 1.1 → Oversupplied (low score)

### 5. Financial Viability

**Purpose**: Evaluate economic feasibility

**Assumptions**:
- 116 total units
- 20% vacancy (92 rented)
- $400,000 build cost
- $2,577/month loan payment
- $80-$120 rent range

**Scoring**: Based on rent band and debt service coverage

### 6. Phase Rollout Strategy

**Phase 1**: Basic screening (population, saturation)
**Phase 2**: Parcel analysis (shape, slope, access)
**Phase 3**: Financial modeling
**Phase 4**: County rules and permitting
**Phase 5**: Final scoring and ranking

## Category Interactions

Categories are evaluated sequentially, with early elimination preventing unnecessary processing of poor candidates.

