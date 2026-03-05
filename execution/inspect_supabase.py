
import os
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env.pipeline')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

def inspect_schema():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Try to fetch one row
    try:
        response = client.table("personalized_previews").select("*").limit(1).execute()
        if response.data and len(response.data) > 0:
            print("Columns found:", json.dumps(list(response.data[0].keys()), indent=2))
            print("Data sample:", json.dumps(response.data[0], indent=2))
        else:
            print("Table found but empty. Trying to insert dummy to find columns...")
            # We can't easily discover columns without data or specific API
            pass
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_schema()
