import urllib.request, json, os, random
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv('apps/admin/.env')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')

FELDGRAU_LOT_ID = '351da04b-3c82-4e1d-a761-73051163d683'
LIPA_LOT_ID = '0dea029d-4f5e-4cf0-b892-6c154b541597'

def clear_ocr_logs(lot_id):
    url = f"{SUPABASE_URL}/rest/v1/plate_validation_logs?lot_id=eq.{lot_id}"
    req = urllib.request.Request(url, method='DELETE', headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}'
    })
    try:
        urllib.request.urlopen(req)
        print(f"Cleared existing OCR logs for lot {lot_id}.")
    except Exception as e:
        print("Error clearing OCR logs:", e)

def fetch_records(table, lot_id):
    url = f"{SUPABASE_URL}/rest/v1/{table}?lot_id=eq.{lot_id}&select=*"
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

def insert_logs(logs):
    url = f"{SUPABASE_URL}/rest/v1/plate_validation_logs"
    for i in range(0, len(logs), 100):
        batch = logs[i:i+100]
        req = urllib.request.Request(url, data=json.dumps(batch).encode(), headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        }, method='POST')
        try:
            urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:
            print(f"Error inserting logs: {e.read().decode()}")

print("Fetching walk-ins and reservations for Feldgrau...")
feldgrau_walk_ins = fetch_records('walk_in_records', FELDGRAU_LOT_ID)
feldgrau_reservations = fetch_records('reservations', FELDGRAU_LOT_ID)

print("Fetching walk-ins for Lipa...")
lipa_walk_ins = fetch_records('walk_in_records', LIPA_LOT_ID)

clear_ocr_logs(FELDGRAU_LOT_ID)
clear_ocr_logs(LIPA_LOT_ID)

new_logs = []

# Process Walk-ins (Feldgrau)
print(f"Generating OCR logs for {len(feldgrau_walk_ins)} Feldgrau walk-ins...")
for w in feldgrau_walk_ins:
    plate = w.get('plate_number', 'UNKNOWN')
    new_logs.append({
        'lot_id': FELDGRAU_LOT_ID,
        'camera_id': random.choice(['CAM-01', 'CAM-02', 'CAM-03']),
        'detected_plate': plate,
        'confidence_score': round(random.uniform(85.0, 99.0), 2),
        'validation_status': 'Detected',
        'linked_walk_in_id': w['id'],
        'linked_reservation_id': None,
        'created_at': w['entry_time']
    })

# Process Walk-ins (Lipa)
print(f"Generating OCR logs for {len(lipa_walk_ins)} Lipa walk-ins...")
for w in lipa_walk_ins:
    plate = w.get('plate_number', 'UNKNOWN')
    new_logs.append({
        'lot_id': LIPA_LOT_ID,
        'camera_id': random.choice(['CAM-01', 'CAM-02']),
        'detected_plate': plate,
        'confidence_score': round(random.uniform(85.0, 99.0), 2),
        'validation_status': 'Detected',
        'linked_walk_in_id': w['id'],
        'linked_reservation_id': None,
        'created_at': w['entry_time']
    })

# Process Reservations (Feldgrau)
print(f"Generating OCR logs for {len(feldgrau_reservations)} Feldgrau reservations...")
for r in feldgrau_reservations:
    original_plate = r.get('plate_number', 'UNKNOWN')
    
    is_mismatch = random.random() < 0.05 # 5% chance of mismatch
    
    if is_mismatch:
        status = 'Mismatch'
        # Mess up one character of the plate
        if len(original_plate) > 1:
            idx = random.randint(0, len(original_plate) - 1)
            wrong_char = random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
            detected_plate = original_plate[:idx] + wrong_char + original_plate[idx+1:]
        else:
            detected_plate = 'MISMATCH'
    else:
        status = 'Match'
        detected_plate = original_plate

    new_logs.append({
        'lot_id': FELDGRAU_LOT_ID,
        'camera_id': random.choice(['CAM-01', 'CAM-02', 'CAM-03']),
        'detected_plate': detected_plate,
        'confidence_score': round(random.uniform(70.0, 99.0) if is_mismatch else random.uniform(90.0, 99.0), 2),
        'validation_status': status,
        'linked_walk_in_id': None,
        'linked_reservation_id': r['id'],
        'created_at': r.get('start_time', r.get('created_at'))
    })

print(f"Inserting {len(new_logs)} OCR logs...")
insert_logs(new_logs)
print("Done!")
