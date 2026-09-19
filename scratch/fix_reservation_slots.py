import urllib.request, json, os, random
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

print("Fetching reservable slots for Feldgrau...")
slots = api_request(f"parking_slots?lot_id=eq.{FELDGRAU_LOT_ID}&label=in.(R1,R2,R3,R4,R5)&select=id,label")

if not slots:
    print("Could not find R1-R5 slots. Fetching all slots with 'is_reservable' = true...")
    slots = api_request(f"parking_slots?lot_id=eq.{FELDGRAU_LOT_ID}&is_reservable=eq.true&select=id,label")

if not slots:
    print("No reservable slots found!")
    exit(1)

print(f"Found {len(slots)} reservable slots: {[s['label'] for s in slots]}")
slot_ids = [s['id'] for s in slots]

print("Fetching all Feldgrau reservations...")
reservations = api_request(f"reservations?lot_id=eq.{FELDGRAU_LOT_ID}&select=id")

print(f"Updating {len(reservations)} reservations to only use reservable slots...")
for r in reservations:
    new_slot = random.choice(slot_ids)
    api_request(f"reservations?id=eq.{r['id']}", method='PATCH', data={
        "slot_id": new_slot
    })

print("Done updating reservations.")
