"""
Test the build impact calculator.
"""
import psycopg2

CONNECTION_STRING = 'postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'

def main():
    conn = psycopg2.connect(CONNECTION_STRING)
    conn.autocommit = True
    cur = conn.cursor()

    print('='*70)
    print('BUILD IMPACT CALCULATOR TEST')
    print('='*70)

    # Clear old analyses
    cur.execute('DELETE FROM build_impact_analysis')

    # Run for all 3 WV counties
    cur.execute('SELECT id, county_name FROM jurisdiction_cards ORDER BY county_name')
    cards = cur.fetchall()

    print('\nRunning analysis for 1.5 acres at $95/unit rent:')
    for card_id, county in cards:
        cur.execute('SELECT calculate_build_impact(%s, 1.5, 200, 327, 95)', (card_id,))
        analysis_id = cur.fetchone()[0]
        print('  {} -> Analysis ID {}'.format(county, analysis_id))

    # Show results
    print('\n' + '='*70)
    print('RESULTS')
    print('='*70)

    cur.execute('''
        SELECT
            jurisdiction,
            base_unit_count,
            adjusted_unit_count,
            ROUND(capacity_loss_pct * 100) as loss_pct,
            capacity_impact,
            total_added_costs,
            adjusted_investment,
            ROUND(CAST(adjusted_yield_pct AS NUMERIC) * 100, 1) as yield_pct,
            breakeven_rent,
            rent_cushion,
            overall_verdict
        FROM build_impact_analysis
        ORDER BY adjusted_yield_pct DESC
    ''')
    rows = cur.fetchall()

    for r in rows:
        print()
        print('  ' + r[0])
        print('    Units: {} base -> {} adjusted ({}% loss, {})'.format(r[1], r[2], r[3], r[4]))
        print('    Added Costs: ${:,}'.format(r[5]))
        print('    Investment: ${:,}'.format(r[6]))
        print('    Yield: {}%'.format(r[7]))
        print('    Breakeven Rent: ${} | Rent Cushion: ${}'.format(r[8], r[9]))
        print('    VERDICT: {}'.format(r[10]))

    # Show summary view
    print('\n' + '='*70)
    print('SUMMARY VIEW')
    print('='*70)
    cur.execute('SELECT * FROM v_build_impact_summary')
    rows = cur.fetchall()
    cols = [desc[0] for desc in cur.description]

    for row in rows:
        print()
        print('  {} - {}'.format(row[1], row[3]))
        print('    Difficulty: {} ({})'.format(row[4], row[5]))
        print('    Lot: {} acres'.format(row[6]))
        print('    Capacity: {} -> {} ({})'.format(row[7], row[8], row[10]))
        print('    Investment: ${:,} (added ${:,})'.format(row[14], row[13]))
        print('    Yield: {}'.format(row[18]))
        print('    Verdict: {}'.format(row[21]))

    conn.close()

if __name__ == '__main__':
    main()
