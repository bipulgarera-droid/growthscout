#!/usr/bin/env python3
"""
Voice AI Template - Simplified Prospect Extraction
Extracts only: logo, business_name, phone, email, address

Uses:
- Jina Reader for content extraction
- Gemini AI for structured data extraction
- Supabase for data storage
"""

import os
import re
import json
import requests
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()
load_dotenv('.env.local')
load_dotenv('.env.pipeline')

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')


def get_supabase_client() -> Client:
    """Initialize Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.pipeline")
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def upsert_preview_data(data: dict) -> bool:
    """Insert or update preview data in Supabase."""
    client = get_supabase_client()
    if not client:
        return False
        
    print(f"\n4. Syncing to Supabase ({data['slug']})...")
    
    try:
        response = client.table("personalized_previews").upsert(
            data, on_conflict="slug"
        ).execute()
        
        print(f"   Success! Live preview available at:")
        print(f"   >>> https://voice-ai-template.vercel.app/preview/{data['slug']}")
        return True
    except Exception as e:
        print(f"   Error writing to Supabase: {e}")
        return False


def scrape_with_jina(url: str) -> str:
    """Use Jina Reader to extract clean content from a URL."""
    jina_url = f"https://r.jina.ai/{url}"
    headers = {
        "Accept": "text/plain",
        "User-Agent": "Mozilla/5.0"
    }
    
    try:
        response = requests.get(jina_url, headers=headers, timeout=30)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"Error scraping with Jina: {e}")
        return ""


def extract_logo_url(url: str) -> str:
    """Extract logo URL from website HTML."""
    try:
        response = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (compatible; ProspectBot/1.0)"
        })
        html = response.text.lower()
        
        # Look for common logo patterns
        patterns = [
            r'<img[^>]*class="[^"]*logo[^"]*"[^>]*src="([^"]+)"',
            r'<img[^>]*src="([^"]+)"[^>]*class="[^"]*logo[^"]*"',
            r'<a[^>]*class="[^"]*logo[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"',
            r'<link[^>]*rel="icon"[^>]*href="([^"]+)"',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                logo_path = match.group(1)
                if logo_path.startswith('//'):
                    return 'https:' + logo_path
                elif logo_path.startswith('/'):
                    return urljoin(url, logo_path)
                elif logo_path.startswith('http'):
                    return logo_path
                else:
                    return urljoin(url, logo_path)
        
        return ""
    except Exception as e:
        print(f"Error extracting logo: {e}")
        return ""


def extract_with_gemini(content: str, url: str) -> dict:
    """Use Gemini to extract contact info from content."""
    
    if not GEMINI_API_KEY:
        print("GEMINI_API_KEY not found")
        return {}
    
    prompt = f"""Analyze this website content and extract contact/business information in JSON format.

Website URL: {url}

Content:
{content[:10000]}

Extract this JSON structure:
{{
    "business_name": "The company/business name only",
    "phone": "Primary phone number (formatted)",
    "email": "Primary email address",
    "address": "Full physical address (street, city, postal code)"
}}

Return ONLY valid JSON, no markdown or explanation. If a field is not found, use empty string."""

    try:
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 512
            }
        }
        
        response = requests.post(api_url, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        text = result['candidates'][0]['content']['parts'][0]['text']
        
        # Clean up JSON from response
        text = text.strip()
        if text.startswith('```json'):
            text = text[7:]
        if text.startswith('```'):
            text = text[3:]
        if text.endswith('```'):
            text = text[:-3]
        
        return json.loads(text.strip())
        
    except Exception as e:
        print(f"Error with Gemini extraction: {e}")
        return {}


def url_to_slug(url: str) -> str:
    """Convert URL to a clean slug."""
    parsed = urlparse(url)
    domain = parsed.netloc.replace('www.', '')
    # Remove TLD and clean
    slug = domain.split('.')[0]
    slug = re.sub(r'[^a-z0-9]', '', slug.lower())
    return slug


def extract_prospect_data(url: str) -> dict:
    """Main function to extract prospect data from a URL."""
    
    print(f"\n{'='*60}")
    print(f"Voice AI Template - Extracting: {url}")
    print('='*60)
    
    # Step 1: Scrape content
    print("\n1. Scraping website content...")
    content = scrape_with_jina(url)
    if not content:
        print("   Failed to scrape content")
        return {}
    print(f"   Got {len(content)} characters")
    
    # Step 2: Extract logo
    print("\n2. Extracting logo...")
    logo_url = extract_logo_url(url)
    if logo_url:
        print(f"   Found: {logo_url[:60]}...")
    else:
        print("   No logo found")
    
    # Step 3: Extract contact info with Gemini
    print("\n3. Extracting contact info with Gemini...")
    extracted = extract_with_gemini(content, url)
    print(f"   Business: {extracted.get('business_name', 'N/A')}")
    print(f"   Phone: {extracted.get('phone', 'N/A')}")
    print(f"   Email: {extracted.get('email', 'N/A')}")
    print(f"   Address: {extracted.get('address', 'N/A')[:50]}...")
    
    # Build final data
    slug = url_to_slug(url)
    
    preview_data = {
        "slug": slug,
        "business_name": extracted.get('business_name', ''),
        "logo_url": logo_url,
        "contact_info": {
            "phone": extracted.get('phone', ''),
            "email": extracted.get('email', ''),
            "address": extracted.get('address', '')
        },
        "website_url": url
    }
    
    return preview_data


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 extract_voiceai.py <website_url>")
        print("Example: python3 extract_voiceai.py https://example-medspa.com")
        sys.exit(1)
    
    url = sys.argv[1]
    
    # Extract data
    data = extract_prospect_data(url)
    
    if data:
        # Sync to Supabase
        success = upsert_preview_data(data)
        
        if success:
            print("\n" + "="*60)
            print("DONE! Preview ready at:")
            print(f"https://voice-ai-template.vercel.app/preview/{data['slug']}")
            print("="*60)
        else:
            print("\nFailed to sync to Supabase. Check credentials.")
    else:
        print("\nFailed to extract prospect data.")
