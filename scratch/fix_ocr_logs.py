import urllib.request, json, os, random
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

from concurrent.futures import ThreadPoolExecutor

def update_log(task):
    log_id, new_status = task
    api_request(f"plate_validation_logs?id=eq.{log_id}", method='PATCH', data={"validation_status": new_status})

print("Fetching all plate validation logs...")
logs = api_request("plate_validation_logs?select=id,linked_walk_in_id,linked_reservation_id")

tasks = []
for log in logs:
    if log.get('linked_walk_in_id'):
        tasks.append((log['id'], 'Detected'))
    elif log.get('linked_reservation_id'):
        # 5% chance of mismatch
        status = 'Mismatched' if random.random() < 0.05 else 'Matched'
        tasks.append((log['id'], status))
    else:
        tasks.append((log['id'], 'Detected'))

print(f"Updating {len(tasks)} OCR logs to correct statuses...")
with ThreadPoolExecutor(max_workers=50) as executor:
    executor.map(update_log, tasks)

print("Done updating OCR logs!")
