
import { extractLogo } from '../server/services/analysis';

const url = 'https://www.thestudiosalondowntown.com';

async function test() {
    console.log(`Testing extraction for: ${url}`);
    const logo = await extractLogo(url);
    console.log('Extracted Logo:', logo);
}

test();
