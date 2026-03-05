"""
Screenshot-Based Brand Extraction (Using Puppeteer Stealth)

Uses the existing puppeteer-extra stealth approach for reliable screenshot capture,
then analyzes with Gemini Vision for comprehensive brand data extraction.
"""

import os
import sys
import json
import base64
import subprocess
import re
import requests
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime

# Load environment - try multiple locations for API keys
load_dotenv()
load_dotenv(Path(__file__).parent.parent / '.env.local')  # Contains GEMINI_API_KEY
load_dotenv(Path(__file__).parent.parent / '.env.pipeline')


def capture_screenshot(url: str) -> dict:
    """
    Capture screenshot using existing growthscout /api/screenshot endpoint.
    Falls back to puppeteer script if API unavailable.
    """
    # Try the existing growthscout API first (runs on port 5002)
    growthscout_api = os.getenv('GROWTHSCOUT_API_URL', 'http://localhost:5002')
    
    try:
        print(f"  Trying growthscout API ({growthscout_api})...")
        response = requests.post(
            f"{growthscout_api}/api/screenshot",
            json={"url": url, "view": "desktop", "belowFold": False},
            timeout=90
        )
        
        if response.ok:
            data = response.json()
            return {
                "success": True,
                "base64Image": data.get("base64Image"),
                "fullPage": None  # API returns base64 directly
            }
    except Exception as e:
        print(f"  Growthscout API unavailable: {e}")
    
    # Fallback: use puppeteer script
    script_path = Path(__file__).parent / 'brand_screenshot.cjs'
    
    if not script_path.exists():
        return {"success": False, "error": "brand_screenshot.cjs not found and API unavailable"}
    
    print(f"📸 Capturing screenshot of {url}...")
    
    try:
        result = subprocess.run(
            ['node', str(script_path), '--url', url],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(script_path.parent.parent)
        )
        
        # Parse JSON from output
        output = result.stdout
        json_match = re.search(r'__JSON_START__\s*(.*?)\s*__JSON_END__', output, re.DOTALL)
        
        if json_match:
            return json.loads(json_match.group(1))
        else:
            print(f"Output: {output}")
            print(f"Stderr: {result.stderr}")
            return {"success": False, "error": "No JSON output from screenshot script"}
            
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Screenshot capture timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def analyze_screenshot_with_gemini(image_data_or_path: str, url: str, is_base64: bool = False) -> dict:
    """
    Use Gemini Vision to analyze the screenshot and extract brand data.
    image_data_or_path: Either base64 string or file path
    is_base64: If True, image_data_or_path is already base64
    """
    import google.generativeai as genai
    
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return {"error": "GEMINI_API_KEY not found"}
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    # Get image data
    if is_base64:
        image_data = image_data_or_path
    else:
        with open(image_data_or_path, 'rb') as f:
            image_data = base64.b64encode(f.read()).decode('utf-8')
    
    prompt = """Analyze this website screenshot and extract brand data. Return ONLY valid JSON:

{
    "business_name": "The business/company name",
    "tagline": "Main tagline or slogan if visible",
    "colors": {
        "primary": "Main brand color as hex (look at buttons, highlights, accents)",
        "secondary": "Secondary color as hex",
        "accent": "Accent color as hex",
        "background": "Main background color as hex",
        "text": "Main text color as hex"
    },
    "services": [
        "Service 1 - extract ALL visible services from navigation, menus, cards",
        "Service 2",
        "etc"
    ],
    "value_propositions": [
        "Key selling point 1",
        "Key selling point 2",
        "Key selling point 3"
    ],
    "contact": {
        "phone": "If visible",
        "email": "If visible",
        "address": "If visible"
    },
    "cta_text": "Main call-to-action button text",
    "industry": "Industry category",
    "vibe": "Overall aesthetic (luxury, modern, clinical, friendly)"
}

IMPORTANT: Extract ALL services visible in navigation menus, dropdowns, or anywhere on page.
For colors, look at actual button colors, header colors, accent elements."""

    try:
        image_part = {
            "inline_data": {
                "mime_type": "image/png",
                "data": image_data
            }
        }
        
        response = model.generate_content([prompt, image_part])
        
        # Parse JSON
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        
        return json.loads(text.strip())
        
    except json.JSONDecodeError as e:
        return {"error": f"Failed to parse JSON: {str(e)}"}
    except Exception as e:
        return {"error": str(e)}


def extract_brand_from_url(url: str) -> dict:
    """
    Main function: Capture screenshot and extract brand data.
    """
    print(f"📸 Capturing screenshot of {url}...")
    
    # Step 1: Capture screenshot
    screenshot_result = capture_screenshot(url)
    
    if not screenshot_result.get("success"):
        return {"error": f"Screenshot failed: {screenshot_result.get('error')}"}
    
    # Step 2: Analyze with Gemini
    print("🤖 Analyzing with Gemini Vision...")
    
    # Check if we have base64 or file path
    if screenshot_result.get("base64Image"):
        brand_data = analyze_screenshot_with_gemini(
            screenshot_result["base64Image"], url, is_base64=True
        )
    elif screenshot_result.get("fullPage") and os.path.exists(screenshot_result["fullPage"]):
        brand_data = analyze_screenshot_with_gemini(
            screenshot_result["fullPage"], url, is_base64=False
        )
    else:
        return {"error": "No screenshot data available"}
    
    if "error" in brand_data:
        return brand_data
    
    # Add metadata
    brand_data["_source"] = {
        "url": url,
        "method": "screenshot_vision",
        "timestamp": datetime.now().isoformat()
    }
    
    print("✅ Extraction complete!")
    return brand_data


def generate_template_config(brand_data: dict) -> str:
    """
    Generate TypeScript config for template from extracted data.
    """
    colors = brand_data.get('colors', {})
    
    config = f'''// ===========================================
// AUTO-GENERATED FROM: {brand_data.get('_source', {}).get('url', 'unknown')}
// TIMESTAMP: {brand_data.get('_source', {}).get('timestamp', 'unknown')}
// ===========================================
const BRAND = {{
    name: "{brand_data.get('business_name', 'Business Name')}",
    tagline: "{brand_data.get('tagline', '')}",
    ctaText: "{brand_data.get('cta_text', 'Book Now')}",
    colors: {{
        primary: "{colors.get('primary', '#FFD5C2')}",
        secondary: "{colors.get('secondary', '#000000')}",
        accent: "{colors.get('accent', '#F5B5A0')}",
        text: "{colors.get('text', '#333333')}",
        background: "{colors.get('background', '#FFFFFF')}",
    }},
}};

const SERVICES = [
'''
    
    for service in brand_data.get('services', []):
        config += f'''    {{ title: "{service}", description: "" }},
'''
    
    config += '''];

const VALUE_PROPS = [
'''
    
    for vp in brand_data.get('value_propositions', []):
        config += f'''    {{ title: "{vp}", description: "" }},
'''
    
    config += '];'
    
    return config


# CLI usage
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python screenshot_extraction.py <url>")
        print("Example: python screenshot_extraction.py https://example.com")
        sys.exit(1)
    
    url = sys.argv[1]
    result = extract_brand_from_url(url)
    
    print("\n" + "="*50)
    print("EXTRACTED BRAND DATA:")
    print("="*50)
    print(json.dumps(result, indent=2))
    
    if "error" not in result:
        print("\n" + "="*50)
        print("TEMPLATE CONFIG:")
        print("="*50)
        print(generate_template_config(result))
