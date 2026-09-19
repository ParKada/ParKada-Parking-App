import urllib.request, json, os, random, string
from dotenv import load_dotenv

load_dotenv('apps/admin/.env')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')

FELDGRAU_LOT_ID = '351da04b-3c82-4e1d-a761-73051163d683'
LIPA_LOT_ID = '0dea029d-4f5e-4cf0-b892-6c154b541597'

def generate_ph_plate():
    plates = [
        "DAF 4821",
        "DMC 1923",
        "DPR 7401",
        "DTX 5532",
        "DLS 8104",
        "DKN 2947",
        "ABC 3190",
        "AXV 6041",
        "NEX 4812",
        "NPL 7302",
        "CML 1948"
    ]
    return random.choice(plates)

def fetch_records(table, lot_id=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=id,plate_number"
    if lot_id:
        url += f"&lot_id=eq.{lot_id}"
    
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}'
    })
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode())
    except Exception as e:
        print(f"Error fetching {table}:", e)
        return []

def update_record(table, record_id, plate):
    url = f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{record_id}"
    data = {"plate_number": plate}
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }, method='PATCH')
    try:
        urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        print(f"Error updating {table} {record_id}:", e.read().decode())

def fix_plates():
    print("Fetching and fixing walk-in records...")
    walk_ins = fetch_records('walk_in_records')
    for w in walk_ins:
        update_record('walk_in_records', w['id'], generate_ph_plate())
        
    print("Fetching and fixing reservations...")
    reservations = fetch_records('reservations')
    for r in reservations:
        update_record('reservations', r['id'], generate_ph_plate())
        
    print("Done fixing plates.")

fix_plates()
