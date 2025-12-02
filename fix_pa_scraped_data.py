"""
Fix the scraped PA data - extract proper headers and clean the data.
"""

import pandas as pd
from io import StringIO

# Read the scraped file
df = pd.read_excel('downloads/pa_jurisdictions_scraped.xlsx')

print(f"Original: {len(df)} rows, {len(df.columns)} columns")
print("First 10 rows:")
print(df.head(10))

# The actual data table is likely table 11 from the HTML
# Let's re-parse the HTML to get the correct table
with open('pa_report.html', 'r', encoding='utf-8') as f:
    html = f.read()

tables = pd.read_html(StringIO(html))

# Table 11 has the actual data with headers in row 1
data_table = tables[11]

print(f"\nData table: {len(data_table)} rows, {len(data_table.columns)} columns")
print("First few rows:")
print(data_table.head(10))

# The headers are in row 1 (index 1), data starts at row 2 (index 2)
if len(data_table) > 1:
    # Use row 1 as headers
    headers = data_table.iloc[1].tolist()
    print(f"\nHeaders: {headers}")
    
    # Create new dataframe starting from row 2
    clean_df = data_table.iloc[2:].copy()
    clean_df.columns = headers
    
    # Clean up column names
    clean_df.columns = [str(col).strip().upper().replace(' ', '_') if pd.notna(col) else f'col_{i}' 
                       for i, col in enumerate(clean_df.columns)]
    
    # Remove rows that are all NaN
    clean_df = clean_df.dropna(how='all')
    
    print(f"\nCleaned: {len(clean_df)} rows")
    print("Column names:")
    print(list(clean_df.columns))
    print("\nFirst few rows:")
    print(clean_df.head())
    
    # Save cleaned version
    clean_df.to_excel('downloads/pa_jurisdictions_cleaned.xlsx', index=False)
    print(f"\nSaved cleaned data to: downloads/pa_jurisdictions_cleaned.xlsx")
    
    # Show sample of actual data
    print("\nSample data rows:")
    for idx, row in clean_df.head(5).iterrows():
        county = row.get('COUNTY_NAME', 'N/A')
        muni_id = row.get('MUNICIPALITY_ID', 'N/A')
        muni_name = row.get('MUNICIPALITY_NAME', 'N/A')
        print(f"  {county} - {muni_name} (ID: {muni_id})")

