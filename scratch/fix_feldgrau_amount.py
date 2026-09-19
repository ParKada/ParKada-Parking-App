import urllib.request, json, os
from dotenv import load_dotenv

load_dotenv('apps/admin/.env')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')

FELDGRAU_LOT_ID = '351da04b-3c82-4e1d-a761-73051163d683'

def api_request(url_path, method='GET', data=None):
    url = f"{SUPABASE_URL}/rest/v1/{url_path}"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }
    if data is not None:
        if method == 'GET':
            method = 'POST'
        req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method=method)
    else:
        req = urllib.request.Request(url, headers=headers, method=method)
    
    with urllib.request.urlopen(req) as res:
        try:
            return json.loads(res.read().decode())
        except:
            return None

from concurrent.futures import ThreadPoolExecutor

def update_record(task):
    table, r_id = task
    api_request(f"{table}?id=eq.{r_id}", method='PATCH', data={"total_amount": 60})

print("Fetching walk-ins for Feldgrau...")
walk_ins = api_request(f"walk_in_records?lot_id=eq.{FELDGRAU_LOT_ID}&select=id")

print("Fetching reservations for Feldgrau...")
reservations = api_request(f"reservations?lot_id=eq.{FELDGRAU_LOT_ID}&select=id")

tasks = [("walk_in_records", w['id']) for w in walk_ins] + [("reservations", r['id']) for r in reservations]

print(f"Updating {len(tasks)} records to 60...")
with ThreadPoolExecutor(max_workers=50) as executor:
    executor.map(update_record, tasks)

print("Done updating amounts!")
