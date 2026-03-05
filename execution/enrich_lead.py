#!/usr/bin/env python3
"""
Enrich Lead with additional data from multiple sources.
"""
import os
import asyncio
from typing import Dict, Any
from concurrent.futures import ThreadPoolExecutor
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from api_client import api_client


def enrich_lead(lead: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich a single lead with data from multiple sources.
    
    Enrichments:
    1. Website Screenshot
    2. PageSpeed Audit
    3. Citation Status (from general_local_seo)
    4. Contact Info (email, Instagram)
    
    Args:
        lead: Basic lead dictionary with name, website, etc.
    
    Returns:
        Enriched lead with additional data
    """
    website = lead.get("website", "")
    
    if not website:
        lead["enrichment_status"] = "skipped_no_website"
        return lead
    
    print(f"📊 Enriching: {lead.get('name')}...")
    
    enriched = lead.copy()
    enriched["enrichment_status"] = "in_progress"
    
    # Use ThreadPoolExecutor for parallel API calls
    with ThreadPoolExecutor(max_workers=4) as executor:
        # Submit all tasks
        screenshot_future = executor.submit(api_client.take_screenshot, website)
        pagespeed_future = executor.submit(api_client.get_pagespeed, website)
        # specific directories to check
        directories_to_check = ["Yelp", "YellowPages", "Facebook"]
        citation_futures = []
        for directory in directories_to_check:
            citation_futures.append(
                executor.submit(
                    api_client.check_directory_listing,
                    lead.get("name", ""),
                    lead.get("city", ""),
                    directory
                )
            )
        
        # Collect results
        try:
            screenshot_result = screenshot_future.result(timeout=60)
            # API returns 'base64Image' not 'screenshot'
            enriched["screenshot"] = screenshot_result.get("base64Image", "") or screenshot_result.get("screenshot", "")
            enriched["screenshot_status"] = "success" if enriched["screenshot"] else "failed"
        except Exception as e:
            enriched["screenshot_status"] = f"error: {str(e)}"
        
        try:
            pagespeed_result = pagespeed_future.result(timeout=60)
            enriched["pagespeed"] = {
                "mobile_score": pagespeed_result.get("mobile_score", 0),
                "desktop_score": pagespeed_result.get("desktop_score", 0),
                "fcp": pagespeed_result.get("fcp", ""),
                "lcp": pagespeed_result.get("lcp", ""),
            }
            enriched["pagespeed_status"] = "success"
        except Exception as e:
            enriched["pagespeed_status"] = f"error: {str(e)}"
            
        # Citation results
        found_count = 0
        citation_details = []
        for future, directory in zip(citation_futures, directories_to_check):
            try:
                res = future.result(timeout=30)
                status = res.get("status", "not_found")
                if status == "found":
                    found_count += 1
                citation_details.append({"directory": directory, "status": status, "url": res.get("url")})
            except Exception:
                citation_details.append({"directory": directory, "status": "error"})
                
        enriched["citations"] = {
            "found_count": found_count,
            "missing_count": len(directories_to_check) - found_count,
            "details": citation_details
        }
        enriched["citation_status"] = "success"
    
    enriched["enrichment_status"] = "complete"
    print(f"✅ Enriched: {lead.get('name')}")
    
    return enriched


def enrich_leads_batch(leads: list) -> list:
    """Enrich multiple leads."""
    return [enrich_lead(lead) for lead in leads]


if __name__ == "__main__":
    import json
    
    # Test with a sample lead
    test_lead = {
        "name": "Test Salon",
        "website": "https://example.com",
        "city": "Cleveland"
    }
    
    result = enrich_lead(test_lead)
    print(json.dumps(result, indent=2, default=str))
