import urllib.request, json, os, random, string
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv('apps/admin/.env')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')

FELDGRAU_LOT_ID = '351da04b-3c82-4e1d-a761-73051163d683'

names_to_add = [
    ("Keith Justin", "Nario", "2026-08-26T10:00:00Z"),
    ("Ivan Joseph", "Jaurige", "2026-08-26T11:30:00Z"),
    ("Harry", "Garcia", "2026-08-26T14:00:00Z"),
    ("Jay", "Oconer", "2026-08-26T09:15:00Z"),
    ("Mark Jerome", "Kinchasan", "2026-08-26T16:45:00Z"),
    ("Kyan Prince", "Torres", "2026-08-26T18:00:00Z"),
    ("Breindel", "Babasa", "2026-09-03T08:30:00Z")
]

def generate_ph_plate():
    plates = [
        "DAF 4821", "DMC 1923", "DPR 7401", "DTX 5532", "DLS 8104", 
        "DKN 2947", "ABC 3190", "AXV 6041", "NEX 4812", "NPL 7302", "CML 1948"
    ]
    return random.choice(plates)

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

print("Fetching profiles...")
profiles = api_request("profiles?select=*&limit=30")
mock_profiles = [p for p in profiles if 'Mock' in p.get('first_name', '')]

if len(mock_profiles) < len(names_to_add):
    print("Not enough mock profiles found to rename.")
else:
    print("Renaming mock profiles and creating specific reservations...")
    slots = api_request(f"parking_slots?lot_id=eq.{FELDGRAU_LOT_ID}&select=id")
    slot_ids = [s['id'] for s in slots]
    
    # 1. Update profiles and create specific reservations
    for i, (first, last, start_time) in enumerate(names_to_add):
        prof = mock_profiles[i]
        # Update profile
        api_request(f"profiles?id=eq.{prof['id']}", method='PATCH', data={
            "first_name": first,
            "last_name": last
        })
        
        # Create reservation
        start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        end_dt = start_dt + timedelta(hours=random.randint(1, 4))
        
        res_data = {
            "lot_id": FELDGRAU_LOT_ID,
            "profile_id": prof['id'],
            "slot_id": random.choice(slot_ids),
            "plate_number": generate_ph_plate(),
            "start_time": start_time,
            "end_time": end_dt.isoformat(),
            "status": "completed",
            "total_amount": random.randint(50, 150),
            "created_at": (start_dt - timedelta(days=1)).isoformat()
        }
        api_request("reservations", method='POST', data=res_data)

    print("Specific reservations added.")

    # 2. Add random reservations from Aug 19 to Sept 12
    print("Adding 30 random reservations from Aug 19 to Sept 12...")
    random_res = []
    start_date = datetime(2026, 8, 19)
    end_date = datetime(2026, 9, 12)
    
    for _ in range(30):
        prof = random.choice(profiles)
        random_days = random.randint(0, (end_date - start_date).days)
        res_dt = start_date + timedelta(days=random_days, hours=random.randint(8, 20))
        res_end = res_dt + timedelta(hours=random.randint(1, 5))
        
        random_res.append({
            "lot_id": FELDGRAU_LOT_ID,
            "profile_id": prof['id'],
            "slot_id": random.choice(slot_ids),
            "plate_number": generate_ph_plate(),
            "start_time": res_dt.isoformat() + "Z",
            "end_time": res_end.isoformat() + "Z",
            "status": "completed",
            "total_amount": random.randint(50, 200),
            "created_at": (res_dt - timedelta(days=random.randint(1, 3))).isoformat() + "Z"
        })
        
    api_request("reservations", method='POST', data=random_res)
    print("Random reservations added.")
