# Jurisdiction Intelligence Database

## Overview

Complete jurisdiction data for **56 counties** across 4 states, supporting self-storage site feasibility analysis.

**Last Updated**: December 2, 2025

---

## Coverage Summary

| State | Counties | Zoning | GIS | Permits | TPA | Notes |
|-------|----------|--------|-----|---------|-----|-------|
| **PA** | 23 | 23 | 23 | 23 | 23 | Municipal/Hybrid zoning, UCC with TPAs |
| **WV** | 15 | 15 | 15 | 15 | 15 | Opt-in zoning (many have NONE) |
| **VA** | 13 | 13 | 13 | 13 | 13 | County-level (Dillon Rule), USBC |
| **MD** | 5 | 5 | 5 | 5 | 5 | County-level, IBC/IRC |
| **Total** | **56** | **56** | **56** | **56** | **56** | |

---

## Database Schema

### Core Tables

#### `jurisdictions`
Base county records with metadata.

| Column | Type | Description |
|--------|------|-------------|
| jurisdiction_id | varchar | Primary key (e.g., `PA-SOMERSET`, `WV-54061`) |
| county_name | varchar | County name |
| state_code | varchar | 2-letter state code |
| state_name | varchar | Full state name |
| zoning_authority | varchar | MUNICIPAL, COUNTY, HYBRID, or NONE |
| municipality_count | int | Number of municipalities in county |
| pipeline_priority | varchar | HIGH, MEDIUM, LOW or Tier 1/2/3 |
| data_quality_rating | varchar | HIGH, MEDIUM, LOW |
| notes | text | Research notes and findings |

#### `jurisdiction_zoning`
Zoning ordinance details and self-storage allowances.

| Column | Type | Description |
|--------|------|-------------|
| jurisdiction_id | varchar | Foreign key |
| ordinance_online | boolean | Zoning ordinance available online |
| ordinance_url | varchar | URL to ordinance |
| self_storage_defined | boolean | Self-storage explicitly defined |
| self_storage_term | varchar | Term used (mini-warehouse, self-storage, etc.) |
| zones_allowed | varchar | Zoning districts where storage allowed |
| by_right_zones | varchar | Districts with by-right approval |
| conditional_zones | varchar | Districts requiring SUP/CUP |
| setback_requirements | boolean | Has specific setbacks |
| setback_details | varchar | Front/Side/Rear dimensions |
| special_restrictions | text | Notes on restrictions |

#### `jurisdiction_gis`
GIS portal information and capabilities.

| Column | Type | Description |
|--------|------|-------------|
| jurisdiction_id | varchar | Foreign key |
| portal_exists | boolean | Has GIS portal |
| portal_url | varchar | GIS portal URL |
| platform | varchar | ArcGIS, MapBlock, Custom, etc. |
| has_zoning_layer | boolean | Zoning districts visible |
| has_parcel_layer | boolean | Parcel boundaries available |
| has_owner_info | boolean | Owner names searchable |
| has_flood_layer | boolean | FEMA flood zones visible |
| downloadable_data | boolean | Data export available |
| download_sources | varchar | Open Data, Hub, etc. |

#### `jurisdiction_permits`
Permit system capabilities.

| Column | Type | Description |
|--------|------|-------------|
| jurisdiction_id | varchar | Foreign key |
| online_system_exists | boolean | Has online permit system |
| portal_url | varchar | Permit portal URL |
| platform | varchar | Tyler EnerGov, MGO Connect, Custom, etc. |
| public_search | boolean | Public can search permits |
| public_apply | boolean | Online application available |
| search_by_address | boolean | Address search supported |
| shows_status | boolean | Permit status visible |
| shows_inspection_history | boolean | Inspection history visible |
| monthly_reports_available | boolean | Monthly permit reports |
| monthly_reports_url | varchar | URL to reports |

#### `jurisdiction_tpa`
Third-Party Administrator / Building Department contacts.

| Column | Type | Description |
|--------|------|-------------|
| jurisdiction_id | varchar | Foreign key |
| uses_tpa | boolean | Uses third-party administrator |
| tpa_name | varchar | Name of TPA or department |
| tpa_website | varchar | Website URL |
| tpa_portal_url | varchar | Portal URL |
| tpa_phone | varchar | Phone number |
| tpa_email | varchar | Email address |
| tpa_address | varchar | Physical address |
| coverage_type | varchar | SINGLE, PARTIAL, FRAGMENTED, STATE |
| notes | text | Additional notes |

---

## State-by-State Details

### Pennsylvania (23 Counties)

**Zoning Authority**: Municipal/Hybrid via PA Municipalities Planning Code

**Key Findings**:
- Most fragmented state - each municipality has own zoning
- County-level zoning rare (only Germany/Menallen Twp in Adams)
- Third-Party Administrators (TPAs) common for UCC enforcement
- PMCA (PA Municipal Code Alliance) serves multiple counties

**Tier 1 (HIGH Priority)**:
| County | GIS Portal | Permit System | TPA |
|--------|------------|---------------|-----|
| Somerset | ArcGIS | None | PMCA |
| Franklin | ArcGIS | PMCA Portal | PMCA |
| Westmoreland | ArcGIS Public | None | Municipal varies |
| Fayette | Custom | County UCC | County |
| Washington | ArcGIS Hub | Custom | Harshman CE Group |
| Centre | ArcGIS Open Data | None | Municipal varies |
| Cumberland | ArcGIS | None | Municipal varies |
| Adams | ArcGIS Hub | PMCA | PMCA |
| York | ArcGIS Hub | None | Municipal varies |
| Dauphin | ArcGIS | None | Municipal varies |
| Indiana | Custom | ICOPD Portal | ICOPD |

**Tier 2-3 (MEDIUM/LOW Priority)**:
- Fulton, Huntingdon, Greene, Mifflin, Perry, Clearfield, Juniata, Clinton
- Bedford, Blair, Cambria, Allegheny (fragmented)

---

### West Virginia (15 Counties)

**Zoning Authority**: County-level or NONE (opt-in state)

**Key Findings**:
- WV is an "opt-in" state - counties can choose NOT to have zoning
- Many rural counties have NO ZONING - very business-friendly
- State Fire Marshal handles commercial building codes in unzoned areas
- Eastern Panhandle (Berkeley, Jefferson, Morgan) most developed

**Zoned Counties** (have county zoning):
| County | Zones Allowed | By-Right | Portal |
|--------|---------------|----------|--------|
| Berkeley | C-2, I-1, I-2 | I-1, I-2 | OneStop |
| Jefferson | B-2, I-1, I-2 | I-1, I-2 | MGO Connect |
| Morgan | Commercial, Industrial | Industrial | None |

**Unzoned Counties** (NO county zoning):
- Hampshire, Preston, Grant, Pendleton, Pocahontas
- Very favorable for development - minimal regulatory burden
- Contact State Fire Marshal for commercial building codes

**Partial/Limited Zoning**:
- Monongalia, Mineral, Hardy, Randolph, Marion, Harrison, Tucker

---

### Virginia (13 Counties)

**Zoning Authority**: County-level (Dillon Rule state)

**Key Findings**:
- Virginia is a Dillon Rule state - localities only have powers explicitly granted
- Uniform Statewide Building Code (USBC) enforced at county level
- All counties have zoning (required by state)
- Shenandoah Valley corridor is primary market

**Tier 1 - I-81 Corridor**:
| County | Zones Allowed | By-Right | Permit Portal |
|--------|---------------|----------|---------------|
| Frederick | B-2, B-3, M-1, M-2 | M-1, M-2 | Tyler EnerGov |
| Warren | B-2, I-1, I-2 | I-1, I-2 | Custom |
| Shenandoah | B-2, M-1, M-2 | M-1, M-2 | Custom |
| Rockingham | B-2, M-1, M-2 | M-1, M-2 | Custom |
| Augusta | B-2, M-1, M-2 | M-1, M-2 | Custom |

**Tier 2-3**:
- Clarke, Page, Alleghany, Rockbridge, Botetourt (Tier 2)
- Highland, Bath, Amherst (Tier 3 - very rural)

---

### Maryland (5 Counties)

**Zoning Authority**: County-level

**Key Findings**:
- County-level zoning throughout
- IBC/IRC adopted statewide
- Western MD is target market (I-68/I-70 corridors)
- Frederick County is premium DC-adjacent market

**All Counties**:
| County | Zones Allowed | By-Right | GIS Portal |
|--------|---------------|----------|------------|
| Washington | BG, IG, HI | IG, HI | ArcGIS |
| Frederick | GC, LI, GI | LI, GI | ArcGIS |
| Allegany | C-2, I-1, I-2 | I-1, I-2 | ArcGIS |
| Garrett | C-2, I-1 | I-1 | ArcGIS |
| Carroll | B-G, I-G, I-R | I-G, I-R | ArcGIS |

---

## Data Import Scripts

### Pennsylvania
```bash
python insert_pa_tier1_jurisdictions.py    # 10 Tier 1 counties
python insert_pa_tier2_3_jurisdictions.py  # 9 Tier 2-3 counties
```

### West Virginia
```bash
python insert_wv_jurisdictions.py  # 15 counties
```

### Virginia
```bash
python insert_va_jurisdictions.py  # 13 counties
```

### Maryland
```bash
python insert_md_jurisdictions.py  # 5 counties
```

---

## Query Examples

### Find counties where self-storage is by-right in industrial:
```sql
SELECT j.state_code, j.county_name, jz.by_right_zones
FROM jurisdictions j
JOIN jurisdiction_zoning jz ON j.jurisdiction_id = jz.jurisdiction_id
WHERE jz.by_right_zones LIKE '%I-%' OR jz.by_right_zones LIKE '%M-%'
ORDER BY j.state_code, j.county_name;
```

### Find counties with online permit portals:
```sql
SELECT j.state_code, j.county_name, jp.portal_url, jp.platform
FROM jurisdictions j
JOIN jurisdiction_permits jp ON j.jurisdiction_id = jp.jurisdiction_id
WHERE jp.online_system_exists = TRUE
ORDER BY j.state_code, j.county_name;
```

### Find unzoned WV counties:
```sql
SELECT j.county_name, jz.zones_allowed, jz.special_restrictions
FROM jurisdictions j
JOIN jurisdiction_zoning jz ON j.jurisdiction_id = jz.jurisdiction_id
WHERE j.state_code = 'WV' AND jz.zones_allowed = 'NO ZONING';
```

### Get TPA contact info:
```sql
SELECT j.state_code, j.county_name, jt.tpa_name, jt.tpa_phone, jt.tpa_address
FROM jurisdictions j
JOIN jurisdiction_tpa jt ON j.jurisdiction_id = jt.jurisdiction_id
WHERE jt.tpa_phone IS NOT NULL
ORDER BY j.state_code, j.county_name;
```

---

## Data Sources

### State-Level Resources

| State | Planning Portal | Building Codes | GIS Statewide |
|-------|-----------------|----------------|---------------|
| PA | [DCED MunStats](https://apps.dced.pa.gov/Munstats-public/) | UCC (Act 45) | [PASDA](https://www.pasda.psu.edu/) |
| WV | [WV Commerce](https://commerce.wv.gov/) | State Fire Marshal | [MapWV](http://www.mapwv.gov/) |
| VA | [DHCD](https://www.dhcd.virginia.gov/) | USBC | [VGIN](https://vgin.vdem.virginia.gov/) |
| MD | [MDP](https://planning.maryland.gov/) | IBC/IRC | [iMAP](https://imap.maryland.gov/) |

### County GIS Portals (Best)

| County | Platform | URL |
|--------|----------|-----|
| Frederick, VA | ArcGIS | https://gis.fcva.us/ |
| Jefferson, WV | ArcGIS Open Data | https://od-jcwvgis.opendata.arcgis.com/ |
| Berkeley, WV | Berkeley Online | https://maps.berkeleywv.org/berkeleyonline/ |
| Frederick, MD | ArcGIS | https://gis.frederickcountymd.gov/ |
| York, PA | ArcGIS Hub | https://york-county-pa-gis-portal-yorkcountypa.hub.arcgis.com/ |

---

## Maintenance

### Updating Jurisdiction Data

1. Run the appropriate state script to refresh data
2. Scripts use `ON CONFLICT ... DO UPDATE` for safe re-runs
3. Check `research_date` field for data freshness

### Adding New Counties

1. Add county to `jurisdictions` table
2. Research zoning ordinance and add to `jurisdiction_zoning`
3. Find GIS portal and add to `jurisdiction_gis`
4. Document permit system in `jurisdiction_permits`
5. Add contact info to `jurisdiction_tpa`

### Data Quality Ratings

- **HIGH**: Verified through official sources, complete data
- **MEDIUM**: Partially verified, some fields estimated
- **LOW**: Limited verification, needs follow-up research

---

## Related Documentation

- [ERD.md](./ERD.md) - Entity Relationship Diagram
- [STATE_JURISDICTION_DATA_SOURCES.md](../STATE_JURISDICTION_DATA_SOURCES.md) - Research sources
- [QUICK_START_PA_IMPORT.md](../QUICK_START_PA_IMPORT.md) - PA-specific import guide
