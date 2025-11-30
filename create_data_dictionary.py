"""
Data Dictionary & Schema Documentation System
Creates a comprehensive, AI- and human-readable data dictionary.

STANDING ORDER: When creating new tables or columns, use the helper functions
in this module to auto-document them.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def get_connection():
    return psycopg2.connect(CONNECTION_STRING)

def create_data_dictionary_table():
    """Create the data_dictionary table for storing column metadata."""
    conn = get_connection()
    cursor = conn.cursor()

    print("=" * 70)
    print("CREATING DATA DICTIONARY SYSTEM")
    print("=" * 70)

    # Create data_dictionary table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS data_dictionary (
            column_id VARCHAR(50) PRIMARY KEY,
            table_name VARCHAR(100) NOT NULL,
            column_name VARCHAR(100) NOT NULL,
            data_type VARCHAR(50) NOT NULL,
            display_name VARCHAR(150),
            description TEXT,
            example_value TEXT,
            valid_values TEXT,
            source VARCHAR(100),
            business_logic TEXT,
            is_nullable BOOLEAN DEFAULT TRUE,
            is_primary_key BOOLEAN DEFAULT FALSE,
            is_foreign_key BOOLEAN DEFAULT FALSE,
            references_table VARCHAR(100),
            references_column VARCHAR(100),
            format_pattern VARCHAR(100),
            unit_of_measure VARCHAR(50),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(table_name, column_name)
        )
    """)

    # Create table_dictionary for table-level documentation
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS table_dictionary (
            table_id VARCHAR(50) PRIMARY KEY,
            table_name VARCHAR(100) UNIQUE NOT NULL,
            display_name VARCHAR(150),
            description TEXT,
            purpose TEXT,
            layer VARCHAR(50),
            data_source VARCHAR(200),
            refresh_frequency VARCHAR(50),
            row_count_estimate INT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)

    conn.commit()
    print("   ✓ data_dictionary table created")
    print("   ✓ table_dictionary table created")
    conn.close()

def generate_column_id(table_name: str, column_name: str) -> str:
    """Generate a unique column ID: TBL_column_name format."""
    # Create abbreviations for table names
    table_abbrevs = {
        "target_zones": "TZ",
        "zone_zips": "ZZ",
        "layer_1_geography": "L1G",
        "layer_2_demographics": "L2D",
        "layer_3_counties": "L3C",
        "storage_facilities": "SF",
        "housing_communities": "HC",
        "demand_anchors": "DA",
        "county_scoring": "CS",
        "flood_zones": "FZ",
        "api_cache": "AC",
        "zips_master": "ZM",
        "data_dictionary": "DD",
        "table_dictionary": "TD",
    }

    abbrev = table_abbrevs.get(table_name, table_name[:3].upper())
    # Use full column name (snake_case) for uniqueness
    return f"{abbrev}_{column_name}"

def populate_data_dictionary():
    """Populate the data dictionary with all column metadata."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("POPULATING DATA DICTIONARY")
    print("=" * 70)

    # Define comprehensive column metadata
    column_metadata = {
        # ===== TARGET_ZONES =====
        "target_zones": {
            "_table": {
                "table_id": "TBL_TZ",
                "display_name": "Target Zones",
                "description": "Defines geographic screening zones centered on a ZIP code",
                "purpose": "Configure the center point and radius for site screening analysis",
                "layer": "Configuration",
                "data_source": "User Input",
                "refresh_frequency": "On demand"
            },
            "zone_id": {
                "display_name": "Zone ID",
                "description": "Unique identifier for each screening zone",
                "example_value": "1",
                "is_primary_key": True,
                "format_pattern": "Integer sequence"
            },
            "zone_name": {
                "display_name": "Zone Name",
                "description": "Human-readable name for the screening zone",
                "example_value": "Bedford PA 120mi",
                "format_pattern": "[City] [State] [Radius]mi"
            },
            "center_zip": {
                "display_name": "Center ZIP Code",
                "description": "5-digit ZIP code at the center of the screening zone",
                "example_value": "15522",
                "format_pattern": "#####",
                "valid_values": "Valid US 5-digit ZIP codes"
            },
            "center_lat": {
                "display_name": "Center Latitude",
                "description": "Latitude coordinate of the zone center point",
                "example_value": "39.9956",
                "format_pattern": "Decimal degrees (-90 to 90)",
                "unit_of_measure": "degrees"
            },
            "center_lon": {
                "display_name": "Center Longitude",
                "description": "Longitude coordinate of the zone center point",
                "example_value": "-78.5047",
                "format_pattern": "Decimal degrees (-180 to 180)",
                "unit_of_measure": "degrees"
            },
            "radius_miles": {
                "display_name": "Radius (Miles)",
                "description": "Search radius from center point in miles",
                "example_value": "120",
                "unit_of_measure": "miles",
                "valid_values": "Typically 50-150"
            },
            "states": {
                "display_name": "States Included",
                "description": "Array of state abbreviations within the zone",
                "example_value": "['PA', 'MD', 'WV', 'VA', 'OH']",
                "format_pattern": "Array of 2-letter state codes"
            },
            "created_at": {
                "display_name": "Created Timestamp",
                "description": "When this zone was created",
                "format_pattern": "YYYY-MM-DD HH:MM:SS"
            }
        },

        # ===== ZONE_ZIPS =====
        "zone_zips": {
            "_table": {
                "table_id": "TBL_ZZ",
                "display_name": "Zone ZIP Codes",
                "description": "Links target zones to all ZIP codes within the radius",
                "purpose": "Map each ZIP code to its parent zone with distance calculation",
                "layer": "Layer 1 - Geography",
                "data_source": "Calculated from zips_master",
                "refresh_frequency": "When zone created"
            },
            "id": {
                "display_name": "Record ID",
                "description": "Auto-incrementing unique identifier",
                "is_primary_key": True
            },
            "zone_id": {
                "display_name": "Zone ID",
                "description": "Foreign key to target_zones",
                "is_foreign_key": True,
                "references_table": "target_zones",
                "references_column": "zone_id"
            },
            "zip": {
                "display_name": "ZIP Code",
                "description": "5-digit ZIP code within the zone radius",
                "example_value": "15522",
                "format_pattern": "#####"
            },
            "distance_miles": {
                "display_name": "Distance (Miles)",
                "description": "Haversine distance from zone center to ZIP centroid",
                "example_value": "45.7",
                "unit_of_measure": "miles",
                "format_pattern": "Decimal (2 places)"
            },
            "included": {
                "display_name": "Included in Analysis",
                "description": "Whether this ZIP is included in screening (can be manually excluded)",
                "example_value": "TRUE",
                "valid_values": "TRUE, FALSE"
            }
        },

        # ===== LAYER_1_GEOGRAPHY =====
        "layer_1_geography": {
            "_table": {
                "table_id": "TBL_L1G",
                "display_name": "Layer 1: Geography",
                "description": "First screening layer with geographic data for each ZIP",
                "purpose": "Filter ZIPs by location criteria (state, county, distance)",
                "layer": "Layer 1 - Geography",
                "data_source": "zips_master + haversine calculation",
                "refresh_frequency": "When zone created"
            },
            "zip": {
                "display_name": "ZIP Code",
                "description": "5-digit ZIP code (primary key)",
                "is_primary_key": True,
                "format_pattern": "#####"
            },
            "zone_id": {
                "display_name": "Zone ID",
                "description": "Parent zone this ZIP belongs to",
                "is_foreign_key": True,
                "references_table": "target_zones",
                "references_column": "zone_id"
            },
            "state": {
                "display_name": "State",
                "description": "2-letter state abbreviation",
                "example_value": "PA",
                "format_pattern": "AA",
                "valid_values": "Valid US state codes"
            },
            "county_fips": {
                "display_name": "County FIPS Code",
                "description": "5-digit Federal Information Processing Standards county code",
                "example_value": "42009",
                "format_pattern": "#####",
                "business_logic": "First 2 digits = state FIPS, last 3 = county"
            },
            "county_name": {
                "display_name": "County Name",
                "description": "Full county name",
                "example_value": "Bedford County"
            },
            "centroid_lat": {
                "display_name": "Centroid Latitude",
                "description": "Latitude of ZIP code geographic center",
                "unit_of_measure": "degrees"
            },
            "centroid_lon": {
                "display_name": "Centroid Longitude",
                "description": "Longitude of ZIP code geographic center",
                "unit_of_measure": "degrees"
            },
            "distance_miles": {
                "display_name": "Distance from Center",
                "description": "Miles from zone center to ZIP centroid",
                "unit_of_measure": "miles"
            },
            "passed": {
                "display_name": "Passed Screening",
                "description": "Whether ZIP passed Layer 1 screening criteria",
                "valid_values": "TRUE (passed), FALSE (eliminated)"
            },
            "kill_reason": {
                "display_name": "Elimination Reason",
                "description": "Why ZIP was eliminated (if passed=FALSE)",
                "example_value": "Outside target states",
                "valid_values": "NULL if passed, reason text if eliminated"
            }
        },

        # ===== LAYER_2_DEMOGRAPHICS =====
        "layer_2_demographics": {
            "_table": {
                "table_id": "TBL_L2D",
                "display_name": "Layer 2: Demographics",
                "description": "Census demographic data for each ZIP code",
                "purpose": "Filter ZIPs by population, income, and housing characteristics",
                "layer": "Layer 2 - Demographics",
                "data_source": "US Census Bureau ACS 5-Year Estimates",
                "refresh_frequency": "Annual (Census release)"
            },
            "zip": {
                "display_name": "ZIP Code",
                "description": "5-digit ZIP code (primary key)",
                "is_primary_key": True
            },
            "population": {
                "display_name": "Population",
                "description": "Total population in the ZIP code",
                "example_value": "12500",
                "unit_of_measure": "persons",
                "source": "Census ACS B01001"
            },
            "median_income": {
                "display_name": "Median Household Income",
                "description": "Median annual household income in dollars",
                "example_value": "65000",
                "unit_of_measure": "USD",
                "format_pattern": "Whole dollars",
                "source": "Census ACS B19013"
            },
            "poverty_rate": {
                "display_name": "Poverty Rate",
                "description": "Percentage of population below poverty line",
                "example_value": "12.5",
                "unit_of_measure": "percent",
                "format_pattern": "Decimal (1 place)",
                "source": "Census ACS S1701"
            },
            "renter_pct": {
                "display_name": "Renter Percentage",
                "description": "Percentage of occupied housing units that are renter-occupied",
                "example_value": "35.2",
                "unit_of_measure": "percent",
                "business_logic": "Higher renter % = more storage demand (moving frequency)"
            },
            "median_age": {
                "display_name": "Median Age",
                "description": "Median age of population in years",
                "example_value": "38.5",
                "unit_of_measure": "years"
            },
            "housing_units": {
                "display_name": "Total Housing Units",
                "description": "Total number of housing units (occupied + vacant)",
                "unit_of_measure": "units"
            },
            "occupied_units": {
                "display_name": "Occupied Housing Units",
                "description": "Number of occupied housing units",
                "unit_of_measure": "units"
            },
            "sfh_units": {
                "display_name": "Single Family Homes",
                "description": "Number of detached single-family housing units",
                "unit_of_measure": "units",
                "business_logic": "SFH owners often need storage for lawn equipment, seasonal items"
            },
            "townhome_units": {
                "display_name": "Townhome Units",
                "description": "Number of attached townhome/rowhouse units",
                "unit_of_measure": "units",
                "business_logic": "Townhomes have limited storage, high demand driver"
            },
            "apartment_units": {
                "display_name": "Apartment Units",
                "description": "Number of units in multi-family buildings (5+ units)",
                "unit_of_measure": "units",
                "business_logic": "Apartments have minimal storage, highest demand driver"
            },
            "mobile_home_units": {
                "display_name": "Mobile Home Units",
                "description": "Number of mobile/manufactured home units",
                "unit_of_measure": "units",
                "business_logic": "Mobile homes need external storage for vehicles/equipment"
            },
            "passed": {
                "display_name": "Passed Screening",
                "description": "Whether ZIP passed Layer 2 demographic criteria",
                "valid_values": "TRUE, FALSE"
            },
            "kill_reason": {
                "display_name": "Elimination Reason",
                "description": "Why ZIP was eliminated (if passed=FALSE)",
                "example_value": "Population below minimum threshold"
            }
        },

        # ===== LAYER_3_COUNTIES =====
        "layer_3_counties": {
            "_table": {
                "table_id": "TBL_L3C",
                "display_name": "Layer 3: County Aggregation",
                "description": "Aggregated data at the county level from surviving ZIPs",
                "purpose": "Roll up ZIP-level data to county for market analysis",
                "layer": "Layer 3 - Aggregation",
                "data_source": "Aggregated from layer_2_demographics",
                "refresh_frequency": "After Layer 2 screening"
            },
            "county_fips": {
                "display_name": "County FIPS Code",
                "description": "5-digit county FIPS code (primary key)",
                "is_primary_key": True,
                "format_pattern": "#####"
            },
            "state": {
                "display_name": "State",
                "description": "2-letter state abbreviation",
                "format_pattern": "AA"
            },
            "county_name": {
                "display_name": "County Name",
                "description": "Full county name",
                "example_value": "Bedford County"
            },
            "surviving_zips": {
                "display_name": "Surviving ZIP Count",
                "description": "Number of ZIPs that passed Layers 1-2 in this county",
                "unit_of_measure": "count"
            },
            "total_population": {
                "display_name": "Total Population",
                "description": "Sum of population across all surviving ZIPs",
                "unit_of_measure": "persons"
            },
            "total_housing_units": {
                "display_name": "Total Housing Units",
                "description": "Sum of housing units across all surviving ZIPs",
                "unit_of_measure": "units"
            },
            "total_sfh": {
                "display_name": "Total Single Family Homes",
                "description": "Sum of SFH units across all surviving ZIPs",
                "unit_of_measure": "units"
            },
            "total_townhome": {
                "display_name": "Total Townhomes",
                "description": "Sum of townhome units across all surviving ZIPs",
                "unit_of_measure": "units"
            },
            "total_apartment": {
                "display_name": "Total Apartments",
                "description": "Sum of apartment units across all surviving ZIPs",
                "unit_of_measure": "units"
            },
            "total_mobile_home": {
                "display_name": "Total Mobile Homes",
                "description": "Sum of mobile home units across all surviving ZIPs",
                "unit_of_measure": "units"
            },
            "avg_income": {
                "display_name": "Average Median Income",
                "description": "Population-weighted average median income",
                "unit_of_measure": "USD"
            },
            "avg_poverty": {
                "display_name": "Average Poverty Rate",
                "description": "Population-weighted average poverty rate",
                "unit_of_measure": "percent"
            },
            "avg_renter_pct": {
                "display_name": "Average Renter Percentage",
                "description": "Housing-weighted average renter percentage",
                "unit_of_measure": "percent"
            }
        },

        # ===== STORAGE_FACILITIES =====
        "storage_facilities": {
            "_table": {
                "table_id": "TBL_SF",
                "display_name": "Storage Facilities",
                "description": "Competitor self-storage facilities in the market",
                "purpose": "Analyze market saturation and competitive landscape",
                "layer": "Layer 4 - Supply Analysis",
                "data_source": "Google Places API",
                "refresh_frequency": "Weekly"
            },
            "id": {
                "display_name": "Facility ID",
                "description": "Auto-incrementing unique identifier",
                "is_primary_key": True
            },
            "place_id": {
                "display_name": "Google Place ID",
                "description": "Unique Google Places API identifier",
                "example_value": "ChIJ...",
                "source": "Google Places API"
            },
            "name": {
                "display_name": "Facility Name",
                "description": "Business name of the storage facility",
                "example_value": "Public Storage #12345"
            },
            "address": {
                "display_name": "Street Address",
                "description": "Full street address",
                "example_value": "123 Main St"
            },
            "city": {
                "display_name": "City",
                "description": "City name"
            },
            "state": {
                "display_name": "State",
                "description": "2-letter state code"
            },
            "zip": {
                "display_name": "ZIP Code",
                "description": "5-digit ZIP code"
            },
            "county_fips": {
                "display_name": "County FIPS",
                "description": "5-digit county FIPS code for aggregation"
            },
            "lat": {
                "display_name": "Latitude",
                "description": "Facility latitude coordinate",
                "unit_of_measure": "degrees"
            },
            "lon": {
                "display_name": "Longitude",
                "description": "Facility longitude coordinate",
                "unit_of_measure": "degrees"
            },
            "total_sqft": {
                "display_name": "Total Square Feet",
                "description": "Estimated total rentable square footage",
                "unit_of_measure": "sq ft",
                "business_logic": "Used for saturation calculation (sqft per capita)"
            },
            "unit_count": {
                "display_name": "Unit Count",
                "description": "Estimated number of storage units",
                "unit_of_measure": "units"
            },
            "year_built": {
                "display_name": "Year Built",
                "description": "Year facility was constructed",
                "format_pattern": "YYYY"
            },
            "climate_controlled": {
                "display_name": "Climate Controlled",
                "description": "Whether facility offers climate-controlled units",
                "valid_values": "TRUE, FALSE"
            },
            "drive_up": {
                "display_name": "Drive-Up Access",
                "description": "Whether facility offers drive-up units",
                "valid_values": "TRUE, FALSE"
            },
            "rv_boat": {
                "display_name": "RV/Boat Storage",
                "description": "Whether facility offers RV or boat storage",
                "valid_values": "TRUE, FALSE",
                "business_logic": "Indicates demand for vehicle storage in area"
            },
            "owner_operator": {
                "display_name": "Owner/Operator",
                "description": "Company that owns or operates the facility",
                "example_value": "Public Storage, Extra Space, CubeSmart"
            },
            "rating": {
                "display_name": "Google Rating",
                "description": "Average Google review rating (1-5 stars)",
                "format_pattern": "Decimal (1 place)",
                "valid_values": "1.0 to 5.0"
            },
            "review_count": {
                "display_name": "Review Count",
                "description": "Number of Google reviews",
                "unit_of_measure": "reviews"
            },
            "asking_rent_10x10": {
                "display_name": "Asking Rent (10x10)",
                "description": "Monthly asking rent for 10x10 unit",
                "unit_of_measure": "USD/month",
                "business_logic": "Standard unit for price comparison"
            },
            "asking_rent_10x20": {
                "display_name": "Asking Rent (10x20)",
                "description": "Monthly asking rent for 10x20 unit",
                "unit_of_measure": "USD/month"
            },
            "source": {
                "display_name": "Data Source",
                "description": "Where this data was obtained",
                "valid_values": "google_places, sparefoot, manual"
            },
            "fetched_at": {
                "display_name": "Fetched Timestamp",
                "description": "When this data was last retrieved"
            }
        },

        # ===== HOUSING_COMMUNITIES =====
        "housing_communities": {
            "_table": {
                "table_id": "TBL_HC",
                "display_name": "Housing Communities",
                "description": "Existing and pipeline housing developments (demand drivers)",
                "purpose": "Track new housing that will generate storage demand",
                "layer": "Layer 5 - Demand Drivers",
                "data_source": "County permit data, building department records",
                "refresh_frequency": "Monthly"
            },
            "id": {
                "display_name": "Community ID",
                "description": "Auto-incrementing unique identifier",
                "is_primary_key": True
            },
            "name": {
                "display_name": "Community Name",
                "description": "Name of the housing development",
                "example_value": "Maple Ridge Townhomes"
            },
            "address": {
                "display_name": "Address",
                "description": "Street address or location description"
            },
            "city": {
                "display_name": "City",
                "description": "City name"
            },
            "state": {
                "display_name": "State",
                "description": "2-letter state code"
            },
            "zip": {
                "display_name": "ZIP Code",
                "description": "5-digit ZIP code"
            },
            "county_fips": {
                "display_name": "County FIPS",
                "description": "5-digit county FIPS code"
            },
            "lat": {
                "display_name": "Latitude",
                "description": "Development latitude",
                "unit_of_measure": "degrees"
            },
            "lon": {
                "display_name": "Longitude",
                "description": "Development longitude",
                "unit_of_measure": "degrees"
            },
            "community_type": {
                "display_name": "Community Type",
                "description": "Type of housing development",
                "valid_values": "townhome, condo, apartment, mobile_home, sfh_subdivision",
                "business_logic": "Different types have different storage demand profiles"
            },
            "status": {
                "display_name": "Development Status",
                "description": "Current stage of development",
                "valid_values": "existing, permitted, site_work, vertical, completed",
                "business_logic": "Pipeline status indicates future demand timing"
            },
            "total_units": {
                "display_name": "Total Units",
                "description": "Number of housing units planned or built",
                "unit_of_measure": "units"
            },
            "year_built": {
                "display_name": "Year Built",
                "description": "Year of completion (for existing)",
                "format_pattern": "YYYY"
            },
            "permit_date": {
                "display_name": "Permit Date",
                "description": "Date building permit was issued",
                "format_pattern": "YYYY-MM-DD"
            },
            "site_work_date": {
                "display_name": "Site Work Date",
                "description": "Date site preparation began",
                "format_pattern": "YYYY-MM-DD"
            },
            "vertical_date": {
                "display_name": "Vertical Construction Date",
                "description": "Date vertical construction began",
                "format_pattern": "YYYY-MM-DD"
            },
            "completion_date": {
                "display_name": "Completion Date",
                "description": "Actual completion date",
                "format_pattern": "YYYY-MM-DD"
            },
            "expected_completion": {
                "display_name": "Expected Completion",
                "description": "Projected completion date",
                "format_pattern": "YYYY-MM-DD"
            },
            "builder": {
                "display_name": "Builder",
                "description": "Construction company or developer name"
            },
            "permit_number": {
                "display_name": "Permit Number",
                "description": "County/city permit reference number"
            },
            "source": {
                "display_name": "Data Source",
                "description": "Where data was obtained",
                "valid_values": "county_permits, gis_portal, manual"
            },
            "source_url": {
                "display_name": "Source URL",
                "description": "Link to source documentation"
            },
            "notes": {
                "display_name": "Notes",
                "description": "Additional information about the development"
            },
            "created_at": {
                "display_name": "Created",
                "description": "When record was created"
            },
            "updated_at": {
                "display_name": "Updated",
                "description": "When record was last updated"
            }
        },

        # ===== DEMAND_ANCHORS =====
        "demand_anchors": {
            "_table": {
                "table_id": "TBL_DA",
                "display_name": "Demand Anchors",
                "description": "Points of interest that generate storage demand",
                "purpose": "Identify colleges, military bases, hospitals, and other demand drivers",
                "layer": "Layer 5 - Demand Drivers",
                "data_source": "Google Places API, manual research",
                "refresh_frequency": "Quarterly"
            },
            "id": {
                "display_name": "Anchor ID",
                "description": "Auto-incrementing unique identifier",
                "is_primary_key": True
            },
            "place_id": {
                "display_name": "Google Place ID",
                "description": "Unique Google Places identifier"
            },
            "name": {
                "display_name": "Anchor Name",
                "description": "Name of the institution or business",
                "example_value": "Penn State University"
            },
            "anchor_type": {
                "display_name": "Anchor Type",
                "description": "Category of demand driver",
                "valid_values": "college, military, hospital, employer, rv_park, marina, mobile_home_park",
                "business_logic": "Each type has different storage demand characteristics"
            },
            "address": {
                "display_name": "Address",
                "description": "Street address"
            },
            "city": {
                "display_name": "City",
                "description": "City name"
            },
            "state": {
                "display_name": "State",
                "description": "2-letter state code"
            },
            "zip": {
                "display_name": "ZIP Code",
                "description": "5-digit ZIP code"
            },
            "county_fips": {
                "display_name": "County FIPS",
                "description": "5-digit county FIPS code"
            },
            "lat": {
                "display_name": "Latitude",
                "description": "Location latitude",
                "unit_of_measure": "degrees"
            },
            "lon": {
                "display_name": "Longitude",
                "description": "Location longitude",
                "unit_of_measure": "degrees"
            },
            "size_estimate": {
                "display_name": "Size Estimate",
                "description": "Relative size classification",
                "valid_values": "small, medium, large"
            },
            "student_count": {
                "display_name": "Student Count",
                "description": "Total enrolled students (colleges only)",
                "unit_of_measure": "students",
                "business_logic": "Students need summer storage"
            },
            "employee_count": {
                "display_name": "Employee Count",
                "description": "Number of employees (employers, military)",
                "unit_of_measure": "employees"
            },
            "unit_count": {
                "display_name": "Unit Count",
                "description": "Number of units (mobile home parks, RV parks)",
                "unit_of_measure": "units"
            },
            "source": {
                "display_name": "Data Source",
                "description": "Where data was obtained"
            },
            "fetched_at": {
                "display_name": "Fetched Timestamp",
                "description": "When data was retrieved"
            }
        },

        # ===== COUNTY_SCORING =====
        "county_scoring": {
            "_table": {
                "table_id": "TBL_CS",
                "display_name": "County Scoring",
                "description": "Final Go/No-Go scores aggregated at county level",
                "purpose": "Rank and tier counties for investment prioritization",
                "layer": "Layer 10 - Scoring",
                "data_source": "Calculated from all layers",
                "refresh_frequency": "After full screening run"
            },
            "county_fips": {
                "display_name": "County FIPS",
                "description": "5-digit county FIPS code (primary key)",
                "is_primary_key": True
            },
            "demand_score": {
                "display_name": "Demand Score",
                "description": "Score based on housing units, pipeline, anchors",
                "valid_values": "0-100",
                "business_logic": "Higher = more demand drivers"
            },
            "supply_score": {
                "display_name": "Supply Score",
                "description": "Score based on facility count, saturation",
                "valid_values": "0-100",
                "business_logic": "Higher = less competition (inverse of saturation)"
            },
            "growth_score": {
                "display_name": "Growth Score",
                "description": "Score based on permits, population change",
                "valid_values": "0-100",
                "business_logic": "Higher = more growth potential"
            },
            "risk_score": {
                "display_name": "Risk Score",
                "description": "Score based on flood zones, crime, economics",
                "valid_values": "0-100",
                "business_logic": "Higher = lower risk"
            },
            "access_score": {
                "display_name": "Access Score",
                "description": "Score based on highways, traffic counts",
                "valid_values": "0-100",
                "business_logic": "Higher = better visibility/access"
            },
            "total_score": {
                "display_name": "Total Score",
                "description": "Weighted sum of all component scores",
                "valid_values": "0-100",
                "business_logic": "Primary ranking metric"
            },
            "tier": {
                "display_name": "Investment Tier",
                "description": "Priority tier for investment",
                "valid_values": "1 (Go), 2 (Maybe), 3 (No-Go)",
                "business_logic": "Tier 1 = top 20%, Tier 2 = middle 30%, Tier 3 = bottom 50%"
            },
            "notes": {
                "display_name": "Notes",
                "description": "Additional scoring notes or overrides"
            },
            "scored_at": {
                "display_name": "Scored Timestamp",
                "description": "When scoring was calculated"
            }
        },

        # ===== FLOOD_ZONES =====
        "flood_zones": {
            "_table": {
                "table_id": "TBL_FZ",
                "display_name": "Flood Zones",
                "description": "FEMA flood zone overlays for risk assessment",
                "purpose": "Identify flood-prone areas to avoid or adjust scoring",
                "layer": "Layer 8 - Risk Assessment",
                "data_source": "FEMA National Flood Hazard Layer",
                "refresh_frequency": "Annual"
            },
            "id": {
                "display_name": "Record ID",
                "description": "Auto-incrementing unique identifier",
                "is_primary_key": True
            },
            "zone_id": {
                "display_name": "FEMA Zone Code",
                "description": "FEMA flood zone designation",
                "example_value": "AE, A, X, VE",
                "valid_values": "A, AE, AH, AO, V, VE, X (shaded), X (unshaded)"
            },
            "county_fips": {
                "display_name": "County FIPS",
                "description": "5-digit county FIPS code"
            },
            "risk_level": {
                "display_name": "Risk Level",
                "description": "Simplified risk classification",
                "valid_values": "high, moderate, low, minimal",
                "business_logic": "A/V zones = high, X shaded = moderate, X unshaded = minimal"
            },
            "geometry_json": {
                "display_name": "Geometry GeoJSON",
                "description": "GeoJSON polygon for map overlay",
                "format_pattern": "GeoJSON Feature"
            }
        },

        # ===== API_CACHE =====
        "api_cache": {
            "_table": {
                "table_id": "TBL_AC",
                "display_name": "API Cache",
                "description": "Cache for external API responses to minimize API calls",
                "purpose": "Reduce API costs and improve performance with TTL-based caching",
                "layer": "System",
                "data_source": "Various APIs (Census, Google, FEMA)",
                "refresh_frequency": "Per TTL setting"
            },
            "cache_key": {
                "display_name": "Cache Key",
                "description": "Unique identifier for cached data",
                "example_value": "census:15522, storage:15522",
                "format_pattern": "{source}:{identifier}"
            },
            "endpoint": {
                "display_name": "API Endpoint",
                "description": "The API endpoint that was called"
            },
            "request_params": {
                "display_name": "Request Parameters",
                "description": "JSON of parameters sent to API",
                "format_pattern": "JSONB"
            },
            "response": {
                "display_name": "API Response",
                "description": "JSON response from the API",
                "format_pattern": "JSONB"
            },
            "fetched_at": {
                "display_name": "Fetched Timestamp",
                "description": "When data was retrieved from API"
            },
            "expires_at": {
                "display_name": "Expiration Timestamp",
                "description": "When cached data expires",
                "business_logic": "Census: 30 days, Storage: 7 days, FEMA: 7 days"
            }
        },

        # ===== ZIPS_MASTER =====
        "zips_master": {
            "_table": {
                "table_id": "TBL_ZM",
                "display_name": "ZIP Codes Master",
                "description": "Master list of all US ZIP codes with demographics",
                "purpose": "Source data for zone creation and demographic lookups",
                "layer": "Reference Data",
                "data_source": "SimpleMaps US ZIP Code Database",
                "refresh_frequency": "Annual"
            },
            "zip": {
                "display_name": "ZIP Code",
                "description": "5-digit ZIP code",
                "is_primary_key": True,
                "format_pattern": "#####"
            },
            "lat": {
                "display_name": "Latitude",
                "description": "ZIP code centroid latitude",
                "unit_of_measure": "degrees"
            },
            "lng": {
                "display_name": "Longitude",
                "description": "ZIP code centroid longitude",
                "unit_of_measure": "degrees"
            },
            "city": {
                "display_name": "City",
                "description": "Primary city name for ZIP"
            },
            "state": {
                "display_name": "State Code",
                "description": "2-letter state abbreviation"
            },
            "state_name": {
                "display_name": "State Name",
                "description": "Full state name"
            },
            "zcta": {
                "display_name": "Is ZCTA",
                "description": "Whether this is a ZIP Code Tabulation Area",
                "valid_values": "TRUE, FALSE"
            },
            "parent_zcta": {
                "display_name": "Parent ZCTA",
                "description": "Parent ZCTA if this is a non-ZCTA ZIP"
            },
            "population": {
                "display_name": "Population",
                "description": "Total population",
                "unit_of_measure": "persons"
            },
            "density": {
                "display_name": "Population Density",
                "description": "People per square mile",
                "unit_of_measure": "persons/sq mi"
            },
            "county_fips": {
                "display_name": "County FIPS",
                "description": "5-digit county FIPS code"
            },
            "county_name": {
                "display_name": "County Name",
                "description": "Full county name"
            },
            "timezone": {
                "display_name": "Timezone",
                "description": "Primary timezone"
            },
            "age_median": {
                "display_name": "Median Age",
                "description": "Median age of population",
                "unit_of_measure": "years"
            },
            "income_household_median": {
                "display_name": "Median Household Income",
                "description": "Median annual household income",
                "unit_of_measure": "USD"
            },
            "home_ownership": {
                "display_name": "Home Ownership Rate",
                "description": "Percentage of owner-occupied housing",
                "unit_of_measure": "percent"
            },
            "home_value": {
                "display_name": "Median Home Value",
                "description": "Median value of owner-occupied homes",
                "unit_of_measure": "USD"
            },
            "rent_median": {
                "display_name": "Median Rent",
                "description": "Median gross rent",
                "unit_of_measure": "USD/month"
            },
            "education_college_or_above": {
                "display_name": "College Education Rate",
                "description": "Percentage with bachelor's degree or higher",
                "unit_of_measure": "percent"
            },
            "unemployment_rate": {
                "display_name": "Unemployment Rate",
                "description": "Percentage of labor force unemployed",
                "unit_of_measure": "percent"
            },
            "military": {
                "display_name": "Has Military",
                "description": "Whether ZIP contains military installation",
                "valid_values": "TRUE, FALSE"
            }
        }
    }

    # Insert table metadata
    for table_name, columns in column_metadata.items():
        if "_table" in columns:
            table_info = columns["_table"]
            cursor.execute("""
                INSERT INTO table_dictionary
                (table_id, table_name, display_name, description, purpose, layer, data_source, refresh_frequency)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (table_name) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    description = EXCLUDED.description,
                    purpose = EXCLUDED.purpose,
                    layer = EXCLUDED.layer,
                    data_source = EXCLUDED.data_source,
                    refresh_frequency = EXCLUDED.refresh_frequency,
                    updated_at = NOW()
            """, (
                table_info.get("table_id"),
                table_name,
                table_info.get("display_name"),
                table_info.get("description"),
                table_info.get("purpose"),
                table_info.get("layer"),
                table_info.get("data_source"),
                table_info.get("refresh_frequency")
            ))
            print(f"\n   ✓ {table_name} (table metadata)")

        # Insert column metadata
        for col_name, col_info in columns.items():
            if col_name == "_table":
                continue

            column_id = generate_column_id(table_name, col_name)

            # Get data type from database
            cursor.execute("""
                SELECT data_type
                FROM information_schema.columns
                WHERE table_name = %s AND column_name = %s
            """, (table_name, col_name))
            row = cursor.fetchone()
            data_type = row[0] if row else "unknown"

            cursor.execute("""
                INSERT INTO data_dictionary
                (column_id, table_name, column_name, data_type, display_name, description,
                 example_value, valid_values, source, business_logic, is_primary_key,
                 is_foreign_key, references_table, references_column, format_pattern, unit_of_measure)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (table_name, column_name) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    description = EXCLUDED.description,
                    example_value = EXCLUDED.example_value,
                    valid_values = EXCLUDED.valid_values,
                    source = EXCLUDED.source,
                    business_logic = EXCLUDED.business_logic,
                    is_primary_key = EXCLUDED.is_primary_key,
                    is_foreign_key = EXCLUDED.is_foreign_key,
                    references_table = EXCLUDED.references_table,
                    references_column = EXCLUDED.references_column,
                    format_pattern = EXCLUDED.format_pattern,
                    unit_of_measure = EXCLUDED.unit_of_measure,
                    updated_at = NOW()
            """, (
                column_id,
                table_name,
                col_name,
                data_type,
                col_info.get("display_name", col_name),
                col_info.get("description"),
                col_info.get("example_value"),
                col_info.get("valid_values"),
                col_info.get("source"),
                col_info.get("business_logic"),
                col_info.get("is_primary_key", False),
                col_info.get("is_foreign_key", False),
                col_info.get("references_table"),
                col_info.get("references_column"),
                col_info.get("format_pattern"),
                col_info.get("unit_of_measure")
            ))

    conn.commit()
    conn.close()
    print("\n   ✓ Data dictionary populated!")

def add_postgresql_comments():
    """Add COMMENT statements to PostgreSQL tables and columns."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("ADDING POSTGRESQL COMMENTS")
    print("=" * 70)

    # Add table comments
    cursor.execute("SELECT table_name, description FROM table_dictionary")
    for row in cursor.fetchall():
        try:
            cursor.execute(f"COMMENT ON TABLE {row['table_name']} IS %s", (row['description'],))
            print(f"   ✓ Table: {row['table_name']}")
        except Exception as e:
            print(f"   ⚠ Table: {row['table_name']} - {e}")

    # Add column comments
    cursor.execute("SELECT table_name, column_name, description FROM data_dictionary WHERE description IS NOT NULL")
    for row in cursor.fetchall():
        try:
            cursor.execute(f"COMMENT ON COLUMN {row['table_name']}.{row['column_name']} IS %s", (row['description'],))
        except Exception as e:
            pass  # Skip if column doesn't exist

    conn.commit()
    conn.close()
    print("   ✓ Column comments added")

def generate_schema_report():
    """Generate a human-readable schema report."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    report = []
    report.append("=" * 80)
    report.append("STORAGE FACILITY SITE SCREENER - DATA DICTIONARY")
    report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("=" * 80)

    # Get all tables
    cursor.execute("""
        SELECT t.table_name, t.display_name, t.description, t.purpose, t.layer, t.data_source
        FROM table_dictionary t
        ORDER BY
            CASE t.layer
                WHEN 'Configuration' THEN 1
                WHEN 'Layer 1 - Geography' THEN 2
                WHEN 'Layer 2 - Demographics' THEN 3
                WHEN 'Layer 3 - Aggregation' THEN 4
                WHEN 'Layer 4 - Supply Analysis' THEN 5
                WHEN 'Layer 5 - Demand Drivers' THEN 6
                WHEN 'Layer 8 - Risk Assessment' THEN 7
                WHEN 'Layer 10 - Scoring' THEN 8
                WHEN 'Reference Data' THEN 9
                WHEN 'System' THEN 10
                ELSE 99
            END
    """)
    tables = cursor.fetchall()

    for table in tables:
        report.append("")
        report.append("-" * 80)
        report.append(f"TABLE: {table['table_name']}")
        report.append(f"Display Name: {table['display_name']}")
        report.append(f"Layer: {table['layer']}")
        report.append(f"Description: {table['description']}")
        report.append(f"Purpose: {table['purpose']}")
        report.append(f"Data Source: {table['data_source']}")
        report.append("-" * 80)
        report.append("")
        report.append(f"{'ID':<15} {'Column':<25} {'Type':<15} {'Description':<40}")
        report.append(f"{'-'*15} {'-'*25} {'-'*15} {'-'*40}")

        # Get columns for this table
        cursor.execute("""
            SELECT column_id, column_name, data_type, display_name, description,
                   unit_of_measure, valid_values, business_logic, is_primary_key, is_foreign_key
            FROM data_dictionary
            WHERE table_name = %s
            ORDER BY
                CASE WHEN is_primary_key THEN 0 ELSE 1 END,
                column_name
        """, (table['table_name'],))
        columns = cursor.fetchall()

        for col in columns:
            pk_marker = " [PK]" if col['is_primary_key'] else ""
            fk_marker = " [FK]" if col['is_foreign_key'] else ""
            desc = (col['description'] or '')[:40]
            report.append(f"{col['column_id']:<15} {col['column_name']:<25} {col['data_type']:<15} {desc}{pk_marker}{fk_marker}")

            # Add details on next lines if present
            if col['unit_of_measure']:
                report.append(f"{'':<15} {'':<25} {'Unit:':<15} {col['unit_of_measure']}")
            if col['valid_values']:
                report.append(f"{'':<15} {'':<25} {'Values:':<15} {col['valid_values'][:50]}")
            if col['business_logic']:
                report.append(f"{'':<15} {'':<25} {'Logic:':<15} {col['business_logic'][:50]}")

    conn.close()

    report_text = "\n".join(report)
    print(report_text)

    # Save to file
    with open("SCHEMA_DATA_DICTIONARY.md", "w", encoding="utf-8") as f:
        f.write(report_text)

    print(f"\n\n✓ Report saved to SCHEMA_DATA_DICTIONARY.md")
    return report_text

def verify_dictionary():
    """Verify the data dictionary contents."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("DATA DICTIONARY VERIFICATION")
    print("=" * 70)

    cursor.execute("SELECT COUNT(*) FROM table_dictionary")
    table_count = cursor.fetchone()[0]
    print(f"   Tables documented: {table_count}")

    cursor.execute("SELECT COUNT(*) FROM data_dictionary")
    column_count = cursor.fetchone()[0]
    print(f"   Columns documented: {column_count}")

    cursor.execute("SELECT COUNT(*) FROM data_dictionary WHERE description IS NOT NULL")
    with_desc = cursor.fetchone()[0]
    print(f"   Columns with descriptions: {with_desc}")

    cursor.execute("SELECT COUNT(*) FROM data_dictionary WHERE business_logic IS NOT NULL")
    with_logic = cursor.fetchone()[0]
    print(f"   Columns with business logic: {with_logic}")

    conn.close()

if __name__ == "__main__":
    create_data_dictionary_table()
    populate_data_dictionary()
    add_postgresql_comments()
    verify_dictionary()
    generate_schema_report()
