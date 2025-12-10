#!/usr/bin/env python3
"""
Retell.ai Integration for Storage Facility Rate Collection

Integrates with Retell.ai voice AI to call storage facilities and collect:
- 10x10 and 10x20 unit rates
- Climate control availability and premium
- Move-in specials
- Availability status

Usage:
    python retell_caller.py --setup              # Create agent and show setup
    python retell_caller.py --list-agents        # List existing agents
    python retell_caller.py --list-phones        # List phone numbers
    python retell_caller.py --test-call NUMBER   # Make a test call
    python retell_caller.py --batch FILE         # Run batch calls from CSV
    python retell_caller.py --status CALL_ID     # Check call status
    python retell_caller.py --import-results     # Import completed calls to DB
"""

import os
import sys
import json
import argparse
import requests
from datetime import datetime
from typing import Optional, Dict, List, Any

# Load from environment
RETELL_API_KEY = os.getenv('RETELL_API_KEY', 'key_ff422bc16d8b5c2db21673ddb502')
BASE_URL = 'https://api.retellai.com'


class RetellClient:
    """Client for Retell.ai API"""

    def __init__(self, api_key: str = RETELL_API_KEY):
        self.api_key = api_key
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def _request(self, method: str, endpoint: str, data: dict = None) -> dict:
        """Make API request"""
        url = f"{BASE_URL}{endpoint}"

        if method == 'GET':
            response = requests.get(url, headers=self.headers, params=data)
        elif method == 'POST':
            response = requests.post(url, headers=self.headers, json=data)
        elif method == 'DELETE':
            response = requests.delete(url, headers=self.headers)
        else:
            raise ValueError(f"Unknown method: {method}")

        if response.status_code >= 400:
            print(f"Error {response.status_code}: {response.text}")
            return None

        return response.json() if response.text else {}

    # ==================== AGENTS ====================

    def list_agents(self) -> List[dict]:
        """List all voice agents"""
        return self._request('GET', '/list-agents') or []

    def get_agent(self, agent_id: str) -> dict:
        """Get agent details"""
        return self._request('GET', f'/get-agent/{agent_id}')

    def create_agent(self, name: str, voice_id: str = "eleven_labs_amy",
                     llm_config: dict = None) -> dict:
        """Create a new voice agent"""

        # Default LLM config for storage rate collection
        default_llm = {
            "model": "gpt-4o-mini",
            "general_prompt": STORAGE_RATE_PROMPT,
            "begin_message": "Hi, I'm looking for storage in the area. Do you have any units available?",
            "general_tools": []
        }

        data = {
            "agent_name": name,
            "voice_id": voice_id,
            "response_engine": {
                "type": "retell_llm",
                "llm_id": None  # Will use inline config
            },
            "llm_websocket_url": None,
            "language": "en-US"
        }

        return self._request('POST', '/create-agent', data)

    # ==================== PHONE NUMBERS ====================

    def list_phone_numbers(self) -> List[dict]:
        """List phone numbers"""
        return self._request('GET', '/list-phone-numbers') or []

    def get_phone_number(self, phone_number: str) -> dict:
        """Get phone number details"""
        return self._request('GET', f'/get-phone-number/{phone_number}')

    def buy_phone_number(self, area_code: str = "540") -> dict:
        """Buy a phone number in area code"""
        return self._request('POST', '/create-phone-number', {
            "area_code": int(area_code)
        })

    # ==================== CALLS ====================

    def create_call(self, from_number: str, to_number: str,
                    agent_id: str = None, metadata: dict = None) -> dict:
        """Create an outbound phone call"""

        data = {
            "from_number": from_number,
            "to_number": to_number
        }

        if agent_id:
            data["override_agent_id"] = agent_id

        if metadata:
            data["metadata"] = metadata

        return self._request('POST', '/v2/create-phone-call', data)

    def get_call(self, call_id: str) -> dict:
        """Get call details and transcript"""
        return self._request('GET', f'/v2/get-call/{call_id}')

    def list_calls(self, limit: int = 100, filter_criteria: dict = None) -> List[dict]:
        """List calls with optional filters"""
        params = {"limit": limit}
        if filter_criteria:
            params["filter_criteria"] = json.dumps(filter_criteria)
        return self._request('GET', '/v2/list-calls', params) or []

    # ==================== CONCURRENCY ====================

    def get_concurrency(self) -> dict:
        """Get current concurrency limits"""
        return self._request('GET', '/get-concurrency')


# Storage rate collection prompt
STORAGE_RATE_PROMPT = """You are calling storage facilities to gather pricing information for a customer looking for storage. Be polite, professional, and concise.

Your goal is to extract the following information:
1. 10x10 unit availability (available, unavailable, or waitlist)
2. 10x10 monthly rate (dollar amount)
3. 10x20 monthly rate (dollar amount)
4. Climate control availability (yes/no) and premium cost
5. Any current move-in specials or promotions

Call flow:
1. Introduce yourself as looking for storage
2. Ask about 10x10 availability and rate
3. Ask about 10x20 rate
4. Ask about climate control options
5. Ask about move-in specials
6. Thank them and end call

Keep responses brief. If they ask questions, answer simply and redirect to your questions.
If they transfer you or put you on hold, wait patiently.
If you reach voicemail, hang up without leaving a message.

Extract and remember these specific values:
- availability_10x10: "available", "unavailable", or "waitlist"
- rate_10x10: number only (e.g., 95)
- rate_10x20: number only (e.g., 165)
- has_climate: "yes" or "no"
- climate_premium: number only (e.g., 25)
- move_in_special: brief text or "none"
"""


def setup_agent(client: RetellClient):
    """Setup instructions for creating agent in Retell dashboard"""

    print("\n" + "="*60)
    print("RETELL.AI SETUP FOR STORAGE RATE COLLECTION")
    print("="*60)

    # Check connection
    concurrency = client.get_concurrency()
    if concurrency:
        print(f"\n[OK] API Connected")
        print(f"  Concurrency: {concurrency.get('current_concurrency', 0)}/{concurrency.get('concurrency_limit', 20)}")
    else:
        print("\n[ERROR] Failed to connect to Retell API")
        return

    # List existing agents
    agents = client.list_agents()
    print(f"\n[INFO] Existing Agents: {len(agents)}")
    for a in agents:
        print(f"  - {a.get('agent_name', 'Unnamed')} ({a.get('agent_id')})")

    # List phone numbers
    phones = client.list_phone_numbers()
    print(f"\n[INFO] Phone Numbers: {len(phones)}")
    for p in phones:
        print(f"  - {p.get('phone_number')} ({p.get('phone_number_type', 'unknown')})")

    print("\n" + "-"*60)
    print("SETUP STEPS:")
    print("-"*60)

    print("""
1. CREATE AGENT in Retell Dashboard (https://dashboard.retellai.com):
   - Click "Create Agent"
   - Name: "Storage Rate Collector"
   - Voice: Choose natural-sounding voice (Amy, Rachel, etc.)

2. CONFIGURE LLM:
   - Model: GPT-4o-mini (cost effective)
   - Copy this prompt into "General Prompt":
""")
    print("-"*40)
    print(STORAGE_RATE_PROMPT)
    print("-"*40)

    print("""
3. SET BEGIN MESSAGE:
   "Hi, I'm looking for storage in the area. Do you have any units available?"

4. BUY PHONE NUMBER:
   - Go to Phone Numbers
   - Click "Buy Number"
   - Choose area code (540 for VA, 304 for WV, 301 for MD)

5. LINK PHONE TO AGENT:
   - Select your phone number
   - Set "Outbound Agent" to your Storage Rate Collector

6. TEST:
   python retell_caller.py --test-call +1XXXXXXXXXX
""")

    print("\n[TIP] For n8n integration:")
    print("  - Use Retell's webhook to send call results to n8n")
    print("  - n8n can then update Neon database")


def test_call(client: RetellClient, to_number: str, from_number: str = None):
    """Make a test call"""

    phones = client.list_phone_numbers()
    if not phones and not from_number:
        print("[ERROR] No phone numbers available. Buy one first:")
        print("  python retell_caller.py --buy-phone 540")
        return

    if not from_number:
        from_number = phones[0].get('phone_number')

    # Format phone number
    if not to_number.startswith('+'):
        to_number = '+1' + to_number.replace('-', '').replace(' ', '')

    print(f"\nInitiating call:")
    print(f"  From: {from_number}")
    print(f"  To: {to_number}")

    result = client.create_call(
        from_number=from_number,
        to_number=to_number,
        metadata={"test": True, "timestamp": datetime.now().isoformat()}
    )

    if result:
        print(f"\n[OK] Call initiated!")
        print(f"  Call ID: {result.get('call_id')}")
        print(f"  Status: {result.get('call_status')}")
        print(f"\nCheck status with:")
        print(f"  python retell_caller.py --status {result.get('call_id')}")
    else:
        print("[ERROR] Failed to initiate call")


def check_status(client: RetellClient, call_id: str):
    """Check call status and transcript"""

    result = client.get_call(call_id)

    if not result:
        print(f"[ERROR] Call not found: {call_id}")
        return

    print(f"\nCall Status: {result.get('call_status')}")
    print(f"Duration: {result.get('duration_ms', 0) / 1000:.1f} seconds")
    print(f"Disconnection: {result.get('disconnection_reason', 'N/A')}")

    if result.get('transcript'):
        print(f"\nTranscript:")
        print("-"*40)
        print(result.get('transcript'))
        print("-"*40)

    if result.get('call_analysis'):
        print(f"\nCall Analysis:")
        print(json.dumps(result.get('call_analysis'), indent=2))


def list_recent_calls(client: RetellClient, limit: int = 20):
    """List recent calls"""

    calls = client.list_calls(limit=limit)

    print(f"\nRecent Calls ({len(calls)}):")
    print("-"*80)
    print(f"{'Call ID':<36} {'Status':<12} {'Duration':<10} {'To Number':<15}")
    print("-"*80)

    for call in calls:
        duration = call.get('duration_ms', 0) / 1000
        print(f"{call.get('call_id', 'N/A'):<36} {call.get('call_status', 'N/A'):<12} {duration:>6.1f}s    {call.get('to_number', 'N/A'):<15}")


def import_to_database(client: RetellClient):
    """Import completed calls to Neon database"""

    try:
        from neon_db_utils import NeonDB
    except ImportError:
        print("[ERROR] neon_db_utils not found")
        return

    # Get completed calls
    calls = client.list_calls(limit=1000)
    completed = [c for c in calls if c.get('call_status') == 'ended']

    print(f"\nFound {len(completed)} completed calls to import")

    if not completed:
        return

    with NeonDB() as db:
        with db.conn.cursor() as cur:
            imported = 0

            for call in completed:
                call_id = call.get('call_id')

                # Check if already imported
                cur.execute(
                    "SELECT id FROM facility_call_results WHERE call_id = %s",
                    (call_id,)
                )
                if cur.fetchone():
                    continue

                # Get full call details
                details = client.get_call(call_id)
                if not details:
                    continue

                # Parse call analysis if available
                analysis = details.get('call_analysis', {})

                # Insert into database
                cur.execute("""
                    INSERT INTO facility_call_results (
                        call_id, call_datetime, call_duration_seconds,
                        call_status, to_number, transcript,
                        caller_service, raw_response
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    call_id,
                    details.get('start_timestamp'),
                    (details.get('duration_ms', 0) or 0) // 1000,
                    details.get('call_status'),
                    details.get('to_number'),
                    details.get('transcript'),
                    'retell',
                    json.dumps(details)
                ))
                imported += 1

            print(f"Imported {imported} new call results")


def main():
    parser = argparse.ArgumentParser(description='Retell.ai Storage Rate Caller')
    parser.add_argument('--setup', action='store_true', help='Show setup instructions')
    parser.add_argument('--list-agents', action='store_true', help='List agents')
    parser.add_argument('--list-phones', action='store_true', help='List phone numbers')
    parser.add_argument('--list-calls', action='store_true', help='List recent calls')
    parser.add_argument('--buy-phone', type=str, metavar='AREA_CODE', help='Buy phone number')
    parser.add_argument('--test-call', type=str, metavar='NUMBER', help='Make test call')
    parser.add_argument('--from-number', type=str, help='Override from number')
    parser.add_argument('--status', type=str, metavar='CALL_ID', help='Check call status')
    parser.add_argument('--import-results', action='store_true', help='Import to database')
    parser.add_argument('--concurrency', action='store_true', help='Check concurrency')

    args = parser.parse_args()

    client = RetellClient()

    if args.setup:
        setup_agent(client)
    elif args.list_agents:
        agents = client.list_agents()
        print(f"\nAgents ({len(agents)}):")
        for a in agents:
            print(f"  {a.get('agent_id')}: {a.get('agent_name', 'Unnamed')} ({a.get('voice_id')})")
    elif args.list_phones:
        phones = client.list_phone_numbers()
        print(f"\nPhone Numbers ({len(phones)}):")
        for p in phones:
            print(f"  {p.get('phone_number')} - Agent: {p.get('outbound_agent_id', 'None')}")
    elif args.list_calls:
        list_recent_calls(client)
    elif args.buy_phone:
        result = client.buy_phone_number(args.buy_phone)
        if result:
            print(f"[OK] Purchased: {result.get('phone_number')}")
        else:
            print("[ERROR] Failed to buy phone number")
    elif args.test_call:
        test_call(client, args.test_call, args.from_number)
    elif args.status:
        check_status(client, args.status)
    elif args.import_results:
        import_to_database(client)
    elif args.concurrency:
        result = client.get_concurrency()
        print(f"\nConcurrency:")
        print(f"  Current: {result.get('current_concurrency', 0)}")
        print(f"  Limit: {result.get('concurrency_limit', 20)}")
        print(f"  Can Purchase: {result.get('remaining_purchase_limit', 0)} more")
    else:
        parser.print_help()
        print("\n[TIP] Run --setup first for configuration instructions")


if __name__ == '__main__':
    main()
