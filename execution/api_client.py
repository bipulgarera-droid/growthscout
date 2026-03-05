#!/usr/bin/env python3
"""
API Client for Cross-App Communication.
Calls external apps (audit-app, general_local_seo) via HTTP.
"""
import os
import requests
from typing import Dict, Any, Optional
from dotenv import load_dotenv

from pathlib import Path
load_dotenv()
load_dotenv(Path(__file__).parent.parent / ".env.pipeline")

# External app URLs - configure in .env
AUDIT_APP_URL = os.getenv("AUDIT_APP_URL", "http://localhost:5000")
CITATIONS_APP_URL = os.getenv("CITATIONS_APP_URL", "http://localhost:8000")
GROWTHSCOUT_SERVER_URL = os.getenv("GROWTHSCOUT_SERVER_URL", "http://localhost:5002")


class APIClient:
    """Unified client for calling all microservices."""
    
    def __init__(self):
        self.audit_url = AUDIT_APP_URL
        self.citations_url = CITATIONS_APP_URL
        self.growthscout_url = GROWTHSCOUT_SERVER_URL
    
    def _call(self, base_url: str, endpoint: str, data: Dict[str, Any], timeout: int = 60) -> Dict:
        """Generic HTTP POST call."""
        url = f"{base_url}{endpoint}"
        try:
            response = requests.post(url, json=data, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            return {"error": "Request timed out", "url": url}
        except requests.exceptions.ConnectionError:
            return {"error": "Connection failed - is the service running?", "url": url}
        except requests.exceptions.HTTPError as e:
            return {"error": str(e), "url": url}
    
    # ==================== AUDIT-APP ====================
    
    def get_pagespeed(self, url: str) -> Dict:
        """Get PageSpeed Insights for a URL."""
        return self._call(self.audit_url, "/api/pagespeed", {"url": url})
    
    def capture_screenshot(self, url: str) -> Dict:
        """Capture screenshot of a website."""
        return self._call(self.audit_url, "/api/screenshot", {"url": url})
    
    def generate_slides(self, business_data: Dict, audit_data: Dict) -> Dict:
        """Generate Google Slides proposal."""
        return self._call(self.audit_url, "/api/generate-slides", {
            "business": business_data,
            "audit": audit_data
        }, timeout=120)
    
    # ==================== CITATIONS-APP ====================
    
    def check_directory_listing(self, business_name: str, city: str, directory: str) -> Dict:
        """Check if business is listed on a specific directory."""
        return self._call(self.citations_url, "/api/discover-url", {
            "business_name": business_name,
            "city": city,
            "directory": directory
        }, timeout=30)
    
    # ==================== GROWTHSCOUT (SELF) ====================
    
    def take_screenshot(self, url: str, below_fold: bool = False) -> Dict:
        """Take screenshot using GrowthScout server."""
        return self._call(self.growthscout_url, "/api/screenshot", {
            "url": url,
            "belowFold": below_fold
        })
    
    def run_website_audit(self, url: str, screenshot_base64: str) -> Dict:
        """Run website audit using GrowthScout/Gemini."""
        return self._call(self.growthscout_url, "/api/audit", {
            "url": url,
            "screenshot": screenshot_base64
        })


# Singleton instance
api_client = APIClient()


if __name__ == "__main__":
    # Test connection to all services
    print("Testing API connections...")
    
    client = APIClient()
    
    # Test GrowthScout
    print(f"\n1. GrowthScout ({client.growthscout_url}):")
    result = client.take_screenshot("https://example.com")
    print(f"   {'✅ Connected' if 'error' not in result else '❌ ' + result.get('error')}")
    
    # Test Audit App
    print(f"\n2. Audit App ({client.audit_url}):")
    result = client.get_pagespeed("https://example.com")
    print(f"   {'✅ Connected' if 'error' not in result else '❌ ' + result.get('error')}")
    
    # Test Citations App
    print(f"\n3. Citations App ({client.citations_url}):")
    result = client.check_directory_listing("Test Salon", "Cleveland", "Yelp")
    print(f"   {'✅ Connected' if 'error' not in result else '❌ ' + result.get('error')}")

