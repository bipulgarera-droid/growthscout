const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Enable stealth plugin
puppeteer.use(StealthPlugin());

// Command line arguments
const args = process.argv.slice(2);
const urlIndex = args.indexOf('--url');
const outputIndex = args.indexOf('--output');

if (urlIndex === -1 || !args[urlIndex + 1]) {
    console.error('Usage: node brand_screenshot.js --url <website_url> [--output <output_path>]');
    process.exit(1);
}

const url = args[urlIndex + 1];
const outputDir = path.join(__dirname, '../.tmp/screenshots');
const customOutput = outputIndex !== -1 ? args[outputIndex + 1] : null;

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Helper functions
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const sanitizeFilename = (url) => {
    return url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
};

// Human-like scroll to trigger lazy loading
async function humanScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 200;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                // Stop at bottom or after 8000px
                if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 8000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

// Main function
async function captureForBrandExtraction() {
    console.log(`🚀 Starting brand screenshot capture for: ${url}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1920,1080',
            '--disable-web-security',
        ]
    });

    const page = await browser.newPage();

    // Set viewport for full desktop view
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        // Navigate with patience
        console.log('  📄 Loading page...');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for page to settle
        await wait(random(2000, 3000));

        // Move mouse to look human
        await page.mouse.move(random(100, 800), random(100, 600));
        await wait(500);

        // Scroll to load lazy content
        console.log('  📜 Scrolling page...');
        await humanScroll(page);

        // Scroll back to top for full-page capture
        await page.evaluate(() => window.scrollTo(0, 0));
        await wait(1000);

        // Capture FULL PAGE screenshot
        const timestamp = Date.now().toString().slice(-6);
        const filename = `${sanitizeFilename(url)}_${timestamp}.png`;
        const filepath = customOutput || path.join(outputDir, filename);

        console.log('  📸 Capturing full-page screenshot...');
        await page.screenshot({
            path: filepath,
            fullPage: true  // Full page for brand extraction
        });

        // Also capture viewport for quick preview
        const viewportFile = filepath.replace('.png', '_viewport.png');
        await page.screenshot({
            path: viewportFile,
            fullPage: false
        });

        console.log(`  ✅ Saved: ${filepath}`);

        // Output JSON result
        const result = {
            success: true,
            url: url,
            fullPage: filepath,
            viewport: viewportFile,
            timestamp: new Date().toISOString()
        };

        console.log('__JSON_START__');
        console.log(JSON.stringify(result));
        console.log('__JSON_END__');

    } catch (error) {
        console.error(`  ❌ Failed:`, error.message);
        const result = {
            success: false,
            url: url,
            error: error.message
        };
        console.log('__JSON_START__');
        console.log(JSON.stringify(result));
        console.log('__JSON_END__');
    } finally {
        await browser.close();
    }
}

captureForBrandExtraction();
