"""
Save Personalized Preview to Supabase

Takes brand extraction data and saves it to the personalized_previews table.
"""

import os
import sys
import json
import re
from dotenv import load_dotenv
from pathlib import Path
import requests

# Load environment
load_dotenv()
load_dotenv(Path(__file__).parent.parent / '.env.pipeline')

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://fjbowxwqaegvpjyinnsa.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')


def generate_slug(business_name: str) -> str:
    """Generate URL-safe slug from business name."""
    slug = business_name.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')[:50]


def save_preview(brand_data: dict) -> dict:
    """
    Save brand extraction data to Supabase.
    Returns the created record with slug.
    """
    if not SUPABASE_SERVICE_KEY:
        return {"error": "SUPABASE_SERVICE_KEY not configured"}
    
    business_name = brand_data.get('business_name', 'Unknown Business')
    slug = generate_slug(business_name)
    
    # Prepare record
    record = {
        "slug": slug,
        "business_name": business_name,
        "tagline": brand_data.get('tagline', ''),
        "website_url": brand_data.get('_source', {}).get('url', ''),
        "colors": brand_data.get('colors', {}),
        "services": brand_data.get('services', []),
        "value_props": brand_data.get('value_propositions', []),
        "cta_text": brand_data.get('cta_text', 'Book Now'),
        "contact_info": brand_data.get('contact', {}),
        "industry": brand_data.get('industry', ''),
        "vibe": brand_data.get('vibe', ''),
        "status": "pending"
    }
    
    try:
        # Upsert (insert or update if slug exists)
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/personalized_previews",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            },
            json=record
        )
        
        if response.status_code in [200, 201]:
            print(f"✅ Saved preview: {slug}")
            return {
                "success": True,
                "slug": slug,
                "preview_url": f"https://preview.yourdomain.com/{slug}"  # Update with actual domain
            }
        else:
            return {"error": f"Supabase error: {response.text}"}
            
    except Exception as e:
        return {"error": str(e)}


# CLI usage
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python save_preview.py <brand_data.json>")
        sys.exit(1)
    
    json_file = sys.argv[1]
    with open(json_file, 'r') as f:
        brand_data = json.load(f)
    
    result = save_preview(brand_data)
    print(json.dumps(result, indent=2))
