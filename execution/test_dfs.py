import os
import json
import base64
import urllib.request
from dotenv import load_dotenv

load_dotenv("server/.env")
load_dotenv(".env")

DATAFORSEO_LOGIN = os.environ.get("DATAFORSEO_LOGIN")
DATAFORSEO_PASSWORD = os.environ.get("DATAFORSEO_PASSWORD")

auth_header = "Basic " + base64.b64encode(f"{DATAFORSEO_LOGIN}:{DATAFORSEO_PASSWORD}".encode('utf-8')).decode('utf-8')

payload = [{
    "keyword": "med spa",
    "location_name": "Dubai, UAE",
    "language_code": "en",
    "depth": 50,
    "device": "desktop"
}]

req = urllib.request.Request(
    'https://api.dataforseo.com/v3/serp/google/maps/live/advanced',
    data=json.dumps(payload).encode('utf-8'),
    headers={
        'Authorization': auth_header,
        'Content-Type': 'application/json'
    },
    method='POST'
)

print("Starting DataForSEO request...")
try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        items = result['tasks'][0]['result'][0]['items']
        print(f"Success! Found {len(items)} results.")
        for item in items[:3]:
            print(f"- {item.get('title')} ({item.get('address')})")
except Exception as e:
    print(f"Error: {e}")
