import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

puppeteer.use(StealthPlugin());

const TMP_DIR = path.join(process.cwd(), '.tmp', 'screenshots');

if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
}

export type ScreenshotOptions = {
    url: string;
    view?: 'desktop' | 'mobile';
    fullPage?: boolean;
    belowFold?: boolean; // NEW: Capture below the fold section
    hideCookiePopups?: boolean;
    waitMs?: number; // NEW: Wait time before capture
};

export const captureScreenshot = async (options: ScreenshotOptions) => {
    const {
        url,
        view = 'desktop',
        fullPage = false,
        belowFold = false,
        hideCookiePopups = true,
        waitMs = 2000 // Default 2 second wait
    } = options;

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
        const page = await browser.newPage();

        // Viewport settings
        const viewportHeight = 900;
        if (view === 'mobile') {
            await page.setViewport({ width: 375, height: 812, isMobile: true });
        } else {
            await page.setViewport({ width: 1440, height: viewportHeight });
        }

        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for page to fully render (user-configurable delay)
        console.log(`Waiting ${waitMs}ms for page to load...`);
        await new Promise(r => setTimeout(r, waitMs));

        // Dismiss common popups
        if (hideCookiePopups) {
            try {
                const dismissSelectors = [
                    '[class*="cookie"] button', '[id*="cookie"] button',
                    'button[class*="accept"]', 'button[class*="agree"]',
                    '[aria-label="Close"]', '[class*="consent"] button',
                    '[class*="popup"] button[class*="close"]'
                ];
                for (const selector of dismissSelectors) {
                    const el = await page.$(selector);
                    if (el) {
                        await el.click();
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
            } catch (e) {
                console.warn('Popup dismissal failed', e);
            }
        }

        // Generate Filename
        const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
        const suffix = belowFold ? 'below' : (fullPage ? 'full' : 'above');
        const filename = `${new URL(url).hostname.replace(/[^a-z0-9]/gi, '_')}_${hash}_${view}_${suffix}.png`;
        const filepath = path.join(TMP_DIR, filename);

        // Capture based on options
        if (fullPage) {
            await page.screenshot({ path: filepath, fullPage: true });
        } else if (belowFold) {
            // Scroll down one viewport height, then capture
            await page.evaluate((vh) => {
                window.scrollTo(0, vh);
            }, viewportHeight);
            await new Promise(r => setTimeout(r, 500)); // Brief pause after scroll
            await page.screenshot({ path: filepath, fullPage: false });
        } else {
            // Above the fold (default)
            await page.screenshot({ path: filepath, fullPage: false });
        }

        console.log(`Screenshot saved to ${filepath}`);

        // Read file to return base64
        const imageBuffer = fs.readFileSync(filepath);
        const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

        return { filepath, base64Image };

    } catch (error) {
        console.error('Screenshot failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
};

// Capture both above and below fold in one call (Legacy for backward compat)
export const captureFullAudit = async (url: string, view: 'desktop' | 'mobile' = 'desktop') => {
    const aboveFold = await captureScreenshot({ url, view, belowFold: false });
    const belowFoldResult = await captureScreenshot({ url, view, belowFold: true });

    return {
        aboveFold: aboveFold.base64Image,
        belowFold: belowFoldResult.base64Image
    };
};

export const captureScrollingScreenshots = async (url: string): Promise<string[]> => {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });

        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for hydration
        await new Promise(r => setTimeout(r, 2000));

        // Hide Popups
        try {
            const dismissSelectors = [
                '[class*="cookie"] button', '[id*="cookie"] button',
                'button[class*="accept"]', 'button[class*="agree"]',
                '[aria-label="Close"]', '[class*="consent"] button'
            ];
            for (const selector of dismissSelectors) {
                const el = await page.$(selector);
                if (el) { await el.click(); await new Promise(r => setTimeout(r, 500)); }
            }
        } catch (e) { }

        const screenshots: string[] = [];

        // 1. Hero (0px)
        const heroPath = path.join(TMP_DIR, `scroll_hero_${Date.now()}.png`);
        await page.screenshot({ path: heroPath, fullPage: false });
        screenshots.push(`data:image/png;base64,${fs.readFileSync(heroPath).toString('base64')}`);

        // 2. Middle (900px)
        await page.evaluate(() => window.scrollTo(0, 900));
        await new Promise(r => setTimeout(r, 1000)); // Wait for scroll
        const midPath = path.join(TMP_DIR, `scroll_mid_${Date.now()}.png`);
        await page.screenshot({ path: midPath, fullPage: false });
        screenshots.push(`data:image/png;base64,${fs.readFileSync(midPath).toString('base64')}`);

        // 3. Bottom (1800px or bottom of page)
        await page.evaluate(() => window.scrollTo(0, 1800));
        await new Promise(r => setTimeout(r, 1000));
        const botPath = path.join(TMP_DIR, `scroll_bot_${Date.now()}.png`);
        await page.screenshot({ path: botPath, fullPage: false });
        screenshots.push(`data:image/png;base64,${fs.readFileSync(botPath).toString('base64')}`);

        console.log(`captured ${screenshots.length} scrolling screenshots`);
        return screenshots;

    } catch (error) {
        console.error('Scrolling capture failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
};
