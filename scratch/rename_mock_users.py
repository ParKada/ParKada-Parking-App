import urllib.request, json, os, random
from dotenv import load_dotenv

load_dotenv('apps/admin/.env')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')

filipino_names = [
    ("Zian", "Mercado"),
    ("Kian", "Alcantara"),
    ("Mikael", "Villareal"),
    ("Jethro", "Navarro"),
    ("Althea", "Del Rosario"),
    ("Samara", "Evangelista"),
    ("Yvaine", "Salazar"),
    ("Mira", "Manalo"),
    ("Kael", "Ramos"),
    ("Ari", "Lim"),
    ("Rielle", "Cruz")
]

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
profiles = api_request("profiles?select=id,first_name,last_name")

mock_profiles = [p for p in profiles if 'Mock' in str(p.get('first_name', ''))]

print(f"Found {len(mock_profiles)} mock profiles to rename.")

for prof in mock_profiles:
    first, last = random.choice(filipino_names)
    api_request(f"profiles?id=eq.{prof['id']}", method='PATCH', data={
        "first_name": first,
        "last_name": last
    })

print("Done renaming all mock users to Filipino names!")
