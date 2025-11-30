# Storage Facility Site Selection Criteria
## Waterfall Elimination Process

**Goal**: Start with 500+ potential locations → End with 15-20 viable sites for development

---

## STAGE 0: Highway Expansion & Manufacturing Reshoring Pre-Filter (HIGHEST PRIORITY)
**Goal**: Identify growth corridors before market catches up
**Data Sources**: State DOT STIP, LRTP, GIS portals, SelectUSA, Economic Development Authority announcements

### Highway Infrastructure Expansion
- [ ] Within 3-5 mile radius of funded highway expansion projects
- [ ] 2→4 lane or 4→6 lane capacity projects
- [ ] New interchange/exit ramp construction
- [ ] Project status: "Funded" or "Construction Phase" (not just "proposed")
- [ ] Timeline: 1-5 year completion window

### Manufacturing Reshoring & Foreign Direct Investment (NEW - TRUMP ERA)
**Why This Matters**: Trump administration policies (tariffs, CHIPS Act, IRA, trade policy) driving massive manufacturing reshoring from China. Companies announcing US factories = multi-year job growth = storage demand.

**Data Sources**:
- SelectUSA.gov (FDI announcements)
- State Economic Development Authority press releases
- Reshoring Initiative database (reshorenow.org)
- Company investor relations announcements
- CHIPS Act funding recipients (commerce.gov/chips)
- IRA clean energy manufacturing projects

#### Criteria:
- [ ] **+30 points** - Major manufacturing facility announced within 20 miles (>500 jobs)
- [ ] **+25 points** - Battery/EV/semiconductor plant under construction (CHIPS/IRA funded)
- [ ] **+20 points** - Multiple manufacturers announced in region (industrial cluster forming)
- [ ] **+15 points** - Foreign company (Toyota, Samsung, TSMC, etc.) selecting location
- [ ] **+10 points** - Supplier/vendor ecosystem developing around anchor manufacturer
- [ ] **+10 points** - State offering major tax incentives for manufacturing (signal of focus)

#### Types of Manufacturing to Track:
- **Semiconductors** - CHIPS Act ($52B in subsidies): Intel, TSMC, Samsung, Micron
- **EV/Battery** - IRA incentives: Tesla, Rivian, battery suppliers (LG, Panasonic)
- **Solar/Wind** - Clean energy manufacturing
- **Pharmaceuticals** - Reshoring from China/India
- **Steel/Aluminum** - Tariff-protected domestic production
- **Food processing** - Supply chain security focus

#### Where to Find This Data:
1. **SelectUSA.gov** - Tracks foreign direct investment
2. **State EDAs** - Press releases (e.g., "Texas Economic Development", "Georgia EDC")
3. **Good Jobs First** - Megadeals database (goodjobsfirst.org/megadeals)
4. **Company announcements** - Monitor Tesla, Intel, TSMC, Toyota investor relations
5. **Local news** - Economic development beat reporters
6. **Site Selection Magazine** - Tracks major projects

### Highway Scoring Boosts
- **+20 points** - Within 3 miles of planned highway expansion
- **+15 points** - Project funded and breaking ground within 2 years
- **+10 points** - New interchange/exit planned

### Red Flags
- ⚠️ Land within eminent domain/expansion path
- ⚠️ Projects unfunded for 5+ years
- ⚠️ Temporary construction worker growth only
- ⚠️ Manufacturing announcement with no construction timeline (vaporware)

---

## STAGE 1: Hard Eliminators (FREE Data, Fast Processing)
**Goal**: Remove 60-70% of locations immediately
**Data Sources**: County GIS, Census API, local planning departments

### Zoning Requirements
- [ ] ❌ ELIMINATE if zoning requires conditional use permit
- [ ] ❌ ELIMINATE if height restrictions <25 feet
- [ ] ❌ ELIMINATE if storage development moratorium in place
- [ ] ✓ REQUIRE: Commercial or light industrial zoning (or easy rezone)

### Population Thresholds
- [ ] ❌ ELIMINATE if county population <15,000
- [ ] ❌ ELIMINATE if 5-mile radius population <25,000
- [ ] ✓ REQUIRE: Minimum density to support facility

### Basic Demographics (Census API)
- [ ] ❌ ELIMINATE if median household income <$40,000
- [ ] ❌ ELIMINATE if poverty rate >25%
- [ ] ❌ ELIMINATE if population decline >2% annually (5-year trend)

---

## STAGE 2: Market Saturation Analysis (FREE/Cheap Data)
**Goal**: Remove 15-20% more locations
**Data Sources**: Google Places API, SpareFoot, manual searches

### Supply/Demand Calculation
- **Formula**: Population × 6 sq ft per person = Total demand
- **Method**: Map all competitors within 5-mile radius
- **Calculation**: Sum total competitor square footage

### Elimination Rules
- [ ] ❌ ELIMINATE if market >110% saturated (supply exceeds demand)
- [ ] ❌ ELIMINATE if 4+ facilities within 3-mile radius
- [ ] ⚠️ FLAG if 3 facilities within 3-mile radius (borderline)
- [ ] ✓ IDEAL: 70-90% saturation (room for growth)

### Competitor Count
- [ ] ❌ ELIMINATE if 5+ direct competitors in 5-mile radius
- [ ] ✓ PASS if monopoly/duopoly situation (1-2 competitors)

---

## STAGE 3: Demographics Deep Dive (FREE Data)
**Goal**: Remove 5-10% more locations
**Data Sources**: Census ACS 5-year estimates, Census Reporter

### Income Bands
- [ ] ✓ IDEAL: Median household income $50k-$100k (sweet spot)
- [ ] **+10 points** - Income $60k-$80k
- [ ] **+5 points** - Income $50k-$60k or $80k-$100k
- [ ] **-5 points** - Income <$50k or >$100k

### Housing Mix
- [ ] ❌ ELIMINATE if renter percentage <20%
- [ ] ⚠️ FLAG if renter percentage <30%
- [ ] ✓ IDEAL: 40-60% renters
- [ ] **+15 points** - High apartment/multifamily concentration

### Age Distribution
- [ ] ✓ IDEAL: 25-45 age bracket >35% of population (life transitions)
- [ ] **+10 points** - High concentration ages 25-45
- [ ] **-5 points** - Median age >55 (retirees, less storage need)
- [ ] ⚠️ FLAG if median age >60

### Population Growth Trends
- [ ] ❌ ELIMINATE if 5-year growth rate <0% (declining)
- [ ] ⚠️ FLAG if growth rate 0-1% (stagnant)
- [ ] ✓ REQUIRE: >2% annual growth (5-year average)
- [ ] **+15 points** - Growth rate >5% annually

---

## STAGE 4: Competition Analysis (PAID/Manual Data)
**Goal**: Remove 3-5% more locations
**Data Sources**: SpareFoot, Radius+, facility visits, phone surveys

### Competitor Occupancy Rates
- [ ] ❌ ELIMINATE if competitor avg occupancy <80% (oversupplied)
- [ ] ⚠️ FLAG if competitor avg occupancy 80-85%
- [ ] ✓ IDEAL: Competitor occupancy >90% (undersupplied)
- [ ] **+20 points** - Competitors at 95%+ occupancy

### Pricing Analysis
- [ ] ❌ ELIMINATE if market pricing <$0.70/sq ft (race to bottom)
- [ ] ⚠️ FLAG if pricing $0.70-$0.80/sq ft
- [ ] ✓ IDEAL: Pricing $0.90-$1.20/sq ft
- [ ] **+10 points** - Pricing >$1.00/sq ft (strong market)

### Facility Quality Assessment
- [ ] **+15 points** - Competitors are outdated/low-quality (opportunity)
- [ ] **+10 points** - No climate-controlled options available
- [ ] **-10 points** - New modern facility opened <2 years ago

### Market Share Concentration
- [ ] ⚠️ FLAG if one competitor has >60% market share (monopoly risk)
- [ ] ✓ IDEAL: Fragmented market (multiple small players)
- [ ] **+10 points** - No dominant player, all <30% share

---

## STAGE 5: Traffic & Accessibility (PAID Data)
**Goal**: Final scoring for top candidates
**Data Sources**: State DOT traffic counts, StreetLight Data, Google Maps

### Traffic Counts (AADT)
- [ ] ❌ ELIMINATE if nearest major road <10,000 vehicles/day
- [ ] ⚠️ FLAG if 10,000-15,000 vehicles/day
- [ ] ✓ REQUIRE: >15,000 vehicles/day on nearest major road
- [ ] **+15 points** - >25,000 vehicles/day

### Visibility Requirements
- [ ] ❌ ELIMINATE if not visible from main thoroughfare
- [ ] ✓ REQUIRE: Visible signage location from high-traffic road
- [ ] **+20 points** - Corner lot at major intersection
- [ ] **+10 points** - Frontage on highway/primary road

### Access Patterns
- [ ] ❌ ELIMINATE if requires >3 turns from highway/main road
- [ ] ⚠️ FLAG if 3 turns required
- [ ] ✓ IDEAL: <2 turns from major road
- [ ] **+15 points** - Direct highway access or frontage road

### Drive-Time Analysis
- [ ] ❌ ELIMINATE if <40,000 population within 5-min drive
- [ ] ✓ REQUIRE: 50,000+ population within 5-min drive
- [ ] **+15 points** - 75,000+ population within 5-min drive
- [ ] **+20 points** - 100,000+ population within 5-min drive

---

## STAGE 6: Financial & Site-Specific Analysis (Manual)
**Goal**: Select final 15-20 sites for detailed feasibility
**Data Sources**: Real estate listings, local appraisers, contractors

### Land Costs
- [ ] ⚠️ FLAG if land >$150,000/acre (high barrier to entry)
- [ ] ✓ IDEAL: $50,000-$100,000/acre
- [ ] **+10 points** - Below-market land pricing

### Site Characteristics
- [ ] ✓ IDEAL: 1 acre lots (120 units per acre)
- [ ] ✓ ALTERNATIVE: 2 acre lots near lakes/water (1 acre buildings + 1 acre dedicated RV/boat)
- [ ] ✓ REQUIRE: Flat or gently sloped terrain
- [ ] ⚠️ FLAG if wetlands/floodplain issues
- [ ] ❌ ELIMINATE if environmental remediation required
- [ ] Note: Can scale to multiple 1-acre parcels as demand grows

**Site Selection Strategy by Location**:
- **Standard sites**: 1 acre, phased buildout with temporary RV/boat on undeveloped space
- **Near lakes/rivers/marinas** (within 15 miles): 2 acres
  - **Permitting strategy**: Get BOTH acres approved for storage units (240 units total)
  - **Actual construction**: Build storage on Acre 1 only (120 units, phased)
  - **Acre 2 use**: RV/boat storage (40-50 spaces) - no construction initially
  - **Flexibility**: If RV/boat demand weak OR storage demand exceeds supply, can build Acre 2
  - **Benefit**: Already permitted, just need to order units/materials when ready
  - Higher RV/boat demand near water justifies holding land for that use

### Construction Method Determination (Stage 6 - After Site Selected)
**Decision Criteria**: Contact county planning/building department

- [ ] **Question 1**: "Can I operate a commercial storage facility using shipping containers?"
  - If YES → Evaluate shipping container option ($4,200/unit)
  - If NO → Metal building only option ($4,167-$5,000/unit)

- [ ] **Question 2**: "What permits are required for each construction method?"
  - Shipping containers: Land use permit? Building permit? Fees?
  - Metal buildings: Building permit, foundation engineering, inspections? Fees?

- [ ] **Question 3**: "What is the typical approval timeline for each?"
  - Containers: Weeks or months?
  - Metal buildings: Months? How many inspections?

**Decision Rule**:
- If containers allowed + faster/cheaper permitting → **BUILD WITH CONTAINERS**
- If containers banned OR equivalent permitting → **BUILD WITH METAL BUILDINGS**
- Factor: Permitting costs + timeline into total investment calculation

### Facility Design Specifications (Per Acre)
**Standard Unit**: 10' W × 10' D × 8.5' H (shipping container interior dimensions)

**Construction Method**: 10×10 shipping containers on gravel base
- **Foundation**: Compacted gravel pads (NO concrete)
- **Structure**: 10' × 10' shipping containers (ONE container = ONE unit)
- **Cost**: ~$2,500 per container delivered
- **Doors**: Standard container doors (no roll-up doors needed)
- **Power**: NO power to individual units (pure storage)
- **Climate Control**: NONE (standard storage only)
- **Advantage**: Lowest cost, fastest deployment, minimal permitting, no modifications needed

**Site Layout Parameters**:
- **Container dimensions**: 10' × 10' (exterior dimension)
- **Unit configuration**: Each container = one 10×10 unit (no partitions needed)
- **Container height**: 8.5 feet interior
- **Aisle Width**: 25 feet (vehicle access + natural drainage)
- **Phased Development**: Add containers as demand grows
- **Drainage**: Gravel surface = natural percolation, no stormwater infrastructure

**One-Acre Capacity Calculation (10×10 Containers)**:
```
1 acre = 43,560 sq ft

Container Configuration:
- Container dimensions: 10'W × 10'L (exterior)
- Each container = 1 unit (no partitions needed)
- Aisle requirement: 25' between container rows
- Module depth: 10' container + 25' aisle = 35' per module

MAXIMUM DENSITY CALCULATION:

Layout assumes 209' × 209' = 43,681 sq ft (≈1 acre)

Rows:
- Width available: 209' ÷ 35' = 5.97 rows → 5 rows (conservative)
  OR 6 rows if optimized (6 × 35' = 210')
- Using 6 rows: 6 rows × 35' = 210' (minimal perimeter space)

Containers per row:
- Length available: 209' ÷ 10' container = 20.9 → 20 containers per row

Total capacity:
- 6 rows × 20 containers = 120 containers
- 120 containers = 120 units

RECOMMENDED: 120 units per acre (optimized with 6 rows)
Conservative estimate: 100 units per acre (5 rows with more access space)

Key insight: 10×10 containers fit perfectly - no wasted space from partitioning
```

**10×10 Shipping Container Specifications**:
```
Standard 10' × 10' Shipping Container:
- Exterior: 10'L × 10'W × 8.5'H
- Interior: ~9.5'L × 9.5'W × 8'H
- Configuration: ONE container = ONE unit (no modifications)

Cost Breakdown Per Container (1 unit):
- Container delivered: $2,500
- Gravel pad (10' × 10' × 6" compacted): ~$200
- Total per container: $2,700

Cost per unit: $2,700

NO additional costs for:
- ❌ Concrete foundation
- ❌ Partitions/dividers (not needed)
- ❌ Metal studs/framing
- ❌ Exterior siding
- ❌ Roofing
- ❌ Roll-up doors (containers have built-in doors)
- ❌ Electrical to units
- ❌ HVAC/insulation
```

**Phased Development Model (Occupancy-Driven)**:
**Permitting Strategy**: Get full 1-acre buildout approved upfront (120 units)
**Construction Strategy**: Build in phases triggered by 80% occupancy

- [ ] **Phase 1** (Initial): Build 40 units (33% of capacity)
  - Investment: ~$171,500 (40 units + infrastructure)
  - Open space: Use for RV/boat storage (see below)
  - Target: Reach 80% occupancy (32 units rented) before Phase 2

- [ ] **Phase 2** (Triggered at 80% Phase 1 occupancy): Add 40 units
  - Investment: ~$168,000 (40 units + minimal infrastructure)
  - Total: 80 units operational
  - Open space: Continue RV/boat storage on undeveloped area
  - Target: Reach 80% occupancy (64 units rented) before Phase 3

- [ ] **Phase 3** (Triggered at 80% Phase 2 occupancy): Add 40 units
  - Investment: ~$168,000 (final 40 units)
  - Total: 120 units (full 1-acre buildout)
  - Decision: Keep RV/boat area OR convert to more units if demand warrants

**RV/Boat Storage (Bonus Revenue on Undeveloped Space)**:
**Zero Additional Investment** - use gravel areas between phases

Pricing (typical):
- RV storage (outdoor): $50-$100/month
- Boat storage (outdoor): $40-$80/month
- Covered RV/boat: $100-$150/month (simple carport structure)

Revenue Potential (Phase 1 with 40 units built):
- Available space: ~0.6 acres undeveloped
- Can fit: 15-20 RVs/boats on gravel
- Revenue: 18 spaces × $75/month avg = $1,350/month = $16,200/year
- Cost: $0 (land already paid for, gravel already down)
- Pure profit until Phase 2 construction

**Financial Benefits**:
- Minimize upfront capital (start with $171,500 vs $514,500)
- Generate immediate revenue from undeveloped land (RV/boat storage)
- Prove market demand before committing full capital
- RV/boat revenue helps fund next phases
- Reduce debt service (finance only built phases)
- Lower risk if market underperforms

**Permitting Benefits**:
- Pay permit fees once for full buildout
- Avoid re-permitting fees/delays
- Lock in current zoning/regulations
- Simpler inspections (all under one permit)
- RV/boat storage usually doesn't require additional permits (check locally)

**Site Preparation (Simplified)**:
- [ ] Grade site and establish drainage
- [ ] Lay compacted gravel base (entire site or pads only)
- [ ] No stormwater infrastructure needed (gravel = natural percolation)
- [ ] No detention ponds required
- [ ] Minimal environmental permits in rural areas

**Financial Modeling Per Acre (10×10 CONTAINERS)**:
```
Revenue Calculation (per acre, stabilized):
- Units: 120 (120 containers × 1 unit each)
- Avg rate: $90/month per 10×10 unit (rural/suburban pricing)
- Gross revenue: 120 × $90 × 12 = $129,600/year
- Occupancy: 85%
- Net revenue: $110,160/acre/year

Development Cost (per acre, 10×10 container method):
- Land: $50k-$100k (avg $75k)
- Dirt work (grading, drainage, compaction): $50,000
- Permitting (zoning, building, site development): $35,000
- Gravel base/pads: 120 containers × $200 = $24,000
- Containers: 120 containers × $2,500 = $300,000
- Site infrastructure:
  - Perimeter fencing: $12k-$18k (avg $15k)
  - LED lighting (perimeter/entrance): $6k-$10k (avg $8k)
  - Entry gate/access system: $4k-$6k (avg $5k)
  - Signage: $2k-$3k (avg $2.5k)
  - Total infrastructure: $30,500
- Total: $514,500 per acre

Notes:
- NO concrete pads
- NO partitions needed (1 container = 1 unit)
- NO power to units
- NO climate control
- NO stormwater infrastructure
- NO office
- Minimal rural permitting

ROI: $110,160 ÷ $514,500 = 21.4% annual return (stabilized)
Payback: ~4.7 years

Operating Expenses (estimated):
- Property taxes: ~$5k-$8k/acre/year (avg $6.5k, rural rates)
- Insurance: ~$4k-$6k/acre/year (avg $5k)
- Maintenance/repairs: ~$3k-$5k/acre/year (avg $4k)
- Management (remote/automated): ~4% of gross = $4.4k/year
- Utilities (LED lighting only): ~$1k-$2k/acre/year (avg $1.5k)
- Total OpEx: ~$21,400/acre/year

Net Operating Income (NOI):
- Revenue: $110,160/year
- OpEx: $21,400/year
- NOI: $88,760/acre/year

Cap Rate: NOI ÷ Total Investment
- $88,760 ÷ $514,500 = 17.3%

Per-Unit Economics (10×10 Containers):
- Development cost per unit: $514,500 ÷ 120 = $4,288/unit
- Annual revenue per unit: $1,080 @ 85% occupancy = $918/unit/year
- Annual NOI per unit: $740/year
- Cash-on-cash return: 21.4%

BOTTOM LINE PER ACRE (10×10 CONTAINERS - REALISTIC):
- Total Investment: $514,500
- Containers: $324,000 (120 containers @ $2,700 each including gravel)
- Dirt work: $50,000
- Permitting: $35,000
- Land: $75,000
- Infrastructure: $30,500
- Annual NOI: $88,760
- Payback: 4.7 years (all-cash)
- 21.4% ROI (all-cash)

WITH 100% FINANCING (25-year mortgage @ 6%):
Loan amount: $514,500
Annual debt service: $514,500 × 0.0791 (mortgage constant) = $40,697/year
Monthly payment: $3,391

Cash Flow Analysis:
- NOI: $88,760/year
- Debt service: $40,697/year
- Cash flow before tax: $48,063/year
- Cash-on-cash return: INFINITE (no money down)

Debt Coverage Ratio (DCR):
- NOI ÷ Debt Service = $88,760 ÷ $40,697 = 2.18
- Excellent! (Lenders want >1.25, you have 2.18)

Equity Buildup:
- Year 1 principal paydown: ~$9,800
- Year 5 principal paydown: ~$12,500
- Year 10 principal paydown: ~$16,400
- Year 25: Property owned free & clear

Return on Equity (Year 1):
- Cash flow: $48,063
- Principal paydown: $9,800
- Total return: $57,863
- With $0 down = INFINITE ROI

Note: Most lenders require 20-30% down for commercial real estate,
but even with 25% down ($128,625), your ROI would be:
- Cash flow: $48,063 ÷ $128,625 = 37.4% cash-on-cash return
```

- [ ] Calculate site-specific capacity based on actual acreage
- [ ] Model phase timing based on market absorption rate
- [ ] Adjust for local pricing (use competitor rates from Stage 4)
- [ ] Factor in climate control mix (premium units = higher revenue)

### Utility Access
- [ ] ✓ REQUIRE: Electric, water, sewer available or easily extended
- [ ] ⚠️ FLAG if utilities require >$50k to extend

### Construction Estimates
- [ ] Calculate: Cost per sq ft to build (typically $40-$80/sq ft)
- [ ] Calculate: Total development cost (land + construction + soft costs)

### Pro Forma ROI Modeling
- [ ] ✓ REQUIRE: >12% cash-on-cash return (Year 1 stabilized)
- [ ] ✓ REQUIRE: <7 year payback period
- [ ] **+20 points** - IRR >15%

### Regulatory Timeline
- [ ] ⚠️ FLAG if permitting >12 months
- [ ] **+10 points** - Fast-track permitting available

---

## STAGE 7: Advanced Criteria & Refinements (Optional Deep Dive)
**Goal**: Fine-tune scoring for borderline sites
**Data Sources**: Various (see specific criteria below)

### Economic Diversity & Stability
**Data Source**: Bureau of Labor Statistics (bls.gov), County Business Patterns
- [ ] ❌ ELIMINATE if >40% employment in single industry (collapse risk)
- [ ] ⚠️ FLAG if military base accounts for >50% local economy (deployment volatility)
- [ ] ✓ IDEAL: Diverse employment across 3+ sectors
- [ ] **+10 points** - Major university/hospital present (stable anchor institutions)

### Retail & Commercial Health Indicators
**Data Source**: State sales tax revenue reports, CoStar, local news
- [ ] ❌ ELIMINATE if commercial vacancy rate >20%
- [ ] ⚠️ FLAG if retail sales tax revenue declining 2+ years
- [ ] ✓ IDEAL: New retail development in past 2 years
- [ ] **+10 points** - Major retailers opened recently (Walmart, Target, Costco, Amazon warehouse)

### Housing Market Dynamics
**Data Source**: Zillow, Redfin, county building permits, foreclosure data
- [ ] ⚠️ FLAG if home sales volume declining >15% YoY
- [ ] ✓ IDEAL: Active new residential construction (100+ permits/year)
- [ ] **+15 points** - Major apartment complexes under construction
- [ ] **+10 points** - Home prices appreciating 3-7% annually (healthy growth)
- [ ] ❌ ELIMINATE if foreclosure rate >5% (distressed market)

### Student & Military Populations
**Data Source**: College/university websites, military base directories
- [ ] **+15 points** - College/university with 5,000+ students nearby
- [ ] **+20 points** - Military base with 2,000+ personnel (between-deployment storage)
- [ ] ✓ IDEAL: Student housing within 3 miles (summer storage demand)

### Tourism & Seasonal Economy
**Data Source**: Tourism boards, seasonal employment data
- [ ] **+10 points** - Tourist destination with seasonal residents (RV/boat storage)
- [ ] **+5 points** - Ski resort, beach town, lake community within 10 miles
- [ ] ⚠️ FLAG if >60% economy is seasonal (income volatility)

### Climate & Natural Disaster Risk
**Data Source**: FEMA flood maps, wildfire risk maps, insurance data
- [ ] ❌ ELIMINATE if FEMA 100-year floodplain
- [ ] ❌ ELIMINATE if high wildfire risk zone (insurance issues)
- [ ] ⚠️ FLAG if tornado alley (Tornado Index >200)
- [ ] ⚠️ FLAG if hurricane evacuation zone
- [ ] **+5 points** - Climate-driven storage demand (basement flooding area, high humidity)

### Business Formation Trends
**Data Source**: Secretary of State business registrations, County Clerk data
- [ ] ✓ IDEAL: New business registrations increasing YoY
- [ ] **+10 points** - Small business growth >5% annually (commercial storage demand)
- [ ] ❌ ELIMINATE if business closures exceed openings (2+ years)

### Land Use & Development Pipeline
**Data Source**: County planning departments, developer announcements
- [ ] **+20 points** - Major mixed-use development planned within 2 miles
- [ ] **+15 points** - Hospital/medical campus expansion announced
- [ ] **+10 points** - Industrial park or distribution center planned
- [ ] ⚠️ FLAG if adjacent to planned low-income housing (NIMBY concerns)

### Crime Statistics
**Data Source**: FBI UCR data, local police departments, NeighborhoodScout
- [ ] ❌ ELIMINATE if violent crime rate >2x national average
- [ ] ⚠️ FLAG if property crime rate >1.5x national average
- [ ] ✓ IDEAL: Crime declining over 3-year trend
- [ ] Note: Higher crime = need better facility security = higher costs

### Technology Infrastructure
**Data Source**: FCC broadband maps, carrier coverage maps
- [ ] ⚠️ FLAG if no reliable cell coverage (smart locks, remote management issues)
- [ ] ✓ REQUIRE: Broadband internet available (facility management systems)

### Competing Land Uses
**Data Source**: County GIS, zoning maps
- [ ] ❌ ELIMINATE if adjacent to airport (noise, height restrictions)
- [ ] ⚠️ FLAG if next to cemetery, industrial polluter, landfill
- [ ] ⚠️ FLAG if residential neighbors (NIMBY opposition risk)
- [ ] ✓ IDEAL: Light industrial or commercial corridor

### Transportation & Logistics Hubs
**Data Source**: Company press releases, logistics industry news
- [ ] **+15 points** - Within 10 miles of Amazon/FedEx/UPS distribution center
- [ ] **+10 points** - Intermodal rail facility nearby (trucking/logistics demand)
- [ ] **+5 points** - Active freight rail line (industrial storage demand)

### Demographic Migration Patterns
**Data Source**: IRS migration data, U-Haul migration trends, moving company data
- [ ] **+20 points** - Net in-migration >3% annually (people moving IN)
- [ ] ✓ IDEAL: Domestic migration from high-cost areas (CA, NY → FL, TX, TN, AZ)
- [ ] ❌ ELIMINATE if net out-migration >2% annually

### Commuter Patterns
**Data Source**: Census commute data, Longitude/StreetLight
- [ ] **+15 points** - Bedroom community (people commute OUT for work = less time)
- [ ] **+10 points** - Along major commuter corridor (highway visibility)
- [ ] ⚠️ FLAG if reverse commute area (lower traffic visibility)

### Proximity to Storage Clusters
**Data Source**: Google Maps, field observation
- [ ] **+10 points** - Near industrial parks with existing storage (validated demand)
- [ ] ⚠️ FLAG if directly adjacent to major competitor (cannibalization risk)

### Local Government Incentives
**Data Source**: Economic development offices, Opportunity Zone maps
- [ ] **+15 points** - Tax increment financing (TIF) district available
- [ ] **+10 points** - Opportunity Zone designation (capital gains tax benefits)
- [ ] **+5 points** - Fast-track permitting for commercial development

### Utility Costs
**Data Source**: Local utility rate schedules
- [ ] ⚠️ FLAG if electric rates >$0.15/kWh (operating cost concern)
- [ ] ✓ IDEAL: Low utility costs = better operating margins

### Remote Work Trends
**Data Source**: Census remote work data, coworking space presence
- [ ] **+10 points** - High remote work population (home offices = storage need)
- [ ] **+5 points** - Co-working spaces opening (small business growth proxy)

### RV/Boat/Vehicle Storage Indicators
**Data Source**: Google Maps, state park websites, marina directories, RV dealerships
**Key Research Questions**:
- [ ] **REQUIRED**: Measure distance to closest lake/river
- [ ] **REQUIRED**: Measure distance to closest campground/RV park

**Scoring by Proximity**:

Lake/River Distance:
- [ ] **+30 points** - Lake/river within 3 miles (STRONG 2-ACRE SITE CANDIDATE)
- [ ] **+25 points** - Lake/river within 5 miles (CONSIDER 2-ACRE SITE)
- [ ] **+20 points** - Lake/river within 10 miles (boat storage demand)
- [ ] **+10 points** - Lake/river within 15 miles (moderate boat demand)
- [ ] **0 points** - No lake/river within 15 miles

Campground Distance:
- [ ] **+20 points** - Campground within 5 miles (high seasonal RV storage)
- [ ] **+15 points** - Campground within 10 miles (moderate RV storage)
- [ ] **+10 points** - Campground within 15 miles (some RV storage)
- [ ] **0 points** - No campground within 15 miles

Additional RV/Boat Indicators:
- [ ] **+15 points** - RV dealerships present (RV ownership = storage demand)
- [ ] **+10 points** - Marinas at capacity (overflow boat storage opportunity)
- [ ] **+10 points** - Multiple campgrounds/RV parks in area (high RV ownership)
- [ ] **+5 points** - Boat launches/ramps nearby (active boating community)

**Decision Trigger**:
- If site scores **+40 points or more** from water/campground proximity → **Evaluate 2-acre purchase**
- Permit both acres for 240 units, build Acre 1, use Acre 2 for RV/boat

### Competitive Moat Potential
**Data Source**: Land availability analysis, zoning code review
- [ ] **+15 points** - Limited developable land (barriers to new competition)
- [ ] **+10 points** - Strict zoning makes future storage difficult to permit
- [ ] **-10 points** - Abundant cheap land (easy for competitors to enter)

---

## FINAL WEIGHTED SCORECARD (0-100 Points)

### Point Allocation
- [ ] **Market Saturation** (25 points max)
- [ ] **Demographics** (20 points max)
- [ ] **Traffic/Visibility** (20 points max)
- [ ] **Competition Strength** (15 points max)
- [ ] **Growth Trajectory** (10 points max)
- [ ] **Zoning Friendliness** (10 points max)

### Decision Thresholds
- **<40 points** - REJECT (not viable)
- **40-59 points** - MARGINAL (proceed only if no better options)
- **60-74 points** - GOOD (viable candidate)
- **75-89 points** - EXCELLENT (prioritize)
- **90-100 points** - OUTSTANDING (top tier, move quickly)

### Final Output
- [ ] Rank all sites by total score
- [ ] Select top 15-20 for detailed financial modeling
- [ ] Create site visit priority list

---

## DATA SOURCE QUICK REFERENCE

| Stage | Data Needed | Source | Cost |
|-------|-------------|--------|------|
| 0 | Highway projects, manufacturing | State DOT STIP, SelectUSA, EDAs | FREE |
| 1 | Zoning, census basics | County GIS, Census API | FREE |
| 2 | Competitor locations | Google Places API | $5-20 |
| 3 | Detailed demographics | Census ACS 5-year | FREE |
| 4 | Occupancy, pricing | SpareFoot, calls, visits | FREE-$500 |
| 5 | Traffic counts | State DOT, StreetLight | FREE-$200 |
| 6 | Land prices, construction | Realtors, contractors | FREE |
| 7 | Advanced refinements | Multiple sources (see Stage 7) | FREE-$200 |

### Key FREE Data Sources for Manufacturing Tracking:
- **SelectUSA.gov** - Foreign direct investment database
- **Reshorenow.org** - Reshoring Initiative tracker
- **Goodjobsfirst.org/megadeals** - Major project announcements
- **Commerce.gov/chips** - CHIPS Act funding recipients
- **State EDA websites** - Economic development press releases
- **Site Selection Magazine** - siteselection.com (industry news)

---

## EXAMPLE: Berkeley Springs, WV Analysis

### Stage 0: Highway Expansion ✓ EXCELLENT
- [x] US 522 Bypass - 4-lane bypass **JUST OPENED** June 2025 ($69M)
- [x] Northern connector opening 2027 ($35M)
- [x] Route 9 expansion in planning phase (15-point improvement project)
- **Score Boost**: +35 points (multiple major projects, perfect timing)

### Stage 1: Hard Eliminators ✓ PASS
- [x] Morgan County population: 17,327
- [x] Median income: $63,805
- [x] Poverty rate: 8%
- [x] Growth rate: 0.5-1.2% annually

### Stage 2: Market Saturation ✓ PASS
- [x] Demand calculation: 17,327 × 6 = 103,962 sq ft needed
- [x] Competition: KO Storage (near-monopoly with 3 locations)
- [x] Limited competition = opportunity for new entrant

### Stage 3: Demographics ⚠️ MIXED
- [x] Income $63,805 (in target range) +10 points
- [ ] Median age 48.5 (older demographic) -5 points
- [ ] Renter % - need more data

### Stage 4: Competition Analysis ✓ STRONG
- [x] KO Storage monopoly (60%+ market share)
- [x] Pricing: ~$0.59/sq ft (10x10 units at $59/month)
- [x] Customer reviews mention "no options" = undersupplied

### Stage 5: Traffic & Accessibility ✓ PASS
- [x] US 522: 13,400 vehicles/day (30% trucks)
- [x] Bypass creates new high-visibility interchange locations

### Preliminary Score: **82/100 (EXCELLENT)**

**Recommendation**: Priority acquisition near southern bypass terminus (Winchester Grade Rd) or northern connector route (opens 2027)
