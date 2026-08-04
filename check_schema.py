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

payload = {
    "lot_id": "8902579b-dd0a-4876-90bc-2309f3e4983a",
    "label": "TEST_SLOT",
    "status": "unmapped",
    "is_pwd": False,
    "is_reservable": True,
    "floor_index": 0
}

url_slots = "https://bwhhfzhrjtvkrrsdxfbh.supabase.co/rest/v1/parking_slots"
req_insert = urllib.request.Request(url_slots, data=json.dumps(payload).encode('utf-8'), headers={**headers, "Content-Type": "application/json", "Prefer": "return=representation"})
try:
    with urllib.request.urlopen(req_insert) as response:
        print("Insert success:", response.read().decode())
except urllib.error.HTTPError as e:
    print("Insert Error:", e.read().decode())
except Exception as e:
    print("Error:", e)
