const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const websiteUrl = 'https://www.benystreeservice.com/'; // guessing a URL
const prompt = `Visit this URL and extract any email address you find on the page or contact page: ${websiteUrl}. Return only the email address, nothing else. If no email found, return NULL.`;

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ url_context: {} }],
        generationConfig: { temperature: 0.0, maxOutputTokens: 100 }
    })
}).then(async r => {
    console.log(r.status);
    console.log(await r.text());
});
