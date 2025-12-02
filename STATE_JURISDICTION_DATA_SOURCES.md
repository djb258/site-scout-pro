# State-Level Jurisdiction Data Sources

## Overview
This document catalogs state-level portals and databases that provide municipal planning, zoning, and building code information similar to Pennsylvania's DCED portal.

---

## Pennsylvania ✅ (Implemented)

**Portal**: [DCED Municipal Statistics](https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel)

**What it provides**:
- County and municipality names
- Municipality class (Borough, City, Township)
- Zoning ordinance status
- Planning commission status
- Building code status and type
- Permit office information

**Coverage**: All 67 counties, ~2,500+ municipalities

**Script**: `scrape_pa_jurisdiction_data.py`

---

## West Virginia

### Potential Sources:

1. **WV Municipal League**
   - Website: https://www.wvml.org/
   - May have municipal directory/statistics
   - **Status**: Needs investigation

2. **WV Department of Commerce - Community Development**
   - Website: https://commerce.wv.gov/
   - May have planning/zoning resources
   - **Status**: Needs investigation

3. **WV State Auditor's Office - Municipal Finance**
   - May have municipal directory
   - **Status**: Needs investigation

**Action Items**:
- [ ] Research WV Municipal League for directory
- [ ] Check WV Commerce Department for planning resources
- [ ] Look for state-level building code database

---

## Ohio

### Potential Sources:

1. **Ohio Municipal League**
   - Website: https://www.omlohio.org/
   - Has municipal directory
   - **Status**: Needs investigation

2. **Ohio Department of Commerce - Division of State Fire Marshal**
   - Building code enforcement
   - **Status**: Needs investigation

3. **Ohio Auditor of State - Local Government Services**
   - Municipal financial data
   - May include municipal directory
   - **Status**: Needs investigation

**Action Items**:
- [ ] Check OML directory for municipal data
- [ ] Research state building code database
- [ ] Look for planning/zoning state-level resources

---

## Maryland

### Potential Sources:

1. **Maryland Municipal League**
   - Website: https://www.mdmunicipal.org/
   - Municipal directory available
   - **Status**: Needs investigation

2. **Maryland Department of Planning**
   - Website: https://planning.maryland.gov/
   - State planning resources
   - **Status**: Needs investigation

3. **Maryland Department of Housing & Community Development**
   - Building code information
   - **Status**: Needs investigation

**Action Items**:
- [ ] Check MML directory format
- [ ] Research MD Planning Department resources
- [ ] Look for building code database

---

## Virginia

### Potential Sources:

1. **Virginia Municipal League**
   - Website: https://www.vml.org/
   - Municipal directory
   - **Status**: Needs investigation

2. **Virginia Department of Housing & Community Development**
   - Building code enforcement
   - **Status**: Needs investigation

3. **Virginia Department of Planning & Budget**
   - Planning resources
   - **Status**: Needs investigation

**Action Items**:
- [ ] Check VML directory
- [ ] Research DHCD building code resources
- [ ] Look for planning/zoning database

---

## New York

### Potential Sources:

1. **New York State Conference of Mayors**
   - Website: https://www.nycom.org/
   - Municipal directory
   - **Status**: Needs investigation

2. **New York Department of State - Division of Local Government**
   - Website: https://www.dos.ny.gov/localgov/
   - Municipal services and resources
   - **Status**: Needs investigation

3. **New York Department of State - Division of Code Enforcement**
   - Building code information
   - **Status**: Needs investigation

**Action Items**:
- [ ] Check NYCOM directory
- [ ] Research DOS Local Government resources
- [ ] Look for building code database

---

## National/Cross-State Resources

### 1. U.S. Census Bureau - Building Permits Survey
- **URL**: https://www.census.gov/permits/
- **What it provides**: Building permit data at municipal level
- **Coverage**: All states
- **Limitation**: Permits only, not zoning/planning info
- **Use Case**: Supplement jurisdiction data with permit activity

### 2. BuildZoom National Database
- **URL**: https://www.buildzoom.com/data
- **What it provides**: 350M+ building permits, contractor data
- **Coverage**: 90% of U.S. population
- **Limitation**: Commercial service, may require API access
- **Use Case**: Permit activity and contractor information

### 3. HUD State of the Cities Data Systems (SOCDS)
- **URL**: https://www.huduser.gov/portal/datasets/socds.html
- **What it provides**: Building permit data for metro areas
- **Coverage**: Metropolitan areas
- **Limitation**: Metro-level, not all municipalities
- **Use Case**: Metro area analysis

---

## Data Collection Strategy

### Phase 1: State-Level Portals (Priority)
1. ✅ **Pennsylvania** - DCED portal (implemented)
2. **West Virginia** - Research WV Municipal League
3. **Ohio** - Research OML and Commerce Department
4. **Maryland** - Research MML and Planning Department
5. **Virginia** - Research VML and DHCD

### Phase 2: Municipal League Directories
- Most states have municipal leagues with directories
- Format varies: PDF, Excel, web database
- May require manual extraction or custom scraping

### Phase 3: State Agency Databases
- Department of Commerce/Planning
- Building code enforcement agencies
- Auditor/Comptroller offices (municipal finance data)

### Phase 4: National Data Sources
- Census Building Permits Survey (municipal-level)
- BuildZoom (if API access available)
- HUD SOCDS (metro areas)

---

## Common Data Fields to Extract

For each state portal, look for:

### Basic Information
- [ ] County name
- [ ] Municipality name
- [ ] Municipality type (City, Town, Township, Borough, etc.)
- [ ] County FIPS code
- [ ] State FIPS code

### Zoning/Planning
- [ ] Has zoning ordinance (Yes/No)
- [ ] Has planning commission (Yes/No)
- [ ] Zoning districts/types
- [ ] Storage allowed (if available)

### Building Code
- [ ] Has building code (Yes/No)
- [ ] Building code type (UCC, IBC, etc.)
- [ ] Building code enforcement agency

### Permits
- [ ] Permit office name
- [ ] Permit office phone
- [ ] Permit office address
- [ ] Online permit system (Yes/No)
- [ ] Permit portal URL (if available)

### GIS/Technology
- [ ] GIS portal URL
- [ ] Parcel search URL
- [ ] Zoning map URL

---

## Script Template

For each new state, create a script following the PA pattern:

```python
# scrape_[state]_jurisdiction_data.py
# Template based on scrape_pa_jurisdiction_data.py

STATE = "[STATE_CODE]"
STATE_COUNTIES = {
    # County name: FIPS code mapping
}

def scrape_[state]_jurisdiction_report():
    # State-specific scraping logic
    pass

def parse_jurisdiction_data(df):
    # State-specific parsing logic
    pass
```

---

## Next Steps

1. **Test PA script** - Verify it works with manual Excel export
2. **Research WV** - Start with WV Municipal League
3. **Create WV script** - Adapt PA script for WV format
4. **Repeat for other states** - OH, MD, VA, NY
5. **Consolidate scripts** - Create unified import function

---

## Resources

### State Municipal Leagues (Good Starting Points)
- **PA**: https://www.pml.org/
- **WV**: https://www.wvml.org/
- **OH**: https://www.omlohio.org/
- **MD**: https://www.mdmunicipal.org/
- **VA**: https://www.vml.org/
- **NY**: https://www.nycom.org/

### State Planning Departments
- **PA**: https://www.dced.pa.gov/
- **WV**: https://commerce.wv.gov/
- **OH**: https://development.ohio.gov/
- **MD**: https://planning.maryland.gov/
- **VA**: https://www.dhcd.virginia.gov/
- **NY**: https://www.dos.ny.gov/

---

## Notes

- **Format Variations**: Each state will have different data formats
- **Access Methods**: Some may require form submissions, others may have direct downloads
- **Coverage**: Not all states have comprehensive municipal databases
- **Update Frequency**: Data freshness varies by state
- **Legal Considerations**: Check terms of use for each data source

