#!/usr/bin/env python3
"""
Citation Audit Integration

Orchestrates full citation audit flow via general_local_seo API:
1. Create project with business NAP data
2. Discover directories (via Perplexity)
3. Find profile URLs (via Google Search)
4. Verify NAP consistency
"""
import os
import sys
import time
import requests
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment
load_dotenv()
load_dotenv(Path(__file__).parent.parent / ".env.pipeline")

CITATIONS_APP_URL = os.getenv("CITATIONS_APP_URL", "http://localhost:8000")


class CitationAuditClient:
    """Client for full citation audit workflow."""
    
    def __init__(self, base_url: str = None):
        self.base_url = base_url or CITATIONS_APP_URL
        
    def _call(self, endpoint: str, data: Dict = None, method: str = "POST", timeout: int = 120) -> Dict:
        """Make API call to citations app."""
        url = f"{self.base_url}{endpoint}"
        try:
            if method == "POST":
                resp = requests.post(url, json=data or {}, timeout=timeout)
            elif method == "GET":
                resp = requests.get(url, params=data or {}, timeout=timeout)
            else:
                resp = requests.request(method, url, json=data or {}, timeout=timeout)
            
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.Timeout:
            return {"error": "Request timed out", "url": url}
        except requests.exceptions.ConnectionError:
            return {"error": "Connection failed - is general_local_seo running?", "url": url}
        except requests.exceptions.HTTPError as e:
            return {"error": str(e), "url": url}
        except Exception as e:
            return {"error": str(e), "url": url}
    
    # ==================== PROJECT MANAGEMENT ====================
    
    def create_project(self, business_name: str, address: str, city: str, 
                       state: str, phone: str, website: str = "",
                       service_type: str = "local_business") -> Dict:
        """
        Create a new project in medical_projects table.
        
        Args:
            business_name: Full business name
            address: Street address
            city: City name
            state: State/province
            phone: Phone number
            website: Website URL (optional)
            service_type: Type of business (e.g., movers, dental, salon)
        
        Returns:
            Dict with project_id if successful
        """
        location = f"{city}, {state}"
        
        return self._call("/api/medical-projects", {
            "business_name": business_name,
            "address": address,
            "location": location,
            "phone": phone,
            "website": website,
            "service_type": service_type
        })
    
    def get_project(self, project_id: str) -> Dict:
        """Get project details."""
        return self._call(f"/api/medical-projects/{project_id}", method="GET")
    
    # ==================== CITATION AUDIT STEPS ====================
    
    def discover_directories(self, project_id: str) -> Dict:
        """
        Step 1: Discover relevant directories for this business type/location.
        Uses Perplexity AI to find directories.
        
        Returns list of discovered directories with status='pending'.
        """
        print(f"🔍 Step 1: Discovering directories for project {project_id}...")
        return self._call("/api/citation-audit/discover", {
            "project_id": project_id
        }, timeout=180)  # Perplexity calls can be slow
    
    def find_urls(self, project_id: str) -> Dict:
        """
        Step 2: Find profile URLs for each pending directory.
        Uses Google Custom Search to find actual listing URLs.
        
        Returns URLs found and updates status to 'verified' or 'not_found'.
        """
        print(f"🔗 Step 2: Finding profile URLs for project {project_id}...")
        return self._call("/api/citation-audit/find-urls", {
            "project_id": project_id
        }, timeout=300)  # Many Google searches
    
    def verify_nap(self, project_id: str) -> Dict:
        """
        Step 3: Verify NAP (Name, Address, Phone) consistency on found listings.
        Scrapes each found listing and checks if NAP matches.
        
        Returns verification results with issues found.
        """
        print(f"✅ Step 3: Verifying NAP consistency for project {project_id}...")
        return self._call("/api/citation-audit/verify-nap", {
            "project_id": project_id
        }, timeout=300)
    
    def get_audit_status(self, project_id: str) -> Dict:
        """Get current audit status and results for a project."""
        return self._call(f"/api/citation-audit/project/{project_id}", method="GET")
    
    # ==================== FULL WORKFLOW ====================
    
    def run_full_audit(self, business_name: str, address: str, city: str,
                       state: str, phone: str, website: str = "",
                       service_type: str = "local_business") -> Dict:
        """
        Run complete citation audit workflow:
        1. Create project
        2. Discover directories
        3. Find URLs
        4. Verify NAP
        
        Returns complete audit results.
        """
        print("=" * 60)
        print(f"🚀 STARTING FULL CITATION AUDIT")
        print(f"   Business: {business_name}")
        print(f"   Location: {city}, {state}")
        print("=" * 60)
        
        results = {
            "business_name": business_name,
            "status": "in_progress"
        }
        
        # Step 0: Create Project
        print("\n📋 Creating project...")
        project_result = self.create_project(
            business_name=business_name,
            address=address,
            city=city,
            state=state,
            phone=phone,
            website=website,
            service_type=service_type
        )
        
        if "error" in project_result:
            results["status"] = "failed"
            results["error"] = f"Failed to create project: {project_result['error']}"
            return results
        
        project_id = project_result.get("project", {}).get("id")
        if not project_id:
            results["status"] = "failed"
            results["error"] = "No project_id returned"
            return results
        
        results["project_id"] = project_id
        print(f"   ✓ Project created: {project_id}")
        
        # Step 1: Discover
        discover_result = self.discover_directories(project_id)
        if "error" in discover_result:
            results["discover_error"] = discover_result["error"]
        else:
            results["directories_discovered"] = discover_result.get("count", 0)
            print(f"   ✓ Discovered {results['directories_discovered']} directories")
        
        # Step 2: Find URLs
        find_result = self.find_urls(project_id)
        if "error" in find_result:
            results["find_error"] = find_result["error"]
        else:
            results["urls_found"] = find_result.get("found_count", 0)
            results["urls_not_found"] = find_result.get("not_found_count", 0)
            print(f"   ✓ Found {results['urls_found']} URLs, {results['urls_not_found']} not found")
        
        # Step 3: Verify NAP
        verify_result = self.verify_nap(project_id)
        if "error" in verify_result:
            results["verify_error"] = verify_result["error"]
        else:
            results["verified_count"] = verify_result.get("verified_count", 0)
            results["issues_count"] = verify_result.get("issues_count", 0)
            print(f"   ✓ Verified {results['verified_count']}, found {results['issues_count']} issues")
        
        # Get final status
        final_status = self.get_audit_status(project_id)
        results["audit_details"] = final_status.get("audits", [])
        results["status"] = "complete"
        
        print("\n" + "=" * 60)
        print("✅ CITATION AUDIT COMPLETE")
        print("=" * 60)
        
        return results
    
    def run_audit_for_lead(self, lead: Dict) -> Dict:
        """
        Run citation audit for a scraped lead.
        Extracts necessary fields from lead dict.
        
        Args:
            lead: Dict with keys like 'name', 'address', 'city', 'phone', 'website'
        
        Returns:
            Audit results
        """
        # Extract fields from lead
        name = lead.get("name") or lead.get("business_name", "")
        address = lead.get("address") or lead.get("street_address", "")
        
        # Parse city/state from address if not separate
        city = lead.get("city", "")
        state = lead.get("state", "")
        
        if not city and address:
            # Try to parse from full address
            parts = address.split(",")
            if len(parts) >= 2:
                city = parts[-2].strip()
                state_zip = parts[-1].strip()
                state = state_zip.split()[0] if state_zip else ""
        
        phone = lead.get("phone", "")
        website = lead.get("website", "")
        category = lead.get("category", "local_business")
        
        if not name:
            return {"error": "Lead must have a name"}
        
        if not city:
            return {"error": "Could not determine city from lead data"}
        
        return self.run_full_audit(
            business_name=name,
            address=address,
            city=city,
            state=state,
            phone=phone,
            website=website,
            service_type=category
        )


# Singleton instance
citation_client = CitationAuditClient()


if __name__ == "__main__":
    import json
    
    # Test with a sample business
    client = CitationAuditClient()
    
    print("Testing Citation Audit API connection...")
    
    # Quick ping test
    try:
        resp = requests.get(f"{CITATIONS_APP_URL}/ping", timeout=5)
        if resp.text.strip() == "pong":
            print(f"✅ Connected to {CITATIONS_APP_URL}")
        else:
            print(f"❌ Unexpected response: {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Cannot connect to {CITATIONS_APP_URL}: {e}")
        sys.exit(1)
    
    # Run full audit on a test business
    print("\n" + "=" * 60)
    print("Running full citation audit test...")
    print("=" * 60)
    
    result = client.run_full_audit(
        business_name="Test Plumber Co",
        address="123 Main St",
        city="Cleveland",
        state="OH",
        phone="216-555-1234",
        website="https://testplumber.com",
        service_type="plumber"
    )
    
    print("\n📊 RESULTS:")
    print(json.dumps(result, indent=2, default=str))
