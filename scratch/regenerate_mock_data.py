import os
import json
import urllib.request
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv('apps/admin/.env')
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')

FELDGRAU_LOT_ID = '351da04b-3c82-4e1d-a761-73051163d683'
LIPA_LOT_ID = '0dea029d-4f5e-4cf0-b892-6c154b541597'

def rpc(fn_name, payload):
    url = f"{SUPABASE_URL}/rest/v1/rpc/{fn_name}"
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    })
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Error {e.code}: {e.read().decode()}")
        return None

def clear_table(table):
    url = f"{SUPABASE_URL}/rest/v1/{table}?lot_id=in.({FELDGRAU_LOT_ID},{LIPA_LOT_ID})"
    req = urllib.request.Request(url, method='DELETE', headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}'
    })
    try:
        with urllib.request.urlopen(req) as res:
            pass
    except urllib.error.HTTPError as e:
        pass

print("Clearing old data...")
clear_table("walk_in_records")
clear_table("reservations")

# Generate new data
def random_date(days_back_min=0, days_back_max=60):
    now = datetime.now()
    delta = timedelta(
        days=random.randint(days_back_min, days_back_max),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59)
    )
    return now - delta

def generate_walkins(lot_id, count, base_amount):
    print(f"Generating {count} walk-ins for lot {lot_id}...")
    batch = []
    for _ in range(count):
        entry_time = random_date()
        duration_hours = random.randint(1, 8)
        exit_time = entry_time + timedelta(hours=duration_hours)
        amount = base_amount + (duration_hours - 1) * 10
        batch.append({
            "lot_id": lot_id,
            "plate_number": f"ABC{random.randint(100, 999)}",
            "entry_time": entry_time.isoformat(),
            "exit_time": exit_time.isoformat(),
            "amount_paid": amount,
            "status": "completed"
        })
    
    # insert batch
    url = f"{SUPABASE_URL}/rest/v1/walk_in_records"
    req = urllib.request.Request(url, data=json.dumps(batch).encode(), headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    })
    urllib.request.urlopen(req)

def generate_reservations(lot_id, count, base_amount):
    print(f"Generating {count} reservations for lot {lot_id}...")
    batch = []
    for _ in range(count):
        created_at = random_date()
        start_time = created_at + timedelta(days=random.randint(1, 5))
        end_time = start_time + timedelta(hours=random.randint(1, 8))
        batch.append({
            "lot_id": lot_id,
            "profile_id": "a2ab19e7-4bc9-4073-b8f5-60f515e7b76b",
            "plate_number": f"XYZ{random.randint(100, 999)}",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "total_amount": base_amount,
            "status": "completed",
            "created_at": created_at.isoformat()
        })
    
    url = f"{SUPABASE_URL}/rest/v1/reservations"
    req = urllib.request.Request(url, data=json.dumps(batch).encode(), headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    })
    urllib.request.urlopen(req)

generate_walkins(FELDGRAU_LOT_ID, 350, 40)
generate_reservations(FELDGRAU_LOT_ID, 150, 50)
generate_walkins(LIPA_LOT_ID, 400, 20)

print("Done generating fresh, separated mock data.")
