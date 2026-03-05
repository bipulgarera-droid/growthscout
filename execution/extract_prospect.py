#!/usr/bin/env python3
"""
Automated Prospect Extraction Pipeline
Scrapes a website and extracts structured data for personalized preview templates.

Uses:
- Jina Reader for content extraction
- Gemini AI for structured data extraction
- Logo extraction from HTML
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
        
    print(f"\n5. Syncing to Supabase ({data['slug']})...")
    
    try:
        # Check if exists to determine insert/update (though upsert handles this)
        response = client.table("personalized_previews").upsert(
            data, on_conflict="slug"
        ).execute()
        
        print(f"   Success! Live preview available at:")
        print(f"   >>> https://laser-websites-dynamic.vercel.app/preview/{data['slug']}")
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
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=15)
        html = response.text
        
        # Common logo patterns
        patterns = [
            r'<img[^>]*(?:class|id)=["\'][^"\']*logo[^"\']*["\'][^>]*src=["\']([^"\']+)["\']',
            r'<img[^>]*src=["\']([^"\']+)["\'][^>]*(?:class|id)=["\'][^"\']*logo[^"\']*["\']',
            r'<a[^>]*class=["\'][^"\']*logo[^"\']*["\'][^>]*>\s*<img[^>]*src=["\']([^"\']+)["\']',
            r'<link[^>]*rel=["\']icon["\'][^>]*href=["\']([^"\']+)["\']',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                logo_path = match.group(1)
                # Make absolute URL
                if not logo_path.startswith('http'):
                    logo_path = urljoin(url, logo_path)
                return logo_path
        
        return ""
    except Exception as e:
        print(f"Error extracting logo: {e}")
        return ""


def extract_with_gemini(content: str, url: str) -> dict:
    """Use Gemini to extract structured business data from content."""
    
    if not GEMINI_API_KEY:
        print("GEMINI_API_KEY not found")
        return {}
    
    prompt = f"""Analyze this website content and extract business information in JSON format.
Be concise and accurate. Extract only what's explicitly stated.

IMPORTANT RULES:
- Services must be UNIQUE and SPECIFIC (no repetitions like "Aesthetics" and "Aesthetic Treatments")
- Services should be the actual treatments/products, not categories
- Value props should be distinct selling points, not generic statements
- Tagline should be short and memorable (under 10 words if possible)

Website URL: {url}

Content:
{content[:15000]}

Extract this JSON structure:
{{
    "business_name": "The company/business name (just the name, no tagline)",
    "tagline": "Short slogan or tagline (under 10 words, compelling)",
    "industry": "Industry category (e.g., 'Laser & Aesthetics', 'Medical Devices')",
    "services": ["List of 5-8 UNIQUE specific services/products - no overlapping terms"],
    "value_props": ["3 DISTINCT key differentiators - be specific, not generic"],
    "hero_phrases": ["REQUIRED: 3 short, punchy hero statements (2-4 words MAX). Example: 'PRECISION REDEFINED', 'VISION PERFECTED', 'THE FUTURE OF AESTHETICS'. do not use 'obsession' or 'delivered' generic words unless they fit perfectly."]
}}

Return ONLY valid JSON, no markdown or explanation."""

    try:
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1024
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


def extract_prospect_data(url: str) -> dict:
    """Main function to extract all prospect data from a URL."""
    
    print(f"\n{'='*60}")
    print(f"Extracting prospect data from: {url}")
    print('='*60)
    
    # Parse domain for slug
    parsed = urlparse(url)
    domain = parsed.netloc.replace('www.', '')
    slug = domain.split('.')[0].lower()
    
    # 1. Scrape content with Jina
    print("\n1. Scraping content with Jina Reader...")
    content = scrape_with_jina(url)
    if not content:
        print("   Failed to scrape content")
        return {}
    print(f"   Scraped {len(content)} characters")
    
    # 2. Extract logo
    print("\n2. Extracting logo URL...")
    logo_url = extract_logo_url(url)
    if logo_url:
        print(f"   Found logo: {logo_url[:60]}...")
    else:
        print("   No logo found")
    
    # 3. Extract structured data with Gemini
    print("\n3. Extracting structured data with Gemini AI...")
    data = extract_with_gemini(content, url)
    if not data:
        print("   Failed to extract data")
        return {}
    
    # 4. Build final preview data object
    preview_data = {
        "id": slug,
        "slug": slug,
        "business_name": data.get("business_name", ""),
        "tagline": data.get("tagline", ""),
        "website_url": url,
        "industry": data.get("industry", ""),
        "services": data.get("services", [])[:8],  # Max 8 services
        "value_props": data.get("value_props", [])[:3],
        "cta_text": data.get("cta_text", "BOOK CONSULTATION").upper(),
        "hero_phrases": data.get("hero_phrases", [])[:3],  # AI-generated hero statements
        "logo_url": logo_url,
        "contact_info": {},  # Would need deeper scraping
        "colors": {
            "primary": "#000000",
            "secondary": "#FFFFFF",
            "accent": "#808080",
            "background": "#FFFFFF",
            "text": "#333333"
        }
    }
    
    print("\n4. Extracted Data:")
    print("-" * 40)
    print(f"   Business: {preview_data['business_name']}")
    print(f"   Tagline: {preview_data['tagline']}")
    print(f"   Industry: {preview_data['industry']}")
    print(f"   Services: {', '.join(preview_data['services'][:3])}...")
    print(f"   CTA: {preview_data['cta_text']}")
    print(f"   Logo: {'✓' if logo_url else '✗'}")
    
    return preview_data


def generate_preview_code(data: dict) -> str:
    """Generate TypeScript code for the preview data fallback."""
    
    services_str = json.dumps(data.get('services', []))
    value_props_str = json.dumps(data.get('value_props', []))
    hero_phrases_str = json.dumps(data.get('hero_phrases', []))
    
    code = f'''
// Fallback data for {data.get('slug', 'prospect')}
const {data.get('slug', 'PROSPECT').upper()}_DATA: PreviewData = {{
    id: "{data.get('id', '')}",
    slug: "{data.get('slug', '')}",
    business_name: "{data.get('business_name', '')}",
    tagline: "{data.get('tagline', '')}",
    website_url: "{data.get('website_url', '')}",
    colors: {{ primary: "#000000", secondary: "#FFFFFF", accent: "#808080", background: "#FFFFFF", text: "#333333" }},
    services: {services_str},
    value_props: {value_props_str},
    hero_phrases: {hero_phrases_str},
    cta_text: "{data.get('cta_text', 'BOOK CONSULTATION')}",
    contact_info: {{}},
    industry: "{data.get('industry', '')}",
    logo_url: "{data.get('logo_url', '')}"
}};
'''
    return code


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python extract_prospect.py <website_url>")
        print("Example: python extract_prospect.py https://lumenis.com/")
        sys.exit(1)
    
    url = sys.argv[1]
    data = extract_prospect_data(url)
    
    if data:
        # Save to local JSON as backup
        output_file = f"/tmp/{data['slug']}_preview_data.json"
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
            
        print("\n" + "="*60)
        
        # Write to Supabase
        if upsert_preview_data(data):
            print("="*60)
        else:
            print("FALLBACK CODE GENERATION:")
            print("="*60)
            print(generate_preview_code(data))
