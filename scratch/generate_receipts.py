import urllib.request, json, os, random, string
from dotenv import load_dotenv

load_dotenv('apps/admin/.env')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')

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

def generate_ref_no(method):
    chars = string.ascii_uppercase + string.digits
    rand_str = ''.join(random.choice(chars) for _ in range(10))
    if method == 'gcash':
        return f"GCASH-{rand_str}"
    else:
        return f"MAYA-{rand_str}"

print("Fetching all reservations...")
reservations = api_request("reservations?select=id,total_amount")

print("Fetching existing receipts...")
existing_receipts = api_request("receipts?select=reservation_id")
existing_res_ids = {r['reservation_id'] for r in existing_receipts} if existing_receipts else set()

new_receipts = []
for res in reservations:
    if res['id'] not in existing_res_ids:
        method = random.choice(['gcash', 'maya'])
        new_receipts.append({
            "reservation_id": res['id'],
            "reference_no": generate_ref_no(method),
            "payment_method": method,
            "amount_paid": res.get('total_amount') or 60.00
        })

if not new_receipts:
    print("All reservations already have receipts!")
else:
    print(f"Inserting {len(new_receipts)} new receipts...")
    # Insert in batches of 100
    for i in range(0, len(new_receipts), 100):
        batch = new_receipts[i:i+100]
        api_request("receipts", method='POST', data=batch)
    
    print("Done generating receipts!")
