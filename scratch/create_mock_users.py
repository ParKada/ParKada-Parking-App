import urllib.request, json, os, random
from dotenv import load_dotenv

load_dotenv('apps/admin/.env')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_SERVICE_KEY')

def check_profile(user_id):
    prof_url = f'{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}'
    req = urllib.request.Request(prof_url, headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'})
    with urllib.request.urlopen(req) as res:
        profiles = json.loads(res.read().decode())
        if not profiles:
            # Create profile manually
            print(f'Profile for {user_id} not found, creating manually...')
            prof_data = {
                'id': user_id,
                'first_name': f'MockUser{random.randint(100,999)}',
                'last_name': 'Test',
                'email': f'mock.user.{random.randint(100,999)}@example.com',
                'phone_number': f'09{random.randint(100000000,999999999)}',
                'user_type': 'regular'
            }
            create_prof_req = urllib.request.Request(
                f'{SUPABASE_URL}/rest/v1/profiles',
                data=json.dumps([prof_data]).encode(),
                headers={
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}',
                    'Content-Type': 'application/json'
                },
                method='POST'
            )
            urllib.request.urlopen(create_prof_req)
            print('Profile created manually.')
        else:
            print('Profile exists.')

# Let's create 28 users
print('Starting creation of 28 mock users...')
for i in range(28):
    email = f'mock.user.{random.randint(1000,9999)}.{i}@example.com'
    url = f'{SUPABASE_URL}/auth/v1/admin/users'
    data = {
        'email': email,
        'password': 'password123',
        'email_confirm': True,
        'user_metadata': {
            'first_name': f'Mock',
            'last_name': f'User{i}'
        }
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }, method='POST')

    try:
        with urllib.request.urlopen(req) as res:
            user = json.loads(res.read().decode())
            uid = user.get('id')
            check_profile(uid)
    except urllib.error.HTTPError as e:
        print('Error:', e.read().decode())

print('Done creating 28 users.')
