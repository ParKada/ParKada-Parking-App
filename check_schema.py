import urllib.request
import json

url = "https://bwhhfzhrjtvkrrsdxfbh.supabase.co/rest/v1/parking_lots?limit=1"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGhmemhyanR2a3Jyc2R4ZmJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwNzc1MiwiZXhwIjoyMDk2MjgzNzUyfQ.oHYbTUzRmU2S_JrmV68BDadLKTlr90P5kjS_Sc7gioo",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGhmemhyanR2a3Jyc2R4ZmJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwNzc1MiwiZXhwIjoyMDk2MjgzNzUyfQ.oHYbTUzRmU2S_JrmV68BDadLKTlr90P5kjS_Sc7gioo"
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print("Lots keys:", list(data[0].keys()) if data else "No lots")
except Exception as e:
    print("Error fetching lots:", e)

url_rpc = "https://bwhhfzhrjtvkrrsdxfbh.supabase.co/rest/v1/rpc/get_policies"
# Wait, no rpc exists for policies. We can query pg_policies using postgres connection, but we can't over REST.
# But wait, what if I just use a direct insert to parking_slots using the anon key?
anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGhmemhyanR2a3Jyc2R4ZmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MDc3NTIsImV4cCI6MjA5NjI4Mzc1Mn0.Iy0QbQe6eeU9y3xx_L6qCqLUFfoH9PQhq82gDtUjYPw"
headers_anon = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

payload_slot = {
    "lot_id": "8902579b-dd0a-4876-90bc-2309f3e4983a",
    "label": "TEST_SLOT_ANON",
    "status": "unmapped",
    "is_pwd": False,
    "is_reservable": True,
    "floor_index": 0
}

try:
    url = "https://bwhhfzhrjtvkrrsdxfbh.supabase.co/rest/v1/parking_lots?limit=1"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode())
        valid_lot_id = data[0]['id']
        payload_slot['lot_id'] = valid_lot_id

        url_slots = "https://bwhhfzhrjtvkrrsdxfbh.supabase.co/rest/v1/parking_slots"
        req_insert = urllib.request.Request(url_slots, data=json.dumps(payload_slot).encode('utf-8'), headers=headers_anon)
        with urllib.request.urlopen(req_insert) as res2:
            print("Anon Insert Success!")
except urllib.error.HTTPError as e:
    print("Anon Insert Error:", e.read().decode())
except Exception as e:
    print("Error:", e)
