import urllib.request, json, os, random
from dotenv import load_dotenv

load_dotenv('apps/admin/.env')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')

FELDGRAU_LOT_ID = '351da04b-3c82-4e1d-a761-73051163d683'

# 1. Fetch Mock Profiles
prof_url = f"{SUPABASE_URL}/rest/v1/profiles?email=like.mock.user.*"
req = urllib.request.Request(prof_url, headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'})
try:
    with urllib.request.urlopen(req) as res:
        profiles = json.loads(res.read().decode())
        profile_ids = [p['id'] for p in profiles]
        print(f"Found {len(profile_ids)} mock profiles.")
except Exception as e:
    print('Failed to fetch profiles:', e)
    exit(1)

# 2. Fetch Slots for Feldgrau
slots_url = f"{SUPABASE_URL}/rest/v1/parking_slots?lot_id=eq.{FELDGRAU_LOT_ID}&select=id"
req = urllib.request.Request(slots_url, headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'})
try:
    with urllib.request.urlopen(req) as res:
        slots = json.loads(res.read().decode())
        slot_ids = [s['id'] for s in slots]
        print(f"Found {len(slot_ids)} slots.")
except Exception as e:
    print('Failed to fetch slots:', e)
    exit(1)

# 3. Fetch Reservations for Feldgrau
res_url = f"{SUPABASE_URL}/rest/v1/reservations?lot_id=eq.{FELDGRAU_LOT_ID}&select=id"
req = urllib.request.Request(res_url, headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'})
try:
    with urllib.request.urlopen(req) as res:
        reservations = json.loads(res.read().decode())
        res_ids = [r['id'] for r in reservations]
        print(f"Found {len(res_ids)} reservations.")
except Exception as e:
    print('Failed to fetch reservations:', e)
    exit(1)

# 4. Update Reservations
if profile_ids and slot_ids and res_ids:
    print("Updating reservations...")
    for rid in res_ids:
        pid = random.choice(profile_ids)
        sid = random.choice(slot_ids)
        
        url = f"{SUPABASE_URL}/rest/v1/reservations?id=eq.{rid}"
        data = {
            "profile_id": pid,
            "slot_id": sid
        }
        req = urllib.request.Request(
            url, 
            data=json.dumps(data).encode(), 
            headers={
                'apikey': SUPABASE_KEY, 
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            method='PATCH'
        )
        try:
            urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:
            print(f"Error updating {rid}: {e.read().decode()}")

print("Done linking users and slots!")
