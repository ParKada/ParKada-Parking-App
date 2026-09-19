import urllib.request, json, os, dotenv
dotenv.load_dotenv(r'c:\Users\iamga\Desktop\ParKada_Thesis\apps\ai-node\.env')
url = f"{os.environ.get('VITE_SUPABASE_URL')}/rest/v1/admin_profiles?select=*"
req = urllib.request.Request(url)
req.add_header('apikey', os.environ.get('VITE_SUPABASE_SERVICE_KEY'))
req.add_header('Authorization', 'Bearer ' + os.environ.get('VITE_SUPABASE_SERVICE_KEY'))
try:
    with urllib.request.urlopen(req) as response:
        print(json.loads(response.read().decode()))
except Exception as e:
    print(e)
