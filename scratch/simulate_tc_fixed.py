import urllib.request, json, os

VITE_SUPABASE_URL = ''
VITE_SUPABASE_SERVICE_KEY = ''

try:
    with open(r'c:\Users\iamga\Desktop\ParKada_Thesis\apps\ai-node\.env', 'r') as f:
        for line in f:
            if line.startswith('VITE_SUPABASE_SERVICE_KEY='):
                VITE_SUPABASE_SERVICE_KEY = line.strip().split('=', 1)[1].strip('"\'')
            if line.startswith('VITE_SUPABASE_URL='):
                VITE_SUPABASE_URL = line.strip().split('=', 1)[1].strip('"\'')
except Exception as e:
    print('Failed to read env:', e)

def api_request(endpoint, method='GET', data=None):
    url = f'{VITE_SUPABASE_URL}/rest/v1/{endpoint}'
    req = urllib.request.Request(url, method=method)
    req.add_header('apikey', VITE_SUPABASE_SERVICE_KEY)
    req.add_header('Authorization', f'Bearer {VITE_SUPABASE_SERVICE_KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'return=representation')
    if data:
        req.data = json.dumps(data).encode('utf-8')
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f'Error: {e}')
        return None

lot_id = '351da04b-3c82-4e1d-a761-73051163d683'

# Check if there is already a reservation for TEST23 so TC-23 will pass
mock_res = api_request('reservations', method='POST', data={
    'lot_id': lot_id,
    'user_id': '45173305-6449-43c2-af38-9cb5f19024f2',
    'plate_number': 'TEST23',
    'status': 'active',
    'base_rate_id': 'b2816922-8328-406c-8dc7-28d8a1dbdfce'
})

print('=======================================')
print('Simulating TC-23 (Match)')
res = api_request('plate_validation_logs', method='POST', data={
    'lot_id': lot_id,
    'detected_plate': 'TEST23',
    'confidence_score': 95.0
})
if res: print(f'>>> TC-23 Trigger Result: {res[0].get("validation_status")}')

print('=======================================')
print('Simulating TC-24 (Mismatch)')
res2 = api_request('plate_validation_logs', method='POST', data={
    'lot_id': lot_id,
    'detected_plate': 'UNKNOWN99',
    'confidence_score': 95.0
})
if res2: print(f'>>> TC-24 Trigger Result: {res2[0].get("validation_status")}')

print('=======================================')
print('Simulating TC-25 (Unclear / UNREADABLE)')
res3 = api_request('plate_validation_logs', method='POST', data={
    'lot_id': lot_id,
    'detected_plate': 'UNREADABLE',
    'confidence_score': 0.0
})
if res3: print(f'>>> TC-25 Trigger Result: {res3[0].get("validation_status")}')
print('=======================================')

# Clean up mock reservation
if mock_res and len(mock_res) > 0:
    api_request(f'reservations?id=eq.{mock_res[0]["id"]}', method='DELETE')
