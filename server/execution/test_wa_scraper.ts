import { checkWhatsAppNumber } from '../services/whatsappValidator.js';

async function test() {
    console.log("Testing Puppeteer WhatsApp Validator...");
    try {
        // Use a known WhatsApp number (or just any number to see if it parses correctly)
        // I will use a dummy number for the test
        const result = await checkWhatsAppNumber('+12025550198');
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Test failed:", err);
    }
}

test();
