import urllib.request, json, os, random, string
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

load_dotenv('apps/admin/.env')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')

def generate_realistic_ph_plate():
    # Mostly starts with D, some A, some N, rarely others
    first_letter = random.choices(
        ['D', 'A', 'N', 'C', 'W', 'Z'],
        weights=[70, 20, 8, 0.5, 0.5, 1],
        k=1
    )[0]
    rest_letters = ''.join(random.choices(string.ascii_uppercase, k=2))
    letters = first_letter + rest_letters
    numbers = ''.join(random.choices(string.digits, k=4))
    return f"{letters} {numbers}"

def fetch_records(table):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=id,plate_number"
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}'
    })
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())

def update_record(task):
    table, record_id, plate = task
    url = f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{record_id}"
    data = {"plate_number": plate}
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }, method='PATCH')
    try:
        urllib.request.urlopen(req)
        return True
    except Exception as e:
        print(f"Error {record_id}: {e}")
        return False

print("Fetching...")
walk_ins = fetch_records('walk_in_records')
reservations = fetch_records('reservations')

tasks = []
for w in walk_ins:
    tasks.append(('walk_in_records', w['id'], generate_realistic_ph_plate()))
for r in reservations:
    tasks.append(('reservations', r['id'], generate_realistic_ph_plate()))

print(f"Updating {len(tasks)} records...")
with ThreadPoolExecutor(max_workers=50) as executor:
    results = list(executor.map(update_record, tasks))

print(f"Done updated {sum(1 for r in results if r)} records.")
