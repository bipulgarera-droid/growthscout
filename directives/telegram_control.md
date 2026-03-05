# Telegram Bot Control

**Goal:** Control the entire lead pipeline from Telegram on your phone.

## Commands

| Command | Action |
|---------|--------|
| `/start` | Main menu |
| `/leads` | Start lead generation flow |
| `/status` | Check pipeline status |
| `/proposals` | List generated proposals |

## Lead Generation Flow

```
User: /leads
Bot: "Which niche? (e.g., Hair Salons, Dentists)"
User: "Hair Salons"
Bot: "Which location? (e.g., Cleveland, OH)"
User: "Cleveland, OH"
Bot: "How many leads? [5] [10] [25] [50]"
User: [10]
Bot: "🔄 Scraping 10 Hair Salons in Cleveland, OH..."
Bot: "✅ Found 10 leads. Processing..."
Bot: "📊 Ready! 8 qualified, 2 low quality."
Bot: "[View Proposals] [Send Outreach] [Export CSV]"
```

## Approval Flow

When proposals are ready:
```
Bot: "📋 Proposal for 'Vintage Rock Hair Studio'
     - PageSpeed: 45/100 (Poor)
     - Citations: 3/50 directories
     - Services: Redesign, Speed, Citations
     
     [✅ Send Email] [📱 Prep Instagram] [❌ Skip]"
```

## Telegram Bot Setup

**Required env vars:**
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id (for notifications)
```

**Reference:** See `YOUTUBE NICHE VERIFIER/execution/telegram_bot.py` for patterns.

## Key Patterns from YouTube Niche Verifier

1. **ConversationHandler** - Multi-step flows with states
2. **InlineKeyboardMarkup** - Interactive buttons
3. **CallbackQueryHandler** - Handle button clicks
4. **Job Queue** - Background processing with status updates
