#!/usr/bin/env python3
"""
Brand Analysis Tool

Combines:
1. Firecrawl - Extract page content (text, metadata)
2. Dembrandt API - Extract design tokens (colors, typography)
3. Screenshot - Visual capture
4. Gemini AI - Analyze and produce brand insights

Output: Positioning, Aesthetics (Vibe, Colors, Feel), CTAs, Logo Style
"""
import os
import sys
import json
import requests
from pathlib import Path
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Load environment
load_dotenv()
load_dotenv(Path(__file__).parent.parent / ".env.pipeline")
load_dotenv(Path(__file__).parent.parent / ".env.local")

# API URLs
FIRECRAWL_API_URL = os.getenv("FIRECRAWL_API_URL", "https://api.firecrawl.dev/v1")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")
DEMBRANDT_API_URL = os.getenv("DEMBRANDT_API_URL", "http://localhost:3001")
GROWTHSCOUT_SERVER_URL = os.getenv("GROWTHSCOUT_SERVER_URL", "http://localhost:5002")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


class BrandAnalyzer:
    """Analyze brand identity from a website."""
    
    def __init__(self):
        self.firecrawl_url = FIRECRAWL_API_URL
        self.firecrawl_key = FIRECRAWL_API_KEY
        self.dembrandt_url = DEMBRANDT_API_URL
        self.screenshot_url = GROWTHSCOUT_SERVER_URL
    
    def scrape_content(self, url: str) -> Dict:
        """
        Step 1: Scrape website content using Jina Reader (free, no API key).
        Returns markdown content, title, description.
        """
        print(f"📄 Scraping content from {url}...")
        
        # Jina Reader: prepend r.jina.ai/ to any URL to get markdown
        jina_url = f"https://r.jina.ai/{url}"
        
        try:
            response = requests.get(
                jina_url,
                headers={"Accept": "text/markdown"},
                timeout=60
            )
            
            if response.status_code == 200:
                content = response.text
                
                # Extract title from markdown (first # heading)
                title = ""
                for line in content.split('\n'):
                    if line.startswith('# '):
                        title = line[2:].strip()
                        break
                
                # Extract description (first paragraph after title)
                description = ""
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if line.strip() and not line.startswith('#') and not line.startswith('['):
                        description = line.strip()[:200]
                        break
                
                return {
                    "success": True,
                    "content": content,
                    "title": title,
                    "description": description
                }
            else:
                return {"success": False, "error": f"Jina Reader error: {response.status_code}"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def extract_design_tokens(self, url: str) -> Dict:
        """
        Step 2: Extract design tokens using Dembrandt API.
        Returns colors, typography, spacing, etc.
        """
        print(f"🎨 Extracting design tokens from {url}...")
        
        try:
            response = requests.post(
                f"{self.dembrandt_url}/api/extract",
                json={"url": url},
                timeout=120
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"success": False, "error": f"Dembrandt error: {response.status_code}"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def capture_screenshot(self, url: str) -> Dict:
        """
        Step 3: Capture screenshot of the website.
        Returns base64 image.
        """
        print(f"📸 Capturing screenshot of {url}...")
        
        try:
            response = requests.post(
                f"{self.screenshot_url}/api/screenshot",
                json={"url": url},
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "screenshot": data.get("base64Image", "")
                }
            else:
                return {"success": False, "error": f"Screenshot error: {response.status_code}"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def analyze_brand(self, content: Dict, tokens: Dict, screenshot: Dict, url: str) -> Dict:
        """
        Step 4: Use Gemini to analyze all data and produce brand insights.
        """
        print(f"🤖 Analyzing brand identity...")
        
        import google.generativeai as genai
        
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")
        
        # Extract key data for prompt
        title = content.get("title", "Unknown")
        description = content.get("description", "")
        page_content = content.get("content", "")[:3000]  # Limit content
        
        # Extract colors from tokens
        colors = []
        if tokens.get("success") and tokens.get("design_tokens"):
            dt = tokens["design_tokens"]
            if isinstance(dt, dict) and dt.get("colors"):
                color_data = dt.get("colors", {})
                if isinstance(color_data, dict) and color_data.get("palette"):
                    for c in color_data["palette"][:10]:
                        if isinstance(c, dict):
                            colors.append(c.get("normalized", c.get("color", "")))
        
        prompt = f"""You are a brand analyst. Analyze this website and provide detailed brand insights.

**Website:** {url}
**Title:** {title}
**Description:** {description}

**Page Content (excerpt):**
{page_content[:2000]}

**Extracted Colors:**
{', '.join(colors) if colors else 'Not extracted'}

**Design Token Summary:**
{json.dumps(tokens.get('design_tokens', {}).get('typography', {}), indent=2)[:500] if tokens.get('success') else 'Not available'}

---

Analyze and provide:

1. **Positioning**: What is their market position? Who are they targeting? What problem do they solve?

2. **Aesthetics**:
   - **Vibe**: Describe the overall feel (e.g., professional, playful, minimalist, luxurious)
   - **Colors**: Describe the color palette and what it communicates
   - **Feel**: The emotional response the site evokes

3. **CTAs**: What are their main calls-to-action? What words/phrases do they use?

4. **Logo/Branding**: Describe the logo style (if visible) and overall brand identity

5. **Key Differentiators**: What makes this brand unique?

Format your response as structured sections with bullet points. Be specific and actionable.
"""
        
        try:
            response = model.generate_content(prompt)
            return {
                "success": True,
                "analysis": response.text,
                "colors_extracted": colors
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def analyze_url(self, url: str) -> Dict:
        """
        Full brand analysis pipeline for a single URL.
        """
        result = {
            "url": url,
            "status": "in_progress"
        }
        
        # Step 1: Scrape content
        content = self.scrape_content(url)
        result["content_extracted"] = content.get("success", False)
        if content.get("success"):
            result["title"] = content.get("title")
            result["description"] = content.get("description")
        
        # Step 2: Extract design tokens
        tokens = self.extract_design_tokens(url)
        result["tokens_extracted"] = tokens.get("success", False)
        
        # Step 3: Screenshot (optional, can skip if Dembrandt worked)
        screenshot = {"success": False}
        # screenshot = self.capture_screenshot(url)  # Uncomment if needed
        
        # Step 4: AI Analysis
        analysis = self.analyze_brand(content, tokens, screenshot, url)
        result["analysis"] = analysis.get("analysis", "")
        result["colors"] = analysis.get("colors_extracted", [])
        result["status"] = "complete" if analysis.get("success") else "partial"
        
        return result
    
    def analyze_competitors(self, urls: List[str], industry: str = "") -> Dict:
        """
        Analyze multiple competitor websites and compare.
        """
        print(f"🔍 Analyzing {len(urls)} competitor websites...")
        
        results = []
        for url in urls:
            print(f"\n{'='*60}")
            print(f"Analyzing: {url}")
            print('='*60)
            
            result = self.analyze_url(url)
            results.append(result)
        
        # Generate comparison summary
        comparison = self._generate_comparison(results, industry)
        
        return {
            "industry": industry,
            "competitors_analyzed": len(results),
            "analyses": results,
            "comparison_summary": comparison
        }
    
    def _generate_comparison(self, results: List[Dict], industry: str) -> str:
        """Generate a comparison summary across all analyzed brands."""
        import google.generativeai as genai
        
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")
        
        summaries = []
        for r in results:
            summaries.append(f"**{r.get('url')}**:\n{r.get('analysis', 'No analysis')[:1000]}")
        
        prompt = f"""You analyzed {len(results)} competitors in the {industry or 'unknown'} industry.

Here are the individual analyses:

{chr(10).join(summaries)}

---

Now provide a **Competitive Comparison Summary**:

1. **Common Patterns**: What do these brands have in common?
2. **Differentiation Opportunities**: Where are the gaps? What's missing in the market?
3. **Color Trends**: What colors dominate this industry?
4. **Messaging Patterns**: Common CTAs, positioning approaches
5. **Recommendations**: If building a new brand in this space, what would you recommend?

Be specific and actionable.
"""
        
        try:
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Comparison generation failed: {e}"


# Singleton
brand_analyzer = BrandAnalyzer()


if __name__ == "__main__":
    analyzer = BrandAnalyzer()
    
    # Test with a single URL
    print("=" * 60)
    print("🚀 BRAND ANALYSIS TEST")
    print("=" * 60)
    
    result = analyzer.analyze_url("https://stripe.com")
    
    print("\n" + "=" * 60)
    print("📊 RESULTS")
    print("=" * 60)
    print(f"URL: {result.get('url')}")
    print(f"Status: {result.get('status')}")
    print(f"Title: {result.get('title')}")
    print(f"Colors: {result.get('colors')}")
    print(f"\n🎯 ANALYSIS:\n{result.get('analysis', 'N/A')}")
