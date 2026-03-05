# Lead-to-Proposal Pipeline

**Goal:** Scrape leads via Apify, enrich them with data, analyze service opportunities, generate proposals, and send outreach.

## Pipeline Flow

```
[Apify Scrape] → [Enrich Leads] → [AI Analysis] → [Generate Proposal] → [Outreach]
```

## Steps

### 1. Scrape Leads (Apify)
**Tool:** `execution/scrape_leads.py`
- **Input:** `niche` (str), `location` (str), `count` (int)
- **Process:** Calls Apify Google Maps Scraper
- **Output:** JSON list of businesses with name, address, website, phone, rating

### 2. Enrich Leads
**Tool:** `execution/enrich_lead.py`
- **Input:** Single lead object
- **Process (parallel):**
  1. Screenshot website (`/api/screenshot`)
  2. Run PageSpeed audit (call `audit-app` API)
  3. Find contacts (email, Instagram, LinkedIn)
  4. Check citation status (call `general_local_seo` API)
- **Output:** Enriched lead object with all data

### 3. AI Service Analysis
**Tool:** `execution/analyze_services.py`
- **Input:** Enriched lead object
- **Process:** Uses Gemini to analyze what services to offer:
  - Website Redesign (based on screenshot quality)
  - PageSpeed Optimization (based on scores)
  - Citations/Backlinks (based on citation gaps)
  - Website Builder (if site is missing/broken)
- **Output:** Lead with `recommended_services` array and `lead_score`

### 4. Generate Proposal (Slides)
**Tool:** Call `audit-app` API endpoint `/api/generate-slides`
- **Input:** Lead data, recommended services, screenshots
- **Output:** Google Slides URL

### 5. Outreach
**Tool:** `execution/send_outreach.py`
- **Input:** Lead with proposal URL
- **Channels:**
  - Email: Gmail API (safe, automated)
  - Instagram: Manual review mode (prepare message, user sends)

## Integration Points

| External App | Base URL (Local) | Endpoint |
|--------------|------------------|----------|
| audit-app | http://localhost:5000 | `/api/audit`, `/api/generate-slides` |
| general_local_seo | http://localhost:8000 | `/api/citation-audit` |

## Environment Variables

```env
AUDIT_APP_URL=http://localhost:5000
CITATIONS_APP_URL=http://localhost:8000
APIFY_API_KEY=...
GMAIL_CREDENTIALS_PATH=./credentials.json
```

## Outputs
- Enriched leads in `.tmp/leads_{date}.json`
- Proposal slide URLs in `.tmp/proposals_{date}.json`
