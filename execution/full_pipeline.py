"""
Full Pipeline: URL → Extract → Save → Ready for Outreach

Orchestrates the entire personalized preview generation flow.
"""

import os
import sys
import json
import argparse
from dotenv import load_dotenv
from pathlib import Path

# Load environment
load_dotenv()
load_dotenv(Path(__file__).parent.parent / '.env.pipeline')

# Import our modules
from screenshot_extraction import extract_brand_from_url
from save_preview import save_preview, generate_slug


def process_single_url(url: str, dry_run: bool = False) -> dict:
    """
    Process a single URL through the full pipeline.
    
    Steps:
    1. Extract brand data from screenshot
    2. Save to Supabase
    3. Return preview URL
    """
    print(f"\n{'='*50}")
    print(f"Processing: {url}")
    print('='*50)
    
    # Step 1: Extract brand data
    print("\n📸 Step 1: Extracting brand data...")
    brand_data = extract_brand_from_url(url)
    
    if "error" in brand_data:
        return {
            "url": url,
            "success": False,
            "error": brand_data["error"]
        }
    
    print(f"  ✓ Business: {brand_data.get('business_name')}")
    print(f"  ✓ Services: {len(brand_data.get('services', []))} found")
    print(f"  ✓ Colors: {brand_data.get('colors', {}).get('primary', 'N/A')}")
    
    if dry_run:
        print("\n🔍 DRY RUN - Not saving to database")
        return {
            "url": url,
            "success": True,
            "dry_run": True,
            "brand_data": brand_data
        }
    
    # Step 2: Save to Supabase
    print("\n💾 Step 2: Saving to database...")
    save_result = save_preview(brand_data)
    
    if "error" in save_result:
        return {
            "url": url,
            "success": False,
            "error": save_result["error"],
            "brand_data": brand_data
        }
    
    print(f"  ✓ Slug: {save_result.get('slug')}")
    print(f"  ✓ Preview URL: {save_result.get('preview_url')}")
    
    return {
        "url": url,
        "success": True,
        "slug": save_result.get('slug'),
        "preview_url": save_result.get('preview_url'),
        "business_name": brand_data.get('business_name')
    }


def process_batch(input_file: str, dry_run: bool = False) -> list:
    """
    Process multiple URLs from a JSON file.
    
    Expected format:
    [
      {"website": "https://example1.com", "name": "Business 1"},
      {"website": "https://example2.com", "name": "Business 2"}
    ]
    """
    with open(input_file, 'r') as f:
        leads = json.load(f)
    
    results = []
    total = len(leads)
    
    for i, lead in enumerate(leads, 1):
        url = lead.get('website')
        if not url:
            print(f"[{i}/{total}] Skipping - no website URL")
            continue
        
        print(f"\n[{i}/{total}] Processing {lead.get('name', url)}...")
        result = process_single_url(url, dry_run)
        results.append(result)
    
    # Summary
    success = len([r for r in results if r.get('success')])
    failed = len([r for r in results if not r.get('success')])
    
    print(f"\n{'='*50}")
    print(f"BATCH COMPLETE: {success} success, {failed} failed")
    print('='*50)
    
    return results


def main():
    parser = argparse.ArgumentParser(description='Personalized Preview Pipeline')
    parser.add_argument('--url', type=str, help='Single URL to process')
    parser.add_argument('--batch', type=str, help='JSON file with multiple leads')
    parser.add_argument('--dry-run', action='store_true', help='Extract only, don\'t save')
    parser.add_argument('--output', type=str, help='Output file for results')
    
    args = parser.parse_args()
    
    if not args.url and not args.batch:
        parser.print_help()
        print("\nExample usage:")
        print("  python full_pipeline.py --url https://example.com")
        print("  python full_pipeline.py --batch leads.json")
        sys.exit(1)
    
    if args.url:
        result = process_single_url(args.url, args.dry_run)
        results = [result]
    else:
        results = process_batch(args.batch, args.dry_run)
    
    # Output results
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved to: {args.output}")
    else:
        print("\nResults:")
        print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
