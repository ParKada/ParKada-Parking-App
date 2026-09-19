import urllib.request, json, os, dotenv
dotenv.load_dotenv(r'c:\Users\iamga\Desktop\ParKada_Thesis\apps\ai-node\.env')

headers = {
    'apikey': os.environ.get('VITE_SUPABASE_SERVICE_KEY'),
    'Authorization': 'Bearer ' + os.environ.get('VITE_SUPABASE_SERVICE_KEY'),
    'Content-Type': 'application/json'
}

def delete_future(table):
    url = f"{os.environ.get('VITE_SUPABASE_URL')}/rest/v1/{table}?created_at=gt.2026-09-19T10:40:00%2B08:00"
    req = urllib.request.Request(url, method='DELETE', headers=headers)
    try:
        urllib.request.urlopen(req)
        print(f'Deleted future records from {table}')
    except Exception as e:
        print(f'Error deleting from {table}: {e}')

for table in ['plate_validation_logs', 'transactions', 'reservations', 'walk_in_records']:
    delete_future(table)
