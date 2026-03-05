# Personalized Website Outreach Pipeline

> End-to-end flow: Discover → Enrich → Personalize → Deploy → Outreach

## Goal
Generate personalized website previews for prospects at scale and send via Instagram DM or email.

---

## Pipeline Steps

### Step 1: Discover Businesses (Already Built)
**Tool:** `execution/apify_scraper.py` or Growthscout UI
**Input:** Industry, location, filters
**Output:** List of businesses with name, website, basic info

### Step 2: Enrich with Contact Info (Already Built)
**Tool:** `execution/enrich_lead.py`
**Input:** Business name, website
**Output:** Phone, email, Instagram, Facebook, founder name

### Step 3: Extract Brand Assets (NEW)
**Tool:** `execution/screenshot_extraction.py`
**Input:** Website URL
**Output:**
```json
{
  "business_name": "...",
  "tagline": "...",
  "colors": { "primary": "#...", "secondary": "#..." },
  "services": ["Service 1", "Service 2", ...],
  "cta_text": "Book Now",
  "vibe": "luxury | modern | clinical"
}
```

### Step 4: Personalize Template
**Tool:** `execution/personalize_template.py` (TO BUILD)
**Input:** Brand data from Step 3
**Output:** Updated template config file

**Logic:**
1. Read brand extraction JSON
2. Generate personalized DeviceScrollyTelling.tsx config
3. Update page footer with business name
4. Copy logo to public folder (if extracted)

### Step 5: Deploy to Personalized Slug
**Tool:** Vercel CLI
**Input:** Personalized template
**Output:** `https://preview.yourdomain.com/[business-slug]`

**Implementation Options:**
- **Option A:** Deploy entire template per business (expensive, slow)
- **Option B:** Single dynamic template with API-driven data (recommended)

### Step 6: Send Outreach
**Tool:** Your existing Instagram DM or email scripts
**Input:** Contact info + preview URL
**Output:** Message sent

---

## Recommended Architecture

### Option B: Dynamic Template (Scalable)

```
┌─────────────────────────────────────────────────┐
│                 Vercel Deployment               │
│     preview.yourdomain.com/[business-slug]      │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│          Dynamic Next.js Template               │
│  - Reads brand data from Supabase by slug       │
│  - Renders personalized content                 │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│              Supabase Database                  │
│  Table: personalized_previews                   │
│  - slug (unique)                                │
│  - business_name                                │
│  - colors (jsonb)                               │
│  - services (array)                             │
│  - contact_info (jsonb)                         │
│  - created_at                                   │
└─────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
CREATE TABLE personalized_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  tagline TEXT,
  website_url TEXT,
  colors JSONB,
  services TEXT[],
  value_props TEXT[],
  cta_text TEXT DEFAULT 'Book Now',
  contact_info JSONB,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
);
```

---

## Scripts to Build

1. **`execution/personalize_template.py`** - Generate config from brand data
2. **`execution/save_preview_to_db.py`** - Store preview data in Supabase
3. **`execution/send_outreach.py`** - Send DM/email with preview URL
4. **`execution/full_pipeline.py`** - Orchestrate entire flow

---

## Usage

```bash
# Single business
python3 execution/full_pipeline.py --url "https://example.com"

# Batch from Apify results
python3 execution/full_pipeline.py --input leads.json --batch
```

---

## Edge Cases

- Website unreachable → Skip, log error
- No services found → Use placeholder services
- Logo not extractable → Use text-only header
- Instagram not found → Skip DM, try email only
