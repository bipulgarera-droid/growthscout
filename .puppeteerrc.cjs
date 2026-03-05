/**
 * Puppeteer config for Railway deployment.
 * Uses system-installed Chromium instead of downloading.
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    skipChromiumDownload: !!process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD,
};
