# GrowthScout CRM Architecture

**Goal:** Document the system architecture for maintainability and onboarding.

## 3-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: DIRECTIVES (This folder)                  │
│  SOPs in Markdown defining goals, inputs, outputs   │
├─────────────────────────────────────────────────────┤
│  Layer 2: ORCHESTRATION (You / the AI agent)        │
│  Reads directives, calls execution tools, handles   │
│  errors, updates directives with learnings          │
├─────────────────────────────────────────────────────┤
│  Layer 3: EXECUTION                                 │
│  - Python scripts: execution/                       │
│  - Backend API routes: server/routes/               │
│  - Backend services: server/services/               │
└─────────────────────────────────────────────────────┘
```

## Backend Structure (Express)

The server is modular. `server/index.ts` is a thin entry point that mounts route files:

| Route File | Mount Point | Responsibility |
|---|---|---|
| `routes/pipeline.ts` | `/api/pipeline` | Streaming scrape pipeline, WhatsApp verify, analysis, bulk enrich, bulk generate, site-gen |
| `routes/enrichment.ts` | `/api` | Apify discover, Serper enrich |
| `routes/slides.ts` | `/api/slides` | Google Slides OAuth + generation |
| `routes/leads.ts` | `/api` | Projects CRUD, leads CRUD, logo upload |
| `routes/rankings.ts` | `/api/rankings` | DataForSEO rank tracking |
| `routes/outreach.ts` | `/api` | Push to outreach platform |
| `routes/fulfillment.ts` | `/` | Form webhooks, review gate (`/r/:slug`), Twilio voice |

## Frontend Structure (React + Vite)

| Page | Purpose |
|---|---|
| `BusinessSearch.tsx` | Discover businesses via Apify/DataForSEO, view enriched data |
| `PipelineSearch.tsx` | Mass scraping pipeline with streaming status |
| `ClientDashboard.tsx` | Manage active clients |

**Data flow:** Frontend reads from Supabase directly via `loadBusinessesFromDB()`. Backend writes to Supabase during pipeline runs. No localStorage sync.

## Database (Supabase)

Project ID: `gouevxvwapnpykvhasgl`

| Table | Purpose | RLS |
|---|---|---|
| `projects` | Multi-project support | ✅ |
| `leads` | All scraped/enriched businesses | ✅ |
| `personalized_previews` | Generated website previews | ✅ |
| `ranked_leads` | DataForSEO ranking results | ✅ |
| `client_leads` | Converted client records | ❌ (needs RLS) |

## Execution Scripts (Python)

| Script | Purpose |
|---|---|
| `run_pipeline.py` | Main scraping pipeline orchestrator |
| `scrape_leads.py` | Apify Google Maps scraper |
| `enrich_lead.py` | Enrichment (PageSpeed, contacts, citations) |
| `analyze_services.py` | Gemini AI service analysis |
| `brand_analysis.py` | Brand/competitor analysis |
| `brand_screenshot.cjs` | Puppeteer website screenshots |
| `citation_audit.py` | Local SEO citation audit |
| `extract_prospect.py` | Extract prospect data |
| `extract_voiceai.py` | Voice AI extraction |
| `full_pipeline.py` | End-to-end pipeline runner |
| `save_preview.py` | Save generated previews |
| `screenshot_extraction.py` | Screenshot processing |
| `telegram_bot.py` | Telegram bot for notifications |
| `api_client.py` | Helper for calling external APIs |

## Environment Variables

```env
# Supabase
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...

# External APIs
APIFY_API_KEY=...
SERPER_API_KEY=...
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...

# Google OAuth (Slides)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Twilio (Fulfillment)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# Outreach Platform
OUTREACH_API_URL=...
OUTREACH_API_KEY=...
```
