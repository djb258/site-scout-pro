# Pennsylvania Jurisdiction Data Import Guide

## Overview
The [Pennsylvania DCED Municipal Statistics portal](https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel) provides County/Municipal Planning, Zoning & Building Code information that can populate:

1. **`jurisdiction_cards`** table (currently 3 rows → could be 2,500+ PA municipalities)
2. **`zoning_cache`** table (currently empty)
3. **`county_gis_portals`** table (currently empty)

---

## Data Source

**URL**: https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel

**What it provides**:
- County and municipality names
- Municipality class (Borough, City, Township, etc.)
- Zoning ordinance status (Yes/No)
- Planning commission status
- Building code status and type
- Permit office information
- Contact information

**Coverage**: All 67 PA counties, ~2,500+ municipalities

---

## Import Methods

### Method 1: Automated Scraping (Recommended)

**Script**: `scrape_pa_jurisdiction_data.py`

**Usage**:
```bash
# Scrape all counties (may require session handling)
python scrape_pa_jurisdiction_data.py

# Or scrape specific county
python scrape_pa_jurisdiction_data.py --county BERKS
```

**Challenges**:
- The site uses ASP.NET SSRS (SQL Server Reporting Services)
- Requires ViewState handling
- May need browser automation (Selenium) for full automation

**If automated scraping fails**, use Method 2 below.

---

### Method 2: Manual Excel Export (Fallback)

**Steps**:

1. **Visit the portal**:
   - Go to: https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel

2. **Select parameters**:
   - **County**: Select "All Counties" (or specific county for testing)
   - **Entity Type**: Municipality
   - **Municipality Class**: All Classes (or specific: Boroughs, Cities, Townships)

3. **Export to Excel**:
   - Click "View Report" or look for Excel export button
   - Save the Excel file (e.g., `pa_jurisdictions.xlsx`)

4. **Import via script**:
   ```bash
   python scrape_pa_jurisdiction_data.py --file pa_jurisdictions.xlsx
   ```

---

### Method 3: Browser Automation (Most Reliable)

**Using Selenium** (if Method 1 fails):

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
import pandas as pd

# Setup
driver = webdriver.Chrome()
driver.get("https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel")

# Select "All Counties"
county_select = Select(driver.find_element(By.ID, "county_dropdown"))
county_select.select_by_value("ALL")

# Click View Report
driver.find_element(By.ID, "view_report_button").click()

# Wait for report to load, then export
# ... extract data or trigger Excel export
```

---

## Data Mapping

### From PA DCED Report → `jurisdiction_cards` Table

| PA Report Column | `jurisdiction_cards` Field | Notes |
|------------------|---------------------------|-------|
| County | `county_name` | Map to county_fips using PA_COUNTIES dict |
| Municipality | `jurisdiction` | Municipality name |
| Municipality Class | `jurisdiction_type` | Borough, City, Township, etc. |
| Has Zoning | `has_zoning` | Boolean (Yes/No → True/False) |
| Has Planning | (Not directly mapped) | Could indicate planning commission |
| Has Building Code | (Not directly mapped) | Could indicate building code enforcement |
| Building Code Type | (Not directly mapped) | UCC, IBC, etc. |
| Permit Office | `permit_office_name` | Building/zoning official |
| Permit Office Phone | `permit_office_phone` | Contact phone |
| GIS Portal URL | `permit_portal_url` | If available |

### Additional Fields to Research (Not in DCED Report)

These fields require additional research/manual entry:
- `storage_allowed` - Need to review zoning ordinances
- `storage_zones` - Specific zoning districts allowing storage
- `min_aisle_width_ft` - Zoning requirements
- `min_lot_size_acres` - Zoning requirements
- `max_lot_coverage_pct` - Zoning requirements
- `setback_*` - Setback requirements
- `stormwater_required` - Stormwater management requirements
- `approval_process` - Planning/zoning board process
- `public_hearing_required` - Conditional use requirements
- `approval_timeline_days` - Typical permit timeline

---

## Expected Results

### Before Import
- **jurisdiction_cards**: 3 rows (likely WV test data)
- **zoning_cache**: 0 rows
- **county_gis_portals**: 0 rows

### After Import (PA Only)
- **jurisdiction_cards**: ~2,500+ rows (all PA municipalities)
- **zoning_cache**: 67 rows (one per county, if we can extract county-level zoning info)
- **county_gis_portals**: 67 rows (if GIS URLs are available)

### Full Coverage (All States)
If we replicate this for other states:
- **jurisdiction_cards**: ~35,000+ rows (all US municipalities)
- **zoning_cache**: ~3,000+ rows (all US counties)

---

## Next Steps After Import

1. **Validate Data**:
   ```sql
   SELECT COUNT(*) FROM jurisdiction_cards WHERE state = 'PA';
   SELECT county_name, COUNT(*) 
   FROM jurisdiction_cards 
   WHERE state = 'PA' 
   GROUP BY county_name 
   ORDER BY COUNT(*) DESC;
   ```

2. **Fill Research Gaps**:
   - Mark `jurisdiction_research_checklist` fields that need research
   - Prioritize high-opportunity counties
   - Use `research_gaps` field to track what's missing

3. **Enhance with Additional Data**:
   - **Zoning ordinances**: Review actual ordinances for storage-specific requirements
   - **GIS portals**: Find and populate `county_gis_portals` table
   - **Permit portals**: Research online permit systems, populate `permit_portal_url`
   - **Stormwater requirements**: Research county-specific stormwater regulations

4. **Replicate for Other States**:
   - Find similar state-level portals for other target states
   - Adapt the scraping script for each state's format
   - WV, OH, MD, VA, NY, etc.

---

## Database Schema Reference

### `jurisdiction_cards` Key Fields
```sql
state VARCHAR(2)                    -- 'PA'
county_fips VARCHAR(5)              -- '42001' (Adams County)
county_name VARCHAR(100)             -- 'ADAMS'
jurisdiction VARCHAR(100)            -- Municipality name
jurisdiction_type VARCHAR(50)        -- 'Borough', 'City', 'Township'
has_zoning BOOLEAN                   -- True/False
permit_office_name VARCHAR(100)      -- Building official name
permit_office_phone VARCHAR(20)      -- Phone number
permit_portal_url VARCHAR(500)       -- Online permit system URL
source_url VARCHAR(500)              -- DCED report URL
```

### `zoning_cache` Key Fields
```sql
county_fips VARCHAR(5) PK
state VARCHAR(2)
county_name VARCHAR(100)
storage_allowed VARCHAR(50)          -- 'yes', 'no', 'conditional'
moratorium BOOLEAN                   -- Temporary ban on storage
source_url VARCHAR(500)
researched_at DATE
```

---

## Troubleshooting

### Issue: Script can't access report
**Solution**: Use Method 2 (manual Excel export) or Method 3 (Selenium)

### Issue: Excel file format doesn't match expected columns
**Solution**: 
1. Check actual column names in Excel
2. Update `column_mapping` in `parse_jurisdiction_data()` function
3. Add new column mappings as needed

### Issue: County FIPS codes don't match
**Solution**: 
1. Verify PA_COUNTIES dictionary is correct
2. Check if county names need normalization (e.g., "BERKS" vs "Berks County")
3. Update mapping logic

### Issue: Missing data fields
**Solution**: 
- DCED report provides basic info only
- Use `research_gaps` field to track what needs manual research
- Prioritize high-opportunity jurisdictions for detailed research

---

## Related Tables to Populate

After importing jurisdiction data, consider populating:

1. **`county_gis_portals`** - Find GIS portal URLs for each county
2. **`zoning_cache`** - Extract county-level zoning summaries
3. **`jurisdiction_research_checklist`** - Mark which fields need research
4. **`permits_raw`** - Start scraping permit data from permit portals

---

## Contact

**PA DCED Contact**:
- Phone: 888-223-6837
- Email: RA-munistats@pa.gov
- Website: https://www.dced.pa.gov/

For questions about data format or API access, contact DCED directly.

