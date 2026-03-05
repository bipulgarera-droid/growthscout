# Cross-App API Integration

**Goal:** Call external apps (audit-app, general_local_seo) from GrowthScout CRM.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              GROWTHSCOUT CRM (Orchestrator)          │
│              Port: 5001 (Frontend) + 5002 (Server)   │
└─────────────┬───────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌─────────────┐   ┌──────────────────┐
│ audit-app   │   │ general_local_seo │
│ Port: 5000  │   │ Port: 8000        │
└─────────────┘   └──────────────────┘
```

## audit-app Endpoints

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/api/pagespeed` | POST | `{ url: string }` | PageSpeed metrics |
| `/api/screenshot` | POST | `{ url: string }` | Base64 screenshot |
| `/api/generate-slides` | POST | `{ business_data, audit_data }` | Slides URL |

## general_local_seo Endpoints

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/api/citation-audit` | POST | `{ business_name, city, domain }` | Citation report |
| `/api/discover-directories` | POST | `{ city, state }` | Directory list |

## Python Helper: `execution/api_client.py`

```python
import os
import requests

AUDIT_APP_URL = os.getenv("AUDIT_APP_URL", "http://localhost:5000")
CITATIONS_APP_URL = os.getenv("CITATIONS_APP_URL", "http://localhost:8000")

def call_audit_app(endpoint: str, data: dict) -> dict:
    """Call audit-app API."""
    response = requests.post(f"{AUDIT_APP_URL}{endpoint}", json=data, timeout=60)
    response.raise_for_status()
    return response.json()

def call_citations_app(endpoint: str, data: dict) -> dict:
    """Call citations-app API."""
    response = requests.post(f"{CITATIONS_APP_URL}{endpoint}", json=data, timeout=60)
    response.raise_for_status()
    return response.json()
```

## Deployment Notes

**Local Development:**
- Run each app on a different port
- Use `localhost` URLs in `.env`

**Production (Railway):**
- Each app gets its own Railway service
- Use Railway internal URLs or public URLs
- Store URLs in Railway environment variables
