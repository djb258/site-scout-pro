# Quick Start: Import PA Jurisdiction Data

## Current Status
- **Counties in system**: 40 PA counties
- **Counties with data**: 1 (Berks)
- **Jurisdictions imported**: 3
- **Need to import**: ~1,500+ jurisdictions across 40 counties

## Fastest Method: Manual Export + Automated Import

### Step 1: Export Data from PA DCED Portal (5 minutes)

1. **Visit**: https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel

2. **Select Parameters**:
   - **County**: "- All Counties -" (first option)
   - **Entity Type**: Municipality  
   - **Municipality Class**: All Classes

3. **Export to Excel**:
   - Click "View Report" button
   - Wait for report to load (30-60 seconds)
   - Look for Excel export button/link (usually in toolbar)
   - Click to download Excel file
   - Save as: `pa_all_jurisdictions.xlsx`

### Step 2: Import to Database (30 seconds)

```bash
python import_pa_counties_jurisdictions.py pa_all_jurisdictions.xlsx
```

This will:
- ✅ Filter to only counties in your system (40 counties)
- ✅ Parse all jurisdiction data
- ✅ Import into `jurisdiction_cards` table
- ✅ Show summary by county

### Expected Results

After import, you should have:
- **~1,500-2,000 jurisdictions** (filtered to your 40 counties)
- **All 40 counties** with jurisdiction data
- **Basic info**: names, types, zoning status, permit offices

## Alternative: Automated Scraping (If Manual Doesn't Work)

If you want to try automated scraping:

```bash
python scrape_pa_dced_selenium.py
```

**Note**: This requires ChromeDriver and may need adjustments based on the portal's current structure.

## Verify Import

After importing, check results:

```bash
python -c "
import psycopg2
from psycopg2.extras import RealDictCursor

DB_URL = 'postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(DB_URL)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute('''
    SELECT county_name, COUNT(*) as count
    FROM jurisdiction_cards
    WHERE state = 'PA'
    GROUP BY county_name
    ORDER BY count DESC
    LIMIT 10;
''')

print('Top 10 counties by jurisdiction count:')
for row in cur.fetchall():
    print(f'  {row[\"county_name\"]}: {row[\"count\"]} jurisdictions')

cur.close()
conn.close()
"
```

## Files Created

1. **`import_pa_counties_jurisdictions.py`** - Main import script (filters to your counties)
2. **`scrape_pa_dced_selenium.py`** - Automated scraper (optional)
3. **`scrape_pa_jurisdiction_data.py`** - Base parsing functions

## Next Steps After Import

1. **Validate Data**: Check that all 40 counties have data
2. **Enhance Data**: Add zoning details, permit portals, GIS URLs
3. **Use in Feasibility**: Jurisdiction cards will now be available for feasibility analysis
4. **Replicate for Other States**: Use same approach for WV, OH, MD, VA, NY

## Troubleshooting

**Issue**: Excel file format doesn't match expected columns
- **Solution**: Check `scrape_pa_jurisdiction_data.py` column mapping, adjust if needed

**Issue**: Some counties missing
- **Solution**: Check if county names match exactly (case-sensitive)

**Issue**: Import fails
- **Solution**: Check database connection, verify table schema matches

## Support

If you encounter issues:
1. Check the Excel file format matches expected columns
2. Verify database connection is working
3. Check logs for specific error messages

