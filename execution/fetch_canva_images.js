import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';

const url = 'https://ganeshtesting.my.canva.site/';
const outputDir = '/Users/bipul/Downloads/ALL WORKSPACES/fitness-gym-template-with-dashboard/public/images/canva_export';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Helper to download an image
const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 200) {
                res.pipe(fs.createWriteStream(filepath))
                    .on('error', reject)
                    .once('close', () => resolve(filepath));
            } else {
                res.resume(); // Consume response data to free up memory
                reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
            }
        }).on('error', reject);
    });
};

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    console.log(`Navigating to ${url}...`);
    // Canva sites have heavy animations, giving it time to load
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    // Scroll to bottom to trigger lazy loading
    console.log('Scrolling to load all images...');
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });

    // Wait an extra second after scrolling
    await new Promise(r => setTimeout(r, 2000));

    // Extract all image sources
    console.log('Extracting images...');
    const imageUrls = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        const urls = new Set();
        images.forEach(img => {
            if (img.src && img.src.startsWith('http')) urls.add(img.src);
            // also check object-fit backgrounds if Canva uses them
        });

        // Check for background images on div elements
        const divs = Array.from(document.querySelectorAll('div'));
        divs.forEach(div => {
            const style = window.getComputedStyle(div);
            if (style.backgroundImage && style.backgroundImage !== 'none') {
                const urlMatch = style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/i);
                if (urlMatch && urlMatch[1] && urlMatch[1].startsWith('http')) {
                    urls.add(urlMatch[1]);
                }
            }
        });

        return Array.from(urls);
    });

    console.log(`Found ${imageUrls.length} images. Downloading...`);

    for (let i = 0; i < imageUrls.length; i++) {
        const imgUrl = imageUrls[i];
        try {
            // Give them sequential names, maintaining extension if possible
            const extMatch = imgUrl.match(/\.(png|jpg|jpeg|webp|svg)/i);
            const ext = extMatch ? extMatch[0] : '.png'; // default to png
            const filename = `canva_img_${i + 1}${ext}`;
            const filepath = path.join(outputDir, filename);

            await downloadImage(imgUrl, filepath);
            console.log(`Downloaded: ${filename}`);
        } catch (e) {
            console.error(`Failed to download ${imgUrl}: ${e.message}`);
        }
    }

    console.log('Finished downloading all images!');
    await browser.close();
})();
