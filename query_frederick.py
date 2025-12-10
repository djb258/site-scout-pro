from neon_db_utils import NeonDB

with NeonDB() as db:
    with db.conn.cursor() as cur:
        cur.execute('''
            SELECT name, address, city, community_type, total_units, status,
                   year_built, permit_date, builder, source
            FROM housing_communities
            WHERE LOWER(state) = 'va'
              AND (LOWER(city) LIKE '%%winchester%%'
                   OR LOWER(city) LIKE '%%stephens city%%'
                   OR LOWER(city) LIKE '%%middletown%%'
                   OR county_fips = '51069')
              AND (LOWER(community_type) LIKE '%%condo%%'
                   OR LOWER(community_type) LIKE '%%townho%%')
            ORDER BY community_type, name
        ''')
        cols = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        print('CONDOS and TOWNHOMES - Frederick County VA Area')
        print('=' * 80)
        print(f'Total: {len(rows)} records')
        print()

        current_type = None
        for row in rows:
            d = dict(zip(cols, row))
            ctype = d.get('community_type')
            if ctype != current_type:
                current_type = ctype
                print()
                print(f'=== {str(current_type).upper()}S ===')
                print()

            print(f"Name: {d.get('name')}")
            if d.get('address'):
                print(f"  Address: {d.get('address')}, {d.get('city')}")
            else:
                print(f"  City: {d.get('city')}")
            units = d.get('total_units') or 'N/A'
            year = d.get('year_built') or 'N/A'
            status = d.get('status') or 'N/A'
            print(f'  Units: {units} | Year Built: {year} | Status: {status}')
            if d.get('builder'):
                print(f"  Builder: {d.get('builder')}")
            if d.get('permit_date'):
                print(f"  Permit Date: {d.get('permit_date')}")
            print()
