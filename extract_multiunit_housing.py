"""
Extract MULTI-UNIT housing developments from Frederick County VA
Focus: Townhouses, Duplexes, Condos, Apartments (NO single-family)
"""

import requests
import re
import os
from collections import defaultdict

def main():
    print("=" * 70)
    print("MULTI-UNIT HOUSING DEVELOPMENT EXTRACTION")
    print("Focus: Townhouses, Duplexes, Condos, Apartments")
    print("Excluding: Single-Family Dwellings")
    print("=" * 70)
    print()

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    # Download October 2025 report
    url = 'https://www.fcva.us/home/showpublisheddocument/29614/638977571436800000'
    print(f"Downloading October 2025 permit report...")
    response = session.get(url, timeout=30)

    with open('temp_permits.pdf', 'wb') as f:
        f.write(response.content)

    from PyPDF2 import PdfReader

    reader = PdfReader('temp_permits.pdf')
    print(f"Processing {len(reader.pages)} pages...")
    print()

    # Extract all text
    all_text = ''
    for page in reader.pages:
        all_text += page.extract_text() + '\n'

    # Find all permit blocks
    permit_blocks = re.split(r'(?=PermitNo\.:\d+-\d+)', all_text)

    print(f"Total permit entries found: {len(permit_blocks) - 1}")
    print()

    # MULTI-UNIT keywords only (excluding single-family)
    multiunit_keywords = [
        'townho', 'town ho', 'townhouse',
        'duplex', 'triplex', 'quadplex',
        'apartment', 'multi-family', 'multifamily',
        'condo', 'condominium',
        'attached'  # Often indicates townhouses
    ]

    # Exclusion keywords (single-family)
    exclude_keywords = [
        'single family', 'singlefamily', 'sfh',
        'detached dwelling', 'single-family'
    ]

    # Known development names in Frederick County
    development_patterns = {
        'STEPHENSON': 'Stephenson Village',
        'LAKE FREDERICK': 'Lake Frederick',
        'PATRIOT': 'Lake Frederick',
        'ABRAMS': 'Abrams Pointe',
        'OPEQUON': 'Opequon Crossing',
        'WILLOW RUN': 'Willow Run',
        'SENSENY': 'Senseny Glen',
        'WINDSTONE': 'Windstone',
        'ZEPHYR': 'Windstone',  # Zephyr Lane is in Windstone
        'VALLEYPIKE': 'Valley Pike',
        'VALLEY PIKE': 'Valley Pike',
        'BOWERS': 'Valley Pike',  # Bowers Street is Valley Pike development
        'PARK PLACE': 'Park Place Condominiums',
        'BROOKLAND': 'Park Place Condominiums',  # Brookland Court is Park Place
        'SHENANDOAH': 'Shenandoah',
        'STONEWALL': 'Stonewall',
        'SNOWDEN': 'Snowden Bridge',
        'CLEARBROOK': 'Clearbrook',
    }

    multiunit_permits = []
    developments = defaultdict(list)

    for block in permit_blocks[1:]:
        block_lower = block.lower()

        # Skip if it matches single-family exclusions
        is_excluded = False
        for excl in exclude_keywords:
            if excl in block_lower:
                is_excluded = True
                break

        if is_excluded:
            continue

        # Check for multi-unit keywords
        for kw in multiunit_keywords:
            if kw in block_lower:
                # Extract permit number
                permit_match = re.search(r'PermitNo\.:\s*(\d+-\d+)', block)
                permit_no = permit_match.group(1) if permit_match else 'Unknown'

                # Extract address
                addr_match = re.search(r'SiteAddress:\s*([^\n]+)', block)
                address = addr_match.group(1).strip() if addr_match else 'Unknown'

                # Extract owner/developer
                owner_match = re.search(r'OwnerName:\s*([^\n]+)', block)
                owner = owner_match.group(1).strip() if owner_match else 'Unknown'

                # Extract permit type
                type_match = re.search(r'BUILDINGPERMIT([A-Za-z/]+)', block)
                permit_type = type_match.group(1) if type_match else 'Unknown'

                # Extract value
                value_match = re.search(r'\$([\d,]+\.?\d*)', block)
                value = value_match.group(1) if value_match else 'Unknown'

                # Identify development name from address
                dev_name = "Other"
                address_upper = address.upper().replace(' ', '')
                for pattern, name in development_patterns.items():
                    if pattern.replace(' ', '') in address_upper:
                        dev_name = name
                        break

                permit_data = {
                    'permit_no': permit_no,
                    'type': permit_type,
                    'address': address[:70],
                    'owner': owner[:40],
                    'value': value,
                    'keyword': kw,
                    'development': dev_name
                }

                multiunit_permits.append(permit_data)
                developments[dev_name].append(permit_data)
                break

    # Results
    print("=" * 70)
    print(f"MULTI-UNIT HOUSING PERMITS FOUND: {len(multiunit_permits)}")
    print("=" * 70)
    print()

    # Group by development
    print("PERMITS BY DEVELOPMENT:")
    print("-" * 70)

    # Sort developments - named ones first, "Other" last
    sorted_devs = sorted(
        developments.keys(),
        key=lambda x: (x == "Other", x)
    )

    for dev_name in sorted_devs:
        permits = developments[dev_name]
        print(f"\n{'='*50}")
        print(f"{dev_name.upper()} ({len(permits)} permits)")
        print("=" * 50)

        # Group by type within development
        by_type = defaultdict(list)
        for p in permits:
            by_type[p['type']].append(p)

        for ptype, type_permits in sorted(by_type.items()):
            print(f"\n  {ptype}: {len(type_permits)} units")
            for p in type_permits:
                print(f"    - Permit {p['permit_no']}")
                print(f"      Address: {p['address']}")
                print(f"      Value: ${p['value']}")

    # Summary statistics
    print("\n" + "=" * 70)
    print("SUMMARY STATISTICS")
    print("=" * 70)

    type_counts = defaultdict(int)
    total_value = 0

    for p in multiunit_permits:
        type_counts[p['type']] += 1
        try:
            val = float(p['value'].replace(',', ''))
            total_value += val
        except:
            pass

    print("\nBy Permit Type:")
    for ptype, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {ptype}: {count}")

    print(f"\nTotal Estimated Construction Value: ${total_value:,.2f}")

    # Active developments summary
    print("\n" + "-" * 70)
    print("ACTIVE MULTI-UNIT DEVELOPMENTS (October 2025):")
    print("-" * 70)
    for dev_name in sorted_devs:
        if dev_name != "Other":
            count = len(developments[dev_name])
            types = set(p['type'] for p in developments[dev_name])
            print(f"  {dev_name}: {count} permits ({', '.join(types)})")

    # Clean up
    os.remove('temp_permits.pdf')

    print("\n" + "=" * 70)
    print("NEXT STEPS:")
    print("1. Track inspection schedules for each permit")
    print("2. Monitor: Foundation -> Framing -> MEP -> Final")
    print("3. Estimate move-in dates based on inspection progress")
    print("=" * 70)

    return multiunit_permits, developments


if __name__ == "__main__":
    permits, devs = main()
