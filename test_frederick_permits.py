"""
Test extraction of housing development permits from Frederick County VA
"""

import requests
import re
import os

def main():
    print("=" * 60)
    print("EXTRACTING HOUSING DEVELOPMENT PERMITS")
    print("Filtering for: Townhomes, Apartments, Multi-Family, Condos")
    print("=" * 60)
    print()

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    # Download October 2025 report
    url = 'https://www.fcva.us/home/showpublisheddocument/29614/638977571436800000'
    print(f"Downloading: {url}")
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

    # Find all permit blocks - each starts with 'PermitNo.:'
    permit_blocks = re.split(r'(?=PermitNo\.:\d+-\d+)', all_text)

    print(f"Total permit entries found: {len(permit_blocks) - 1}")
    print()

    # Filter for housing development keywords
    housing_keywords = [
        'townho', 'town ho', 'apartment', 'multi-family', 'multifamily',
        'condo', 'dwelling', 'duplex', 'triplex', 'quadplex',
        'new single', 'new home', 'sfh', 'new res'
    ]

    housing_permits = []

    for block in permit_blocks[1:]:  # Skip first empty block
        block_lower = block.lower()

        # Check for housing keywords
        for kw in housing_keywords:
            if kw in block_lower:
                # Extract permit number
                permit_match = re.search(r'PermitNo\.:\s*(\d+-\d+)', block)
                permit_no = permit_match.group(1) if permit_match else 'Unknown'

                # Extract address
                addr_match = re.search(r'SiteAddress:\s*([^\n]+)', block)
                address = addr_match.group(1).strip() if addr_match else 'Unknown'

                # Extract owner
                owner_match = re.search(r'OwnerName:\s*([^\n]+)', block)
                owner = owner_match.group(1).strip() if owner_match else 'Unknown'

                # Extract nature of work / type
                type_match = re.search(r'BUILDINGPERMIT([A-Za-z/]+)', block)
                permit_type = type_match.group(1) if type_match else 'Unknown'

                # Extract value
                value_match = re.search(r'\$([\d,]+\.\d{2})', block)
                value = value_match.group(1) if value_match else 'Unknown'

                housing_permits.append({
                    'permit_no': permit_no,
                    'type': permit_type,
                    'address': address[:60],
                    'owner': owner[:40],
                    'value': value,
                    'keyword': kw
                })
                break

    print(f"HOUSING DEVELOPMENT PERMITS: {len(housing_permits)}")
    print("=" * 60)
    print()

    # Show results
    for i, p in enumerate(housing_permits[:25]):
        print(f"{i+1}. Permit {p['permit_no']}")
        print(f"   Type: {p['type']}")
        print(f"   Address: {p['address']}")
        print(f"   Value: ${p['value']}")
        print(f"   Keyword: \"{p['keyword']}\"")
        print()

    if len(housing_permits) > 25:
        print(f"... and {len(housing_permits) - 25} more")

    # Clean up
    os.remove('temp_permits.pdf')

    print()
    print("=" * 60)
    print("SUCCESS! These permits can be tracked for inspections")
    print("=" * 60)

    return housing_permits


if __name__ == "__main__":
    permits = main()
