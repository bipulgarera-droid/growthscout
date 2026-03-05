#!/usr/bin/env python3
"""
Scrape Leads from Google Maps via Apify.
"""
import os
import json
from datetime import datetime
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

APIFY_API_KEY = os.getenv("APIFY_API_KEY")
TMP_DIR = os.path.join(os.path.dirname(__file__), "..", ".tmp")


def scrape_leads(
    niche: str,
    location: str,
    count: int = 10,
    save_to_file: bool = True
) -> List[Dict]:
    """
    Scrape leads from Google Maps using Apify.
    
    Args:
        niche: Business type (e.g., "Hair Salons", "Dentists")
        location: Location (e.g., "Cleveland, OH")
        count: Number of leads to scrape
        save_to_file: Whether to save results to .tmp/
    
    Returns:
        List of business dictionaries
    """
    if not APIFY_API_KEY:
        raise ValueError("APIFY_API_KEY not set in environment")
    
    from apify_client import ApifyClient
    
    client = ApifyClient(APIFY_API_KEY)
    
    # Google Maps Scraper actor
    actor_id = "compass/crawler-google-places"
    
    run_input = {
        "searchStringsArray": [f"{niche} in {location}"],
        "maxCrawledPlacesPerSearch": count,
        "language": "en",
        "includeWebResults": True,
    }
    
    print(f"🔍 Scraping {count} {niche} in {location}...")
    
    # Run the actor and wait for it to finish
    run = client.actor(actor_id).call(run_input=run_input)
    
    # Fetch results from the dataset
    dataset_items = client.dataset(run["defaultDatasetId"]).list_items().items
    
    # Transform to our format
    leads = []
    for item in dataset_items:
        lead = {
            "id": item.get("placeId", ""),
            "name": item.get("title", ""),
            "address": item.get("address", ""),
            "city": item.get("city", location.split(",")[0].strip()),
            "phone": item.get("phone", ""),
            "website": item.get("website", ""),
            "rating": item.get("totalScore", 0),
            "reviews_count": item.get("reviewsCount", 0),
            "category": item.get("categoryName", niche),
            "scraped_at": datetime.now().isoformat()
        }
        leads.append(lead)
    
    print(f"✅ Found {len(leads)} leads")
    
    # Save to file
    if save_to_file:
        os.makedirs(TMP_DIR, exist_ok=True)
        filename = f"leads_{niche.lower().replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(TMP_DIR, filename)
        with open(filepath, "w") as f:
            json.dump(leads, f, indent=2)
        print(f"💾 Saved to {filepath}")
    
    return leads


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Scrape leads from Google Maps")
    parser.add_argument("--niche", required=True, help="Business type (e.g., 'Hair Salons')")
    parser.add_argument("--location", required=True, help="Location (e.g., 'Cleveland, OH')")
    parser.add_argument("--count", type=int, default=10, help="Number of leads")
    
    args = parser.parse_args()
    
    leads = scrape_leads(args.niche, args.location, args.count)
    print(json.dumps(leads, indent=2))
