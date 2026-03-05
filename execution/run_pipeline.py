#!/usr/bin/env python3
"""
Full Lead Pipeline - Orchestrates the entire flow.
Combines: Scrape → Enrich → Analyze → Generate Proposal

Usage:
    python run_pipeline.py --niche "Hair Salons" --location "Cleveland, OH" --count 10
"""
import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from dotenv import load_dotenv

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

load_dotenv()
load_dotenv(Path(__file__).parent.parent / ".env.pipeline")

from execution.scrape_leads import scrape_leads
from execution.enrich_lead import enrich_lead, enrich_leads_batch
from execution.analyze_services import analyze_services, analyze_leads_batch
from execution.api_client import api_client

TMP_DIR = Path(__file__).parent.parent / ".tmp"


def run_full_pipeline(
    niche: str,
    location: str,
    count: int = 10,
    generate_slides: bool = True,
    save_results: bool = True
) -> Dict[str, Any]:
    """
    Run the complete lead-to-proposal pipeline.
    
    Steps:
    1. Scrape leads from Apify
    2. Enrich with PageSpeed, Citations, Contacts
    3. AI Analysis for service recommendations
    4. Generate Google Slides proposals
    
    Returns:
        Dict with leads, proposals, and summary stats
    """
    print("\n" + "="*60)
    print(f"🚀 GROWTHSCOUT PIPELINE")
    print(f"   Niche: {niche}")
    print(f"   Location: {location}")
    print(f"   Count: {count}")
    print("="*60 + "\n")
    
    results = {
        "niche": niche,
        "location": location,
        "requested_count": count,
        "started_at": datetime.now().isoformat(),
        "leads": [],
        "proposals": [],
        "stats": {}
    }
    
    # Step 1: Scrape
    print("📍 STEP 1: Scraping Leads...")
    try:
        leads = scrape_leads(niche, location, count, save_to_file=False)
        results["stats"]["scraped"] = len(leads)
        print(f"   ✅ Found {len(leads)} leads\n")
    except Exception as e:
        print(f"   ❌ Scraping failed: {e}")
        results["stats"]["scrape_error"] = str(e)
        return results
    
    # Step 2: Enrich (limit to first 10 for speed)
    print("📊 STEP 2: Enriching Leads...")
    leads_to_enrich = leads[:min(10, len(leads))]
    enriched_leads = []
    
    for i, lead in enumerate(leads_to_enrich):
        print(f"   [{i+1}/{len(leads_to_enrich)}] {lead.get('name', 'Unknown')}...")
        try:
            enriched = enrich_lead(lead)
            enriched_leads.append(enriched)
        except Exception as e:
            print(f"      ⚠️ Enrichment failed: {e}")
            lead["enrichment_error"] = str(e)
            enriched_leads.append(lead)
    
    results["stats"]["enriched"] = len(enriched_leads)
    print(f"   ✅ Enriched {len(enriched_leads)} leads\n")
    
    # Step 3: AI Analysis
    print("🤖 STEP 3: Analyzing Service Opportunities...")
    analyzed_leads = []
    
    for i, lead in enumerate(enriched_leads):
        print(f"   [{i+1}/{len(enriched_leads)}] Analyzing {lead.get('name', 'Unknown')}...")
        try:
            analyzed = analyze_services(lead)
            analyzed_leads.append(analyzed)
        except Exception as e:
            print(f"      ⚠️ Analysis failed: {e}")
            lead["analysis_error"] = str(e)
            analyzed_leads.append(lead)
    
    # Sort by lead score
    analyzed_leads.sort(key=lambda x: x.get("lead_score", 0), reverse=True)
    results["leads"] = analyzed_leads
    results["stats"]["analyzed"] = len(analyzed_leads)
    
    # Count qualified leads (score >= 7)
    qualified = [l for l in analyzed_leads if l.get("lead_score", 0) >= 7]
    results["stats"]["qualified"] = len(qualified)
    print(f"   ✅ {len(qualified)} qualified leads (score >= 7)\n")
    
    # Step 4: Generate Slides (for top leads)
    if generate_slides:
        print("📋 STEP 4: Generating Proposals...")
        proposals = []
        top_leads = qualified[:5]  # Top 5 qualified leads
        
        for i, lead in enumerate(top_leads):
            print(f"   [{i+1}/{len(top_leads)}] {lead.get('name', 'Unknown')}...")
            try:
                result = api_client.generate_slides(lead, lead.get("pagespeed", {}))
                if "slides_url" in result:
                    proposals.append({
                        "business_name": lead.get("name"),
                        "slides_url": result["slides_url"],
                        "lead_score": lead.get("lead_score", 0)
                    })
                    print(f"      ✅ {result['slides_url']}")
                else:
                    print(f"      ⚠️ No slides URL returned")
            except Exception as e:
                print(f"      ❌ Failed: {e}")
        
        results["proposals"] = proposals
        results["stats"]["proposals_generated"] = len(proposals)
    
    # Finalize
    results["completed_at"] = datetime.now().isoformat()
    
    # Save results
    if save_results:
        TMP_DIR.mkdir(exist_ok=True)
        filename = f"pipeline_{niche.lower().replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = TMP_DIR / filename
        with open(filepath, "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\n💾 Results saved to: {filepath}")
    
    # Summary
    print("\n" + "="*60)
    print("📊 PIPELINE SUMMARY")
    print("="*60)
    print(f"   Scraped:    {results['stats'].get('scraped', 0)} leads")
    print(f"   Enriched:   {results['stats'].get('enriched', 0)} leads")
    print(f"   Qualified:  {results['stats'].get('qualified', 0)} leads (score >= 7)")
    print(f"   Proposals:  {results['stats'].get('proposals_generated', 0)} generated")
    print("="*60 + "\n")
    
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the full lead pipeline")
    parser.add_argument("--niche", required=True, help="Business niche (e.g., 'Hair Salons')")
    parser.add_argument("--location", required=True, help="Location (e.g., 'Cleveland, OH')")
    parser.add_argument("--count", type=int, default=10, help="Number of leads to scrape")
    parser.add_argument("--no-slides", action="store_true", help="Skip slides generation")
    
    args = parser.parse_args()
    
    results = run_full_pipeline(
        niche=args.niche,
        location=args.location,
        count=args.count,
        generate_slides=not args.no_slides
    )
