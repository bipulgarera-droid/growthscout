import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = 'v1.11.0';
const REPO = 'gosom/google-maps-scraper';

const platformMap = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'windows'
};

const archMap = {
    x64: 'amd64',
    arm64: 'amd64' // For M1/M2 Rosetta 2 will handle it, or we try to find arm64 if it existed, but gosom only has amd64
};

async function downloadBinary() {
    const platform = platformMap[os.platform()];
    const arch = archMap[os.arch()] || 'amd64';

    if (!platform) {
        console.error(`Unsupported platform: ${os.platform()}`);
        process.exit(1);
    }

    const ext = platform === 'windows' ? '.exe' : '';
    // e.g. google_maps_scraper-1.11.0-linux-amd64
    const filename = `google_maps_scraper-${VERSION.replace('v', '')}-${platform}-${arch}${ext}`;
    const url = `https://github.com/${REPO}/releases/download/${VERSION}/${filename}`;

    const targetDir = path.resolve(__dirname, '../server/bin/scraper');
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFile = path.resolve(targetDir, `google_maps_scraper${ext}`);

    console.log(`Downloading ${filename} from GitHub...`);
    
    // We can use curl for simplicity as it exists on railway and macos
    try {
        if (!fs.existsSync(targetFile)) {
            console.log(`Running: curl -f -L -o "${targetFile}" "${url}"`);
            execSync(`curl -f -L -o "${targetFile}" "${url}"`, { stdio: 'inherit' });
        } else {
            console.log(`Binary already exists at ${targetFile}, skipping download to prevent rate-limiting.`);
        }
        
        if (platform !== 'windows') {
            execSync(`chmod +x "${targetFile}"`);
        }
        console.log(`Successfully installed google-maps-scraper to ${targetFile}`);
    } catch (err) {
        console.error(`Failed to download binary:`, err.message);
        process.exit(1);
    }
}

downloadBinary();
