#!/usr/bin/env python3
"""
Analyze Lead and Recommend Services using AI.
"""
import os
import json
from typing import Dict, Any, List
from pathlib import Path
from dotenv import load_dotenv

# Load both env files
load_dotenv()
load_dotenv(Path(__file__).parent.parent / ".env.pipeline")
load_dotenv(Path(__file__).parent.parent / ".env.local")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def analyze_services(lead: Dict[str, Any]) -> Dict[str, Any]:
    """
    Use AI to analyze a lead and recommend services.
    
    Services we can offer:
    1. Website Redesign - If design is outdated/cluttered
    2. PageSpeed Optimization - If scores are low
    3. Citations/Backlinks - If missing from directories
    4. Website Builder - If no website exists
    5. SEO Audit - General optimization
    
    Args:
        lead: Enriched lead with screenshot, pagespeed, citations
    
    Returns:
        Lead with recommended_services and lead_score
    """
    import google.generativeai as genai
    
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.0-flash")
    
    # Build context from lead data
    context = f"""
    Business: {lead.get('name', 'Unknown')}
    Category: {lead.get('category', 'Local Business')}
    Website: {lead.get('website', 'None')}
    Rating: {lead.get('rating', 'N/A')}/5 ({lead.get('reviews_count', 0)} reviews)
    
    PageSpeed Scores:
    - Mobile: {lead.get('pagespeed', {}).get('mobile_score', 'N/A')}
    - Desktop: {lead.get('pagespeed', {}).get('desktop_score', 'N/A')}
    
    Citation Status:
    - Found in: {lead.get('citations', {}).get('found_count', 0)} directories
    - Missing from: {lead.get('citations', {}).get('missing_count', 0)} directories
    """
    
    prompt = f"""
    You are a digital marketing consultant analyzing a local business.
    
    {context}
    
    Based on this data, recommend which services would benefit this business.
    Also provide a lead quality score (1-10) based on their potential value.
    
    Return JSON only:
    {{
        "recommended_services": [
            {{"service": "Website Redesign", "priority": "high", "reason": "..."}},
            ...
        ],
        "lead_score": 8,
        "summary": "Brief assessment of the business",
        "talking_points": ["Point 1", "Point 2", "Point 3"]
    }}
    """
    
    try:
        response = model.generate_content(prompt)
        text = response.text
        
        # Extract JSON from response
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        
        analysis = json.loads(text.strip())
        
        lead["recommended_services"] = analysis.get("recommended_services", [])
        lead["lead_score"] = analysis.get("lead_score", 5)
        lead["summary"] = analysis.get("summary", "")
        lead["talking_points"] = analysis.get("talking_points", [])
        lead["analysis_status"] = "complete"
        
    except Exception as e:
        lead["analysis_status"] = f"error: {str(e)}"
        lead["lead_score"] = 5
        lead["recommended_services"] = []
    
    return lead


def analyze_leads_batch(leads: List[Dict]) -> List[Dict]:
    """Analyze multiple leads and sort by score."""
    analyzed = [analyze_services(lead) for lead in leads]
    # Sort by lead score descending
    analyzed.sort(key=lambda x: x.get("lead_score", 0), reverse=True)
    return analyzed


if __name__ == "__main__":
    # Test with sample enriched lead
    test_lead = {
        "name": "Vintage Rock Hair Studio",
        "category": "Hair Salon",
        "website": "https://vintagerockhair.com",
        "rating": 4.5,
        "reviews_count": 89,
        "pagespeed": {"mobile_score": 45, "desktop_score": 62},
        "citations": {"found_count": 12, "missing_count": 38}
    }
    
    result = analyze_services(test_lead)
    print(json.dumps(result, indent=2))
