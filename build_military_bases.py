"""
Build Military Bases Table
Loads military bases for PA, WV, MD, VA from curated list.
Key demand driver - military personnel relocating need storage.
"""

import psycopg2
from psycopg2.extras import RealDictCursor

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Curated list of major military installations in target states
# Source: DoD, GlobalSecurity.org, Wikipedia
MILITARY_BASES = [
    # Pennsylvania
    {"name": "Carlisle Barracks", "branch": "Army", "installation_type": "Training", "state": "PA", "county": "Cumberland", "city": "Carlisle", "military_personnel": 2000, "civilian_personnel": 1500, "lat": 40.2015, "lng": -77.1886},
    {"name": "Fort Indiantown Gap", "branch": "Army National Guard", "installation_type": "Training", "state": "PA", "county": "Lebanon", "city": "Annville", "military_personnel": 800, "civilian_personnel": 600, "lat": 40.4404, "lng": -76.5872},
    {"name": "Tobyhanna Army Depot", "branch": "Army", "installation_type": "Depot", "state": "PA", "county": "Monroe", "city": "Tobyhanna", "military_personnel": 100, "civilian_personnel": 3500, "lat": 41.1837, "lng": -75.4218},
    {"name": "Letterkenny Army Depot", "branch": "Army", "installation_type": "Depot", "state": "PA", "county": "Franklin", "city": "Chambersburg", "military_personnel": 50, "civilian_personnel": 3200, "lat": 39.9734, "lng": -77.6983},
    {"name": "Naval Support Activity Mechanicsburg", "branch": "Navy", "installation_type": "Logistics", "state": "PA", "county": "Cumberland", "city": "Mechanicsburg", "military_personnel": 200, "civilian_personnel": 4500, "lat": 40.2173, "lng": -76.9969},
    {"name": "Defense Distribution Center Susquehanna", "branch": "DLA", "installation_type": "Distribution", "state": "PA", "county": "York", "city": "New Cumberland", "military_personnel": 100, "civilian_personnel": 2800, "lat": 40.2170, "lng": -76.8544},

    # West Virginia
    {"name": "Camp Dawson", "branch": "Army National Guard", "installation_type": "Training", "state": "WV", "county": "Preston", "city": "Kingwood", "military_personnel": 400, "civilian_personnel": 200, "lat": 39.4248, "lng": -79.6725},
    {"name": "Martinsburg Air National Guard Base", "branch": "Air National Guard", "installation_type": "Air Base", "state": "WV", "county": "Berkeley", "city": "Martinsburg", "military_personnel": 1200, "civilian_personnel": 300, "lat": 39.4017, "lng": -77.9847},

    # Maryland
    {"name": "Fort Meade", "branch": "Army", "installation_type": "Joint Base", "state": "MD", "county": "Anne Arundel", "city": "Fort Meade", "military_personnel": 11000, "civilian_personnel": 29000, "lat": 39.1086, "lng": -76.7433},
    {"name": "Aberdeen Proving Ground", "branch": "Army", "installation_type": "Testing", "state": "MD", "county": "Harford", "city": "Aberdeen", "military_personnel": 5000, "civilian_personnel": 15000, "lat": 39.4668, "lng": -76.1306},
    {"name": "Naval Air Station Patuxent River", "branch": "Navy", "installation_type": "Air Station", "state": "MD", "county": "St. Mary's", "city": "Patuxent River", "military_personnel": 4000, "civilian_personnel": 8000, "lat": 38.2859, "lng": -76.4113},
    {"name": "Joint Base Andrews", "branch": "Air Force", "installation_type": "Air Base", "state": "MD", "county": "Prince George's", "city": "Camp Springs", "military_personnel": 6000, "civilian_personnel": 3000, "lat": 38.8108, "lng": -76.8669},
    {"name": "Naval Support Facility Indian Head", "branch": "Navy", "installation_type": "Research", "state": "MD", "county": "Charles", "city": "Indian Head", "military_personnel": 500, "civilian_personnel": 2500, "lat": 38.5995, "lng": -77.1658},

    # Virginia (major bases near your target area)
    {"name": "Pentagon", "branch": "DoD", "installation_type": "Headquarters", "state": "VA", "county": "Arlington", "city": "Arlington", "military_personnel": 23000, "civilian_personnel": 3000, "lat": 38.8719, "lng": -77.0563},
    {"name": "Fort Belvoir", "branch": "Army", "installation_type": "Joint Base", "state": "VA", "county": "Fairfax", "city": "Fort Belvoir", "military_personnel": 8000, "civilian_personnel": 18000, "lat": 38.7119, "lng": -77.1458},
    {"name": "Marine Corps Base Quantico", "branch": "Marines", "installation_type": "Training", "state": "VA", "county": "Prince William", "city": "Quantico", "military_personnel": 12000, "civilian_personnel": 8000, "lat": 38.5227, "lng": -77.3184},
    {"name": "Norfolk Naval Station", "branch": "Navy", "installation_type": "Naval Base", "state": "VA", "county": "Norfolk", "city": "Norfolk", "military_personnel": 60000, "civilian_personnel": 15000, "lat": 36.9466, "lng": -76.3036},
    {"name": "Joint Base Langley-Eustis", "branch": "Air Force/Army", "installation_type": "Joint Base", "state": "VA", "county": "Hampton", "city": "Hampton", "military_personnel": 12000, "civilian_personnel": 5000, "lat": 37.0833, "lng": -76.3605},
    {"name": "Fort Lee", "branch": "Army", "installation_type": "Training", "state": "VA", "county": "Prince George", "city": "Fort Lee", "military_personnel": 6000, "civilian_personnel": 4000, "lat": 37.2463, "lng": -77.3442},
    {"name": "NAS Oceana", "branch": "Navy", "installation_type": "Air Station", "state": "VA", "county": "Virginia Beach", "city": "Virginia Beach", "military_personnel": 10000, "civilian_personnel": 3000, "lat": 36.8207, "lng": -76.0336},
    {"name": "Little Creek Naval Amphibious Base", "branch": "Navy", "installation_type": "Amphibious Base", "state": "VA", "county": "Virginia Beach", "city": "Virginia Beach", "military_personnel": 8000, "civilian_personnel": 2000, "lat": 36.9157, "lng": -76.1591},
]

def get_connection():
    return psycopg2.connect(CONNECTION_STRING)

def build_military_bases():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("=" * 70)
    print("BUILDING MILITARY BASES TABLE")
    print("=" * 70)

    total_inserted = 0

    for base in MILITARY_BASES:
        total_personnel = (base.get('military_personnel', 0) or 0) + (base.get('civilian_personnel', 0) or 0)

        try:
            cursor.execute("""
                INSERT INTO military_bases (
                    name, branch, installation_type, state, county, city,
                    military_personnel, civilian_personnel, total_personnel,
                    lat, lng, source, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT DO NOTHING
            """, (
                base['name'],
                base['branch'],
                base['installation_type'],
                base['state'],
                base['county'],
                base['city'],
                base.get('military_personnel'),
                base.get('civilian_personnel'),
                total_personnel,
                base['lat'],
                base['lng'],
                'curated_dod_list'
            ))
            total_inserted += 1
            print(f"   Added: {base['name']} ({base['state']}) - {total_personnel:,} personnel")
        except Exception as e:
            print(f"   Error adding {base['name']}: {e}")

    conn.commit()

    print(f"\n" + "=" * 70)
    print(f"COMPLETE: {total_inserted} military bases added")
    print("=" * 70)

    # Summary by state
    cursor.execute("""
        SELECT state, COUNT(*) as bases, SUM(total_personnel) as personnel
        FROM military_bases
        GROUP BY state
        ORDER BY personnel DESC
    """)
    print("\n   By state:")
    for row in cursor.fetchall():
        print(f"      {row['state']}: {row['bases']} bases, {row['personnel']:,} personnel")

    conn.close()

if __name__ == "__main__":
    build_military_bases()
