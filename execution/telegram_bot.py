#!/usr/bin/env python3
"""
GrowthScout Telegram Bot.
Control lead generation pipeline from your phone.

Based on patterns from YOUTUBE NICHE VERIFIER/execution/telegram_bot.py
"""
import os
import sys
import json
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ConversationHandler,
    ContextTypes,
    filters
)

# Import execution modules
from execution.scrape_leads import scrape_leads
from execution.enrich_lead import enrich_lead, enrich_leads_batch
from execution.analyze_services import analyze_services, analyze_leads_batch
from execution.api_client import api_client

# Import preview pipeline
from execution.screenshot_extraction import extract_brand_from_url
from execution.save_preview import save_preview, generate_slug

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Bot token
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
AUTHORIZED_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')  # Your personal chat ID

# Conversation states
CHOOSING_ACTION, WAITING_NICHE, WAITING_LOCATION, CHOOSING_COUNT, PROCESSING, REVIEWING_LEADS, WAITING_PREVIEW_URL, WAITING_BATCH_FILE = range(8)

# Count options
COUNT_OPTIONS = [
    ("5 leads", 5),
    ("10 leads", 10),
    ("25 leads", 25),
    ("50 leads", 50),
]


def get_main_menu_keyboard():
    """Main menu keyboard."""
    keyboard = [
        [InlineKeyboardButton("🎯 Generate Leads", callback_data="action_leads")],
        [InlineKeyboardButton("🌐 Generate Preview Website", callback_data="action_preview")],
        [InlineKeyboardButton("📦 Batch Process URLs", callback_data="action_batch")],
        [InlineKeyboardButton("📊 View Pipeline Status", callback_data="action_status")],
        [InlineKeyboardButton("⚙️ Settings", callback_data="action_settings")],
    ]
    return InlineKeyboardMarkup(keyboard)


def get_count_keyboard():
    """Lead count selection keyboard."""
    keyboard = [
        [InlineKeyboardButton(f"📊 {label}", callback_data=f"count_{count}")]
        for label, count in COUNT_OPTIONS
    ]
    keyboard.append([InlineKeyboardButton("🔙 Back", callback_data="back_main")])
    return InlineKeyboardMarkup(keyboard)


def get_lead_action_keyboard(lead_index: int, total: int):
    """Actions for a single lead."""
    keyboard = [
        [
            InlineKeyboardButton("✅ Send Email", callback_data=f"send_email_{lead_index}"),
            InlineKeyboardButton("📱 Prep Instagram", callback_data=f"prep_ig_{lead_index}"),
        ],
        [
            InlineKeyboardButton("📊 Generate Slides", callback_data=f"slides_{lead_index}"),
            InlineKeyboardButton("❌ Skip", callback_data=f"skip_{lead_index}"),
        ],
        [
            InlineKeyboardButton(f"⬅️ Prev" if lead_index > 0 else "—", callback_data=f"prev_{lead_index}"),
            InlineKeyboardButton(f"{lead_index + 1}/{total}", callback_data="noop"),
            InlineKeyboardButton(f"Next ➡️" if lead_index < total - 1 else "—", callback_data=f"next_{lead_index}"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Welcome message with main menu."""
    context.user_data.clear()
    
    await update.message.reply_text(
        "🚀 *GrowthScout Lead Generator*\n\n"
        "Generate leads, analyze opportunities, and send proposals—all from your phone.\n\n"
        "What would you like to do?",
        parse_mode='Markdown',
        reply_markup=get_main_menu_keyboard()
    )
    return CHOOSING_ACTION


async def action_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle main menu action selection."""
    query = update.callback_query
    await query.answer()
    
    action = query.data.replace("action_", "")
    
    if action == "leads":
        await query.edit_message_text(
            "🎯 *Generate Leads*\n\n"
            "What niche do you want to target?\n\n"
            "_Examples: Hair Salons, Dentists, Restaurants, HVAC_",
            parse_mode='Markdown'
        )
        return WAITING_NICHE
    
    elif action == "status":
        await query.edit_message_text(
            "📊 *Pipeline Status*\n\n"
            "No active pipelines.\n\n"
            "Use 🎯 Generate Leads to start.",
            parse_mode='Markdown',
            reply_markup=get_main_menu_keyboard()
        )
        return CHOOSING_ACTION
    
    elif action == "proposals":
        await query.edit_message_text(
            "📋 *Recent Proposals*\n\n"
            "No proposals generated yet.\n\n"
            "Use 🎯 Generate Leads to start.",
            parse_mode='Markdown',
            reply_markup=get_main_menu_keyboard()
        )
        return CHOOSING_ACTION
    
    elif action == "settings":
        await query.edit_message_text(
            "⚙️ *Settings*\n\n"
            f"• Audit App: `{api_client.audit_url}`\n"
            f"• Citations App: `{api_client.citations_url}`\n"
            f"• Apify: {'✅ Configured' if os.getenv('APIFY_API_KEY') else '❌ Not set'}\n",
            parse_mode='Markdown',
            reply_markup=get_main_menu_keyboard()
        )
        return CHOOSING_ACTION
    
    elif action == "preview":
        await query.edit_message_text(
            "🌐 *Generate Preview Website*\n\n"
            "Send me a website URL and I'll:\n"
            "1. 📸 Take a screenshot\n"
            "2. 🎨 Extract brand colors & services\n"
            "3. 🏗️ Generate personalized preview\n\n"
            "_Paste the URL now:_",
            parse_mode='Markdown'
        )
        return WAITING_PREVIEW_URL
    
    elif action == "batch":
        await query.edit_message_text(
            "📦 *Batch Process URLs*\n\n"
            "Send me your leads from the pipeline.\n\n"
            "Format: one URL per line, or paste JSON:\n"
            "`[{\"website\": \"url1\"}, ...]`",
            parse_mode='Markdown'
        )
        return WAITING_BATCH_FILE


async def receive_niche(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle niche input."""
    niche = update.message.text.strip()
    context.user_data['niche'] = niche
    
    await update.message.reply_text(
        f"🎯 Niche: *{niche}*\n\n"
        "Now, what location?\n\n"
        "_Examples: Cleveland, OH | Miami, FL | Austin, TX_",
        parse_mode='Markdown'
    )
    return WAITING_LOCATION


async def receive_location(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle location input."""
    location = update.message.text.strip()
    context.user_data['location'] = location
    niche = context.user_data.get('niche', 'Unknown')
    
    await update.message.reply_text(
        f"🎯 Niche: *{niche}*\n"
        f"📍 Location: *{location}*\n\n"
        "How many leads do you want?",
        parse_mode='Markdown',
        reply_markup=get_count_keyboard()
    )
    return CHOOSING_COUNT


async def count_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle count selection and start scraping."""
    query = update.callback_query
    await query.answer()
    
    if query.data == "back_main":
        await query.edit_message_text(
            "🚀 *GrowthScout Lead Generator*\n\nWhat would you like to do?",
            parse_mode='Markdown',
            reply_markup=get_main_menu_keyboard()
        )
        return CHOOSING_ACTION
    
    count = int(query.data.replace("count_", ""))
    niche = context.user_data.get('niche', 'Unknown')
    location = context.user_data.get('location', 'Unknown')
    
    await query.edit_message_text(
        f"🔄 *Scraping {count} {niche} in {location}...*\n\n"
        "This may take a minute.",
        parse_mode='Markdown'
    )
    
    try:
        # Run the pipeline
        leads = scrape_leads(niche, location, count, save_to_file=True)
        context.user_data['leads'] = leads
        
        await query.edit_message_text(
            f"✅ *Found {len(leads)} leads!*\n\n"
            f"🔄 Enriching with PageSpeed, citations, and contacts...",
            parse_mode='Markdown'
        )
        
        # Enrich leads (this takes time)
        enriched = enrich_leads_batch(leads[:5])  # Start with first 5 to test
        
        await query.edit_message_text(
            f"✅ *Enriched {len(enriched)} leads!*\n\n"
            f"🤖 Analyzing service opportunities...",
            parse_mode='Markdown'
        )
        
        # Analyze services
        analyzed = analyze_leads_batch(enriched)
        context.user_data['analyzed_leads'] = analyzed
        context.user_data['current_index'] = 0
        
        # Show first lead
        return await show_lead(query, context)
        
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        await query.edit_message_text(
            f"❌ *Error:* {str(e)}\n\n"
            "Use /start to try again.",
            parse_mode='Markdown'
        )
        return ConversationHandler.END


async def show_lead(query, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Display a single lead for review."""
    leads = context.user_data.get('analyzed_leads', [])
    index = context.user_data.get('current_index', 0)
    
    if not leads or index >= len(leads):
        await query.edit_message_text(
            "✅ *All leads reviewed!*\n\n"
            "Use /start to generate more.",
            parse_mode='Markdown'
        )
        return ConversationHandler.END
    
    lead = leads[index]
    services = lead.get('recommended_services', [])
    services_text = "\n".join([
        f"  • {s.get('service')} ({s.get('priority', 'medium')})"
        for s in services
    ]) if services else "  None identified"
    
    text = (
        f"📋 *{lead.get('name', 'Unknown')}*\n"
        f"⭐ {lead.get('rating', 'N/A')}/5 ({lead.get('reviews_count', 0)} reviews)\n"
        f"🌐 {lead.get('website', 'No website')}\n\n"
        f"📊 *PageSpeed:*\n"
        f"  Mobile: {lead.get('pagespeed', {}).get('mobile_score', 'N/A')}/100\n"
        f"  Desktop: {lead.get('pagespeed', {}).get('desktop_score', 'N/A')}/100\n\n"
        f"📍 *Citations:*\n"
        f"  Found: {lead.get('citations', {}).get('found_count', 0)}\n"
        f"  Missing: {lead.get('citations', {}).get('missing_count', 0)}\n\n"
        f"🎯 *Recommended Services:*\n{services_text}\n\n"
        f"💰 *Lead Score:* {lead.get('lead_score', 5)}/10"
    )
    
    await query.edit_message_text(
        text,
        parse_mode='Markdown',
        reply_markup=get_lead_action_keyboard(index, len(leads))
    )
    return REVIEWING_LEADS


async def lead_action(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle lead action buttons."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    leads = context.user_data.get('analyzed_leads', [])
    
    if data.startswith("next_"):
        context.user_data['current_index'] = min(
            context.user_data.get('current_index', 0) + 1,
            len(leads) - 1
        )
        return await show_lead(query, context)
    
    elif data.startswith("prev_"):
        context.user_data['current_index'] = max(
            context.user_data.get('current_index', 0) - 1,
            0
        )
        return await show_lead(query, context)
    
    elif data.startswith("skip_"):
        context.user_data['current_index'] += 1
        return await show_lead(query, context)
    
    elif data.startswith("send_email_"):
        index = int(data.replace("send_email_", ""))
        lead = leads[index]
        await query.edit_message_text(
            f"📧 *Email Prepared for:* {lead.get('name')}\n\n"
            "Feature coming soon!\n\n"
            "Moving to next lead...",
            parse_mode='Markdown'
        )
        await asyncio.sleep(2)
        context.user_data['current_index'] += 1
        return await show_lead(query, context)
    
    elif data.startswith("slides_"):
        index = int(data.replace("slides_", ""))
        lead = leads[index]
        await query.edit_message_text(
            f"📊 *Generating Slides for:* {lead.get('name')}...\n\n"
            "This may take a minute.",
            parse_mode='Markdown'
        )
        
        try:
            result = api_client.generate_slides(lead, lead.get('pagespeed', {}))
            slides_url = result.get('slides_url', 'Not generated')
            
            await query.edit_message_text(
                f"✅ *Slides Generated!*\n\n"
                f"Business: {lead.get('name')}\n"
                f"Link: {slides_url}",
                parse_mode='Markdown'
            )
        except Exception as e:
            await query.edit_message_text(f"❌ Error: {str(e)}")
        
        await asyncio.sleep(3)
        context.user_data['current_index'] += 1
        return await show_lead(query, context)
    
    return REVIEWING_LEADS


async def receive_preview_url(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle single URL for preview generation."""
    url = update.message.text.strip()
    
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    await update.message.reply_text(
        f"🔄 *Processing:* `{url}`\n\n"
        "📸 Taking screenshot...",
        parse_mode='Markdown'
    )
    
    try:
        # Extract brand data
        brand_data = extract_brand_from_url(url)
        
        if "error" in brand_data:
            await update.message.reply_text(
                f"❌ *Error:* {brand_data['error']}\n\n"
                "Try another URL or use /start",
                parse_mode='Markdown'
            )
            return ConversationHandler.END
        
        await update.message.reply_text(
            f"✅ *Extracted:*\n"
            f"• Business: {brand_data.get('business_name')}\n"
            f"• Services: {len(brand_data.get('services', []))} found\n"
            f"• Primary Color: {brand_data.get('colors', {}).get('primary', 'N/A')}\n\n"
            "💾 Saving to database...",
            parse_mode='Markdown'
        )
        
        # Save to Supabase
        save_result = save_preview(brand_data)
        
        if "error" in save_result:
            await update.message.reply_text(
                f"❌ *Save Error:* {save_result['error']}",
                parse_mode='Markdown'
            )
            return ConversationHandler.END
        
        preview_url = f"http://localhost:3333/preview/{save_result['slug']}"
        
        await update.message.reply_text(
            f"🎉 *Preview Ready!*\n\n"
            f"Business: *{brand_data.get('business_name')}*\n"
            f"Slug: `{save_result['slug']}`\n\n"
            f"🔗 Preview: {preview_url}\n\n"
            "_Use /start for another_",
            parse_mode='Markdown',
            reply_markup=get_main_menu_keyboard()
        )
        
        return CHOOSING_ACTION
        
    except Exception as e:
        logger.error(f"Preview error: {e}")
        await update.message.reply_text(f"❌ Error: {str(e)}")
        return ConversationHandler.END


async def receive_batch_urls(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle batch URL processing."""
    text = update.message.text.strip()
    urls = []
    
    # Try JSON format first
    try:
        data = json.loads(text)
        if isinstance(data, list):
            urls = [item.get('website') or item.get('url') for item in data if item.get('website') or item.get('url')]
    except json.JSONDecodeError:
        # Parse as line-separated URLs
        urls = [line.strip() for line in text.split('\n') if line.strip().startswith('http')]
    
    if not urls:
        await update.message.reply_text(
            "❌ No valid URLs found.\n\n"
            "Send URLs one per line or as JSON.",
            parse_mode='Markdown'
        )
        return WAITING_BATCH_FILE
    
    await update.message.reply_text(
        f"🔄 *Processing {len(urls)} URLs...*\n\n"
        "This may take a few minutes.",
        parse_mode='Markdown'
    )
    
    results = []
    for i, url in enumerate(urls, 1):
        try:
            await update.message.reply_text(f"[{i}/{len(urls)}] Processing: {url}")
            
            brand_data = extract_brand_from_url(url)
            if "error" in brand_data:
                results.append({"url": url, "success": False, "error": brand_data["error"]})
                continue
            
            save_result = save_preview(brand_data)
            if "error" in save_result:
                results.append({"url": url, "success": False, "error": save_result["error"]})
                continue
            
            results.append({
                "url": url,
                "success": True,
                "slug": save_result["slug"],
                "business": brand_data.get("business_name")
            })
        except Exception as e:
            results.append({"url": url, "success": False, "error": str(e)})
    
    # Summary
    success = [r for r in results if r.get("success")]
    failed = [r for r in results if not r.get("success")]
    
    summary = f"✅ *Batch Complete!*\n\n"
    summary += f"• Success: {len(success)}\n"
    summary += f"• Failed: {len(failed)}\n\n"
    
    if success:
        summary += "*Preview URLs:*\n"
        for r in success[:10]:  # Show first 10
            summary += f"• [{r['business']}](http://localhost:3333/preview/{r['slug']})\n"
    
    await update.message.reply_text(
        summary,
        parse_mode='Markdown',
        reply_markup=get_main_menu_keyboard()
    )
    
    return CHOOSING_ACTION


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Cancel conversation."""
    context.user_data.clear()
    await update.message.reply_text("Cancelled. Use /start to begin again.")
    return ConversationHandler.END


def main():
    """Run the bot."""
    if not BOT_TOKEN:
        print("❌ TELEGRAM_BOT_TOKEN not set!")
        return
    
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Conversation handler
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            CHOOSING_ACTION: [
                CallbackQueryHandler(action_selected, pattern="^action_"),
            ],
            WAITING_NICHE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_niche),
            ],
            WAITING_LOCATION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_location),
            ],
            CHOOSING_COUNT: [
                CallbackQueryHandler(count_selected, pattern="^count_|^back_main$"),
            ],
            REVIEWING_LEADS: [
                CallbackQueryHandler(lead_action),
            ],
            WAITING_PREVIEW_URL: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_preview_url),
            ],
            WAITING_BATCH_FILE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_batch_urls),
            ],
        },
        fallbacks=[
            CommandHandler("start", start),
            CommandHandler("cancel", cancel),
        ],
        allow_reentry=True
    )
    
    application.add_handler(conv_handler)
    
    print("🤖 GrowthScout Bot started! Listening...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
